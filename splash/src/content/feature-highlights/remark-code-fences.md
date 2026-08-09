---
title: remark-code-fences
lede: A fence registry that ships empty — you name the formats you want, and pay for nothing else.
order: 80
status: Beta
icon: ├
tags: [Code-Fences, Diagrams, YANG]
---

Diagram fences normally mean a routing table inside somebody's renderer, edited
once per format and reimplemented once per site. This inverts that: the plugin
knows no formats at all, and a handler is plain data plus an optional pure
function — so anyone can author one without coordinating with the package.

```ts
import { remarkCodeFences } from '@lossless-group/lfm';
import { yang } from '@lossless-group/lfm/formats/yang';

unified().use(remarkParse).use(remarkCodeFences, { formats: [yang] });
```

Three zero-dependency handlers ship: **`yang`** parses RFC 7950 and renders the
RFC 8340 tree diagram; **`mermaid`** claims the language and stops, because
mermaid.js is a client-side renderer; **`jsonCanvas`** parses and normalizes
`nodes`/`edges`.

The `code` node is annotated rather than replaced — `data.fence` carries the
format and any parsed result — so a renderer that doesn't recognize a format
degrades to a readable code block instead of a blob of foreign HTML.

[See a YANG module rendered as a tree →](/lossless-flavored-markdown-package/formats/yang)
