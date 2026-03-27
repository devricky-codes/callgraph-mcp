import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

/**
 * Registers a tool on the McpServer with explicit type handling to avoid
 * TS2589 "Type instantiation is excessively deep" errors that occur with
 * the MCP SDK 1.27.x + Zod 3.25.x combination.
 */
export function registerTool<T extends Record<string, z.ZodTypeAny>>(
  server: McpServer,
  name: string,
  description: string,
  schema: T,
  handler: (args: { [K in keyof T]: z.infer<T[K]> }) => Promise<CallToolResult>,
): void {
  (server as any).tool(name, description, schema, handler);
}
