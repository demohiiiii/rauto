# Rauto Troubleshooting

Use this reference when the user reports errors or unexpected behavior.

## Connection failures

- **`Failed to connect: async ssh2 error: Disconnected`**
  - Verify host/port reachability (ping/telnet).
  - Confirm SSH port (`--ssh-port` in CLI; `port` field in Web).
  - Check username/password and enable password (if device requires enable).
  - Confirm device profile matches vendor (cisco/huawei/juniper/custom).

- **Web uses 3000 instead of 22**
  - Web server port is unrelated to SSH port. SSH port comes from connection fields.
  - Ensure SSH port is set in connection inputs and not left empty.

## Template / tx errors

- **Template not found**
  - Confirm template name (no path traversal).
  - Verify `~/.rauto/templates/commands/` contains the template.
  - Use `rauto templates list` or Web Template Manager.

- **Rollback/tx validation errors**
  - Per-step rollback allows empty commands; ensure length aligns with command list.
  - For whole-resource rollback, `resource_rollback_command` must be set.
  - `trigger_step_index` should be within the command list range.

## Recording / replay issues

- **Recording fields seem missing (e.g., prompt_after, fsm_prompt_after)**
  - Confirm `record_level` is not `off`.
  - Use `key-events-only` for lighter logs; use `full` when you need raw chunk/event details.
  - Some fields only appear on command output events, not all event kinds.
  - Ensure you’re viewing the original JSONL (raw view) when verifying fields.

- **No recordings appear**
  - Check recording level (not `off`).
  - For Web, open the Recording drawer and verify list/raw view.
  - Ensure operations were executed after recording was enabled.

- **Replay can’t find command**
  - Use `--list` or Web “List Records” to inspect recorded commands and modes.
  - Match both command string and mode where applicable.

## UI issues

- **Styles missing or layout broken**
  - Rebuild Tailwind output (if used in your workflow).
  - Hard refresh browser to clear cache.

- **Drawer doesn’t open**
  - Verify JavaScript loaded; check console errors.
  - Confirm that the connection fields are filled to show the floating button.

## Diagnostics

- **Diagnose shows unreachable states**
  - Confirm profile prompts and transitions cover each state.
  - Use built-in profile as a baseline to compare.

## Tx rollback failures

- **Per-step rollback didn't run**
  - Check rollback policy (must be `per_step`).
  - Ensure per-step rollback commands are populated (empty means skip).
  - If the step failed and you expect rollback, enable “rollback failed step”.

- **Whole-resource rollback didn't run**
  - `resource_rollback_command` must be set.
  - `trigger_step_index` must be <= last executed step.

- **Rollback reported success but device state looks wrong**
  - Rollback inference is heuristic; for ambiguous commands, use explicit rollback commands.
  - Prefer vendor-specific rollback commands when available.
