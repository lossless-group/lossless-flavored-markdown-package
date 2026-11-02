---
site_uuid: 440d005c-502b-48cc-88d7-558814e671c8
hex_code: c9758c
title: "Syntax Highlighting"
lede: "Color code with Shiki using a default palette that follows every mode and CSS variables a site can override."
publish: true
date_created: 2026-11-02
date_modified: 2026-11-02
date_authored_initial_draft: 2026-11-02
date_authored_current_draft: 2026-11-02
at_semantic_version: 0.0.1.0
status: Published
category: Docs
tags:
  - Syntax-Highlighting
  - Shiki
  - Theming
authors:
  - Michael Staton
augmented_with:
  - Claude Code on Claude Opus 5.5 (1M context)
---

# Syntax highlighting

`@lossless-group/lfm/highlight` colors code with [Shiki](https://shiki.style/). It's a separate import, so the parser doesn't load Shiki unless you use it.

```astro
---
import { highlightCode } from '@lossless-group/lfm/highlight';

const html = await highlightCode(code, language);
---
<pre><code set:html={html} /></pre>
```

Text is always escaped, and a missing or unknown language returns it uncolored.

**Every site gets a default palette.** It uses fixed hues, with lightness taken from the site's `--color-text`, so it follows light, dark, and vibrant modes with no setup. It stayed above 5:1 contrast in all three modes of the six splashes it was measured on.

**To match a site's brand, set any of these in its theme CSS**, per mode if needed:

```css
:root {
  --lfm-code-token-keyword: var(--color-accent);
  --lfm-code-token-string: #2f9e6e;
}
```

| Variable | Colors |
|---|---|
| `--lfm-code-foreground` | Default text |
| `--lfm-code-token-keyword` | `const`, `return`, and YAML or JSON keys |
| `--lfm-code-token-string` | Strings |
| `--lfm-code-token-string-expression` | Interpolated strings |
| `--lfm-code-token-function` | Functions and types |
| `--lfm-code-token-constant` | Numbers, booleans, and constants |
| `--lfm-code-token-parameter` | Parameters |
| `--lfm-code-token-comment` | Comments |
| `--lfm-code-token-punctuation` | Punctuation |
| `--lfm-code-token-link` | Links in comments and docs |

A site that overrides a color owns its contrast, so check it in each mode.
