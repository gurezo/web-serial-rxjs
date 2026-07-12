import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import { buildDocumentUrlMap } from './docs-paths.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const apiAssetsRoot = join(__dirname, '../../../docs/api/assets');
const apiRoot = join(__dirname, '../../../docs/api');

const urlMap = buildDocumentUrlMap();

function patchCompressedAsset(filePath, globalName) {
  const original = readFileSync(filePath, 'utf8');
  const match = original.match(new RegExp(`window\\.${globalName} = "([^"]+)"`));
  if (!match) {
    console.warn(`Skipped ${filePath}: no ${globalName} payload found.`);
    return false;
  }

  let payload = zlib.inflateSync(Buffer.from(match[1], 'base64')).toString('utf8');
  let replacements = 0;

  for (const [from, to] of urlMap.entries()) {
    const occurrences = payload.split(from).length - 1;
    if (occurrences > 0) {
      payload = payload.replaceAll(from, to);
      replacements += occurrences;
    }
  }

  if (replacements === 0) {
    return false;
  }

  const compressed = zlib.deflateSync(Buffer.from(payload, 'utf8')).toString('base64');
  const next = original.replace(
    new RegExp(`window\\.${globalName} = "[^"]+"`),
    `window.${globalName} = "${compressed}"`,
  );
  writeFileSync(filePath, next, 'utf8');
  console.log(`Patched ${replacements} URLs in ${filePath}`);
  return true;
}

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

patchCompressedAsset(join(apiAssetsRoot, 'search.js'), 'searchData');
patchCompressedAsset(join(apiAssetsRoot, 'navigation.js'), 'navigationData');

let htmlUpdated = 0;
for (const htmlFile of collectHtmlFiles(apiRoot)) {
  const original = readFileSync(htmlFile, 'utf8');
  let next = original;

  for (const [from, to] of urlMap.entries()) {
    next = next.replaceAll(from, to);
  }

  if (next !== original) {
    writeFileSync(htmlFile, next, 'utf8');
    htmlUpdated += 1;
  }
}

console.log(`Updated document links in ${htmlUpdated} API HTML files.`);
