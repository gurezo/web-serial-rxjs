import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {
  CANONICAL_RUNTIME_EXPORTS,
  CANONICAL_TYPE_EXPORTS,
  REMOVED_SESSION_APIS,
} from './public-api-allowlist.mjs';

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

function parseExportedNamesFromBlocks(source, kind) {
  const names = [];
  const pattern =
    kind === 'type'
      ? /export\s+type\s*\{([^}]+)\}/gs
      : /export\s*\{([^}]+)\}/gs;
  for (const match of source.matchAll(pattern)) {
    const block = match[1] ?? '';
    for (const part of block.split(',')) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const localName = trimmed.split(/\s+as\s+/)[0]?.trim();
      if (localName && /^[A-Za-z_][A-Za-z0-9_]*$/.test(localName)) {
        names.push(localName);
      }
    }
  }
  return [...new Set(names)].sort();
}

function listDeclarationFiles(distRoot) {
  return readdirSync(distRoot, { recursive: true, encoding: 'utf8' })
    .filter((entry) => entry.endsWith('.d.ts'))
    .sort();
}

function arraysEqual(actual, expected) {
  if (actual.length !== expected.length) {
    return false;
  }
  return actual.every((value, index) => value === expected[index]);
}

function fail(message) {
  console.error(message);
  process.exit(1);
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

const distRoot = join(packageRoot, 'dist');
const dtsPath = join(distRoot, 'index.d.ts');

if (!existsSync(distRoot)) {
  fail('dist/ is missing; run `pnpm exec nx build web-serial-rxjs` before verify-dist');
}

if (!existsSync(dtsPath)) {
  fail(
    'dist/index.d.ts is missing; run `pnpm exec nx build web-serial-rxjs` before verify-dist',
  );
}

const dtsSource = readFileSync(dtsPath, 'utf8');
const actualRuntimeExports = parseExportedNamesFromBlocks(dtsSource, 'value');
const expectedRuntimeExports = [...CANONICAL_RUNTIME_EXPORTS].sort();
if (!arraysEqual(actualRuntimeExports, expectedRuntimeExports)) {
  fail(
    [
      'dist/index.d.ts runtime exports are not aligned with the allowlist.',
      `  actual:   ${JSON.stringify(actualRuntimeExports)}`,
      `  expected: ${JSON.stringify(expectedRuntimeExports)}`,
    ].join('\n'),
  );
}

const actualTypeExports = parseExportedNamesFromBlocks(dtsSource, 'type');
const expectedTypeExports = [...CANONICAL_TYPE_EXPORTS].sort();
if (!arraysEqual(actualTypeExports, expectedTypeExports)) {
  fail(
    [
      'dist/index.d.ts type exports are not aligned with the allowlist.',
      `  actual:   ${JSON.stringify(actualTypeExports)}`,
      `  expected: ${JSON.stringify(expectedTypeExports)}`,
    ].join('\n'),
  );
}

console.log('Verified dist/index.d.ts exports against the public API allowlist.');

for (const relativePath of listDeclarationFiles(distRoot)) {
  const source = readFileSync(join(distRoot, relativePath), 'utf8');
  for (const name of REMOVED_SESSION_APIS) {
    if (source.includes(name)) {
      fail(
        `Removed API "${name}" was reintroduced in declaration output: ${relativePath}`,
      );
    }
  }
  if (/receiveReplay/.test(source)) {
    fail(
      `Removed API fragment "receiveReplay" was reintroduced in declaration output: ${relativePath}`,
    );
  }
}

console.log('Verified declaration build output does not reintroduce removed APIs.');
