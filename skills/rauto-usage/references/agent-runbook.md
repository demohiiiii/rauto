# Agent Runbook

Use this file when configuring or troubleshooting managed-agent mode.

## Startup

```bash
rauto agent \
  --bind 0.0.0.0 \
  --port 3000 \
  --manager-url http://manager:3000 \
  --agent-name edge-sh-01 \
  --report-mode grpc
```

## Reporting Modes

- `grpc`: full manager-agent path, recommended when manager can expose gRPC.
- `http`: useful when manager is HTTP-only (for example Vercel-style exposure).

## Capabilities Expected in Current Mode

- Registration + heartbeat + periodic status reporting.
- Task callback and task event reporting.
- gRPC agent task service endpoints aligned with current agent execution features.

## Common Checks

1. Confirm manager URL/token/agent name are correct.
2. Confirm report mode matches manager deployment constraints.
3. Confirm local listen bind/port is reachable when manager requires callbacks.
4. Confirm agent and manager both use consistent API versions.

