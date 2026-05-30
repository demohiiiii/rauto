# CLI Runbook

Use this file when executing `rauto` commands directly for users.

## Service Startup

```bash
rauto web --bind 127.0.0.1 --port 3000
rauto agent --bind 0.0.0.0 --port 3000 --manager-url http://manager:3000 --agent-name edge-sh-01 --report-mode grpc
```

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

## Command Flow

```bash
rauto flow-template list
rauto flow-template show cisco_like_copy
rauto flow --template builtin:cisco_like_copy --connection core-01 --vars-json '{"command":"copy scp: flash:/new.bin"}'
```

## Transaction Family (JSON)

```bash
rauto tx --command "show version" --rollback-command "show version" --connection edge92 --dry-run
rauto tx-workflow ./tx-workflow.json --connection edge92 --dry-run
rauto orchestrate ./orchestration.json --dry-run
```

`tx` is parameter-driven from CLI. Use tx-block JSON for Web/API payloads and saved template flows.

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
