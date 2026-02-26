# Rauto CLI Reference

Use this reference when the user asks for exact CLI commands or flags.

## Core commands

- `rauto exec <command>`
  - Optional: `--mode <Mode>`, `--record-file <path>`, `--record-level <key-events-only|full|off>`
- `rauto template <template>`
  - Optional: `--vars <json-file>`, `--dry-run`, `--record-file`, `--record-level`
- `rauto tx`
  - Inputs: `--command` (repeat), `--template`, `--vars`, `--mode`
  - Rollback: `--rollback-command` (repeat) or `--resource-rollback-command`
  - Options: `--rollback-on-failure`, `--rollback-trigger-step-index`
  - `--dry-run`, `--record-file`, `--record-level`
- `rauto tx-workflow <workflow.json>`
  - `--dry-run`, `--record-file`, `--record-level`, `--json`
- `rauto replay <record.jsonl>`
  - `--list`, `--command <cmd>`, `--mode <Mode>`
- `rauto web --bind <ip> --port <port>`
- `rauto interactive`
  - (CLI interactive is a placeholder; Web supports interactive sessions.)

## Device/profile management

- `rauto device list`
- `rauto device show <name>`
- `rauto device copy-builtin <source> <name> [--overwrite]`
- `rauto device delete-custom <name>`
- `rauto device diagnose <name> [--json]`

## Templates management

- `rauto templates list`
- `rauto templates show <name>`
- `rauto templates create <name> --file <path>` or `--content "<text>"`
- `rauto templates update <name> --file <path>` or `--content "<text>"`
- `rauto templates delete <name>`

## Saved connections and history

- `rauto device list-connections`
- `rauto device show-connection <name>`
- `rauto device add-connection <name>` (uses global flags as connection fields)
- `rauto device delete-connection <name>`
- `rauto device connection-history <name> [--limit N] [--json]`
- `rauto device connection-history-show <name> <id> [--json]`
- `rauto device connection-history-delete <name> <id>`

## Global connection flags

- `--host`, `--username`, `--password`, `--ssh-port`, `--enable-password`
- `--device-profile`
- `--template-dir`
- `--connection <name>`
- `--save-connection <name>` and `--save-password`
