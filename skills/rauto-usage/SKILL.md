---
name: rauto-usage
description: Execute rauto directly for the user: run device commands, template execution, tx block, tx workflow, replay, backup/restore, and connection/profile/template/history operations. Trigger on requests like run command for me, execute on device, check history, run workflow, diagnose profile, manage templates/profiles/connections, replay records, or restore backup.
---

# Rauto Usage

Execute rauto operations directly for users whenever possible.
Do not default to tutorial-style answers.

## Core Mode

Prefer action-first behavior:

1. Parse user goal into a concrete rauto operation.
2. Run the relevant `rauto` command in terminal.
3. Return key results (not raw noise), plus command used.
4. Ask only minimal missing inputs when blocked.

## Execution Rules

1. For read/query requests, execute immediately:
   - examples: `device list`, `templates list`, `show-connection`, `connection-history`, `replay --list`.
2. For execution requests, execute with user-provided parameters:
   - examples: `exec`, `template`, `tx`, `tx-workflow`.
3. Resolve connection in this priority:
   - explicit command args > `--connection <name>` > ask for missing fields.
4. Do not ask the user to manually run commands if agent can run them.
5. Summarize outputs with important fields:
   - target, mode, success/failure, key errors, next action.

## Risk Guardrails

Require explicit user confirmation before destructive actions:

- `rauto backup restore ... --replace`
- profile/template/connection delete operations
- tx/workflow execution that changes config when user intent is ambiguous

If user explicitly asks to execute destructive action, proceed.

## Missing Input Strategy

Ask only for missing must-have fields:

- For `exec/template/tx/tx-workflow/test-connection`:
  - need either full host credentials or usable `--connection`.
- For `replay`:
  - need record file path or JSONL source.
- For history queries:
  - need connection name.

## Response Format

When command is executed, report:

1. `Operation`: what was run
2. `Command`: exact rauto command
3. `Result`: key output summary
4. `Notes`: risk, errors, or follow-up actions

## Navigation (Load References On Demand)

- Agent execution decision tree and command templates: `references/agent-execution.md`
- Full CLI command cookbook: `references/cli.md`
- Runtime storage paths: `references/paths.md`
- Troubleshooting and recovery: `references/troubleshooting.md`
- End-to-end operation scenarios: `references/scenarios.md`
- English Q/A examples: `references/examples.md`
- Chinese Q/A examples: `references/examples_zh.md`
- Web tab/card mapping (only when user asks for Web operations): `references/web.md`
