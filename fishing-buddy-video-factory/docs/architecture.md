# Architecture Summary

## Core principle

The local PC owns the queue, state, browser automation, rendering, and review experience. Codex may operate the workflow, but the workflow must still exist as normal local software and scripts.

## Operator paths

- Manual run: Josh or Codex triggers `process pending submissions`.
- Scheduled run: Task Scheduler or a local timer triggers the same queue processor.
- Optional polling: inbox intake can later call the same queue entry point on a cadence.

## Initial components

- Fastify operator API for health and queue control
- local workflow coordinator with explicit states
- provider interfaces for intake, local text generation, Suno browser work, clip selection, rendering, and review publishing
- PowerShell entry points for Windows-first operation

## Early boundaries

- No direct dependency on cloud text-generation APIs
- No assumption that inbox polling runs all day
- No assumption that Codex is always attached to the machine

## First implementation milestone

Wire a single operator command that loads pending submissions from SQLite, transitions them through placeholder stages, and exposes the result in logs and the API.
