# Device Discovery Runbook

Use this file for CLI or Web SSH device discovery, latest-result inspection, filtering, and connection imports.

## Start A Scan

```bash
rauto device discover 192.168.60.0/24 --credential network-admin

rauto device discover 192.168.60.0/24 \
  --probe-credential network-admin \
  --probe-credential fallback-admin \
  --port 22,2222 \
  --status all
```

- Accept individual IPs, CIDRs, and last-octet ranges such as `192.168.2.10-30`; multiple target arguments are allowed.
- Limit one run to 4,096 unique addresses, 16 ports, and 3 ordered probe credentials.
- `--probe-credential` overrides the global `--credential`; credentials are tried in supplied order.
- Tune scanning with `--concurrency`, `--tcp-timeout-ms`, and `--probe-timeout-secs`.
- TCP success becomes `reachable` only after a valid SSH identification line; otherwise the endpoint is `not-ssh`.
- Press `Ctrl+C` during scanning to request cancellation.

## Output Modes

- Interactive terminal: show phase-aware progress, then open the result TUI.
- `--no-tui`: keep progress, then print the filtered table.
- `--json`: suppress progress and TUI so stdout remains machine-readable.
- Non-interactive stdin/stdout: automatically use plain output.

Progress has two phases: TCP scan uses `scanned_targets / total_targets`; SSH identification/profile probing uses `probed_targets / reachable_count`. Do not report completion merely because the TCP phase reached 100%.

## Filter Results

The default status is `identified`, meaning newly identified devices that do not already have saved endpoint connections. Available statuses are:

`all`, `identified`, `existing`, `imported`, `reachable`, `failed`, `not-ssh`, `probe-failed`, `unreachable`, `cancelled`.

`identified`, `existing`, and `imported` are exclusive effective states. Existing/imported devices are not importable.

```bash
rauto device discover list
rauto device discover list --status existing --json
rauto device discover list --profile fortinet,linux --port 22,2222 --search branch
```

`device discover list` reads only the latest persisted snapshot. It does not scan and must work without `--credential` or `--probe-credential`.

## Save Connections

```bash
rauto device discover save --profile fortinet
rauto device discover save 192.168.60.98:22 --connection-name branch-fw
rauto device discover 192.168.60.0/24 --credential network-admin --auto-save
```

- With no endpoint arguments, `save` imports every matching newly identified result.
- Endpoint selectors accept `host` or `host:port`.
- `--connection-name` requires exactly one match; `--overwrite` permits replacing the selected name.
- Default names combine detected platform and IP, for example `cisco_ios-192-168-60-98`; append nonstandard SSH ports to avoid collisions.
- TUI save, `discover save`, Web import, and `--auto-save` share endpoint, credential, and connection-name validation.

## TUI Keys

| Key | Action |
| --- | --- |
| `Up` / `Down`, `j` / `k` | Move through results |
| `Space` | Toggle the current importable device |
| `a` | Toggle all importable devices in the current filter |
| `f` / `Shift+f`, `Right` / `Left` | Cycle status filters |
| `/` | Search endpoint, profile, model, version, connection name, or error |
| `e` | Edit the current connection name |
| `s` | Save selected devices |
| `q`, `Ctrl+C` | Exit |

Newly identified devices are selected by default. Existing, imported, and failed results cannot be selected.

## Persistence

Only the latest run and results are retained. Starting a new scan replaces the prior run, result rows, and discovery Task Center entry, but never deletes saved connections. A second active scan is rejected. Current binaries recover stale run leases after interrupted processes and preserve persisted progress when a run fails.

The compatibility spelling `rauto device discovery list|save` remains available, but use `rauto device discover list|save` in new instructions.
