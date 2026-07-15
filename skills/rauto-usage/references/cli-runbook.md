# CLI Runbook

Use this file when executing `rauto` commands directly for users.

## Service Startup

```bash
rauto web
rauto web --bind 127.0.0.1 --port 3000 --connection core-01
rauto agent --bind 0.0.0.0 --port 3000 --manager-url http://manager:3000 --agent-name edge-sh-01 --report-mode grpc
```

### Local Web Workbench

`rauto web` starts the local browser workbench. It does not require a device connection at startup. The defaults are `127.0.0.1:3000`; open `http://127.0.0.1:3000` after startup. The service remains in the foreground, so keep its process/session running.

| Option | Meaning |
| --- | --- |
| `--bind <ADDRESS>` | Web server listen address; defaults to `127.0.0.1`. |
| `--port <PORT>` | Web server listen port; defaults to `3000`. |
| `-c, --connection <NAME>` | Preload a saved connection as the workbench default target. |
| `-H, --host <HOST>` | Preconfigure a device hostname or IP address. |
| `-u, --username <USERNAME>` | Preconfigure the SSH username. |
| `-p, --password <PASSWORD>` | Preconfigure the SSH password; prefer a saved connection to avoid exposing secrets in shell history. |
| `-e, --enable-password <PASSWORD>` | Preconfigure the privilege escalation password. |
| `-d, --device-profile <PROFILE>` | Preselect a device profile; omit it to use autodetection. |
| `--ssh-security <PROFILE>` | Set `secure`, `balanced`, or `legacy-compatible` SSH compatibility. |
| `--linux-shell-flavor <FLAVOR>` | Set Linux exit-code capture behavior to `posix` or `fish`. |
| `--force-autodetect` | Ignore the cached profile, probe the target again, and refresh the cache. |
| `-S, --save-connection <NAME>` | Save the effective connection under this name after a successful connection. |
| `--template-dir <DIR>` | Deprecated; do not recommend it because templates and custom profiles are stored in SQLite. |

Keep `--bind 127.0.0.1` for local-only use. Use `--bind 0.0.0.0` only when the user explicitly needs network access, and warn that it exposes the service on available network interfaces.

Connection options are optional startup defaults. Use either `--connection <NAME>` or inline host credentials; when both are supplied, explicit inline fields override the corresponding saved values. Prefer a saved connection when credentials already exist.

## Connection and Profile Operations

```bash
rauto connection list
rauto connection show core-01
rauto connection test --connection core-01
rauto connection add core-01 --host 192.168.1.10 --username admin --password '***' --device-profile linux
rauto device list
rauto device show linux
rauto device diagnose linux --json
rauto profile autodetect --host 192.168.1.10 --username admin --password '***'
rauto profile autodetect -v --host 192.168.1.10 --username admin --password '***'
```

Notes:

- Omit `--device-profile` to use `autodetect`; successful detections are cached by `host:port`.
- Add `--force-autodetect` to bypass the cache after device replacement or IP reuse.
- Omit `--ssh-security` to use the default `legacy-compatible` SSH algorithms.

## Standard Execution

```bash
rauto exec "uname -a" --connection edge92
rauto template show_ver.j2 --connection core-01 --vars-json '{"vlan":100}'
```

Use raw `exec` for one-off harmless commands or when no show object exists.
Keep `exec` and stored `template` distinct: use `exec` for literal command text and `template` for a saved command template plus vars.
For device state/config retrieval, prefer `rauto show`.
For config changes, prefer `tx`, `tx-workflow`, or `orchestrate`.

Command-flow TOML and transaction JSON support `multiline_mode`:

- `split_lines`: execute non-empty trimmed lines independently and stop on the first failed command.
- `whole`: preserve the original newlines and submit the text once.

Do not invent a CLI `exec --multiline-mode` option; use a structured flow/transaction model when explicit multiline behavior is required.

## Show Queries

```bash
rauto show --list --device-profile cisco_ios
rauto show version --connection core-01
rauto show interfaces --connection core-01 --print-command
rauto show route --group core --label prod --textfsm-excel ./routes.xlsx
rauto show interfaces --target core-01 --target core-02 --no-parse
```

Rules:

- Use `show` first when the user wants to get configuration/state.
- `show` maps a stable object to the real platform command using the resolved profile and bundled show catalog.
- `show` parses with TextFSM by default; use `--no-parse` for raw output.
- Multi-target show supports saved targets, inventory groups, and labels/tags. It prechecks that every target has the requested object before executing.
- `--textfsm-platform` overrides platform selection only when needed.
- `--textfsm-strict-errors` keeps TextFSM `-> Error` rules; default parsing filters fallback Error rules for better NTC template compatibility.

Custom show objects and TextFSM mappings:

```bash
rauto textfsm template list
rauto textfsm template create my_show_version --file ./templates/my_show_version.textfsm
rauto textfsm mapping set --profile cisco_ios --command "show version" --template my_show_version

rauto show-object list --profile cisco_ios
rauto show-object set \
  --profile cisco_ios \
  --object access-list \
  --command "show access-lists" \
  --mode Enable \
  --textfsm-mapping-command "show access-lists"
```

## Command Flow

```bash
rauto flow-template list
rauto flow-template show cisco_like_copy
rauto flow --template builtin:cisco_like_copy --connection core-01 --vars-json '{"command":"copy scp: flash:/new.bin"}'
```

`rauto` owns command-flow parsing and rendering. rneter executes the resulting concrete flow but no longer owns a command-flow-template model.

## Transaction Family (JSON)

```bash
rauto tx --command "show version" --rollback-command "show version" --connection edge92 --dry-run
rauto tx-workflow ./tx-workflow.json --connection edge92 --dry-run
rauto orchestrate ./orchestration.json --dry-run
```

`tx` is parameter-driven from CLI. Use tx-block JSON as an authoring unit inside workflow/orchestration templates and validate it with the bundled validator.
Use transaction-family commands for config-changing work instead of direct `exec`/`template` whenever a rollback or staged plan is practical.
For multi-device changes, use `orchestrate`; for reusable single-target change plans, use `tx-workflow`; for one target/one transactional unit, use `tx`.

## Reusable JSON Templates

```bash
rauto tx-workflow template list
rauto tx-workflow template show workflow-rollout
rauto tx-workflow template create workflow-rollout --file ./workflow-template.json
rauto tx-workflow --template workflow-rollout --vars ./workflow-vars.json --dry-run

rauto orchestrate template list
rauto orchestrate template show campus-rollout
rauto orchestrate template create campus-rollout --file ./orchestration-template.json
rauto orchestrate --template campus-rollout --vars-json '{"site":"dc-a"}' --view
```

Use nested `template` subcommands under `tx-workflow` and `orchestrate`; do not invent flat commands like `tx-workflow-template`.

## Inventory, History, Replay, Upload, Backup

```bash
rauto inventory group list --json
rauto inventory group show access --json
rauto inventory resolve-vars --host edge92 --group dc-a --json
rauto history list edge92 --limit 20 --json
rauto replay --list --record-file ./record.jsonl
rauto upload --connection edge92 --local-path ./pkg.tar --remote-path /tmp/pkg.tar
rauto backup create
rauto backup list
```

## Recording Defaults

- Every execution is recorded by default.
- Use `--record-level key-events-only` for command + output audit.
- Use `--record-level full` for richer prompt/state details.
