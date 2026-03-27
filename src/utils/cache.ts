import { Graph } from '@codeflow-map/core';

interface CacheEntry {
  graph: Graph;
  cachedAt: number;
  workspacePath: string;
}

const cache = new Map<string, CacheEntry>();
const TTL_MS = 30_000; // 30 seconds

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
