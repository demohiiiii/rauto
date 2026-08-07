# CLI Runbook

Use this file when executing `rauto` commands directly for users.

## Service Startup

```bash
rauto web
rauto web --bind 127.0.0.1 --port 3000
rauto agent --bind 0.0.0.0 --port 8123 --manager-url http://manager:50051 --agent-name edge-sh-01 --report-mode grpc
```

### Local Web Workbench

`rauto web` starts the local browser workbench. It does not require a device connection at startup. The defaults are `127.0.0.1:3000`; open `http://127.0.0.1:3000` after startup and enter the Web password. The first startup generates and prints a random password, then stores it as `web.password` in `~/.rauto/config.toml`; later startups reuse it. The service remains in the foreground, so keep its process/session running.

| Option                             | Meaning                                                                                              |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `--bind <ADDRESS>`                 | Web server listen address; defaults to `127.0.0.1`.                                                  |
| `--port <PORT>`                    | Web server listen port; defaults to `3000`.                                                          |

Keep `--bind 127.0.0.1` for local-only use. Use `--bind 0.0.0.0` only when the user explicitly needs network access, and warn that password authentication does not encrypt plaintext HTTP traffic.

The Web service only starts the workbench; select a saved connection and credential from the browser UI.

## Connection and Profile Operations

```bash
rauto device list
rauto device list --json
rauto device show core-01
rauto device show core-01 --json
rauto device test --connection core-01
rauto credential add network-admin
rauto credential list
rauto credential show network-admin
rauto credential update network-admin --name network-ops
rauto credential import ./credentials.csv
rauto credential delete network-ops

rauto device add core-01 --host 192.168.1.10 --credential network-admin --device-profile linux
rauto profile list
rauto profile show linux
rauto profile diagnose linux --json
rauto profile autodetect --host 192.168.1.10 --credential network-admin
rauto profile autodetect -v --host 192.168.1.10 --credential network-admin
```

Notes:

- `connection` remains an alias for `device`, but use `device` in new commands and documentation.
- Saved connections store a credential reference; direct CLI targets use `--credential <name-or-id>`.
- `credential add` prompts for login values when they are not provided; list/show output never includes secret values.
- Credential authentication supports password, keyboard-interactive, an encrypted inline private key loaded with `--private-key`, or a runtime key path set with `--private-key-file`; use `--passphrase` for encrypted keys.
- `credential import` accepts CSV/Excel and upserts by credential name; `enable_enabled=true` enters the Enable stage and submits an empty Enter when `enable_secret` is blank. New rows require `name`, `login_username`, and `login_secret`.
- Omit `--device-profile` to use `autodetect`; successful detections are cached by `host:port`.
- Add `--force-autodetect` to bypass the cache after device replacement or IP reuse.
- Omit `--ssh-security` to use the default `legacy-compatible` SSH algorithms.

## Standard Execution

```bash
rauto exec "uname -a" --connection edge92
rauto exec "id" --connection linux-01 --mode 'Root,User'
rauto exec "show clock" --group access --label campus --max-parallel 8
rauto template show_ver --connection core-01 --vars ./command-vars.json
rauto flow --template health-check --target core-01 --target core-02 --max-parallel 4
```

Use raw `exec` for one-off harmless commands or when no show object exists.
Keep `exec` and stored `template` distinct: use `exec` for literal command text and `template` for a saved command template plus vars.
For device state/config retrieval, prefer `rauto show`.
For config changes, prefer `tx`, `tx-workflow`, or `orchestrate`.

`exec`, `flow`, `show`, and `config fetch` share multi-target selection. Repeat `--target`, `--group`, and `--label`/`--tag`; selectors use deduplicated union semantics. rauto resolves and validates every target before starting concurrent execution.

Mode-bearing CLI options and structured models accept either one mode or ordered candidates separated by comma or pipe. For example, `--mode 'Root,User'` first validates both modes against the selected profile, then allows rneter to execute from or transition to an available candidate. Do not rewrite the value as one invented mode.

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

Successful show output omits prompt-only transcript noise. On failure, retain the complete diagnostic transcript rather than presenting only partial command content. Built-in `version` mappings include H3C/HP/HPE Comware and Linux `os-release` parsing.

## Configuration Fetch

```bash
rauto config fetch --connection core-01 --kind running
rauto config fetch --connection core-01 --output ./core-01-running.cfg
rauto config fetch --group access --kind startup --output-dir ./configs
rauto config fetch --group access --normalized --max-parallel 8

rauto config command list --profile linux
rauto config command set linux running "cat /etc/device.conf" --mode 'Root,User'
rauto config volatile add linux '^# Generated at .*$'
```

Each successful fetch includes raw and normalized SHA-256 hashes. `--normalized` emits content after volatile-line removal. Use `--output` only for one resolved device and `--output-dir` for timestamped per-device files. Custom command mappings override the bundled catalog; custom volatile regexes merge with bundled rules.

## Device Discovery

```bash
rauto device discover 192.168.60.0/24 --credential network-admin
rauto device discover list --status identified
rauto device discover save --profile cisco_ios
```

Load `device-discovery.md` before scanning, filtering, using the TUI, or saving discovered devices.

## Command Flow

```bash
rauto flow-template list
rauto flow-template show my_copy_flow
rauto flow --template builtin:cisco_like_copy --connection core-01 --vars-json '{"command":"copy scp: flash:/new.bin"}'
```

`rauto` owns command-flow parsing and rendering. rneter executes the resulting concrete flow but no longer owns a command-flow-template model.
`builtin:cisco_like_copy` is an executable built-in, not a saved record returned by `flow-template list/show`. Use `flow-template create/update/delete` only for custom saved templates.

## Transaction Family (JSON)

```bash
rauto tx --command "show version" --rollback-command "show version" --connection edge92 --dry-run
rauto tx-workflow ./tx-workflow.json --connection edge92 --dry-run
rauto orchestrate ./orchestration.json --dry-run
```

`tx` is parameter-driven from CLI. Use tx-block JSON inside transaction workflows, including workflows later selected by orchestration, and validate it with the bundled validator. Do not use a tx block as a direct orchestration action.
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

## Inventory, Session Records, Upload, Backup

```bash
rauto inventory group list --json
rauto inventory group show access --json
rauto inventory group upsert access --file ./access-group.json
rauto session
rauto session list edge92 --limit 20 --json
rauto session replay ./record.jsonl --list
rauto session replay --connection edge92 --list
rauto upload --connection edge92 --local-path ./pkg.tar --remote-path /tmp/pkg.tar
rauto backup create
rauto backup list
```

The inventory group name comes from the positional `upsert` argument. The JSON body only needs optional `description` and `hosts`; do not duplicate `name` in it.

Device groups only store saved-device membership and an optional description. They do not provide group variables or inline connection definitions:

```json
{
  "name": "access",
  "description": "Campus access switches",
  "hosts": ["edge-sw-01", "edge-sw-02"]
}
```

## Recording Defaults

- Every execution is recorded by default.
- Use `--record-level key-events-only` for command + output audit.
- Use `--record-level full` for richer prompt/state details.

## Session Retries

- Retries default to disabled (`--session-retries 0`).
- Enable retries only for repeat-safe ordinary commands, flows, show queries, and config fetches because a command may have completed before transport loss was detected.
- Tune exponential backoff with `--retry-initial-backoff-ms` and `--retry-max-backoff-ms`.
- Flow retries retain completed steps and resume at the first unfinished step.
- Authentication rejection is not transient unless `--retry-authentication-errors` is explicitly supplied.
- Transactions, transaction workflows, orchestration actions, and uploads are not automatically retried.
