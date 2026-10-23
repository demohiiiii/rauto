# Backend architecture

The backend is a single Cargo package that produces the `rauto` binary. DDD
boundaries are represented by Rust modules rather than separately published
crates.

Rust tooling is pinned to `1.94.0` in `rust-toolchain.toml`. CI and release
workflows use the same version. Upgrade these pins together after validating the
new toolchain; `Cargo.toml`'s `rust-version` only declares the minimum supported
version.

## Database baseline

`migrations/202609220001_initial.sql` is the consolidated initial schema. It
creates the current tables, indexes, defaults, and foreign keys directly,
including `interactive_templates`. Task and history operation values use
`interactive`. Add subsequent schema changes as new timestamped migrations.

This baseline replaces the 22 unpublished migrations through
`202608260001_connection_output_encoding.sql`. An existing development database
must be backed up and explicitly rebased before running this version: verify its
applied migrations and final schema, rename the interactive template table, and
replace its SQLx migration history with the new initial version and SHA-384
checksum in one transaction. Preserve all business rows and validate foreign keys
and database integrity. Databases containing old operation tags also need those
tags converted in history, tasks, and structured task results. Application
startup retains SQLx checksum validation; it never silently resets migration
history or reruns the initial schema over an existing database.

## Workbench connection sessions

With keepalive enabled, the Web connection workbench connects a selected or
restored target through `POST /api/connection/connect`. It uses rneter's pooled SSH
sessions and transport heartbeats, with browser preferences defaulting to enabled
and 30 seconds. Disabling keepalive releases the workbench session and retains the
selected target without automatically connecting, including after a page reload;
execution establishes a connection when needed. The interval accepts whole seconds
from 1 to 3600. Execution requests carry the same
runtime `connection.keep_alive` options (`enabled`, `interval_secs`) so subsequent
commands preserve the heartbeat policy. These options are not saved connection
attributes. Omitting them retains the existing non-heartbeat API behavior.

Switching targets, editing the selected saved connection's transport settings,
or changing these preferences releases the previous session via
`POST /api/connection/disconnect`, using the returned `host`, `port`, and `username`.
Refreshing labels, groups, or other inventory metadata does not reconnect.
rneter waits for active operations before closing the pooled sessions, including
recorded variants. Independent per-run recorders retain normal idle expiry.

While keepalive is enabled and the selected target is connected, the browser
revalidates it through the connect endpoint every 15 seconds and when the browser
comes online. rneter reuses healthy sessions and replaces disconnected sessions.
Background validation preserves the connected indicator until it fails; failures
show the error state and wait for an explicit retry. Disabling keepalive stops
validation. `POST /api/connection/test` uses independent one-shot sessions for both
autodetection and the final handshake, so testing a connection cannot replace the
workbench's pooled session or its heartbeat policy.

CLI and gRPC do not have a browser-selected target lifecycle and retain their
existing connection behavior; no automatic connection flags are added there.

## Module ownership

| Layer | Path | Owns |
| --- | --- | --- |
| Domain | `src/domain/connection` | Saved connections, inventory, SSH security and normalization rules |
| Domain | `src/domain/credential` | Credential types, authentication choices and validation |
| Domain | `src/domain/device` | Device profiles, discovery, facts and command catalogs |
| Domain | `src/domain/execution` | Transaction construction, command policy and history models |
| Domain | `src/domain/orchestration` | Plans, stages, jobs, actions, events and structural validation |
| Domain | `src/domain/task` | Task lifecycle, events, result envelopes and summaries |
| Domain | `src/domain/template` | Jinja rendering, interactive templates and content models |
| Infrastructure | `src/infrastructure/db` | SQLite, migrations, repositories, encryption and keyring integration |
| Interfaces | `src/interfaces/api` | HTTP DTOs and generated manager/agent gRPC contracts |
| Application | `src/application`, `src/cli`, `src/web`, `src/agent`, `src/orchestrator`, `src/scheduler` | Use-case coordination and runtime adapters |

## Dependency rules

- Domain modules do not depend on infrastructure, transport handlers or the
  process entry point.
- `interfaces::api` may depend on domain types required by transport contracts.
- `infrastructure::db` may depend on domain types required by persistence.
- Application modules may coordinate all layers and adapt domain errors to CLI,
  HTTP, gRPC and persistence errors.
- Cross-domain dependencies point toward the module that owns the reused
  concept. `domain::execution` currently reuses task result concepts from
  `domain::task`; the other domain modules remain independent.
- Compatibility re-exports in application modules are adapter surfaces, not
  alternate model definitions.

## Placement test

Put data and rules in `src/domain/` when they remain meaningful without a
specific transport or storage technology. Put SQLx, keyring and persistence in
`src/infrastructure/`. Put request/response and gRPC contracts in
`src/interfaces/`. Keep code in the application layer when it coordinates use
cases or directly depends on CLI flags, local files or live rneter sessions.

The backend gate is:

```bash
cargo fmt --all --check
cargo check --all-targets --all-features
cargo test --all-targets
```

## Shared CLI and service runtime

`src/application/execution` owns execution, rendering, parsing, history and task
reporting. Existing Axum handlers are transport adapters over that service; the
CLI prepares `ExecutionRequest` and presents `ExecutionReply`. The tagged request
and result variants reuse the concrete HTTP DTOs in `interfaces::api::models`.
`application::dispatch` is the common dispatcher for direct execution and the
synchronous local service call. Both return the final execution result.
CLI input files cross the boundary as content; export paths remain client-side.
The internal request preserves CLI execution semantics: plain workflow and plan
JSON loads literally, workflow control structures and named templates render,
and command templates continue after individual command failures and report the
aggregate result. Web requests retain template rendering and stop-on-error
defaults. Preview results never export a session recording.

Before initializing SQLite, credentials or rneter sessions, the process checks
`infrastructure::runtime::RuntimeLock`. Ownership uses an OS file lock on the
stable `runtime.lock` inode. Metadata alone never proves ownership. A healthy
service for the same home is preferred; otherwise local execution must acquire
that lock. A busy or unresponsive owner is never bypassed. `serve`, `web` and
`agent` retain ownership until their servers and active requests have ended.
Help, version and static completion return before runtime initialization.

`interfaces::runtime` serves a separate authenticated loopback control plane.
The randomly generated token is kept in `runtime.json` (mode 0600 on Unix),
identity checks include a protocol version and instance ID, and the local client
ignores proxy configuration. The listener uses an ephemeral local port and is
independent of browser session authentication and the public listen address.
`serve` is a foreground service entry point; operating-system service managers
own daemonization and restart policy.

The control plane exposes `POST /execute` and returns `ExecutionReply` in the
same HTTP call. Execution lives in the response body future, with no spawned
execution worker or persistent pending requests. Dropping the body cancels
in-memory waits. Device operations already sent cannot be assumed to be undone.
The shared dispatcher cancels all CLI execution types on shutdown, including
interactive commands and uploads waiting for a device lease. Shutdown takes
priority over ready execution so pending requests cannot start during shutdown.
The client has a connect timeout and short identity-probe timeout, but no fixed
execution response timeout. Errors never trigger automatic resubmission or
local fallback. Service startup does not reload or replay CLI requests.

`application::limits` limits active device operations to four and holds an
exclusive host/port lease across workflows and rollback. DeviceClient, direct
rneter workflow execution and orchestration compensation share those limits.
Web and cron call the same application execution functions, so their independent
request/stage limits cannot exceed this shared device capacity. rneter remains
the sole session engine. Batch fanout belongs to the shared service; the old CLI
execution and fanout implementations have been removed.
