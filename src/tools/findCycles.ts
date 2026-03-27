import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as fs from 'fs';
import { CallEdge, FunctionNode } from '@codeflow-map/core';
import { analyzeWorkspace } from '../utils/analysis';
import { registerTool } from '../utils/toolHelper';

/** Tarjan's SCC — returns groups of node IDs that form cycles. */
function findStronglyConnectedComponents(
  nodeIds: string[],
  edges: CallEdge[],
): string[][] {
  const index: Map<string, number> = new Map();
  const lowlink: Map<string, number> = new Map();
  const onStack: Map<string, boolean> = new Map();
  const stack: string[] = [];
  const sccs: string[][] = [];
  let counter = 0;

  // Build adjacency list
  const adj: Map<string, string[]> = new Map();
  for (const id of nodeIds) adj.set(id, []);
  for (const e of edges) {
    if (adj.has(e.from) && adj.has(e.to)) {
      adj.get(e.from)!.push(e.to);
    }
  }

  function strongConnect(v: string): void {
    index.set(v, counter);
    lowlink.set(v, counter);
    counter++;
    stack.push(v);
    onStack.set(v, true);

    for (const w of (adj.get(v) ?? [])) {
      if (!index.has(w)) {
        strongConnect(w);
        lowlink.set(v, Math.min(lowlink.get(v)!, lowlink.get(w)!));
      } else if (onStack.get(w)) {
        lowlink.set(v, Math.min(lowlink.get(v)!, index.get(w)!));
      }
    }

    if (lowlink.get(v) === index.get(v)) {
      const scc: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.set(w, false);
        scc.push(w);
      } while (w !== v);
      sccs.push(scc);
    }
  }

  for (const id of nodeIds) {
    if (!index.has(id)) strongConnect(id);
  }

  return sccs;
}

function describeCycleEdges(cycle: string[], edges: CallEdge[]): Array<{ from: string; to: string; line: number }> {
  const memberSet = new Set(cycle);
  return edges
    .filter(e => memberSet.has(e.from) && memberSet.has(e.to))
    .map(e => ({ from: e.from, to: e.to, line: e.line }));
}

export function registerFindCycles(server: McpServer): void {
  registerTool(
    server,
    'flowmap_find_cycles',
    'Detect all call cycles (circular dependencies / mutual recursion) in the codebase. Returns each cycle as an ordered list of functions that call each other in a loop, along with the exact call edges forming the cycle. Use this to identify architectural problems, infinite-recursion risks, or tightly coupled modules.',
    {
      workspacePath: z.string().describe('Absolute path to the repository root'),
      minCycleLength: z.number().int().min(1).optional().describe('Minimum number of functions in a cycle to report (default: 1, includes self-recursion)'),
      exclude: z.string().optional().describe('Comma-separated glob patterns to exclude. Defaults: node_modules,dist,.git,__pycache__,*.test.*,*.spec.*'),
    },
    async ({ workspacePath, minCycleLength = 1, exclude }) => {
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

        const nodeIds = graph.nodes.map(n => n.id);
        const sccs = findStronglyConnectedComponents(nodeIds, graph.edges);

        // A self-loop counts as a cycle of length 1
        const selfLoopIds = new Set(
          graph.edges.filter(e => e.from === e.to).map(e => e.from),
        );

        const cyclesRaw = sccs.filter(scc => {
          if (scc.length > 1) return scc.length >= minCycleLength;
          // single-node SCC — only a cycle if there's a self-edge
          return minCycleLength <= 1 && selfLoopIds.has(scc[0]);
        });

        const nodeById = new Map<string, FunctionNode>(graph.nodes.map(n => [n.id, n]));

        const cycles = cyclesRaw.map((scc, i) => {
          const members = scc.map(id => {
            const n = nodeById.get(id);
            return n
              ? { id, name: n.name, filePath: n.filePath, startLine: n.startLine, language: n.language }
              : { id, name: 'unknown', filePath: 'unknown', startLine: 0, language: 'unknown' };
          });

          const cycleEdges = describeCycleEdges(scc, graph.edges);

          return {
            cycleIndex: i + 1,
            length: scc.length,
            members,
            edges: cycleEdges,
          };
        });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              cycles,
              totalCycles: cycles.length,
              durationMs: graph.durationMs,
              scannedFiles: graph.scannedFiles,
              note: cycles.length === 0
                ? 'No cycles detected — the call graph is acyclic.'
                : `${cycles.length} cycle(s) found. Cycles involving many functions or cross-module calls are the highest priority to review.`,
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
