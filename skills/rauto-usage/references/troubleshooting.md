# Troubleshooting

Use this checklist when `rauto` execution does not behave as expected.

## 1) Connection and Credentials

- Verify target resolution (`--connection` vs inline host args).
- Verify device profile and mode compatibility.
- Re-test with:

```bash
rauto connection test --connection <name>
```

## 2) Mode / Prompt Mismatch

- If mode invalid, return profile default and available mode list.
- For Linux shells, validate shell flavor and prompt matching assumptions.
- If execution times out but output shows success markers, suspect prompt-detection mismatch in profile/template settings.

## 3) Template and Vars Rendering

- Validate required vars before execution.
- For tx/workflow/orchestrate, validate JSON before submit.
- For flow templates, verify runtime vars and connection alias values are present.

## 4) Upload and Transfer Errors

- SFTP requires remote `sftp` subsystem support.
- Ensure remote path includes filename when required by target behavior.
- Keep raw error detail; remove duplicated wrapped layers when presenting errors.

## 5) Agent-Manager Issues

- Check manager URL/token/report mode.
- Check heartbeat and task-event/task-callback endpoint reachability.
- If manager is HTTP-only, prefer HTTP report mode.

## 6) Storage and Security

- Saved connections are stored in SQLite metadata.
- Secrets rely on keyring-based storage and app-level encrypted data flow.
- If keyring init/read fails, validate keyring availability and permissions on host OS.

