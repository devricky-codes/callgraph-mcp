# FlowMap MCP Server — Usage Instructions

FlowMap MCP server exposes static call-graph analysis for any codebase through the [Model Context Protocol](https://modelcontextprotocol.io/). It wraps `@codeflow-map/core` and supports **TypeScript, JavaScript, TSX, JSX, Python, and Go** out of the box.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Windows Launcher (flowmap-mcp.bat)](#windows-launcher-flowmap-mpcbat)
- [Environment Variables](#environment-variables)
- [Transport Modes](#transport-modes)
  - [stdio (default)](#stdio-default)
  - [HTTP / SSE](#http--sse)
- [VS Code Copilot Integration](#vs-code-copilot-integration)
  - [stdio (recommended)](#vs-code-copilot--stdio-recommended)
  - [HTTP / SSE](#vs-code-copilot--http--sse)
- [Tools Reference](#tools-reference)
- [Usage Examples](#usage-examples)
  - [stdio Examples](#stdio-examples)
  - [HTTP / SSE Examples](#http--sse-examples)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

- **Node.js** >= 18
- **Tree-sitter WASM grammars** — the `grammars/` folder at the monorepo root (or wherever you point `FLOWMAP_GRAMMARS`)
- The package built: `pnpm run build` from the monorepo root, or `npx tsc` inside `packages/mcp-server/`

---

## Windows Launcher (flowmap-mcp.bat)

`flowmap-mcp.bat` lives at the monorepo root and is the recommended way to start the server on Windows. It:

- **Resolves all paths automatically** — no need to set `FLOWMAP_GRAMMARS` manually
- **Writes timestamped logs** to `logs\flowmap-mcp-<timestamp>.log` (stderr + startup metadata)
- **Validates the environment** before starting — checks Node.js is available and the server is built
- **Works in any project** — point any project's `.vscode/mcp.json` at the absolute path to this file

### Syntax

```bat
:: stdio mode (default — used by VS Code Copilot)
flowmap-mcp.bat

:: HTTP / SSE mode on default port 3100
flowmap-mcp.bat --http

:: HTTP mode on a custom port
flowmap-mcp.bat --http --port 8080
```

### Use in any project

#### Option A — VS Code "Add MCP Server" dialog

Open the Command Palette → **MCP: Add Server**, choose **stdio**, and when asked for a command enter:

```
cmd /c "F:\Projects\FlowMapVSCode\flowmap-mcp-stdio.bat"
```

VS Code will write the entry to the project's `.vscode/mcp.json` automatically.

#### Option B — Edit `.vscode/mcp.json` manually

Add this to any project's `.vscode/mcp.json` — no environment variables needed:

```json
{
  "servers": {
    "flowmap": {
      "type": "stdio",
      "command": "cmd",
      "args": ["/c", "F:\\Projects\\FlowMapVSCode\\flowmap-mcp-stdio.bat"]
    }
  }
}
```

VS Code Copilot will start and stop the server automatically whenever you open that workspace.

### Log files

Each run creates a new log file under the monorepo `logs\` directory:

```
logs\flowmap-mcp-20260320_103833.log
```

Log content example:

```
[20260320_103833] FlowMap MCP server starting
[20260320_103833] Transport : stdio
[20260320_103833] Grammars  : F:\Projects\FlowMapVSCode\grammars
[20260320_103833] Server    : F:\Projects\FlowMapVSCode\packages\mcp-server\dist\index.js
```

Server stderr output (WASM init messages, errors) is appended to the same log file.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `FLOWMAP_GRAMMARS` | *(auto-resolved relative to dist/)* | Absolute path to the directory containing tree-sitter `.wasm` grammar files. **Required** in most setups. |
| `FLOWMAP_TRANSPORT` | `stdio` | Transport mode. Values: `stdio`, `http`, `sse` (`http` and `sse` both start the HTTP server). |
| `FLOWMAP_PORT` | `3100` | Port for the HTTP server (only used when `FLOWMAP_TRANSPORT` is `http` or `sse`). |

---

## Transport Modes

### stdio (default)

The server reads JSON-RPC messages from **stdin** and writes responses to **stdout**. This is the standard mode for VS Code Copilot and most MCP clients.

```bash
# Start the server in stdio mode (default)
FLOWMAP_GRAMMARS=/path/to/grammars node packages/mcp-server/dist/index.js
```

On Windows (PowerShell):

```powershell
$env:FLOWMAP_GRAMMARS = "C:\path\to\grammars"
node packages/mcp-server/dist/index.js
```

The server will sit waiting for JSON-RPC input on stdin. MCP clients (VS Code Copilot, Claude Desktop, etc.) manage this automatically.

### HTTP / SSE

The server starts an HTTP server that accepts Streamable HTTP requests (the MCP HTTP+SSE transport). This mode is useful for remote clients, shared team servers, or non-stdio environments.

```bash
# Start the server in HTTP mode on port 3100
FLOWMAP_GRAMMARS=/path/to/grammars FLOWMAP_TRANSPORT=http node packages/mcp-server/dist/index.js
```

```bash
# Start on a custom port
FLOWMAP_GRAMMARS=/path/to/grammars FLOWMAP_TRANSPORT=http FLOWMAP_PORT=8080 node packages/mcp-server/dist/index.js
```

On Windows (PowerShell):

```powershell
$env:FLOWMAP_GRAMMARS = "C:\path\to\grammars"
$env:FLOWMAP_TRANSPORT = "http"
$env:FLOWMAP_PORT = "8080"
node packages/mcp-server/dist/index.js
# Output: FlowMap MCP server listening on http://localhost:8080/mcp
```

The HTTP endpoint is available at:

```
POST http://localhost:<port>/mcp
```

---

## VS Code Copilot Integration

### VS Code Copilot — stdio (recommended)

The `.vscode/mcp.json` already included in this repo uses `flowmap-mcp.bat` — no extra environment variables needed:

```json
{
  "servers": {
    "flowmap": {
      "type": "stdio",
      "command": "cmd",
      "args": ["/c", "${workspaceFolder}\\flowmap-mcp.bat"]
    }
  }
}
```

After saving, reload VS Code. The FlowMap tools will appear in Copilot's tool list. Copilot manages the server lifecycle automatically — no manual start required.

**Using from another project?** Use the absolute path to the bat file instead of `${workspaceFolder}`:

```json
{
  "servers": {
    "flowmap": {
      "type": "stdio",
      "command": "cmd",
      "args": ["/c", "F:\\Projects\\FlowMapVSCode\\flowmap-mcp.bat"]
    }
  }
}
```

### VS Code Copilot — HTTP / SSE

1. Start the server externally:

```bash
FLOWMAP_GRAMMARS=/path/to/grammars FLOWMAP_TRANSPORT=http FLOWMAP_PORT=3100 node packages/mcp-server/dist/index.js
```

2. Add the following to `.vscode/mcp.json`:

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

This mode is useful when:
- The server runs on a remote machine or container
- Multiple developers share one analysis server
- You want the server to persist across VS Code restarts

---

## Tools Reference

### `flowmap_analyze_workspace`

Scan an entire codebase and return a full call graph.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `workspacePath` | string | **yes** | Absolute path to the repository root |
| `exclude` | string | no | Comma-separated glob patterns to exclude (default: `node_modules,dist,.git,__pycache__,*.test.*,*.spec.*`) |
| `language` | string | no | Filter to one language: `typescript`, `javascript`, `python`, `go`, `tsx`, `jsx` |

**Returns:** Full graph with `nodes`, `edges`, `flows`, `orphans`, `scannedFiles`, `durationMs`.

---

### `flowmap_analyze_file`

Scan a single file and return its functions and calls.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `filePath` | string | **yes** | Absolute path to the file |

**Returns:** `{ filePath, functions[], calls[], durationMs }`.

---

### `flowmap_get_callers`

Find all functions that call the named function (impact analysis).

| Parameter | Type | Required | Description |
|---|---|---|---|
| `functionName` | string | **yes** | Target function name |
| `workspacePath` | string | **yes** | Absolute path to the repository root |

**Returns:** `{ target, callers[{ id, name, filePath, startLine, callLine }], count }`.

---

### `flowmap_get_callees`

Find all functions called by the named function (dependency analysis).

| Parameter | Type | Required | Description |
|---|---|---|---|
| `functionName` | string | **yes** | Target function name |
| `workspacePath` | string | **yes** | Absolute path to the repository root |

**Returns:** `{ target, callees[{ id, name, filePath, startLine, callLine }], count }`.

---

### `flowmap_get_flow`

Trace the full execution path from a function (BFS subgraph).

| Parameter | Type | Required | Description |
|---|---|---|---|
| `functionName` | string | **yes** | Starting function name |
| `workspacePath` | string | **yes** | Absolute path to the repository root |
| `maxDepth` | number | no | Maximum recursion depth (default: `10`) |

**Returns:** `{ entryFunction, nodes[], edges[], depth, totalFunctions }`.

---

### `flowmap_list_entry_points`

Detect all entry points in the codebase (main functions, route handlers, CLI commands, etc.).

| Parameter | Type | Required | Description |
|---|---|---|---|
| `workspacePath` | string | **yes** | Absolute path to the repository root |

**Returns:** `{ entryPoints[{ id, name, filePath, startLine, language }], count, durationMs }`.

---

### `flowmap_find_orphans`

Find all functions unreachable from any entry point (potential dead code).

| Parameter | Type | Required | Description |
|---|---|---|---|
| `workspacePath` | string | **yes** | Absolute path to the repository root |

**Returns:** `{ orphans[{ id, name, filePath, startLine, language }], count, durationMs }`.

---

## Usage Examples

### stdio Examples

These examples pipe JSON-RPC messages to the server via stdin. This is how MCP clients communicate in stdio mode.

#### List all available tools

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' \
  | FLOWMAP_GRAMMARS=/path/to/grammars node packages/mcp-server/dist/index.js
```

#### Analyze an entire workspace

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"flowmap_analyze_workspace","arguments":{"workspacePath":"/home/user/my-project"}}}' \
  | FLOWMAP_GRAMMARS=/path/to/grammars node packages/mcp-server/dist/index.js
```

#### Analyze a single file

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"flowmap_analyze_file","arguments":{"filePath":"/home/user/my-project/src/index.ts"}}}' \
  | FLOWMAP_GRAMMARS=/path/to/grammars node packages/mcp-server/dist/index.js
```

#### Find who calls a function

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"flowmap_get_callers","arguments":{"functionName":"buildCallGraph","workspacePath":"/home/user/my-project"}}}' \
  | FLOWMAP_GRAMMARS=/path/to/grammars node packages/mcp-server/dist/index.js
```

#### Trace execution flow from a function

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"flowmap_get_flow","arguments":{"functionName":"startServer","workspacePath":"/home/user/my-project","maxDepth":5}}}' \
  | FLOWMAP_GRAMMARS=/path/to/grammars node packages/mcp-server/dist/index.js
```

#### List entry points

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"flowmap_list_entry_points","arguments":{"workspacePath":"/home/user/my-project"}}}' \
  | FLOWMAP_GRAMMARS=/path/to/grammars node packages/mcp-server/dist/index.js
```

#### Find dead code

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"flowmap_find_orphans","arguments":{"workspacePath":"/home/user/my-project"}}}' \
  | FLOWMAP_GRAMMARS=/path/to/grammars node packages/mcp-server/dist/index.js
```

#### PowerShell (Windows) — Analyze workspace

```powershell
$env:FLOWMAP_GRAMMARS = "C:\projects\grammars"
$init = '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
$call = '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"flowmap_analyze_workspace","arguments":{"workspacePath":"C:\\projects\\my-app"}}}'
($init + "`n" + $call) | node packages/mcp-server/dist/index.js
```

---

### HTTP / SSE Examples

#### 1. Start the server

```bash
FLOWMAP_GRAMMARS=/path/to/grammars FLOWMAP_TRANSPORT=http FLOWMAP_PORT=3100 \
  node packages/mcp-server/dist/index.js
# Output: FlowMap MCP server listening on http://localhost:3100/mcp
```

#### 2. Initialize a session

```bash
curl -X POST http://localhost:3100/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"curl-test","version":"1.0"}}}'
```

The response includes a `Mcp-Session-Id` header. Use it in subsequent requests:

```
Mcp-Session-Id: <session-id>
```

#### 3. List available tools

```bash
curl -X POST http://localhost:3100/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: <session-id>" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
```

#### 4. Analyze an entire workspace

```bash
curl -X POST http://localhost:3100/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: <session-id>" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "flowmap_analyze_workspace",
      "arguments": {
        "workspacePath": "/home/user/my-project",
        "language": "typescript"
      }
    }
  }'
```

#### 5. Analyze a single file

```bash
curl -X POST http://localhost:3100/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: <session-id>" \
  -d '{
    "jsonrpc": "2.0",
    "id": 4,
    "method": "tools/call",
    "params": {
      "name": "flowmap_analyze_file",
      "arguments": {
        "filePath": "/home/user/my-project/src/server.ts"
      }
    }
  }'
```

#### 6. Find callers of a function

```bash
curl -X POST http://localhost:3100/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: <session-id>" \
  -d '{
    "jsonrpc": "2.0",
    "id": 5,
    "method": "tools/call",
    "params": {
      "name": "flowmap_get_callers",
      "arguments": {
        "functionName": "handleRequest",
        "workspacePath": "/home/user/my-project"
      }
    }
  }'
```

#### 7. Find callees of a function

```bash
curl -X POST http://localhost:3100/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: <session-id>" \
  -d '{
    "jsonrpc": "2.0",
    "id": 6,
    "method": "tools/call",
    "params": {
      "name": "flowmap_get_callees",
      "arguments": {
        "functionName": "handleRequest",
        "workspacePath": "/home/user/my-project"
      }
    }
  }'
```

#### 8. Trace execution flow

```bash
curl -X POST http://localhost:3100/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: <session-id>" \
  -d '{
    "jsonrpc": "2.0",
    "id": 7,
    "method": "tools/call",
    "params": {
      "name": "flowmap_get_flow",
      "arguments": {
        "functionName": "main",
        "workspacePath": "/home/user/my-project",
        "maxDepth": 5
      }
    }
  }'
```

#### 9. List entry points

```bash
curl -X POST http://localhost:3100/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: <session-id>" \
  -d '{
    "jsonrpc": "2.0",
    "id": 8,
    "method": "tools/call",
    "params": {
      "name": "flowmap_list_entry_points",
      "arguments": {
        "workspacePath": "/home/user/my-project"
      }
    }
  }'
```

#### 10. Find orphaned / dead code

```bash
curl -X POST http://localhost:3100/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: <session-id>" \
  -d '{
    "jsonrpc": "2.0",
    "id": 9,
    "method": "tools/call",
    "params": {
      "name": "flowmap_find_orphans",
      "arguments": {
        "workspacePath": "/home/user/my-project"
      }
    }
  }'
```

---

## Troubleshooting

| Problem | Solution |
|---|---|
| `WASM module not found` | Set `FLOWMAP_GRAMMARS` to the absolute path of your `grammars/` directory containing the `.wasm` files. |
| Server exits immediately (stdio) | Ensure the MCP client is sending a valid `initialize` request first. The server expects JSON-RPC on stdin. |
| `EADDRINUSE` on HTTP mode | Another process is using the port. Change it with `FLOWMAP_PORT=<other-port>`. |
| Build OOM errors | Set `NODE_OPTIONS="--max-old-space-size=4096"` before running `npx tsc`. |
| Unsupported language | Only `.ts`, `.js`, `.tsx`, `.jsx`, `.py`, and `.go` files are analysed. Java and Rust grammars are loaded but have no analyser yet. |
| Function not found | The `functionName` parameter matches by name only. If multiple functions share a name, the first match is used. Use the full name (e.g. `MyClass.method`) for methods. |
| Empty results for workspace | Check that `workspacePath` points to the directory containing source files, not a parent directory. Verify the exclude patterns aren't filtering everything. |
