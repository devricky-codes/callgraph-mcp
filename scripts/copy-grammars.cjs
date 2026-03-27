#!/usr/bin/env node
/**
 * copy-grammars.cjs
 * Copies the needed Tree-sitter WASM grammar files into packages/mcp-server/grammars/
 * so they are included in the published npm package and available at runtime.
 *
 * Run: node scripts/copy-grammars.cjs
 * This is called automatically as part of the `build` npm script.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const NEEDED = [
  'tree-sitter.wasm',          // base parser engine
  'tree-sitter-typescript.wasm',
  'tree-sitter-javascript.wasm', // also used for JSX
  'tree-sitter-tsx.wasm',
  'tree-sitter-python.wasm',
  'tree-sitter-go.wasm',
];

// Source: monorepo root grammars/ — 3 levels up from scripts/ (mcp-server/scripts → mcp-server → packages → root)
const src = path.resolve(__dirname, '..', '..', '..', 'grammars');
// Destination: packages/mcp-server/grammars/
const dest = path.resolve(__dirname, '..', 'grammars');

if (!fs.existsSync(src)) {
  console.error(`ERROR: Grammar source directory not found: ${src}`);
  console.error('Run this script from within the monorepo.');
  process.exit(1);
}

fs.mkdirSync(dest, { recursive: true });

let copied = 0;
for (const file of NEEDED) {
  const srcFile = path.join(src, file);
  const destFile = path.join(dest, file);
  if (!fs.existsSync(srcFile)) {
    console.warn(`  WARN: ${file} not found in ${src} — skipping`);
    continue;
  }
  fs.copyFileSync(srcFile, destFile);
  console.log(`  Copied ${file}`);
  copied++;
}

console.log(`\nGrammars copied: ${copied}/${NEEDED.length} → ${dest}`);
