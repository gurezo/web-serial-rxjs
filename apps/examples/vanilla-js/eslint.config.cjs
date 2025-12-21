const baseConfig = require('../../../eslint.config.cjs');

module.exports = [
  ...baseConfig,
  {
    files: ['**/*.js'],
    rules: {
      // Add any specific rules for vanilla-js example here
    },
  },
];
