# CLI Runbook

## Install And Start

Recommended release installers:

```sh
curl -fsSL https://raw.githubusercontent.com/demohiiiii/rauto/main/install.sh | sh
```

```powershell
& ([scriptblock]::Create((irm 'https://raw.githubusercontent.com/demohiiiii/rauto/main/install.ps1')))
```

Homebrew: `brew install demohiiiii/rauto/rauto`. Released binaries embed Web
assets; launching them does not require Node.js or a Rust toolchain. For work
in a source checkout, use its pinned toolchain and `cargo build --locked`.

```sh
rauto --version
rauto web --bind 127.0.0.1 --port 3000
```

Web requires no device at startup. Read [Web](web-runbook.md) or
[Agent](agent-runbook.md) for service operation.

## Credentials, Devices, And Profiles

```sh
rauto credential list
rauto credential add network-admin
rauto credential show network-admin
rauto device list --json
rauto device show core-01 --json
rauto device add core-01 --host 192.0.2.10 --credential network-admin
rauto device test --connection core-01
rauto profile list
rauto profile show linux
rauto profile diagnose linux --json
rauto profile autodetect --host 192.0.2.10 --credential network-admin
```

`credential add` securely prompts for omitted login values. Authentication
supports passwords, keyboard-interactive, encrypted inline keys loaded with
`--private-key <file>`, and runtime key paths via `--private-key-file <file>`.
`--enable` enables the Enable stage; a missing Enable secret sends an empty
Enter. Saved devices reference credentials instead of embedding passwords.
`device import` and `credential import` accept CSV/Excel.

Omit `--device-profile` for autodetection. Use `--linux-shell-flavor fish` on an
explicit Linux connection when needed; `posix` covers bash/POSIX shells.
Imported discovery results retain the detected shell flavor.

## Reads And Configuration Collection

```sh
rauto show --list --device-profile linux
rauto show version --connection core-01
rauto show interfaces --connection core-01 --print-command
rauto show route --group core --label prod --max-parallel 4 --textfsm-excel ./routes.xlsx
rauto show services-failed --connection linux-01 --no-parse
rauto exec 'id' --connection linux-01 --mode 'Root,User'

rauto config fetch --connection core-01 --kind running
rauto config fetch --connection core-01 --output ./core-01.cfg
rauto config fetch --group access --kind startup --output-dir ./configs
rauto config history devices --json
rauto config history list --connection core-01 --limit 20 --json
rauto config history show <snapshot-id> --output ./snapshot.cfg
```

List the profile's actual show objects before choosing one. Linux includes
`cpu`, `memory`, `disk`, `disk-inodes`, `processes`, `ports`, `services`,
`services-failed`, `logs`, `uptime`, and other inspection objects. Some require
Root or platform utilities. Raw output remains available when no TextFSM
template exists.

Configuration fetch stores history and reports raw/normalized SHA-256 hashes.
`--normalized` emits volatile-line-filtered content. `--output` is an exact
single-device path; `--output-dir` writes timestamped per-device files.

```sh
rauto textfsm template create my_version --file ./my_version.textfsm
rauto textfsm mapping set --profile cisco_ios --command 'show version' --template my_version
rauto show-object set --profile cisco_ios --object acl --command 'show access-lists' --mode Enable
rauto config command list --profile linux
rauto config command set linux running 'cat /etc/device.conf' --mode 'Root,User'
rauto config volatile add linux '^# Generated at .*$'
```

Custom mappings override the bundled catalog. TextFSM has no platform override
flag; fix the profile or bind an explicit template. CLI can accept local
`--textfsm-template` files; Web uses stored template names.

## Templates And Changes

```sh
rauto templates list
rauto templates create inspect --file ./inspect.j2
rauto template inspect --vars ./vars.json --dry-run
rauto template inspect --connection core-01 --vars ./vars.json
rauto interactive-template list
rauto interactive --file ./interactive.toml --connection core-01 --vars-json '{"value":"example"}'
rauto interactive --template saved-interaction --group access --max-parallel 4
rauto tx-workflow ./workflow.json --dry-run --json
rauto tx-workflow ./workflow.json --connection core-01 --json
rauto orchestrate ./plan.json --dry-run --json
```

`templates` manages command text; `template` renders/executes a stored command
template. Command templates support Jinja syntax. `interactive-template`
manages single-command TOML with inline substitutions. `interactive` has no
dry-run flag. Read [Interactive](interactive-templates.md) before authoring it.

`exec` has no `--multiline-mode` option. Explicit `split_lines`/`whole` behavior
belongs in interactive TOML or workflow operations. Use [JSON plans](json-templates.md)
for changes with rollback and [Validation](json-validation.md) for preview limits.

## Inventory, Records, Transfer, And Backup

```sh
rauto inventory group list --json
rauto inventory group upsert access --content '{"description":"Access devices","hosts":["edge-01"]}'
rauto session
rauto session list core-01 --limit 20 --json
rauto session replay --connection core-01 --list
rauto session replay ./record.jsonl --list
rauto upload --connection core-01 --local-path ./pkg.tar --remote-path /tmp/pkg.tar
rauto blacklist check 'show version'
rauto backup create
rauto backup list
```

Groups hold saved device names and an optional description, with no group vars
or inline connection definitions. Labels belong to saved connections. Replay
reads captured events; it does not re-send commands to a device.

Executions record key events by default. `--record-level full` adds richer
session events; `--record-file` exports JSONL. Upload uses SFTP. Backup covers
runtime data except existing backups; `backup restore <archive> --replace`
replaces current runtime data. Preserve the encryption key alongside backups;
a key stored only in the OS credential store is not inside the archive.

Retries default to zero. For repeat-safe operations, set `--session-retries N`
and optionally backoff flags (defaults 200ms initial, 2000ms maximum).
Authentication rejections are excluded unless `--retry-authentication-errors`
is supplied. See [Schedules](schedules.md) for recurring jobs.
