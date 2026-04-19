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
```

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
rauto tx --file ./tx-block.json --connection edge92
rauto tx-workflow --file ./tx-workflow.json --connection edge92
rauto orchestrate --file ./orchestration.json
```

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

