---
site_uuid: 103b9c33-95ea-41ec-ba00-2dddecd945b7
hex_code: i0hdsc
title: "MDX"
lede: "Keep writing components as MDX. LFM parses them, never runs them, and tells your renderer which file each one comes from."
publish: true
date_created: 2026-11-17
date_modified: 2026-11-17
date_authored_initial_draft: 2026-11-17
date_authored_current_draft: 2026-11-17
at_semantic_version: 0.0.1.0
status: Published
category: Docs
tags:
  - MDX
  - Components
  - Trigger-Syntax
authors:
  - Michael Staton
augmented_with:
  - Claude Code on Claude Opus 5.5
---

# MDX

An `.mdx` file brings in a component with an `import` and drops it into the prose
as JSX:

```mdx
import BarChart from '../../components/BarChart.astro';

## Where the money went

<BarChart
	caption="One month, one meter"
	items={[
		{ label: 'Tariff', value: 18000, display: '$18,000' },
		{ label: 'Demand', value: 8750, accent: true },
	]}
/>
```

With `mdx` on, LFM treats that JSX as one more trigger syntax. Every other
trigger (a directive, a callout, a code fence) names a component your site looks
up in its own map. MDX doesn't need the lookup: the file already says which
component it means. So LFM records the import, and your renderer renders that
component.

## Turn it on for `.mdx` files

```ts
import { parseMarkdown } from '@lossless-group/lfm';

const tree = await parseMarkdown(entry.body, {
  mdx: entry.filePath?.endsWith('.mdx') ? { filePath: entry.filePath } : false,
});
```

Only for `.mdx`. MDX changes how `<` and `{` parse, so plain markdown with a
stray `{` or an HTML comment would break. `filePath` is the path of the file
(`src/content/blog/a.mdx` from Astro's `entry.filePath`); LFM uses it to resolve
relative imports.

## What you get

Each JSX element becomes a `componentNode`:

```js
{
  type: 'componentNode',
  triggerSyntax: 'mdx',
  name: 'BarChart',
  props: { caption: 'One month, one meter', items: [ /* the real array */ ] },
  attributes: { caption: 'One month, one meter' },   // string props only
  import: {
    local: 'BarChart',
    source: '../../components/BarChart.astro',
    name: 'default',
    resolved: 'src/components/BarChart.astro',
  },
  inline: false,       // true inside a paragraph
  intrinsic: false,    // true for lowercase HTML like <div>
  children: [ /* parsed markdown inside the element */ ],
}
```

- **Nothing runs.** Props are evaluated statically: strings, numbers,
  booleans, `null`, and arrays and objects of those. A prop that needs code (a
  variable, a function call, an arrow function) is left out of `props`, named in
  `dynamicProps`, and reported as a warning on the file.
- **Imports leave the content.** `import` and `export` blocks are removed from
  the tree and listed on `tree.data.mdx.imports`.
- **Expressions:** `{/* comments */}` disappear; `{42}` or `{'text'}` become
  text; anything dynamic is dropped.
- **`<>…</>` fragments** are replaced by their children.
- **`<Chart.Line>`** resolves through `import * as Chart`.
- Headings, citations, callouts and the rest of LFM work as usual around the
  components.

## Rendering it in Astro

Build a map of your components once, then match on `import.resolved`:

```astro
---
// AstroMarkdown.astro
const modules = import.meta.glob('/src/components/**/*.astro', { eager: true });
---
{type === 'componentNode' && node.triggerSyntax === 'mdx' && (() => {
  const mod = modules[`/${node.import?.resolved}`];
  const Component = mod?.[node.import?.name ?? 'default'];
  if (!Component) return null;
  return (
    <Component {...node.props}>
      {node.children.map((child) => <Astro.self node={child} data={data} />)}
    </Component>
  );
})()}
```

Reference implementation: `astro-knots/sites/edviro-blog`, whose articles are
`.mdx` with Astro chart components.
