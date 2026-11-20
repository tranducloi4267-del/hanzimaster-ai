import esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const outDir = path.resolve('dist-electron');
fs.mkdirSync(outDir, { recursive: true });

await Promise.all([
  esbuild.build({
    entryPoints: ['electron/main.ts'],
    outfile: 'dist-electron/main.cjs',
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node20',
    external: ['electron', 'bufferutil', 'utf-8-validate']
  }),
  esbuild.build({
    entryPoints: ['electron/preload.ts'],
    outfile: 'dist-electron/preload.cjs',
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node20',
    external: ['electron']
  })
]);

console.log('✓ Đã biên dịch Electron main & preload -> dist-electron/');
