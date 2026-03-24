# rauto Manager Integration Reference

This document is the current manager-facing integration reference for `rauto agent`.

It covers:

- what the manager can call on the agent
- what the manager must expose for agent reporting
- how HTTP and gRPC responsibilities are split
- the latest task/event/result fields, including `exit_code` and transaction `step_results`

This document matches the current implementation in this repository.

## 1. Integration Model

There are two directions:

1. `manager -> agent`
   - task dispatch
   - status/info queries
   - connection/profile/template helper APIs
2. `agent -> manager`
   - registration
   - heartbeat
   - device inventory sync
   - device liveness updates
   - task events
   - task callbacks
   - async error reports

These two directions are intentionally independent.

### 1.1 Reporting transport

`rauto agent` supports two reporting modes:

- `grpc` (default)
- `http`

This mode affects only the `agent -> manager` reporting plane.

It does not automatically force `manager -> agent` task dispatch to use the same protocol.

### 1.2 Task dispatch transport

The manager can call the agent in either of these ways:

- HTTP APIs on the agent
- gRPC `rauto.agent.v1.AgentTaskService` on the same agent port

Recommended use:

- use gRPC task APIs when your manager can speak gRPC directly to the agent
- use HTTP task APIs when your manager already uses HTTP infrastructure or browser-oriented tooling

## 2. Agent Startup Expectations

Example:

```bash
rauto agent \
  --bind 0.0.0.0 \
  --port 8123 \
  --manager-url http://manager.example.com:50051 \
  --report-mode grpc \
  --agent-name edge-sh-01 \
  --agent-token my-secret-token \
  --probe-report-interval 300
```

Key behavior:

- the agent exposes HTTP and gRPC task APIs on the same listen port
- the agent reports back to manager using the configured reporting transport
- if `task_id` is present on managed task requests, the agent emits:
  - real-time task events
  - final task callback

## 3. Authentication

### 3.1 Manager calling agent

Protected HTTP and gRPC task APIs on the agent accept either:

- `Authorization: Bearer <token>`
- `X-API-Key: <token>`

If agent mode is started without a token, the protected APIs are effectively open.

### 3.2 Agent calling manager

Outbound agent reporting uses the same token semantics:

- HTTP mode:
  - `Authorization: Bearer <token>`
  - `X-API-Key: <token>`
- gRPC mode:
  - metadata `authorization: Bearer <token>`
  - metadata `x-api-key: <token>`

## 4. Manager -> Agent HTTP APIs

These routes are exposed by `rauto agent`.

### 4.1 Public HTTP route

- `GET /api/agent/info`

Use for discovery and basic reachability.

### 4.2 Protected HTTP routes

Recommended manager-facing subset:

- `GET /api/agent/status`
- `POST /api/devices/probe`
- `POST /api/exec`
- `POST /api/template/execute`
- `POST /api/tx/block`
- `POST /api/exec/async`
- `POST /api/template/execute/async`
- `POST /api/tx/block/async`
- `POST /api/tx/workflow/async`
- `POST /api/orchestrate/async`
- `GET /api/connections`
- `GET /api/connections/{name}`
- `PUT /api/connections/{name}`
- `POST /api/connection/test`
- `GET /api/device-profiles/all`
- `GET /api/templates`

Notes:

- `tx_workflow` and `orchestrate` are intentionally async-only for manager-facing usage.
- HTTP still exposes additional local-management APIs, but the list above is the stable subset most useful for manager integration.

## 5. Manager -> Agent gRPC APIs

The agent exposes `rauto.agent.v1.AgentTaskService` on the same port.

Current methods:

- `GetAgentInfo`
- `GetAgentStatus`
- `ProbeDevices`
- `ListConnections`
- `UpsertConnection`
- `TestConnection`
- `ListTemplates`
- `ListDeviceProfiles`
- `ExecuteCommand`
- `ExecuteTemplate`
- `ExecuteTxBlock`
- `ExecuteTxBlockAsync`
- `ExecuteTxWorkflowAsync`
- `ExecuteOrchestrationAsync`

### 5.1 Sync vs async split

Synchronous gRPC methods:

- `ExecuteCommand`
- `ExecuteTemplate`
- `ExecuteTxBlock`

Asynchronous gRPC methods:

- `ExecuteTxBlockAsync`
- `ExecuteTxWorkflowAsync`
- `ExecuteOrchestrationAsync`

This is intentional:

- command, template, and tx block often fit direct request-response use
- workflow and orchestration are usually long-running tasks

## 6. Agent -> Manager Reporting

The manager must implement the agent reporting plane.

### 6.1 gRPC reporting service

If agent runs with `--report-mode grpc`, manager must implement:

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

Proto source in this repo:

- [proto/rauto/manager/v1/agent_reporting.proto](/Users/adam/Project/rauto-all/rauto/proto/rauto/manager/v1/agent_reporting.proto)

### 6.2 HTTP reporting endpoints

If agent runs with `--report-mode http`, manager must expose:

- `POST /api/agents/register`
- `POST /api/agents/heartbeat`
- `POST /api/agents/offline`
- `POST /api/agents/report-devices`
- `POST /api/agents/update-device-status`
- `POST /api/agents/report-error`
- `POST /api/agents/report-task-callback`
- `POST /api/agents/report-task-event`

The HTTP request bodies are the JSON equivalents of the gRPC request messages.

## 7. Task Lifecycle

For managed tasks with a non-empty `task_id`, the lifecycle is:

1. manager dispatches task to agent
2. agent accepts sync or async request
3. agent emits task events while running
4. agent sends a final task callback

For async APIs:

- HTTP returns `202 Accepted`
- gRPC async methods return `AcceptedTaskResponse`

Both mean:

- request accepted
- execution continues in background
- final state is delivered through event/callback reporting

## 8. Real-Time Task Events

Task events are designed for timeline UI and progress bars.

Request shape:

```json
{
  "task_id": "uuid",
  "agent_name": "edge-sh-01",
  "event_type": "progress",
  "message": "Executing command 1/3",
  "level": "info",
  "stage": "command",
  "progress": 35,
  "details": {
    "command": "show version"
  },
  "occurred_at": "2026-03-24T10:00:00.000Z"
}
```

Recommended event types in current usage:

- `started`
- `progress`
- `log`
- `step_started`
- `step_completed`
- `warning`
- `failed`
- `completed`

Common stages:

- `connect`
- `render`
- `command`
- `tx_block`
- `workflow`
- `orchestrate`
- `rollback`

### 8.1 `details` payload

`details` is intentionally flexible JSON.

Current important fields manager should be prepared to consume:

- command execution:
  - `command`
  - `mode`
  - `success`
  - `exit_code`
  - `content`
  - `all`
- template execution:
  - `command`
  - `index`
  - `total`
  - `exit_code`
- tx, workflow, orchestration:
  - block, stage, target identifiers
  - rollback metadata
  - fail-fast metadata

Manager should store `details` as JSON, not flatten it into a rigid schema.

## 9. Final Task Callback

Final callback fields:

- `task_id`
- `agent_name`
- `status`
- `started_at`
- `completed_at`
- `execution_time_ms`
- `result`
- `error`

`status` currently uses:

- `success`
- `failed`

### 9.1 Result payload expectations

`result` is operation-specific JSON.

Important current behavior:

- command-oriented results may now contain `exit_code`
- transaction block results now include `step_results`
- workflow results contain block results, and each block result may include `step_results`

Manager should treat `result` as structured JSON and avoid strict fixed-field assumptions.

## 10. `exit_code` Semantics

From `rneter 0.3.3`, Linux shell execution can provide a shell-level exit code.

Where manager can see it:

### 10.1 Sync HTTP and gRPC task responses

- gRPC `ExecuteCommandResponse.exit_code`
- gRPC template `CommandExecutionResult.exit_code`
- HTTP `exec` response `exit_code`
- HTTP template response `executed[].exit_code`

### 10.2 Real-time task events

Available through `details.exit_code` when present.

### 10.3 Recording and replay

`SessionEvent::CommandOutput` may carry `exit_code`.

### 10.4 Final callbacks

If the result payload includes command outputs or template execution results, manager may also see `exit_code` there.

Important notes:

- `exit_code` is optional
- network device templates may not provide it
- Linux shell flows are the main current producer

Manager should allow `null` or absent values.

## 11. Transaction `step_results`

From `rneter 0.3.3`, transaction results now include detailed per-step reports.

Each `TxResult` may contain:

- `step_results: Vec<TxStepResult>`

Each step result includes:

- `step_index`
- `mode`
- `command`
- `execution_state`
- `failure_reason`
- `rollback_state`
- `rollback_command`
- `rollback_reason`

Manager-side guidance:

- store full JSON
- use it for task detail drill-down
- do not assume rollback metadata only appears on failed blocks

This matters even more for workflow compensation, because rollback annotations may be written back into previously committed block results.

## 12. Failure Handling

There are three distinct failure classes.

### 12.1 Business failure

Examples:

- command failed
- tx block failed validation or execution
- workflow failed on a block

Expected manager signals:

- one or more `failed` task events
- final task callback with `status = failed`

### 12.2 Runtime task failure

Examples:

- background task panic
- background task cancelled

Current agent behavior:

- emits fallback `failed` task event
- emits fallback final callback with `status = failed`
- if fallback callback itself fails, agent also sends `report-error`

### 12.3 Agent lost or host lost

Examples:

- process killed
- machine offline
- network path broken

In this case the agent may not be able to send the final failure callback.

Manager must rely on:

- heartbeat freshness
- agent online/offline state
- task timeout policy

Recommended task states:

- `queued`
- `running`
- `success`
- `failed`
- `runtime_failed`
- `agent_lost`

## 13. Minimum Manager Implementation Checklist

Recommended minimum support:

1. agent registration and heartbeat storage
2. device inventory full sync
3. device status incremental update
4. task event timeline storage
5. final task callback storage
6. async error storage
7. agent status and heartbeat timeout handling
8. JSON storage for:
   - `details`
   - callback `result`
   - tx and workflow `step_results`

## 14. Practical Recommendations

- Use gRPC reporting when manager can expose a gRPC endpoint reliably.
- Keep HTTP reporting as a compatibility mode for HTTP-only deployments.
- Treat `details` and callback `result` as versioned JSON payloads.
- Treat `exit_code` as optional.
- Treat `step_results` as potentially large payloads and size storage and indexing accordingly.
- Do not assume workflow rollback only affects the failed block; previously committed blocks may be annotated after compensation.
