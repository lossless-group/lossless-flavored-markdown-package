---
title: Bare-link provider catalog
lede: A URL on its own line becomes the embedded player or rich card the author meant. The catalog ships in the package.
order: 70
status: Beta
icon: ▷
tags: [Embeds, YouTube, Vimeo]
---

`src/plugins/Bare-Link-Provider-Catalog.md` is the canonical record of supported
providers. v0.2.2 ships YouTube video / shorts / playlist and Vimeo as `stable`,
with Loom, Spotify, and SoundCloud planned.

The matching rule is strict: the paragraph must have *exactly one child* that's
a `link` whose visible text equals its URL. So `Check this out https://...`
mid-sentence stays a clickable link; only an isolated bare URL becomes an embed.
