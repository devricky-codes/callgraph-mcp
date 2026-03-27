import { Graph } from '@codeflow-map/core';

/**
 * Produce an LLM-friendly text summary of a Graph for use alongside JSON responses.
 */
export function formatGraphSummary(graph: Graph): string {
  const entryPoints = graph.nodes.filter(n => n.isEntryPoint);
  const lines: string[] = [
    `Scanned ${graph.scannedFiles} files in ${graph.durationMs}ms.`,
    `Found ${graph.nodes.length} functions, ${graph.edges.length} call edges.`,
    `${graph.flows.length} execution flows, ${graph.orphans.length} orphan functions.`,
  ];

  if (entryPoints.length > 0) {
    lines.push('');
    lines.push(`Entry points (${entryPoints.length}):`);
    for (const ep of entryPoints.slice(0, 20)) {
      lines.push(`  - ${ep.name} (${ep.filePath}:${ep.startLine})`);
    }
    if (entryPoints.length > 20) {
      lines.push(`  ... and ${entryPoints.length - 20} more`);
    }
  }

  if (graph.orphans.length > 0) {
    lines.push('');
    lines.push(`Orphan functions (${graph.orphans.length}):`);
    const orphanNodes = graph.orphans
      .map(id => graph.nodes.find(n => n.id === id))
      .filter(Boolean);
    for (const n of orphanNodes.slice(0, 10)) {
      lines.push(`  - ${n!.name} (${n!.filePath}:${n!.startLine})`);
    }
    if (graph.orphans.length > 10) {
      lines.push(`  ... and ${graph.orphans.length - 10} more`);
    }
  }

  return lines.join('\n');
}
