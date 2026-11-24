---
title: "Maintain Person Card Directives for Lead Lists"
lede: "A list of people we want to reach, written as one line per person that reads in Obsidian and renders as a grid of cards, with private fields that never ship."
date_created: 2026-11-23
date_modified: 2026-11-23
date_authored_initial_draft: 2026-11-23
date_authored_current_draft: 2026-11-23
date_authored_final_draft:
at_semantic_version: 0.0.0.1
status: Draft
publish: false
site_uuid: f4c515d1-ee80-4ff5-b530-2e6e83772d09
hex_code: xt4nrw
authors:
  - Michael Staton
augmented_with:
  - Claude Code on Claude Opus 5.5
tags:
  - Directives
  - Person-Cards
  - Lead-Lists
  - Privacy
type: Specs
summary: >-
  Proposes a `:::person-cards` container directive holding one `::person-card`
  leaf per person (name in the label; firm, X, LinkedIn, headshot, degree,
  access and why as attributes), normalized by a plugin into
  `node.data.personCards` the way lfm-image-carousel normalizes carousels.
  `degree` and `access` are private judgments and are redacted by default.
  Carries the first two lists (influencer VCs, influencer angels) as the worked
  example. `publish: false` because those lists name real people.
---

# Maintain Person Card Directives for Lead Lists

## Why

Content work keeps producing lists of people: who to cite, interview, tag, or ask to share. The VC audience for the Agentic VC Dojo is the first case, with lists of influencer VCs and influencer angels. Today those live in tables or loose notes, so nothing can sort them, render them as cards, or keep the private parts private.

A person card is one line per person that reads fine in Obsidian, parses to a typed record, and renders as a grid on a site. Two of its fields (`degree`, `access`) are our private judgments about our own network, so the directive has to make leaking them hard.

## What we checked (2026-11-23)

- **LFM already parses the syntax.** `remark-directive` is on in `preset-core.ts`. Run through `parseMarkdown` from `dist/index.js`, the block below becomes a `containerDirective` named `person-cards` with `attributes.list`, holding a `leafDirective` named `person-card` whose label is a `text` child (`Sarah Guo`) and whose attributes come through as strings, empty ones included (`degree: ""`).
- **Nothing handles it.** No plugin in `src/plugins/` reads `person-cards`, so no `node.data` is attached and every renderer would have to re-extract the fields itself.
- **The precedent is `lfm-image-carousel.ts`.** It normalizes `:::image-carousel` with `::image` children into `node.data.carousel` (variant, slides, sort), so every framework reads one contract. Person cards should copy that pattern exactly.

## Syntax

```markdown
:::person-cards{list="influencer-vcs"}
::person-card[Sarah Guo]{firm="Conviction" x="https://x.com/saranormous" linkedin="https://www.linkedin.com/in/sarahxguo/" headshot="" degree="" access="" why="No Priors podcast; AI-only fund"}
:::
```

- **One `::person-card` leaf per person, inside one `:::person-cards` container.** One line per person keeps a list scannable in Obsidian and diffs cleanly.
- **The name is the label** (`[Sarah Guo]`), as `::image` uses its label.
- **Attributes go in braces on the opening line.** Directive attributes can't hold comments, so the field rules live in this spec, not in the markdown.
- **Values are always quoted strings.** The plugin coerces types (below).
- **A `::person-card` outside a `:::person-cards` container** is still normalized, as a list of one with no `list` name.

## Fields

| Attribute | Type after normalizing | Required | Rule |
|---|---|---|---|
| label | `name: string` | Yes | The person's name as they write it. |
| `firm` | `string` | No | Current firm or `Independent`. Goes stale; confirm before use. |
| `x` | `URL` | No | Full `https://x.com/<handle>` URL. Also derive `xHandle`. Accept `twitter.com` and rewrite to `x.com`. |
| `linkedin` | `URL` | No | Full `https://www.linkedin.com/in/<slug>/` URL. |
| `headshot` | `URL` | No | A copy we host (ImageKit). Never an X or LinkedIn avatar URL: those rotate and break, and hotlinking them is poor form. Record where the image came from. |
| `degree` | `'1st' \| '2nd' \| '3rd' \| 'none' \| null` | No | Distance from Michael's network. It's a category, not a score. **Private.** |
| `access` | `0-5 \| null` | No | How reachable the person is (scale below). **Private.** |
| `why` | `string` | Yes | One plain-text line on why this person is on this list. |

Unknown attributes pass through into `extra: Record<string, string>` with a warning, following [Maintain Embeddable Images with Style Props](Maintain-Embeddable-Images-with-Style-Props.md): an unrecognised prop must never be silently dropped.

### The `access` scale

| `access` | Meaning |
|---|---|
| 0 | No known route in |
| 1 | Public channels only (replies, newsletter comments), rarely answers |
| 2 | Answers cold outreach sometimes |
| 3 | A warm intro exists, or they reliably answer cold outreach on a specific ask |
| 4 | We've talked before |
| 5 | Would answer a direct message today |

## Contract: `node.data.personCards`

A new plugin, `src/plugins/lfm-person-cards.ts`, runs when `directives` is on (wired in `preset-core.ts` next to the carousel) and attaches:

```ts
export interface PersonCard {
  name: string;
  firm?: string;
  x?: string;          // normalized https://x.com/<handle>
  xHandle?: string;    // "<handle>", no @
  linkedin?: string;
  headshot?: string;
  degree?: '1st' | '2nd' | '3rd' | 'none' | null;  // absent when redacted
  access?: 0 | 1 | 2 | 3 | 4 | 5 | null;           // absent when redacted
  why: string;
  extra: Record<string, string>;
}

export interface PersonCardList {
  list: string | null;   // from {list="..."}
  cards: PersonCard[];   // in authored order
  warnings: string[];    // one per problem, naming the card
}
```

`hName`/`hProperties` default to a `<ul class="lfm-person-cards">` of `<li>` cards, so a plain HTML render works with no framework. Astro and Svelte components read `data.personCards` instead.

## Privacy: redact by default

`degree` and `access` describe our relationships, not anything public. The plugin takes one option:

```ts
lfmPersonCards({ privateFields: 'redact' | 'keep' })  // default 'redact'
```

- **`redact` (default):** `degree` and `access` are removed from `data`, from `hProperties`, and from the rendered HTML. A public build can't leak them by forgetting a flag.
- **`keep`:** for local or private surfaces only (an internal dashboard, Obsidian preview, an agent reading the list).
- The **source markdown** still holds the values, so any document carrying filled-in private fields should be `publish: false`, and corpus roll-ups should respect that as they already do.

## Validation (warnings, not errors)

LFM doesn't hard-fail on content. Each problem adds one line to `warnings`:

- missing label or missing `why`
- `access` not an integer from 0 to 5; `degree` not in the allowed set
- `x` not on `x.com` or `twitter.com`; `linkedin` not on `linkedin.com/in/`
- `headshot` pointing at `pbs.twimg.com` or `media.licdn.com` (a hotlinked avatar)
- the same `x` or `linkedin` twice in one list
- any unknown attribute

## Tests

- Parses the example above into one `PersonCardList` with one card, types coerced (`access: "3"` becomes `3`, `""` becomes `null`).
- `twitter.com/foo` and `x.com/foo` both normalize to `https://x.com/foo`, `xHandle: "foo"`.
- Default options leave no trace of `degree` or `access` in `data` or the HTML string; `keep` leaves both.
- Each warning above fires on its fixture and nowhere else.
- An unknown attribute lands in `extra` and produces a warning.
- A bare `::person-card` outside a container normalizes as a list of one.
- Authored order is preserved.

## Docs

Per `AGENTS.md`: a row in the README's "What you can write" table, a guide in `docs-v/` listed in `docs-v/index.md`, and a sidebar slug in `user-docs/astro.config.mjs`.

## Open questions

- Is `person-card` the right name, or should it be `person` with `variant="card"`, leaving room for a compact row variant?
- Should `headshot` also accept `auto`, resolving from the person's X avatar at build time and caching to ImageKit?
- Do other sources belong as first-class fields (Bluesky, a personal site, newsletter, podcast), or in `extra`?
- Should `degree` and `access` move out of the markdown entirely, into a private sidecar keyed by `x` or `linkedin`, so the list itself can be published?

## Worked example: the first two lead lists

Gathered 2026-11-23 for the Agentic VC Dojo audience, from public rankings ([VC Power Rankings](https://charts.goodfuturemedia.com/), [Venture Capital Archive](https://venturecapitalarchive.com/blogs/top-25-vc-startup-influencers-you-should-be-following), [Capitaly](https://www.capitaly.vc/blog/15-vc-twitter-accounts-worth-following-2026), Lenny Rachitsky's [Top angel investors in the U.S.](https://www.lennysnewsletter.com/p/top-angel-investors-in-the-us), [OpenVC's AI angels](https://www.openvc.app/investor-lists/angel-investors-ai)) and model knowledge. `degree`, `access` and `headshot` are left blank on purpose.

### Influencer VCs

:::person-cards{list="influencer-vcs"}
::person-card[Marc Andreessen]{firm="Andreessen Horowitz" x="https://x.com/pmarca" linkedin="" headshot="" degree="" access="" why="Most-followed VC on X; sets the techno-optimist frame"}
::person-card[Sarah Guo]{firm="Conviction" x="https://x.com/saranormous" linkedin="https://www.linkedin.com/in/sarahxguo/" headshot="" degree="" access="" why="No Priors podcast with Elad Gil; AI-only fund"}
::person-card[Nathan Benaich]{firm="Air Street Capital" x="https://x.com/nathanbenaich" linkedin="" headshot="" degree="" access="" why="State of AI Report and the Guide to AI newsletter"}
::person-card[Harry Stebbings]{firm="20VC" x="https://x.com/HarryStebbings" linkedin="" headshot="" degree="" access="" why="20VC, the most-downloaded venture podcast"}
::person-card[Packy McCormick]{firm="Not Boring Capital" x="https://x.com/packyM" linkedin="" headshot="" degree="" access="" why="Not Boring newsletter; turned an audience into a fund"}
::person-card[Patrick O'Shaughnessy]{firm="Positive Sum" x="https://x.com/patrick_oshag" linkedin="" headshot="" degree="" access="" why="Invest Like the Best podcast; reaches investors across asset classes"}
::person-card[Tomasz Tunguz]{firm="Theory Ventures" x="https://x.com/ttunguz" linkedin="" headshot="" degree="" access="" why="Daily data-driven blog on SaaS and AI"}
::person-card[Elizabeth Yin]{firm="Hustle Fund" x="https://x.com/dunkhippo33" linkedin="" headshot="" degree="" access="" why="Tactical pre-seed fundraising content; answers founders publicly"}
::person-card[Fred Wilson]{firm="Union Square Ventures" x="https://x.com/fredwilson" linkedin="" headshot="" degree="" access="" why="AVC, one of the longest-running VC blogs"}
::person-card[Mark Suster]{firm="Upfront Ventures" x="https://x.com/msuster" linkedin="" headshot="" degree="" access="" why="Both Sides of the Table; candid on fundraising and boards"}
::person-card[Bill Gurley]{firm="Benchmark" x="https://x.com/bgurley" linkedin="" headshot="" degree="" access="" why="Long-form essays on marketplaces and IPOs"}
::person-card[Brad Feld]{firm="Foundry" x="https://x.com/bfeld" linkedin="" headshot="" degree="" access="" why="Venture Deals author; long-running blog"}
::person-card[Reid Hoffman]{firm="Greylock" x="https://x.com/reidhoffman" linkedin="" headshot="" degree="" access="" why="Blitzscaling; books and podcasts on AI"}
::person-card[Hunter Walk]{firm="Homebrew" x="https://x.com/hunterwalk" linkedin="" headshot="" degree="" access="" why="Seed investor who blogs openly about the venture business"}
::person-card[Garry Tan]{firm="Y Combinator" x="https://x.com/garrytan" linkedin="" headshot="" degree="" access="" why="YC president; large YouTube and X audience"}
::person-card[Paul Graham]{firm="Y Combinator" x="https://x.com/paulg" linkedin="" headshot="" degree="" access="" why="YC co-founder; the canonical startup essays"}
::person-card[Josh Kopelman]{firm="First Round Capital" x="https://x.com/joshk" linkedin="" headshot="" degree="" access="" why="Pioneered institutional seed; First Round Review"}
::person-card[Alexis Ohanian]{firm="Seven Seven Six" x="https://x.com/alexisohanian" linkedin="" headshot="" degree="" access="" why="Reddit co-founder; consumer and community voice"}
::person-card[Chamath Palihapitiya]{firm="Social Capital" x="https://x.com/chamath" linkedin="" headshot="" degree="" access="" why="All-In podcast co-host"}
::person-card[David Sacks]{firm="Craft Ventures" x="https://x.com/DavidSacks" linkedin="" headshot="" degree="" access="" why="All-In podcast co-host; SaaS go-to-market frameworks"}
::person-card[Turner Novak]{firm="Banana Capital" x="https://x.com/TurnerNovak" linkedin="" headshot="" degree="" access="" why="The Peel podcast; very active on X with founders"}
:::

### Influencer angel investors

:::person-cards{list="influencer-angels"}
::person-card[Elad Gil]{firm="Independent" x="https://x.com/eladgil" linkedin="" headshot="" degree="" access="" why="Among the most active AI angels; High Growth Handbook; No Priors co-host"}
::person-card[Naval Ravikant]{firm="AngelList" x="https://x.com/naval" linkedin="" headshot="" degree="" access="" why="AngelList co-founder; huge reach on wealth and leverage"}
::person-card[Jason Calacanis]{firm="LAUNCH" x="https://x.com/Jason" linkedin="" headshot="" degree="" access="" why="This Week in Startups and All-In; runs a syndicate"}
::person-card[Lenny Rachitsky]{firm="Independent" x="https://x.com/lennysan" linkedin="" headshot="" degree="" access="" why="Lenny's Newsletter and podcast; product and growth audience"}
::person-card[Gokul Rajaram]{firm="Independent" x="https://x.com/gokulr" linkedin="" headshot="" degree="" access="" why="Prolific operator-angel; shares hiring and product advice"}
::person-card[Nat Friedman]{firm="Independent" x="https://x.com/natfriedman" linkedin="" headshot="" degree="" access="" why="Former GitHub CEO; backs AI companies, often with Daniel Gross"}
::person-card[Daniel Gross]{firm="Independent" x="https://x.com/danielgross" linkedin="" headshot="" degree="" access="" why="AI-focused angel; co-invests with Nat Friedman"}
::person-card[Guillermo Rauch]{firm="Vercel" x="https://x.com/rauchg" linkedin="https://www.linkedin.com/in/rauchg/" headshot="" degree="" access="" why="Vercel CEO and active angel; big developer audience"}
::person-card[Cyan Banister]{firm="Independent" x="https://x.com/cyantist" linkedin="" headshot="" degree="" access="" why="Former Founders Fund partner; early angel in many companies"}
::person-card[Andrew Ng]{firm="AI Fund" x="https://x.com/AndrewYNg" linkedin="" headshot="" degree="" access="" why="DeepLearning.AI; The Batch newsletter reaches AI builders"}
::person-card[Edward Lando]{firm="Pareto Holdings" x="" linkedin="https://www.linkedin.com/in/edwardlando/" headshot="" degree="" access="" why="Ranked the most active U.S. angel; smaller audience, very high deal flow"}
:::

**Verify before outreach.** The X handles for Marc Andreessen, Sarah Guo, Harry Stebbings, Packy McCormick, Patrick O'Shaughnessy, Elizabeth Yin, Mark Suster, Bill Gurley, Reid Hoffman, Garry Tan, Paul Graham, Josh Kopelman, Alexis Ohanian, Chamath Palihapitiya, David Sacks, Elad Gil, Naval Ravikant, Jason Calacanis and Lenny Rachitsky were confirmed on the 2026 lists above. The rest come from model knowledge and haven't been checked. Firms change too.
