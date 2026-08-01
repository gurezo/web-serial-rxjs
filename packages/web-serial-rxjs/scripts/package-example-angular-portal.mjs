/**
 * Build the Angular example with portal baseHref and copy the browser
 * bundle into docs/examples/angular/ for docs:portal packaging (#354).
 */
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '../../..');
const browserOut = join(repoRoot, 'dist/apps/example-angular/browser');
const docsAngularOut = join(repoRoot, 'docs/examples/angular');

mkdirSync(join(repoRoot, 'docs/examples'), { recursive: true });

const build = spawnSync(
  'pnpm',
  ['exec', 'nx', 'build', 'example-angular', '--configuration=portal'],
  {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  },
);

if (build.status !== 0) {
  console.error('example-angular portal build failed.');
  process.exit(build.status ?? 1);
}

if (!existsSync(browserOut)) {
  console.error(`Browser output not found: ${browserOut}`);
  process.exit(1);
}

rmSync(docsAngularOut, { recursive: true, force: true });
mkdirSync(docsAngularOut, { recursive: true });
cpSync(browserOut, docsAngularOut, { recursive: true });

console.log(`Packaged Angular example → ${docsAngularOut}`);
