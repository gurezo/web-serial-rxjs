import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const apiRoot = join(__dirname, '../../../docs/api');

const ROOT_REPLACEMENTS = [
  [/href="\.\.\/\.\.\/api\/modules\.html"/g, 'href="modules.html"'],
  [/href="\.\.\/api\/modules\.html"/g, 'href="modules.html"'],
  [/href="\.\.\/guide\/en\/README\.md"/g, 'href="../guide/en/README.html"'],
  [/href="\.\.\/guide\/ja\/README\.md"/g, 'href="../guide/ja/README.html"'],
  [/href="documents\/((?:en|ja)_[^"]+\.html)"/g, (_match, docPath) => {
    const base = docPath.replace(/\.html$/, '');
    const locale = base.startsWith('ja_') ? 'ja' : 'en';
    const slug = base.slice(3);
    const page = slug.startsWith('archive_')
      ? `${slug.replace(/^archive_/, 'archive/')}.html`
      : `${slug}.html`;
    return `href="../guide/${locale}/${page}"`;
  }],
];

const DOCUMENT_REPLACEMENTS = [
  [/href="modules\.html"/g, 'href="../modules.html"'],
  [/href="\.\.\/guide\/en\/README\.html"/g, 'href="../../guide/en/README.html"'],
  [/href="\.\.\/guide\/ja\/README\.html"/g, 'href="../../guide/ja/README.html"'],
  [/href="\.\.\/index\.html"/g, 'href="../../index.html"'],
];

function collectHtmlFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      files.push(...collectHtmlFiles(fullPath));
      continue;
    }
    if (entry.endsWith('.html')) {
      files.push(fullPath);
    }
  }
  return files;
}

let updated = 0;

for (const htmlFile of collectHtmlFiles(apiRoot)) {
  const original = readFileSync(htmlFile, 'utf8');
  let next = original;
  const rel = relative(apiRoot, htmlFile);
  const replacements = rel.startsWith('documents/')
    ? [...ROOT_REPLACEMENTS, ...DOCUMENT_REPLACEMENTS]
    : ROOT_REPLACEMENTS;

  for (const [pattern, replacement] of replacements) {
    next = next.replace(pattern, replacement);
  }

  if (next !== original) {
    writeFileSync(htmlFile, next, 'utf8');
    updated += 1;
  }
}

console.log(`Updated TypeDoc HTML links in ${updated} files.`);
