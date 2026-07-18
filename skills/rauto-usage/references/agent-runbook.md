# Agent Runbook

Use this file when configuring or troubleshooting managed-agent mode.

## Startup

```bash
rauto agent \
  --bind 0.0.0.0 \
  --port 8123 \
  --manager-url http://manager:50051 \
  --agent-name edge-sh-01 \
  --report-mode grpc \
  --probe-report-interval 300
```

The listener defaults to `0.0.0.0:8123`. Manager URL and agent name may come
from flags, environment, or `~/.rauto/agent.toml`; do not claim they are
missing until all three sources have been checked.

## Startup Options

| Option                           | Environment variable                | Meaning                                                    |
| -------------------------------- | ----------------------------------- | ---------------------------------------------------------- |
| `--bind <ADDRESS>`               | -                                   | Agent callback/listen address; defaults to `0.0.0.0`.      |
| `--port <PORT>`                  | -                                   | Agent callback/listen port; defaults to `8123`.            |
| `--manager-url <URL>`            | `RAUTO_MANAGER_URL`                 | Manager registration and reporting endpoint.               |
| `--agent-name <NAME>`            | `RAUTO_AGENT_NAME`                  | Unique agent registration name.                            |
| `--agent-token <TOKEN>`          | `RAUTO_AGENT_TOKEN`                 | Authentication token; prefer environment/config over argv. |
| `--report-mode <MODE>`           | `RAUTO_MANAGER_REPORT_MODE`         | Manager reporting transport: `http` or `grpc`.             |
| `--agent-config <PATH>`          | -                                   | Agent TOML path; defaults to `~/.rauto/agent.toml`.        |
| `--probe-report-interval <SECS>` | `RAUTO_AGENT_PROBE_REPORT_INTERVAL` | Liveness probe interval; `0` disables periodic probes.     |

## Reporting Modes

- `grpc`: full manager-agent path, recommended when manager can expose gRPC.
- `http`: useful when manager is HTTP-only (for example Vercel-style exposure).

## Capabilities Expected in Current Mode

- Registration + heartbeat + periodic status reporting.
- Task callback and task event reporting.
- gRPC agent task service endpoints aligned with current agent execution features.

## Common Checks

1. Confirm effective manager URL, token, agent name, and config path are correct.
2. Confirm report mode matches manager deployment constraints.
3. Confirm local listen bind/port is reachable when manager requires callbacks.
4. Confirm `--probe-report-interval` is intentional; use `0` to disable periodic device probes.
5. Confirm agent and manager both use consistent API versions.
