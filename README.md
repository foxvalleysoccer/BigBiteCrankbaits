# BigBiteCrankbaits

This repo currently contains two related pieces of work:

1. The public `BigBiteCrankbaits` static website that is deployed from GitHub Pages.
2. The local-first `Fishing Buddy Video Factory` automation plan and implementation scaffold that is meant to run on Josh's always-on Windows PC.

## Public Site

The existing top-level files such as `index.html`, `privacy-policy.html`, `OrderCompleted.html`, and `Images/` remain the public storefront and content layer.

## Fishing Buddy Video Factory

The new local automation work lives in `fishing-buddy-video-factory/`.

That subsystem is designed around these rules:

- normal operation should not require cloud text-generation API costs
- Josh must be able to process pending submissions manually on demand
- scheduled batch processing is supported, but constant inbox monitoring is optional
- Codex is the builder and operator assistant, not the only runtime dependency
- creative generation should run through a local model provider interface
- Suno browser automation, FFmpeg rendering, and final review happen on the dedicated PC

## Documents

- `docs/Fishing_Buddy_Automation_Codex_Always_On_PC_Build_Guide.docx`
- `docs/Fishing_Buddy_Automation_Codex_Always_On_PC_Build_Guide.md`

The Markdown file mirrors the current local-first spec so it can be edited and diffed more easily than the `.docx`.

## Next Implementation Targets

- flesh out the local SQLite schema and migration setup
- build the submission intake path for website and email import
- add the local model provider adapter and prompt pipeline
- connect the workflow runner to real Suno download handling
- add the desktop review dashboard and clip catalog UI
