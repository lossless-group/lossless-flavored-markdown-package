---
title: Video Embeds
order: 10
featured: true
syntax_label: bare URL or directive
syntax_examples:
  - kind: bare
    code: 'youtu.be/share={id}'
  - kind: directive
    code: ':::youtube-share[https://youtu.be/jCe2wg1ulus?si=oplqTdsbv8sv2JfH]'
parse_file: src/plugins/lfm-link-preview.ts
component_file: components/YoutubeShareEmbed--Base.astro
status: live
tags: [Embeds, YouTube]
---

A YouTube share URL on its own line in a `.md` file becomes a YouTube embed.
The same URL inside a `:::youtube-share[...]` directive does the same thing —
either way, the parser emits one canonical leaf-directive node, and the
renderer dispatches to the embed component.
