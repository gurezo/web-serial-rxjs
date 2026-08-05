/**
 * Framework example slugs published under /web-serial-rxjs/examples/<slug>/.
 * Builds land in #354–#359 (angular #354, react #355); the index page (#353) links to these paths.
 */
export const EXAMPLE_ENTRIES = [
  {
    slug: 'vanilla-ts',
    label: 'Vanilla TS',
    description: 'Vanilla TypeScript example using SerialSession.',
    audience:
      'Best starting point: try the library API directly with TypeScript and RxJS (no framework).',
    recommended: true,
  },
  {
    slug: 'vanilla-js',
    label: 'Vanilla JS',
    description: 'Vanilla JavaScript example using SerialSession.',
    audience: 'Minimal setup without TypeScript or a UI framework.',
  },
  {
    slug: 'react',
    label: 'React',
    description: 'React example app using SerialSession.',
    audience: 'React apps using a custom hook (`useSerialSession`).',
  },
  {
    slug: 'vue',
    label: 'Vue',
    description: 'Vue example app using SerialSession.',
    audience: 'Vue 3 apps using the Composition API.',
  },
  {
    slug: 'angular',
    label: 'Angular',
    description: 'Angular example app using SerialSession.',
    audience: 'Angular apps wiring SerialSession through a Service.',
  },
  {
    slug: 'svelte',
    label: 'Svelte',
    description: 'Svelte example app using SerialSession.',
    audience: 'Svelte apps using a Svelte Store.',
  },
];

export const EXAMPLE_SLUGS = EXAMPLE_ENTRIES.map(({ slug }) => slug);
