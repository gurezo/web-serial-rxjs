import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { apiAssetPrefixFromDocsPath } from './docs-paths.mjs';
import {
  buildToolbarLinks,
  buildTypeDocBodyEnd,
  buildTypeDocBodyStart,
  buildTypeDocHead,
} from './docs-theme.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '../../..');
const docsOutRoot = join(repoRoot, 'docs');
const indexPath = join(docsOutRoot, 'index.html');

const assetBase = apiAssetPrefixFromDocsPath('index.html');
const dataBase = assetBase;
const title = 'web-serial-rxjs Documentation';
const toolbarLinks = buildToolbarLinks({
  locale: 'en',
  guideIndexHref: 'guide/en/README.html',
  otherLocaleHref: 'guide/ja/README.html',
  apiHref: `${assetBase}index.html`,
  siteIndexHref: 'index.html',
});

const mainContent = `<div class="col-content">
<div class="tsd-page-title"><h1>web-serial-rxjs Documentation</h1></div>
<div class="tsd-panel tsd-typography">
<p class="lead">Guides explain how to use the library. The API Reference documents the public TypeScript API (English TypeDoc).</p>
<div class="cards" style="display:grid;gap:1rem;margin-top:2rem;">
<section class="card" style="border:1px solid var(--color-border);border-radius:8px;padding:1.25rem;">
<h2 style="margin:0 0 0.5rem;font-size:1.15rem;">日本語 Guide</h2>
<p style="margin:0 0 0.75rem;color:var(--color-text-secondary);">インストール、接続フロー、ライフサイクル、エラーハンドリングなどの利用ガイド。</p>
<a href="guide/ja/README.html"><strong>日本語 Guide を開く</strong></a>
</section>
<section class="card" style="border:1px solid var(--color-border);border-radius:8px;padding:1.25rem;">
<h2 style="margin:0 0 0.5rem;font-size:1.15rem;">English Guide</h2>
<p style="margin:0 0 0.75rem;color:var(--color-text-secondary);">Installation, connection flow, lifecycle, error handling, and usage patterns.</p>
<a href="guide/en/README.html"><strong>Open English Guide</strong></a>
</section>
<section class="card" style="border:1px solid var(--color-border);border-radius:8px;padding:1.25rem;">
<h2 style="margin:0 0 0.5rem;font-size:1.15rem;">API Reference (English / TypeDoc)</h2>
<p style="margin:0 0 0.75rem;color:var(--color-text-secondary);">Exported classes, interfaces, types, methods, and API contracts from TypeScript JSDoc.</p>
<a href="${assetBase}index.html"><strong>Open API Reference</strong></a>
</section>
</div>
</div>
</div>`;

const html = `${buildTypeDocHead({ title, assetBase, dataBase })}
${buildTypeDocBodyStart({
  title,
  titleHref: 'index.html',
  toolbarLinks,
  assetBase,
})}
${mainContent}
${buildTypeDocBodyEnd(assetBase)}`;

mkdirSync(docsOutRoot, { recursive: true });
writeFileSync(indexPath, html, 'utf8');
console.log(`Wrote ${indexPath}`);
