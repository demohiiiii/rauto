---
name: rauto-usage
description: Use this skill when users ask how to use rauto in CLI or Web UI, including setup, saved connections, direct/template execution, tx block/workflow orchestration, profile/template management, interactive session, recording/replay, history, and backup/restore under ~/.rauto. Trigger on requests like “run command on device”, “start rauto web”, “manage prompt profile/template”, “build tx workflow”, “replay/inspect records”, “view connection history”, “backup and restore rauto data”.
---

# Rauto Usage

Provide accurate, runnable guidance for rauto.
Prefer concrete commands and exact Web tab/card paths.

## Trigger Examples

Use this skill for prompts like:

- "How do I run a command on a Cisco device?"
- "How do I render a template and then execute?"
- "How do I use tx workflow with rollback?"
- "How do I manage profiles/templates in web?"
- "How do I replay recordings and inspect history?"
- "How do I backup and restore all rauto data?"

## Response Rules

1. Give a minimal working example first, then optional advanced flags.
2. Use placeholders: `<host>`, `<username>`, `<password>`, `<connection>`.
3. If Web is requested, map to exact path: top tab -> card -> action button.
4. Mention risk for destructive operations (tx replace rollback, restore replace).
5. When troubleshooting, ask only missing required inputs.

## Quick Start Snippets

```bash
# Direct execution
rauto exec "show version" --host <host> --username <username> --password <password>

# Start web
rauto web --bind 127.0.0.1 --port 3000

# Use saved connection
rauto exec "show ip int brief" --connection <connection>
```

## Navigation (Load References On Demand)

Read only what is needed:

- Full CLI command cookbook and all command examples: `references/cli.md`
- Web tab/card mapping and UI operations: `references/web.md`
- Runtime storage paths under `~/.rauto`: `references/paths.md`
- Error diagnosis and recovery: `references/troubleshooting.md`
- End-to-end deployment and rollback scenarios: `references/scenarios.md`
- Comprehensive "ask -> answer" examples for AI: `references/examples.md`
- Chinese prompt-to-answer examples: `references/examples_zh.md`

## Output Template

Use this structure when user asks "how to do X":

1. Goal (one line)
2. Fastest command/UI path
3. Optional safe mode (dry-run/preview/recording)
4. Verification step
5. Rollback/fallback (if risky)
