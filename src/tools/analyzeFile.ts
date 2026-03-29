import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import { parseFile, initTreeSitter, FILE_EXTENSION_MAP, SupportedLanguage } from '@codeflow-map/core';
import { resolveWasmDir } from '../utils/analysis';
import { registerTool } from '../utils/toolHelper';
import { ProgressTracker } from '../utils/progress';

let treeSitterInitialized = false;

export function registerAnalyzeFile(server: McpServer): void {
  registerTool(
    server,
    'flowmap_analyze_file',
    'Scan a single file and return all functions defined in it, their parameters, and calls made within the file.',
    {
      filePath: z.string().describe('Absolute path to the file to analyse'),
    },
    async ({ filePath: absolutePath }) => {
      const progress = new ProgressTracker('flowmap_analyze_file');
      try {
        progress.reportProgress('Validating file path');
        if (!fs.existsSync(absolutePath)) {
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                error: true,
                code: 'FILE_NOT_FOUND',
                message: `File does not exist: ${absolutePath}`,
              }),
            }],
          };
        }

        const ext = path.extname(absolutePath);
        const languageId = FILE_EXTENSION_MAP[ext] as SupportedLanguage | undefined;
        if (!languageId) {
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                error: true,
                code: 'UNSUPPORTED_LANGUAGE',
                message: `Unsupported file extension: ${ext}`,
              }),
            }],
          };
        }

        const wasmDir = resolveWasmDir();
        if (!treeSitterInitialized) {
          progress.reportProgress('Initializing TreeSitter');
          await initTreeSitter(wasmDir);
          treeSitterInitialized = true;
        }

        const startTime = Date.now();
        const relativePath = path.basename(absolutePath);
        progress.reportProgress('Parsing file');
        const result = await parseFile(relativePath, absolutePath, wasmDir, languageId);
        progress.reportProgress('Analysis complete');

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              filePath: relativePath,
              functions: result.functions,
              calls: result.calls,
              durationMs: Date.now() - startTime,
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
            }),
          }],
        };
      }
    },
  );
}
