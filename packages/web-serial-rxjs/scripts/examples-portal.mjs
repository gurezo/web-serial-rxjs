/**
 * Framework example slugs published under /web-serial-rxjs/examples/<slug>/.
 * Builds land in #354–#359 (angular #354, react #355); the index page (#353) links to these paths.
 * Entries are listed in alphabetical order by label.
 *
 * Parent: #555 · Issue: #560 — start-here guidance and per-example purpose / highlights.
 */
export const EXAMPLE_ENTRIES = [
  {
    slug: 'angular',
    label: 'Angular',
    description: 'Angular example app using SerialSession.',
    audience:
      'See how Angular apps wire SerialSession through an injectable Service.',
    highlights: [
      'Angular Service wrapping createSerialSessionController',
      'connect$ / disconnect$ / dispose$ from a component',
      'terminalText$ for UI display; receive$ as raw stream',
      'send$ / state$ / errors$',
    ],
    appDir: 'apps/example-angular',
  },
  {
    slug: 'react',
    label: 'React',
    description: 'React example app using SerialSession.',
    audience:
      'See how React apps expose SerialSession via a custom hook (`useSerialSession`).',
    highlights: [
      'Custom hook useSerialSession',
      'connect$ / disconnect$ / dispose$ from UI events',
      'terminalText$ for UI display; receive$ as raw stream',
      'send$ / state$ / errors$',
    ],
    appDir: 'apps/example-react',
  },
  {
    slug: 'svelte',
    label: 'Svelte',
    description: 'Svelte example app using SerialSession.',
    audience: 'See how Svelte apps expose SerialSession via a Svelte Store.',
    highlights: [
      'Svelte Store wrapping createSerialSessionController',
      'connect$ / disconnect$ / dispose$ from UI events',
      'terminalText$ for UI display; receive$ as raw stream',
      'send$ / state$ / errors$',
    ],
    appDir: 'apps/example-svelte',
  },
  {
    slug: 'vanilla-js',
    label: 'Vanilla JS',
    description: 'Vanilla JavaScript example using SerialSession.',
    audience:
      'Minimal setup without TypeScript or a UI framework — same connect flow as Vanilla TS, in plain JavaScript.',
    highlights: [
      'createSerialSessionController in plain JavaScript',
      'connect$ / disconnect$ / dispose$',
      'terminalText$ for UI display; receive$ as raw stream',
      'send$ / state$ / errors$',
    ],
    appDir: 'apps/example-vanilla-js',
  },
  {
    slug: 'vanilla-ts',
    label: 'Vanilla TS',
    description: 'Vanilla TypeScript example using SerialSession.',
    audience:
      'Best starting point: try the library API directly with TypeScript and RxJS (no UI framework).',
    highlights: [
      'createSerialSessionController with TypeScript',
      'connect$ / disconnect$ / dispose$',
      'terminalText$ for UI display; receive$ as raw stream',
      'send$ / state$ / errors$',
    ],
    appDir: 'apps/example-vanilla-ts',
    recommended: true,
  },
  {
    slug: 'vue',
    label: 'Vue',
    description: 'Vue example app using SerialSession.',
    audience:
      'See how Vue 3 apps wire SerialSession with the Composition API (composable).',
    highlights: [
      'Vue 3 composable wrapping createSerialSessionController',
      'connect$ / disconnect$ / dispose$ from UI events',
      'terminalText$ for UI display; receive$ as raw stream',
      'send$ / state$ / errors$',
    ],
    appDir: 'apps/example-vue',
  },
];

export const EXAMPLE_SLUGS = EXAMPLE_ENTRIES.map(({ slug }) => slug);
