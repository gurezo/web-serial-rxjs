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
import { EXAMPLE_ENTRIES } from './examples-portal.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '../../..');
const examplesOutDir = join(repoRoot, 'docs/examples');
const indexPath = join(examplesOutDir, 'index.html');

const assetBase = apiAssetPrefixFromDocsPath('examples/index.html');
const dataBase = assetBase;
const title = 'web-serial-rxjs Examples';
const toolbarLinks = buildToolbarLinks({
  locale: 'en',
  guideIndexHref: '../guide/en/README.html',
  otherLocaleHref: '../guide/ja/README.html',
  apiHref: `${assetBase}index.html`,
  siteIndexHref: '../index.html',
});

const cards = EXAMPLE_ENTRIES.map(
  ({ slug, label, description }) => `<section class="card" style="border:1px solid var(--color-border);border-radius:8px;padding:1.25rem;">
<h2 style="margin:0 0 0.5rem;font-size:1.15rem;">${label}</h2>
<p style="margin:0 0 0.75rem;color:var(--color-text-secondary);">${description}</p>
<a href="${slug}/"><strong>Open ${label} example</strong></a>
</section>`,
).join('\n');

const mainContent = `<div class="col-content">
<div class="tsd-page-title"><h1>web-serial-rxjs Examples</h1></div>
<div class="tsd-panel tsd-typography">
<p class="lead">Interactive framework examples for web-serial-rxjs. Each link resolves under <code>/web-serial-rxjs/examples/</code> when published via portal.</p>
<div class="cards" style="display:grid;gap:1rem;margin-top:2rem;">
${cards}
</div>
</div>
</div>`;

const html = `${buildTypeDocHead({ title, assetBase, dataBase })}
${buildTypeDocBodyStart({
  title,
  titleHref: '../index.html',
  toolbarLinks,
  assetBase,
})}
${mainContent}
${buildTypeDocBodyEnd(assetBase)}`;

mkdirSync(examplesOutDir, { recursive: true });
writeFileSync(indexPath, html, 'utf8');
console.log(`Wrote ${indexPath}`);
