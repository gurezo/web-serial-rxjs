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
<p class="lead"><strong>web-serial-rxjs</strong> wraps the Web Serial API with a minimal, session-oriented RxJS <code>SerialSession</code> so apps can connect, send/receive, and drive UI from <code>state$</code> and <code>errors$</code>.</p>

<h2>Get started</h2>
<ol>
<li>Install the package</li>
<li>Create a <code>SerialSession</code></li>
<li>Connect from a user action</li>
<li>Receive and send data</li>
</ol>

<section class="card" style="border:1px solid var(--color-border);border-radius:8px;padding:1.25rem;margin:1.25rem 0;background:var(--color-background-secondary, transparent);">
<p style="margin:0 0 0.5rem;"><strong>Requirements</strong></p>
<ul style="margin:0;padding-left:1.25rem;">
<li>Serve the page over <strong>HTTPS</strong> or <strong>localhost</strong> (secure context).</li>
<li>Call <code>connect$()</code> from a <strong>user gesture</strong> (for example a button click). The browser will not open the port picker otherwise.</li>
</ul>
</section>

<pre><code class="language-bash">npm install @gurezo/web-serial-rxjs rxjs</code></pre>
<pre><code class="language-typescript">import { createSerialSession } from '@gurezo/web-serial-rxjs';

const session = createSerialSession({ baudRate: 115200 });

// Wire this to a button click (user gesture required)
document.getElementById('connect')?.addEventListener('click', () => {
  session.connect$().subscribe({
    error: (e) => console.error(e),
  });
});

session.lines$.subscribe((line) => console.log(line));
</code></pre>
<p style="color:var(--color-text-secondary);">Full walkthrough: <a href="guide/en/quick-start.html">Quick Start (English)</a> · <a href="guide/ja/quick-start.html">クイックスタート（日本語）</a></p>

<div class="cards" style="display:grid;gap:1rem;margin-top:2rem;">
<section class="card" style="border:1px solid var(--color-border);border-radius:8px;padding:1.25rem;">
<h2 style="margin:0 0 0.5rem;font-size:1.15rem;">Quick Start</h2>
<p style="margin:0 0 0.75rem;color:var(--color-text-secondary);">Shortest path: install, connect from a user action, receive lines, send, and disconnect.</p>
<p style="margin:0;"><a href="guide/en/quick-start.html"><strong>English Quick Start</strong></a> · <a href="guide/ja/quick-start.html"><strong>日本語クイックスタート</strong></a></p>
</section>
<section class="card" style="border:1px solid var(--color-border);border-radius:8px;padding:1.25rem;">
<h2 style="margin:0 0 0.5rem;font-size:1.15rem;">Examples</h2>
<p style="margin:0 0 0.75rem;color:var(--color-text-secondary);">Interactive Angular, React, Svelte, Vue, and Vanilla JS/TS examples using SerialSession.</p>
<a href="examples/"><strong>Open Examples</strong></a>
</section>
<section class="card" style="border:1px solid var(--color-border);border-radius:8px;padding:1.25rem;">
<h2 style="margin:0 0 0.5rem;font-size:1.15rem;">API Reference (English / TypeDoc)</h2>
<p style="margin:0 0 0.75rem;color:var(--color-text-secondary);">Exported classes, interfaces, types, methods, and API contracts from TypeScript JSDoc.</p>
<a href="${assetBase}index.html"><strong>Open API Reference</strong></a>
</section>
<section class="card" style="border:1px solid var(--color-border);border-radius:8px;padding:1.25rem;">
<h2 style="margin:0 0 0.5rem;font-size:1.15rem;">Troubleshooting</h2>
<p style="margin:0 0 0.75rem;color:var(--color-text-secondary);">Port picker, secure context, subscribe pitfalls, line endings, reconnect, and SerialError checks.</p>
<p style="margin:0;"><a href="guide/en/troubleshooting.html"><strong>English Troubleshooting</strong></a> · <a href="guide/ja/troubleshooting.html"><strong>日本語トラブルシューティング</strong></a></p>
</section>
</div>

<h2 style="margin-top:2.5rem;">Guides</h2>
<p style="color:var(--color-text-secondary);">Recommended reading order (overview → quick start → advanced → concepts) and migration notes.</p>
<div class="cards" style="display:grid;gap:1rem;margin-top:1rem;">
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
