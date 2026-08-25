<div align="center">

<img src="frontend/public/rauto-icon.svg" alt="rauto icon" width="112" />

# rauto

**The hands for controlling network devices in the AI era.**

[![Crates.io](https://img.shields.io/crates/v/rauto.svg)](https://crates.io/crates/rauto)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)
[![Website](https://img.shields.io/badge/Website-rauto.top-0ea5e9?style=for-the-badge&logo=googlechrome&logoColor=white)](https://rauto.top)

[Website](https://rauto.top) · [中文文档](README_zh.md)

</div>

`rauto` is an out-of-the-box Rust-based network automation toolkit for operating network devices through CLI, Web, and agent APIs. It builds on [rneter](https://github.com/demohiiiii/rneter) for SSH session handling and [minijinja](https://github.com/mitsuhiko/minijinja) for command templating, providing a simple, high-performance interface for network engineers, automation developers, and AI-driven workflows that need reliable device access, transaction execution, and multi-device orchestration.

## Quick Start

```bash
cargo install rauto

# Create a reusable credential; securely prompts for login and optional Enable values
rauto credential add network-admin

# Query a common object on Linux; show maps the command and mode, then parses the output
rauto show version --host 192.168.1.10 --credential network-admin

# Query the same object on a network device with an explicit profile
rauto show version --host 192.168.1.1 --credential network-admin --device-profile cisco_ios

# With autodetect, this uses the Linux profile's default User mode
rauto exec "uname -a" --host 192.168.1.10 --credential network-admin

# If SSH logs directly into a root shell, specify Root explicitly
# Otherwise, switching to the default User mode may send "exit" and disconnect
rauto exec "uname -a" --host 192.168.1.10 --credential network-admin --mode Root

# Network devices use modes such as Login and Enable; exec does not infer one from the command
# Use Enable for privileged commands, and configure the credential's Enable secret when required
rauto exec "show version" --host 192.168.1.1 --credential network-admin --device-profile cisco_ios --mode Enable

# Start the Web UI when you want the browser workbench.
rauto web --bind 127.0.0.1 --port 3000
```

## Table of Contents

- [Features](#features)
- [Installation](#installation)
  - [From Binary (Recommended)](#from-binary-recommended)
  - [From Crates.io](#from-cratesio)
  - [From Source](#from-source)
- [Skill](#skill)
- [Usage](#usage)
  - [Command Selection Guide](#command-selection-guide)
  - [Template Mode](#template-mode)
  - [Direct Execution](#direct-execution)
  - [Command Flow Templates](#command-flow-templates)
  - [SFTP Upload](#sftp-upload)
  - [Configuration Fetch](#configuration-fetch)
  - [Device Profiles](#device-profiles)
  - [Web Console](#web-console)
    - [Agent Mode](#agent-mode)
  - [Template Storage Commands](#template-storage-commands)
  - [Device Credentials](#device-credentials)
  - [Saved Connection Profiles](#saved-connection-profiles)
  - [Device Discovery](#device-discovery)
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

- **Out-of-the-box Show Queries**: Built-in show objects, TextFSM parsing, and Excel export for single-device and multi-device queries across saved connections, inventory groups, and labels.
- **Double Template System**: Command Templates (Jinja2) & Device Profiles (TOML).
- **Intelligent Connection Handling**: Uses `rneter` for SSH state management.
- **Dry Run Support**: Preview commands before execution.
- **Variable Injection**: Load variables from JSON.
- **Extensible**: Custom TOML device profiles.
- **Built-in Web Console**: Start browser UI with `rauto web`.
- **Embedded Web Assets**: Frontend files are embedded into the binary for release usage.
- **Reusable Device Credentials**: Create, list, update, and delete shared authentication records, then reference them from saved or temporary connections without duplicating secrets.
- **Saved Connection Profiles**: Reuse named connection settings across commands.
- **SSH Device Discovery**: Scan IPs, CIDRs, or address ranges, verify SSH services, identify device profiles with reusable credentials, and distinguish new devices from existing connections.
- **Bulk Connection Import**: Import saved connections from CSV / Excel with upsert behavior.
- **SSH Security Profiles**: Choose `secure`, `balanced`, or `legacy-compatible` per target; the default is `legacy-compatible`.
- **Device Management Groups & Labels**: Organize saved connections with reusable grouping metadata.
- **Session Recording & Replay**: Record SSH sessions to JSONL and replay offline.
- **Reusable Command Flow Templates**: Execute wizard-style interactive CLI workflows from saved TOML templates, including device-side file transfer, guided installers, or confirmation-heavy operational sequences.
- **Reusable Execution Templates**: Save tx block / workflow / orchestration JSON as reusable templates with variable rendering.
- **SFTP Upload**: Upload local files directly to SSH hosts that expose an `sftp` subsystem.
- **Data Backup & Restore**: Backup full `~/.rauto` runtime data and restore when needed.
- **Async Task Tracking**: Inspect queued/running/completed async jobs, events, artifacts, and recordings in Web UI.
- **Agent Mode**: Run `rauto agent` for manager registration, heartbeat, protected APIs, and task callbacks.
- **Multi-device Orchestration (Web + CLI)**: Run staged serial/parallel plans across multiple devices, reusing saved connections and current `tx` / `tx-workflow` capabilities.
- **Command Blacklist**: Block dangerous commands globally before they are sent, with `*` wildcard support.
- **Parallel Multi-target Execution**: Fan out `show`, `exec`, and `flow` across saved connections, inventory groups, and labels with bounded concurrency (`--max-parallel`, default 4) and precheck-before-execute safety.
- **Configuration Fetch**: Pull `running`/`startup` configs with per-profile commands, raw + normalized SHA-256 hashes for drift detection, timestamped file archiving, and batch APIs for manager integration.

## Installation

### From Binary (Recommended)

Download the latest release for your platform from [GitHub Releases](https://github.com/demohiiiii/rauto/releases).

### From Crates.io

```bash
cargo install rauto
```

### From Source

Ensure you have Rust, Cargo, Node.js, and npm installed.

```bash
git clone https://github.com/demohiiiii/rauto.git
cd rauto
npm ci
npm run web:build
cargo build --release
```

The binary will be available at `target/release/rauto`.

## Skill

This repo includes a Codex skill under `skills/rauto-usage/` for agent-driven workflows.

Install it with the Skills CLI, which detects supported agents and manages the target skills directory:

```bash
npx skills add demohiiiii/rauto --skill rauto-usage
```

Add `--global` for a user-level installation or `--agent <agent>` to select a specific supported agent.

## Usage

### Command Selection Guide

| If you need to...                            | Use                 | Notes                                                                              |
| -------------------------------------------- | ------------------- | ---------------------------------------------------------------------------------- |
| Run one command immediately                  | `rauto exec`        | Best for direct ad-hoc commands; optional `--mode` narrows the target prompt/mode. |
| Run a configured show object by profile      | `rauto show`        | Maps objects like `interfaces` or `route` to the right device command.             |
| Render a reusable command template with vars | `rauto template`    | Best when command text should come from stored Jinja templates.                    |
| Drive interactive prompt/response flows      | `rauto flow`        | Best for wizard-like CLI exchanges, copy dialogs, and confirmation-heavy steps.    |
| Upload a local file over remote SFTP         | `rauto upload`      | Requires the SSH server to expose an `sftp` subsystem.                             |
| Discover SSH devices on a network            | `rauto device discover` | Verifies SSH identification, probes device profiles, and persists the latest result. |
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
    --credential network-admin \
    --ssh-port 22
```

**With Variables:**
Given a stored template `configure_vlan.j2` and variables file `templates/example_vars.json`:

```bash
rauto template configure_vlan.j2 \
    --vars templates/example_vars.json \
    --host 192.168.1.1 \
    --credential network-admin \
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
    --credential network-admin \
    --ssh-port 22
```

If you do not pass `--device-profile`, `rauto exec` uses the default `autodetect` profile resolution and tries to detect the real built-in profile before execution.
This autodetect step selects the device profile only. It does not inspect the command text to decide whether a command is a `show` command, a `config` command, or any other mode-specific command.

Mode selection for `exec` works like this:

- If you pass `--mode`, that mode is used after validation against the selected profile.
- `--mode` can name one mode or a comma/pipe-separated candidate list such as `Enable,Config` or `Root|User`. rauto validates every candidate, then rneter executes in the current candidate mode when possible or transitions to a reachable candidate.
- If you omit `--mode`, `rauto` uses the selected profile's `default_mode`.

Run the same command across multiple saved connections by naming targets, inventory groups, or labels. Every target is prechecked first (connection resolution, per-profile mode validation, command blacklist); execution starts only when all targets pass, then runs concurrently with one atomic output block per device:

```bash
rauto exec "show clock" \
    --target core-sw1 \
    --target core-sw2 \
    --group access \
    --max-parallel 8
```

TextFSM options work in multi-target mode too; `--textfsm-excel` merges parsed rows from all targets and adds `device` / `profile` / `command` metadata columns. The web UI exposes the same capability on the dedicated **Batch Delivery** page.

### Show Mode

Run configured operational show objects without writing the device-specific command.
`rauto show` resolves the target profile, maps the object to the matching platform command, executes it, and parses the output with TextFSM by default.
The web UI exposes the same capability under **Standard Delivery -> Show**.

```bash
rauto show interfaces \
    --host 192.168.1.1 \
    --credential network-admin \
    --ssh-port 22
```

Useful objects include `version`, `interfaces`, `interface-brief`, `route`, `arp`, `lldp`, `mac`, `vlan`, `access-list`, `object-group`, `policy`, and `nat-policy`; use `--list` to view every object available for the selected platform.
`security-policy` is an alias for `policy`, while `nat` is an alias for `nat-policy`. On Cisco ASA, `policy` uses the same `show access-list` command as `access-list`.
FortiGate also provides `nat-vip` for DNAT/VIP objects, `nat-ippool` for SNAT address pools, and `nat-central-snat` for Central SNAT rules.
Objects are defined in the bundled `assets/show_catalog/commands-mapping.toml` command table. The table can bind platform- or profile-level commands and execution modes, with optional per-object mode overrides; explicit `--mode` still takes precedence, then the mapping mode, then the profile default mode.
The show feature is mainly powered by command indexes and TextFSM parsers from [ntc-templates](https://github.com/networktocode/ntc-templates): `rauto` consolidates semantically equivalent queries across platforms into stable objects such as `interfaces`, `route`, `arp`, and `vlan`. TextFSM parsing uses the bundled [ntc-templates](https://github.com/networktocode/ntc-templates) templates after execution unless a custom show object binds a custom TextFSM template.

```bash
rauto show --list --device-profile cisco_ios
rauto show route --print-command
rauto show interfaces --no-parse
```

Run the same show object across multiple saved connections by naming targets directly, selecting inventory groups, or selecting labels/tags. Before connecting for command execution, `rauto` resolves every target profile and verifies that the requested object has a matching show command for every device; if any target is missing the mapping, the whole run fails before executing commands.

```bash
rauto show interfaces \
    --target core-sw1 \
    --target core-sw2 \
    --group access \
    --label campus \
    --print-command

rauto show route --group core --tag prod --textfsm-excel ./routes.xlsx
```

Multi-target runs execute concurrently (4 devices at a time by default); tune with `--max-parallel`. Per-device output is buffered and printed as one atomic block when each target completes.

You can save profile-specific custom show objects in SQLite. A custom show object overrides the bundled command table for the same `(device_profile, object)`, can bind an execution mode, and can optionally bind a custom TextFSM template that is used before command mappings and bundled NTC templates.

```bash
rauto show-object set \
    --profile my_custom_profile \
    --object access-list \
    --command "show access-lists" \
    --mode enable \
    --textfsm-template my_access_list

rauto show-object list --profile my_custom_profile
rauto show-object delete --profile my_custom_profile --object access-list
```

### TextFSM Parse

`show`, `exec`, `template`, and `flow` can parse command output with TextFSM after execution.

- `show` enables TextFSM parsing by default. Pass `--no-parse` to print raw output only.
- Parsing is off by default. Pass `--parse-textfsm` to enable TextFSM parsing.
- Manual parsing: pass `--textfsm-template <path>` to use a specific TextFSM template file. This has the highest priority.
- Multi-command parsing: `template` and `flow` can repeat `--textfsm-template <path>` to match template files by command order. If fewer template files are provided than commands, the last template file is reused for the remaining commands.
- Platform selection: when parsing is enabled and `--textfsm-platform` is omitted, `rauto` infers the [ntc-templates](https://github.com/networktocode/ntc-templates) platform from the resolved device profile, for example `cisco_ios`, `huawei -> huawei_vrp`, or `cisco_xe -> cisco_ios`.
- Platform override: pass `--textfsm-platform <platform>` only when you want to override the inferred platform after enabling parsing.
- Lenient NTC parsing: by default, `rauto` filters TextFSM fallback rules such as `^. -> Error` before parsing, which avoids failing the whole parse when a template does not match a non-essential line. Pass `--textfsm-strict-errors` to keep those Error rules.
- Excel export: pass `--textfsm-excel <file.xlsx>` to export successful parsed rows to an Excel workbook. This also enables TextFSM parsing for `exec`, `template`, and `flow`.
- If parsing is disabled and no manual template is provided, only raw output is shown.
- Parsing never blocks execution. If parsing fails, raw output is still returned and the parse error is reported separately.

Custom TextFSM templates and mappings can be saved in SQLite. When parsing is enabled and no explicit `--textfsm-template` is provided, rauto first checks the custom mapping `(device_profile, command) -> template`; if no custom mapping matches, it falls back to the bundled [ntc-templates](https://github.com/networktocode/ntc-templates) templates.

In the web UI, open **Template Manager -> TextFSM Templates** to manage the same custom TextFSM templates, profile command mappings, and custom show objects.

**Specifying Execution Mode:**
Execute a command in a specific mode (e.g., `Enable`, `Config`) or a candidate list (e.g., `Root,User`).

```bash
rauto exec "show bgp neighbor" \
    --host 192.168.1.1 \
    --credential network-admin \
    --ssh-port 22 \
    --mode Enable
```

**Enable TextFSM parsing:**

```bash
rauto exec "show version" \
    --connection core-01 \
    --parse-textfsm
```

**Export parsed rows to Excel:**

```bash
rauto exec "show version" \
    --connection core-01 \
    --parse-textfsm \
    --textfsm-excel ./show-version.xlsx
```

**Override the inferred NTC platform when needed:**

```bash
rauto exec "show version" \
    --connection core-01 \
    --parse-textfsm \
    --textfsm-platform cisco_ios
```

**Parse output with a specific TextFSM template file:**

```bash
rauto template show_version.j2 \
    --connection core-01 \
    --textfsm-template ./templates/cisco_ios_show_version.textfsm
```

**Parse multi-command template output with templates by command order:**

```bash
rauto template check_basic.j2 \
    --connection core-01 \
    --textfsm-template ./templates/cisco_ios_show_version.textfsm \
    --textfsm-template ./templates/cisco_ios_show_interfaces.textfsm
```

**Save a custom TextFSM template and bind it to a profile command:**

```bash
rauto textfsm template create my_show_version \
    --file ./templates/my_show_version.textfsm

rauto textfsm mapping set \
    --profile my_custom_profile \
    --command "show version" \
    --template my_show_version
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
    --vars-json '{"command":"copy scp: flash:/new.bin","server_addr":"192.168.1.50","remote_path":"/images/new.bin","transfer_username":"backup","transfer_password":"secret","overwrite_answer":"y"}' \
    --connection core-01
```

Command flows support the same multi-target fan-out as `show` and `exec`. The flow template is rendered per target with that device's own connection context (so `{{host}}` and cross-connection references resolve per device), prechecked against the command blacklist per rendered step, then executed concurrently:

```bash
rauto flow \
    --template push-snmp \
    --vars-json '{"community":"ro"}' \
    --label campus \
    --max-parallel 4
```

The web UI runs batch flows on the **Batch Delivery** page (flow tab), and integrations can call `POST /api/flow/batch-execute` (or the agent gRPC `ExecuteFlowBatch` method) with the same per-target rendering and precheck semantics.

Notes:

- `rauto flow` is the preferred way to run interactive command flows from the CLI.
- Saved flow templates live in SQLite and are reused by both CLI and Web.
- Built-in flow templates are exposed via `/api/flow-templates/builtins`; execution accepts `--template builtin:<name>` (CLI) or `builtin:<name>` values in Web selectors.
- Flow templates follow rneter's current inline `{{var}}` `CommandFlowTemplate` model and execute steps linearly with prompt-driven interactions.
- Runtime variables are merged into the template render context under both their top-level names and a nested `vars` object.
- Runtime var references support both `connection_name.param_name` (cross-connection lookup) and plain `param_name` (request vars first, then current target connection fallback).
- Command flow template inputs are inferred from `{{var}}` references and must be supplied at runtime. Dotted references such as `{{peer.host}}` produce one root input named `peer`.
- The selected execution target is available through flat fields such as `{{host}}`, `{{username}}`, and `{{password}}`; no current-connection alias declaration is required.
- For alias-to-connection usage, set one runtime var to a saved connection name (for example `peer=edge94`) and reference `{{peer.host}}`/`{{peer.username}}`/`{{peer.password}}` directly in the template.
- If a step omits `mode`, `rauto` uses the first mode defined by the selected device profile.
- Every execution records a session by default.
- `--record-level key-events-only` keeps the audit-friendly minimum: input commands and device output.
- `--record-level full` also captures richer prompt and state-transition details.
- `--record-file` still exports the same JSONL recording to a file when you want a copy.

#### Multiline command submission

Structured commands always serialize `multiline_mode` explicitly. Use `split_lines` to execute each non-empty trimmed line as an independent command, or `whole` to preserve the original text and submit it once. Missing legacy fields remain compatible and normalize to `split_lines`.

`split_lines` is fail-fast: after the first failed concrete command, later lines are not executed.

Command-flow TOML:

```toml
[[steps]]
mode = "Config"
command = "interface Gi0/1\nno shutdown"
multiline_mode = "split_lines"

[[steps]]
mode = "Shell"
command = "cat <<'EOF'\nline one\nline two\nEOF"
multiline_mode = "whole"
```

Transaction JSON commands, including rollback commands, use the same field:

```json
{
  "kind": "command",
  "mode": "Config",
  "command": "interface Gi0/1\nno shutdown",
  "multiline_mode": "split_lines"
}
```

`POST /api/exec` accepts the same `multiline_mode`. Its existing top-level `output` and `exit_code` remain available, while `outputs` contains one result per concrete command produced by multiline expansion.

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
    --credential linux-admin
```

Optional flags:

- `--buffer-size <bytes>`
- `--timeout-secs <seconds>`
- `--show-progress`
- `--record-level <key-events-only|full>`
- `--record-file <path>`

### Configuration Fetch

`rauto config fetch` pulls device configuration text using per-profile commands from the bundled `assets/config_catalog/config-commands.toml` catalog (for example `show running-config` on `cisco_ios`, `display current-configuration` on `huawei_vrp`). Supported kinds per platform typically include `running` and, where meaningful, `startup`.

Every fetch returns two SHA-256 hashes:

- `sha256`: hash of the raw configuration text.
- `normalized_sha256`: hash computed after removing volatile lines (change timestamps, `ntp clock-period`, and similar per-profile noise). Comparing this hash across fetches detects real configuration drift without false positives from cosmetic changes.

```bash
# Print one device's running config with hashes
rauto config fetch -c core-01

# Save one device's running config to an exact file path
rauto config fetch -c core-01 --output ./core-01-running.cfg

# Archive startup configs for a whole group into timestamped files
rauto config fetch --kind startup --group core --output-dir ./backups --max-parallel 8

# Print the normalized text used for drift comparison
rauto config fetch -c core-01 --normalized
```

`--output <FILE>` writes a single fetch to an exact path and creates missing parent directories. `--output-dir <DIR>` writes each device to `<name>_<kind>_<timestamp>.cfg`, which pairs naturally with cron + git for lightweight configuration archiving. The two options are mutually exclusive, and `--output` cannot be combined with multi-target selectors. Multi-target selectors (`--target`, `--group`, `--label`) and `--max-parallel` behave the same as in `show` and `exec`.

Manage per-profile fetch commands. Custom overrides are stored in SQLite, win over the builtin catalog, and are validated against the command blacklist:

```bash
rauto config command list --profile cisco_ios
rauto config command set my_profile running "show configuration all" --mode Enable
rauto config command unset my_profile running
```

The volatile-line rules used for normalized hashing are also customizable. User-defined patterns are validated as regexes on insert and merge additively with the builtin rules, so you can silence device-specific noise (a firmware-specific timestamp comment, for example) without waiting for a release:

```bash
rauto config volatile list --profile cisco_ios
rauto config volatile add cisco_ios '^! Last modified by .*'
rauto config volatile remove cisco_ios '^! Last modified by .*'
```

Both fetch commands and volatile rules can also be managed in the web console under **Templates -> Config Fetch Commands**, and through the `/api/config/commands` and `/api/config/volatile-patterns` endpoints (plus matching agent gRPC methods) for manager integration.

The same capability is exposed to integrations as `POST /api/config/batch-fetch` (and the agent gRPC `FetchConfigBatch` method), returning per-target content, both hashes, and a `fetched_at` timestamp; pass `include_normalized: true` to also receive the normalized text.

### Device Profiles

`rauto` supports built-in device profiles (inherited from `rneter`) and custom TOML profiles.

- Current built-in profiles from `rneter` include:

- Network vendors: `cisco_ios`, `cisco_xe`, `huawei`, `h3c_comware`, `hp_comware`, `hillstone_stoneos`, `juniper_junos`, `array`, `arista_eos`, `aruba_aoscx`, `cisco_asa`, `cisco_nxos`, `dell_os10`, `fortinet`, `paloalto_panos`, `topsec`, `venustech`, `dptech`, `chaitin`, `qianxin`, `maipu`, `ruijie_os`, `zte_zxros`, `checkpoint_gaia`
- Servers: `linux`

**Mode Naming Recommendation:**
When you create or customize a device profile, prefer reusing established mode names such as `Login`, `Enable`, and `Config` whenever the device semantics match those states.

Benefits of following these names:

- Keeps `exec --mode`, `tx --mode`, and flow step `mode` values consistent across vendors.
- Makes examples, templates, and operator habits easier to reuse without remembering profile-specific naming differences.
- Makes default-mode fallback and mode validation behavior easier to understand when switching between built-in and custom profiles.
- Reduces surprise when reading recordings, tx results, orchestration plans, or troubleshooting mode-related failures.

**List Available Profiles:**

```bash
rauto profile list
```

**Autodetect a Profile:**
The default profile is `autodetect`, so normal execution resolves the actual built-in profile before running commands. You can also probe a device explicitly:

```bash
rauto profile autodetect \
    --host 192.168.1.1 \
    --credential network-admin \
    --ssh-port 22
```

Use `-v` to print ranked candidate summaries, or `-vv` to include the full debug report:

```bash
rauto profile autodetect -v --host 192.168.1.1 --credential network-admin
rauto profile autodetect -vv --host 192.168.1.1 --credential network-admin
```

When normal execution uses autodetect, the detected profile controls mode validation and default-mode fallback. Autodetect does not infer command mode from the command text; use `exec --mode <mode>` when a command must run in a specific state such as `Enable`, `Config`, or `Shell`. You can also pass comma- or pipe-separated candidates, for example `--mode Root,User`, when a command is valid in more than one state.
Successful autodetect results are cached locally by `host:port` in the runtime database, so later connections to the same target can reuse the detected profile instead of probing again unless you explicitly override the profile.
For TextFSM parsing, `rauto` will infer a matching NTC platform from the resolved device profile when `--parse-textfsm` is enabled and `--textfsm-platform` is omitted.

**Using a Specific Profile:**
Use `--device-profile` when you want to bypass autodetect. For example, to select the Huawei profile:

```bash
rauto template show_ver.j2 \
    --host 192.168.1.1 \
    --credential network-admin \
    --ssh-port 22 \
    --device-profile huawei
```

**Using the Linux profile:**

```bash
rauto exec "systemctl status sshd" \
    --host 192.168.1.10 \
    --credential linux-admin \
    --ssh-port 22 \
    --device-profile linux
```

**Custom Device Profile:**
Custom device profiles are stored in SQLite and managed through `rauto device` or the Web UI.

Use it after creating or copying a custom profile:

```bash
rauto exec "show ver" \
    --host 192.168.1.1 \
    --credential network-admin \
    --ssh-port 22 \
    --device-profile custom_cisco
```

**Useful profile management commands:**

```bash
rauto profile list
rauto profile autodetect --host 192.168.1.1 --credential network-admin
rauto profile autodetect -v --host 192.168.1.1 --credential network-admin
rauto profile show cisco_ios
rauto profile show linux
rauto profile copy-builtin cisco_ios my_cisco
rauto profile delete-custom my_cisco
rauto connection test \
    --host 192.168.1.1 \
    --credential network-admin \
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
    --port 3000
```

Then visit `http://127.0.0.1:3000` and enter the Web password. On the first
`rauto web` startup, rauto generates a random password, prints it once in the
terminal, and stores it in `~/.rauto/config.toml`:

```toml
[web]
password = "generated-password"
```

The config file is created with owner-only permissions on Unix. Keep the
password private; edit `web.password` while the service is stopped to replace
it. Existing browser sessions are in memory and are cleared when rauto restarts.

Web assets are embedded into the binary at build time.  
For released binaries, users only need to run the executable (no extra `static/` files required at runtime).

The web frontend is built with Svelte 5.
When building from source, run `npm run web:build` before compiling the Rust binary; it validates frontend structure, i18n keys, Svelte diagnostics, and then builds the embedded assets.

```bash
npm run frontend:build  # build only the Svelte dashboard entry
npm run web:build       # validate and build embedded web dashboard assets
```

Web console key capabilities:

- Manage reusable device credentials in the standalone `Credential Management` page. Password values are never returned to the browser after saving.
- Manage saved connections in UI: add, load, update, delete, and inspect details.
- Run one command or one command flow across many saved connections, groups, or labels on the dedicated `Batch Delivery` page, with per-device result cards and a concurrency control.
- Select a credential for saved and temporary connections instead of entering authentication fields on each connection.
- Download a CSV import template and import saved connections from CSV / Excel in UI.
- Choose SSH security profile in UI connection defaults and saved connections: `secure`, `balanced`, or `legacy-compatible`.
- Run commands, command flows, tx blocks, tx workflows, and orchestration from `Operations`.
- The command workbench accepts manual content or imports a saved command template as an editable local snapshot.
- Manual and imported commands share `{{var}}` inputs, rendered preview, TextFSM parsing, and multiline submission controls; the execution page never overwrites the saved template.
- Manage profiles, command templates, and command flow templates in `Template Manager`.
- Organize saved connections in `Device Management` with groups and labels (web-only management UI).
- Track and inspect async task runs in `Task Center` (status, events, artifacts, recordings).
- Use `SFTP Upload` as a dedicated page for direct file uploads to SSH hosts with an `sftp` subsystem. The Web API only reads upload sources from `RAUTO_HOME/uploads` (default `~/.rauto/uploads`).
- Manage command blacklist patterns in UI: add/delete/check `*` wildcard rules before execution.
- Manage data backups in UI under `RAUTO_HOME/backups`; the Web API does not accept arbitrary host output or restore paths.
- Diagnose a profile state machine from the **Diagnose** button in the profile detail view; results open in a dialog with visualized fields.
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

### Device Credentials

Device credentials are reusable authentication records shared by saved and temporary connections. Manage them from the standalone **Credential Management** page in the Web UI or through `GET/POST /api/credentials`, `POST /api/credentials/import`, and `GET/PUT/DELETE /api/credentials/{id}`.

The examples below assume that credentials named `network-admin` and `linux-admin` have already been created.

Each credential contains:

- A unique name using only letters, numbers, `_`, `.`, and `-`.
- A required SSH username and one authentication method: password, encrypted inline private key, private-key file path, or SSH agent.
- An optional Enable stage with a password; when enabled without a password, rauto submits Enter at the prompt.

Passwords, inline private keys, and private-key passphrases are encrypted before being stored in `~/.rauto/rauto.db`; the encryption master key is kept in the operating system keyring. Private-key file credentials store the path and load the key when connecting, while SSH-agent credentials use the agent available to the rauto process. Web, Agent, and CLI query output expose only credential metadata and secret-presence flags, never plaintext authentication data or encryption references. Full session recordings redact configured authentication and Enable secrets before storing or broadcasting events. A credential referenced by one or more connections cannot be deleted until those references are removed.

Manage credentials from the CLI:

```bash
# Add: prompts for the login username and password
rauto credential add network-admin

# Other rneter authentication methods
rauto credential add linux-key --login-username root --auth-type private-key --private-key ~/.ssh/id_ed25519
rauto credential add linux-key-file --login-username root --auth-type private-key-file --private-key-file /run/secrets/id_ed25519
rauto credential add automation-agent --login-username automation --auth-type agent

# Query
rauto credential list
rauto credential show network-admin

# Update metadata or Enable handling
rauto credential update network-admin --name network-ops
rauto credential update network-ops --enable
# Interactive update: an enabled stage with a blank password submits Enter
rauto credential update network-ops

# Bulk import from CSV or Excel; add --json for a machine-readable report
rauto credential import ./credentials.csv

# Delete (referenced credentials are rejected)
rauto credential delete network-ops
```

`credential add` and `credential update` accept `--auth-type password|private-key|private-key-file|agent`, along with `--login-secret`, `--private-key`, `--private-key-file`, `--passphrase`, `--enable-secret`, and `--json`. `--private-key` reads and encrypts the file contents during the save; `--private-key-file` stores a path that rneter reads at connection time. Omit a password login secret to enter it through the secure prompt. Interactive `credential add` also asks whether to configure Enable mode and securely prompts for its optional password. Use `rauto credential --help` for the complete option list.

Credential import accepts `.csv`, `.xlsx`, `.xls`, `.xlsm`, and `.xlsb` files. It uses name-based upsert: blank authentication fields preserve existing values when the authentication type is unchanged, while a blank `enable_secret` clears the saved Enable secret. Columns include `auth_type`, `login_secret`, `private_key`, `private_key_path`, and `passphrase`. New credentials require `name`, `login_username`, and the fields required by their authentication type. When `enable_enabled` is true, rauto enters the Enable stage and submits the secret, or presses Enter when the secret is blank. Boolean columns accept `true/false`, `1/0`, `yes/no`, or `是/否`.

```csv
name,login_username,auth_type,login_secret,private_key,private_key_path,passphrase,enable_secret,enable_enabled
network-admin,admin,password,replace-with-login-secret,,,,replace-with-enable-secret,true
linux-key-file,root,private_key_file,,,/run/secrets/id_ed25519,,,false
```

Download the starter file from the Web UI import dialog, or use [templates/examples/credential-import-template-en.csv](templates/examples/credential-import-template-en.csv) and [templates/examples/credential-import-template-zh.csv](templates/examples/credential-import-template-zh.csv). The source file contains plaintext secrets; protect or remove it after import. Import reports contain only row numbers, names, counts, and validation errors, never secret values.

For direct CLI targets, pass the credential name or stable ID:

```bash
rauto connection test \
    --host 192.168.1.1 \
    --credential network-admin

rauto exec "show version" \
    --host 192.168.1.1 \
    --credential network-admin
```

### Saved Connection Profiles

You can save and reuse connection settings by name:

```bash
# Add/update a profile directly from CLI args
rauto connection add lab1 \
    --host 192.168.1.1 \
    --credential network-admin \
    --ssh-port 22 \
    --ssh-security balanced \
    --device-profile cisco_ios

# Reuse the saved profile
rauto exec "show version" --connection lab1

# Save current effective connection after a successful run
rauto connection test \
    --connection lab1 \
    --save-connection lab1_backup

# Manage saved profiles
rauto connection list
rauto connection list --json
rauto connection show lab1
rauto connection show lab1 --json
rauto connection delete lab1
rauto session list lab1 --limit 20
```

Credential behavior:

- Saved connections store only a `credential_id` reference; they do not duplicate usernames, login passwords, or Enable passwords.
- `--save-connection` (used in `exec`, `template`, and `connection test`) saves the effective credential reference together with the connection settings.
- Passing `--credential <name-or-id>` on a direct target selects that reusable credential. A saved connection automatically resolves its stored credential.
- A connection must reference a valid credential before test, autodetect, or execution.
- `--ssh-security <secure|balanced|legacy-compatible>` controls SSH algorithm compatibility and is also stored in saved connections. When omitted, rauto uses `legacy-compatible` for the broadest device compatibility.
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
name,host,credential,port,connect_timeout_secs,device_model,software_version,ssh_security,linux_shell_flavor,device_profile,template_dir
core-sw-01,192.168.1.1,network-admin,22,30,C9300,17.9.4,balanced,,cisco_ios,
linux-jump-01,192.168.1.10,linux-admin,22,30,,,secure,posix,linux,
```

Notes:

- If `name` is omitted, `rauto` derives a saved-connection name from `host`.
- Import uses upsert semantics by connection name.
- The `credential` column contains an existing unique credential name. Import does not create credentials, and an unknown name produces a row-level error.
- If an existing connection row omits `credential`, its current credential reference is preserved. A new connection must provide a credential.
- In the Web UI, use `Device Management -> Download Template` to get a starter CSV file.
- Sample files are also included in the repository:
- [templates/examples/connection-import-template-en.csv](templates/examples/connection-import-template-en.csv)
- [templates/examples/connection-import-template-zh.csv](templates/examples/connection-import-template-zh.csv)

### Device Discovery

Discover SSH devices without starting the Web service. The CLI uses the same scanner and latest persisted result as the Web console:

```bash
# Use the global credential as the default probe credential
rauto device discover 192.168.60.0/24 --credential network-admin

# Try multiple credentials and SSH ports, and display every result
rauto device discover 192.168.60.0/24 \
    --probe-credential network-admin \
    --probe-credential fallback-admin \
    --port 22,2222 \
    --status all

# Emit only devices that already have a saved connection as JSON
rauto device discover 192.168.60.0/24 \
    --credential network-admin \
    --status existing \
    --json

# Save every newly identified device immediately after the scan
rauto device discover 192.168.60.0/24 \
    --credential network-admin \
    --auto-save

# Query the latest discovery snapshot without starting another scan
rauto device discover list \
    --status identified \
    --profile fortinet,linux \
    --port 22,2222 \
    --search branch

# Save all matching identified devices, or select explicit endpoints
rauto device discover save --profile fortinet
rauto device discover save 192.168.60.98:22 \
    --connection-name branch-fw
```

Targets may be individual IP addresses, CIDRs, or last-octet ranges such as `192.168.2.10-30`. Multiple target arguments can be supplied in one run. A run accepts at most 4,096 unique addresses, 16 ports, and 3 probe credentials. Use `--concurrency`, `--tcp-timeout-ms`, and `--probe-timeout-secs` to tune larger or slower networks.

Use `--credential` for one probe credential. Supplying one or more `--probe-credential` values overrides `--credential`; repeated probe credentials are tried in the order provided.

The default `--status identified` output contains only newly identified devices and excludes endpoints already represented by saved connections. Other filters are `all`, `existing`, `imported`, `reachable`, `failed`, `not-ssh`, `probe-failed`, `unreachable`, and `cancelled`. A successful TCP connection alone is not classified as SSH reachable: rauto must receive a valid SSH identification line before trying credentials and device-profile detection.

On an interactive terminal, the CLI displays a live progress bar and opens a TUI after scanning. Newly identified devices are selected by default; existing connections, imported devices, and failed results cannot be selected. Use the following keys to review and save results:

| Key | Action |
| --- | ------ |
| `Up` / `Down` or `j` / `k` | Move through results |
| `Space` | Select or clear the current device |
| `a` | Select or clear all importable devices in the current filter |
| `f` / `Shift+f` or `Right` / `Left` | Cycle status filters |
| `/` | Search hosts, ports, profiles, models, versions, and errors |
| `e` | Edit the selected device's connection name |
| `s` | Save selected devices as connections |
| `q` or `Ctrl+C` | Exit the TUI |

Use `--no-tui` to keep the progress bar but print the filtered tabular result instead. `--json` disables both the progress bar and TUI so stdout remains machine-readable; it can be redirected or piped safely. JSON result `status` values use the same derived states as filtering and the TUI, so imported and existing connections are reported as `imported` and `existing`. A non-interactive stdin/stdout also falls back to plain output automatically.

Use `rauto device discover list` to read the latest persisted snapshot without scanning again. It supports `--status`, repeatable or comma-separated `--profile` and `--port` filters, `--search`, and `--json`. Use `rauto device discover save` to save every matching newly identified device; optional host or `host:port` arguments restrict the operation to explicit endpoints. Default connection names combine the detected platform and IP address, for example `cisco_ios-192-168-60-98`; nonstandard SSH ports are appended to avoid endpoint collisions. `--connection-name` is available when exactly one device matches, while `--overwrite` allows replacing an existing connection with that name. The previous `rauto device discovery list|save` spelling remains available for compatibility.

The latest run and its results are stored in SQLite and appear in the Web console. Starting another scan replaces the previous discovery run, its results, and its Task Center entry; saved device connections are not removed. A second scan cannot start while the current one is active. Saving from the TUI, `device discover save`, and `device discover --auto-save` all use the same duplicate-endpoint, credential, and connection-name validation as the Web console. Press `Ctrl+C` during scanning to request cancellation of the active run.

### Backup & Restore

Backup the current `rauto` runtime data store and backup configuration:

Note: backup archives include `rauto.db`, credential ciphertext, templates, and other runtime files, but do not export the local keyring master key. After restoring on another machine or clean OS account, edit and save the affected credentials again (or import the same master key) before using them.

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
    --credential network-admin

# Command-flow mode with reusable flow templates
rauto tx \
    --run-kind command-flow \
    --flow-template cisco_like_copy \
    --flow-vars ./flow-vars.json \
    --rollback-flow-file ./rollback-flow.toml \
    --host 192.168.1.1 \
    --credential network-admin
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
    --credential network-admin

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
            "workflow_template_name": "core-vlan"
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
          "targets": ["sw-01", "sw-02"],
          "action": {
            "kind": "tx_workflow",
            "workflow_template_name": "access-vlan"
          }
        }
      ]
    }
  ]
}
```

Every `targets` entry must be the name of a saved connection. Inline target
objects and per-job connection overrides are rejected; use saved connection
properties and vars instead.

Set `rollback_on_stage_failure=true` when a failed target in one stage should trigger
compensation rollback for other successful targets in that same stage. Set
`rollback_completed_stages_on_failure=true` when a later-stage failure should also
compensate successful targets from earlier completed stages in reverse stage order.

**Saved device group example**

```json
{
  "name": "campus-vlan-rollout",
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
            "workflow_template_name": "core-vlan"
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
            "kind": "tx_workflow",
            "workflow_template_name": "access-vlan"
          }
        }
      ]
    }
  ]
}
```

The `core` and `access` groups must already exist in rauto. Manage their saved
connection membership in the Web workbench or with `rauto inventory group`.

Ready-to-edit sample files:

- [templates/examples/campus-vlan-orchestration.json](templates/examples/campus-vlan-orchestration.json)

Advanced sample files:

- [templates/examples/fabric-advanced-orchestration.json](templates/examples/fabric-advanced-orchestration.json)
- [templates/examples/linux-image-rollout-orchestration.json](templates/examples/linux-image-rollout-orchestration.json)
- [templates/examples/linux-image-export-and-transfer-workflow.json](templates/examples/linux-image-export-and-transfer-workflow.json)
- [templates/examples/linux-image-export-and-transfer-with-password-scp-workflow.json](templates/examples/linux-image-export-and-transfer-with-password-scp-workflow.json)
- [templates/examples/linux-image-load-and-restart-workflow.json](templates/examples/linux-image-load-and-restart-workflow.json)

Notes:

- `stage.jobs` defines executable units in a stage; each job has its own `targets`/`target_groups` and `action`.
- `stage.strategy` / `stage.max_parallel` controls job-level concurrency; `job.strategy` / `job.max_parallel` controls target-level concurrency.
- `targets` must reference saved connections by name.
- `target_groups` selects persisted rauto device groups; `target_tags` selects saved connection labels. Multiple groups and labels use union semantics.
- Group and label matches are deduplicated by saved connection name.
- `tx_workflow` jobs support exactly one source:
  - inline `workflow`
  - saved `workflow_template_name` with optional `workflow_vars`
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

CLI template management lives under the execution command:

```bash
rauto tx-workflow template list
rauto tx-workflow template show workflow-rollout
rauto tx-workflow template create workflow-rollout --file ./workflow-template.json
rauto tx-workflow template update workflow-rollout --file ./workflow-template.json
rauto tx-workflow template delete workflow-rollout

rauto orchestrate template list
rauto orchestrate template show campus-rollout
rauto orchestrate template create campus-rollout --file ./orchestration-template.json
rauto orchestrate template update campus-rollout --file ./orchestration-template.json
rauto orchestrate template delete campus-rollout
```

Template execution:

```bash
rauto tx-workflow --template workflow-rollout --vars ./workflow-vars.json --dry-run
rauto orchestrate --template campus-rollout --vars-json '{"site":"dc-a"}' --view
```

Template rendering context:

- `vars`: request-level `*_vars`
- `connection`: resolved single-target runtime connection data (host/username/password/port/device_profile, etc.); credentials are resolved only in memory, and for saved connections `connection.saved` contains metadata
- `defaults`: global default connection settings (for orchestration rendering)
- `now`: current time (`rfc3339` / `timestamp_ms`)
- Top-level shorthand is available: `{{ peer_host }}` resolves from request vars first, then falls back to current target connection params.
- Direct connection object refs are supported in template strings: `{{ edge94.host }}`, `{{ edge94.password }}`, `{{ edge94.vars.site }}`.

The runtime template context can still expose `username`, `password`, and `enable_password` when a flow or execution template explicitly needs them, but those values are resolved from the selected device credential and are never persisted in the connection record.

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
and connection `vars`). Inventory CLI focuses on membership-only device-group management.

Manage groups:

```bash
rauto inventory group list
rauto inventory group show access --json
rauto inventory group upsert access --file ./group-access.json
rauto inventory group delete access
```

Group JSON shape:

```json
{
  "description": "Campus access switches",
  "hosts": ["edge-sw-01", "edge-sw-02"]
}
```

The positional group name is authoritative; `upsert` does not require a duplicate `name` field in the JSON body.

## Directory Structure

The Rust backend is a single Cargo package. Code under `src/domain/` owns domain
models and rules, while `src/infrastructure/` and `src/interfaces/` contain
persistence and transport adapters. See [Backend architecture](docs/architecture.md)
for ownership and dependency rules.

By default, `rauto` stores runtime data under `~/.rauto/`.

Default runtime data:

- `~/.rauto/rauto.db` (saved connections, device credential metadata/ciphertext, history recordings, blacklist patterns, custom device profiles, managed command templates)
- `~/.rauto/backups` (backup archives)
- `~/.rauto/uploads` (files staged for Web/API SFTP upload)
- `~/.rauto/keys` (private key files explicitly allowed for Web/API credentials)

These runtime directories are auto-created on startup.

```
~/.rauto
├── rauto.db                # SQLite runtime store
├── backups/                # Backup archives (*.tar.gz)
├── uploads/                # Web/API upload staging
└── keys/                   # Web/API private key files
```

## Configuration

| Argument               | Env Var | Description                                                                                       |
| ---------------------- | ------- | ------------------------------------------------------------------------------------------------- |
| `--host`               | -       | Device hostname or IP (`-H`)                                                                      |
| `--credential`         | -       | Reusable device credential name or ID                                                             |
| `--ssh-port`           | -       | SSH port (default: 22)                                                                            |
| `--ssh-security`       | -       | SSH security profile (default: `legacy-compatible`): `secure`, `balanced`, `legacy-compatible`    |
| `--linux-shell-flavor` | -       | Linux shell flavor for exit-code capture: `posix` (`bash` alias) or `fish`                        |
| `--device-profile`     | -       | Device type/profile (default: `autodetect`; examples: `huawei`, `linux`, `fortinet`, `cisco_ios`) |
| `--force-autodetect`   | -       | Ignore cached autodetect result and probe the target again                                        |
| `--session-retries`    | `RAUTO_SESSION_RETRIES` | Retry transient failures for ordinary commands/flows (default: `0`)                 |
| `--retry-initial-backoff-ms` | `RAUTO_RETRY_INITIAL_BACKOFF_MS` | Initial retry delay in milliseconds (default: `200`)       |
| `--retry-max-backoff-ms` | `RAUTO_RETRY_MAX_BACKOFF_MS` | Maximum exponential retry delay in milliseconds (default: `2000`) |
| `--retry-authentication-errors` | `RAUTO_RETRY_AUTHENTICATION_ERRORS` | Also retry authentication rejections (default: off) |
| `--connection`         | -       | Load saved connection profile by name (`-c`)                                                      |
| `--save-connection`    | -       | Save effective connection profile and credential reference after successful connect (`-S`)       |

Common shorthand aliases:

- Global: `-H/--host`, `--credential`, `-P/--ssh-port`, `-d/--device-profile`, `-c/--connection`, `-S/--save-connection`
- Flow: `-t/--template`, `-f/--file`, `-v/--vars`, `-r/--record-file`, `-l/--record-level`
- Exec: `-m/--mode`, `-r/--record-file`, `-l/--record-level`
- Show: `-m/--mode`, `-r/--record-file`, `-l/--record-level`
- Tx: `-t/--template`, `-m/--mode`, `-v/--vars`, `-r/--record-file`, `-l/--record-level`

Common command-specific options:

- `exec --mode <mode>` / `exec -m <mode>`: Execute a raw command in a specific mode such as `Enable`, `Config`, or `Shell`; comma/pipe-separated candidates such as `Enable,Config` are also accepted.
- `exec` without `--mode`: Use the selected profile's `default_mode`; this is not inferred from command text such as `show ...` or `interface ...`.
- `show <object>`: Execute a built-in show object such as `version`, `interfaces`, `route`, or `arp`.
- `show --list`: List available show objects. Pass `--device-profile` or `--textfsm-platform` to narrow the list.
- `show --no-parse`: Disable the default TextFSM parsing and print raw output only.
- `show --print-command`: Print the resolved device command before execution.
- `show-object set/list/delete`: Manage profile-specific custom show objects saved in SQLite. Custom objects override bundled show mappings for the same profile and object.
- `--force-autodetect`: Bypass the local `host:port` autodetect cache, probe again, and refresh the cached profile. Useful when the device behind an existing IP/port has changed.
- `--session-retries <N>`: Retry transient connection, initialization, transport, and channel-disconnect failures for ordinary commands and command flows. Backoff starts at `--retry-initial-backoff-ms` and doubles up to `--retry-max-backoff-ms`; completed flow steps are retained and execution resumes at the first unfinished step.
- Retries are disabled by default and have at-least-once semantics: a device may apply a command before the connection drops. Enable them only for commands that are safe to repeat. Transactions, workflows, and uploads are not automatically retried. Authentication rejections are excluded unless `--retry-authentication-errors` is explicitly set.
- `exec/template/flow --parse-textfsm`: Enable TextFSM parsing for the command output. Without it, `rauto` skips TextFSM unless you provide a manual template.
- `exec/template/flow --textfsm-platform <platform>`: Override the inferred NTC platform after parsing is enabled.
- `exec/template/flow --textfsm-template <path>`: Parse command output with a specific TextFSM template file. For `template` and `flow`, repeat this option to match templates by command order; the last template is reused for remaining commands.
- `show/exec/template/flow --textfsm-strict-errors`: Keep TextFSM `-> Error` rules instead of filtering them before parsing.
- `show/exec/template/flow --textfsm-excel <file.xlsx>`: Export successful TextFSM parsed rows to Excel.
- `textfsm template ...`: Manage custom TextFSM templates saved in SQLite.
- `textfsm mapping ...`: Manage custom `(device profile, command) -> TextFSM template` mappings. These mappings have higher priority than bundled NTC templates when parsing is enabled and no explicit template file is provided.
- `template --vars <file>` / `template -v <file>`: Load JSON/YAML vars for a stored command template.
- `flow --template <name>` / `flow -t <name>`: Run a saved command flow template.
- `flow --file <path>` / `flow -f <path>`: Run an ad-hoc command flow template from a TOML file.
- `flow --vars <file>` / `flow -v <file>` / `flow --vars-json <json>`: Provide file-based or inline JSON vars to a command flow template.
- `template --dry-run`: Render the command template without executing it on the target.
- `tx --mode <mode>` / `tx -m <mode>`: Force tx commands or command-flow steps to run in a specific mode.
- `tx --dry-run`: Print the planned tx block without executing it.

Recording-related options (command-specific):

- `exec/template/flow/tx --record-file <path>` / `-r <path>`: Save recording JSONL after execution.
- `exec/template/flow/tx --record-level <key-events-only|full>` / `-l <level>`: Recording granularity.
- `session`: Show the most recent saved session record.
- `session list [connection] [--limit N] [--json]`: List saved records, newest first.
- `session show [record_id] [--connection <name>] [--json|--raw]`: Show a record; when the ID is omitted, show the most recent matching record.
- `session delete <record_id> [--connection <name>]`: Delete a saved record.
- `session replay [record_file] [--id <record_id>] [--connection <name>] [--list]`: Inspect a saved database record or JSONL file.
- `session replay [record_file] [--id <record_id>] [--connection <name>] --command <cmd> [--mode <mode>]`: Replay one command output.
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
