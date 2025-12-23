const baseConfig = require('../../eslint.config.cjs');

module.exports = [
  ...baseConfig,
  {
    files: ['**/*.ts'],
    rules: {
      // Add any specific rules for vanilla-ts example here
    },
  },
];
