import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  apiAssetPrefixFromDocsPath,
  rewriteTypedocDocumentHref,
  typedocFilenameToGuideRelPath,
} from './docs-paths.mjs';
import { buildToolbarLinks } from './docs-theme.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '../../..');
const apiDocumentsRoot = join(repoRoot, 'docs/api/documents');
const docsOutRoot = join(repoRoot, 'docs');
const iconSource = join(repoRoot, 'assets/icon/web-serial-rxjs-icon.png');
const iconDest = join(docsOutRoot, 'media/web-serial-rxjs-icon.png');

const TYPEDOC_DOC_PATTERN = /^(en|ja)_.+\.html$/;

function docsRootPrefix(guideRelPath) {
  const depth = guideRelPath.split('/').length - 1;
  return '../'.repeat(depth);
}

function rewriteGuideHtml(html, { locale, pagePath, guideRelPath }) {
  const assetPrefix = apiAssetPrefixFromDocsPath(guideRelPath);
  const docsPrefix = docsRootPrefix(guideRelPath);
  const otherLocale = locale === 'ja' ? 'en' : 'ja';
  const pageDir = pagePath.includes('/') ? `${pagePath.slice(0, pagePath.lastIndexOf('/'))}/` : '';

  let next = html;

  next = next.replace(/data-base="\.\.\/"/, `data-base="${assetPrefix}"`);
  next = next.replaceAll('../assets/', `${assetPrefix}assets/`);
  next = next.replaceAll('href="assets/', `href="${assetPrefix}assets/`);
  next = next.replaceAll('src="assets/', `src="${assetPrefix}assets/`);
  next = next.replaceAll('href="modules.html"', `href="${assetPrefix}modules.html"`);
  next = next.replaceAll('href="../modules.html"', `href="${assetPrefix}modules.html"`);
  next = next.replaceAll('href="../index.html"', `href="${docsPrefix}index.html"`);
  next = next.replace(
    /src="\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/assets\/icon\/web-serial-rxjs-icon\.png"/g,
    `src="${docsPrefix}media/web-serial-rxjs-icon.png"`,
  );

  next = next.replace(/href="((en|ja)_[^"]+\.html)(#[^"]*)?"/g, (_match, pathPart, _locale, hash = '') => {
    const rewritten = rewriteTypedocDocumentHref(pathPart, locale, pagePath);
    return `href="${rewritten}${hash}"`;
  });

  next = next.replace(/href="([^"]+\.md)(#[^"]*)?"/g, (match, mdPath, hash = '') => {
    if (mdPath.startsWith('http://') || mdPath.startsWith('https://')) {
      return match;
    }
    const htmlPath = mdPath.replace(/\.md$/, '.html');
    return `href="${htmlPath}${hash}"`;
  });

  if (pagePath.includes('/')) {
    next = next.replaceAll('href="archive/README.html"', 'href="../README.html"');
    next = next.replaceAll('href="../../index.html"', 'href="../../../index.html"');
    next = next.replaceAll('href="../en/', 'href="../../en/');
    next = next.replaceAll('href="../ja/', 'href="../../ja/');
  }

  next = next.replace(
    /<div id="tsd-toolbar-links"><\/div>/,
    buildToolbarLinks({
      locale,
      guideIndexHref: pagePath.includes('/') ? '../README.html' : 'README.html',
      otherLocaleHref: `${docsPrefix}guide/${otherLocale}/${pagePath}`,
      apiHref: `${assetPrefix}modules.html`,
      siteIndexHref: `${docsPrefix}index.html`,
    }),
  );

  const lang = locale === 'ja' ? 'ja' : 'en';
  next = next.replace(/<html class="default" lang="en"/, `<html class="default" lang="${lang}"`);

  return next;
}

mkdirSync(join(docsOutRoot, 'media'), { recursive: true });
copyFileSync(iconSource, iconDest);

const documentFiles = readdirSync(apiDocumentsRoot).filter((name) =>
  TYPEDOC_DOC_PATTERN.test(name),
);

let relocated = 0;

for (const filename of documentFiles) {
  const mapping = typedocFilenameToGuideRelPath(filename);
  if (!mapping) {
    continue;
  }

  const sourcePath = join(apiDocumentsRoot, filename);
  const destPath = join(docsOutRoot, mapping.guideRelPath);
  mkdirSync(dirname(destPath), { recursive: true });

  const original = readFileSync(sourcePath, 'utf8');
  const rewritten = rewriteGuideHtml(original, {
    locale: mapping.locale,
    pagePath: mapping.pagePath,
    guideRelPath: mapping.guideRelPath,
  });

  writeFileSync(destPath, rewritten, 'utf8');
  relocated += 1;
}

for (const filename of documentFiles) {
  rmSync(join(apiDocumentsRoot, filename), { force: true });
}

console.log(`Relocated ${relocated} TypeDoc guide pages to docs/guide/.`);
