import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as fs from 'fs';
import { analyzeWorkspace } from '../utils/analysis';
import { registerTool } from '../utils/toolHelper';
import { ProgressTracker } from '../utils/progress';

export function registerGetCallees(server: McpServer): void {
  registerTool(
    server,
    'flowmap_get_callees',
    'Return all functions directly called by the named function. Use this to understand what a function depends on.',
    {
      functionName: z.string().describe('The function name to find callees of'),
      workspacePath: z.string().describe('Absolute path to the repository root'),
    },
    async ({ functionName, workspacePath }) => {
      const progress = new ProgressTracker('flowmap_get_callees');
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
        progress.reportProgress('Searching for target function');

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
        const targetIds = new Set(targets.map(t => t.id));

        progress.reportProgress('Filtering callees');
        // Find edges where from is one of the target IDs
        const calleeEdges = graph.edges.filter(e => targetIds.has(e.from));
        const callees = calleeEdges.map(edge => {
          const calleeNode = graph.nodes.find(n => n.id === edge.to);
          return {
            id: edge.to,
            name: calleeNode?.name ?? 'unknown',
            filePath: calleeNode?.filePath ?? 'unknown',
            startLine: calleeNode?.startLine ?? 0,
            callLine: edge.line,
          };
        });

        progress.reportProgress('Analysis complete');
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              target: functionName,
              targetId: target.id,
              callees,
              count: callees.length,
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
