/**
 * Maps TypeDoc projectDocument output filenames to guide paths under docs/.
 * TypeDoc emits `{locale}_{slug}.html` (e.g. en_README.html, ja_archive_migration-phase5.html).
 */

const TYPEDOC_DOC_PATTERN = /^(en|ja)_(.+)\.html$/;

export function typedocFilenameToGuideRelPath(filename) {
  const match = filename.match(TYPEDOC_DOC_PATTERN);
  if (!match) {
    return null;
  }

  const [, locale, slug] = match;
  let pagePath;
  if (slug.startsWith('archive_')) {
    pagePath = `${slug.replace(/^archive_/, 'archive/')}.html`;
  } else {
    pagePath = `${slug}.html`;
  }

  return {
    locale,
    pagePath,
    guideRelPath: `guide/${locale}/${pagePath}`,
  };
}

export function apiAssetPrefixFromDocsPath(docsRelPath) {
  const depth = docsRelPath.split('/').length - 1;
  return depth === 0 ? 'api/' : `${'../'.repeat(depth)}api/`;
}

export function guideApiDataBase(guideRelPath) {
  return apiAssetPrefixFromDocsPath(guideRelPath);
}

export function buildDocumentUrlMap() {
  const map = new Map();
  const entries = [
    ['en_README.html', 'guide/en/README.html'],
    ['en_overview.html', 'guide/en/overview.html'],
    ['en_quick-start.html', 'guide/en/quick-start.html'],
    ['en_advanced-usage.html', 'guide/en/advanced-usage.html'],
    ['en_concepts.html', 'guide/en/concepts.html'],
    ['en_migration-v2.html', 'guide/en/migration-v2.html'],
    ['en_migration-v3.html', 'guide/en/migration-v3.html'],
    ['en_archive_migration-phase5.html', 'guide/en/archive/migration-phase5.html'],
    ['ja_README.html', 'guide/ja/README.html'],
    ['ja_overview.html', 'guide/ja/overview.html'],
    ['ja_quick-start.html', 'guide/ja/quick-start.html'],
    ['ja_advanced-usage.html', 'guide/ja/advanced-usage.html'],
    ['ja_concepts.html', 'guide/ja/concepts.html'],
    ['ja_migration-v2.html', 'guide/ja/migration-v2.html'],
    ['ja_migration-v3.html', 'guide/ja/migration-v3.html'],
    ['ja_archive_migration-phase5.html', 'guide/ja/archive/migration-phase5.html'],
  ];

  for (const [typedocName, guidePath] of entries) {
    map.set(`documents/${typedocName}`, `../${guidePath}`);
  }

  return map;
}

export function rewriteTypedocDocumentHref(href, currentLocale, currentPagePath) {
  const match = href.match(TYPEDOC_DOC_PATTERN);
  if (!match) {
    return href;
  }

  const [, locale, slug] = match;
  const target = typedocFilenameToGuideRelPath(`${locale}_${slug}.html`);
  if (!target) {
    return href;
  }

  const currentDir = currentPagePath.includes('/')
    ? currentPagePath.slice(0, currentPagePath.lastIndexOf('/'))
    : '';
  const targetDir = target.pagePath.includes('/')
    ? target.pagePath.slice(0, target.pagePath.lastIndexOf('/'))
    : '';

  if (locale === currentLocale) {
    if (currentDir === targetDir) {
      return target.pagePath.slice(targetDir.length + (targetDir ? 1 : 0));
    }
    if (!currentDir && targetDir) {
      return target.pagePath;
    }
    if (currentDir && !targetDir) {
      return `../${target.pagePath}`;
    }
    return `../${target.pagePath}`;
  }

  const up = currentPagePath.includes('/') ? '../../' : '../';
  return `${up}${locale}/${target.pagePath}`;
}
