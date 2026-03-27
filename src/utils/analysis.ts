import * as path from 'path';
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

const BATCH_SIZE = 50;
let treeSitterInitialized = false;

export function resolveWasmDir(): string {
  // 1. Explicit env var
  if (process.env.FLOWMAP_GRAMMARS) {
    return process.env.FLOWMAP_GRAMMARS;
  }
  // 2. Bundled grammars in the published package: dist/utils/analysis.js → ../../grammars
  //    __dirname = <package-root>/dist/utils  →  <package-root>/grammars
  return path.resolve(__dirname, '..', '..', 'grammars');
}

async function ensureTreeSitter(): Promise<void> {
  if (!treeSitterInitialized) {
    await initTreeSitter(resolveWasmDir());
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
