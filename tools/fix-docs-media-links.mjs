import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

/** Copied to repo `docs/`: one level up from `docs/` to root — use `../assets/`. */
function fixRootDocsOverviews() {
  for (const name of ['docs/OVERVIEW.md', 'docs/OVERVIEW.ja.md']) {
    const filePath = path.join(root, name);
    if (!fs.existsSync(filePath)) continue;
    let s = fs.readFileSync(filePath, 'utf8');
    const next = s.replaceAll('../../../assets/', '../assets/');
    if (next !== s) fs.writeFileSync(filePath, next, 'utf8');
  }
}

/** Under `docs/media/`: two levels up to root — use `../../assets/`. */
function fixMediaOverviews() {
  const mediaDir = path.join(root, 'docs', 'media');
  if (!fs.existsSync(mediaDir)) return;

  for (const name of fs.readdirSync(mediaDir)) {
    if (!name.endsWith('.md')) continue;
    const filePath = path.join(mediaDir, name);
    let s = fs.readFileSync(filePath, 'utf8');
    let next = s.replaceAll('](./OVERVIEW', '](../OVERVIEW');
    next = next.replaceAll('../../../assets/', '../../assets/');
    if (next !== s) fs.writeFileSync(filePath, next, 'utf8');
  }
}

fixRootDocsOverviews();
fixMediaOverviews();
