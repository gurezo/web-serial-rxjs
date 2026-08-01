import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '../../..');
const docsOutRoot = join(repoRoot, 'docs');
const portalFragmentRoot = join(repoRoot, 'dist/portal/web-serial-rxjs');

const indexPath = join(docsOutRoot, 'index.html');
if (!existsSync(indexPath)) {
  console.error(
    'docs/index.html not found. Run `pnpm run docs` (or docs:index) before docs:portal.',
  );
  process.exit(1);
}

rmSync(portalFragmentRoot, { recursive: true, force: true });
mkdirSync(portalFragmentRoot, { recursive: true });

for (const entry of readdirSync(docsOutRoot)) {
  if (entry === '.gitignore') {
    continue;
  }
  const src = join(docsOutRoot, entry);
  const dest = join(portalFragmentRoot, entry);
  const stats = statSync(src);
  if (stats.isDirectory()) {
    cpSync(src, dest, { recursive: true });
  } else {
    cpSync(src, dest);
  }
}

console.log(`Packaged docs portal fragment → ${portalFragmentRoot}`);
