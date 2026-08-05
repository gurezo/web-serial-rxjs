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

/** Canonical public origin for the documentation site (#524). */
export const PUBLIC_DOCS_ORIGIN = 'https://gurezo.net/web-serial-rxjs';

export const DEFAULT_DOCS_DESCRIPTION = 'Documentation for web-serial-rxjs';

export function escapeHtmlAttr(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

/**
 * Build an absolute public URL from a path relative to the docs site root.
 * @param {string} canonicalPath e.g. '' | 'index.html' | 'guide/en/README.html' | 'examples/' | 'api/modules.html'
 */
export function publicDocsUrl(canonicalPath = '') {
  const normalized = String(canonicalPath).replace(/^\//, '');
  if (!normalized || normalized === 'index.html') {
    return `${PUBLIC_DOCS_ORIGIN}/`;
  }
  return `${PUBLIC_DOCS_ORIGIN}/${normalized}`;
}

/**
 * Canonical + Open Graph tags for docs fragment HTML (#524).
 */
export function buildSeoMetaTags({
  title,
  canonicalPath,
  description = DEFAULT_DOCS_DESCRIPTION,
}) {
  const canonicalUrl = publicDocsUrl(canonicalPath);
  const safeTitle = escapeHtmlAttr(title);
  const safeDescription = escapeHtmlAttr(description);
  const safeUrl = escapeHtmlAttr(canonicalUrl);

  return [
    `<link rel="canonical" href="${safeUrl}"/>`,
    `<meta property="og:title" content="${safeTitle}"/>`,
    `<meta property="og:description" content="${safeDescription}"/>`,
    `<meta property="og:url" content="${safeUrl}"/>`,
    `<meta property="og:type" content="website"/>`,
  ].join('');
}

/**
 * Inject SEO meta before `</head>`. Skips when canonical is already present.
 */
export function injectSeoMetaTags(html, options) {
  if (/rel=["']canonical["']/i.test(html)) {
    return html;
  }
  if (!/<\/head>/i.test(html)) {
    return html;
  }
  return html.replace(/<\/head>/i, `${buildSeoMetaTags(options)}</head>`);
}

export function extractHtmlTitle(html, fallback = 'web-serial-rxjs') {
  const match = html.match(/<title>([^<]*)<\/title>/i);
  if (!match) {
    return fallback;
  }
  const title = match[1].trim();
  return title || fallback;
}

export function buildToolbarLinks({
  locale,
  guideIndexHref,
  otherLocaleHref,
  apiHref,
  siteIndexHref,
}) {
  const labels = PAGE_LABELS[locale] ?? PAGE_LABELS.en;

  return `<div id="tsd-toolbar-links"><a href="${guideIndexHref}">${labels.guideIndex}</a><a href="${otherLocaleHref}">${labels.otherLocale}</a><a href="${apiHref}">${labels.apiReference}</a><a href="${siteIndexHref}">${labels.siteTop}</a></div>`;
}

export function buildTypeDocHead({
  title,
  assetBase,
  dataBase = assetBase,
  canonicalPath,
  description = DEFAULT_DOCS_DESCRIPTION,
}) {
  const seo =
    canonicalPath !== undefined
      ? buildSeoMetaTags({ title, canonicalPath, description })
      : '';

  return `<!DOCTYPE html><html class="default" lang="en" data-base="${dataBase}"><head><meta charset="utf-8"/><meta http-equiv="x-ua-compatible" content="IE=edge"/><title>${escapeHtmlAttr(title)}</title><meta name="description" content="${escapeHtmlAttr(description)}"/><meta name="viewport" content="width=device-width, initial-scale=1"/>${seo}<link rel="stylesheet" href="${assetBase}assets/style.css"/><link rel="stylesheet" href="${assetBase}assets/highlight.css"/><script defer src="${assetBase}assets/main.js"></script><script async src="${assetBase}assets/icons.js" id="tsd-icons-script"></script><script async src="${assetBase}assets/search.js" id="tsd-search-script"></script><script async src="${assetBase}assets/navigation.js" id="tsd-nav-script"></script><script async src="${assetBase}assets/hierarchy.js" id="tsd-hierarchy-script"></script><link rel="stylesheet" href="${assetBase}assets/rhineai-style.css"/></head>`;
}

export function buildTypeDocBodyStart({ title, titleHref, toolbarLinks, assetBase }) {
  return `<body><script>document.documentElement.dataset.theme = localStorage.getItem("tsd-theme") || "os";document.body.style.display="none";setTimeout(() => window.app?app.showPage():document.body.style.removeProperty("display"),500)</script><header class="tsd-page-toolbar">
<div class="tsd-toolbar-contents container"><a href="${titleHref}" class="title">${title}</a>
${toolbarLinks}<button id="tsd-search-trigger" class="tsd-widget" aria-label="Search"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><use href="${assetBase}assets/icons.svg#icon-search"></use></svg></button><dialog id="tsd-search" aria-label="Search"><input role="combobox" id="tsd-search-input" aria-controls="tsd-search-results" aria-autocomplete="list" aria-expanded="true" autocapitalize="off" autocomplete="off" placeholder="Search the docs" maxLength="100"/>
<ul role="listbox" id="tsd-search-results"></ul>
<div id="tsd-search-status" aria-live="polite" aria-atomic="true">
<div>Preparing search index...</div></div></dialog><a href="#" class="tsd-widget menu" id="tsd-toolbar-menu-trigger" data-toggle="menu" aria-label="Menu"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><use href="${assetBase}assets/icons.svg#icon-menu"></use></svg></a></div></header>
<div class="container container-main">`;
}

export function buildTypeDocBodyEnd(assetPrefix) {
  return `<div class="col-sidebar"><div class="page-menu">
<div class="tsd-navigation settings"><details class="tsd-accordion"><summary class="tsd-accordion-summary"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><use href="${assetPrefix}assets/icons.svg#icon-chevronDown"></use></svg><h3>Settings</h3></summary><div class="tsd-accordion-details"><div class="tsd-filter-visibility"><span class="settings-label">Member Visibility</span><ul id="tsd-filter-options"><li class="tsd-filter-item"><label class="tsd-filter-input"><input type="checkbox" id="tsd-filter-protected" name="protected"/><svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true"><rect class="tsd-checkbox-background" width="30" height="30" x="1" y="1" rx="6" fill="none"></rect><path class="tsd-checkbox-checkmark" d="M8.35422 16.8214L13.2143 21.75L24.6458 10.25" stroke="none" stroke-width="3.5" stroke-linejoin="round" fill="none"></path></svg><span>Protected</span></label></li><li class="tsd-filter-item"><label class="tsd-filter-input"><input type="checkbox" id="tsd-filter-inherited" name="inherited" checked/><svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true"><rect class="tsd-checkbox-background" width="30" height="30" x="1" y="1" rx="6" fill="none"></rect><path class="tsd-checkbox-checkmark" d="M8.35422 16.8214L13.2143 21.75L24.6458 10.25" stroke="none" stroke-width="3.5" stroke-linejoin="round" fill="none"></path></svg><span>Inherited</span></label></li><li class="tsd-filter-item"><label class="tsd-filter-input"><input type="checkbox" id="tsd-filter-external" name="external"/><svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true"><rect class="tsd-checkbox-background" width="30" height="30" x="1" y="1" rx="6" fill="none"></rect><path class="tsd-checkbox-checkmark" d="M8.35422 16.8214L13.2143 21.75L24.6458 10.25" stroke="none" stroke-width="3.5" stroke-linejoin="round" fill="none"></path></svg><span>External</span></label></li></ul></div><div class="tsd-theme-toggle"><span class="settings-label">Theme</span><select id="tsd-theme"><option value="os">OS</option><option value="light">Light</option><option value="dark">Dark</option></select></div></div></details></div>
<div class="site-menu"><nav class="tsd-navigation"><ul class="tsd-small-nested-navigation" id="tsd-nav-container"><li>Loading...</li></ul></nav></div></div></div></div><footer></footer><div class="overlay"></div></body></html>`;
}
