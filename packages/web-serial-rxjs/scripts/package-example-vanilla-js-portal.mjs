/**
 * Build the Vanilla JS example with portal Vite base and copy the
 * bundle into docs/examples/vanilla-js/ for docs:portal packaging (#357).
 */
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '../../..');
const buildOut = join(repoRoot, 'dist/apps/example-vanilla-js');
const docsVanillaJsOut = join(repoRoot, 'docs/examples/vanilla-js');

mkdirSync(join(repoRoot, 'docs/examples'), { recursive: true });

const build = spawnSync(
  'pnpm',
  ['exec', 'nx', 'build', 'example-vanilla-js', '--configuration=portal'],
  {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  },
);

if (build.status !== 0) {
  console.error('example-vanilla-js portal build failed.');
  process.exit(build.status ?? 1);
}

if (!existsSync(buildOut)) {
  console.error(`Build output not found: ${buildOut}`);
  process.exit(1);
}

rmSync(docsVanillaJsOut, { recursive: true, force: true });
mkdirSync(docsVanillaJsOut, { recursive: true });
cpSync(buildOut, docsVanillaJsOut, { recursive: true });

console.log(`Packaged Vanilla JS example → ${docsVanillaJsOut}`);
