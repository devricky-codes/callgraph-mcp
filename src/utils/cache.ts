import { Graph } from '@codeflow-map/core';

interface CacheEntry {
  graph: Graph;
  cachedAt: number;
  workspacePath: string;
}

const cache = new Map<string, CacheEntry>();

/**
 * Get cache TTL in milliseconds from environment variable.
 * FLOWMAP_CACHE_TTL_MS: milliseconds (default: 30000 = 30 seconds)
 */
function getCacheTTL(): number {
  const envValue = process.env.FLOWMAP_CACHE_TTL_MS;
  if (!envValue) return 30_000;
  const parsed = parseInt(envValue, 10);
  if (!isFinite(parsed) || parsed < 0) {
    process.stderr.write(`[flowmap] Invalid FLOWMAP_CACHE_TTL_MS: "${envValue}" (must be non-negative integer). Using default 30000ms.\n`);
    return 30_000;
  }
  return parsed;
}

const TTL_MS = getCacheTTL();

export function getCached(workspacePath: string): Graph | null {
  const entry = cache.get(workspacePath);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > TTL_MS) {
    cache.delete(workspacePath);
    return null;
  }
  return entry.graph;
}

export function setCached(workspacePath: string, graph: Graph): void {
  cache.set(workspacePath, { graph, cachedAt: Date.now(), workspacePath });
}

export function clearCache(workspacePath?: string): void {
  if (workspacePath) {
    cache.delete(workspacePath);
  } else {
    cache.clear();
  }
}
