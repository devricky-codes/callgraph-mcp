import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as fs from 'fs';
import { FunctionNode } from '@codeflow-map/core';
import { analyzeWorkspace } from '../utils/analysis';
import { registerTool } from '../utils/toolHelper';

// ---------------------------------------------------------------------------
// Jaccard similarity between two sets of strings
// ---------------------------------------------------------------------------
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const v of a) if (b.has(v)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// ---------------------------------------------------------------------------
// Union-Find to cluster similar functions
// ---------------------------------------------------------------------------
class UnionFind {
  private parent: Map<string, string> = new Map();
  find(x: string): string {
    if (this.parent.get(x) !== x) {
      this.parent.set(x, this.find(this.parent.get(x)!));
    }
    return this.parent.get(x)!;
  }
  union(x: string, y: string): void {
    if (!this.parent.has(x)) this.parent.set(x, x);
    if (!this.parent.has(y)) this.parent.set(y, y);
    const rx = this.find(x);
    const ry = this.find(y);
    if (rx !== ry) this.parent.set(rx, ry);
  }
  init(id: string): void {
    if (!this.parent.has(id)) this.parent.set(id, id);
  }
  clusters(): Map<string, string[]> {
    const map = new Map<string, string[]>();
    for (const id of this.parent.keys()) {
      const root = this.find(id);
      if (!map.has(root)) map.set(root, []);
      map.get(root)!.push(id);
    }
    return map;
  }
}

function envThreshold(): number {
  const v = parseFloat(process.env.FLOWMAP_DUP_THRESHOLD ?? '');
  return isFinite(v) && v >= 0 && v <= 1 ? v : 0.75;
}

function envMinCallees(): number {
  const v = parseInt(process.env.FLOWMAP_DUP_MIN_CALLEES ?? '', 10);
  return isFinite(v) && v >= 1 ? v : 2;
}

export function registerFindDuplicates(server: McpServer): void {
  registerTool(
    server,
    'flowmap_find_duplicates',
    'Identify functionally duplicate functions — different names, potentially in different files or components, but calling the same set of dependencies (same business logic). Uses callee-set Jaccard similarity: two functions are flagged as duplicates when the overlap of what they call exceeds the similarity threshold. Results are grouped into clusters so you can see when 3+ functions are all doing the same thing. Use this to find refactoring opportunities and candidates for a shared utility. Default thresholds can be tuned via FLOWMAP_DUP_THRESHOLD and FLOWMAP_DUP_MIN_CALLEES environment variables.',
    {
      workspacePath: z.string().describe('Absolute path to the repository root'),
      similarityThreshold: z.number().min(0).max(1).optional().describe(
        'Jaccard similarity threshold (0–1). Default: 0.75 (or FLOWMAP_DUP_THRESHOLD env var). Lower = more matches, higher = stricter. 1.0 = identical callee sets.',
      ),
      minCallees: z.number().int().min(1).optional().describe(
        'Minimum number of distinct callees a function must have to be considered. Default: 2 (or FLOWMAP_DUP_MIN_CALLEES env var). Raising this avoids matching trivial one-liner wrappers.',
      ),
      exclude: z.string().optional().describe(
        'Comma-separated glob patterns to exclude. Defaults: node_modules,dist,.git,__pycache__,*.test.*,*.spec.*',
      ),
    },
    async ({ workspacePath, similarityThreshold, minCallees, exclude }) => {
      const resolvedThreshold = similarityThreshold ?? envThreshold();
      const resolvedMinCallees = minCallees ?? envMinCallees();
      try {
        if (!fs.existsSync(workspacePath)) {
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                error: true,
                code: 'WORKSPACE_NOT_FOUND',
                message: `Directory does not exist: ${workspacePath}`,
                workspacePath,
              }),
            }],
          };
        }

        const DEFAULT_EXCLUDES = ['node_modules', 'dist', '.git', '__pycache__', '*.test.*', '*.spec.*'];
        const excludeList = exclude
          ? exclude.split(',').map(s => s.trim()).filter(Boolean)
          : DEFAULT_EXCLUDES;

        const graph = await analyzeWorkspace(workspacePath, { exclude: excludeList });

        const similarityThreshold = resolvedThreshold;
        const minCallees = resolvedMinCallees;

        // Build callee-name set per function
        // Using callee *names* (not IDs) so the comparison is semantic, not
        // identity-based — two functions calling `validateInput` both call the
        // same concept even if the resolved IDs differ across files.
        const calleeNames = new Map<string, Set<string>>();
        const nodeById = new Map<string, FunctionNode>(graph.nodes.map(n => [n.id, n]));

        for (const node of graph.nodes) {
          calleeNames.set(node.id, new Set());
        }

        for (const edge of graph.edges) {
          if (edge.from === edge.to) continue; // skip self-loops
          const calleeNode = nodeById.get(edge.to);
          const calleeName = calleeNode?.name ?? edge.to;
          calleeNames.get(edge.from)?.add(calleeName);
        }

        // Filter to functions with enough callees to be meaningful
        const candidates = graph.nodes.filter(
          n => (calleeNames.get(n.id)?.size ?? 0) >= minCallees,
        );

        // O(n²) pair comparison — guarded by minCallees filter
        const uf = new UnionFind();
        for (const node of candidates) uf.init(node.id);

        // Track best similarity per pair for reporting
        const pairSimilarity = new Map<string, number>();

        for (let i = 0; i < candidates.length; i++) {
          const a = candidates[i];
          const setA = calleeNames.get(a.id)!;
          for (let j = i + 1; j < candidates.length; j++) {
            const b = candidates[j];
            // Quick skip: if names are identical and in the same file, not a duplication concern
            if (a.name === b.name && a.filePath === b.filePath) continue;

            const setB = calleeNames.get(b.id)!;
            const sim = jaccard(setA, setB);
            if (sim >= similarityThreshold) {
              uf.union(a.id, b.id);
              const key = [a.id, b.id].sort().join('|||');
              pairSimilarity.set(key, sim);
            }
          }
        }

        // Build clusters — only keep clusters with >1 member
        const rawClusters = uf.clusters();
        const duplicateClusters: Array<{
          clusterIndex: number;
          size: number;
          members: Array<{
            id: string;
            name: string;
            filePath: string;
            startLine: number;
            language: string;
            calleeCount: number;
            callees: string[];
          }>;
          sharedCallees: string[];
          minSimilarity: number;
          maxSimilarity: number;
          suggestion: string;
        }> = [];

        let clusterIndex = 1;
        for (const [, memberIds] of rawClusters) {
          if (memberIds.length < 2) continue;

          const members = memberIds.map(id => {
            const n = nodeById.get(id)!;
            const callees = [...(calleeNames.get(id) ?? [])].sort();
            return {
              id,
              name: n?.name ?? 'unknown',
              filePath: n?.filePath ?? 'unknown',
              startLine: n?.startLine ?? 0,
              language: n?.language ?? 'unknown',
              calleeCount: callees.length,
              callees,
            };
          });

          // Shared callees across all members in the cluster
          const allCalleeSets = memberIds.map(id => calleeNames.get(id)!);
          const sharedCallees = [...allCalleeSets[0]].filter(c =>
            allCalleeSets.every(s => s.has(c)),
          ).sort();

          // Compute min/max similarity across all pairs in this cluster
          let minSim = 1;
          let maxSim = 0;
          for (let i = 0; i < memberIds.length; i++) {
            for (let j = i + 1; j < memberIds.length; j++) {
              const key = [memberIds[i], memberIds[j]].sort().join('|||');
              const sim = pairSimilarity.get(key) ?? jaccard(calleeNames.get(memberIds[i])!, calleeNames.get(memberIds[j])!);
              if (sim < minSim) minSim = sim;
              if (sim > maxSim) maxSim = sim;
            }
          }

          // Derive a suggestion
          const uniqueFiles = new Set(members.map(m => m.filePath)).size;
          const suggestion = uniqueFiles > 1
            ? `These ${members.length} functions across ${uniqueFiles} files share the same core logic. Consider extracting a shared utility that accepts parameters for any behavioural differences.`
            : `These ${members.length} functions in the same file appear to duplicate logic. Consider merging them or extracting a private helper.`;

          duplicateClusters.push({
            clusterIndex: clusterIndex++,
            size: members.length,
            members,
            sharedCallees,
            minSimilarity: Math.round(minSim * 100) / 100,
            maxSimilarity: Math.round(maxSim * 100) / 100,
            suggestion,
          });
        }

        // Sort by cluster size descending (largest duplication opportunity first)
        duplicateClusters.sort((a, b) => b.size - a.size || b.sharedCallees.length - a.sharedCallees.length);

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              duplicateClusters,
              totalClusters: duplicateClusters.length,
              totalFunctionsInvolved: duplicateClusters.reduce((s, c) => s + c.size, 0),
              parameters: { similarityThreshold, minCallees, envOverrides: { FLOWMAP_DUP_THRESHOLD: process.env.FLOWMAP_DUP_THRESHOLD ?? null, FLOWMAP_DUP_MIN_CALLEES: process.env.FLOWMAP_DUP_MIN_CALLEES ?? null } },
              durationMs: graph.durationMs,
              scannedFiles: graph.scannedFiles,
              note: duplicateClusters.length === 0
                ? 'No functionally duplicate functions detected at the current threshold. Try lowering similarityThreshold or minCallees.'
                : `${duplicateClusters.length} duplicate cluster(s) found. Each cluster is a group of functions that call the same logical dependencies and are candidates for generalisation.`,
            }),
          }],
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              error: true,
              code: 'PARSE_ERROR',
              message,
              workspacePath,
            }),
          }],
        };
      }
    },
  );
}
