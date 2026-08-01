/**
 * Build the React example with portal Vite base and copy the
 * bundle into docs/examples/react/ for docs:portal packaging (#355).
 */
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '../../..');
const buildOut = join(repoRoot, 'dist/apps/example-react');
const docsReactOut = join(repoRoot, 'docs/examples/react');

mkdirSync(join(repoRoot, 'docs/examples'), { recursive: true });

const build = spawnSync(
  'pnpm',
  ['exec', 'nx', 'build', 'example-react', '--configuration=portal'],
  {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  },
);

if (build.status !== 0) {
  console.error('example-react portal build failed.');
  process.exit(build.status ?? 1);
}

if (!existsSync(buildOut)) {
  console.error(`Build output not found: ${buildOut}`);
  process.exit(1);
}

rmSync(docsReactOut, { recursive: true, force: true });
mkdirSync(docsReactOut, { recursive: true });
cpSync(buildOut, docsReactOut, { recursive: true });

console.log(`Packaged React example → ${docsReactOut}`);
