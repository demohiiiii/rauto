# Rauto Agent Mode Reference

Use this file when the user asks to start managed agent mode, connect to `rauto-manager`, compare `web` vs `agent`, or explain device inventory/status reporting.

## Table of Contents

1. Choose startup mode
2. Start local web UI
3. Start managed agent
4. Agent config file
5. Sync and probe behavior
6. Manager API expectations

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

```bash
rauto agent \
  --bind 0.0.0.0 \
  --port 8123 \
  --manager-url http://manager:3000 \
  --agent-name agent-beijing-01 \
  --agent-token <token> \
  --probe-report-interval 300
```

Key defaults:

- Agent HTTP listen port defaults to `8123`.
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
url = "http://manager:3000"
token = "my-secret-token"

[agent]
name = "agent-beijing-01"
heartbeat_interval = 30
probe_report_interval = 300
```

## 5) Sync and probe behavior

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

## 6) Manager API expectations

Auth on outbound manager requests:

- `Authorization: Bearer <token>`
- `X-API-Key: <token>`

Full inventory sync:

```text
POST /api/agents/report-devices
```

Request body:

```json
{
  "name": "agent-name",
  "devices": [
    {
      "name": "core-sw-01",
      "host": "192.168.1.1",
      "port": 22,
      "device_profile": "cisco_ios"
    }
  ]
}
```

Status update:

```text
POST /api/agents/update-device-status
```

Request body:

```json
{
  "name": "agent-name",
  "devices": [
    {
      "name": "core-sw-01",
      "host": "192.168.1.1",
      "reachable": true
    }
  ]
}
```
