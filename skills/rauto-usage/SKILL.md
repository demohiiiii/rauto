---
name: rauto-usage
description: "Operate, author, validate, and troubleshoot rauto through its CLI. Prefer show objects for device reads; use rollback-aware tx, tx-workflow, or orchestrate for configuration changes; handle command templates, command flows, multiline structured commands, saved devices, profiles, membership-only device groups, TextFSM, history, replay, backup, upload, local Web workbench startup, and managed-agent startup. Use when Codex needs to run rauto commands, start its services, build valid plans/templates, or diagnose CLI/runtime behavior."
---

# Rauto Usage

Execute `rauto` operations directly when possible.
Avoid tutorial-only responses when execution can be done in-session.

## Work Mode

Apply action-first behavior:

1. Classify request as read-only, config-changing, local Web startup, or managed-agent startup.
2. For device state/config retrieval, prefer `rauto show <object>` before raw `exec`.
3. Execute safe read-only operations immediately.
4. Prefer rollback-aware flows (`tx`, `tx-workflow`, `orchestrate`) for config changes.
5. Start local Web or managed-agent mode directly when the user asks for `rauto web` or `rauto agent`.
6. Ask confirmation before running destructive or ambiguous change operations.
7. Return concise result summary with the exact command used.

## Execution Rules

1. Execute read/query commands immediately (for example `device list`, `history list`, `templates list`, or `replay <record-file> --list`).
2. Prefer the show catalog for operational reads:
   - use `rauto show --list` to discover objects
   - use `rauto show <object>` for supported reads such as `version`, `interfaces`, `route`, `arp`, `vlan`, `mac`, `lldp`, `access-list`, and platform-specific objects
   - use multi-target show for saved connections, groups, and labels
   - fall back to `exec` only when no show object or custom show object fits.
3. Execute `rauto web` or `rauto agent` immediately when the corresponding service startup is explicitly requested. Keep the Web service on its loopback default unless network access is requested explicitly.
4. Use transaction-family execution with the correct entrypoint (high priority):
   - `tx`: CLI parameter-driven transaction construction
   - `tx-workflow`: workflow JSON
   - `orchestrate`: multi-device plan JSON whose jobs select saved devices, persisted device groups, or saved-device labels and execute only `tx_workflow` actions
5. Treat command-flow as the reusable interactive path:
   - run with `rauto flow`
   - manage with `rauto flow-template`
   - run the rauto-owned Cisco-like copy flow as `--template builtin:cisco_like_copy`; built-ins are executable but are not saved-template records
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
   - do not classify parenthesized Cisco-like prompts as Enable; current rneter templates reserve them for Config/submodes.
9. Keep TextFSM behavior current:
   - `show` parses with TextFSM by default unless `--no-parse`
   - `exec/template/flow` parse only when requested, when a template is supplied, or when Excel export needs parsed rows
   - default parsing filters TextFSM fallback Error rules such as `^. -> Error`; use strict mode only when user asks to preserve template errors.
10. Preserve concise, high-signal output summaries (target, mode, success/failure, key error, next action).
11. Keep multiline behavior explicit where the model supports it: use `split_lines` to execute non-empty trimmed lines separately and stop after the first failed command; use `whole` to preserve and submit the full text once; normalize legacy missing values to `split_lines`.

## Preferred Execution Matrix

- Reading device state/config: `show` first, `exec` only as fallback.
- Running one harmless raw command: `exec`.
- Running saved command text with vars: `template`.
- Handling interactive prompts or wizard-like workflows: `flow`.
- Changing config on one target: `tx`.
- Changing config through reusable multi-block workflow: `tx-workflow`.
- Changing config across devices/groups/sites: `orchestrate`.
- Querying many saved devices/groups/labels: multi-target `show`.

## Tx / Workflow / Orchestration Authoring Protocol

When user asks to create JSON plans, always follow:

1. Pick one target type (`tx-block`, `tx-workflow`, `orchestration`) and start from reference templates.
2. Generate full runnable JSON (not partial snippets) unless user asks otherwise.
3. Validate with `scripts/validate_json_plans.py` before presenting final output.
   - This validator is CLI-backed and calls `rauto ... --dry-run` internally.
   - Orchestration validation resolves device groups from the active rauto SQLite store. Treat an unknown group or missing saved-device error as an environment prerequisite, not permission to rewrite a valid selector into an inline target.
4. If validation reports a schema/model error, fix JSON and rerun validation. If it reports missing persisted state, list devices/groups and validate in the intended runtime environment.
5. For risky changes, suggest native dry-run before real execution when the chosen entrypoint supports it.
6. Use only transaction operation kinds `command` and `flow`; do not generate retired `kind: "template"` or `kind: "command_flow"` operations.

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

- `exec/template/flow/tx/tx-workflow/upload/device test`:
  require either complete host credentials or a valid `--connection`.
- `orchestrate`:
  require every job to resolve at least one saved device through `targets`, `target_groups`, or `target_tags`; never generate inline connection objects.
- `show`:
  require an object unless the user asks to list/discover objects; require a saved target, group, label, or complete connection for execution.
- `agent`:
  require effective `manager_url` and `agent_name` values from flags, environment, or agent config.
- `web`:
  has no mandatory connection input; `rauto web` starts on `127.0.0.1:3000`, and connection flags only preconfigure the workbench.
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
- Agent mode + manager integration pointers: `references/agent-runbook.md`
- Troubleshooting and recovery checklist: `references/troubleshooting.md`
