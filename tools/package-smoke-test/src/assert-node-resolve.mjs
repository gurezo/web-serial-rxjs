import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const resolvedPath = fileURLToPath(
  import.meta.resolve('@gurezo/web-serial-rxjs'),
);
const packedRoot = fileURLToPath(
  new URL(
    '../node_modules/@gurezo/web-serial-rxjs/',
    import.meta.url,
  ),
);
const expectedEntry = join(packedRoot, 'dist/index.mjs');

if (resolvedPath !== expectedEntry) {
  throw new Error(
    `Node resolved @gurezo/web-serial-rxjs to ${resolvedPath}, expected ${expectedEntry}`,
  );
}

console.log('Verified Node ESM bare specifier resolves the packed entry.');
