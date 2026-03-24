# Rauto Agent Mode Reference

Use this file when the user asks to start managed agent mode, connect to `rauto-manager`, compare `web` vs `agent`, or explain device inventory/status reporting.

## Table of Contents

1. Choose startup mode
2. Start local web UI
3. Start managed agent
4. Agent config file
5. Report transport modes
6. Sync and probe behavior
7. Manager interface expectations

## 1) Choose startup mode

- Use `rauto web` for local self-management UI only.
- Use `rauto agent` when the process must register to `rauto-manager`, expose protected agent APIs, sync saved-device inventory, and report device status probes.

## 2) Start local web UI

```bash
rauto web --bind 127.0.0.1 --port 3000
```

Open:

```text
http://127.0.0.1:3000
```

## 3) Start managed agent

### gRPC reporting mode

```bash
rauto agent \
  --bind 0.0.0.0 \
  --port 8123 \
  --manager-url http://manager:50051 \
  --report-mode grpc \
  --agent-name agent-beijing-01 \
  --agent-token <token> \
  --probe-report-interval 300
```

### HTTP reporting mode

```bash
rauto agent \
  --bind 0.0.0.0 \
  --port 8123 \
  --manager-url https://manager.example.com \
  --report-mode http \
  --agent-name agent-beijing-01 \
  --agent-token <token> \
  --probe-report-interval 300
```

Key defaults:

- Agent HTTP listen port defaults to `8123`.
- `report_mode` defaults to `grpc`.
- `probe_report_interval` defaults to `300` seconds.
- Set `--probe-report-interval 0` to disable periodic status refresh.

## 4) Agent config file

Default path:

```text
~/.rauto/agent.toml
```

Example:

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

## 5) Report transport modes

### `grpc`

Use this when manager can expose a real gRPC endpoint.

Characteristics:

- default mode
- uses `rauto.manager.v1.AgentReportingService`
- best choice when manager and agent can both use gRPC directly
- supports `RegisterAgent`, `SendHeartbeat`, `NotifyOffline`, `ReportDevices`, `UpdateDeviceStatus`, `ReportError`, `ReportTaskCallback`, and `ReportTaskEvent`

### `http`

Use this when manager only exposes HTTP(S).

Characteristics:

- useful for HTTP-only deployments such as Vercel-style environments
- keeps the same logical reporting events as gRPC
- manager implements REST-style endpoints instead of protobuf RPCs
- supports the same logical reporting surface as gRPC, including task events and final callbacks

## 6) Sync and probe behavior

Startup sequence:

1. Register agent to manager.
2. Full-sync saved device inventory.
3. Probe saved devices and send status update.

Ongoing behavior:

- Heartbeat keeps agent runtime state fresh.
- Saved connection add/update/delete triggers a full inventory sync, then a status refresh.
- Periodic probing only updates device status, not base inventory fields.

Probe semantics:

- Reachability is TCP connect success to `host:port`.
- It is not an SSH login or prompt-validation result.

## 7) Manager interface expectations

Auth on outbound manager requests:

- `Authorization: Bearer <token>`
- `X-API-Key: <token>`

### HTTP mode

Manager should expose:

- `POST /api/agents/register`
- `POST /api/agents/heartbeat`
- `POST /api/agents/offline`
- `POST /api/agents/report-devices`
- `POST /api/agents/update-device-status`
- `POST /api/agents/report-error`
- `POST /api/agents/report-task-callback`
- `POST /api/agents/report-task-event`

### gRPC mode

Manager should expose:

- package: `rauto.manager.v1`
- service: `AgentReportingService`

RPCs:

- `RegisterAgent`
- `SendHeartbeat`
- `NotifyOffline`
- `ReportDevices`
- `UpdateDeviceStatus`
- `ReportError`
- `ReportTaskCallback`
- `ReportTaskEvent`

### Manager calling the agent

`rauto agent` also exposes a same-port gRPC task service:

- package: `rauto.agent.v1`
- service: `AgentTaskService`

High-value methods for manager callers:

- sync: `GetAgentInfo`, `GetAgentStatus`, `ProbeDevices`, `ListConnections`, `UpsertConnection`, `TestConnection`, `ListTemplates`, `ListDeviceProfiles`, `ExecuteCommand`, `ExecuteTemplate`, `ExecuteTxBlock`
- async: `ExecuteTxBlockAsync`, `ExecuteTxWorkflowAsync`, `ExecuteOrchestrationAsync`

Notes:

- gRPC task dispatch and HTTP task dispatch are independent from the reporting mode.
- `report_mode` is not currently included as a field in register/heartbeat payloads; manager should trust the actual inbound transport.
- For the full current matrix, read `docs/manager-integration-reference.md`.
