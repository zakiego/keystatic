import { createReader } from '@keystatic/core/reader';
import { createGitHubReader } from '@keystatic/core/reader/github';
import keystaticConfig from '../../keystatic.config';
import { cache } from 'react';
import { draftMode } from 'next/headers';

export const reader = cache(() => {
  const { isEnabled } = draftMode();
  if (isEnabled) {
    return createGitHubReader(keystaticConfig, {
      repo: 'Thinkmill/keystatic',
      ref: 'preview-testing',
      pathPrefix: 'docs',
    });
  }
  return createReader(process.cwd(), keystaticConfig);
});

export async function getNavigationMap() {
  const navigation = await reader().singletons.navigation.read();
  const pages = await reader().collections.pages.all();
  const pagesBySlug = Object.fromEntries(pages.map(page => [page.slug, page]));

  const navigationMap = navigation?.navGroups.map(({ groupName, items }) => ({
    groupName,
    items: items.map(({ label, link }) => {
      const { discriminant, value } = link;
      const page = discriminant === 'page' && value ? pagesBySlug[value] : null;
      const url = discriminant === 'url' ? value : `/docs/${page?.slug}`;

      return {
        label: label || page?.entry.title || '',
        href: url || '',
        title: page?.entry.title,
        comingSoon: discriminant === 'coming-soon',
      };
    }),
  }));

  return navigationMap;
}
