# Managed Agent

## Startup

```sh
rauto agent --bind 0.0.0.0 --port 8123 \
  --manager-url http://manager:50051 --agent-name edge-sh-01 --report-mode grpc
```

The listener defaults to `0.0.0.0:8123`. Manager registration needs an effective
manager URL and agent name. Values resolve from flags/environment before the
TOML configuration (`RAUTO_HOME/agent.toml` by default). Check those sources
before asking for missing settings. `--agent-config` chooses another file.

| CLI option | Environment |
| --- | --- |
| `--manager-url` | `RAUTO_MANAGER_URL` |
| `--agent-name` | `RAUTO_AGENT_NAME` |
| `--agent-token` | `RAUTO_AGENT_TOKEN` |
| `--report-mode` | `RAUTO_MANAGER_REPORT_MODE` |
| `--probe-report-interval` | `RAUTO_AGENT_PROBE_REPORT_INTERVAL` |

Prefer token configuration through the existing environment/config over
secret command-line values. Agent APIs use token authentication rather than
the standalone Web password login.

## Configuration

```toml
[manager]
url = "http://manager:50051"
report_mode = "grpc"

[agent]
name = "edge-sh-01"
heartbeat_interval = 30
probe_report_interval = 300
```

Report mode defaults to `grpc`. Choose `http` for an HTTP-only manager and use
the manager's actual endpoint/port. `probe_report_interval = 0` disables
periodic device liveness probes, not registration or heartbeats. CLI/env
overrides are available for the probe interval; heartbeat is configured in
TOML and defaults to 30 seconds.

The agent registers, sends heartbeat/status, reports task events, and accepts
manager tasks over its current HTTP/gRPC adapters. Device changes still execute
through command/interactive or transaction-workflow/orchestration capabilities;
there is no standalone transaction-block executor.

## Diagnose

Confirm manager endpoint, chosen transport, unique agent name, authentication,
and manager-to-agent callback reachability. Keep token values out of logs and
reports. Verify the agent and manager agree on current task/proto contracts
before changing persisted data. For device failures use
[Troubleshooting](troubleshooting.md); for a local workbench use
[Web](web-runbook.md).

Source: `src/agent/config.rs`, `src/agent/report_mode.rs`, `src/cli/args.rs`,
`src/agent/`, and `proto/`.
