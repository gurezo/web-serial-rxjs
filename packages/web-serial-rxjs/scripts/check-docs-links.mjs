import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const docsRoot = join(__dirname, '../../../docs');

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

function extractHrefs(html) {
  const hrefs = [];
  const regex = /href="([^"]+)"/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    hrefs.push(match[1]);
  }
  return hrefs;
}

function isExternalHref(href) {
  return (
    href.startsWith('http://') ||
    href.startsWith('https://') ||
    href.startsWith('mailto:') ||
    href.startsWith('tel:') ||
    href.startsWith('javascript:')
  );
}

const htmlFiles = collectHtmlFiles(docsRoot);
const broken = [];

for (const htmlFile of htmlFiles) {
  const html = readFileSync(htmlFile, 'utf8');
  const fileDir = dirname(htmlFile);

  for (const href of extractHrefs(html)) {
    if (!href || href.startsWith('#') || isExternalHref(href)) {
      continue;
    }

    const [pathPart] = href.split('#');
    const target = resolve(fileDir, pathPart);

    if (!existsSync(target)) {
      broken.push({
        source: htmlFile,
        href,
        resolved: target,
      });
    }
  }
}

if (broken.length > 0) {
  console.error('Broken internal documentation links:');
  for (const item of broken) {
    console.error(`  ${item.source}`);
    console.error(`    href: ${item.href}`);
    console.error(`    resolved: ${item.resolved}`);
  }
  process.exit(1);
}

console.log(`Checked internal links in ${htmlFiles.length} HTML files.`);
