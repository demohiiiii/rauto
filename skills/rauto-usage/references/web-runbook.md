# Web Runbook

Use this file when user requests Web UI operations.

## Entry

```bash
rauto web --bind 127.0.0.1 --port 3000
```

## Current Page Patterns

- Standard Delivery: direct command, command template, command flow.
- Tx Block: JSON editor + template execution.
- Tx Workflow: JSON editor + template execution.
- Orchestrate: JSON editor + template execution.
- Templates: standard command templates, command-flow templates, tx-block templates, tx-workflow templates, and orchestration templates.
- Inventory: saved connections and groups.
- SFTP Upload / Blacklist / Backup / Tasks: dedicated pages.

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

## Recording Control

- Recording is always on.
- Top bar supports quick level switch:
  - audit/minimal (`key-events-only`)
  - full detail (`full`)

## Known UI Constraints

- Tx/Workflow/Orchestrate are JSON-driven.
- No legacy visual block builder should be used for tx/workflow authoring.
- Keep forms DaisyUI-native when adjusting page components.
