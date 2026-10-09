# Web Workbench

## Startup And Authentication

```sh
rauto web --bind 127.0.0.1 --port 3000
```

Open `http://127.0.0.1:3000`. No target connection is required at startup.
First startup generates and prints the Web password and saves `web.password`
in `RAUTO_HOME/config.toml`; later launches reuse it. Do not copy that password
into reports. Keep the foreground service running for the requested session.
Released binaries embed frontend assets. Source builds need a frontend
production build when assets are missing or stale.

Local Web uses password login and an HttpOnly session cookie. Auth endpoints:
`GET /api/auth/status`, `POST /api/auth/login` with `{"password":"..."}`, and
`POST /api/auth/logout`. Agent mode uses token authentication instead. Use the
existing authenticated session for API checks. The typed client in
`frontend/src/api/client.ts` describes request and response handling; responses
are not universally wrapped in the same envelope.

## Current Pages

| Workspace | Current organization |
| --- | --- |
| Query | Show objects with Single/Batch tabs; batch device list on the left and command result tabs on the right |
| Configuration collection | Current-device/batch configuration fetch, hashes, downloads, and stored configuration history |
| Command delivery | Single/Batch tabs; manual command or saved command template |
| Interactive commands | Single/Batch tabs; one command with prompt rules; visual/TOML editor |
| Transaction workflow | Empty initial workflow; add blocks with the trailing plus; blocks contain operations and rollback |
| Multi-device orchestration | Stages/jobs/targets running transaction workflows |
| Schedules | Persisted cron definitions and run history |
| Inventory/discovery/credentials | Saved devices, groups, labels, SSH scanning/import, and reusable credentials |
| Other workspaces | Session records/replay, profiles, templates, TextFSM mappings, config catalog, SFTP, blacklist, backups, and tasks |

Single/batch is an execution scope inside each command page, not separate
standard/batch delivery menu entries. Transaction blocks are edited and saved
as templates inside workflows; there is no standalone block execution page.
Workflow and orchestration share nested canvas/group/block components, with
blocks arranged vertically inside their container.

The topbar's left device selector supplies the current single target. Recording,
session records, theme, language, and repository buttons are on the right.
Groups contain saved-device membership, not inline connections or group vars.

## Template Interaction

Command, interactive, workflow, orchestration, and block editors share the
manual/template source and template authoring behavior:

- Choosing a template makes its definition read-only; runtime variables remain
  editable and appear above the rendered operation where applicable.
- A custom template offers Edit and Copy. Edit changes those actions to Save
  and Cancel, and Cancel restores the captured definition.
- Copy switches to manual input with the copied definition filled in. Manual
  input has a Save action that creates a named template.
- Built-ins have a localized badge before their name and permit Copy only.
- Command/interactive backend inspection infers runtime variable fields.
  Parsing activity uses an input-corner spinner. These editors do not require
  declared variable schemas or arbitrary add/delete-field controls.

`POST /api/templates/inspect` accepts command template `content` and uses the
Jinja undeclared-variable scanner. `POST /api/interactive-templates/inspect`
accepts TOML `content`, normalizes it, and returns inferred `vars_schema`.
Use these implementations instead of a regex limited to bare `{{var}}`
references. Workflow/orchestration variables use JSON or structured value
editors; these inspection endpoints do not validate JSON workflow models.

## Execution And Results

Query, configuration collection, command, interactive, workflow, and
orchestration use the shared Bottom Sheet and adjacent execution bar. The bar
adapts to its actions; both align with the content container and reserve space
at the bottom rather than covering the last controls.

The sheet reads a shared history across all six functions. It defaults its
filter to the current function and permits selecting other functions/all.
History uses browser `sessionStorage`, survives route changes and refreshes in
that session, and defaults to 10 entries per function. The retention setting
is 1-100 and applies independently to each function, not to the combined list.
Running entries restored after a reload are marked interrupted. This browser
history is distinct from persisted backend SSH session recordings and task
history; it is not durable cross-session storage.

Execution completion/failure produces notifications. The collapsed sheet uses
status icons/animation and the latest time; details include all retained runs.
Command-output automatic download is beside the execution controls, separate
from TextFSM. Results also offer manual download. TextFSM-disabled results do
not show a parsed/raw tab switch. Excel automatic download uses a default
filename; it is tied to parsed output.

Batch query selectors use the intersection of show objects supported by the
selected profiles. Mode controls serialize ordered comma-separated candidate
modes; omission in form controls follows the profile. Successful output favors
command content; failures retain diagnostic transcripts.

## API And Filesystem Boundaries

Canonical execution routes include `/api/exec`, `/api/interactive/execute`,
`/api/show/execute`, `/api/config/fetch`, `/api/tx/workflow`, and
`/api/orchestrate`. Ordinary batch routes end in `/batch-execute` or
`/batch-fetch`; inspect the typed client for exact payloads.

Workflow/orchestration requests accept `dry_run: true`. Workflow dry-run runs
native invariants and expands block templates; orchestration dry-run validates
the plan and selectors, not every nested action. Saved-workflow
`/api/tx-workflow-templates/{name}/preview` returns rendered values and
`unresolved_paths` with a limited variables-only context. See
[Validation](json-validation.md) before interpreting a preview as a check.

Web local-file access is constrained to managed directories: upload sources
under `RAUTO_HOME/uploads`, private keys under `RAUTO_HOME/keys`, backups under
`RAUTO_HOME/backups`. Execution uses saved TextFSM template names; arbitrary
host template paths and template directories are rejected. Read
[Discovery](device-discovery.md) for scan/import behavior and
[Schedules](schedules.md) for scheduler prerequisites.
