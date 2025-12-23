/// <reference types='vitest' />
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import vue from '@vitejs/plugin-vue';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const workspaceRoot = resolve(__dirname, '../../../');

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../../node_modules/.vite/apps/example-vue',
  plugins: [vue(), nxViteTsPaths(), nxCopyAssetsPlugin(['*.md'])],
  server: {
    port: 4203,
    host: true,
    strictPort: false,
    fs: {
      // Allow serving files from workspace root for monorepo setup
      allow: [workspaceRoot],
    },
  },
  preview: {
    port: 4303,
    host: 'localhost',
  },
  build: {
    outDir: '../../../dist/apps/example-vue',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  test: {
    name: 'example-vue',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx,vue}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../../coverage/apps/example-vue',
      provider: 'v8' as const,
    },
    setupFiles: ['./src/test-setup.ts'],
  },
}));
