/// <reference types='vitest' />
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const workspaceRoot = resolve(__dirname, '../../../');

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../../node_modules/.vite/apps/examples/vanilla-ts',
  plugins: [nxViteTsPaths()],
  server: {
    port: 4201,
    host: true,
    strictPort: false,
    fs: {
      // Allow serving files from workspace root for monorepo setup
      allow: [workspaceRoot],
    },
  },
  preview: {
    port: 4301,
    host: 'localhost',
  },
  build: {
    outDir: '../../../dist/apps/examples/vanilla-ts',
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    emptyOutDir: true,
  },
  test: {
    name: 'vanilla-ts',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../../coverage/apps/examples/vanilla-ts',
      provider: 'v8' as const,
    },
  },
}));
