---
title: "Common Dialog and Caption File Formats"
lede: "The small text formats that captions and transcripts arrive in, and which ones carry speakers."
date_created: 2026-11-22
date_modified: 2026-11-22
site_uuid: e9dad480-5f73-4b2f-b957-537db96a8b6f
hex_code: y2at2b
authors:
  - Michael Staton
augmented_with:
  - Claude Code on Claude Opus 5.5
tags: [Transcripts, Captions, Subtitles, File-Formats]
type: Notes
---

# Common Dialog and Caption File Formats

## Caption and subtitle formats

- **SRT (SubRip)** is the most common. It has numbered cues with `00:01:02,500 --> 00:01:05,000` and no speaker field; speakers are written as `Name:` in the text by convention.
- **WebVTT (`.vtt`)** is the web standard for video captions. YouTube, Vimeo and Zoom export it, and it supports speakers with `<v Name>` tags.
- **SBV** is YouTube's older format, like SRT without the numbers.
- **TTML / DFXP** is XML with speaker support (`ttm:agent`), used in broadcast and streaming.
- **YouTube timedtext** is the XML or JSON that tools pulling YouTube captions actually receive.
- **SCC**, **ASS/SSA** and **LRC** are rare for our sources: US broadcast captions, styled fan subtitles, and song lyrics.
