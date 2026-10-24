/// <reference types='vitest' />
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';
import vue from '@vitejs/plugin-vue';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import { nxReadySignal } from '@nx/vite/plugins/nx-ready-signal.plugin';

// These options were migrated by @nx/vite:convert-to-inferred from the project.json file.
const configValues = {
  default: {},
  development: {},
  production: {},
  portal: {},
};

// Determine the correct configValue to use based on the configuration
const nxConfiguration = process.env.NX_TASK_TARGET_CONFIGURATION ?? 'default';

const options = {
  ...configValues.default,
  ...(configValues[nxConfiguration] ?? {}),
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const workspaceRoot = resolve(__dirname, '../../../');

export default defineConfig(({ mode }) => ({
  resolve: {
    tsconfigPaths: true,
  },
  root: import.meta.dirname,
  cacheDir: '../../../node_modules/.vite/apps/example-vue',
  base: mode === 'portal' ? '/web-serial-rxjs/examples/vue/' : '/',
  plugins: [vue(), nxCopyAssetsPlugin(['*.md']), nxReadySignal()],
  server: {
    port: 4250,
    host: true,
    strictPort: false,
    fs: {
      // Allow serving files from workspace root for monorepo setup
      allow: [workspaceRoot],
    },
  },
  preview: {
    port: 4350,
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
