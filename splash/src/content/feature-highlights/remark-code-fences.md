---
title: remark-code-fences
lede: A fence registry that ships empty — you name the formats you want, and pay for nothing else.
order: 80
status: Beta
icon: ├
tags: [Code-Fences, Diagrams, YANG]
---

Diagram fences normally mean a routing table inside somebody's renderer, edited
once per format and reimplemented once per site. This inverts it: the plugin
knows no formats at all, and a handler is plain data plus an optional pure
function.

Seven ship, none adding a dependency — `yang` and `jsonSchema` render as trees,
`plantuml` encodes to a server URL with no renderer at all, `vegaLite` parses
for a client chart, `mermaid` and `graphviz` just claim their language.

[See them rendered →](/lossless-flavored-markdown-package/formats)
