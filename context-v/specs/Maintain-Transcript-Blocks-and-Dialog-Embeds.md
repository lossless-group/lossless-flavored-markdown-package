---
title: "Maintain Transcript Blocks and Dialog Embeds"
lede: "Stenographer already writes `:::transcript` blocks, and its docs say LFM links their timestamps. LFM has never heard of them. This turns the block into structured segments with stable anchors and source links, and lets another document quote a moment the way it quotes a section."
date_created: 2026-11-22
date_modified: 2026-11-22
date_authored_initial_draft: 2026-11-22
date_authored_current_draft: 2026-11-22
at_semantic_version: 0.0.0.1
status: Draft
publish: true
site_uuid: 0caef061-2297-472d-8aec-d0e1a67f02fd
hex_code: h75ro7
authors:
  - Michael Staton
augmented_with:
  - Claude Code on Claude Opus 5.5
tags:
  - Directives
  - Transcripts
  - Dialog
  - Cross-Reference-Embeds
  - Citations
  - Stenographer
type: Specs
---

# Maintain Transcript Blocks and Dialog Embeds

## Why

More and more of the source material we cite is spoken: talks, founder interviews, podcasts, launch videos. [Stenographer](https://github.com/lossless-group/stenographer), our Obsidian plugin, turns a YouTube, TikTok or podcast link into a note with a timestamped, speaker-aware transcript, written as an LFM `:::transcript` block:

```markdown
:::transcript
[00:00] **A**: The thing everybody gets wrong about distribution is that they treat it as a channel problem.

[00:14] **B**: Say more about that.
:::
```

That block reads fine as plain markdown. What it can't do yet is anything more: link a timestamp to that moment in the video, give a moment a URL, or let another document quote it. The [Self-Generating Content Farm](https://github.com/lossless-group/lossless-content/blob/development/specs/Self-Generating-Content-Farm-for-Content-Marketing.md) spec depends on all three, because it requires every claim to cite a source a reader can check, and for a video that means the exact second.

## What we checked (2026-11-22)

- **LFM has no transcript handling.** "transcript" appears nowhere in `lfm/src`, its tests or docs, or in `astro-knots/packages/lfm`.
- **No site renders one.** No Astro Knots site has a transcript component.
- **Stenographer says otherwise.** Its README says the block "hydrates into an interactive, timestamp-linked player when published through an Astro Knots site", and `src/transcript/lfm.ts` says both timestamp forms "trigger LFM timestamp linking". Neither is true yet. Those lines should be corrected in Stenographer, or this spec should be built.
- **The nearest existing feature** is [cross-reference embeds](../../src/plugins/lfm-cross-reference-embeds.ts): `![[Note#Heading]]` puts a section of another document into this one. A transcript moment isn't a heading, so it needs its own form.

## The dialog formats out there

Transcripts and captions arrive in a handful of small text formats. They're all tiny, a few kilobytes to a few hundred for an hour of speech.

| Format | Shape | Speakers | Where you meet it |
|---|---|---|---|
| **SRT** (SubRip) | Numbered cues, `00:01:02,500 --> 00:01:05,000`, then text | No field. By convention, `Name:` in the text | The most common subtitle file. Exported by almost everything. |
| **WebVTT** (`.vtt`) | `WEBVTT` header, cues with `00:01:02.500 --> …`, optional cue settings | Yes, `<v Name>` voice tags | The web standard for `<track>`. YouTube, Vimeo and Zoom export it. |
| **SBV** | Like SRT without numbers, `0:01:02.500,0:01:05.000` | No | YouTube's older caption format |
| **TTML / DFXP** | XML, `<p begin="…" end="…">` | Yes, `ttm:agent` | Broadcast and streaming (Netflix's IMSC is a TTML profile) |
| **YouTube timedtext** | XML (`srv1`–`srv3`) or JSON (`json3`) from the caption endpoint | No | What tools pulling YouTube captions actually receive |
| **SCC** | Hex-encoded CEA-608 broadcast captions | No | US broadcast TV. Rare for our sources. |
| **ASS / SSA** | INI-like sections with styled dialogue events | A `Name` field per line | Fan subtitles, styled karaoke |
| **LRC** | `[mm:ss.xx]` per line | No | Song lyrics |
| **Podcasting 2.0 JSON** | `{"segments":[{"startTime","endTime","speaker","body"}]}` | Yes | The `<podcast:transcript>` tag, which also allows SRT, VTT and HTML |
| **Provider JSON** | Words or utterances with start and end times, speaker labels, confidence | Yes, when diarized | AssemblyAI, Deepgram, Whisper's `verbose_json`, Supadata |
| **Speaker-labelled text** | `Name (00:01:02): text` | Yes | Otter, Descript, Rev and Zoom text exports |

## Decisions

### 1. LFM reads one dialog form, `:::transcript`, and doesn't parse caption files

Converting SRT, VTT, provider JSON and the rest happens at capture, before content exists. Stenographer already does it: everything it ingests comes out as one `:::transcript` block. That keeps content in one format, keeps LFM small, and means a converter fix never forces a content migration.

A later, opt-in subpath could accept ` ```srt ` and ` ```vtt ` fences and turn them into the same data, following the precedent of `src/formats/` (PlantUML, YANG, JSON Schema). That's an open question, not part of this spec's first phase.

### 2. The line grammar is what Stenographer writes, with tolerance

Inside `:::transcript`, each paragraph is one segment:

```text
[MM:SS] text
[HH:MM:SS] **Speaker**: text
[HH:MM:SS.mmm] **Speaker**: text      (milliseconds allowed, not required)
```

- A timestamp starts a segment. Its end is the next segment's start. The last segment's end is unknown unless `end` is given on the block.
- `**Speaker**:` right after the timestamp is optional.
- A paragraph with no timestamp continues the previous segment, so a hand edit never breaks the block.
- A block with no timestamps at all is a valid, untimed transcript.
- Nothing here throws. A line LFM can't read is kept as text, and the block's `status` says so.

### 3. The block becomes structured data, and keeps its children

Like `:::image-carousel`, the plugin normalizes the directive into one renderer-ready shape and leaves the original children in place, so a renderer that knows nothing about transcripts still shows readable text.

```ts
containerDirective  name: 'transcript'
  attributes  { src?, title?, lang? }
  data.transcript {
    source:   { url, kind: 'youtube' | 'vimeo' | 'audio' | 'other' } | null,
    timed:    boolean,
    speakers: string[],                    // in order of first appearance
    segments: Array<{
      id:      string,                      // 't-1234' — the start in whole seconds
      start:   number,                      // seconds
      end:     number | null,
      speaker: string | null,
      text:    string,
      href:    string | null,               // the source at this moment
    }>,
    status:   'ok' | 'untimed' | 'partial',  // 'partial' = some lines couldn't be read
  }
```

### 4. The source comes from the block, or the site says where to look

`src` on the block wins: `:::transcript{src="https://www.youtube.com/watch?v=…"}`. Without it, LFM uses a site-supplied `resolveTranscriptSource(file)` option, so a site can read Stenographer's frontmatter (`youtube_url`, `apple_podcasts_url`, `soundcloud_url` and the rest). LFM never reads frontmatter or the filesystem itself, the same rule cross-reference embeds follow.

### 5. Every segment gets a stable anchor and a link to its moment

- **Anchor:** `#t-1234`, the start in whole seconds. If two segments start in the same second, the second one gets `t-1234-2`. A fragment URL is a public contract (see [Maintain Heading Anchors and Share Links](Maintain-Heading-Anchors-and-Share-Links.md)), so this scheme doesn't change once shipped.
- **Link to the moment**, built per source kind:

| Source | Deep link |
|---|---|
| YouTube | `…watch?v=ID&t=1234s` (or `youtu.be/ID?t=1234`) |
| Vimeo | `…/ID#t=1234s` |
| Direct audio or video file | Media fragment `#t=1234` |
| Anything else | The source URL, no time |

### 6. Another document can quote a moment

Cross-reference embeds gain a time form:

```markdown
![[How We Think About Distribution#t=12:34]]         the segment at 12:34
![[How We Think About Distribution#t=12:34-13:10]]   every segment in that range
![[How We Think About Distribution#t-754]]           by anchor id
```

It emits the same `cross-reference-embed` node, with `data.crossReferenceEmbed.kind: 'transcript'` and the quoted segments, each carrying its `href`. When the moment isn't there, `status` is `'missing-moment'`, and the block is still emitted with the link, as cross-reference embeds already do.

This is what the Content Farm needs to cite a video: the quote, the speaker, and a link to the exact second.

### 7. LFM ships data, not a player

The transcript list, speaker styling, timestamp links and any embedded player that seeks on click belong to the site's component library (an Astro Knots `Transcript` component), reading `data.transcript`. LFM stays framework-neutral, as it does for carousels and link previews.

## Tests

- Real Stenographer output parses to the expected segments, speakers and `timed: true`. All 11 notes in `lossless-content/sources/Transcripts/` carry a `:::transcript` block. Copy a few in as fixtures (Stenographer has none of its own yet).
- `[MM:SS]`, `[HH:MM:SS]` and `[HH:MM:SS.mmm]` all parse, and the start is in seconds.
- A paragraph with no timestamp joins the previous segment.
- An untimed block gives `timed: false`, one segment, `status: 'untimed'`.
- A malformed line leaves the text in place and sets `status: 'partial'`, never throws.
- Anchors are stable and collision-free for two segments in the same second.
- Deep links are correct for YouTube, youtu.be, Vimeo and a direct `.mp3`.
- `src` on the block beats `resolveTranscriptSource`. No source gives `href: null` everywhere.
- `![[Note#t=12:34]]`, a range, and an anchor id each embed the right segments. A missing moment gives `'missing-moment'`.
- The children survive, so a plain-HTML render still shows the text.

## Phases

1. **Parse.** The `:::transcript` plugin and `data.transcript`, with anchors and deep links. Fix Stenographer's README and comments to match what's shipped.
2. **Render.** An Astro Knots `Transcript` component on one site, with timestamp links and an optional player.
3. **Quote.** The time form of cross-reference embeds.
4. **Maybe.** ` ```srt ` and ` ```vtt ` fence formats as an opt-in subpath.

## Open questions

- Should `end` times be written by Stenographer (it has them, then drops them when grouping), or always inferred?
- Does a range quote render as one block or as separate segments?
- Do speaker names link anywhere, such as a person note in the vault, through the wikilink resolver?
- Which site is first: lossless.group for `sources/Transcripts/`, or fullstack-vc.com for the Dojo?

## Related

- [Stenographer](https://github.com/lossless-group/stenographer), especially `src/transcript/lfm.ts`
- `content-farm/context-v/specs/Stenographer-an-Obsidian-Plugin-that-transcribes-Audio-Content.md`
- [Maintain Directives in Extended Markdown Render Pipeline](Maintain-Directives-in-Extended-Markdown-Render-Pipeline.md)
- [Maintain Heading Anchors and Share Links](Maintain-Heading-Anchors-and-Share-Links.md)
- `src/plugins/lfm-cross-reference-embeds.ts`, `src/plugins/lfm-image-carousel.ts`
- [Self-Generating Content Farm for Content Marketing](https://github.com/lossless-group/lossless-content/blob/development/specs/Self-Generating-Content-Farm-for-Content-Marketing.md)
