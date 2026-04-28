# Web and Agent Modes

`rauto` provides two different service forms:

- `rauto web`
- `rauto agent`

They both expose HTTP services, but they do not serve the same purpose.

## `rauto web`: local self-service console

Start it with:

```bash
rauto web --bind 127.0.0.1 --port 3000
```

Open:

```text
http://127.0.0.1:3000
```

### Good use cases

- you manage devices locally by yourself
- you want a browser UI for connections, templates, execution, and replay
- you do not need to connect to an external manager platform

### Main capabilities

- saved connection management
- template and flow template management
- prompt profile management and diagnostics
- inventory group and label management
- execution of commands, templates, flows, transactions, workflows, and orchestration
- blacklist management
- backup and restore
- recording and replay

## `rauto agent`: managed execution agent

Start it with:

```bash
rauto agent \
  --bind 0.0.0.0 \
  --port 8123 \
  --manager-url http://manager:50051 \
  --report-mode grpc \
  --agent-name agent-beijing-01 \
  --agent-token my-secret-token \
  --probe-report-interval 300
```

You can also keep defaults in a config file:

```toml
[manager]
url = "http://manager:50051"
token = "my-secret-token"
report_mode = "grpc"

[agent]
name = "agent-beijing-01"
heartbeat_interval = 30
probe_report_interval = 300
```

### Good use cases

- an external manager platform schedules multiple agents
- device access, task execution, and heartbeat reporting should all be centralized
- protected APIs and task callbacks are required

### What the agent provides

- manager registration and heartbeat
- device status and inventory reporting
- execution of manager-issued tasks
- task events, task callbacks, and error reporting back to the manager
- token-protected browser and API access

## Boundary between the two modes

You can think of them like this:

- `web`: local UI console
- `agent`: managed execution node in a larger platform

If you are operating devices locally, prefer `web`.
If you need the node to join a centralized control plane, use `agent`.

## UI differences

The frontend also distinguishes between local web mode and agent mode:

- some task-related managed features only appear in agent mode
- local web mode focuses more on self-service management and execution

## Recommended practice

- use `rauto web` first for single-user or lab usage
- move to `rauto agent` when platform integration is needed
- always configure a token and manager endpoint for agent mode
- keep exposed agents inside a controlled network environment

## Next steps

Continue with:

- [Inventory, History, and Operations](./inventory-and-operations.md)
