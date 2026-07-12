import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '../../..');
const docsOutRoot = join(repoRoot, 'docs');
const indexPath = join(docsOutRoot, 'index.html');

const INDEX_CSS = `
:root {
  color-scheme: light dark;
  --text: #1a1a1a;
  --muted: #555;
  --border: #d8d8d8;
  --bg: #fff;
  --card-bg: #f8f8f8;
  --link: #0969da;
}
@media (prefers-color-scheme: dark) {
  :root {
    --text: #e6edf3;
    --muted: #9da7b3;
    --border: #30363d;
    --bg: #0d1117;
    --card-bg: #161b22;
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
main {
  max-width: 48rem;
  margin: 0 auto;
  padding: 2.5rem 1.25rem 4rem;
}
h1 { line-height: 1.2; margin-bottom: 0.5rem; }
p.lead { color: var(--muted); margin-top: 0; }
.cards {
  display: grid;
  gap: 1rem;
  margin-top: 2rem;
}
.card {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 1.25rem;
  background: var(--card-bg);
}
.card h2 { margin: 0 0 0.5rem; font-size: 1.15rem; }
.card p { margin: 0 0 0.75rem; color: var(--muted); }
.card a {
  color: var(--link);
  text-decoration: none;
  font-weight: 600;
}
.card a:hover { text-decoration: underline; }
`;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>web-serial-rxjs Documentation</title>
  <style>${INDEX_CSS}</style>
</head>
<body>
<main>
  <h1>web-serial-rxjs Documentation</h1>
  <p class="lead">
    Guides explain how to use the library. The API Reference documents the public TypeScript API (English TypeDoc).
  </p>
  <div class="cards">
    <section class="card">
      <h2>日本語 Guide</h2>
      <p>インストール、接続フロー、ライフサイクル、エラーハンドリングなどの利用ガイド。</p>
      <a href="guide/ja/README.html">日本語 Guide を開く</a>
    </section>
    <section class="card">
      <h2>English Guide</h2>
      <p>Installation, connection flow, lifecycle, error handling, and usage patterns.</p>
      <a href="guide/en/README.html">Open English Guide</a>
    </section>
    <section class="card">
      <h2>API Reference (English / TypeDoc)</h2>
      <p>Exported classes, interfaces, types, methods, and API contracts from TypeScript JSDoc.</p>
      <a href="api/index.html">Open API Reference</a>
    </section>
  </div>
</main>
</body>
</html>
`;

mkdirSync(docsOutRoot, { recursive: true });
writeFileSync(indexPath, html, 'utf8');
console.log(`Wrote ${indexPath}`);
