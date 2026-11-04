/**
 * Install a local npm tarball into this fixture and verify consumer ESM + types.
 * Invoked by packages/web-serial-rxjs/scripts/verify-pack.mjs.
 *
 * Strict cases (Issue #652 / #659) compile the same consumer with skipLibCheck
 * off. typeRoots is pinned to this fixture so hoisted workspace @types are not
 * used. Packaged Web Serial dictionaries must typecheck without
 * `@types/w3c-web-serial`. With that package installed, the same consumer must
 * still typecheck, including mutual assignment with the globals.
 * The types entry is "w3c-web-serial" (the folder under typeRoots). The
 * library tsconfig's "@types/w3c-web-serial" only resolves via a node_modules
 * walk, which custom typeRoots disables.
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
const webSerialTypesPackage = '@types/w3c-web-serial@1.0.9';

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

function assertStrictTypecheckWithoutWebSerialTypes() {
  run('npx', [
    '--no-install',
    'tsc',
    '--noEmit',
    '--pretty',
    'false',
    '-p',
    'tsconfig.strict-without-web-serial-types.json',
  ]);
  console.log(
    'Verified strict consumer typecheck without @types/w3c-web-serial.',
  );
}

function assertStrictTypecheckWithWebSerialTypes() {
  run('npm', [
    'install',
    '--no-save',
    '--no-fund',
    '--no-audit',
    '--ignore-scripts',
    webSerialTypesPackage,
  ]);
  run('npx', [
    '--no-install',
    'tsc',
    '--noEmit',
    '--pretty',
    'false',
    '-p',
    'tsconfig.strict-with-web-serial-types.json',
  ]);
  console.log(
    'Verified strict consumer typecheck with @types/w3c-web-serial.',
  );
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

    assertStrictTypecheckWithoutWebSerialTypes();
    assertStrictTypecheckWithWebSerialTypes();
  } finally {
    rmSync(packedTgz, { force: true });
    rmSync(join(smokeRoot, 'node_modules'), { recursive: true, force: true });
    rmSync(join(smokeRoot, 'package-lock.json'), { force: true });
  }
}
