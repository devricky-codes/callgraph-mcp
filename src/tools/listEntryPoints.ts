import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as fs from 'fs';
import { analyzeWorkspace } from '../utils/analysis';
import { registerTool } from '../utils/toolHelper';

export function registerListEntryPoints(server: McpServer): void {
  registerTool(
    server,
    'flowmap_list_entry_points',
    'Return all detected entry points in the codebase — main functions, HTTP route handlers, React root renders, CLI commands, etc. Always call this first when exploring a new codebase to understand where execution begins.',
    {
      workspacePath: z.string().describe('Absolute path to the repository root'),
    },
    async ({ workspacePath }) => {
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

        const graph = await analyzeWorkspace(workspacePath);
        const entryNodes = graph.nodes.filter(n => n.isEntryPoint);

        const entryPoints = entryNodes.map(n => ({
          id: n.id,
          name: n.name,
          filePath: n.filePath,
          startLine: n.startLine,
          language: n.language,
          isExported: n.isExported,
          isAsync: n.isAsync,
        }));

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              entryPoints,
              count: entryPoints.length,
              durationMs: graph.durationMs,
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
