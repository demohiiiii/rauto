---
name: rauto-usage
description: "Operate rauto end-to-end for the user through CLI/Web/Agent: execute commands and templates, run command-flow templates, run tx/tx-workflow/orchestrate JSON plans or saved JSON templates, manage saved connections/device profiles/autodetect/inventory/templates/history, run replay/backup/restore/upload, and start or troubleshoot web/agent services. Trigger when the user asks to directly perform or validate rauto operations instead of only explaining them."
---

# Rauto Usage

Execute `rauto` operations directly when possible.
Avoid tutorial-only responses when execution can be done in-session.

## Work Mode

Apply action-first behavior:

1. Classify request as read-only, config-changing, or service startup.
2. Execute read-only operations immediately.
3. Prefer rollback-aware flows (`tx`, `tx-workflow`, `orchestrate`) for config changes.
4. Start services directly when user asks for `web` or `agent`.
5. Ask confirmation before running destructive or ambiguous change operations.
6. Return concise result summary with the exact command used.

## Execution Rules

1. Execute read/query commands immediately (for example `device list`, `connection list`, `history list`, `templates list`, `replay --list`).
2. Execute `rauto web` / `rauto agent` immediately when startup is explicitly requested.
3. Use transaction-family execution with the correct entrypoint (high priority):
   - `tx`: CLI parameter-driven transaction construction, plus tx-block JSON authoring for Web/API/template flows
   - `tx-workflow`: workflow JSON
   - `orchestrate`: multi-device plan JSON
4. Treat command-flow as the reusable interactive path:
   - run with `rauto flow`
   - manage with `rauto flow-template`
5. Resolve connection using:
   - explicit host flags > `--connection <name>` > ask only for missing must-have inputs.
6. Keep SSH/profile defaults current:
   - default device profile is `autodetect`
   - default SSH security is `legacy-compatible`
   - successful autodetect results are cached by `host:port`
   - use `--force-autodetect` when the device behind an IP/port may have changed.
7. Keep mode behavior profile-aware:
   - do not force `Enable`
   - let profile default apply when mode is omitted
   - if mode invalid, return default and available modes.
8. Preserve concise, high-signal output summaries (target, mode, success/failure, key error, next action).

## Tx / Workflow / Orchestration Authoring Protocol

When user asks to create JSON plans, always follow:

1. Pick one target type (`tx-block`, `tx-workflow`, `orchestration`) and start from reference templates.
2. Generate full runnable JSON (not partial snippets) unless user asks otherwise.
3. Validate with `scripts/validate_json_plans.py` before presenting final output.
   - This validator is CLI-backed and calls `rauto ... --dry-run` internally.
4. If validation has errors, fix JSON and rerun validation.
5. For risky changes, suggest native dry-run before real execution when the chosen entrypoint supports it.

Validation command:

```bash
python3 skills/rauto-usage/scripts/validate_json_plans.py --kind <tx-block|tx-workflow|orchestration> --file <plan.json>
```

## Risk Guardrails

Require explicit confirmation before destructive actions:

- `rauto backup restore ... --replace`
- profile/template/connection delete operations
- tx/workflow/orchestrate execution when user intent is ambiguous

Enforce safety for config changes:

- prefer rollback-capable plans
- use preview/dry-run style checks when available
- review orchestration scope, `fail_fast`, and concurrency
- include rollback strategy before execution

If user explicitly asks to execute destructive action, proceed.

## Missing Input Strategy

Ask only for missing mandatory fields:

- `exec/template/flow/tx/tx-workflow/orchestrate/upload/connection test`:
  require either complete host credentials or a valid `--connection`.
- `agent`:
  require `manager_url` and `agent_name`.
- `replay`:
  require record file path (or inline JSONL when API path supports it).
- `history`:
  require saved connection name.

## Response Format

Report executed operations with:

1. `Operation`: what was run
2. `Command`: exact rauto command
3. `Result`: key output summary
4. `Notes`: risk, errors, or next step

## Reference Map (Load On Demand)

- CLI quick commands and operator runbook: `references/cli-runbook.md`
- Transaction/workflow/orchestration JSON templates: `references/json-templates.md`
- JSON validation command guide: `references/json-validation.md`
- JSON failure-to-fix cookbook: `references/json-common-errors.md`
- Scenario-driven tx/workflow/orchestration patterns: `references/tx-orchestration-use-cases.md`
- Command-flow template model and runtime vars: `references/flow-templates.md`
- Web UI operation map (current dashboard layout): `references/web-runbook.md`
- Agent mode + manager integration pointers: `references/agent-runbook.md`
- Troubleshooting and recovery checklist: `references/troubleshooting.md`
