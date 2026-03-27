import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as fs from 'fs';
import { analyzeWorkspace } from '../utils/analysis';
import { registerTool } from '../utils/toolHelper';
import { SupportedLanguage } from '@codeflow-map/core';

const SUPPORTED_LANGUAGES = ['typescript', 'javascript', 'python', 'java', 'go', 'rust', 'tsx', 'jsx'];
const DEFAULT_EXCLUDES = ['node_modules', 'dist', '.git', '__pycache__', '*.test.*', '*.spec.*'];

export function registerAnalyzeWorkspace(server: McpServer): void {
  registerTool(
    server,
    'flowmap_analyze_workspace',
    'Scan an entire codebase and return a full call graph — all functions, their parameters, and all call relationships between them. Use this first when exploring an unfamiliar codebase.',
    {
      workspacePath: z.string().describe('Absolute path to the repository root'),
      exclude: z.string().optional().describe('Comma-separated glob patterns to exclude. Defaults: node_modules,dist,.git,__pycache__,*.test.*,*.spec.*'),
      language: z.string().optional().describe('Filter to a single language: typescript, javascript, python, java, go, rust, tsx, jsx. Omit to scan all.'),
    },
    async ({ workspacePath, exclude, language }) => {
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

        const excludeList = exclude
          ? exclude.split(',').map(s => s.trim()).filter(Boolean)
          : DEFAULT_EXCLUDES;

        const lang = language && SUPPORTED_LANGUAGES.includes(language)
          ? language as SupportedLanguage
          : undefined;

        const graph = await analyzeWorkspace(workspacePath, {
          exclude: excludeList,
          language: lang,
        });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(graph),
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
