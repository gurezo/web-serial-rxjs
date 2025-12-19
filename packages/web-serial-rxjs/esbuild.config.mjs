import { build } from 'esbuild';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const entryPoint = join(__dirname, 'src', 'index.ts');
const outDir = join(__dirname, 'dist');

// ESM ビルド設定
const esmConfig = {
  entryPoints: [entryPoint],
  bundle: true,
  format: 'esm',
  outfile: join(outDir, 'index.mjs'),
  platform: 'browser',
  target: ['es2020'],
  sourcemap: true,
  external: ['rxjs'],
  minify: false,
};

// CJS ビルド設定
const cjsConfig = {
  entryPoints: [entryPoint],
  bundle: true,
  format: 'cjs',
  outfile: join(outDir, 'index.cjs'),
  platform: 'browser',
  target: ['es2020'],
  sourcemap: true,
  external: ['rxjs'],
  minify: false,
};

// ビルド実行
async function buildAll() {
  try {
    console.log('Building ESM...');
    await build(esmConfig);
    console.log('✓ ESM build completed');

    console.log('Building CJS...');
    await build(cjsConfig);
    console.log('✓ CJS build completed');

    console.log('✓ All builds completed successfully');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

buildAll();
