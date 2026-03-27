const esbuild = require('esbuild');

esbuild.buildSync({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node18',
  minify: true,
  outfile: 'dist/index.js',
  banner: { js: '#!/usr/bin/env node' },
  external: [
    '@codeflow-map/core',
    '@modelcontextprotocol/sdk',
    'fast-glob',
    'zod',
  ],
});
