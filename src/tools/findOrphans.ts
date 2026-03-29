import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as fs from 'fs';
import { analyzeWorkspace } from '../utils/analysis';
import { registerTool } from '../utils/toolHelper';
import { ProgressTracker } from '../utils/progress';

export function registerFindOrphans(server: McpServer): void {
  registerTool(
    server,
    'flowmap_find_orphans',
    'Return all functions that are never called from any entry point — potential dead code. Use this during refactoring to identify code that can safely be removed.',
    {
      workspacePath: z.string().describe('Absolute path to the repository root'),
    },
    async ({ workspacePath }) => {
      const progress = new ProgressTracker('flowmap_find_orphans');
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
        progress.reportProgress('Identifying orphan functions');

        const orphans = graph.orphans.map(orphanId => {
          const node = graph.nodes.find(n => n.id === orphanId);
          return node
            ? {
                id: node.id,
                name: node.name,
                filePath: node.filePath,
                startLine: node.startLine,
                language: node.language,
                isExported: node.isExported,
              }
            : { id: orphanId, name: 'unknown', filePath: 'unknown', startLine: 0 };
        });

        progress.reportProgress('Analysis complete');
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              orphans,
              count: orphans.length,
              durationMs: graph.durationMs,
              note: 'Exported functions may be used by external consumers — verify before deleting.',
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
