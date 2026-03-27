# callgraph-mcp

**CallGraph MCP Server** — exposes deterministic call-graph analysis for any codebase as [Model Context Protocol](https://modelcontextprotocol.io/) tools. Give your AI agent a precise, structural map of your code — no hallucination, no guessing.

Fully local. No cloud. No LLM. No telemetry.

Powered by [`@codeflow-map/core`](https://www.npmjs.com/package/@codeflow-map/core) and Tree-sitter WASM parsers.

**Supports:** TypeScript · JavaScript · TSX · JSX · Python · Go

---

## Quick Start (VS Code Copilot)

Add this to `.vscode/mcp.json`:

```json
{
  "servers": {
    "flowmap": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "callgraph-mcp"]
    }
  }
}
```

VS Code starts and stops the server automatically.

---

## Setup

### Option 1 — VS Code Copilot via `npx` (no install required)

Add to your project's `.vscode/mcp.json`:

```json
{
  "servers": {
    "flowmap": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "callgraph-mcp"],
      "env": {
        "FLOWMAP_TRANSPORT": "stdio"
      }
    }
  }
}
```

VS Code starts and stops the server automatically. WASM grammars are bundled — no environment variables needed.

> **Tip:** Create `.vscode/mcp.json` via the Command Palette → **MCP: Add Server** → **stdio**.

### Option 2 — Global install

```bash
npm install -g callgraph-mcp
```

```json
{
  "servers": {
    "flowmap": {
      "type": "stdio",
      "command": "callgraph-mcp",
      "env": {
        "FLOWMAP_TRANSPORT": "stdio"
      }
    }
  }
}
```

### Option 3 — Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "flowmap": {
      "command": "npx",
      "args": ["-y", "callgraph-mcp"],
      "env": {
        "FLOWMAP_TRANSPORT": "stdio"
      }
    }
  }
}
```

### Option 4 — Cursor

Add to your project's `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "flowmap": {
      "command": "npx",
      "args": ["-y", "callgraph-mcp"],
      "env": {
        "FLOWMAP_TRANSPORT": "stdio"
      }
    }
  }
}
```

### Option 5 — Cline

Add to your Cline MCP settings (commonly `cline_mcp_settings.json`):

```json
{
  "mcpServers": {
    "flowmap": {
      "command": "npx",
      "args": ["-y", "callgraph-mcp"],
      "env": {
        "FLOWMAP_TRANSPORT": "stdio"
      }
    }
  }
}
```

### Option 6 — HTTP-SSE (shared or remote server)

Use `FLOWMAP_TRANSPORT=http` for HTTP-SSE compatible clients.

Start the server:

```bash
FLOWMAP_TRANSPORT=http FLOWMAP_PORT=3100 npx callgraph-mcp
# Windows PowerShell:
# $env:FLOWMAP_TRANSPORT="http"; $env:FLOWMAP_PORT="3100"; npx callgraph-mcp
```

Then point your client at it:

```json
{
  "servers": {
    "flowmap": {
      "type": "http",
      "url": "http://localhost:3100/mcp"
    }
  }
}
```

---

## Configure Environment Variables

Use one of the following approaches depending on your client.

### In VS Code `.vscode/mcp.json`

```json
{
  "servers": {
    "flowmap": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "callgraph-mcp"],
      "env": {
        "FLOWMAP_TRANSPORT": "http",
        "FLOWMAP_PORT": "3100",
        "FLOWMAP_GRAMMARS": "/absolute/path/to/grammars"
      }
    }
  }
}
```

### In Claude Desktop config

```json
{
  "mcpServers": {
    "flowmap": {
      "command": "npx",
      "args": ["-y", "callgraph-mcp"],
      "env": {
        "FLOWMAP_TRANSPORT": "stdio",
        "FLOWMAP_GRAMMARS": "/absolute/path/to/grammars"
      }
    }
  }
}
```

### In Cursor `.cursor/mcp.json`

```json
{
  "mcpServers": {
    "flowmap": {
      "command": "npx",
      "args": ["-y", "callgraph-mcp"],
      "env": {
        "FLOWMAP_TRANSPORT": "stdio",
        "FLOWMAP_GRAMMARS": "/absolute/path/to/grammars"
      }
    }
  }
}
```

### In Cline MCP settings

```json
{
  "mcpServers": {
    "flowmap": {
      "command": "npx",
      "args": ["-y", "callgraph-mcp"],
      "env": {
        "FLOWMAP_TRANSPORT": "stdio",
        "FLOWMAP_GRAMMARS": "/absolute/path/to/grammars"
      }
    }
  }
}
```

### In your shell for one-off runs

macOS / Linux:

```bash
FLOWMAP_TRANSPORT=http FLOWMAP_PORT=3100 npx callgraph-mcp
```

Windows PowerShell:

```powershell
$env:FLOWMAP_TRANSPORT="http"
$env:FLOWMAP_PORT="3100"
npx callgraph-mcp
```

---

## Tools Reference

| Tool | Required params | Optional | What it returns |
|------|----------------|----------|-----------------|
| `flowmap_analyze_workspace` | `workspacePath` | `exclude`, `language` | Full call graph: all nodes, edges, flows, orphans |
| `flowmap_analyze_file` | `filePath` | — | Functions and call sites in a single file |
| `flowmap_get_callers` | `functionName`, `workspacePath` | — | Every function across the workspace that directly calls the named function |
| `flowmap_get_callees` | `functionName`, `workspacePath` | — | Every function the named function directly calls |
| `flowmap_get_flow` | `functionName`, `workspacePath` | `maxDepth` (default 10) | Full BFS subgraph reachable from a function — the complete execution path |
| `flowmap_list_entry_points` | `workspacePath` | — | All entry points: mains, route handlers, CLI commands, React roots |
| `flowmap_find_orphans` | `workspacePath` | — | Functions unreachable from any entry point — potential dead code |

**`workspacePath`** is the absolute path to the repository root (e.g. `/home/user/my-project` or `C:\projects\my-app`).

---

## Environment Variable Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `FLOWMAP_TRANSPORT` | `stdio` | Transport mode: `stdio` or `http` (`http` is used for HTTP-SSE clients) |
| `FLOWMAP_PORT` | `3100` | HTTP server port (only used for `http` transport) |
| `FLOWMAP_GRAMMARS` | *(bundled)* | Override path to Tree-sitter WASM grammar files |

---

## Example Use Cases

### Explore an unfamiliar codebase

> *"I just cloned this repo. Walk me through where execution starts and what the main flows are."*

The agent calls `flowmap_list_entry_points` to find where code begins, then `flowmap_get_flow` on each entry point to trace the full execution paths. It can describe the architecture without reading every file.

---

### Understand the impact of a change before making it

> *"I need to change the signature of `processPayment`. What will break?"*

The agent calls `flowmap_get_callers("processPayment", workspacePath)` to get every call site across the entire codebase — with file paths and line numbers — so it knows exactly what needs updating before touching anything.

---

### Safe refactoring — find what to clean up

> *"We're doing a big cleanup. What functions are safe to delete?"*

The agent calls `flowmap_find_orphans(workspacePath)`. Functions with zero reachability from entry points and not exported are strong deletion candidates. Combined with `flowmap_get_callers` for verification, this gives a confident dead-code list.

---

### Trace a bug through the call chain

> *"The `submitOrder` function is failing. What does it call, and what does each of those call?"*

The agent calls `flowmap_get_flow("submitOrder", workspacePath, maxDepth: 5)` to get the full downstream call tree — showing exactly which functions are in the execution path and which files they live in.

---

### PR review — understand what changed

> *"This PR modifies `validateUser`. What's the blast radius?"*

The agent calls `flowmap_get_callers("validateUser", workspacePath)` to enumerate every caller, then `flowmap_get_flow("validateUser", workspacePath)` to show all downstream dependency. It can summarise the risk surface of the change deterministically.

---

### Understand a single file before editing it

> *"What does `src/auth/middleware.ts` export and what does it call?"*

The agent calls `flowmap_analyze_file("/abs/path/to/src/auth/middleware.ts")` to get a precise list of every function, its parameters, return type, and all outgoing calls — without needing to read the file itself.

---

### Agentic code generation with structural guardrails

When an agent is generating new code, it can call `flowmap_analyze_workspace` before and after to verify:
- New functions are connected to the call graph (not accidentally orphaned)
- No existing entry points were broken
- The intended call relationships were actually created

---

## Example Prompts for VS Code Copilot

```
List all entry points in this workspace
```
```
What functions call `buildCallGraph` anywhere in the codebase?
```
```
Show me the full execution path starting from `startServer`, up to 6 levels deep
```
```
Find all dead code — functions that are never reached from any entry point
```
```
What does `parseFile` directly depend on?
```
```
I'm changing `connectDb`. Who calls it? Give me file paths and line numbers.
```
```
Analyze just src/api/routes.ts and tell me what it exports and what it calls
```

---

## How It Works

1. Tree-sitter WASM grammars parse each source file into an AST — no runtime execution, no imports
2. Functions and call sites are extracted from the AST
3. A call graph is built by resolving call site names to function definitions (by name, suffix, and file)
4. Entry points are detected: functions that are never called but call others
5. The graph is partitioned into independent execution flows via BFS from each entry point

Files are parsed in parallel batches of 50. Results are cached for 30 seconds — repeated calls within a session are instant.

---

## Links

- [VS Code Extension (CallSight)](https://marketplace.visualstudio.com/items?itemName=devricky-codes.callsight)
- [Core Package (@codeflow-map/core)](https://www.npmjs.com/package/@codeflow-map/core)
- [Source Code](https://github.com/devricky-codes/callsight-vscode)
- [Report Issues](https://github.com/devricky-codes/callsight-vscode/issues)

## License

MIT
