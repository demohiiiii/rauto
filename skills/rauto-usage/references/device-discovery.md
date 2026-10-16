# SSH Device Discovery

## Scan

```sh
rauto device discover 192.0.2.10 --credential network-admin
rauto device discover 192.0.2.10-30 \
  --probe-credential network-admin --probe-credential fallback-admin \
  --port 22,2222 --no-tui --status all
```

Targets can be individual IPs, CIDRs, or last-octet ranges. Multiple target
arguments form a deduplicated set. Limits: 4096 addresses, 16 nonzero ports,
and 3 ordered credentials. `--probe-credential` overrides `--credential`.
New scans require an effective credential; result list/save do not.

| Setting | Default | Bounds |
| --- | --- | --- |
| `--concurrency` | 32 | 1-256 |
| `--tcp-timeout-ms` | 1000 | 1-30000 |
| `--probe-timeout-secs` | 15 | 1-120 per credential |

The TCP phase requires a valid SSH identification line; an open non-SSH port
is not a successful identification. TCP progress uses
`scanned_targets / total_targets`; SSH probing uses
`probed_targets / reachable_count`. Reaching the TCP total is not scan
completion. `Ctrl+C` requests cancellation.

Interactive terminals open the result TUI after scanning. `--no-tui` prints a
table; noninteractive terminals use plain output. `--json` suppresses progress
and the TUI to leave machine-readable stdout.

## Latest Results And Saving

```sh
rauto device discover list
rauto device discover list --status existing --json
rauto device discover list --profile linux,cisco_ios --port 22,2222 --search branch
rauto device discover save --profile linux
rauto device discover save 192.0.2.10:22 --device-name branch-linux
rauto device discover 192.0.2.10 --credential network-admin --auto-save
```

Default filtering is `identified`: newly identified endpoints with no saved
connection. Other CLI filters are `all`, `existing`, `imported`, `reachable`,
`failed`, `not-ssh`, `probe-failed`, `unreachable`, and `cancelled`.
Existing/imported states are derived from connection associations and exclude
the row from new imports. JSON/TUI filtering uses these effective states.

Without endpoint arguments, `save` imports all matching newly identified rows.
An endpoint selector can be a host or host:port. `--device-name` requires
exactly one matching row; `--overwrite` permits replacing a name, but does not
bypass the rule against importing an already saved endpoint.

Default connection names are detected platform + hyphen + IP with underscores:
`linux-192_0_2_10`, `cisco_ios-192_0_2_10`. Nonstandard ports append `-2222`.
CLI, TUI, and Web use this same format. Before identification, a provisional
row can use a `device` prefix; identified live rows should use the platform.

Imported connections retain the successful credential reference, profile,
model/version, and `linux_shell_flavor` returned by rneter. Fish detection is
saved as `fish`, not silently defaulted to POSIX/bash. Web imports refresh
saved connections/inventory so imported devices are available immediately.

## TUI

| Key | Action |
| --- | --- |
| Up/Down or j/k | Move |
| Space | Toggle one importable row |
| a | Toggle all importable rows in the filter |
| f / Shift+f or Right/Left | Cycle status |
| / | Search |
| e | Edit connection name |
| s | Save selected rows |
| q / Ctrl+C | Exit |

New identified rows are initially selected. Failed/existing/imported rows cannot
be selected. Web likewise preserves failed import selections after a partial
import and removes rows that were successfully imported.

## Persistence And Diagnosis

Only the latest discovery snapshot is retained. A new scan replaces previous
discovery rows and its discovery Task Center entry, never saved connections.
Only one active run is allowed; current binaries recover expired leases after
interrupted processes. List/save inspect the latest snapshot without rescanning.

For fish prompt timeouts, verify the running binary matches the pinned rneter
revision and inspect the probe transcript rather than adding a second SSH
engine. Linux version/inspection commands use profile-appropriate Root/User
candidates. Source: `src/web/handlers/device_discovery.rs`,
`src/cli/discovery.rs`, `src/infrastructure/db/device_discovery_store.rs`, and
`frontend/src/domains/device-discovery/`.
