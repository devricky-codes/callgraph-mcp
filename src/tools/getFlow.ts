import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as fs from 'fs';
import { FunctionNode, CallEdge } from '@codeflow-map/core';
import { analyzeWorkspace } from '../utils/analysis';
import { registerTool } from '../utils/toolHelper';
import { ProgressTracker } from '../utils/progress';

export function registerGetFlow(server: McpServer): void {
  registerTool(
    server,
    'flowmap_get_flow',
    'Return the complete sub-graph reachable from a given function — every function it calls, every function those call, and so on recursively. Use this to understand the full execution path of a feature or entry point.',
    {
      functionName: z.string().describe('The starting function name'),
      workspacePath: z.string().describe('Absolute path to the repository root'),
      maxDepth: z.number().optional().describe('Maximum recursion depth. Default 10.'),
    },
    async ({ functionName, workspacePath, maxDepth: rawMaxDepth }) => {
      const progress = new ProgressTracker('flowmap_get_flow');
      const maxDepth = rawMaxDepth ?? 10;
      try {
        progress.reportProgress('Validating workspace path');
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

        progress.reportProgress('Building call graph');
        const graph = await analyzeWorkspace(workspacePath);
        progress.reportProgress('Locating start function');

        const targets = graph.nodes.filter(n => n.name === functionName);
        if (targets.length === 0) {
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                error: true,
                code: 'FUNCTION_NOT_FOUND',
                message: `No function named "${functionName}" found in the codebase.`,
                workspacePath,
              }),
            }],
          };
        }

        const target = targets[0];

        progress.reportProgress('Tracing call flow');
        // Build adjacency map for BFS
        const outgoing = new Map<string, { edge: CallEdge; node: FunctionNode }[]>();
        for (const edge of graph.edges) {
          const list = outgoing.get(edge.from) || [];
          const toNode = graph.nodes.find(n => n.id === edge.to);
          if (toNode) {
            list.push({ edge, node: toNode });
            outgoing.set(edge.from, list);
          }
        }

        // BFS from target, depth-limited
        const visitedIds = new Set<string>();
        const reachableNodes: FunctionNode[] = [];
        const reachableEdges: CallEdge[] = [];
        let currentDepth = 0;

        let frontier = [target.id];
        visitedIds.add(target.id);
        reachableNodes.push(target);

        while (frontier.length > 0 && currentDepth < maxDepth) {
          const nextFrontier: string[] = [];
          for (const nodeId of frontier) {
            const neighbours = outgoing.get(nodeId) || [];
            for (const { edge, node } of neighbours) {
              reachableEdges.push(edge);
              if (!visitedIds.has(node.id)) {
                visitedIds.add(node.id);
                reachableNodes.push(node);
                nextFrontier.push(node.id);
              }
            }
          }
          frontier = nextFrontier;
          currentDepth++;
        }

        progress.reportProgress('Analysis complete');
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              entryFunction: functionName,
              nodes: reachableNodes,
              edges: reachableEdges,
              depth: currentDepth,
              totalFunctions: reachableNodes.length,
              progress: {
                steps: progress.getProgress(),
                summary: progress.getSummary(),
              },
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
