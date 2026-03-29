import * as path from 'path';
import * as fs from 'fs';
import {
  parseFile,
  buildCallGraph,
  detectEntryPoints,
  partitionFlows,
  initTreeSitter,
  FunctionNode,
  Graph,
  RawCall,
  SupportedLanguage,
} from '@codeflow-map/core';
import { getCached, setCached } from './cache';
import { discoverFiles, DiscoveryOptions } from './fileDiscovery';
import { logVerbose, logWarning } from './logger';

/**
 * Get file parsing batch size from environment variable.
 * FLOWMAP_BATCH_SIZE: number of files per batch (default: 50)
 */
function getParseBatchSize(): number {
  const envValue = process.env.FLOWMAP_BATCH_SIZE;
  if (!envValue) return 50;
  const parsed = parseInt(envValue, 10);
  if (!isFinite(parsed) || parsed < 1) {
    logWarning(`[flowmap] Invalid FLOWMAP_BATCH_SIZE: "${envValue}" (must be positive integer). Using default 50.`);
    return 50;
  }
  return parsed;
}

const BATCH_SIZE = getParseBatchSize();
let treeSitterInitialized = false;

export function resolveWasmDir(): string {
  // 1. Explicit env var
  if (process.env.FLOWMAP_GRAMMARS) {
    return process.env.FLOWMAP_GRAMMARS;
  }

  const candidates = [
    // Bundled runtime: dist/index.js => <package-root>/grammars
    path.resolve(__dirname, '..', 'grammars'),
    // Dev/tsc layout: src/utils or dist/utils => <package-root>/grammars
    path.resolve(__dirname, '..', '..', 'grammars'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'tree-sitter.wasm'))) {
      return candidate;
    }
  }

  // Last-resort fallback keeps previous behavior for unexpected layouts.
  return candidates[0];
}

async function ensureTreeSitter(): Promise<void> {
  if (!treeSitterInitialized) {
    const wasmDir = resolveWasmDir();
    if (process.env.FLOWMAP_VERBOSE !== 'false') {
      const wasmPath = path.join(wasmDir, 'tree-sitter.wasm');
      const wasmExists = fs.existsSync(wasmPath);
      logVerbose(`[flowmap] Grammar directory: ${wasmDir} (tree-sitter.wasm ${wasmExists ? 'found' : 'missing'})`);
    }
    await initTreeSitter(wasmDir);
    treeSitterInitialized = true;
  }
}

export interface AnalyzeOptions extends DiscoveryOptions {}

export async function analyzeWorkspace(
  workspacePath: string,
  options: AnalyzeOptions = {},
): Promise<Graph> {
  // Check cache
  const cached = getCached(workspacePath);
  if (cached) return cached;

  await ensureTreeSitter();
  const wasmDir = resolveWasmDir();
  const startTime = Date.now();

  // Discover files
  const files = await discoverFiles(workspacePath, options);

  const allFunctions: FunctionNode[] = [];
  const allCalls: RawCall[] = [];
  let scannedFiles = 0;

  // Batch-parse to avoid EMFILE
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(f => parseFile(f.filePath, f.absPath, wasmDir, f.languageId).catch(() => null)),
    );
    for (const result of results) {
      if (result) {
        allFunctions.push(...result.functions);
        allCalls.push(...result.calls);
        scannedFiles++;
      }
    }
  }

  // Build graph
  const edges = buildCallGraph(allFunctions, allCalls);
  detectEntryPoints(allFunctions, edges);
  const { flows, orphans } = partitionFlows(allFunctions, edges);

  const graph: Graph = {
    nodes: allFunctions,
    edges,
    flows,
    orphans,
    scannedFiles,
    durationMs: Date.now() - startTime,
  };

  setCached(workspacePath, graph);
  return graph;
}
