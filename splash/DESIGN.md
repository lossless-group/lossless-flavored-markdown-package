---
version: alpha
name: Lossless Flavored Markdown — Manuscript Meets Parser
description: A bookish, manuscript-flavored aesthetic for the LFM splash. Light-mode default ("writer's mode"), Newsreader serif headlines on Manrope body, ink-violet + sienna + moss spine, asymmetric hero with the STC diagram dominant on the right, printed-not-glassy card chrome. Deliberately distinct from the cyan-led neon aesthetic of sibling Lossless splashes.
colors:
  # Tier 1 — named, mode-invariant brand spine
  violet-ink: "#5b3fd9"
  violet-deep: "#3a26a6"
  violet-soft: "#b9a8ff"
  sienna: "#c64f29"
  sienna-deep: "#8a3318"
  sienna-soft: "#f4b59a"
  moss: "#2f7a3f"
  moss-deep: "#1a4f28"
  moss-soft: "#9bd3a8"
  coral: "#ff5c4d"
  sodium: "#ffcd3a"
  iris: "#7a4dff"
  paper: "#f8f3e8"
  paper-soft: "#f0ead7"
  paper-deep: "#e6dec5"
  ink: "#16121e"
  ink-soft: "#2a2438"
  ink-deep: "#0a0710"
  charcoal: "#1f1a2a"
  slate-700: "#3a3348"
  slate-500: "#6b6479"
  slate-400: "#8b8499"
  slate-300: "#a8a2b4"
  slate-200: "#c8c2d2"
  slate-100: "#e0dce6"

  # Tier 2 semantic — LIGHT mode (default; "writer's mode")
  light-bg: "{colors.paper}"
  light-bg-soft: "{colors.paper-soft}"
  light-bg-elevated: "#fffdf6"
  light-bg-code: "{colors.paper-deep}"
  light-text: "{colors.ink}"
  light-text-soft: "{colors.slate-700}"
  light-text-dim: "{colors.slate-500}"
  light-accent: "{colors.violet-ink}"
  light-accent-warm: "{colors.sienna}"
  light-thread: "{colors.moss}"

  # Tier 2 semantic — DARK mode ("operator")
  dark-bg: "{colors.ink}"
  dark-bg-soft: "{colors.charcoal}"
  dark-bg-elevated: "#221b30"
  dark-bg-code: "{colors.ink-deep}"
  dark-text: "#f1ecf8"
  dark-text-soft: "{colors.slate-200}"
  dark-text-dim: "{colors.slate-400}"
  dark-accent: "{colors.violet-soft}"
  dark-accent-warm: "{colors.sienna-soft}"
  dark-thread: "{colors.moss-soft}"

  # Tier 2 semantic — VIBRANT mode ("demo")
  vibrant-bg: "{colors.ink-deep}"
  vibrant-bg-soft: "#110a18"
  vibrant-bg-elevated: "#1c1430"
  vibrant-text: "#fff5e8"
  vibrant-accent: "{colors.sodium}"
  vibrant-accent-warm: "{colors.coral}"
  vibrant-accent-hot: "{colors.iris}"
typography:
  hero-headline:
    fontFamily: Newsreader
    fontSize: 3.6rem
    fontWeight: "500"
    lineHeight: "1.02"
    letterSpacing: "-0.025em"
    fontVariation: "'opsz' 72"
  display-h1:
    fontFamily: Newsreader
    fontSize: 2.8rem
    fontWeight: "500"
    lineHeight: "1.15"
    letterSpacing: "-0.022em"
    fontVariation: "'opsz' 60"
  display-h2:
    fontFamily: Newsreader
    fontSize: 1.85rem
    fontWeight: "600"
    lineHeight: "1.15"
    letterSpacing: "-0.018em"
    fontVariation: "'opsz' 36"
  display-h3:
    fontFamily: Newsreader
    fontSize: 1.3rem
    fontWeight: "600"
    lineHeight: "1.2"
    fontVariation: "'opsz' 28"
  body-lg:
    fontFamily: Manrope
    fontSize: 1.18rem
    fontWeight: "400"
    lineHeight: "1.55"
  body-md:
    fontFamily: Manrope
    fontSize: 1rem
    fontWeight: "400"
    lineHeight: "1.6"
  body-sm:
    fontFamily: Manrope
    fontSize: 0.92rem
    fontWeight: "400"
    lineHeight: "1.55"
  mono-md:
    fontFamily: JetBrains Mono
    fontSize: 0.92rem
    fontWeight: "400"
    lineHeight: "1.55"
  mono-sm:
    fontFamily: JetBrains Mono
    fontSize: 0.78rem
    fontWeight: "500"
    letterSpacing: "0.04em"
  eyebrow-folio:
    fontFamily: JetBrains Mono
    fontSize: 0.72rem
    fontWeight: "500"
    letterSpacing: "0.18em"
rounded:
  sm: 2px
  md: 4px
  lg: 8px
  xl: 12px
  pill: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
  3xl: 64px
  4xl: 96px
  container-padding: 24px
  section-margin: 96px
  card-gap: 20px
components:
  button-primary:
    backgroundColor: "{colors.light-accent}"
    textColor: "{colors.light-bg}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: "10px 18px"
  button-ghost:
    backgroundColor: "{colors.light-bg-elevated}"
    textColor: "{colors.light-text}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: "10px 18px"
  feature-card:
    backgroundColor: "{colors.light-bg-elevated}"
    textColor: "{colors.light-text}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
  stc-stage:
    backgroundColor: "{colors.light-bg-elevated}"
    textColor: "{colors.light-text}"
    rounded: "{rounded.md}"
    padding: "{spacing.lg}"
  pill:
    backgroundColor: "{colors.light-bg-soft}"
    textColor: "{colors.light-text-soft}"
    typography: "{typography.mono-sm}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  chip:
    backgroundColor: "{colors.light-bg-code}"
    textColor: "{colors.light-text-soft}"
    typography: "{typography.mono-sm}"
    rounded: "{rounded.sm}"
    padding: "2px 7px"
  search-trigger:
    backgroundColor: "{colors.light-bg-soft}"
    textColor: "{colors.light-text-soft}"
    rounded: "{rounded.pill}"
    padding: "6px 12px 6px 10px"
---

## Overview

**Manuscript meets parser.** LFM is a *reading + writing* tool first, a parsing engine second. The splash inverts the default operator-flavored aesthetic of sibling Lossless splashes (memopop-site, content-farm/splash) — light mode is the default ("writer's mode"), the display face is a serif (Newsreader), and the page leans bookish before it leans technical.

The aesthetic resolves a tension central to LFM itself: **the prose author and the parsing engine are the same surface.** Authors keep authoring in whatever syntax their tool prefers (Obsidian callouts, directive blocks, hex-code citations); the parser converges every variation into one canonical AST. The visual language honors both halves — paper textures, hairline rules, manuscript margins, italic serif headlines for the writer; mono code chips, printer's-mark corner ticks, structured columns for the parser.

Three deliberate moves separate this splash from its siblings:

- **Light is the default mode.** Operator mode (dark) and demo mode (vibrant) are first-class, not afterthoughts — but the canonical entry point is paper-toned cream with deep-ink text. The way you encounter the package matches the way you'd read a printed essay about it.
- **Asymmetric hero.** Copy + CTAs left, the STC (Syntax → Trigger → Component) diagram dominant on the right. The diagram is the message; the diagram gets the real estate.
- **Printed, not glassy.** Cards have squarer corners, hairline borders, and printer's-mark corner ticks on the STC panel — they feel printed, not floating. No glassmorphism, no glow shadows. The single ornament that might be called "decorative" is the manuscript margin rule — a hairline at ~80px from the left edge of the viewport.

## Colors

The palette is rooted in a three-color editorial spine: **deep ink-violet for prose, warm sienna for code-warmth, moss-green for "live / stable" signals.** The neutrals are warm — cream paper, never pure white — so the light mode reads like a page rather than a screen.

- **Violet-ink (`#5b3fd9`)** — the primary accent. Headlines, links, primary CTAs. In dark mode this lifts to violet-soft (`#b9a8ff`) for legibility.
- **Sienna (`#c64f29`)** — the warm secondary. Code-warmth signals, alpha/experimental status pills, the "warm accent" slot.
- **Moss (`#2f7a3f`)** — the live / stable signal. Used for "live" pills, the thread color in provenance tags, success-state markers.
- **Paper (`#f8f3e8`)** — the canonical background in light mode. Warm cream, never pure white. Pure white in this palette feels antiseptic.
- **Ink (`#16121e`)** — the canonical foreground in light mode. Slightly violet-tinted black, not true black, so it harmonizes with the violet-ink accent.

The three-mode contract:

- **Light mode** — paper background + ink text + violet-ink accent. The default.
- **Dark mode** — ink background + cream-tinted text + violet-soft accent. Operator mode.
- **Vibrant mode** — near-black background + cream text + sodium-yellow accent + coral warm + iris hot. Demo mode for screenshots and conferences.

All three modes use the same semantic-token names (`--color-bg`, `--color-text`, `--color-accent`, `--color-thread`); only the Tier-1 values rebound under `[data-mode='...']`.

## Typography

Three faces. Each does one job:

- **Newsreader (display)** — variable-axis serif with an `opsz` (optical size) axis. Used for all headings, the hero brand-line, and italic body emphasis. Set with `font-variation-settings: 'opsz' 60` for h1, `'opsz' 36` for h2, scaling down for inline contexts. The italic at weight 400 carries the "literary" voice without leaning gothic.
- **Manrope (sans body)** — geometric sans for body copy and UI controls. Slightly more humanist than Inter (used by sibling splashes); pairs better with a serif display. Stylistic sets `ss01`, `ss02` enabled site-wide.
- **JetBrains Mono (mono)** — code, paths, chips, eyebrows, the `folio` numbering. The same mono used by every Lossless splash; the one place we don't diverge.

The folio (manuscript-style chapter mark) is a specific typographic move: a small monospaced section number + uppercase mono label, used in place of the centered eyebrow common to other splashes. `§ Sort by`, `¶ A Lossless Group package · MIT`, `§ 1 Features`. Reads like a typeset book opening.

## Layout

**Asymmetric.** The hero is two columns at desktop widths: copy + CTAs in the left column, the STC diagram component in the right. At narrow widths the columns stack; the diagram remains the visual anchor.

**Container widths:**

- `.container` — `max-width: 1180px`, the standard width for index, list pages, hero
- `.container-narrow` — `max-width: 760px` (long-form: `820px` for memopop equivalents) for the changelog and context-v reading surfaces

**The manuscript margin rule** — a single hairline at `--margin-rule-x: 80px` from the left edge of the viewport, rendered as a fixed element that sits behind all content. Hidden on viewports narrower than 880px. It signals "this is a reading surface" without ever being noisy.

**Section rhythm** — sections are separated by `border-top: 1px solid var(--color-border)` and `padding: 4rem 0` (or `var(--space-16) 0`). No giant decorative dividers; the typography does the work.

## Elevation & Depth

**Printed, not glassy.** The shadow language is restrained:

- `--shadow-card: 0 1px 0 rgba(22, 18, 30, 0.06), 0 12px 24px -16px rgba(22, 18, 30, 0.18)` — a hairline plus a tight diffused shadow. Reads as "lifted off the page," not "floating in space."
- `--shadow-elevated` — slightly stronger version of the same shape for elevated surfaces (popovers, the search panel, the sticky header).
- `--shadow-glow` — used only on the hover state of primary CTAs. Soft, low-saturation, never neon.

No glassmorphism. No backdrop-blur on cards (only on the sticky header, where it's a legibility need). No glow shadows except the very subtle CTA hover state.

The background ornament is two layers: a soft radial-gradient mesh in the brand-spine hues (Tier 1 only, blended at 4-6% opacity) and a paper-grain SVG-noise overlay (`feTurbulence` at `baseFrequency: 0.95`, opacity 0.06) using `mix-blend-mode: multiply` in light mode and `mix-blend-mode: screen` in dark/vibrant. The grain is what makes the page feel like paper rather than a digital surface.

## Shapes

**Squarer than typical.** The radius scale is one step tighter than sibling splashes:

- `--radius-sm: 2px` — chips, code spans, hidden filter spans
- `--radius-md: 4px` — buttons, sort controls, search trigger when collapsed
- `--radius-lg: 8px` — feature cards, STC panels, search popover
- `--radius-xl: 12px` — used sparingly, only on featured cards and the STC outer container
- `--radius-pill: 9999px` — pills, the search trigger when expanded

Pills stay round (signaling "named state"); everything else stays squarer (signaling "printed surface").

**Printer's-mark corner ticks.** The STC diagram outer container carries small corner-tick ornaments — top-left and bottom-right `::before`/`::after` pseudo-elements that draw a 14px right-angle rule, evoking printer's marks on a press sheet. A specific, restrained typographic flourish; not a generic decorative move.

**Manuscript-style hairlines** are the dominant boundary device. Lists in long-form views separate items with `border-bottom: 1px solid var(--color-border)`. Tags rows separate from cards with `border-top: 1px dashed var(--color-border)`. Hairlines do most of the work shadows would in a glassy aesthetic.

## Components

The component primitives shared across all Lossless splashes (`.pill`, `.eyebrow`, `.gradient-text`, `.from-tag`, `.chip`) take on the manuscript-flavored treatment here:

- **`.folio`** — the new mono-font numbering primitive specific to this splash. Renders as `<span class="folio" data-num="§">…</span>` with the section number drawn as a `::before` pseudo-element from `data-num`. Replaces the centered `.eyebrow` common to sibling splashes.
- **Feature cards** — squarer corners, hairline borders, no glow. The featured card variant gets a small "Featured" mono-font label badge bleeding off the top-left corner — a magazine-style move.
- **STC stage cards** — three-stage flow with a thin accent rule across the top of each stage and the printer's-mark corner ticks on the outer container. Inter-stage arrows are thin pen-stroke SVGs, not chevrons.
- **Sort controls** — chip group + direction toggle, mono-font, mode-aware. Direction label adapts to value type: dates show "Newest first / Oldest first", titles show "A → Z / Z → A".
- **Search box** — `<details>`-driven popover (no JS state machine). The compact trigger is a pill-shaped surface with the mono "Search" hint and a `/` keycap. Pagefind UI inherits the semantic token contract via CSS variable overrides — no fork.
- **Mode toggle** — three sun/moon/star buttons in a pill group; pressed state gets the accent fill.

Variants follow the standard pattern (hover, focus-visible, pressed). Hover changes are restrained — color shifts and border-color shifts, never scale transforms or shadow blooms.

## Open Graph Imagery — Ideogram Creative Brief

This section is the LFM-specific creative brief for generating Open Graph (`og:image`) share cards via the Ideogram API. The brief encodes the splash's visual identity into copy-paste-ready prompts so an automated pipeline can produce images that *look like the splash itself*, not generic AI-startup card art.

### Brand intent

A single sentence the prompts must always honor: **the manuscript and the parser are the same surface.** The image should evoke editorial craft (paper, ink, marginalia, printer's marks, serif typography) *and* a parsing pipeline (arrows, structured components, AST-shaped flows) without leaning all the way into either.

What we are deliberately **not** going for: cyberpunk, neon, cyan-led futurism, glassmorphism, "AI startup gradient mesh," generic-3D-render, or any aesthetic that the first three sibling splashes drifted toward before this one broke the mold.

### Anchor palette (must appear in the image)

| Hex | Role | Approximate description |
|---|---|---|
| `#f8f3e8` | Background | Warm cream paper |
| `#16121e` | Foreground text / line work | Deep ink (slightly violet-tinted black) |
| `#5b3fd9` | Primary accent | Ink-violet |
| `#c64f29` | Warm secondary | Sienna / warm rust |
| `#2f7a3f` | Tertiary signal | Moss green |

Three accent colors max. Cream + ink is the foundation; violet-ink + sienna + moss are accents in roughly that priority. **No other brand colors.**

### Recommended Ideogram API parameters

| Parameter | Value | Reason |
|---|---|---|
| `style_type` | `DESIGN` | Editorial illustration / graphic-design output, not photoreal |
| `magic_prompt_option` | `OFF` | The prompt is hand-tuned; auto-elaboration drifts away from the brand |
| `model` | `V_2` or latest | V_2 has better text rendering than V_1 |
| `negative_prompt` | (see below) | Block known drift modes |
| `seed` | floating across runs | Pick the best of several seeds rather than locking |

### Negative prompt (use on every generation)

```
neon, glow, glassmorphism, gradient mesh, holographic, futuristic, cyberpunk, 3D render, photorealistic, dark theme, holograms, digital screens, blue UI, generic AI startup, generic tech illustration, lens flare, particles, sparkles, overly saturated, frosted glass, blurred backgrounds, depth-of-field bokeh.
```

### Primary site OG card (default — site root)

Used for `https://lossless-group.github.io/lossless-flavored-markdown-package/`. Aspect 16:9 → 1200×630.



```text
A wide editorial illustration on a warm cream-paper background (#f8f3e8) with visible subtle paper grain. 

Mood: bookish, writerly, considered, pre-digital craft meeting post-digital pipeline.
Composition: The composition is an asymmetric three-column layout. 

> LEFT THIRD: an open serif-typeset book page with hand-annotated marginalia in deep ink-violet (#5b3fd9) — directive syntax like ":::callout" and "[^a1b2]" written in the margins as if by a careful editor. The body text is set in a Newsreader-style serif. 

> CENTER: a thin pen-and-ink diagram of arrows transforming the typed text into a small tree of geometric component shapes — squares, rectangles, a single circle. The arrows are drawn with the crispness of an architectural drawing, not loose. 

> RIGHT THIRD: those component shapes arranged in a clean asymmetric grid — small rounded rectangles in muted ink-violet (#5b3fd9), warm sienna (#c64f29), and a single moss-green (#2f7a3f) accent block. A single hairline rule runs vertically near the left edge of the canvas, evoking a manuscript margin. 

> TOP LEFT: serif logotype reading "Lossless Flavored Markdown" in italic, deep-ink color. (#2f7a3f) accent block. A single hairline rule runs vertically near the left edge of the canvas, evoking a manuscript margin. 
> TOP LEFT: serif logotype reading "Lossless Flavored Markdown" in italic, deep-ink color. BOTTOM RIGHT: small monospaced label reading "@lossless-group/lfm". 

 

Style: editorial illustration meets technical diagram, pen-and-ink linework with restrained CMYK-style halftone shading, generous whitespace, balanced asymmetric composition.
```

### Per-page entry OG card (variant — for changelog/context-v detail pages)

Used as the OG image on individual entry detail routes. The composition shifts to feature the *title* prominently while keeping the manuscript palette and typographic voice. Aspect 16:9.

Variables to substitute per page (from each entry's frontmatter):

- `{title}` — the entry's `title` field
- `{kind}` — `Changelog` or `Context`
- `{date}` — `formatDate(date_modified)` short form (e.g., "May 7, 2026")

```text
A wide editorial illustration on a warm cream-paper background (#f8f3e8) with
visible subtle paper grain. Composition: typeset broadsheet header. LEFT
TWO-THIRDS: the title "{title}" set in a large Newsreader-style italic serif
in deep ink (#16121e), with a subtle hand-marginalia squiggle annotation in
ink-violet (#5b3fd9) running alongside the title. Below the title, in small
mono uppercase, the label "§ {kind}" in ink-violet, and the date "{date}" in
slate gray. RIGHT THIRD: a small editorial vignette — a stack of typeset
manuscript pages with one page lifted as if mid-flip, casting only the
faintest hairline shadow. On the lifted page, a tiny pen-and-ink diagram
of three connected component-shaped boxes in muted ink-violet (#5b3fd9),
sienna (#c64f29), and moss (#2f7a3f). A single hairline rule runs vertically
near the left edge as a manuscript margin. BOTTOM LEFT: small monospaced
"lossless-group.github.io/lossless-flavored-markdown-package" footer. Mood:
quiet editorial confidence, pre-digital craft meeting structured information.
Style: pen-and-ink editorial illustration with restrained CMYK halftone
shading, no glow, no gradient, no shine.
```

### Per-feature OG card (variant — for the STC paradigm explainer if/when it gets its own route)

Aspect 16:9.

```text
A wide editorial illustration on a warm cream-paper background (#f8f3e8).
Center composition: three stages laid out left-to-right, separated by thin
pen-and-ink arrows. Stage 1 labeled "Declare Syntax" with a small symbol of
typed code like ":::callout" set in monospace inside a hairline-bordered
rectangle. Stage 2 labeled "Parse Trigger" with a small symbol of an
abstract syntax tree — three nodes connected by lines, drawn pen-and-ink.
Stage 3 labeled "Component Pipeline" with a small symbol of a rendered
card-shaped component in muted ink-violet (#5b3fd9). All three stages share
identical container geometry: hairline borders, squarer corners, tiny
printer's-mark corner ticks at top-left and bottom-right. Above the
sequence, a single italic serif headline in deep ink reads "Three steps
from your markdown to your renderer." A subtle paper-grain texture
throughout, a manuscript margin rule on the far left edge. Mood: technical
clarity dressed in editorial restraint.
```

### Iteration loop

Ideogram outputs vary across seeds. Treat the brief as the **input** to a small selection loop, not a one-shot guarantee:

1. Generate 4-8 variants with the same prompt + negative prompt, varying seed.
2. Eyeball for: palette adherence (cream + ink + violet + sienna + moss only), no glassmorphism, no glow, no neon, hand-drawn-ish line quality, generous whitespace, asymmetric balance.
3. Reject any variant that drifts into futurism, photorealism, or saturated UI mockups.
4. The first time a generation lands cleanly, save the seed alongside the asset for reproducibility.

If after several rounds nothing lands, **don't keep retrying with the same prompt** — surface to the user, propose a divergence axis to push (e.g., "results keep coming out too clean / too photorealistic / too dark; want me to push the prompt toward more visible pen-and-ink texture?"). The brief is the contract, but the contract can be renegotiated.

### Asset placement

Generated images land at:

- `splash/public/og-default.png` — the primary site OG card (referenced by `MetaTags.astro` as the default `ogImage`)
- `splash/public/og/<entry-id>.png` — per-entry OG cards generated at content-publish time
- `splash/public/og/stc-paradigm.png` — the STC explainer card (when/if the paradigm gets its own route)

`MetaTags.astro` already accepts an `ogImage` prop; per-entry detail pages should pass their entry-specific image when available, falling back to `og-default.png` otherwise.

## Do's and Don'ts

**Do:**

- Lean serif and italic in headlines. The literary voice is part of the brand.
- Default to light mode. Dark mode is first-class; it isn't the default here.
- Use hairlines instead of shadows for boundaries.
- Keep card corners squarer than your instinct suggests. The printed feel comes from radii at 4px and 8px, not 12px+.
- Render the manuscript margin rule on every page wider than 880px.
- Use the `folio` primitive for section numbering (`§`, `¶`, `§ 1`) instead of centered eyebrows.
- Limit accent colors to the three-color spine: violet-ink, sienna, moss.
- Pair the serif display with monospace inline elements. The contrast is the voice.

**Don't:**

- Don't add glassmorphism. No `backdrop-filter: blur` on cards. The sticky header is the only exception (legibility need).
- Don't add glow shadows on cards. The CTA hover state has a *very* subtle glow; nothing else.
- Don't introduce a fourth accent color. If a new signal needs distinction, use a Tier-1 hue from the existing palette (e.g., `slate-500` for muted secondary states).
- Don't center hero compositions. The asymmetric two-column layout is the splash's visual signature.
- Don't use `border-radius` greater than 12px. The printed feel breaks at 16px+.
- Don't use the cyan/aquamarine palette of sibling splashes. Even as accent. The whole point of this splash is divergence.
- Don't use Inter. Manrope is the body sans here for a reason — pairs better with Newsreader serif.
- Don't generate OG images that look like generic AI-startup card art. The negative prompt above is opinionated for a reason; honor it.

---

**See also:**

- `splash/README.md` — implementation overview, local dev, deploy, package isolation
- `splash/src/styles/theme.css` — the canonical Tier-1 + Tier-2 token implementation this DESIGN.md describes
- `lossless-monorepo/context-v/skills/maintain-splash-pages/SKILL.md` — the skill that codifies splash-page conventions across all Lossless repos, including the "diverge in shape, not just in hue" directive that produced this aesthetic
