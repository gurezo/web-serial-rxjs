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

const GITHUB_REPO = 'https://github.com/gurezo/web-serial-rxjs';

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
  ({ slug, label, description, audience, recommended, highlights, appDir }) => {
    const badge = recommended
      ? `<span style="display:inline-block;margin-left:0.5rem;padding:0.15rem 0.5rem;font-size:0.75rem;font-weight:600;border:1px solid var(--color-accent);border-radius:4px;color:var(--color-accent);vertical-align:middle;">Recommended / まずはこちら</span>`
      : '';
    const purpose = audience || description;
    const highlightsList =
      Array.isArray(highlights) && highlights.length > 0
        ? `<p style="margin:0 0 0.35rem;font-size:0.9rem;"><strong>What you will see</strong></p>
<ul style="margin:0 0 0.75rem;padding-left:1.25rem;color:var(--color-text-secondary);font-size:0.9rem;">
${highlights.map((item) => `<li>${item}</li>`).join('\n')}
</ul>`
        : '';
    const sourceHref = `${GITHUB_REPO}/tree/main/${appDir}`;
    return `<section class="card" style="border:1px solid var(--color-border);border-radius:8px;padding:1.25rem;">
<h2 style="margin:0 0 0.5rem;font-size:1.15rem;">${label}${badge}</h2>
<p style="margin:0 0 0.75rem;color:var(--color-text-secondary);">${purpose}</p>
${highlightsList}
<p style="margin:0;">
<a href="${slug}/"><strong>Open example</strong></a>
<span style="margin:0 0.5rem;color:var(--color-text-secondary);">·</span>
<a href="${sourceHref}"><strong>View source</strong></a>
</p>
</section>`;
  },
).join('\n');

const mainContent = `<div class="col-content">
<div class="tsd-page-title"><h1>web-serial-rxjs Examples</h1></div>
<div class="tsd-panel tsd-typography">
<p class="lead">Interactive framework examples for web-serial-rxjs. Each link resolves under <code>/web-serial-rxjs/examples/</code> when published via portal. These apps demonstrate <strong>framework wiring</strong> for <code>SerialSession</code> — they are <strong>not</strong> a supported-device catalog.</p>

<h2>Recipes vs Examples</h2>
<ul>
<li><strong>Examples</strong> (this page): interactive demos of how to wire <code>SerialSession</code> in Angular, React, Vue, Svelte, or Vanilla JS/TS.</li>
<li><strong>Recipes</strong>: Guide index by <strong>communication pattern</strong> (line protocol, command/reply, timeout, and so on) — not by device brand. Prefer Recipes when you know the pattern you need.</li>
</ul>
<p style="margin:0 0 1.25rem;">Open Recipes: <a href="../guide/en/recipes.html">English</a> · <a href="../guide/ja/recipes.html">日本語</a>.</p>

<h2>Which example should I start with?</h2>
<ul>
<li><strong>New to the library?</strong> Start with <strong>Vanilla TS</strong> (Recommended / まずはこちら). It shows <code>SerialSession</code> with TypeScript and RxJS and no UI framework.</li>
<li><strong>Prefer plain JavaScript?</strong> Use <strong>Vanilla JS</strong> for the same flow without TypeScript.</li>
<li><strong>Building with a framework?</strong> Pick the example that matches your stack (React hook, Vue Composition API, Angular Service, or Svelte Store).</li>
</ul>

<section class="card" style="border:1px solid var(--color-border);border-radius:8px;padding:1.25rem;margin:1.25rem 0;background:var(--color-background-secondary, transparent);">
<p style="margin:0 0 0.5rem;"><strong>Requirements</strong></p>
<ul style="margin:0;padding-left:1.25rem;">
<li>Serve the page over <strong>HTTPS</strong> or <strong>localhost</strong> (secure context).</li>
<li>Call <code>connect$()</code> from a <strong>user gesture</strong> (for example a button click). The browser will not open the port picker otherwise.</li>
<li>Web Serial works on <strong>desktop</strong> browsers only (Chrome 89+, Edge 89+, Opera 75+, Firefox 151+). Mobile browsers and Safari are not supported. You need a serial device (or compatible adapter) to exercise real I/O.</li>
</ul>
<p style="margin:0.75rem 0 0;color:var(--color-text-secondary);">Stuck? See <a href="../guide/en/troubleshooting.html">Troubleshooting (English)</a> · <a href="../guide/ja/troubleshooting.html">トラブルシューティング（日本語）</a>.</p>
</section>

<div class="cards" style="display:grid;gap:1rem;margin-top:2rem;">
${cards}
</div>
</div>
</div>`;

const html = `${buildTypeDocHead({
  title,
  assetBase,
  dataBase,
  canonicalPath: 'examples/',
})}
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
