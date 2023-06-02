import { config, fields, singleton } from '@keystatic/core';

export default config({
  storage: {
    kind: 'local',
  },
  singletons: {
    test: singleton({
      label: 'Test',
      schema: {
        document: fields.newDocument({
          label: 'Document',
          formatting: true,
          dividers: true,
          links: true,
        }),
      },
    }),
  },
});
