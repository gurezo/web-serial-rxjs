import { copyFileSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import MarkdownIt from 'markdown-it';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageRoot = join(__dirname, '..');
const repoRoot = join(packageRoot, '../..');
const guideSourceRoot = join(packageRoot, 'docs/guide');
const docsOutRoot = join(repoRoot, 'docs');
const iconSource = join(repoRoot, 'assets/icon/web-serial-rxjs-icon.png');
const iconDest = join(docsOutRoot, 'media/web-serial-rxjs-icon.png');

const LOCALES = ['ja', 'en'];
const md = new MarkdownIt({ html: true, linkify: true });

const PAGE_LABELS = {
  ja: {
    guideIndex: '日本語 Guide',
    otherLocale: 'English Guide',
    apiReference: 'API Reference',
    siteTop: 'ドキュメントトップ',
  },
  en: {
    guideIndex: 'English Guide',
    otherLocale: '日本語 Guide',
    apiReference: 'API Reference',
    siteTop: 'Documentation home',
  },
};

const GUIDE_CSS = `
:root {
  color-scheme: light dark;
  --text: #1a1a1a;
  --muted: #555;
  --border: #d8d8d8;
  --bg: #fff;
  --nav-bg: #f5f5f5;
  --link: #0969da;
}
@media (prefers-color-scheme: dark) {
  :root {
    --text: #e6edf3;
    --muted: #9da7b3;
    --border: #30363d;
    --bg: #0d1117;
    --nav-bg: #161b22;
    --link: #4493f8;
  }
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
  line-height: 1.6;
  color: var(--text);
  background: var(--bg);
}
.site-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1.25rem;
  padding: 0.75rem 1.25rem;
  border-bottom: 1px solid var(--border);
  background: var(--nav-bg);
  font-size: 0.95rem;
}
.site-nav a {
  color: var(--link);
  text-decoration: none;
}
.site-nav a:hover { text-decoration: underline; }
main {
  max-width: 52rem;
  margin: 0 auto;
  padding: 1.5rem 1.25rem 3rem;
}
main img { max-width: 100%; height: auto; }
main table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
main th, main td { border: 1px solid var(--border); padding: 0.5rem 0.75rem; text-align: left; }
main code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.9em; }
main pre { overflow-x: auto; padding: 1rem; border: 1px solid var(--border); border-radius: 6px; }
main pre code { font-size: 0.85em; }
main h1, main h2, main h3 { line-height: 1.25; }
main a { color: var(--link); }
`;

function collectMarkdownFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      files.push(...collectMarkdownFiles(fullPath));
      continue;
    }
    if (entry.endsWith('.md')) {
      files.push(fullPath);
    }
  }
  return files;
}

function mdPathToHtmlPath(mdRelativePath) {
  const normalized = mdRelativePath.replace(/\\/g, '/');
  const withoutExt = normalized.replace(/\.md$/i, '');
  const segments = withoutExt.split('/');
  const fileName = segments.at(-1);
  const dir = segments.slice(0, -1).join('/');
  const htmlFile = fileName.toLowerCase() === 'readme' ? 'README.html' : `${fileName}.html`;
  return dir ? `${dir}/${htmlFile}` : htmlFile;
}

function rewriteMdLinks(html, currentHtmlRelativePath) {
  return html.replace(/href="([^"]+)"/g, (match, href) => {
    if (
      href.startsWith('http://') ||
      href.startsWith('https://') ||
      href.startsWith('mailto:') ||
      href.startsWith('#')
    ) {
      return match;
    }

    const [pathPart, hash = ''] = href.split('#');
    if (!pathPart.endsWith('.md')) {
      return match;
    }

    const currentDir = dirname(currentHtmlRelativePath);
    const resolved = normalize(join(currentDir, pathPart)).replace(/\\/g, '/');
    const rewritten = `${mdPathToHtmlPath(resolved)}${hash ? `#${hash}` : ''}`;
    return `href="${rewritten}"`;
  });
}

function rewriteApiTreeLinksForGuide(html) {
  return html
    .replace(/href="\.\.\/guide\/en\//g, 'href="../en/')
    .replace(/href="\.\.\/guide\/ja\//g, 'href="../ja/')
    .replace(/href="\.\.\/index\.html"/g, 'href="../../index.html"');
}

function rewriteOverviewImage(html) {
  return html.replace(
    /src="\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/assets\/icon\/web-serial-rxjs-icon\.png"/g,
    'src="../../media/web-serial-rxjs-icon.png"',
  );
}

function buildNav(locale, htmlRelativePath) {
  const labels = PAGE_LABELS[locale];
  const otherLocale = locale === 'ja' ? 'en' : 'ja';
  const samePageMd = htmlRelativePath.replace(/\.html$/i, '.md').replace(/README\.md$/i, 'README.md');
  const otherHtmlPath = `../${otherLocale}/${htmlRelativePath}`;

  return `
<nav class="site-nav" aria-label="Documentation">
  <a href="README.html">${labels.guideIndex}</a>
  <a href="${otherHtmlPath}">${labels.otherLocale}</a>
  <a href="../../api/modules.html">${labels.apiReference}</a>
  <a href="../../index.html">${labels.siteTop}</a>
</nav>`;
}

function wrapPage({ title, locale, htmlRelativePath, bodyHtml }) {
  const lang = locale === 'ja' ? 'ja' : 'en';
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} | web-serial-rxjs</title>
  <style>${GUIDE_CSS}</style>
</head>
<body>
${buildNav(locale, htmlRelativePath)}
<main>
${bodyHtml}
</main>
</body>
</html>
`;
}

function extractTitle(markdown) {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : 'Guide';
}

mkdirSync(join(docsOutRoot, 'media'), { recursive: true });
copyFileSync(iconSource, iconDest);

for (const locale of LOCALES) {
  const sourceDir = join(guideSourceRoot, locale);
  const outDir = join(docsOutRoot, 'guide', locale);
  const markdownFiles = collectMarkdownFiles(sourceDir);

  for (const mdFile of markdownFiles) {
    const mdRelative = relative(sourceDir, mdFile);
    const htmlRelative = mdPathToHtmlPath(mdRelative);
    const outFile = join(outDir, htmlRelative);
    mkdirSync(dirname(outFile), { recursive: true });

    const markdown = readFileSync(mdFile, 'utf8');
    let bodyHtml = md.render(markdown);
    bodyHtml = rewriteOverviewImage(bodyHtml);
    bodyHtml = rewriteMdLinks(bodyHtml, htmlRelative);
    bodyHtml = rewriteApiTreeLinksForGuide(bodyHtml);

    const page = wrapPage({
      title: extractTitle(markdown),
      locale,
      htmlRelativePath: htmlRelative,
      bodyHtml,
    });

    writeFileSync(outFile, page, 'utf8');
  }
}

console.log(`Built guide HTML for locales: ${LOCALES.join(', ')}`);
