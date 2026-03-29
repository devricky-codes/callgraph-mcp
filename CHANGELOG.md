# Changelog

All notable changes to `callgraph-mcp` are documented here.

---

## [1.8.1] — 2026-03-29

### Added
- **`FLOWMAP_VERBOSE`** env var — Toggle diagnostic logging to `stderr`. Defaults to `true`. Set to `false` to suppress progress and initialization logs.

---

## [1.8.0] — 2026-03-29

### Added
- **Real-time progress tracking** — All tools now report progress stages and timing. Include `progress` field in response with step-by-step breakdown and summary.
- **`FLOWMAP_BATCH_SIZE`** env var — Control parallel file parsing batch size (default `50`, must be ≥ 1). Tune for memory vs. throughput trade-offs.
- **`FLOWMAP_CACHE_TTL_MS`** env var — Control result cache time-to-live in milliseconds (default `30000` = 30 seconds, set to `0` to disable).

### Changed
- All tools now validate environment variables at startup and warn on stderr if invalid values are provided.

---

## [1.6.3] — 2026-03-28

### Changed
- README updates only. (1.4.0 – 1.7.0)

---

## [1.4.0] — 2026-03-27

### Added
- **`flowmap_find_cycles`** — Detects all call cycles (circular dependencies and mutual recursion) in the codebase using Tarjan's SCC algorithm. Returns each cycle with the exact member functions, file locations, and the specific call edges forming the loop. Supports `minCycleLength` and `exclude` parameters.
- **`flowmap_find_duplicates`** *(experimental)* — Identifies functionally duplicate functions using callee-set Jaccard similarity. Groups functions with different names but the same dependency fingerprint into clusters — candidates for extraction into a shared utility. Supports `similarityThreshold`, `minCallees`, and `exclude` parameters.
- **`FLOWMAP_DUP_THRESHOLD`** env var — Sets the default Jaccard similarity threshold for `flowmap_find_duplicates` (0–1, default `0.75`). Overridable per-call.
- **`FLOWMAP_DUP_MIN_CALLEES`** env var — Sets the default minimum callee count for `flowmap_find_duplicates` (default `2`). Overridable per-call.

---

## [1.3.0] — 2026-03-27

### Changed
- Version bump accompanying internal tooling and monorepo updates.

---

## [1.2.0] — 2026-03-27

### Changed
- Version bump for distribution and packaging updates.

---

## [1.1.0] — 2026-03-20

### Added
- **`flowmap_find_orphans`** — Returns all functions unreachable from any entry point (potential dead code), with file path and line number for each.
- **`flowmap_list_entry_points`** — Detects all entry points in the codebase: main functions, route handlers, CLI commands, React roots.
- **`flowmap_get_flow`** — BFS subgraph from a named function up to a configurable `maxDepth`. Returns the full reachable execution path.
- **`flowmap_get_callers`** — Impact analysis: returns every function that directly calls the named function.
- **`flowmap_get_callees`** — Dependency analysis: returns every function the named function directly calls.
- **`flowmap_analyze_file`** — Parses a single file and returns its functions and call sites.
- HTTP / SSE transport mode via `FLOWMAP_TRANSPORT=http`.
- `FLOWMAP_PORT` env var for configuring the HTTP server port (default `3100`).
- Streamable HTTP transport using `StreamableHTTPServerTransport` with per-session state.

### Changed
- Grammars bundled into the npm package — no separate install step required.
- `FLOWMAP_GRAMMARS` env var is now optional; defaults to the bundled `grammars/` directory.

---

## [1.0.0] — 2026-03-15

### Added
- Initial release.
- **`flowmap_analyze_workspace`** — Scans an entire codebase and returns a full call graph: all functions, edges, execution flows, and orphans.
- stdio transport (default) using `StdioServerTransport`.
- Tree-sitter WASM parsing for TypeScript, JavaScript, TSX, JSX, Python, and Go.
- 30-second in-memory cache for workspace analysis results.
- `FLOWMAP_GRAMMARS` and `FLOWMAP_TRANSPORT` environment variables.
