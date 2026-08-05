const GITHUB_REPO = 'https://github.com/gurezo/web-serial-rxjs';
const DOCS_ROOT = 'https://gurezo.net/web-serial-rxjs';

export type ExampleSlug =
  | 'angular'
  | 'react'
  | 'svelte'
  | 'vanilla-js'
  | 'vanilla-ts'
  | 'vue';

export interface ExampleNavLink {
  label: string;
  href: string;
}

export interface ExampleNavLinks {
  viewSource: ExampleNavLink;
  documentation: ExampleNavLink;
  backToExamples: ExampleNavLink;
  reportIssue: ExampleNavLink;
  sourceParts: {
    entry: ExampleNavLink;
    serviceHookStore: ExampleNavLink;
    ui: ExampleNavLink;
    readme: ExampleNavLink;
  };
}

interface ExampleSourcePaths {
  appDir: string;
  entry: string;
  serviceHookStore: string;
  serviceHookStoreLabel: string;
  ui: string;
}

const EXAMPLE_SOURCE_PATHS: Record<ExampleSlug, ExampleSourcePaths> = {
  angular: {
    appDir: 'apps/example-angular',
    entry: 'apps/example-angular/src/main.ts',
    serviceHookStore: 'apps/example-angular/src/app/services/serial-client.service.ts',
    serviceHookStoreLabel: 'Service',
    ui: 'apps/example-angular/src/app/app.html',
  },
  react: {
    appDir: 'apps/example-react',
    entry: 'apps/example-react/src/main.tsx',
    serviceHookStore: 'apps/example-react/src/hooks/useSerialSession.ts',
    serviceHookStoreLabel: 'Hook',
    ui: 'apps/example-react/src/App.tsx',
  },
  svelte: {
    appDir: 'apps/example-svelte',
    entry: 'apps/example-svelte/src/main.ts',
    serviceHookStore: 'apps/example-svelte/src/stores/useSerialSession.ts',
    serviceHookStoreLabel: 'Store',
    ui: 'apps/example-svelte/src/App.svelte',
  },
  'vanilla-js': {
    appDir: 'apps/example-vanilla-js',
    entry: 'apps/example-vanilla-js/src/main.js',
    serviceHookStore: 'apps/example-vanilla-js/src/app.js',
    serviceHookStoreLabel: 'App logic',
    ui: 'apps/example-vanilla-js/index.html',
  },
  'vanilla-ts': {
    appDir: 'apps/example-vanilla-ts',
    entry: 'apps/example-vanilla-ts/src/main.ts',
    serviceHookStore: 'apps/example-vanilla-ts/src/app.ts',
    serviceHookStoreLabel: 'App logic',
    ui: 'apps/example-vanilla-ts/index.html',
  },
  vue: {
    appDir: 'apps/example-vue',
    entry: 'apps/example-vue/src/main.ts',
    serviceHookStore: 'apps/example-vue/src/composables/useSerialClient.ts',
    serviceHookStoreLabel: 'Composable',
    ui: 'apps/example-vue/src/app/App.vue',
  },
};

const githubTree = (path: string): string => `${GITHUB_REPO}/tree/main/${path}`;
const githubBlob = (path: string): string => `${GITHUB_REPO}/blob/main/${path}`;

export const EXAMPLE_SLUGS: readonly ExampleSlug[] = [
  'angular',
  'react',
  'svelte',
  'vanilla-js',
  'vanilla-ts',
  'vue',
];

export function getExampleNavLinks(slug: ExampleSlug): ExampleNavLinks {
  const paths = EXAMPLE_SOURCE_PATHS[slug];

  return {
    viewSource: {
      label: 'View source on GitHub',
      href: githubTree(paths.appDir),
    },
    documentation: {
      label: 'Documentation',
      href: `${DOCS_ROOT}/`,
    },
    backToExamples: {
      label: 'Back to Examples',
      href: `${DOCS_ROOT}/examples/`,
    },
    reportIssue: {
      label: 'Report an issue',
      href: `${GITHUB_REPO}/issues/new`,
    },
    sourceParts: {
      entry: {
        label: 'Entry',
        href: githubBlob(paths.entry),
      },
      serviceHookStore: {
        label: paths.serviceHookStoreLabel,
        href: githubBlob(paths.serviceHookStore),
      },
      ui: {
        label: 'UI',
        href: githubBlob(paths.ui),
      },
      readme: {
        label: 'README',
        href: githubBlob(`${paths.appDir}/README.md`),
      },
    },
  };
}
