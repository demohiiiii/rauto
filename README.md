<div align="center">

<img src="static/rauto-icon.svg" alt="rauto icon" width="112" />

# rauto

**The hands for controlling network devices in the AI era.**

[![Crates.io](https://img.shields.io/crates/v/rauto.svg)](https://crates.io/crates/rauto)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)
[![Website](https://img.shields.io/badge/Website-rauto.top-0ea5e9?style=for-the-badge&logo=googlechrome&logoColor=white)](https://rauto.top)

[Website](https://rauto.top) · [中文文档](README_zh.md)

</div>

`rauto` is a Rust-based network automation toolkit for operating network devices through CLI, Web, and agent APIs. It builds on [rneter](https://github.com/demohiiiii/rneter) for SSH session handling and [minijinja](https://github.com/mitsuhiko/minijinja) for command templating, providing a simple, high-performance interface for network engineers, automation developers, and AI-driven workflows that need reliable device access, transaction execution, and multi-device orchestration.

## Quick Start

```bash
cargo install rauto

# The default device profile is autodetect
rauto exec "uname -a" --host 192.168.1.10 --username root --password '******'

# Use an explicit network-device profile such as Cisco IOS
rauto exec "show version" --host 192.168.1.1 --username admin --password '******' --device-profile cisco

rauto web --bind 127.0.0.1 --port 3000
```

## Table of Contents

- [Features](#features)
- [Installation](#installation)
  - [From Binary (Recommended)](#from-binary-recommended)
  - [From Crates.io](#from-cratesio)
  - [From Source](#from-source)
- [Codex Skill (Optional)](#codex-skill-optional)
- [Usage](#usage)
  - [Command Selection Guide](#command-selection-guide)
  - [Template Mode](#template-mode)
  - [Direct Execution](#direct-execution)
  - [Command Flow Templates](#command-flow-templates)
  - [SFTP Upload](#sftp-upload)
  - [Device Profiles](#device-profiles)
  - [Web Console](#web-console)
    - [Agent Mode](#agent-mode)
  - [Template Storage Commands](#template-storage-commands)
  - [Saved Connection Profiles](#saved-connection-profiles)
  - [Backup & Restore](#backup--restore)
  - [Command Blacklist](#command-blacklist)
  - [Transaction Block](#transaction-block)
  - [Transaction Workflow](#transaction-workflow)
  - [Multi-device Orchestration](#multi-device-orchestration)
  - [Reusable Execution Templates](#reusable-execution-templates)
  - [Inventory CLI](#inventory-cli)
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
- **Bulk Connection Import**: Import saved connections from CSV / Excel with upsert behavior.
- **SSH Security Profiles**: Choose `secure`, `balanced`, or `legacy-compatible` per target.
- **Inventory Groups & Labels**: Organize saved connections with reusable grouping metadata.
- **Session Recording & Replay**: Record SSH sessions to JSONL and replay offline.
- **Reusable Command Flow Templates**: Execute wizard-style interactive CLI workflows from saved TOML templates, including device-side file transfer, guided installers, or confirmation-heavy operational sequences.
- **Reusable Execution Templates**: Save tx block / workflow / orchestration JSON as reusable templates with variable rendering.
- **SFTP Upload**: Upload local files directly to SSH hosts that expose an `sftp` subsystem.
- **Data Backup & Restore**: Backup full `~/.rauto` runtime data and restore when needed.
- **Async Task Tracking**: Inspect queued/running/completed async jobs, events, artifacts, and recordings in Web UI.
- **Agent Mode**: Run `rauto agent` for manager registration, heartbeat, protected APIs, and task callbacks.
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

This repo includes a Codex skill under `skills/rauto-usage/` for agent-driven workflows.

Use it when you already have a Codex-compatible client with skill loading enabled.
Copy the folder into that client's configured skills directory.

Install it with:

```bash
cp -R skills/rauto-usage "$CODEX_HOME/skills/"
```

If your Codex setup does not expose `$CODEX_HOME`, copy `skills/rauto-usage/` into the skills directory configured by your client.
If you use Claude Code, the equivalent location is usually `~/.claude/skills/`.

## Usage

### Command Selection Guide

| If you need to...                            | Use                 | Notes                                                                              |
| -------------------------------------------- | ------------------- | ---------------------------------------------------------------------------------- |
| Run one command immediately                  | `rauto exec`        | Best for direct ad-hoc commands; optional `--mode` narrows the target prompt/mode. |
| Render a reusable command template with vars | `rauto template`    | Best when command text should come from stored Jinja templates.                    |
| Drive interactive prompt/response flows      | `rauto flow`        | Best for wizard-like CLI exchanges, copy dialogs, and confirmation-heavy steps.    |
| Upload a local file over remote SFTP         | `rauto upload`      | Requires the SSH server to expose an `sftp` subsystem.                             |
| Execute one rollback-aware transaction block | `rauto tx`          | Best for one target with step rollback or resource rollback semantics.             |
| Execute a multi-step workflow from JSON      | `rauto tx-workflow` | Best when a transaction is modeled as named blocks/stages in a workflow file.      |
| Execute a multi-device staged plan           | `rauto orchestrate` | Best for serial/parallel rollout plans across many saved connections.              |

### Template Mode

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

### Direct Execution

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
rauto flow-template create linux_scp_with_current_and_peer --file ./templates/examples/linux-scp-with-current-and-peer-command-flow.toml
rauto flow-template update cisco_like_copy --file ./my-flow-template.toml
rauto flow-template delete cisco_like_copy
```

Execute a saved template with runtime variables:

```bash
rauto flow \
    --template cisco_like_copy \
    --vars-json '{"command":"copy scp: flash:/new.bin","server_addr":"192.168.1.50","remote_path":"/images/new.bin","transfer_username":"backup","transfer_password":"secret"}' \
    --connection core-01
```

Notes:

- `rauto flow` is the preferred way to run interactive command flows from the CLI.
- Saved flow templates live in SQLite and are reused by both CLI and Web.
- Built-in flow templates are exposed via `/api/flow-templates/builtins`; execution accepts `--template builtin:<name>` (CLI) or `builtin:<name>` values in Web selectors.
- Flow templates follow rneter's current inline `{{var}}` `CommandFlowTemplate` model and execute steps linearly with prompt-driven interactions.
- Flow templates can declare a `vars` schema with `name`, `type`, `required`, `default`, `options`, `label`, and `description`, so `rauto` can validate runtime vars and render form fields in the Web UI.
- Runtime variables are merged into the template render context under both their top-level names and a nested `vars` object.
- Runtime var references support both `connection_name.param_name` (cross-connection lookup) and plain `param_name` (request vars first, then current target connection fallback).
- Command flow templates support `current_connection_alias = "<alias>"` at top level. This lets templates reference the selected execution target as `{{alias.host}}`, `{{alias.username}}`, `{{alias.password}}`, etc., without adding that alias to `[[vars]]`.
- For alias-to-connection usage, set one runtime var to a saved connection name (for example `peer=edge94`) and reference `{{peer.host}}`/`{{peer.username}}`/`{{peer.password}}` directly in the template.
- If a step omits `mode`, `rauto` uses the first mode defined by the selected device profile.
- Every execution records a session by default.
- `--record-level key-events-only` keeps the audit-friendly minimum: input commands and device output.
- `--record-level full` also captures richer prompt and state-transition details.
- `--record-file` still exports the same JSONL recording to a file when you want a copy.

Ready-to-edit sample flow template:

- [templates/examples/cisco-like-command-flow.toml](templates/examples/cisco-like-command-flow.toml)
- [templates/examples/linux-scp-with-current-and-peer-command-flow.toml](templates/examples/linux-scp-with-current-and-peer-command-flow.toml)

Example: run Linux SCP flow with only one peer var

```bash
rauto flow \
    --template linux_scp_with_current_and_peer \
    --connection edge92 \
    --vars-json '{"peer":"edge94","local_path":"/tmp/app.tar","remote_path":"/tmp/app.tar"}'
```

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
- `--record-level <key-events-only|full>`
- `--record-file <path>`

### Device Profiles

`rauto` supports built-in device profiles (inherited from `rneter`) and custom TOML profiles.

Current built-in profiles from `rneter` include:

- Network vendors: `cisco`, `huawei`, `h3c`, `hillstone`, `juniper`, `array`, `arista`, `fortinet`, `paloalto`, `topsec`, `venustech`, `dptech`, `chaitin`, `qianxin`, `maipu`, `checkpoint`
- Servers: `linux`

**List Available Profiles:**

```bash
rauto profile list
```

**Autodetect a Profile:**
The default profile is `autodetect`, so normal execution resolves the actual built-in profile before running commands. You can also probe a device explicitly:

```bash
rauto profile autodetect \
    --host 192.168.1.1 \
    --username admin \
    --password secret \
    --ssh-port 22
```

Use `-v` to print ranked candidate summaries, or `-vv` to include the full debug report:

```bash
rauto profile autodetect -v --host 192.168.1.1 --username admin --password secret
rauto profile autodetect -vv --host 192.168.1.1 --username admin --password secret
```

**Using a Specific Profile:**
Use `--device-profile` when you want to bypass autodetect. For example, to select the Huawei profile:

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
rauto profile list
rauto profile autodetect --host 192.168.1.1 --username admin --password secret
rauto profile autodetect -v --host 192.168.1.1 --username admin --password secret
rauto profile show cisco
rauto profile show linux
rauto profile copy-builtin cisco my_cisco
rauto profile delete-custom my_cisco
rauto connection test \
    --host 192.168.1.1 \
    --username admin \
    --password secret \
    --ssh-port 22
```

Notes:

- `rauto profile list` includes the `autodetect` pseudo-profile, current built-in profiles exposed by `rneter`, and custom profiles stored in SQLite.
- `rauto profile show <builtin>` and `rauto profile copy-builtin <builtin> <custom>` both use the current built-in handler configs exported by `rneter`.

### Web Console

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
- Organize saved connections in `Inventory` with groups and labels (web-only management UI).
- Track and inspect async task runs in `Task Center` (status, events, artifacts, recordings).
- Use `SFTP Upload` as a dedicated page for direct file uploads to SSH hosts with an `sftp` subsystem.
- Manage command blacklist patterns in UI: add/delete/check `*` wildcard rules before execution.
- Manage data backups in UI: create/list/download/restore `~/.rauto` backup archives.
- Diagnose profile state machines in `Prompt Profiles` -> Diagnostics with visualized result fields.
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

Agent mode provides:

- manager registration, heartbeat, inventory sync, and offline reporting over either `grpc` or `http`
- same-port HTTP and gRPC task APIs for manager-side callers
- async task events and final task callbacks through the selected reporting transport
- protected status and probe endpoints for manager-side health checks
- token-protected browser/API access when the agent is started with a token

### Template Storage Commands

```bash
rauto templates list
rauto templates show show_version.j2
rauto templates delete show_version.j2
```

### Saved Connection Profiles

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
- Saved passwords are encrypted in `~/.rauto/rauto.db` with a local master key. The master key is stored once in the system keyring (single authorization, then cached in process).
- `--ssh-security <secure|balanced|legacy-compatible>` controls SSH algorithm compatibility and is also stored in saved connections.
- `--linux-shell-flavor <posix|fish>` controls Linux shell exit-code parsing strategy (`posix` also accepts `bash` alias).

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
name,host,username,password,port,enable_password,ssh_security,linux_shell_flavor,device_profile,template_dir
core-sw-01,192.168.1.1,admin,secret,22,,balanced,,cisco,
linux-jump-01,192.168.1.10,root,secret,22,,secure,posix,linux,
```

Notes:

- If `name` is omitted, `rauto` derives a saved-connection name from `host`.
- Import uses upsert semantics by connection name.
- If a row omits password fields, existing saved encrypted passwords are preserved for that connection.
- In the Web UI, use `Saved Connections -> Download Template` to get a starter CSV file.
- Sample files are also included in the repository:
- [templates/examples/connection-import-template-en.csv](templates/examples/connection-import-template-en.csv)
- [templates/examples/connection-import-template-zh.csv](templates/examples/connection-import-template-zh.csv)

### Backup & Restore

Backup the current `rauto` runtime data store and backup configuration:

Note: backup archives include `rauto.db`, templates, and other runtime files, but do not export the local keyring master key. After restoring on another machine or clean OS account, re-save saved-connection passwords (or import the same master key) before using encrypted passwords.

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

### Command Blacklist

Use a global blacklist to reject commands before they are sent from CLI or Web execution paths (`exec`, template execute, `flow`, `tx`, `tx-workflow`, `orchestrate`).

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

### Transaction Block

`rauto tx` executes a single rollback-aware transaction block on one target.
Use it when you need a compact unit of work with explicit rollback behavior, but do not need the extra structure of a full `tx-workflow` JSON file.

Common usage patterns:

```bash
# Command list mode with per-step rollback commands
rauto tx \
    --name vlan-change \
    --command "vlan 120" \
    --command "name campus-users" \
    --rollback-command "no vlan 120" \
    --rollback-command "default name" \
    --rollback-on-failure \
    --mode Config \
    --host 192.168.1.1 \
    --username admin \
    --password secret

# Command-flow mode with reusable flow templates
rauto tx \
    --run-kind command-flow \
    --flow-template cisco_like_copy \
    --flow-vars ./flow-vars.json \
    --rollback-flow-file ./rollback-flow.toml \
    --host 192.168.1.1 \
    --username admin \
    --password secret
```

Notes:

- `--run-kind commands` uses repeated `--command` entries and optional per-step rollback commands.
- `--run-kind command-flow` uses saved/ad-hoc command flow templates for both forward and rollback paths.
- `--dry-run` prints the normalized tx block without executing it.
- `--json` prints tx execution results as JSON.
- `--record-file` and `--record-level` work the same way as other execution commands.

### Transaction Workflow

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

- [templates/examples/core-vlan-workflow.json](templates/examples/core-vlan-workflow.json)

Advanced sample files:

- [templates/examples/fabric-change-workflow.json](templates/examples/fabric-change-workflow.json)

### Multi-device Orchestration

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
  "rollback_on_stage_failure": true,
  "rollback_completed_stages_on_failure": false,
  "stages": [
    {
      "name": "core",
      "strategy": "serial",
      "jobs": [
        {
          "name": "core-workflow",
          "strategy": "serial",
          "targets": ["core-01", "core-02"],
          "action": {
            "kind": "tx_workflow",
            "workflow_file": "./workflows/core-vlan.json"
          }
        }
      ]
    },
    {
      "name": "access",
      "strategy": "parallel",
      "max_parallel": 2,
      "jobs": [
        {
          "name": "access-rollout",
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
  ]
}
```

Set `rollback_on_stage_failure=true` when a failed target in one stage should trigger
compensation rollback for other successful targets in that same stage. Set
`rollback_completed_stages_on_failure=true` when a later-stage failure should also
compensate successful targets from earlier completed stages in reverse stage order.

**Inventory + group example**

```json
{
  "name": "campus-vlan-rollout",
  "inventory_file": "./inventory.json",
  "stages": [
    {
      "name": "core",
      "strategy": "serial",
      "jobs": [
        {
          "name": "core-workflow",
          "strategy": "serial",
          "target_groups": ["core"],
          "action": {
            "kind": "tx_workflow",
            "workflow_file": "./workflows/core-vlan.json"
          }
        }
      ]
    },
    {
      "name": "access",
      "strategy": "serial",
      "jobs": [
        {
          "name": "access-rollout",
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

- [templates/examples/campus-vlan-orchestration.json](templates/examples/campus-vlan-orchestration.json)
- [templates/examples/campus-inventory.json](templates/examples/campus-inventory.json)

Advanced sample files:

- [templates/examples/fabric-advanced-orchestration.json](templates/examples/fabric-advanced-orchestration.json)
- [templates/examples/fabric-advanced-inventory.json](templates/examples/fabric-advanced-inventory.json)
- [templates/examples/linux-image-rollout-orchestration.json](templates/examples/linux-image-rollout-orchestration.json)
- [templates/examples/linux-image-export-and-transfer-workflow.json](templates/examples/linux-image-export-and-transfer-workflow.json)
- [templates/examples/linux-image-export-and-transfer-with-password-scp-workflow.json](templates/examples/linux-image-export-and-transfer-with-password-scp-workflow.json)
- [templates/examples/linux-image-load-and-restart-workflow.json](templates/examples/linux-image-load-and-restart-workflow.json)

Notes:

- `stage.jobs` defines executable units in a stage; each job has its own `targets`/`target_groups` and `action`.
- `stage.strategy` / `stage.max_parallel` controls job-level concurrency; `job.strategy` / `job.max_parallel` controls target-level concurrency.
- `targets` can reference saved connections by name or provide inline connection fields.
- `target_groups` can load target lists from `inventory_file` or inline `inventory.groups`.
- `inventory.defaults` applies to all groups and job-level inline `targets`; group `defaults` override inventory defaults.
- `tx_block` jobs support two source modes:
  - command mode (`template` / `commands` + `vars`)
  - tx block template mode (`tx_block_template_name` / `tx_block_template_content` + `tx_block_template_vars`)
- `tx_workflow` jobs support four source modes (exactly one):
  - `workflow_file`
  - inline `workflow`
  - `workflow_template_name`
  - `workflow_template_content` (with `workflow_vars`)
- Multi-device orchestration is available in both Web UI and CLI.

### Reusable Execution Templates

`rauto` now supports saving execution JSON as reusable SQLite-backed templates,
and rendering template variables before execution:

- `tx block templates`: `/api/tx-block-templates`
- `tx workflow templates`: `/api/tx-workflow-templates`
- `orchestration templates`: `/api/orchestration-templates`

Execution APIs support template-based inputs (inline JSON / saved template name / template content):

- `POST /api/tx/block`:
  - `tx_block_template_name`
  - `tx_block_template_content`
  - `tx_block_template_vars`
- `POST /api/tx/workflow`:
  - `workflow_template_name`
  - `workflow_template_content`
  - `workflow_vars`
- `POST /api/orchestrate`:
  - `plan_template_name`
  - `plan_template_content`
  - `plan_vars`

Template rendering context:

- `vars`: request-level `*_vars`
- `connection`: resolved single-target connection data (host/username/password/port/device_profile, etc.); for saved connections, `connection.saved` is also included
- `defaults`: global default connection settings (for orchestration rendering)
- `now`: current time (`rfc3339` / `timestamp_ms`)
- Top-level shorthand is available: `{{ peer_host }}` resolves from request vars first, then falls back to current target connection params.
- Direct connection object refs are supported in template strings: `{{ edge94.host }}`, `{{ edge94.password }}`, `{{ edge94.vars.site }}`.

Any string field can use minijinja syntax, for example:

```json
{
  "command": "scp /tmp/{{ image_file }} {{ edge94.username }}@{{ edge94.host }}:/tmp/{{ image_file }}"
}
```

Web UI (`Operations -> Orchestrated Delivery`) now includes dedicated runtime vars inputs for:

- `Tx Workflow`: `workflow_vars`
- `Orchestration`: `plan_vars`

### Inventory CLI

There is no separate inventory target-record layer anymore.

Saved connections are the inventory target source of truth (including `enabled`, `labels`,
`groups`, and `vars`). Inventory CLI focuses on group management and merged vars preview.

Manage groups:

```bash
rauto inventory group list
rauto inventory group show access --json
rauto inventory group upsert access --file ./group-access.json
rauto inventory group delete access
```

Preview merged vars (`group vars -> saved connection vars -> runtime vars`):

```bash
rauto inventory resolve-vars \
  --host edge-sw-01 \
  --group access \
  --vars-json '{"ticket":"CHG-42"}' \
  --json
```

Group JSON shape:

```json
{
  "name": "access",
  "description": "Campus access switches",
  "hosts": ["edge-sw-01", "edge-sw-02"],
  "vars": {
    "role": "access"
  }
}
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

| Argument               | Env Var          | Description                                                                          |
| ---------------------- | ---------------- | ------------------------------------------------------------------------------------ |
| `--host`               | -                | Device hostname or IP                                                                |
| `--username`           | -                | SSH username                                                                         |
| `--password`           | `RAUTO_PASSWORD` | SSH password                                                                         |
| `--enable-password`    | -                | Enable/Secret password                                                               |
| `--ssh-port`           | -                | SSH port (default: 22)                                                               |
| `--ssh-security`       | -                | SSH security profile: `secure`, `balanced`, `legacy-compatible`                      |
| `--linux-shell-flavor` | -                | Linux shell flavor for exit-code capture: `posix` (`bash` alias) or `fish`           |
| `--device-profile`     | -                | Device type/profile (default: `autodetect`; examples: `huawei`, `linux`, `fortinet`) |
| `--connection`         | -                | Load saved connection profile by name                                                |
| `--save-connection`    | -                | Save effective connection profile after successful connect                           |
| `--save-password`      | -                | With `--save-connection`, also save password/enable_password                         |

Common command-specific options:

- `exec --mode <mode>`: Execute a raw command in a specific mode such as `Enable`, `Config`, or `Shell`.
- `template --vars <file>`: Load JSON/YAML vars for a stored command template.
- `flow --vars <file>` / `flow --vars-json <json>`: Provide file-based or inline JSON vars to a command flow template.
- `template --dry-run`: Render the command template without executing it on the target.
- `tx --dry-run`: Print the planned tx block without executing it.

Recording-related options (command-specific):

- `exec/template --record-file <path>`: Save recording JSONL after execution.
- `exec/template --record-level <key-events-only|full>`: Recording granularity.
- `replay <record_file> --list`: List recorded command output events.
- `replay <record_file> --command <cmd> [--mode <mode>]`: Replay one command output.
- Replayed `SessionEvent::CommandOutput` entries may include `exit_code` for Linux shell flows.

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

Apache License 2.0
