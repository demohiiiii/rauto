# Changelog

All notable changes to this project are documented in this file.

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
