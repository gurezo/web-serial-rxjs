import fs from 'node:fs';
import path from 'node:path';

const mediaDir = path.join(process.cwd(), 'docs', 'media');
if (!fs.existsSync(mediaDir)) process.exit(0);

for (const name of fs.readdirSync(mediaDir)) {
  if (!name.endsWith('.md')) continue;
  const filePath = path.join(mediaDir, name);
  let s = fs.readFileSync(filePath, 'utf8');
  const next = s.replaceAll('](./OVERVIEW', '](../OVERVIEW');
  if (next !== s) fs.writeFileSync(filePath, next, 'utf8');
}
