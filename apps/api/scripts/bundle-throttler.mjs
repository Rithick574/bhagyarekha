import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
// Vercel runs apps/api/src/app.module.js, so the relative import is src/vendor/throttler.js.
// tsc emits dist/app.module.js, which resolves the same import under dist/vendor.
const outfile = join(apiRoot, 'src/vendor/throttler.js');
const distOutfile = join(apiRoot, 'dist/vendor/throttler.js');

await mkdir(dirname(outfile), { recursive: true });

// @nestjs/throttler 6.7 publishes CommonJS that require()s @nestjs/common.
// Nest 12 publishes that package as ESM only. Node 22 can require() ESM;
// the Vercel function runtime cannot, and crashes with ERR_REQUIRE_ESM.
// This bundle keeps the throttler implementation and loads Nest with import.
await esbuild.build({
  absWorkingDir: apiRoot,
  entryPoints: [fileURLToPath(import.meta.resolve('@nestjs/throttler'))],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  outfile,
  external: ['@nestjs/common', '@nestjs/core', 'reflect-metadata'],
  // esbuild keeps CJS require() calls inside the bundle. A real require() of
  // @nestjs/common fails on Vercel, so those two packages are loaded with import.
  banner: {
    js: `import * as __nestCommon from '@nestjs/common';
import * as __nestCore from '@nestjs/core';
import { createRequire as __createRequire } from 'node:module';
const __nodeRequire = __createRequire(import.meta.url);
function require(id) {
  if (id === '@nestjs/common') return __nestCommon;
  if (id === '@nestjs/core') return __nestCore;
  return __nodeRequire(id);
}`,
  },
  footer: {
    js: `const __throttlerNs = require_index();
export const SkipThrottle = __throttlerNs.SkipThrottle;
export const ThrottlerGuard = __throttlerNs.ThrottlerGuard;
export const ThrottlerModule = __throttlerNs.ThrottlerModule;`,
  },
});

await mkdir(dirname(distOutfile), { recursive: true });
await copyFile(outfile, distOutfile);
