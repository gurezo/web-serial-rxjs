/**
 * Measure library-only bundle size and tree-shaking for @gurezo/web-serial-rxjs.
 *
 * Prerequisites:
 *   pnpm --filter @gurezo/web-serial-rxjs build
 *
 * Usage (from repo root):
 *   node tools/bundle-size/measure.mjs
 *
 * Notes:
 * - Primary numbers are library-only (rxjs is external / not bundled).
 * - Does not enforce size budgets; prints reproducible snapshots for docs.
 */

import {
  brotliCompressSync,
  constants as zlibConstants,
  gzipSync,
} from 'node:zlib';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '../..');
const packageRoot = join(repoRoot, 'packages/web-serial-rxjs');
const distEntry = join(packageRoot, 'dist/index.mjs');
const packageJsonPath = join(packageRoot, 'package.json');
const outDir = join(__dirname, '.out');

// Resolve workspace esbuild (this tool is outside the pnpm workspace).
const require = createRequire(join(repoRoot, 'package.json'));
const { build } = require('esbuild');
const esbuildPkg = require('esbuild/package.json');

function formatBytes(bytes) {
  return `${bytes.toLocaleString('en-US')} B`;
}

function compressedSizes(buffer) {
  const gzip = gzipSync(buffer, { level: 9 });
  const brotli = brotliCompressSync(buffer, {
    params: {
      [zlibConstants.BROTLI_PARAM_QUALITY]: 11,
    },
  });
  return {
    gzipBytes: gzip.byteLength,
    brotliBytes: brotli.byteLength,
  };
}

function directoryByteSize(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      total += directoryByteSize(full);
    } else if (entry.isFile()) {
      total += statSync(full).size;
    }
  }
  return total;
}

function measureNpmPackUnpacked() {
  const staging = mkdtempSync(join(tmpdir(), 'web-serial-rxjs-pack-'));
  try {
    const packJson = execFileSync('npm', ['pack', '--json', '--silent'], {
      cwd: packageRoot,
      encoding: 'utf8',
    });
    const parsed = JSON.parse(packJson);
    const entry = Array.isArray(parsed) ? parsed[0] : parsed;
    const tarballName = entry.filename;
    const tarballPath = join(packageRoot, tarballName);
    if (!existsSync(tarballPath)) {
      throw new Error(`npm pack did not produce ${tarballPath}`);
    }

    const packedCopy = join(staging, tarballName);
    copyFileSync(tarballPath, packedCopy);
    rmSync(tarballPath, { force: true });

    execFileSync('tar', ['-xzf', packedCopy, '-C', staging], {
      stdio: 'pipe',
    });
    const unpackedRoot = join(staging, 'package');
    if (!existsSync(unpackedRoot)) {
      throw new Error('npm pack tarball missing package/ directory');
    }

    return {
      tarballBytes: entry.size,
      unpackedBytes: directoryByteSize(unpackedRoot),
      fileCount: entry.entryCount ?? null,
    };
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

async function buildConsumerFixture({
  name,
  source,
  minify,
  absWorkingDir,
}) {
  mkdirSync(outDir, { recursive: true });
  const entryPath = join(outDir, `${name}.entry.mjs`);
  const outfile = join(outDir, `${name}${minify ? '.min' : ''}.mjs`);
  writeFileSync(entryPath, source, 'utf8');

  await build({
    absWorkingDir,
    entryPoints: [entryPath],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: ['es2020'],
    outfile,
    minify,
    // Keep library size separate from the RxJS peer dependency.
    external: ['rxjs'],
    write: true,
    logLevel: 'silent',
  });

  const buffer = readFileSync(outfile);
  const { gzipBytes, brotliBytes } = compressedSizes(buffer);
  return {
    name,
    minify,
    outfile: relative(repoRoot, outfile),
    bytes: buffer.byteLength,
    gzipBytes,
    brotliBytes,
    text: buffer.toString('utf8'),
  };
}

function ensureConsumerNodeModules() {
  const nmScoped = join(outDir, 'node_modules/@gurezo');
  const linkPath = join(nmScoped, 'web-serial-rxjs');
  mkdirSync(nmScoped, { recursive: true });
  rmSync(linkPath, { recursive: true, force: true });
  // Symlink the package root so package.json (sideEffects, exports) is honored.
  execFileSync('ln', ['-s', packageRoot, linkPath]);
  return outDir;
}

function assertTreeShaken(minifiedText) {
  const forbidden = [
    'createTerminalBuffer',
    'DEFAULT_TERMINAL_BUFFER_OPTIONS',
    'SerialErrorCode',
  ];
  const present = forbidden.filter((symbol) => minifiedText.includes(symbol));
  return {
    ok: present.length === 0,
    present,
    checked: forbidden,
  };
}

function printRow(label, sizes) {
  console.log(
    `  ${label.padEnd(28)} raw=${formatBytes(sizes.bytes).padStart(12)}  gzip=${formatBytes(sizes.gzipBytes).padStart(12)}  brotli=${formatBytes(sizes.brotliBytes).padStart(12)}`,
  );
}

async function main() {
  if (!existsSync(distEntry)) {
    throw new Error(
      `Missing ${relative(repoRoot, distEntry)}. Run: pnpm --filter @gurezo/web-serial-rxjs build`,
    );
  }

  const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  const sideEffects =
    Object.prototype.hasOwnProperty.call(pkg, 'sideEffects')
      ? pkg.sideEffects
      : '(unset)';

  const consumerRoot = ensureConsumerNodeModules();

  // Import via package name so package.json exports + sideEffects apply.
  const fixtureMinimal = `
import { isWebSerialSupported } from '@gurezo/web-serial-rxjs';
export const supported = isWebSerialSupported();
`;

  const fixtureSession = `
import { createSerialSession, isWebSerialSupported } from '@gurezo/web-serial-rxjs';
export const supported = isWebSerialSupported();
export const session = createSerialSession();
`;

  const distBuffer = readFileSync(distEntry);
  const distSizes = {
    bytes: distBuffer.byteLength,
    ...compressedSizes(distBuffer),
  };

  const pack = measureNpmPackUnpacked();

  const minimal = await buildConsumerFixture({
    name: 'minimal-isWebSerialSupported',
    source: fixtureMinimal,
    minify: false,
    absWorkingDir: consumerRoot,
  });
  const minimalMin = await buildConsumerFixture({
    name: 'minimal-isWebSerialSupported',
    source: fixtureMinimal,
    minify: true,
    absWorkingDir: consumerRoot,
  });
  const session = await buildConsumerFixture({
    name: 'createSerialSession',
    source: fixtureSession,
    minify: false,
    absWorkingDir: consumerRoot,
  });
  const sessionMin = await buildConsumerFixture({
    name: 'createSerialSession',
    source: fixtureSession,
    minify: true,
    absWorkingDir: consumerRoot,
  });

  const treeShake = assertTreeShaken(minimalMin.text);

  // Also minify the published artifact alone (still library-only; no app code).
  const publishedMinPath = join(outDir, 'published-index.min.mjs');
  await build({
    entryPoints: [distEntry],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: ['es2020'],
    outfile: publishedMinPath,
    minify: true,
    external: ['rxjs'],
    write: true,
    logLevel: 'silent',
  });
  const publishedMinBuffer = readFileSync(publishedMinPath);
  const publishedMinSizes = {
    bytes: publishedMinBuffer.byteLength,
    ...compressedSizes(publishedMinBuffer),
  };

  const report = {
    measuredAt: new Date().toISOString(),
    packageName: pkg.name,
    packageVersion: pkg.version,
    node: process.version,
    esbuild: esbuildPkg.version,
    sideEffects,
    notes: [
      'All sizes are library-only; rxjs peer dependency is external and not included.',
      'Consumer fixtures import @gurezo/web-serial-rxjs via a symlink under tools/bundle-size/.out/node_modules so package.json exports and sideEffects apply.',
      'gzip uses zlib level 9; brotli uses quality 11.',
    ],
    npmPack: {
      tarballBytes: pack.tarballBytes,
      unpackedBytes: pack.unpackedBytes,
      fileCount: pack.fileCount,
    },
    publishedArtifact: {
      path: relative(repoRoot, distEntry),
      raw: distSizes,
      minified: publishedMinSizes,
    },
    consumerBundles: {
      minimalIsWebSerialSupported: {
        raw: {
          bytes: minimal.bytes,
          gzipBytes: minimal.gzipBytes,
          brotliBytes: minimal.brotliBytes,
        },
        minified: {
          bytes: minimalMin.bytes,
          gzipBytes: minimalMin.gzipBytes,
          brotliBytes: minimalMin.brotliBytes,
        },
      },
      createSerialSession: {
        raw: {
          bytes: session.bytes,
          gzipBytes: session.gzipBytes,
          brotliBytes: session.brotliBytes,
        },
        minified: {
          bytes: sessionMin.bytes,
          gzipBytes: sessionMin.gzipBytes,
          brotliBytes: sessionMin.brotliBytes,
        },
      },
    },
    treeShaking: treeShake,
  };

  mkdirSync(outDir, { recursive: true });
  const reportPath = join(outDir, 'report.json');
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(`Bundle size report for ${pkg.name}@${pkg.version}`);
  console.log(`  measuredAt: ${report.measuredAt}`);
  console.log(`  node: ${report.node}  esbuild: ${report.esbuild}`);
  console.log(`  sideEffects: ${JSON.stringify(sideEffects)}`);
  console.log('');
  console.log('npm pack (includes types, README, LICENSE, icon, etc.):');
  console.log(
    `  tarball=${formatBytes(pack.tarballBytes)}  unpacked=${formatBytes(pack.unpackedBytes)}${pack.fileCount != null ? `  files=${pack.fileCount}` : ''}`,
  );
  console.log('');
  console.log('Published runtime artifact (dist/index.mjs, library-only):');
  printRow('raw', distSizes);
  printRow('minified (esbuild)', publishedMinSizes);
  console.log('');
  console.log('Consumer esbuild bundles (rxjs external):');
  printRow('minimal raw', minimal);
  printRow('minimal minified', minimalMin);
  printRow('createSerialSession raw', session);
  printRow('createSerialSession min', sessionMin);
  console.log('');
  console.log('Tree-shaking check (minimal minified must omit unused exports):');
  console.log(
    `  ${treeShake.ok ? 'PASS' : 'FAIL'}  checked=[${treeShake.checked.join(', ')}]  present=[${treeShake.present.join(', ') || '(none)'}]`,
  );
  console.log('');
  console.log(`Wrote ${relative(repoRoot, reportPath)}`);

  if (!treeShake.ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
