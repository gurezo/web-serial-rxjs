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
 *
 * ESM consumer resolution (Issue #656) runs after install and before the
 * strict typechecks. It imports the packed package by bare specifier from
 * Node, typechecks with moduleResolution bundler and node16, and bundles
 * with Vite and webpack. Webpack is also run without the `import` condition
 * so the `default` export target is required. CommonJS require() must fail.
 */

import { spawnSync, execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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

function assertConsumerTypecheck(project, label) {
  run('npx', [
    '--no-install',
    'tsc',
    '--noEmit',
    '--pretty',
    'false',
    '-p',
    project,
  ]);
  console.log(`Verified consumer typecheck with ${label}.`);
}

function assertNodeEsmResolution() {
  run(process.execPath, ['src/assert-node-resolve.mjs']);
  run(process.execPath, ['src/consumer.mjs']);
  console.log('Verified Node ESM bare import of the packed package.');
}

function assertBundler(mode) {
  run(process.execPath, ['build-consumer.mjs', mode]);
}

function assertCjsRequireFails() {
  // Node 22+ can load ESM through require() unless this flag is set.
  // The package has no CJS build; this locks that rejection.
  const result = spawnSync(
    process.execPath,
    [
      '--no-experimental-require-module',
      '--input-type=commonjs',
      '-e',
      "require('@gurezo/web-serial-rxjs')",
    ],
    {
      cwd: smokeRoot,
      encoding: 'utf8',
    },
  );
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  if (result.status === 0) {
    throw new Error(
      'CommonJS require() of @gurezo/web-serial-rxjs succeeded; the package must stay ESM-only.',
    );
  }
  if (!/ERR_REQUIRE_ESM|ERR_PACKAGE_PATH_NOT_EXPORTED/.test(output)) {
    throw new Error(
      `CommonJS require() failed without an expected ESM rejection:\n${output}`,
    );
  }
  console.log('Verified CommonJS require() is rejected.');
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
    run('npm', [
      'install',
      '--include=dev',
      '--no-fund',
      '--no-audit',
      '--ignore-scripts',
    ]);
    run('npx', ['--no-install', 'tsc', '--noEmit', '-p', 'tsconfig.json']);

    const packageEntry = resolvePackageImportEntry();
    if (!existsSync(packageEntry)) {
      throw new Error(`Package import entry missing: ${packageEntry}`);
    }

    assertNodeEsmResolution();
    assertConsumerTypecheck('tsconfig.bundler.json', 'moduleResolution bundler');
    assertConsumerTypecheck('tsconfig.node16.json', 'moduleResolution node16');
    assertBundler('vite');
    assertBundler('webpack');
    assertBundler('webpack-default');
    assertCjsRequireFails();

    console.log(
      'Verified package smoke fixture: tsc --noEmit and ESM consumer resolution succeeded.',
    );

    assertStrictTypecheckWithoutWebSerialTypes();
    assertStrictTypecheckWithWebSerialTypes();
  } finally {
    rmSync(packedTgz, { force: true });
    rmSync(join(smokeRoot, 'node_modules'), { recursive: true, force: true });
    rmSync(join(smokeRoot, 'package-lock.json'), { force: true });
    rmSync(join(smokeRoot, '.smoke-out'), { recursive: true, force: true });
  }
}
