import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      '**/vitest.config.{mjs,js,ts,mts}',
      '**/vite.config.{mjs,js,ts,mts}',
    ],
  },
});
