const baseConfig = require('../../eslint.config.cjs');

module.exports = [
  ...baseConfig,
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    rules: {
      // Allow static imports of web-serial-rxjs library
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: [
            '^.*/eslint(\\.base)?\\.config\\.[cm]?js$',
            '@web-serial-rxjs/web-serial-rxjs',
          ],
          depConstraints: [
            {
              sourceTag: '*',
              onlyDependOnLibsWithTags: ['*'],
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.svelte'],
    plugins: {
      svelte: require('eslint-plugin-svelte'),
    },
    processor: 'svelte/svelte',
    languageOptions: {
      parser: require('svelte-eslint-parser'),
      parserOptions: {
        parser: require('@typescript-eslint/parser'),
      },
    },
    rules: {},
  },
];
