/**
 * Framework example slugs published under /web-serial-rxjs/examples/<slug>/.
 * Builds land in #354–#359 (angular done in #354); the index page (#353) links to these paths.
 */
export const EXAMPLE_ENTRIES = [
  { slug: 'angular', label: 'Angular', description: 'Angular example app using SerialSession.' },
  { slug: 'react', label: 'React', description: 'React example app using SerialSession.' },
  { slug: 'svelte', label: 'Svelte', description: 'Svelte example app using SerialSession.' },
  {
    slug: 'vanilla-js',
    label: 'Vanilla JS',
    description: 'Vanilla JavaScript example using SerialSession.',
  },
  {
    slug: 'vanilla-ts',
    label: 'Vanilla TS',
    description: 'Vanilla TypeScript example using SerialSession.',
  },
  { slug: 'vue', label: 'Vue', description: 'Vue example app using SerialSession.' },
];

export const EXAMPLE_SLUGS = EXAMPLE_ENTRIES.map(({ slug }) => slug);
