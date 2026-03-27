#!/usr/bin/env node
import { startServer } from './server';

startServer().catch((err) => {
  process.stderr.write(`FlowMap MCP server failed to start: ${err}\n`);
  process.exit(1);
});
