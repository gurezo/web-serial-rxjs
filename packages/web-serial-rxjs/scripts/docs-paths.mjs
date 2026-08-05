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

/** Guide page paths relative to guide/{locale}/ (archive uses slash). */
const GUIDE_PAGE_PATHS = [
  'README.html',
  'overview.html',
  'quick-start.html',
  'advanced-usage.html',
  'concepts.html',
  'troubleshooting.html',
  'migration-v2.html',
  'migration-v3.html',
  'migration-v4.html',
  'archive/migration-phase5.html',
];

export function buildDocumentUrlMap() {
  const map = new Map();
  const locales = ['en', 'ja'];

  for (const locale of locales) {
    for (const pagePath of GUIDE_PAGE_PATHS) {
      const typedocSlug = pagePath.replace(/\.html$/, '').replaceAll('/', '_');
      const typedocName = `${locale}_${typedocSlug}.html`;
      const guidePath = `guide/${locale}/${pagePath}`;
      map.set(`documents/${typedocName}`, `../${guidePath}`);
    }
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
