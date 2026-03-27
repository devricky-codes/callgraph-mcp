import { SupportedLanguage } from '@codeflow-map/core';
export interface DiscoveredFile {
    /** Relative path (forward slashes) from workspace root */
    filePath: string;
    /** Absolute path on disk */
    absPath: string;
    /** Language identified from file extension */
    languageId: SupportedLanguage;
}
export interface DiscoveryOptions {
    exclude?: string[];
    language?: SupportedLanguage;
}
export declare function discoverFiles(workspacePath: string, options?: DiscoveryOptions): Promise<DiscoveredFile[]>;
