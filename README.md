<div align="center">

# rauto

**The hands for controlling network devices in the AI era.**

[![Crates.io](https://img.shields.io/crates/v/rauto.svg)](https://crates.io/crates/rauto)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Website](https://img.shields.io/badge/Website-rauto.top-0ea5e9?style=for-the-badge&logo=googlechrome&logoColor=white)](https://rauto.top)

[Website](https://rauto.top) · [中文文档](README_zh.md)

</div>

`rauto` is a Rust-based network automation toolkit for operating network devices through CLI, Web, and agent APIs. It builds on [rneter](https://github.com/demohiiiii/rneter) for SSH session handling and [minijinja](https://github.com/mitsuhiko/minijinja) for command templating, providing a simple, high-performance interface for network engineers, automation developers, and AI-driven workflows that need reliable device access, transaction execution, and multi-device orchestration.

## Quick Start

```bash
cargo install rauto

# Linux is now the default device profile
rauto exec "uname -a" --host 192.168.1.10 --username root --password '******'

# Use an explicit network-device profile such as Cisco IOS
rauto exec "show version" --host 192.168.1.1 --username admin --password '******' --device-profile cisco

rauto web --bind 127.0.0.1 --port 3000
```

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Codex Skill (Optional)](#codex-skill-optional)
- [Usage](#usage)
  - [Template Mode (Recommended)](#1-template-mode-recommended)
  - [Direct Execution](#2-direct-execution)
  - [Command Flow Templates](#command-flow-templates)
  - [SFTP Upload](#sftp-upload)
  - [Device Profiles](#3-device-profiles)
  - [Web Console (Axum)](#4-web-console-axum)
  - [Template Storage Commands](#5-template-storage-commands)
  - [Saved Connection Profiles](#6-saved-connection-profiles)
  - [Backup & Restore](#7-backup--restore)
  - [Command Blacklist](#8-command-blacklist)
  - [CLI Quick Reference](#9-cli-quick-reference)
- [Directory Structure](#directory-structure)
- [Configuration](#configuration)
- [Template Syntax](#template-syntax)
- [Contributing](#contributing)
- [License](#license)

## Features

- **Double Template System**: Command Templates (Jinja2) & Device Profiles (TOML).
- **Intelligent Connection Handling**: Uses `rneter` for SSH state management.
- **Dry Run Support**: Preview commands before execution.
- **Variable Injection**: Load variables from JSON.
- **Extensible**: Custom TOML device profiles.
- **Built-in Web Console**: Start browser UI with `rauto web`.
- **Embedded Web Assets**: Frontend files are embedded into the binary for release usage.
- **Saved Connection Profiles**: Reuse named connection settings across commands.
- **Session Recording & Replay**: Record SSH sessions to JSONL and replay offline.
- **Reusable Command Flow Templates**: Execute wizard-style interactive CLI workflows from saved TOML templates, including device-side file transfer, guided installers, or confirmation-heavy operational sequences.
- **SFTP Upload**: Upload local files directly to SSH hosts that expose an `sftp` subsystem.
- **Data Backup & Restore**: Backup full `~/.rauto` runtime data and restore when needed.
- **Multi-device Orchestration (Web + CLI)**: Run staged serial/parallel plans across multiple devices, reusing saved connections and current `tx` / `tx-workflow` capabilities.
- **Command Blacklist**: Block dangerous commands globally before they are sent, with `*` wildcard support.

## Installation

### From Binary (Recommended)

Download the latest release for your platform from [GitHub Releases](https://github.com/demohiiiii/rauto/releases).

### From Crates.io

```bash
cargo install rauto
```

### From Source

Ensure you have Rust and Cargo installed.

```bash
git clone https://github.com/demohiiiii/rauto.git
cd rauto
cargo build --release
```

The binary will be available at `target/release/rauto`.

## Codex Skill (Optional)

This repo includes a Codex skill for rauto usage under `skills/rauto-usage/`.

Recommended usage:

- If you are operating `rauto` through Codex or Claude Code, using the skill is the cleanest path.
- The skill is action-first: it prefers running read-only `rauto` commands directly, and for config changes it prefers `tx` / `tx-workflow` with rollback or `--dry-run` first.
- It also returns a compact execution summary instead of raw terminal noise.

### Install to your machine

1. Clone the repo:

```bash
git clone https://github.com/demohiiiii/rauto.git
```

2. Copy the skill into your Codex skills folder:

```bash
cp -R rauto/skills/rauto-usage "$CODEX_HOME/skills/"
```

Notes:

- If `CODEX_HOME` is not set, it usually defaults to `~/.codex`.
- You can verify the skill is present at `$CODEX_HOME/skills/rauto-usage`.

### Recommended prompts

You can explicitly invoke the skill with `$rauto-usage`, for example:

```text
Use $rauto-usage to test connection lab1 and run "show version".
Use $rauto-usage to preview templates/examples/fabric-advanced-orchestration.json, then wait for my confirmation before execution.
Use $rauto-usage to show connection history for lab1 and summarize failures only.
Use $rauto-usage to render configure_vlan.j2 with templates/example_vars.json and dry-run it first.
```

If your agent supports automatic skill routing, natural requests like these usually work too:

```text
Run one show command on my saved connection lab1.
Preview this tx workflow and tell me the rollback plan.
Check recent execution history for core-01 and summarize the errors.
```

### Claude Code example

If you use Claude Code skills, copy the folder into your Claude Code skills directory:

```bash
cp -R rauto/skills/rauto-usage ~/.claude/skills/
```

`~/.claude/skills/` is a common personal skills location for Claude Code. If your local setup uses a different skills directory, copy it there instead.

## Usage

### 1. Template Mode (Recommended)

Render commands from a template and execute them on a device.
Templates are stored in SQLite and managed with `rauto templates` or the Web UI.

**Basic Usage:**

```bash
rauto template show_version.j2 \
    --host 192.168.1.1 \
    --username admin \
    --password secret \
    --ssh-port 22
```

**With Variables:**
Given a stored template `configure_vlan.j2` and variables file `templates/example_vars.json`:

```bash
rauto template configure_vlan.j2 \
    --vars templates/example_vars.json \
    --host 192.168.1.1 \
    --username admin \
    --password secret \
    --ssh-port 22
```

**Dry Run (Preview):**

```bash
rauto template configure_vlan.j2 \
    --vars templates/example_vars.json \
    --dry-run
```

### 2. Direct Execution

Execute raw commands directly without templates.

```bash
rauto exec "show ip int br" \
    --host 192.168.1.1 \
    --username admin \
    --password secret \
    --ssh-port 22
```

**Specifying Execution Mode:**
Execute a command in a specific mode (e.g., `Enable`, `Config`).

```bash
rauto exec "show bgp neighbor" \
    --host 192.168.1.1 \
    --username admin \
    --password secret \
    --ssh-port 22 \
    --mode Enable
```

### Command Flow Templates

`rauto flow` executes a saved or ad-hoc interactive `CommandFlow` template. This is the generic abstraction for wizard-like CLI work: device-side file transfer, guided installers, feature selection prompts, or any multi-step prompt/response exchange that should stay reusable.

Manage saved templates:

```bash
rauto flow-template list
rauto flow-template show cisco_like_copy
rauto flow-template create cisco_like_copy --file ./templates/examples/cisco-like-command-flow.toml
rauto flow-template update cisco_like_copy --file ./my-flow-template.toml
rauto flow-template delete cisco_like_copy
```

Execute a saved template with runtime variables:

```bash
rauto flow \
    --template cisco_like_copy \
    --vars-json '{"protocol":"scp","direction":"to_device","server_addr":"192.168.1.50","remote_path":"/images/new.bin","device_path":"flash:/new.bin","transfer_username":"backup","transfer_password":"secret"}' \
    --connection core-01
```

Notes:

- `rauto flow` is the preferred way to run interactive command flows from the CLI.
- Saved flow templates live in SQLite and are reused by both CLI and Web.
- Flow templates now follow `rneter 0.4.0`'s structured `CommandFlowTemplate` model instead of the older ad-hoc string template shape.
- Flow templates can declare a `vars` schema with `name`, `type`, `required`, `default`, `options`, `label`, and `description`, so `rauto` can validate runtime vars and render form fields in the Web UI.
- Runtime variables are merged into the template render context under both their top-level names and a nested `vars` object.
- If a step omits `mode`, `rauto` uses the first mode defined by the selected device profile.
- `--record-level` and `--record-file` work the same way as other CLI execution commands.

Ready-to-edit sample flow template:

- [templates/examples/cisco-like-command-flow.toml](/Users/adam/Project/rauto-all/rauto/templates/examples/cisco-like-command-flow.toml)

### SFTP Upload

`rauto upload` is different from `rauto flow` with a built-in file transfer template:

- `rauto flow` can drive interactive device-side `copy scp:` / `copy tftp:` flows through a saved or built-in command flow template.
- `rauto upload` uploads a local file directly over the remote SSH server's `sftp` subsystem.

Use `rauto upload` when the target host exposes SFTP, which is common on Linux hosts and uncommon on many network devices.

```bash
rauto upload \
    --local-path ./configs/daemon.conf \
    --remote-path /tmp/daemon.conf \
    --host 192.168.1.20 \
    --username admin \
    --password secret
```

Optional flags:

- `--buffer-size <bytes>`
- `--timeout-secs <seconds>`
- `--show-progress`
- `--record-level <off|key-events-only|full>`
- `--record-file <path>`

### 3. Device Profiles

`rauto` supports built-in device profiles (inherited from `rneter`) and custom TOML profiles.

Current built-in profiles from `rneter 0.4.0` include:

- Network vendors: `cisco`, `huawei`, `h3c`, `hillstone`, `juniper`, `array`, `arista`, `fortinet`, `paloalto`, `topsec`, `venustech`, `dptech`, `chaitin`, `qianxin`, `maipu`, `checkpoint`
- Servers: `linux`

**List Available Profiles:**

```bash
rauto device list
```

**Using a Specific Profile:**
Default is `linux`. To use Huawei VRP:

```bash
rauto template show_ver.j2 \
    --host 192.168.1.1 \
    --username admin \
    --password secret \
    --ssh-port 22 \
    --device-profile huawei
```

**Using the Linux profile:**

```bash
rauto exec "systemctl status sshd" \
    --host 192.168.1.10 \
    --username admin \
    --password secret \
    --ssh-port 22 \
    --device-profile linux
```

**Custom Device Profile:**
Custom device profiles are stored in SQLite and managed through `rauto device` or the Web UI.

Use it after creating or copying a custom profile:

```bash
rauto exec "show ver" \
    --host 192.168.1.1 \
    --username admin \
    --password secret \
    --ssh-port 22 \
    --device-profile custom_cisco
```

**Useful profile management commands:**

```bash
rauto device list
rauto device show cisco
rauto device show linux
rauto device copy-builtin cisco my_cisco
rauto device delete-custom my_cisco
rauto connection test \
    --host 192.168.1.1 \
    --username admin \
    --password secret \
    --ssh-port 22
```

Notes:

- `rauto device list` follows the current built-in catalog exposed by `rneter`.
- `rauto device show <builtin>` and `rauto device copy-builtin <builtin> <custom>` both use the current built-in handler configs exported by `rneter`.

### 4. Web Console (Axum)

Start the built-in web service and open the visual console in your browser:

```bash
rauto web \
    --bind 127.0.0.1 \
    --port 3000 \
    --host 192.168.1.1 \
    --username admin \
    --password secret \
    --ssh-port 22
```

Then visit `http://127.0.0.1:3000`.

Web assets are embedded into the binary at build time.  
For released binaries, users only need to run the executable (no extra `static/` files required at runtime).

Web console key capabilities:

- Manage saved connections in UI: add, load, update, delete, and inspect details.
- Download a CSV import template and import saved connections from CSV / Excel in UI.
- Choose SSH security profile in UI connection defaults and saved connections: `secure`, `balanced`, or `legacy-compatible`.
- Run direct commands, template execution, command flow execution, tx blocks, tx workflows, and orchestration from `Operations`.
- Manage profiles, command templates, and command flow templates in `Template Manager`.
- Use `SFTP Upload` as a dedicated page for direct file uploads to SSH hosts with an `sftp` subsystem.
- Manage command blacklist patterns in UI: add/delete/check `*` wildcard rules before execution.
- Manage data backups in UI: create/list/download/restore `~/.rauto` backup archives.
- Diagnose profile state machines in Prompt Management -> Diagnostics with visualized result fields.
- Switch Chinese/English in UI.
- Record execution sessions and replay recorded outputs in browser (list events or replay by command/mode).

#### Agent Mode

`rauto web` remains the local self-management UI. Managed mode now starts from `rauto agent`, which is dedicated to `rauto-manager` registration, heartbeat, protected APIs, and task callbacks.

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

You can also keep defaults in `~/.rauto/agent.toml`:

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

Agent mode adds:

- Public `GET /api/agent/info` for manager-side reachability/discovery.
- Protected `GET /api/agent/status` for runtime status and heartbeat metadata.
- Protected `POST /api/devices/probe` for batch TCP reachability checks of saved connections.
- A same-port gRPC task service for manager callers: `rauto.agent.v1.AgentTaskService`.
- Background manager registration, heartbeat, and best-effort offline notification on shutdown.
- Manager reporting supports two transports:
- `grpc` (default): uses `rauto.manager.v1.AgentReportingService`, best when manager can expose a gRPC endpoint.
- `http`: uses manager HTTP endpoints, useful when manager only exposes HTTP(S), such as Vercel-style deployments.
- Full inventory sync after registration and on saved-connection changes; this only syncs `name`, `host`, `port`, and `device_profile`.
- Periodic liveness probe refresh (`probe_report_interval`, default `300`, set `0` to disable) with incremental `reachable` updates.
- `task_id` enables async task events and task callbacks in agent mode; both are now reported back to manager through the selected transport.
- From `rneter 0.3.3`, Linux-oriented command execution can expose `exit_code`; `exec`/`interactive` responses, template command results, and task-event details now carry it when available.
- Transaction results now include step-level `step_results`, so manager-side callbacks can inspect per-step execution and rollback states instead of only block-level success/failure.
- Managed task APIs now provide async accept-and-run endpoints for manager callers over HTTP:
- `POST /api/exec/async`
- `POST /api/template/execute/async`
- `POST /api/tx/block/async`
- `POST /api/tx/workflow/async`
- `POST /api/orchestrate/async`
- These async endpoints require agent mode plus a non-empty `task_id`, return `202 Accepted` immediately, and complete through the existing task event/task callback reporting path.
- The same agent port also exposes gRPC task methods:
- `GetAgentInfo`
- `GetAgentStatus`
- `ProbeDevices`
- `ListCommandFlowTemplates`
- `GetCommandFlowTemplate`
- `UpsertCommandFlowTemplate`
- `DeleteCommandFlowTemplate`
- `ExecuteCommand`
- `ExecuteTemplate`
- `ExecuteCommandFlow`
- `ExecuteUpload`
- `ExecuteTxBlock`
- `ExecuteTxBlockAsync`
- `ExecuteTxWorkflowAsync`
- `ExecuteOrchestrationAsync`
- `exec`, `template_execute`, `command_flow`, `upload`, and `tx_block` use synchronous gRPC methods.
- `tx_block` also provides an async gRPC method for manager callers that want immediate accept-and-run behavior.
- `tx_workflow` and `orchestrate` stay async-only because they are typically long-running tasks.
- Outbound manager requests now send both `Authorization: Bearer <token>` and `X-API-Key: <token>` when a token is configured.
- When agent mode is started with a token, browser-side Web UI requests must provide the same token in the page header token field.

### 5. Template Storage Commands

```bash
rauto templates list
rauto templates show show_version.j2
rauto templates delete show_version.j2
```

### 6. Saved Connection Profiles

You can save and reuse connection settings by name:

```bash
# Add/update a profile directly from CLI args
rauto connection add lab1 \
    --host 192.168.1.1 \
    --username admin \
    --ssh-port 22 \
    --ssh-security balanced \
    --device-profile cisco

# Reuse the saved profile
rauto exec "show version" --connection lab1

# Save current effective connection after a successful run
rauto connection test \
    --connection lab1 \
    --save-connection lab1_backup

# Manage saved profiles
rauto connection list
rauto connection show lab1
rauto connection delete lab1
rauto history list lab1 --limit 20
```

Password behavior:

- `--save-connection` (used in `exec/template/connection test`) saves without password by default; add `--save-password` to include password fields.
- `connection add` saves password only when `--password` / `--enable-password` is explicitly provided.
- Saved passwords are encrypted and stored in `~/.rauto/rauto.db`; the local encryption key is stored in `~/.rauto/master.key`.
- `--ssh-security <secure|balanced|legacy-compatible>` controls SSH algorithm compatibility and is also stored in saved connections.

Bulk import:

```bash
# Import saved connections from CSV
rauto connection import ./devices.csv

# Import saved connections from Excel
rauto connection import ./devices.xlsx
```

Supported file types:

- `.csv`
- `.xlsx`
- `.xls`
- `.xlsm`
- `.xlsb`

Recommended headers:

```csv
name,host,username,password,port,enable_password,ssh_security,device_profile,template_dir
core-sw-01,192.168.1.1,admin,secret,22,,balanced,cisco,
linux-jump-01,192.168.1.10,root,secret,22,,secure,linux,
```

Notes:

- If `name` is omitted, `rauto` derives a saved-connection name from `host`.
- Import uses upsert semantics by connection name.
- If a row omits password fields, existing encrypted passwords are preserved for that connection.
- In the Web UI, use `Saved Connections -> Download Template` to get a starter CSV file.
- Sample files are also included in the repository:
- [templates/examples/connection-import-template-en.csv](/Users/adam/Project/rauto-all/rauto/templates/examples/connection-import-template-en.csv)
- [templates/examples/connection-import-template-zh.csv](/Users/adam/Project/rauto-all/rauto/templates/examples/connection-import-template-zh.csv)

### 7. Backup & Restore

Backup the current `rauto` runtime data store and backup configuration:

Note: backup archives include both `rauto.db` and `master.key`, so saved-connection passwords remain restorable from the backup.

```bash
# Create backup to default path: ~/.rauto/backups/rauto-backup-<timestamp>.tar.gz
rauto backup create

# Create backup to custom output path
rauto backup create --output ./rauto-backup.tar.gz

# List default backup archives
rauto backup list

# Restore archive (merge into current ~/.rauto)
rauto backup restore ./rauto-backup.tar.gz

# Restore archive and replace current ~/.rauto data first
rauto backup restore ./rauto-backup.tar.gz --replace
```

### 8. Command Blacklist

Use a global blacklist to reject commands before they are sent from CLI or Web execution paths (`exec`, template execute, `tx`, `tx-workflow`, `orchestrate`, interactive command).

```bash
# List current patterns
rauto blacklist list

# Add blocked patterns
rauto blacklist add "write erase"
rauto blacklist add "reload*"
rauto blacklist add "format *"

# Check one command against the blacklist
rauto blacklist check "reload in 5"

# Remove a pattern
rauto blacklist delete "reload*"
```

Notes:

- `*` matches any character sequence, including spaces.
- Matching is case-insensitive and applies to the full command text.
- Blacklist data is stored in `~/.rauto/rauto.db`.

### 9. CLI Quick Reference

**Connection troubleshooting**

```bash
rauto connection test \
    --host 192.168.1.1 \
    --username admin \
    --password secret \
    --ssh-port 22
```

**Saved connection profiles**

```bash
rauto connection add lab1 \
    --host 192.168.1.1 \
    --username admin \
    --ssh-port 22 \
    --device-profile cisco
rauto exec "show version" --connection lab1
rauto connection list
rauto history list lab1 --limit 20
```

**Command blacklist**

```bash
rauto blacklist add "reload*"
rauto blacklist add "write erase"
rauto blacklist list
rauto blacklist check "reload in 5"
```

**Profile management**

```bash
rauto device list
rauto device show cisco
rauto device copy-builtin cisco my_cisco
rauto device show my_cisco
rauto device delete-custom my_cisco
```

**Template storage management**

```bash
rauto templates list
rauto templates show show_version.j2
rauto templates delete show_version.j2
```

**Session recording & replay**

```bash
# Record direct exec
rauto exec "show version" \
    --host 192.168.1.1 \
    --username admin \
    --password secret \
    --record-file ~/.rauto/records/show_version.jsonl \
    --record-level full

# Record template execution
rauto template show_version.j2 \
    --host 192.168.1.1 \
    --username admin \
    --password secret \
    --record-file ~/.rauto/records/template_run.jsonl \
    --record-level key-events-only

# Replay / inspect
rauto replay ~/.rauto/records/show_version.jsonl --list
rauto replay ~/.rauto/records/show_version.jsonl --command "show version" --mode Enable
```

**Backup & restore**

```bash
rauto backup create
rauto backup list
rauto backup restore ~/.rauto/backups/rauto-backup-1234567890.tar.gz --replace
```

**Transaction blocks**

```bash
# Tx block with inferred per-step rollback
rauto tx \
    --command "interface vlan 10" \
    --command "ip address 10.0.10.1 255.255.255.0" \
    --host 192.168.1.1 \
    --username admin \
    --password secret

# Tx block with explicit per-step rollback (repeatable flags)
rauto tx \
    --command "interface vlan 10" \
    --command "ip address 10.0.10.1 255.255.255.0" \
    --rollback-command "no interface vlan 10" \
    --rollback-command "no ip address 10.0.10.1 255.255.255.0" \
    --host 192.168.1.1 \
    --username admin \
    --password secret

# Tx block with per-step rollback from file (one per line, empty lines ignored)
rauto tx \
    --command "interface vlan 10" \
    --command "ip address 10.0.10.1 255.255.255.0" \
    --rollback-commands-file ./rollback.txt \
    --host 192.168.1.1 \
    --username admin \
    --password secret

# Tx block with per-step rollback from JSON array
rauto tx \
    --command "interface vlan 10" \
    --command "ip address 10.0.10.1 255.255.255.0" \
    --rollback-commands-json ./rollback.json \
    --host 192.168.1.1 \
    --username admin \
    --password secret

# Tx block with whole-resource rollback
rauto tx \
    --command "vlan 10" \
    --resource-rollback-command "no vlan 10" \
    --host 192.168.1.1 \
    --username admin \
    --password secret

# Tx block backed by a command flow template
rauto tx \
    --run-kind command-flow \
    --flow-template cisco_like_copy \
    --flow-vars-json '{"protocol":"scp","direction":"to_device","server_addr":"192.168.1.50","remote_path":"/images/new.bin","device_path":"flash:/new.bin","transfer_username":"backup","transfer_password":"secret"}' \
    --rollback-flow-template cisco_like_copy \
    --rollback-flow-vars-json '{"protocol":"scp","direction":"from_device","server_addr":"192.168.1.50","remote_path":"/images/old.bin","device_path":"flash:/old.bin","transfer_username":"backup","transfer_password":"secret"}' \
    --rollback-on-failure \
    --connection core-01
```

Notes:

- `rauto tx --run-kind command-flow` runs a saved or ad-hoc command flow as one transaction step.
- `--rollback-flow-template` and `--rollback-flow-file` are optional; when provided they become the compensating rollback step.
- Command-based tx blocks keep the existing `--template`, `--command`, `--rollback-command`, and `--resource-rollback-command` behavior.

**Transaction workflow**

```bash
# Visualize workflow structure in terminal (ANSI colors enabled by default)
# Disable colors with: NO_COLOR=1
rauto tx-workflow ./workflow.json --view

# Execute a workflow from JSON
rauto tx-workflow ./workflow.json \
    --host 192.168.1.1 \
    --username admin \
    --password secret

# Dry-run: print workflow plan and exit
rauto tx-workflow ./workflow.json --dry-run

# Dry-run raw JSON
rauto tx-workflow ./workflow.json --dry-run --json
```

**Transaction workflow JSON example**

```json
{
  "name": "fw-policy-publish",
  "fail_fast": true,
  "blocks": [
    {
      "name": "addr-objects",
      "kind": "config",
      "fail_fast": true,
      "rollback_policy": "per_step",
      "steps": [
        {
          "run": {
            "kind": "command",
            "mode": "Config",
            "command": "address-book global address WEB01 10.0.10.1/32",
            "timeout": 10
          },
          "rollback": {
            "kind": "command",
            "mode": "Config",
            "command": "delete address-book global address WEB01",
            "timeout": 10
          }
        }
      ]
    },
    {
      "name": "policy",
      "kind": "config",
      "fail_fast": true,
      "rollback_policy": {
        "whole_resource": {
          "rollback": {
            "kind": "command",
            "mode": "Config",
            "command": "delete security policies from-zone trust to-zone untrust policy allow-web",
            "timeout": 10
          }
        }
      },
      "steps": [
        {
          "run": {
            "kind": "command",
            "mode": "Config",
            "command": "set security policies from-zone trust to-zone untrust policy allow-web match source-address WEB01",
            "timeout": 10
          },
          "rollback": null
        }
      ]
    }
  ]
}
```

Ready-to-edit sample files:

- [templates/examples/core-vlan-workflow.json](/Users/adam/Project/rauto-all/rauto/templates/examples/core-vlan-workflow.json)

Advanced sample files:

- [templates/examples/fabric-change-workflow.json](/Users/adam/Project/rauto-all/rauto/templates/examples/fabric-change-workflow.json)

**Multi-device orchestration**

```bash
# Preview orchestration structure in terminal
rauto orchestrate ./orchestration.json --view

# Dry-run: print normalized plan and exit
rauto orchestrate ./orchestration.json --dry-run

# Execute a multi-device plan
rauto orchestrate ./orchestration.json --record-level full

# Print execution result as JSON
rauto orchestrate ./orchestration.json --json
```

**Orchestration plan JSON example**

```json
{
  "name": "campus-vlan-rollout",
  "fail_fast": true,
  "stages": [
    {
      "name": "core",
      "strategy": "serial",
      "targets": ["core-01", "core-02"],
      "action": {
        "kind": "tx_workflow",
        "workflow_file": "./workflows/core-vlan.json"
      }
    },
    {
      "name": "access",
      "strategy": "parallel",
      "max_parallel": 10,
      "targets": [
        {
          "connection": "sw-01",
          "vars": {
            "hostname": "sw-01"
          }
        },
        {
          "connection": "sw-02",
          "vars": {
            "hostname": "sw-02"
          }
        }
      ],
      "action": {
        "kind": "tx_block",
        "name": "access-vlan",
        "template": "configure_vlan.j2",
        "mode": "Config",
        "vars": {
          "vlans": [
            {
              "id": 120,
              "name": "STAFF"
            }
          ]
        }
      }
    }
  ]
}
```

**Inventory + group example**

```json
{
  "name": "campus-vlan-rollout",
  "inventory_file": "./inventory.json",
  "stages": [
    {
      "name": "core",
      "strategy": "serial",
      "target_groups": ["core"],
      "action": {
        "kind": "tx_workflow",
        "workflow_file": "./workflows/core-vlan.json"
      }
    },
    {
      "name": "access",
      "strategy": "parallel",
      "max_parallel": 20,
      "target_groups": ["access"],
      "action": {
        "kind": "tx_block",
        "template": "configure_vlan.j2",
        "mode": "Config",
        "vars": {
          "vlans": [
            {
              "id": 120,
              "name": "STAFF"
            }
          ]
        }
      }
    }
  ]
}
```

```json
{
  "defaults": {
    "username": "ops",
    "port": 22,
    "vars": {
      "tenant": "campus"
    }
  },
  "groups": {
    "core": ["core-01", "core-02"],
    "access": {
      "defaults": {
        "username": "admin",
        "port": 22,
        "device_profile": "huawei",
        "vars": {
          "site": "campus-a",
          "region": "east"
        }
      },
      "targets": [
        { "connection": "sw-01", "vars": { "hostname": "sw-01" } },
        { "connection": "sw-02", "vars": { "hostname": "sw-02" } }
      ]
    }
  }
}
```

Ready-to-edit sample files:

- [templates/examples/campus-vlan-orchestration.json](/Users/adam/Project/rauto-all/rauto/templates/examples/campus-vlan-orchestration.json)
- [templates/examples/campus-inventory.json](/Users/adam/Project/rauto-all/rauto/templates/examples/campus-inventory.json)

Advanced sample files:

- [templates/examples/fabric-advanced-orchestration.json](/Users/adam/Project/rauto-all/rauto/templates/examples/fabric-advanced-orchestration.json)
- [templates/examples/fabric-advanced-inventory.json](/Users/adam/Project/rauto-all/rauto/templates/examples/fabric-advanced-inventory.json)

Notes:

- `targets` can reference saved connections by name or provide inline connection fields.
- `target_groups` can load target lists from `inventory_file` or inline `inventory.groups`.
- `inventory.defaults` applies to all groups and stage-level inline `targets`; group `defaults` override inventory defaults.
- `tx_block` stages reuse existing template/rollback behavior and support per-target `vars`.
- `tx_workflow` stages reuse existing single-device workflow JSON.
- Multi-device orchestration is available in both Web UI and CLI.

**CLI ⇄ Web UI mapping**

```text
Operations (Web)                 CLI
-------------------------------- ---------------------------------------------
Direct Execute                   rauto exec
Template Render + Execute        rauto template
Command Flow Execute             rauto flow
SFTP upload                      rauto upload
Transaction Block (Tx Block)     rauto tx
Transaction Workflow (Tx Flow)   rauto tx-workflow
Multi-device Orchestration       rauto orchestrate
Saved connections               rauto connection
Connection history              rauto history
Command blacklist               rauto blacklist

Prompt Profiles (Web)            CLI
-------------------------------- ---------------------------------------------
Built-in profiles                rauto device list / rauto device show <name>
Copy builtin to custom           rauto device copy-builtin <builtin> <custom>
Custom profiles CRUD             rauto device show/delete <custom>

Template Manager (Web)           CLI
-------------------------------- ---------------------------------------------
List templates                   rauto templates list
Show template                    rauto templates show <name>
Delete template                  rauto templates delete <name>
Command flow templates           rauto flow-template

Session Replay (Web)             CLI
-------------------------------- ---------------------------------------------
List records                     rauto replay <jsonl> --list
Replay command                   rauto replay <jsonl> --command "<cmd>" [--mode <Mode>]
```

**Feature availability**

```text
Feature                                   Web UI   CLI
----------------------------------------- ------- ----
Connection profiles CRUD                 Yes     Yes
Execution history browser                Yes     Yes (by file)
Session recording (auto)                 Yes     Yes
Session replay list/inspect              Yes     Yes
Session replay UI table/detail           Yes     No
Device-side SCP/TFTP transfer            Yes     Yes
SFTP upload                              Yes     Yes
Prompt profile diagnose view             Yes     No
Workflow builder (visual)                Yes     No
Transaction workflow JSON execution      Yes     Yes
Multi-device orchestration (plan JSON)   Yes     Yes
Command blacklist management             Yes     Yes
```

**Migration tips (Web ⇄ CLI)**

```text
Workflow Builder → CLI
  1. In Web, open Tx Workflow step and click "Generate JSON".
  2. Download JSON (More Actions → Download JSON).
  3. Run: rauto tx-workflow ./workflow.json

Tx Block (custom per-step rollback) → CLI
  1. In Web, choose Rollback mode = "custom per-step".
  2. Use "text" to copy rollback lines.
  3. Run: rauto tx --rollback-commands-file ./rollback.txt ... (commands in same order)

CLI recordings → Web Replay
  1. Run with --record-file to create JSONL.
  2. Open Web → Session Replay, paste JSONL and inspect.
```

**Start web console**

```bash
rauto web \
    --bind 127.0.0.1 \
    --port 3000
```

## Directory Structure

By default, `rauto` stores runtime data under `~/.rauto/`.

Default runtime data:

- `~/.rauto/rauto.db` (saved connections, history recordings, blacklist patterns, custom device profiles, managed command templates)
- `~/.rauto/backups` (backup archives)

`~/.rauto` and `~/.rauto/backups` are auto-created on startup.

```
~/.rauto
├── rauto.db                # SQLite runtime store
└── backups/                # Backup archives (*.tar.gz)
```

## Configuration

| Argument            | Env Var          | Description                                                     |
| ------------------- | ---------------- | --------------------------------------------------------------- |
| `--host`            | -                | Device hostname or IP                                           |
| `--username`        | -                | SSH username                                                    |
| `--password`        | `RAUTO_PASSWORD` | SSH password                                                    |
| `--enable-password` | -                | Enable/Secret password                                          |
| `--ssh-port`        | -                | SSH port (default: 22)                                          |
| `--ssh-security`    | -                | SSH security profile: `secure`, `balanced`, `legacy-compatible` |
| `--device-profile`  | -                | Device type/profile (default: `linux`; examples: `huawei`, `linux`, `fortinet`) |
| `--connection`      | -                | Load saved connection profile by name                           |
| `--save-connection` | -                | Save effective connection profile after successful connect      |
| `--save-password`   | -                | With `--save-connection`, also save password/enable_password    |

Recording-related options (command-specific):

- `exec/template --record-file <path>`: Save recording JSONL after execution.
- `exec/template --record-level <off|key-events-only|full>`: Recording granularity.
- `replay <record_file> --list`: List recorded command output events.
- `replay <record_file> --command <cmd> [--mode <mode>]`: Replay one command output.
- With `rneter 0.3.3`, replayed `SessionEvent::CommandOutput` entries may include `exit_code` for Linux shell flows.

## Template Syntax

`rauto` uses Minijinja, which is compatible with Jinja2.

**Example `configure_vlan.j2`:**

```jinja
conf t
{% for vlan in vlans %}
vlan {{ vlan.id }}
 name {{ vlan.name }}
{% endfor %}
end
```

**Example variables:**

```json
{
  "vlans": [
    { "id": 10, "name": "Marketing" },
    { "id": 20, "name": "Engineering" }
  ]
}
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT
