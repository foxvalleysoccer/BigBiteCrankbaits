# Fishing Buddy Video Factory

This folder is the local-first implementation scaffold for the submission-to-song-to-video workflow described in `../docs/Fishing_Buddy_Automation_Codex_Always_On_PC_Build_Guide.md`.

## Goals

- run on Josh's always-on Windows PC
- support manual queue processing as a first-class workflow
- keep cloud API spend out of the required path for text generation
- make the model layer replaceable
- keep Suno automation, rendering, and review local

## Current Scaffold

- `apps/server/` - Fastify-based operator API and queue entry points
- `docs/architecture.md` - local-first architecture summary
- `scripts/process-pending-submissions.ps1` - operator command wrapper
- `config/.env.example` - starting point for local configuration
- `apps/server/src/submission-intake.ts` - file-backed intake endpoint and pending submission storage

## Intended First Commands

After dependencies are installed later, the baseline operator flow should look like this:

```powershell
npm install
npm run dev
npm run process:pending
```

The server is intentionally designed so Josh can either:

- click a dashboard button
- run a local script
- tell Codex to invoke the local process

without changing the underlying workflow implementation.

## Current Intake Endpoint

When the local server is running, it exposes:

- `POST /api/submissions/fishing-buddy`

That gives the public form a real structured intake target to use when Josh later places the local service behind a secure tunnel or another controlled route. Until then, the website still falls back to the prefilled Gmail draft flow.

## Zero-Install Bootstrap Path

Because some machines may not have Node.js and npm configured yet, there is also a no-dependency bootstrap server:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-local-server.ps1
```

That bootstrap server uses a local `node.exe` if one is available and exposes:

- `GET /health`
- `POST /api/submissions/fishing-buddy`
- `POST /operator/process-pending-submissions`

It stores queued submissions in `fishing-buddy-video-factory/data/submissions.json`.
