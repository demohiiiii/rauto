# Troubleshooting

Use this checklist when `rauto` execution does not behave as expected.

## 1) Connection and Credentials

- Verify target resolution (`--connection` vs inline host args).
- Verify device profile and mode compatibility.
- Re-test with:

```bash
rauto connection test --connection <name>
rauto connection test --connection <name> --force-autodetect
```

- If autodetect previously succeeded but the device changed, retry with `--force-autodetect`.
- If old devices fail key exchange, remember the default is `legacy-compatible`; only raise to `balanced` or `secure` when the target supports stricter algorithms.

## 2) Mode / Prompt Mismatch

- If mode invalid, return profile default and available mode list.
- For `show`, remember explicit `--mode` / UI mode overrides mapping mode; otherwise object mapping mode wins before profile default.
- For Linux shells, validate shell flavor and prompt matching assumptions.
- If execution times out but output shows success markers, suspect prompt-detection mismatch in profile/template settings.

## 3) Show Objects and TextFSM

- If a query object is missing, run `rauto show --list --device-profile <profile>` or list all objects without a profile to discover available names.
- If a saved/custom profile lacks a show object, add a custom show object with `rauto show-object set`.
- If parsed output is empty or wrong, verify the resolved real command with `rauto show <object> --print-command`.
- If TextFSM auto-selection chooses the wrong platform, use `--textfsm-platform <ntc_platform>` or a custom `(profile, command) -> template` mapping.
- If NTC templates fail on unmatched lines, keep the default lenient parsing that filters fallback Error rules. Use `--textfsm-strict-errors` only when debugging template state-machine behavior.
- If a custom template is needed, save it with `rauto textfsm template` and bind it with `rauto textfsm mapping` or a custom show object.

## 4) Template and Vars Rendering

- Validate required vars before execution.
- For tx/workflow/orchestrate, validate JSON before submit.
- For flow templates, verify runtime vars and connection alias values are present.

## 5) Config Change Safety

- If the user is about to push config with raw `exec` or `template`, prefer `tx`, `tx-workflow`, or `orchestrate`.
- Add precheck/read commands with `show` when useful.
- Use dry-run/view validation where available before real tx/workflow/orchestrate execution.
- Confirm rollback commands or rollback policy before irreversible changes.

## 6) Upload and Transfer Errors

- SFTP requires remote `sftp` subsystem support.
- Ensure remote path includes filename when required by target behavior.
- Keep raw error detail; remove duplicated wrapped layers when presenting errors.

## 7) Agent-Manager Issues

- Check manager URL/token/report mode.
- Check heartbeat and task-event/task-callback endpoint reachability.
- If manager is HTTP-only, prefer HTTP report mode.

## 8) Storage and Security

- Saved connections are stored in SQLite metadata.
- Secrets rely on keyring-based storage and app-level encrypted data flow.
- If keyring init/read fails, validate keyring availability and permissions on host OS.
