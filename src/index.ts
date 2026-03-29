import { startServer } from './server';
import { logError } from './utils/logger';

startServer().catch((err) => {
  logError(`FlowMap MCP server failed to start: ${err}`);
  process.exit(1);
});
