import { describe, expect, it } from 'vitest';
import {
  EXAMPLE_SLUGS,
  getExampleNavLinks,
  type ExampleSlug,
} from './example-nav-links';

const GITHUB_REPO = 'https://github.com/gurezo/web-serial-rxjs';
const DOCS_ROOT = 'https://gurezo.net/web-serial-rxjs';

describe('getExampleNavLinks', () => {
  it.each(EXAMPLE_SLUGS)(
    'returns required primary links for %s',
    (slug: ExampleSlug) => {
      const links = getExampleNavLinks(slug);

      expect(links.viewSource.label).toBe('View source on GitHub');
      expect(links.viewSource.href).toMatch(
        new RegExp(`^${GITHUB_REPO}/tree/main/apps/example-`),
      );
      expect(links.documentation).toEqual({
        label: 'Documentation',
        href: `${DOCS_ROOT}/`,
      });
      expect(links.troubleshooting).toEqual({
        label: 'Troubleshooting',
        href: `${DOCS_ROOT}/guide/ja/troubleshooting.html`,
      });
      expect(links.backToExamples).toEqual({
        label: 'Back to Examples',
        href: `${DOCS_ROOT}/examples/`,
      });
      expect(links.reportIssue).toEqual({
        label: 'Report an issue',
        href: `${GITHUB_REPO}/issues/new`,
      });
    },
  );

  it.each(EXAMPLE_SLUGS)(
    'returns Entry / Service-Hook-Store / UI / README blob links for %s',
    (slug: ExampleSlug) => {
      const { sourceParts } = getExampleNavLinks(slug);

      expect(sourceParts.entry.label).toBe('Entry');
      expect(sourceParts.entry.href).toMatch(
        new RegExp(`^${GITHUB_REPO}/blob/main/apps/example-.+/src/`),
      );
      expect(sourceParts.serviceHookStore.label.length).toBeGreaterThan(0);
      expect(sourceParts.serviceHookStore.href).toMatch(
        new RegExp(`^${GITHUB_REPO}/blob/main/apps/example-`),
      );
      expect(sourceParts.ui.label).toBe('UI');
      expect(sourceParts.ui.href).toMatch(
        new RegExp(`^${GITHUB_REPO}/blob/main/apps/example-`),
      );
      expect(sourceParts.readme).toEqual({
        label: 'README',
        href: expect.stringMatching(
          new RegExp(`^${GITHUB_REPO}/blob/main/apps/example-.+/README\\.md$`),
        ),
      });
    },
  );

  it('maps react paths to hook and App.tsx', () => {
    const links = getExampleNavLinks('react');

    expect(links.viewSource.href).toBe(
      `${GITHUB_REPO}/tree/main/apps/example-react`,
    );
    expect(links.sourceParts.entry.href).toBe(
      `${GITHUB_REPO}/blob/main/apps/example-react/src/main.tsx`,
    );
    expect(links.sourceParts.serviceHookStore).toEqual({
      label: 'Hook',
      href: `${GITHUB_REPO}/blob/main/apps/example-react/src/hooks/useSerialSession.ts`,
    });
    expect(links.sourceParts.ui.href).toBe(
      `${GITHUB_REPO}/blob/main/apps/example-react/src/App.tsx`,
    );
  });

  it('maps angular paths to service and app.html', () => {
    const links = getExampleNavLinks('angular');

    expect(links.sourceParts.serviceHookStore).toEqual({
      label: 'Service',
      href: `${GITHUB_REPO}/blob/main/apps/example-angular/src/app/services/serial-client.service.ts`,
    });
    expect(links.sourceParts.ui.href).toBe(
      `${GITHUB_REPO}/blob/main/apps/example-angular/src/app/app.html`,
    );
  });
});
