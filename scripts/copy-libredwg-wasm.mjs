import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(
  projectRoot,
  'node_modules/@mlightcad/libredwg-web/wasm/libredwg-web.wasm',
);
const destination = resolve(
  projectRoot,
  'public/libredwg/libredwg-web.wasm',
);

await mkdir(dirname(destination), { recursive: true });
await copyFile(source, destination);
console.log('Prepared LibreDWG WebAssembly runtime.');
