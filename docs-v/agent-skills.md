---
site_uuid: 94f87742-84d0-4261-b1f3-2444b57606c6
hex_code: rir1o4
title: "Agent Skills"
lede: "Cite an agent skill inline, or show a pack of them as cards, from a registry your site keeps."
publish: true
date_created: 2026-11-19
date_modified: 2026-11-19
date_authored_initial_draft: 2026-11-19
date_authored_current_draft: 2026-11-19
at_semantic_version: 0.0.1.0
status: Published
category: Docs
tags:
  - Agent-Skills
  - Directives
  - Suggested-Components
authors:
  - Michael Staton
augmented_with:
  - Claude Code on Claude Opus 5.5
---

# Agent skills

An [agent skill](https://agentskills.io/specification) is a folder with a `SKILL.md` that teaches Claude, Codex or another agent one kind of work. Posts about how a team works keep naming skills, so LFM has two directives for them: one that cites a skill in a sentence, and one that shows a set of skills as cards.

```markdown
Run :skill[timeline-scenario-analysis] after :skill[market-capture-analysis].

:::skill-pack{title="Diligence"}
- market-capture-analysis
- timeline-scenario-analysis
- competitive-analysis
:::

:::skill-pack{suite="memopop-ai"}
:::
```

**This is a suggested component, not a plugin.** LFM's preset already parses both forms with `remark-directive`, so nothing needs turning on: `:skill[slug]` arrives as a `textDirective` named `skill`, and `:::skill-pack` as a `containerDirective`. Your site keeps the registry of skills and draws the result. The reference implementation is [FullStack VC](https://github.com/lossless-group/fullstack-vc), live on [The VC Agent Skill Pack](https://fullstack-vc.com/guides/vc-agent-skill-pack/).

## The syntax

| You write | You get |
|---|---|
| `:skill[slug]` | An inline link to the skill, labelled with its name, the summary as its tooltip |
| `:::skill-pack` with a list of slugs | A grid of skill cards, in list order |
| `:::skill-pack{title="…"}` | The same grid with a small label above it |
| `:::skill-pack{suite="product"}` | Every skill a product rolls up, led by that product's own card; listed slugs come first |
| `:::agent-skills` | An alias of `:::skill-pack` |

A list item can be a plain slug, a slug in backticks, or a link whose URL ends `/skills/<slug>`. Only the first word counts, so `- market-capture-analysis: size it first` works. An unknown slug drops one card instead of failing the page.

## The registry

The site keeps one list of skills it can show, as JSON or a content collection. Each entry needs enough to draw a card and to link to the folder:

```ts
interface AgentSkill {
  slug: string;        // the folder name, which is what authors write
  name: string;
  category: string;
  summary: string;     // one sentence; also the inline link's tooltip
  use_for?: string;
  status?: string;     // "Ready" or "Draft"
  suite?: string;      // the product that rolls this skill up
  repo: string;        // "owner/name" on GitHub
  branch?: string;     // defaults to main
  path?: string;       // defaults to the slug
}
```

From `repo`, `branch` and `path` the site can build three links: the folder for people (`github.com/<repo>/tree/<branch>/<path>`), the raw `SKILL.md` for agents (`raw.githubusercontent.com/<repo>/<branch>/<path>/SKILL.md`), and a one-line prompt that loads the skill in any chat: *"Read the Market Capture Analysis skill at &lt;raw URL&gt; and follow it."*

Keeping the registry in the site, not fetching it at build time, means the site deploys on its own and a skill moving repositories breaks nothing until someone updates one entry.

## Rendering it

In your `AstroMarkdown.astro` (or whichever component walks the tree), dispatch on the two directive names:

```astro
{type === 'containerDirective' && (node.name === 'skill-pack' || node.name === 'agent-skills') && (
  <SkillPack node={node} />
)}

{type === 'textDirective' && node.name === 'skill' && (() => {
  const s = getSkill(toString(node));
  return s
    ? <a class="skill-ref" href={skillUrl(s)} title={s.summary}>{s.name}</a>
    : <code>{toString(node)}</code>;
})()}
```

`SkillPack` collects the slugs from the list items, appends the suite's skills when `suite` is set, looks each one up, and draws a card per skill. A card worth copying shows the category, a Draft badge when it applies, the name linking to the folder, the summary, what it's for, the product it belongs to, and a **Copy the prompt** button. The FullStack VC versions are a good place to start:

- [`SkillPack.astro`](https://github.com/lossless-group/fullstack-vc/blob/master/src/components/markdown/SkillPack.astro): the directive
- [`SkillCard.astro`](https://github.com/lossless-group/fullstack-vc/blob/master/src/components/stack/SkillCard.astro): one card
- [`agent-skills.ts`](https://github.com/lossless-group/fullstack-vc/blob/master/src/lib/agent-skills.ts): lookups and links

Copy them and restyle them for your site: they're a pattern, not a dependency.

## Why not a wikilink?

`[[skills/market-capture-analysis]]` reads well, but a wikilink resolves to a page on your own site, and most sites don't have a page per skill. The directive says what the thing *is*, so the renderer can link to where the skill actually lives and show what it's for. `:::skill-pack` still accepts `/skills/<slug>` links in its list, so content written with wikilinks keeps working.
