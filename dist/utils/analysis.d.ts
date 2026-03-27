import { Graph } from '@codeflow-map/core';
import { DiscoveryOptions } from './fileDiscovery';
export declare function resolveWasmDir(): string;
export interface AnalyzeOptions extends DiscoveryOptions {
}
export declare function analyzeWorkspace(workspacePath: string, options?: AnalyzeOptions): Promise<Graph>;
