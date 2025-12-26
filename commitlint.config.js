module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        'web-serial-rxjs',
        'example-angular',
        'example-react',
        'example-vue',
        'example-svelte',
        'example-vanilla-js',
        'example-vanilla-ts',
        'example-angular-e2e',
        'example-react-e2e',
        'example-vue-e2e',
        'workspace',
      ],
    ],
  },
};
