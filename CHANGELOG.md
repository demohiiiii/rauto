# Changelog

All notable changes to this project are documented in this file.

## [0.2.0] - 2026-02-21

### New Features
- Added Web interactive sessions with start/send/stop APIs and a dedicated UI tab to run live commands without leaving the browser.
- Added transaction workflow builder improvements: per-step rollback entry, rollback rule templates, trigger-step controls, and JSON import/export support.
- Added CLI support for template create/update plus connection history detail and delete commands.
- Added right-side drawers for session recording and connection history, with floating access buttons and in-drawer controls.

### Optimizations
- Consolidated execution UI by nesting direct/templated execution into a single panel, reducing tab clutter.
- Enhanced history/record UX with searchable filters, badges, and structured table layouts for faster review.
- Improved rollback authoring workflows with per-command editors and auto-generated rollback helpers.

### API Changes
- Added Web endpoints `POST /api/interactive/start`, `POST /api/interactive/command`, and `DELETE /api/interactive/{id}`.
- Extended tx block payloads to accept per-step rollback commands plus rollback-on-failure and trigger-step options.
- CLI now supports `rauto templates create|update` and `rauto device connection-history-show|connection-history-delete`.

### Risks
- Interactive sessions are stored in-memory and will be lost on server restart.
- Transaction rollback behavior now depends on per-step and trigger-step configuration; misconfiguration can reduce rollback coverage.
- Significant UI refactors (drawers, tabs, filters) are not covered by E2E tests and may regress in edge paths.

## [0.1.5] - 2026-02-18

### New Features
- Added automatic execution-history persistence for CLI `exec` and `template execute` runs when recording is enabled, with records bound to saved connection identity.
- Added CLI history query command `rauto device connection-history --name <connection> [--limit N] [--json]`.
- Added Web history APIs for connection-scoped records, including detail query and record deletion by id.
- Added history management actions in Web UI: list, view event-level detail, and delete history records inline.

### Optimizations
- Switched default recording level from `full` to `key-events-only` in CLI and Web paths to reduce recording volume and improve default runtime overhead.
- Refined Web history presentation with richer tabular cards, badges, and clearer action layout for faster troubleshooting.
- Improved event detail UX by introducing a right-side detail drawer with structured fields for replay/record entries.

### API Changes
- Added Web endpoint `DELETE /api/connections/{name}/history/{id}` for history record removal.
- Added Web endpoint `GET /api/connections/{name}/history/{id}` for event-level record detail retrieval.
- Added CLI subcommand `device connection-history`; consumers can migrate ad-hoc history file parsing to this stable command output.
- History persistence now writes default mode `Enable` at record time when mode is omitted; this affects newly generated history metadata.

### Risks
- History delete operation permanently removes both `.jsonl` and `.meta.json` artifacts for a record; accidental deletion has no built-in recovery.
- Existing historical records created before this release may still contain empty mode fields, so mixed datasets can appear during transition.
- UI changes are concentrated in `static/app.js`; without browser E2E coverage, some edge-case interactions (drawer/detail/delete flow) may regress.

## [0.1.4] - 2026-02-16

### New Features
- Added end-to-end session recording and replay across CLI and Web flows, including `exec/template --record-file --record-level` and `replay` command support.
- Added profile diagnostics entry points in both CLI (`rauto device diagnose`) and Web API/UI for state-machine quality checks.
- Added Web management workflows for saved device connections, templates, and profile operations in dedicated tabs with multilingual UI.
- Added rich replay/record inspection UI with list/raw switch, event-type filter, failed-only filter, search filter, and detail modal.

### Optimizations
- Refined Web replay/record list rendering into structured stats + table views to improve troubleshooting speed.
- Improved replay/record UX with persisted filter/view preferences in `localStorage` and clearer visual prompt/FSM transition cards.
- Reduced diagnostics wiring complexity by aligning project logic to direct state-machine diagnostics without required-mode metadata.

### API Changes
- Upgraded `rneter` dependency to `0.1.6`.
- Removed required-mode diagnostics integration:
  - no longer uses `diagnose_state_machine_with_required_modes`
  - no longer reads `unreachable_required_modes`
  - no longer depends on template metadata required-mode fields.
- Migrated CLI/Web diagnose request/response shape to direct `diagnose_state_machine()` semantics; callers should stop sending/expecting required-mode related fields.

### Risks
- This release includes broad Web UI and API-surface updates; regressions may appear in less-used UI paths without full browser E2E coverage.
- `rneter 0.1.6` migration changes diagnostics semantics; downstream tooling that previously depended on required-mode checks must adapt to graph-focused fields.
- Replay/record payloads can become large for long sessions; browser rendering cost and memory usage may rise when loading very large JSONL blobs.
