# Changelog

All notable changes to this project are documented in this file.

## [0.3.0] - 2026-03-14

### New Features
- Added dedicated managed startup via `rauto agent`, including manager registration, heartbeats, task callbacks, protected agent APIs, browser token entry, and separation from local-only `rauto web`.
- Added manager-facing device sync flows for saved connections: full inventory sync via `POST /api/agents/report-devices`, incremental liveness updates via `POST /api/agents/update-device-status`, startup sync, change-triggered resync, and periodic reachability probing.
- Added wildcard command blacklist enforcement across CLI, Web, interactive execution, `tx`, `tx-workflow`, and multi-device orchestration, plus a Web UI for add/delete/check operations.
- Upgraded SSH connection control by moving to `rneter 0.3.0` and exposing saved/CLI/Web SSH security profiles: `secure`, `balanced`, and `legacy-compatible`.

### Optimizations
- Reduced inventory sync noise by changing agent reporting from frequent repeated uploads to change-based full sync plus periodic incremental status refresh.
- Improved Web connection handling so execution APIs can resolve saved connections by `connection_name` server-side, while connection detail responses redact stored secrets and preserve saved passwords on updates unless explicitly replaced.
- Refined saved-connection merge precedence across CLI defaults, saved profiles, and explicit request fields, making Web/CLI/orchestrate behavior more consistent when profiles are reused.

### API Changes
- Added top-level CLI command `rauto agent`; managed deployments should migrate manager-connected startup flows from `rauto web ...` to `rauto agent ...`, while `rauto web` remains local self-management only.
- Added agent-side endpoints `GET /api/agent/info`, `GET /api/agent/status`, and `POST /api/devices/probe` for manager discovery, runtime inspection, and batch reachability checks.
- Saved connection detail responses no longer return `password` or `enable_password`; clients should rely on `has_password` for presence and only send secret fields when rotating them.
- Web execution APIs now support resolving a saved connection from `connection.connection_name` without resending `host` and password fields, and the internal `rneter` integration now uses the `ConnectionRequest` / `ExecutionContext` based 0.3.0 manager APIs.

### Risks
- The managed-mode CLI split is a breaking change for any scripts, services, or documentation still launching manager-connected workflows through `rauto web`.
- Agent liveness reporting currently reflects TCP reachability, not successful SSH authentication or command execution, so manager-side health can still diverge from real operational readiness.
- Broad blacklist patterns can now block direct commands, transactions, workflows, and orchestration targets across both CLI and Web paths, increasing blast radius if patterns are misconfigured.
- Agent/manager integration, browser auth flows, and the `rneter 0.3.0` migration are compile/test validated, but still lack full end-to-end coverage against a live manager and browser automation suite.

## [0.2.2] - 2026-03-11

### New Features
- Added multi-device orchestration via `rauto orchestrate`, with staged serial/parallel execution, per-stage `fail_fast`, `max_parallel`, and reuse of existing `tx` / `tx-workflow` execution paths.
- Added inventory-driven orchestration planning with `inventory_file`, inline `inventory.groups`, target group expansion, and inherited defaults that can be overridden per group or target.
- Added Web orchestration support through `POST /api/orchestrate` and a dedicated Operations -> Orchestrate panel with preview, execute, import/export, and stage/target detail views.
- Added runnable workflow/orchestration example JSON files under `templates/examples/`, including inventory-based and advanced staged rollout samples.

### Optimizations
- Promoted saved-connection and history management to top-level CLI groups as `rauto connection ...` and `rauto history ...`, reducing command nesting and separating them from device profile management.
- Improved orchestration UI feedback with resolved target previews, execution status badges, localized rerendering, and expandable stage/target detail views for result inspection.
- Switched CLI tracing timestamps to local time formatting to make logs easier to correlate with operational change windows.

### API Changes
- Added top-level CLI command groups `connection` and `history`; migrate old `rauto device add-connection|list-connections|show-connection|delete-connection|test-connection` flows to `rauto connection add|list|show|delete|test`, and old `rauto device connection-history*` flows to `rauto history list|show|delete`.
- Added Web endpoint `POST /api/orchestrate`, which accepts a plan plus optional `base_dir`/`record_level` and returns normalized `plan`, resolved `inventory`, and optional `orchestration_result`.
- Added orchestration JSON support for `inventory_file`, inline `inventory`, `target_groups`, inventory/group default inheritance, and per-stage `strategy`, `max_parallel`, and `fail_fast` controls.

### Risks
- Multi-device orchestration does not provide cross-device global rollback; rollback remains device-local through reused `tx` / `tx-workflow` semantics.
- The CLI command reshaping for connection/history management is a breaking change for scripts or operators still using the old `rauto device ...connection...` and `rauto device connection-history...` forms.
- Parallel orchestration can widen blast radius if `max_parallel`, inherited inventory defaults, or `fail_fast` settings are misconfigured, especially when saved connections are reused across groups.
- Orchestration and Web UI changes are compile/test validated, but browser-level end-to-end coverage remains limited, so edge interaction regressions may still surface.

## [0.2.1] - 2026-02-27

### New Features
- Added full backup/restore support for `~/.rauto` runtime data in CLI via `rauto backup create|list|restore`, including auto timestamp filenames when no file name is provided.
- Added Web backup management tab with create/list/download/restore operations, plus row-level quick actions for direct download and merge/replace restore flows.
- Added Web backup metadata visibility (`size_bytes`, `modified_ms`) and selected-archive detail display to improve restore confirmation.

### Optimizations
- Improved restore replace behavior to preserve existing `~/.rauto/backups` archives instead of deleting backup files during data replacement.
- Reduced backup operation friction in Web by replacing checkbox-based restore mode with explicit `Restore (Merge)` and `Restore (Replace)` actions.
- Expanded rauto skill references with comprehensive CLI/Web/scenario/troubleshooting/example coverage to improve AI guidance quality and consistency.

### API Changes
- Added Web endpoints:
  - `GET /api/backups`
  - `POST /api/backups`
  - `POST /api/backups/restore`
  - `GET /api/backups/{name}/download`
- Added backup response model fields `size_bytes` and `modified_ms` in Web backup listing payloads.
- Added new CLI command group `backup` with `create`, `list`, and `restore` subcommands.

### Risks
- `restore --replace` semantics now preserve `backups` content; automation that previously relied on full directory wipe behavior should be reviewed.
- Web restore operations are destructive in replace mode and currently protected by confirmation prompts only, without additional typed confirmation.
- Backup/restore flows are validated with compile-time and manual checks; there is no dedicated end-to-end automated test coverage yet.

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
