# Web Runbook

Use this file when user requests Web UI operations.

## Entry

```bash
rauto web --bind 127.0.0.1 --port 3000
```

## Current Page Patterns

- Show / 查询: single-object show and batch show across saved devices, groups, and labels.
- Standard Delivery: direct command, command template, command flow.
- Tx Block: JSON editor + template execution.
- Tx Workflow: JSON editor + template execution.
- Orchestrate: JSON editor + template execution.
- Templates: standard command templates, command-flow templates, tx-block templates, tx-workflow templates, orchestration templates, TextFSM templates, profile command mappings, and custom show objects.
- Inventory: saved connections and groups.
- SFTP Upload / Blacklist / Backup / Tasks: dedicated pages.

## Query / Show Workflow

- Use **Show / 查询** before Standard Delivery when the user wants to retrieve device state/config.
- Single query uses the currently selected target and can execute one or more selected show objects.
- Batch query can select multiple saved devices, groups, labels/tags, and multiple show objects.
- Batch query prechecks show-object support for every resolved device before execution.
- TextFSM parsing is enabled by default for show; disable only when the user wants raw output.
- TextFSM parsed results render as tables and can be exported to Excel.
- Default TextFSM parsing filters fallback Error rules such as `^. -> Error`; enable strict Error rules only when the user explicitly wants template-error behavior.

## Connection Selection

- Use the sidebar “Choose Target” entry.
- Support saved connection or temporary connection via modal tabs.
- Current target information is shown in the sidebar header region.
- Default device profile is `autodetect`; the backend caches successful autodetect by `host:port`.
- Default SSH security is `legacy-compatible`; selecting blank in the UI means use that backend default.
- Tags and groups use tags-input controls; group values come from inventory groups, while labels allow custom values.
- Connection vars are edited with form rows, not raw JSON.
- Saved connection edit supports explicit autodetect probing and applying the detected profile when it differs.
- Password fields are saved with connection payloads; do not describe a “do not save password” checkbox.

## Template Manager Notes

- Manage custom TextFSM templates under **TextFSM Templates**.
- Manage profile command-to-TextFSM mappings under the same TextFSM area.
- Manage **Custom Show Objects** in its own tab. A custom object can use a manual command/template or reference an existing profile TextFSM command mapping.
- For custom show objects, mode should be selected from profile modes; do not present mode as free-form when current UI/API provides profile-backed selection.

## Recording Control

- Recording is always on.
- Top bar supports quick level switch:
  - audit/minimal (`key-events-only`)
  - full detail (`full`)

## Known UI Constraints

- Tx/Workflow/Orchestrate are JSON-driven.
- No legacy visual block builder should be used for tx/workflow authoring.
- Keep forms DaisyUI-native when adjusting page components.
- Web frontend is Svelte 5; do not refer to legacy static HTML entrypoints as the active UI.
