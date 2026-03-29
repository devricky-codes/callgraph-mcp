# callgraph-mcp

**CallGraph MCP Server** — exposes deterministic call-graph analysis for any codebase as MCP tool. Give your AI agent a precise, structural map of your code — no hallucination, no guessing.

Fully local. No cloud. No LLM. No telemetry.

Powered by [`@codeflow-map/core`](https://www.npmjs.com/package/@codeflow-map/core) and Tree-sitter WASM parsers.

**Supports:** TypeScript · JavaScript · TSX · JSX · Python · Go

![Cyclic call graph demo](https://raw.githubusercontent.com/devricky-codes/callgraph-mcp/refs/heads/main/assets/cyclic.gif)

*Designed for zero false negatives (within static limits). It never misses anything it can see (high recall), even if that means over-reporting.*

> **Bundled grammars:** TypeScript, JavaScript, TSX, JSX, Python, and Go grammars are included. After install, they are available in `callgraph-mcp/grammars`.

---

## Why Deterministic Analysis Matters

Most AI coding tools answer structural questions about your codebase by reading source files as text and reasoning over them. This causes three compounding failure modes:

- **Hallucination.** When asked "what calls `processPayment`?", a model without structural grounding will guess based on naming patterns and training priors. It will confidently name callers that don't exist and miss ones that do.
- **Lost in the middle.** Research shows that LLMs systematically fail to recall information from the middle of long contexts. Paste a 200-file codebase into context and the model will answer based on whatever happened to land near the top or bottom.
- **Attention dilution.** Even when information is present, spreading the model's attention across tens of thousands of lines means each individual fact gets less weight. A critical edge in the call graph competed for attention with everything else.

**callgraph-mcp eliminates all three.** It never reads your code as prose. It parses every file into an AST using Tree-sitter, builds an exact directed call graph, and answers structural queries against that graph. Every caller, every callee, every reachable function, every cycle - returned as a precise index. The answer is always the same regardless of how large your codebase is, which files happen to be in context, or how deeply buried a function is. **There is no probability involved. There is no attention to dilute.**

![MCP Demo](https://raw.githubusercontent.com/devricky-codes/callsight-vscode/refs/heads/main/media/mcp-demo.png)
*The image shows how callgraph explains the POST method flow in python-fastAPI codebase. Irrespective of how large or small the codebase gets, it won't miss an edge.*

---

## Setup

### Option 1 — VS Code via `npx`

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

### Option 2 

```json
{
  "servers": {
    "flowmap": {
      "type": "stdio",
      "command": "callgraph-mcp",
      "args": [],
      "env": {
        "FLOWMAP_TRANSPORT": "stdio"
      }
    }
  }
}
```



Start the server in your editor. WASM grammars are bundled — no environment variables needed.

> **Tip:** Create `.vscode/mcp.json` via the Command Palette -> **MCP: Add Server** -> **stdio**.

### Option 3 — HTTP-SSE (shared or remote server)

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

## Tools Reference

Optional parameters shown in `[brackets]`.

| Tool | Parameters | Returns |
|------|------------|---------|
| `flowmap_analyze_workspace` | `workspacePath`, [`exclude`], [`language`] | Full call graph: nodes, edges, flows, orphans |
| `flowmap_analyze_file` | `filePath` | Functions and call sites in one file |
| `flowmap_get_callers` | `functionName`, `workspacePath` | Direct callers of the function |
| `flowmap_get_callees` | `functionName`, `workspacePath` | Functions the named function calls |
| `flowmap_get_flow` | `functionName`, `workspacePath`, [`maxDepth`=10] | Full BFS subgraph reachable from a function |
| `flowmap_list_entry_points` | `workspacePath` | Mains, route handlers, CLI commands, React roots |
| `flowmap_find_orphans` | `workspacePath` | Functions unreachable from any entry point |
| `flowmap_find_cycles` | `workspacePath`, [`minCycleLength`], [`exclude`] | All circular call chains with exact edges |
| `flowmap_find_duplicates` *(experimental)* | `workspacePath`, [`similarityThreshold`=0.75], [`minCallees`=2], [`exclude`] | Function clusters with similar callee sets |

**`workspacePath`** — absolute path to the repo root (e.g. `/home/user/my-project` or `C:\projects\my-app`).

---

## Environment Variable Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `FLOWMAP_TRANSPORT` | `stdio` | `stdio` or `http` |
| `FLOWMAP_PORT` | `3100` | HTTP port (http transport only) |
| `FLOWMAP_GRAMMARS` | *(bundled)* | Override path to WASM grammar files |
| `FLOWMAP_BATCH_SIZE` | `50` | Files per parallel parsing batch (must be ≥ 1) |
| `FLOWMAP_CACHE_TTL_MS` | `30000` | Result cache time-to-live in milliseconds (0 to disable) |
| `FLOWMAP_DUP_THRESHOLD` | `0.75` | Jaccard similarity threshold for `find_duplicates` (0–1) |
| `FLOWMAP_DUP_MIN_CALLEES` | `2` | Min callee count for `find_duplicates` |

---

## Example Use Cases

### PR review and change safety

> *"I just modified `processPayment`. Without reading any code, tell me every function that could break and rank them by how many hops away they are from the change."*

The agent calls `flowmap_get_callers("processPayment", workspacePath)` for the direct impact radius (1 hop), then recursively traverses callers-of-callers to build a ranked list by distance.

---

> *"We're about to merge a PR that touches `validateCart`. Give me an impact report — what's the worst case if this function throws."*

The agent calls `flowmap_get_flow("validateCart", workspacePath)` to map every function reachable downstream, then `flowmap_get_callers("validateCart", workspacePath)` to map every upstream caller.

---

### Architecture problems

> *"Which functions in this codebase are architectural nasty-surprises — called by everything but calling a lot themselves. I want names, file paths, and exact counts."*

The agent calls `flowmap_analyze_workspace(workspacePath)` to get the full graph, then filters for nodes with high in-degree (many callers) and high out-degree (many callees). These are the structural chokepoints — functions where a bug propagates in both directions. Returned with exact counts. No approximation.

---

> *"Find every cycle in the call graph. For each one tell me which file I should break the dependency in to resolve it cleanly."*

The agent calls `flowmap_find_cycles(workspacePath)`. Each cycle is returned as an ordered list of functions with file paths and the exact call edges forming the loop — no post-processing needed. Because the graph is exact, cycle membership is exact — not a guess about which modules "seem" circular.

---

### Dead code and cleanup

> *"I want to delete code safely. Give me every function that is provably unreachable — not called by anything, not an entry point. Include file and line number."*

The agent calls `flowmap_find_orphans(workspacePath)`. This returns every function not reachable from any entry point in the call graph — with file path and line number for each one. 

---

### Onboarding

> *"I just joined this team. Walk me through this codebase starting from the entry points — explain each major flow in plain English without me having to read a single file."*

The agent calls `flowmap_list_entry_points(workspacePath)` to find every main, route handler, CLI command, and React root. Then it calls `flowmap_get_flow` on each one to trace the execution.

---

### Refactoring

> *"I want to extract the payment logic into its own module. Based purely on call relationships, which functions naturally belong together and which ones would need to stay behind."*

The agent calls `flowmap_analyze_workspace(workspacePath)` and uses the graph to find the connected component of functions reachable from payment-related entry points. 

---

### AI agent review

> *"Cursor just made changes across 14 files. Based on what it touched, what else in the codebase should I be nervous about that it didn't touch."*

The agent calls `flowmap_get_callers` for each modified function and `flowmap_get_flow` for each modified function. The union of those results — minus the files already touched — is the set of functions that depend on the changes but weren't updated. These are the places where silent breakage is most likely. Returned as a precise list, not a guess about what "might be related".

---

### Agentic code generation with structural guardrails

When an agent is generating new code, it can call `flowmap_analyze_workspace` before and after to verify:
- New functions are connected to the call graph (not accidentally orphaned)
- No existing entry points were broken
- The intended call relationships were actually created

---

### Catching agent-introduced duplication before it compounds

> *"We've been using an AI agent to build this codebase for 3 months. How much logic has it silently duplicated?"*

Agents optimize for the current instruction, not long-term architecture. It copies, tweaks slightly, and moves on. It satisfied the local goal.

The agent calls `flowmap_find_duplicates(workspacePath)`. Each cluster in the result is a group of functions with different names — often in different components — that call the same set of dependencies. 

---

### Detecting circular dependencies introduced by agent-generated code

> *"The agent has been adding features for weeks. Are there any circular call dependencies I should know about before this becomes a production problem?"*

The agent calls `flowmap_find_cycles(workspacePath)`. Every cycle is returned with the exact functions involved.

---

![Duplicates](https://raw.githubusercontent.com/devricky-codes/callgraph-mcp/refs/heads/main/assets/duplicates.gif)

*Duplicates flags different functions that could be a single re-usable function*

## How It Works

1. Tree-sitter WASM grammars parse each source file into an AST — no runtime execution, no imports
2. Functions and call sites are extracted from the AST
3. A call graph is built by resolving call site names to function definitions (by name, suffix, and file)
4. Entry points are detected: functions that are never called but call others
5. The graph is partitioned into independent execution flows via BFS from each entry point

Files are parsed in parallel batches of 50. Results are cached for 30 seconds — repeated calls within a session are instant.

---

## Links

- [VS Code Extension](https://github.com/devricky-codes/callsight-vscode)
- [Core Package (@codeflow-map/core)](https://www.npmjs.com/package/@codeflow-map/core)
- [Source Code](https://github.com/devricky-codes/callgraph-mcp)
- [Report Issues](https://github.com/devricky-codes/callgraph-mcp/issues)

## License

MIT
