# Command delivery

The Web menu separates **command delivery** from **interactive commands**.
Each page offers single and batch scopes using the same authoring components.
Batch scope adds saved devices, inventory groups, labels, and a concurrency limit.
Drafts, variables, parsing settings, and results remain independent between scopes.

Both command scopes support manual input or saved command templates, variables,
rendered previews, execution mode, multiline submission, TextFSM parsing, retry
settings, and automatic or manual downloads. Both interactive scopes support the same
saved/builtin templates, visual/TOML editing, save/save-as actions, and execution
settings. Text output downloads do not require TextFSM; Excel exports contain
parsed results. Batch results retain device identity and individual command outputs.

## HTTP and gRPC

`POST /api/exec/batch-execute` accepts either the existing literal `command` or
`template_content` with optional `vars`. These sources are mutually exclusive.
Templates use the same runtime context as single command execution, rendered
separately for each target. Every target's rendered commands pass prechecks,
including the command blacklist, before execution starts on any target.

The response retains the aggregate fields and adds `results[].outputs`, containing
individual command results and TextFSM parse results. Existing literal command
clients can continue using aggregate fields. `ExecuteExecBatch` exposes the same
addition through `template_content` and `vars_json`; its `results_json` includes
the individual outputs.

`POST /api/interactive/batch-execute` already accepts inline `content`, saved/builtin
sources, `vars`, TextFSM and retry settings. The Web batch editor now uses those
existing capabilities.

## Interactive command templates

A template defines one top-level `command`, optional `mode`, `timeout_secs`,
and `multiline_mode`, plus a `[[prompts]]` array for prompt/response rules.
The visual editor, TOML editor, saved templates, built-in templates, CLI and Web
all use this format. Legacy `steps`, `default_mode`, and `stop_on_error` fields
are rejected rather than migrated. Compose multiple operations in transaction
workflows, whose commands already support interaction rules.

## CLI and transport names

Use `rauto interactive` to execute templates and
`rauto interactive-template` to manage them. `tx --run-kind
interactive` supports the same format for forward and rollback paths.
The old CLI names remain hidden aliases; they accept only the new template format.

The Web uses `/api/interactive/execute`,
`/api/interactive/batch-execute`, and
`/api/interactive-templates`. The gRPC API uses `ExecuteInteractive`, `ExecuteInteractiveBatch`, and
`*InteractiveTemplate*` message and method names. Existing HTTP aliases use the
same template parser. The storage table is `interactive_templates` and the task/history operation tag
is `interactive`; application types and modules use `Interactive`.
