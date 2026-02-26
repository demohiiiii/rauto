---
name: rauto-usage
description: Use this skill when guiding users to operate the rauto CLI or Web UI, including connection setup, execution modes (direct/template/tx), transaction workflows, recording/replay, and profile/template management. Applies to tasks like “how to run rauto”, “start web UI”, “manage templates/profiles”, “use tx/workflow”, “view history/recordings”, and “where files are stored under ~/.rauto”.
---

# Rauto Usage

## Overview

Guide practical, end-to-end usage of rauto across CLI and Web UI, focusing on execution flows, connection management, and troubleshooting. Keep answers concise and action-oriented; prefer concrete command examples and UI steps.

## Quick Start

1. **CLI execute**: `rauto exec "show version" --host <ip> --username <user> --password <pass>`
2. **Web UI**: `rauto web --bind 127.0.0.1 --port 3000`, then open the URL.
3. **Use saved connection**: `--connection <name>` or pick it in Web UI.

## Core Tasks

### 1) Connections and Defaults
- Explain the priority order: CLI flags > saved connection > web defaults.
- For saving connections, show the CLI/global flags and Web “Saved Connections” section.
- When asked about storage, point to `~/.rauto/` (see references).

### 2) Execute Commands
- **Direct exec**: use CLI `exec` or Web “Execute / Direct”.
- **Template render + exec**: use CLI `template` or Web “Execute / Template”.
- Mention `mode` when needed (Enable/Config/other state names).

### 3) Transaction Blocks and Workflows
- **Tx block**: explain commands list, rollback policy, and dry-run.
- **Tx workflow**: load JSON or build in Web UI.
- Recommend preview before execute; call out rollback risks.

### 4) Recording and Replay
- Recording level: `key-events-only` vs `full`.
- Replay: CLI `replay` with JSONL, Web replay tab or record drawer.
- For large JSONL, suggest filtering or raw view.

### 5) Templates and Profiles
- Templates: list/show/create/update/delete.
- Profiles: list/show/copy builtin, diagnose, and custom profile form in Web.

## Output Guidance

- Provide concrete commands with placeholders.
- When Web UI is requested, map to the exact tab/card names.
- When user is stuck, ask for the minimal missing details (host, profile, template, mode).

## References

- For CLI command list: see `references/cli.md`.
- For Web UI map: see `references/web.md`.
- For config/layout paths: see `references/paths.md`.
- For common troubleshooting steps: see `references/troubleshooting.md`.
- For end-to-end usage scenarios: see `references/scenarios.md`.
