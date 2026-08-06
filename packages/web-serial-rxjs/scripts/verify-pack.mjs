/**
 * Verify the npm tarball from a consumer perspective (Issue #543).
 *
 * Responsibility split with verify-dist.mjs:
 * - verify:dist — post-build dist artifacts and public API allowlist
 * - verify:pack — packed tarball contents, package metadata, README, links
 *   (and optionally consumer ESM/types smoke via tools/package-smoke-test)
 *
 * Post-publish npm registry smoke is intentionally out of scope; see RELEASING.md.
 */

import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { REMOVED_SESSION_APIS } from './public-api-allowlist.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageRoot = join(__dirname, '..');
const workspaceRoot = join(packageRoot, '../..');
const require = createRequire(import.meta.url);

const REQUIRED_FILES = [
  'README.md',
  'README.ja.md',
  'LICENSE',
  'dist/index.mjs',
  'dist/index.d.ts',
  'package.json',
];

const FORBIDDEN_PREFIXES = ['src/', 'tests/', 'docs/', 'scripts/'];

const EXPECTED_NAME = '@gurezo/web-serial-rxjs';
const EXPECTED_HOMEPAGE = 'https://gurezo.net/web-serial-rxjs/';
const EXPECTED_BUGS = 'https://github.com/gurezo/web-serial-rxjs/issues';
const EXPECTED_REPO_SUBSTRING = 'github.com/gurezo/web-serial-rxjs';

const REMOVAL_CONTEXT_RE = /Removed|削除|Migrat|移行|replacements|置換/i;

/** Major URLs that must respond (docs site / GitHub / homepage). */
const MAJOR_LINK_HOST_ALLOWLIST = [
  'gurezo.net',
  'github.com',
  'raw.githubusercontent.com',
  'wicg.github.io',
];

function fail(message) {
  console.error(message);
  process.exit(1);
}

function listFilesRecursive(dir, base = dir) {
  const entries = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const rel = relative(base, full).split(sep).join('/');
    if (statSync(full).isDirectory()) {
      entries.push(...listFilesRecursive(full, base));
    } else {
      entries.push(rel);
    }
  }
  return entries;
}

function runNpmPack() {
  const output = execFileSync('npm', ['pack', '--json'], {
    cwd: packageRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const parsed = JSON.parse(output);
  const filename = parsed[0]?.filename;
  if (!filename) {
    fail('npm pack did not return a filename');
  }
  const tarballPath = join(packageRoot, filename);
  if (!existsSync(tarballPath)) {
    fail(`npm pack tarball missing: ${tarballPath}`);
  }
  return tarballPath;
}

function extractTarball(tarballPath, extractRoot) {
  execFileSync('tar', ['-xzf', tarballPath, '-C', extractRoot], {
    stdio: 'inherit',
  });
  const packageDir = join(extractRoot, 'package');
  if (!existsSync(packageDir)) {
    fail(`Expected extracted package directory at ${packageDir}`);
  }
  return packageDir;
}

function assertRequiredFiles(packageDir, files) {
  const missing = REQUIRED_FILES.filter((path) => !files.includes(path));
  if (missing.length > 0) {
    fail(`Missing required files in npm pack: ${missing.join(', ')}`);
  }
  console.log('Verified required publish files are present in the tarball.');
}

function assertNoForbiddenPaths(files) {
  const forbidden = files.filter((path) =>
    FORBIDDEN_PREFIXES.some(
      (prefix) => path === prefix.slice(0, -1) || path.startsWith(prefix),
    ),
  );
  if (forbidden.length > 0) {
    fail(
      `Forbidden paths found in npm pack (should not be published):\n${forbidden
        .map((p) => `  - ${p}`)
        .join('\n')}`,
    );
  }
  console.log('Verified tarball does not include src/tests/docs/scripts.');
}

function assertPackageMetadata(packageDir) {
  const pkg = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'));

  if (pkg.name !== EXPECTED_NAME) {
    fail(`package.json name mismatch: actual=${pkg.name} expected=${EXPECTED_NAME}`);
  }
  if (pkg.homepage !== EXPECTED_HOMEPAGE) {
    fail(
      `package.json homepage mismatch: actual=${pkg.homepage} expected=${EXPECTED_HOMEPAGE}`,
    );
  }
  const repoUrl = pkg.repository?.url ?? '';
  if (!repoUrl.includes(EXPECTED_REPO_SUBSTRING)) {
    fail(
      `package.json repository.url must include ${EXPECTED_REPO_SUBSTRING}; got: ${repoUrl}`,
    );
  }
  if (pkg.bugs?.url !== EXPECTED_BUGS) {
    fail(
      `package.json bugs.url mismatch: actual=${pkg.bugs?.url} expected=${EXPECTED_BUGS}`,
    );
  }

  console.log('Verified package.json name, homepage, repository, and bugs URLs.');
  return pkg;
}

function assertVersionMatchesTag(pkg) {
  const refType = process.env.GITHUB_REF_TYPE;
  const refName = process.env.GITHUB_REF_NAME;

  if (refType !== 'tag' || !refName) {
    console.log(
      'Skipped package version ↔ Git tag check (not a tag CI run).',
    );
    return;
  }

  if (!/^v\d+\.\d+\.\d+/.test(refName)) {
    fail(`Unexpected tag name for version check: ${refName}`);
  }

  const expectedVersion = refName.slice(1);
  if (pkg.version !== expectedVersion) {
    fail(
      `package.json version (${pkg.version}) does not match Git tag ${refName} (expected ${expectedVersion})`,
    );
  }
  console.log(`Verified package version ${pkg.version} matches tag ${refName}.`);
}

function splitMarkdownSegments(source) {
  const segments = [];
  const fenceRe = /```[\s\S]*?```/g;
  let lastIndex = 0;
  let match;
  while ((match = fenceRe.exec(source)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        kind: 'prose',
        text: source.slice(lastIndex, match.index),
      });
    }
    segments.push({ kind: 'code', text: match[0] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < source.length) {
    segments.push({ kind: 'prose', text: source.slice(lastIndex) });
  }
  return segments;
}

function assertRemovedApisNotMisdocumented(packageDir) {
  const readmeNames = ['README.md', 'README.ja.md'];
  const apiPatterns = REMOVED_SESSION_APIS.map((name) => ({
    name,
    // Match API identifiers; allow optional () for function-style names.
    re: new RegExp(
      String.raw`\b${name.replace(/\$/g, '\\$')}(?:\s*\(\s*\))?`,
      'g',
    ),
  }));

  for (const readmeName of readmeNames) {
    const source = readFileSync(join(packageDir, readmeName), 'utf8');
    const segments = splitMarkdownSegments(source);

    for (const segment of segments) {
      for (const { name, re } of apiPatterns) {
        re.lastIndex = 0;
        if (!re.test(segment.text)) continue;

        if (segment.kind === 'code') {
          fail(
            `${readmeName}: removed API "${name}" must not appear inside fenced code blocks`,
          );
        }

        // Prose: require removal/migration context in the same paragraph.
        const paragraphs = segment.text.split(/\n{2,}/);
        for (const paragraph of paragraphs) {
          re.lastIndex = 0;
          if (!re.test(paragraph)) continue;
          if (!REMOVAL_CONTEXT_RE.test(paragraph)) {
            fail(
              `${readmeName}: removed API "${name}" appears without removal/migration context:\n${paragraph.trim().slice(0, 200)}`,
            );
          }
        }
      }
    }
  }

  console.log(
    'Verified package README does not present removed APIs as current usage.',
  );
}

function extractMarkdownLinks(source) {
  const links = [];
  const mdLinkRe = /\[([^\]]*)\]\(([^)]+)\)/g;
  let match;
  while ((match = mdLinkRe.exec(source)) !== null) {
    links.push(match[2].trim());
  }
  const hrefRe = /href="([^"]+)"/gi;
  while ((match = hrefRe.exec(source)) !== null) {
    links.push(match[1].trim());
  }
  const srcRe = /src="([^"]+)"/gi;
  while ((match = srcRe.exec(source)) !== null) {
    links.push(match[1].trim());
  }
  return links;
}

function assertRelativeLinksResolve(packageDir, readmeName, links) {
  for (const href of links) {
    if (
      !href ||
      href.startsWith('#') ||
      href.startsWith('http://') ||
      href.startsWith('https://') ||
      href.startsWith('mailto:')
    ) {
      continue;
    }

    const pathPart = href.split('#')[0].split('?')[0];
    if (!pathPart) continue;

    const resolved = resolve(packageDir, pathPart);
    const rel = relative(packageDir, resolved);
    if (rel.startsWith('..') || !existsSync(resolved)) {
      fail(
        `${readmeName}: relative link does not resolve inside the npm tarball: ${href}`,
      );
    }
  }
}

async function assertMajorHttpsLinks(links) {
  const unique = [
    ...new Set(
      links.filter((href) => href.startsWith('https://')).map((href) => {
        try {
          const url = new URL(href);
          // Drop fragment for fetch
          url.hash = '';
          return url.toString();
        } catch {
          return href;
        }
      }),
    ),
  ];

  const major = unique.filter((href) => {
    try {
      const host = new URL(href).hostname;
      return MAJOR_LINK_HOST_ALLOWLIST.some(
        (allowed) => host === allowed || host.endsWith(`.${allowed}`),
      );
    } catch {
      return false;
    }
  });

  const failures = [];
  for (const href of major) {
    try {
      let response = await fetch(href, { method: 'HEAD', redirect: 'follow' });
      if (response.status === 405 || response.status === 403) {
        response = await fetch(href, { method: 'GET', redirect: 'follow' });
      }
      if (!response.ok) {
        failures.push(`${href} → HTTP ${response.status}`);
      }
    } catch (error) {
      failures.push(`${href} → ${error.message}`);
    }
  }

  if (failures.length > 0) {
    fail(
      `Major documentation / package links failed:\n${failures
        .map((f) => `  - ${f}`)
        .join('\n')}`,
    );
  }

  console.log(`Verified ${major.length} major https link(s) respond successfully.`);
}

async function assertReadmeLinks(packageDir) {
  for (const readmeName of ['README.md', 'README.ja.md']) {
    const source = readFileSync(join(packageDir, readmeName), 'utf8');
    const links = extractMarkdownLinks(source);
    assertRelativeLinksResolve(packageDir, readmeName, links);
    await assertMajorHttpsLinks(links);
  }
  console.log('Verified package README relative links resolve inside the tarball.');
}

async function maybeRunSmoke(tarballPath) {
  const smokeDir = join(workspaceRoot, 'tools/package-smoke-test');
  const smokeEntry = join(smokeDir, 'run-smoke.mjs');
  if (!existsSync(smokeEntry)) {
    console.log(
      'Skipped package smoke fixture (tools/package-smoke-test/run-smoke.mjs not present yet).',
    );
    return;
  }

  const { runPackageSmoke } = await import(pathToFileURL(smokeEntry).href);
  await runPackageSmoke(tarballPath);
}

function cleanup(paths) {
  for (const path of paths) {
    try {
      if (existsSync(path)) {
        rmSync(path, { recursive: true, force: true });
      }
    } catch {
      // best-effort cleanup
    }
  }
}

async function main() {
  if (!existsSync(join(packageRoot, 'dist/index.mjs'))) {
    fail(
      'dist/index.mjs is missing; run `pnpm exec nx build web-serial-rxjs` before verify-pack',
    );
  }

  const extractRoot = mkdtempSync(join(tmpdir(), 'web-serial-rxjs-pack-'));
  let tarballPath;

  try {
    tarballPath = runNpmPack();
    console.log(`Created tarball: ${relative(workspaceRoot, tarballPath)}`);

    const packageDir = extractTarball(tarballPath, extractRoot);
    const files = listFilesRecursive(packageDir);

    assertRequiredFiles(packageDir, files);
    assertNoForbiddenPaths(files);
    const pkg = assertPackageMetadata(packageDir);
    assertVersionMatchesTag(pkg);
    assertRemovedApisNotMisdocumented(packageDir);
    await assertReadmeLinks(packageDir);
    await maybeRunSmoke(tarballPath);

    console.log('verify:pack completed successfully.');
  } finally {
    cleanup([extractRoot, tarballPath].filter(Boolean));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
