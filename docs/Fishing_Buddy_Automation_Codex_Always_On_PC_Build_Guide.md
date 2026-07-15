# FISHING BUDDY VIDEO FACTORY

Rewritten local-first build brief for Josh's always-on Windows PC

Primary objective: build a production-capable workflow that runs on Josh's dedicated PC, uses local resources first, avoids required cloud API costs for text generation, and supports either manual or scheduled processing of submissions. The system should let Josh sign into the machine and tell Codex to process pending submissions, or run the same batch flow on a schedule when desired.

## 1. Executive Build Goal

Build a local automation service called Fishing Buddy Video Factory. It runs on Josh's always-on Windows PC and uses local storage, local GPU-backed model inference, local browser automation, local rendering, and a local review dashboard. Codex is used to build, improve, troubleshoot, and optionally operate the workflow, but the production pipeline must continue to exist as software Josh owns and runs on his machine.

The public Big Bite Crank Baits website remains a static submission front end on GitHub Pages unless Josh chooses a different front end later. Processing, review, video assembly, and approval happen on the dedicated PC.

## 2. Non-Negotiable Product Direction

No required OpenAI or other per-call API cost for normal operation. The default creative generation path must use a local GPU-backed model runner installed on Josh's machine. The exact runner can be chosen later, but the architecture must be provider-agnostic so the model layer can be swapped without changing the rest of the system.

Codex is not the always-on runtime engine. Codex is the builder, maintainer, and optional operator interface. The permanent workflow must be executable locally even when Josh simply clicks a button, runs a script, or tells Codex to invoke the local process.

Constant inbox monitoring is optional, not required. The system must support manual processing, scheduled batch processing, and optional automatic polling as separate operating modes.

## 3. Required Operating Modes

- Manual operator mode: Josh logs into the PC or remote session and tells Codex or the local dashboard to process all pending submissions. This mode should be treated as a first-class workflow, not a fallback.
- Scheduled batch mode: the PC checks for new submissions on a defined schedule such as once every morning, once every evening, or every hour during specific windows. Josh should be able to configure these schedules without code edits.
- Optional continuous monitoring mode: the inbox or intake endpoint may be watched continuously later, but the system must not depend on that behavior to be useful.

## 4. What the System Must Do

- Accept a fishing-story submission from the website or from a structured email intake.
- Store the submission in a local durable queue with status history and idempotent processing.
- Generate a comedy brief, two lyric variants, metadata, and render instructions using a local model running on Josh's GPU or another local inference path.
- Open Suno in an assisted browser session, submit the prepared lyrics and style prompts, and download the resulting songs when available.
- Assemble two distinct videos using local fishing footage and FFmpeg.
- Present both songs and both videos in a review dashboard before anything is published.
- Allow Josh to approve, reject, regenerate, replace audio manually, or rerender video variants.

## 5. Target User Experience

1. A viewer submits a story through the website or a structured intake email.
2. Josh later logs into the machine and says process pending submissions, or the scheduled batch window starts automatically.
3. The local worker validates the submission, generates two variants, drives Suno, selects clips, renders two videos, and prepares a side-by-side review page.
4. Josh opens one dashboard view to compare Version A and Version B, then approves one, rejects both, or regenerates part of the job.
5. Nothing becomes public until Josh explicitly approves publication.

## 6. Codex Role

Codex should be treated as a powerful operator and engineering assistant. Josh may use Codex to build new features, repair failures, review logs, process a backlog on demand, or trigger local scripts. The system should also expose direct scripts and dashboard controls so it does not require a live Codex session for basic operation.

Examples of acceptable operator flows:

- Josh tells Codex: process all pending submissions.
- Josh tells Codex: rerun failed Suno downloads.
- Josh opens the dashboard and clicks Process Queue.
- Task Scheduler starts the worker at a configured time and processes the queue without manual prompting.

## 7. Recommended Local Architecture

- Public site: existing GitHub Pages submission pages.
- Local application: Node.js and TypeScript service with API endpoints, dashboard hosting, durable workflow engine, and local command entry points.
- Admin dashboard: local desktop-first dashboard for review, queue control, logs, clip management, and publish actions.
- Database: SQLite with an audit trail for every state transition.
- Creative engine: local GPU-backed model runtime behind an internal adapter interface. No cloud text-generation dependency is required for normal operation.
- Browser automation: Playwright with a dedicated persistent browser profile for Suno and any other assisted websites.
- Renderer: FFmpeg and ffprobe for deterministic video assembly and validation.
- Remote access: optional secure remote login such as Tailscale or another controlled access method.

## 8. Intake Design

Preferred intake is still a structured submission form on the website. It may post to a secure endpoint or emit a structured email that the local worker can ingest later.

Inbox monitoring must be configurable. Minimum supported behavior is manual fetch on command. Stronger modes include scheduled polling and optional continuous monitoring.

Every imported message or form submission must be stored once, assigned a durable identifier, and protected against duplicate processing.

## 9. Creative Generation Without Cloud API Cost

The workflow must assume a local model layer, not a paid cloud API. The implementation should support prompt templates, schema validation, moderation rules, and two clearly distinct lyrical variants generated from the same approved facts.

The model layer must be abstracted behind a provider interface so the exact local runtime can change later without rewriting the queue, Suno automation, renderer, or dashboard.

If the local model is unavailable, the system should support a manual operator review path where Josh can edit prompts or lyrics before continuing.

## 10. Assisted Suno Automation

Suno should be driven through a visible assisted browser session using Playwright and a persistent profile. Josh signs in once and can intervene if Suno prompts for login, confirmation, or other manual steps.

The system should avoid runaway retries and should respect configurable attempt ceilings. Browser automation must pause cleanly for manual intervention instead of repeatedly clicking through an unknown page state.

Manual audio upload must remain available so the rest of the workflow can continue if Suno automation is temporarily broken.

## 11. Clips and Rendering

The PC maintains a local catalog of fishing footage with statuses such as unused, reserved, used, and rejected. Original footage must never be destroyed by the workflow.

Video A and Video B should use meaningfully different visual timelines when enough source material exists.

Rendering must happen locally with FFmpeg. The system should build a reproducible timeline description before render, save the exact FFmpeg command, validate outputs with ffprobe, and preserve failure logs.

## 12. Review and Approval

The core deliverable is a local review dashboard that shows Song A, Video A, Song B, and Video B together on one page with enough metadata to compare them quickly.

Required controls include approve A, approve B, reject both, regenerate lyrics, regenerate one song path, rerender one video path, replace audio manually, reselect clips, and publish approved version.

No publication, requester email, or public posting should occur before Josh approves a final version.

## 13. Security and Operations

- Secrets, tokens, browser profiles, generated media, and databases must remain outside source control.
- The dashboard should require local authentication even on the PC itself.
- Remote access should use a secure overlay rather than exposing local services directly to the public internet.
- The machine should support backup, restore, restart recovery, and a health-check script because it is intended to stay on continuously.

## 14. Build Priorities for Codex

1. Phase 1: local queue, SQLite schema, logging, dashboard shell, install scripts, and operator commands.
2. Phase 2: website intake, email import, local model provider interface, prompt system, moderation, and two-variant output.
3. Phase 3: Suno browser automation, download handling, retry rules, and manual intervention controls.
4. Phase 4: clip catalog, selection rules, FFmpeg rendering, preview outputs, and review dashboard.
5. Phase 5: publish controls, notifications, backup and restore, hardening, and restart recovery.

## 15. Definition of Done

The project is done only when Josh can either manually trigger processing or let a schedule trigger processing, the local PC can create two song candidates and two video candidates without required cloud text-generation costs, and one review dashboard shows both versions before publication.

Codex must leave behind a working local repository, scripts, configuration templates, setup steps, operational checklist, and recovery tools. The system should be usable both as a semi-automated assistant Josh actively directs and as a scheduled batch processor when he wants less hands-on involvement.
