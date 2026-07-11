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
        'examples-shared',
        'workspace',
        'docs',
        'readme',
        'release',
        'ci',
        'build',
        'nx',
        'deps',
        'repo',
        'test',
      ],
    ],
  },
};
