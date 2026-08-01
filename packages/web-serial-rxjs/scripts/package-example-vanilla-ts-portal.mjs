/**
 * Build the Vanilla TS example with portal Vite base and copy the
 * bundle into docs/examples/vanilla-ts/ for docs:portal packaging (#358).
 */
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '../../..');
const buildOut = join(repoRoot, 'dist/apps/example-vanilla-ts');
const docsVanillaTsOut = join(repoRoot, 'docs/examples/vanilla-ts');

mkdirSync(join(repoRoot, 'docs/examples'), { recursive: true });

const build = spawnSync(
  'pnpm',
  ['exec', 'nx', 'build', 'example-vanilla-ts', '--configuration=portal'],
  {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  },
);

if (build.status !== 0) {
  console.error('example-vanilla-ts portal build failed.');
  process.exit(build.status ?? 1);
}

if (!existsSync(buildOut)) {
  console.error(`Build output not found: ${buildOut}`);
  process.exit(1);
}

rmSync(docsVanillaTsOut, { recursive: true, force: true });
mkdirSync(docsVanillaTsOut, { recursive: true });
cpSync(buildOut, docsVanillaTsOut, { recursive: true });

console.log(`Packaged Vanilla TS example → ${docsVanillaTsOut}`);
