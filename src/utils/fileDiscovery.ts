import * as path from 'path';
import fg from 'fast-glob';
import { FILE_EXTENSION_MAP, SupportedLanguage } from '@codeflow-map/core';

export interface DiscoveredFile {
  /** Relative path (forward slashes) from workspace root */
  filePath: string;
  /** Absolute path on disk */
  absPath: string;
  /** Language identified from file extension */
  languageId: SupportedLanguage;
}

const DISCOVERY_EXCLUDES = [
  '**/node_modules/**', '**/venv/**', '**/.venv/**',
  '**/__pycache__/**', '**/vendor/**', '**/target/**',
  '**/.git/**', '**/dist/**', '**/build/**',
  '**/.next/**', '**/.turbo/**', '**/coverage/**',
  '**/.gradle/**', '**/.cache/**', '**/site-packages/**',
  '**/.mypy_cache/**', '**/.pytest_cache/**',
  '**/out/**', '**/bin/**', '**/obj/**', '**/tests/**', '**/__tests__/**',
  '**/spec/**', '**/__specs__/**', '**/test/**',
];

export interface DiscoveryOptions {
  exclude?: string[];
  language?: SupportedLanguage;
}

export async function discoverFiles(
  workspacePath: string,
  options: DiscoveryOptions = {},
): Promise<DiscoveredFile[]> {
  const { exclude = [], language } = options;

  // Build extension list — either filtered to one language or all supported
  let extensions: string[];
  if (language) {
    const matching = Object.entries(FILE_EXTENSION_MAP)
      .filter(([, lang]) => lang === language)
      .map(([ext]) => ext.replace('.', ''));
    extensions = matching.length > 0 ? matching : [];
  } else {
    extensions = Object.keys(FILE_EXTENSION_MAP).map(e => e.replace('.', ''));
  }

  if (extensions.length === 0) return [];

  const pattern = extensions.length === 1
    ? `**/*.${extensions[0]}`
    : `**/*.{${extensions.join(',')}}`;

  const allExcludes = [...DISCOVERY_EXCLUDES, ...exclude];

  // fast-glob expects forward-slash paths
  const cwd = workspacePath.replace(/\\/g, '/');

  const relativePaths = await fg(pattern, {
    cwd,
    ignore: allExcludes,
    absolute: false,
    dot: false,
    onlyFiles: true,
  });

  const results: DiscoveredFile[] = [];
  for (const rel of relativePaths) {
    const ext = path.extname(rel);
    const lang = FILE_EXTENSION_MAP[ext];
    if (!lang) continue;
    results.push({
      filePath: rel.replace(/\\/g, '/'),
      absPath: path.resolve(workspacePath, rel),
      languageId: lang,
    });
  }

  return results;
}
