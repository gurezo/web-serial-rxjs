import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageRoot = join(__dirname, '..');
const require = createRequire(import.meta.url);
const packageJson = require(join(packageRoot, 'package.json'));

function collectReferencedPaths() {
  const paths = new Set();

  if (typeof packageJson.module === 'string') {
    paths.add(packageJson.module);
  }

  if (typeof packageJson.types === 'string') {
    paths.add(packageJson.types);
  }

  const exportsField = packageJson.exports;
  if (exportsField && typeof exportsField === 'object') {
    for (const value of Object.values(exportsField)) {
      if (typeof value === 'string') {
        paths.add(value);
        continue;
      }

      if (value && typeof value === 'object') {
        for (const subpath of Object.values(value)) {
          if (typeof subpath === 'string') {
            paths.add(subpath);
          }
        }
      }
    }
  }

  return [...paths]
    .filter((path) => path.startsWith('./'))
    .map((path) => join(packageRoot, path.replace(/^\.\//, '')));
}

const referencedPaths = collectReferencedPaths();
const missing = referencedPaths.filter((path) => !existsSync(path));

if (missing.length > 0) {
  console.error('Missing dist artifacts referenced by package.json:');
  for (const path of missing) {
    console.error(`  - ${path}`);
  }
  process.exit(1);
}

console.log('Verified dist artifacts referenced by package.json exports.');
