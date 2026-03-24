# Rauto Troubleshooting

Use this file when users report failures, wrong output, or UI confusion.

## Connection failures

### `Failed to connect: async ssh2 error: Disconnected`

1. Verify host reachability and SSH service.
2. Verify SSH port (`--ssh-port` or Web `port` field), default should be `22`.
3. Verify username/password and optional enable password.
4. Verify device profile matches vendor behavior.

### `saved connection '<name>' is missing password` or password reuse fails

1. Re-enter the password and save the connection again.
2. Remember that saved passwords are encrypted into SQLite, not stored in plaintext.
3. Verify both of these files exist together:
   - `~/.rauto/rauto.db`
   - `~/.rauto/master.key`
4. If `master.key` was lost or replaced, old saved passwords can no longer be decrypted.

### "Web port 3000 overrides SSH port 22"

- Clarify: Web server port (`rauto web --port 3000`) is HTTP port only.
- In managed mode, agent server port defaults to `8123` (`rauto agent --port 8123`).
- SSH port always comes from connection fields (`--ssh-port` / Web `port` input).

## Template and tx issues

### Template not found

1. Run `rauto templates list`.
2. Confirm the template exists in the SQLite-backed template store.
3. Confirm template name/path is correct.

### Tx rollback errors

1. Per-step mode:
   - Ensure rollback list aligns with command list.
   - Empty rollback command is allowed and will be skipped.
2. Whole-resource mode:
   - Ensure `resource_rollback_command` exists.
   - Ensure `trigger_step_index` is valid.

### `invalid mode '<x>' for profile '<y>'`

1. Do not retry with `Enable` by default.
2. Treat the error as a validation failure before device connection.
3. Use the returned `default_mode` and `available_modes` to choose a valid state.
4. In Web, prefer the built-in mode dropdown sourced from the current profile.
5. For manager integrations, use the HTTP helper:
   - `GET /api/device-profiles/{name}/modes`

## Recording and replay issues

### Missing fields in record entries

1. Ensure recording is not disabled.
2. Prefer `full` when deep event diagnostics are required.
3. Verify in raw JSONL view for full fields.

### Replay cannot find command

1. Use `--list` (CLI) or `List Records` (Web) first.
2. Match exact command string and mode if mode filter is used.

## History and interactive issues

### History list empty

1. Ensure operations were executed with a selected saved connection.
2. Check connection history limit and filters.

### Interactive tab no response

1. Ensure session started successfully.
2. Ensure connection fields or saved connection are valid.
3. Stop and re-start session if prompt state is stale.

## Backup/restore issues

### Backup list empty

- Run `rauto backup create` first.
- Verify `~/.rauto/backups/` exists and is readable.

### Restore did not match expectation

- Use merge restore first (`Restore (Merge)`).
- Use replace restore only for full reset (`Restore (Replace)` / `--replace`).
- Re-check connections/templates/profiles after restore.
- If saved passwords fail after restore, confirm the backup/restore also preserved `master.key`.

### Download backup fails

- Ensure selected archive is from backup list (not random path).
- Refresh backup list and retry.

## UI style/interaction issues

### Styling looks broken

1. Rebuild Tailwind output when in source workflow.
2. Hard-refresh browser.

### Drawer/floating actions not visible

- Ensure required state is present (for recording drawer visibility, device context must be selected).

## Agent / manager issues

### Agent registers but manager receives nothing

1. Verify `rauto agent` is using the expected `--report-mode`.
2. If mode is `grpc`, verify manager exposes `AgentReportingService`.
3. If mode is `http`, verify manager exposes the expected `/api/agents/...` endpoints.
4. Verify token handling on manager accepts `Authorization` or `X-API-Key`.
5. If manager UI shows the wrong reporting mode, remember current register/heartbeat payloads do not carry `report_mode`; manager should trust the actual inbound transport.

### Agent works on gRPC but not on HTTP

1. Confirm manager URL is an HTTP(S) base URL, not a gRPC-only port.
2. Confirm these endpoints exist:
   - `/api/agents/register`
   - `/api/agents/heartbeat`
   - `/api/agents/offline`
   - `/api/agents/report-devices`
   - `/api/agents/update-device-status`
   - `/api/agents/report-error`
   - `/api/agents/report-task-callback`
   - `/api/agents/report-task-event`

### gRPC task/event reporting fails

1. Confirm manager exposes `rauto.manager.v1.AgentReportingService`.
2. Confirm `ReportTaskEvent` is implemented, not only `ReportTaskCallback`.
3. Confirm task-dispatch calls use the current gRPC matrix:
   - sync: `ExecuteCommand`, `ExecuteTemplate`, `ExecuteTxBlock`
   - async: `ExecuteTxBlockAsync`, `ExecuteTxWorkflowAsync`, `ExecuteOrchestrationAsync`
