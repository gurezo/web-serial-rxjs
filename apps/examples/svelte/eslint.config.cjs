const { FlatCompat } = require('@eslint/eslintrc');
const baseConfig = require('../../../eslint.config.cjs');

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: baseConfig,
});

module.exports = [
  ...compat.extends('plugin:@nx/typescript', '../../../eslint.config.cjs'),
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.svelte'],
    rules: {},
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {},
  },
  {
    files: ['**/*.svelte'],
    plugins: {
      svelte: require('eslint-plugin-svelte'),
    },
    processor: 'svelte/svelte',
    rules: {},
  },
];
