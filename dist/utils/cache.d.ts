import { Graph } from '@codeflow-map/core';
export declare function getCached(workspacePath: string): Graph | null;
export declare function setCached(workspacePath: string, graph: Graph): void;
export declare function clearCache(workspacePath?: string): void;
