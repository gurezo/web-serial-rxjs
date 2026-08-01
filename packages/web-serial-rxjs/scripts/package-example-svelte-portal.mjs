/**
 * Build the Svelte example with portal Vite base and copy the
 * bundle into docs/examples/svelte/ for docs:portal packaging (#356).
 */
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '../../..');
const buildOut = join(repoRoot, 'dist/apps/example-svelte');
const docsSvelteOut = join(repoRoot, 'docs/examples/svelte');

mkdirSync(join(repoRoot, 'docs/examples'), { recursive: true });

const build = spawnSync(
  'pnpm',
  ['exec', 'nx', 'build', 'example-svelte', '--configuration=portal'],
  {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  },
);

if (build.status !== 0) {
  console.error('example-svelte portal build failed.');
  process.exit(build.status ?? 1);
}

if (!existsSync(buildOut)) {
  console.error(`Build output not found: ${buildOut}`);
  process.exit(1);
}

rmSync(docsSvelteOut, { recursive: true, force: true });
mkdirSync(docsSvelteOut, { recursive: true });
cpSync(buildOut, docsSvelteOut, { recursive: true });

console.log(`Packaged Svelte example → ${docsSvelteOut}`);
