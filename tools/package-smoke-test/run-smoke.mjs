/**
 * Install a local npm tarball into this fixture and verify consumer ESM + types.
 * Invoked by packages/web-serial-rxjs/scripts/verify-pack.mjs.
 */

import { copyFileSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const smokeRoot = __dirname;
const packedTgz = join(smokeRoot, 'packed.tgz');
const installedPackageRoot = join(
  smokeRoot,
  'node_modules/@gurezo/web-serial-rxjs',
);

function run(command, args) {
  execFileSync(command, args, {
    cwd: smokeRoot,
    stdio: 'inherit',
  });
}

function resolvePackageImportEntry() {
  const pkg = JSON.parse(
    readFileSync(join(installedPackageRoot, 'package.json'), 'utf8'),
  );
  const importPath =
    pkg.exports?.['.']?.import ?? pkg.module ?? pkg.main ?? null;
  if (typeof importPath !== 'string') {
    throw new Error(
      'Installed @gurezo/web-serial-rxjs package.json has no exports["."].import',
    );
  }
  return join(installedPackageRoot, importPath.replace(/^\.\//, ''));
}

export async function runPackageSmoke(tarballPath) {
  if (!existsSync(tarballPath)) {
    throw new Error(`Smoke test tarball missing: ${tarballPath}`);
  }

  rmSync(join(smokeRoot, 'node_modules'), { recursive: true, force: true });
  rmSync(join(smokeRoot, 'package-lock.json'), { force: true });
  copyFileSync(tarballPath, packedTgz);

  try {
    run('npm', ['install', '--no-fund', '--no-audit', '--ignore-scripts']);
    run('npx', ['--no-install', 'tsc', '--noEmit', '-p', 'tsconfig.json']);

    const packageEntry = resolvePackageImportEntry();
    if (!existsSync(packageEntry)) {
      throw new Error(`Package import entry missing: ${packageEntry}`);
    }

    const mod = await import(pathToFileURL(packageEntry).href);
    const required = [
      'createSerialSession',
      'isWebSerialSupported',
      'SerialSessionStatus',
    ];
    for (const name of required) {
      if (!(name in mod)) {
        throw new Error(`ESM import missing export: ${name}`);
      }
    }

    console.log(
      'Verified package smoke fixture: tsc --noEmit and ESM imports succeeded.',
    );
  } finally {
    rmSync(packedTgz, { force: true });
    rmSync(join(smokeRoot, 'node_modules'), { recursive: true, force: true });
    rmSync(join(smokeRoot, 'package-lock.json'), { force: true });
  }
}
