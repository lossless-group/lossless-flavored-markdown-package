---
title: remark-citations
lede: Hex-code footnotes get renumbered to display indices and lifted into a structured citation dataset.
order: 50
status: Stable
icon: ⁂
tags: [Citations, Footnotes]
---

Author with stable hex IDs (`[^a1b2c3]`); LFM renumbers them to readable indices
at parse time and assembles the full dataset on `tree.data.citations.ordered` —
parsed dates, source domains, raw text — so a Sources component can render the
canonical bibliography at the bottom of the article.
