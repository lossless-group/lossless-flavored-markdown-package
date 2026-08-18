---
title: Image carousels
kind: feature
plugin: lfm-image-carousel
result_label: containerDirective data.carousel
order: 80
note: >-
  A real carousel, lifted from a published guide on `fullstack-vc` — four
  screenshots of a browser onboarding flow, with the alt text and captions the
  author actually wrote. Slides are extracted, the `img-carousel` alias
  collapses, and order is resolved. Watch the ordering: `peek` is a sequence
  variant, so it sorts chronologically by the ISO stamp in each filename — and
  one of these images was re-uploaded after redaction, so it carries a later
  stamp and lands out of sequence. That is the documented failure mode, shown
  rather than described. `sort="authored"` opts out.
---

:::image-carousel{variant="peek" title="Setting up Aside"}
::image{src="https://ik.imagekit.io/xvpgfijuw/fullstack-vc/agent-native-browsers/Aside__Welcome-Screen_20260817T164659Z.jpg" alt="Aside's first-run welcome screen, headlined 'The AI browser that gets complex work done across your Websites, Accounts, History', with a preview of the sidebar showing Tasks, Routines and Customize" label="Welcome" caption="'Websites, Accounts, History' is the category thesis in three words — and the security problem in the same three."}
::image{src="https://ik.imagekit.io/xvpgfijuw/fullstack-vc/agent-native-browsers/Aside__Onboarding--Recovery-Key_20260817T171052Z.jpg" alt="Aside onboarding step titled 'Back up your recovery key', explaining that the key lets you reset your password and cannot be recovered if lost, with the twelve-word phrase and key identifier redacted" label="Recovery key" caption="Twelve words, unrecoverable if lost. Redacted here — treat it like a seed phrase, because it is one."}
::image{src="https://ik.imagekit.io/xvpgfijuw/fullstack-vc/agent-native-browsers/Aside__Onboarding--Browser-Agent_20260817T164659Z.jpg" alt="Aside onboarding slide reading 'Anything you do in a browser, Aside can do for you', with example prompts including 'Write an investor update' and 'Find unused subs and request refunds' above a row of app icons for Gmail, WhatsApp, Notion and Jira" label="The agent" caption="Note the first example prompt — 'Write an investor update.' These products know exactly who is buying."}
::image{src="https://ik.imagekit.io/xvpgfijuw/fullstack-vc/agent-native-browsers/Aside__Onboarding--Setup-Complete_20260817T164659Z.jpg" alt="Aside's final setup screen, 'You're all set!', with three checked options: set Aside as default browser, add Aside to Dock, and share crash and usage statistics" label="Done" caption="Default browser, Dock, telemetry — the third one is worth an actual decision."}
:::
