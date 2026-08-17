import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'index': 'src/index.ts',
    'parse': 'src/parse.ts',
    'preset': 'src/preset.ts',
    'types/index': 'src/types/index.ts',
    'plugins/remark-lfm-callouts': 'src/plugins/remark-lfm-callouts.ts',
    'plugins/remark-lfm-code-fences': 'src/plugins/remark-lfm-code-fences.ts',
    'plugins/remark-lfm-heading-ids': 'src/plugins/remark-lfm-heading-ids.ts',
    'formats/index': 'src/formats/index.ts',
    'formats/yang': 'src/formats/yang.ts',
    'formats/json-schema': 'src/formats/json-schema.ts',
    'formats/plantuml': 'src/formats/plantuml.ts',
    'plugins/remark-lfm-citations': 'src/plugins/remark-lfm-citations.ts',
    'plugins/lfm-og-fetcher': 'src/plugins/lfm-og-fetcher.ts',
    'plugins/lfm-link-preview': 'src/plugins/lfm-link-preview.ts',
    'utils/classify-link': 'src/utils/classify-link.ts',
    'utils/og-cache': 'src/utils/og-cache.ts',
    'utils/og-dispatcher': 'src/utils/og-dispatcher.ts',
    'utils/og-backends/index': 'src/utils/og-backends/index.ts',
  },
  format: ['esm'],
  dts: true,
  clean: true,
  splitting: true,
  treeshake: true,
});
