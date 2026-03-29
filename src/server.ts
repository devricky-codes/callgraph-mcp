import { createServer as createHttpServer, IncomingMessage, ServerResponse } from 'http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { randomUUID } from 'crypto';
import { registerAnalyzeWorkspace } from './tools/analyzeWorkspace';
import { registerAnalyzeFile } from './tools/analyzeFile';
import { registerGetCallers } from './tools/getCallers';
import { registerGetCallees } from './tools/getCallees';
import { registerGetFlow } from './tools/getFlow';
import { registerListEntryPoints } from './tools/listEntryPoints';
import { registerFindOrphans } from './tools/findOrphans';
import { registerFindCycles } from './tools/findCycles';
import { registerFindDuplicates } from './tools/findDuplicates';
import { logVerbose } from './utils/logger';

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'callgraph-mcp',
    version: '1.0.0',
  });

  registerTools(server);
  return server;
}

function registerTools(server: McpServer): void {
  registerAnalyzeWorkspace(server);
  registerAnalyzeFile(server);
  registerGetCallers(server);
  registerGetCallees(server);
  registerGetFlow(server);
  registerListEntryPoints(server);
  registerFindOrphans(server);
  registerFindCycles(server);
  registerFindDuplicates(server);
}

export async function startServer(): Promise<void> {
  const mode = (process.env.FLOWMAP_TRANSPORT || 'stdio').toLowerCase();

  if (mode === 'http' || mode === 'sse') {
    await startHttpServer();
  } else {
    await startStdioServer();
  }
}

async function startStdioServer(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

async function startHttpServer(): Promise<void> {
  const port = parseInt(process.env.FLOWMAP_PORT || '3100', 10);

  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });

  const httpServer = createHttpServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = req.url || '/';
    if (url === '/mcp' || url === '/') {
      await transport.handleRequest(req, res);
    } else {
      res.writeHead(404).end('Not Found');
    }
  });

  await server.connect(transport);

  httpServer.listen(port, () => {
    logVerbose(`FlowMap MCP server listening on http://localhost:${port}/mcp`);
  });
}
