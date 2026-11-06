/**
 * Bundle the packed package with Vite or webpack.
 * Invoked by run-smoke.mjs after npm install, with cwd = this directory.
 *
 * Modes:
 * - vite
 * - webpack
 * - webpack-default (no `import` export condition; must use `default`)
 */

import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const smokeRoot = __dirname;
const packedEntry = join(
  smokeRoot,
  'node_modules/@gurezo/web-serial-rxjs/dist/index.mjs',
);

function modulePath(id) {
  const layered = id.includes('|') ? id.slice(id.lastIndexOf('|') + 1) : id;
  const withoutQuery = layered.split('?')[0] ?? layered;
  const withoutLoader = withoutQuery.includes('!')
    ? withoutQuery.slice(withoutQuery.lastIndexOf('!') + 1)
    : withoutQuery;
  return isAbsolute(withoutLoader)
    ? withoutLoader
    : resolve(smokeRoot, withoutLoader);
}

function assertPackedModule(moduleIds, label) {
  const packed = moduleIds.find((id) => modulePath(id) === packedEntry);
  if (!packed) {
    throw new Error(
      `${label} did not bundle the packed ESM entry ${packedEntry}.\nmodules:\n${moduleIds
        .filter(Boolean)
        .slice(0, 40)
        .join('\n')}`,
    );
  }
}

function assertWrittenBundle(source, label) {
  if (source.includes("'@gurezo/web-serial-rxjs'") || source.includes('"@gurezo/web-serial-rxjs"')) {
    throw new Error(
      `${label} output still contains the unresolved package specifier.`,
    );
  }
}

async function buildWithVite() {
  const { build } = await import('vite');
  const outDir = join(smokeRoot, '.smoke-out/vite');
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  const result = await build({
    root: smokeRoot,
    configFile: false,
    logLevel: 'warn',
    publicDir: false,
    cacheDir: join(smokeRoot, '.smoke-out/vite-cache'),
    build: {
      outDir,
      emptyOutDir: true,
      rollupOptions: {
        input: join(smokeRoot, 'src/consumer.mjs'),
        output: {
          entryFileNames: 'consumer.js',
        },
      },
    },
  });

  const outputs = Array.isArray(result) ? result : [result];
  const moduleIds = outputs.flatMap((output) =>
    output.output.flatMap((chunk) =>
      chunk.type === 'chunk' ? Object.keys(chunk.modules ?? {}) : [],
    ),
  );
  assertPackedModule(moduleIds, 'Vite');

  const written = readFileSync(join(outDir, 'consumer.js'), 'utf8');
  assertWrittenBundle(written, 'Vite');
  console.log('Verified Vite build resolves the packed ESM entry.');
}

function webpackResolve(mode) {
  const resolve = {
    modules: [join(smokeRoot, 'node_modules')],
  };
  if (mode === 'webpack-default') {
    const conditionNames = ['webpack'];
    resolve.conditionNames = conditionNames;
    resolve.byDependency = {
      esm: { conditionNames },
      commonjs: { conditionNames },
      url: { conditionNames },
    };
  }
  return resolve;
}

async function buildWithWebpack(mode) {
  const { default: webpack } = await import('webpack');
  const outDir = join(smokeRoot, `.smoke-out/${mode}`);
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  const stats = await new Promise((resolve, reject) => {
    webpack(
      {
        mode: 'production',
        context: smokeRoot,
        target: 'web',
        entry: join(smokeRoot, 'src/consumer.mjs'),
        output: {
          path: outDir,
          filename: 'consumer.js',
          module: true,
          chunkFormat: 'module',
        },
        experiments: {
          outputModule: true,
        },
        resolve: webpackResolve(mode),
        infrastructureLogging: { level: 'error' },
        stats: 'errors-warnings',
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }
        if (!result || result.hasErrors()) {
          reject(new Error(result?.toString() ?? `${mode} failed`));
          return;
        }
        resolve(result);
      },
    );
  });

  const info = stats.toJson({ modules: true, ids: true });
  const moduleIds = (info.modules ?? []).flatMap((mod) => [
    mod.name ?? '',
    mod.identifier ?? '',
    mod.nameForCondition ?? '',
  ]);
  assertPackedModule(moduleIds, mode);

  const written = readFileSync(join(outDir, 'consumer.js'), 'utf8');
  assertWrittenBundle(written, mode);
  console.log(
    `Verified ${mode} build resolves the packed ESM entry (${relative(smokeRoot, join(outDir, 'consumer.js'))}).`,
  );
}

const mode = process.argv[2];
if (mode === 'vite') {
  await buildWithVite();
} else if (mode === 'webpack' || mode === 'webpack-default') {
  await buildWithWebpack(mode);
} else {
  throw new Error(
    `Unknown bundler mode "${mode}". Expected vite, webpack, or webpack-default.`,
  );
}
