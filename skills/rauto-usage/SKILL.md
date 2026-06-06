---
name: rauto-usage
description: "Operate rauto end-to-end for the user through CLI/Web/Agent: prefer show objects for reading device state/config, prefer rollback-aware tx/tx-workflow/orchestrate for config changes, run direct commands/templates/command-flow only when appropriate, manage saved connections/device profiles/autodetect/inventory/templates/TextFSM/show objects/history, export parsed TextFSM results, run replay/backup/restore/upload, and start or troubleshoot web/agent services. Trigger when the user asks to directly perform or validate rauto operations instead of only explaining them."
---

# Rauto Usage

Execute `rauto` operations directly when possible.
Avoid tutorial-only responses when execution can be done in-session.

## Work Mode

Apply action-first behavior:

1. Classify request as read-only, config-changing, or service startup.
2. For device state/config retrieval, prefer `rauto show <object>` or Web **Show/查询** before raw `exec`.
3. Execute safe read-only operations immediately.
4. Prefer rollback-aware flows (`tx`, `tx-workflow`, `orchestrate`) for config changes.
5. Start services directly when user asks for `web` or `agent`.
6. Ask confirmation before running destructive or ambiguous change operations.
7. Return concise result summary with the exact command used.

## Execution Rules

1. Execute read/query commands immediately (for example `device list`, `connection list`, `history list`, `templates list`, `replay --list`).
2. Prefer the show catalog for operational reads:
   - use `rauto show --list` to discover objects
   - use `rauto show <object>` for supported reads such as `version`, `interfaces`, `route`, `arp`, `vlan`, `mac`, `lldp`, `access-list`, and platform-specific objects
   - use multi-target show for saved connections, groups, and labels
   - fall back to `exec` only when no show object or custom show object fits.
3. Execute `rauto web` / `rauto agent` immediately when startup is explicitly requested.
4. Use transaction-family execution with the correct entrypoint (high priority):
   - `tx`: CLI parameter-driven transaction construction, plus tx-block JSON authoring for Web/API/template flows
   - `tx-workflow`: workflow JSON
   - `orchestrate`: multi-device plan JSON
5. Treat command-flow as the reusable interactive path:
   - run with `rauto flow`
   - manage with `rauto flow-template`
6. Resolve connection using:
   - explicit host flags > `--connection <name>` > ask only for missing must-have inputs.
7. Keep SSH/profile defaults current:
   - default device profile is `autodetect`
   - default SSH security is `legacy-compatible`
   - successful autodetect results are cached by `host:port`
   - use `--force-autodetect` when the device behind an IP/port may have changed.
8. Keep mode behavior profile-aware:
   - do not force `Enable`
   - let profile default apply when mode is omitted
   - if mode invalid, return default and available modes.
9. Keep TextFSM behavior current:
   - `show` parses with TextFSM by default unless `--no-parse`
   - `exec/template/flow` parse only when requested, when a template is supplied, or when Excel export needs parsed rows
   - default parsing filters TextFSM fallback Error rules such as `^. -> Error`; use strict mode only when user asks to preserve template errors.
10. Preserve concise, high-signal output summaries (target, mode, success/failure, key error, next action).

## Preferred Execution Matrix

- Reading device state/config: `show` first, `exec` only as fallback.
- Running one harmless raw command: `exec`.
- Running saved command text with vars: `template`.
- Handling interactive prompts or wizard-like workflows: `flow`.
- Changing config on one target: `tx`.
- Changing config through reusable multi-block workflow: `tx-workflow`.
- Changing config across devices/groups/sites: `orchestrate`.
- Querying many saved devices/groups/labels: multi-target `show`; use Web batch show for multiple objects in one request.

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
- raw `exec` or command-template config changes when a rollback-capable transaction path is available

Enforce safety for config changes:

- prefer rollback-capable plans
- include precheck/read steps with `show` where useful
- use preview/dry-run style checks when available
- review orchestration scope, `fail_fast`, and concurrency
- include rollback strategy before execution

If user explicitly asks to execute destructive action, proceed.

## Missing Input Strategy

Ask only for missing mandatory fields:

- `exec/template/flow/tx/tx-workflow/orchestrate/upload/connection test`:
  require either complete host credentials or a valid `--connection`.
- `show`:
  require an object unless the user asks to list/discover objects; require a saved target, group, label, or complete connection for execution.
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
