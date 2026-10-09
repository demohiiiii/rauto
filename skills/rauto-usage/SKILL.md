---
name: rauto-usage
description: "Operate and troubleshoot rauto CLI, Web workbench, and managed agents; author interactive templates, transaction workflows, orchestration plans, and schedules. Use for rauto device discovery, saved connections, execution, configuration collection, and runtime diagnostics."
---

# Rauto Usage

Use the current CLI and native models to carry out the requested operation.
These references were checked against the rauto checkout on 2026-10-09.
Installed releases can lag the checkout: inspect `rauto --version` and the
relevant `--help` before relying on an option. In a checkout, use its built
binary explicitly when validating new contracts; Rust is pinned to 1.94.0.

## Choose The Surface

| Task | Current entry point | Reference |
| --- | --- | --- |
| Inspect device state | `show --list`, then `show <object>`; `exec` for uncatalogued reads | [CLI](references/cli-runbook.md) |
| Collect configuration and drift hashes | `config fetch`, `config history` | [CLI](references/cli-runbook.md) |
| Discover and import SSH devices | `device discover`, `device discover list\|save` | [Discovery](references/device-discovery.md) |
| Handle prompts for one command | `interactive`, `interactive-template` | [Interactive templates](references/interactive-templates.md) |
| Execute changes with rollback | `tx-workflow`; `orchestrate` for multiple devices | [JSON plans](references/json-templates.md) |
| Check JSON plans without executing | Bundled helper and native previews, with different validation scopes | [Validation](references/json-validation.md) |
| Run the browser workbench | `web` | [Web](references/web-runbook.md) |
| Schedule recurring execution | `schedule`; execution requires a running Web scheduler | [Schedules](references/schedules.md) |
| Start a managed agent | `agent` | [Agent](references/agent-runbook.md) |
| Diagnose runtime failures | Connection, profile, storage, parsing, and discovery checks | [Troubleshooting](references/troubleshooting.md) |

## Operational Invariants

- Resolve a target from `--connection <saved-name>` or `--host` plus a reusable
  `--credential <name-or-id>`. Connection flags override saved values.
  Credentials and saved connections are separate records.
- Let the selected profile supply default modes when the entry point supports
  omission. Candidate expressions such as `Root,User` or `Enable|Config` are
  validated case-insensitively against that profile. Do not force `User` or
  `Enable` across platforms. Raw workflow JSON requires explicit `mode` strings.
- `exec`, `interactive`, `show`, and `config fetch` support repeatable saved
  `--target`, `--group`, and `--label` selectors as a deduplicated union, with
  `--max-parallel`. Orchestration jobs use saved names and selectors, never
  inline host/auth objects.
- The default profile is `autodetect`, SSH security is `legacy-compatible`, and
  successful autodetection is cached by host/port. Use `--force-autodetect` after
  endpoint replacement. Linux shell flavors are `posix` and `fish`.
- `show` parses with TextFSM unless `--no-parse`; command and interactive
  execution parse when requested or required by a template/Excel export.
  Platform selection follows the device profile. Default parsing filters
  fallback Error rules; `--textfsm-strict-errors` retains them.
- Session retries default to zero and can repeat an already executed command.
  Use them only for repeat-safe ordinary operations. Workflows, orchestration
  actions, and uploads are not automatically retried.
- Transactions are workflow blocks, including reusable block templates. There
  is no standalone `tx` execution command or transaction-block execution page.
  Interactive TOML defines one command with prompts, not a list of steps.
- Templates, profiles, inventory, and execution records live in SQLite under
  `RAUTO_HOME` (default `~/.rauto`). Do not use deprecated template-directory
  options. Use isolated temporary `RAUTO_HOME` for tests and sample validation;
  inspect real persisted state only within the user's requested scope.

## Authoring And Results

For automation JSON, start from [the current models](references/json-templates.md)
and run [the bundled check](references/json-validation.md). A successful CLI
workflow dry-run means deserialization/rendering succeeded; it is not a complete
invariant, profile, rollback, or device check. Keep that distinction in reports.

Prefer workflow rollback for changes that need compensation. Review the actual
targets, concurrency, failure policy, and rollback behavior before execution;
do not treat authoring or a dry-run request as authorization to execute changes.
Honor existing user authorization without adding redundant confirmation steps.

Report the command or API used, target scope, outcome, and actionable errors.
Do not expose passwords, private keys, tokens, resolved secret variables, or
master keys in previews or reports.
