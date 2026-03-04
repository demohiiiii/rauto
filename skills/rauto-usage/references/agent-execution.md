# Rauto Agent Execution Playbook

Use this file when the agent should run `rauto` commands directly for the user.

## Table of Contents

1. Execution decision tree
2. Read/query operations
3. Change operations
4. Destructive operations (confirmation required)
5. Output summarization template
6. Common command templates

## 1) Execution decision tree

1. Classify user intent:
   - Query/read -> execute immediately.
   - Change/apply -> execute if intent is explicit.
   - Destructive -> require explicit confirmation.
2. Resolve connection inputs:
   - Prefer existing `--connection <name>`.
   - Else use provided host/user/password/profile/port.
   - If still missing required fields, ask only for missing fields.
3. Execute command and capture output.
4. Return concise result summary.

## 2) Read/query operations

Safe to run directly:

- `rauto device list`
- `rauto device show <name>`
- `rauto templates list`
- `rauto templates show <name>`
- `rauto device list-connections`
- `rauto device show-connection <name>`
- `rauto device connection-history <name> --limit <N>`
- `rauto replay <record_file> --list`
- `rauto replay <record_file> --command "<cmd>" [--mode <Mode>]`
- `rauto backup list`

## 3) Change operations

Run directly when user intent is explicit:

- `rauto exec ...`
- `rauto template ...`
- `rauto tx ...`
- `rauto tx-workflow ...`
- `rauto device add-connection ...`
- `rauto templates create|update ...`
- `rauto backup create [...]`
- `rauto backup restore <archive>` (merge mode)

## 4) Destructive operations (confirmation required)

Require clear user confirmation before running:

- `rauto backup restore <archive> --replace`
- `rauto device delete-connection <name>`
- `rauto device delete-custom <name>`
- `rauto templates delete <name>`
- `rauto device connection-history-delete <name> <id>`

If user already asks explicitly (e.g. "删除", "replace 恢复"), execute directly.

## 5) Output summarization template

After execution, report:

```text
Operation: <what was done>
Command: <exact rauto command>
Result: <success/failure + key fields>
Notes: <risk/errors/next action>
```

For query operations, include only key lines.
For change operations, include target + outcome + rollback/fallback hints when needed.

## 6) Common command templates

### Query device profiles and templates

```bash
rauto device list
rauto templates list
```

### Execute one command via saved connection

```bash
rauto exec "show version" --connection <connection>
```

### Execute one command via direct credentials

```bash
rauto exec "show version" \
  --host <host> --username <username> --password <password> \
  --ssh-port 22 --device-profile cisco
```

### Template dry-run then execute

```bash
rauto template <template> --vars <vars.json> --dry-run
rauto template <template> --vars <vars.json> --connection <connection>
```

### Tx workflow

```bash
rauto tx-workflow <workflow.json> --dry-run
rauto tx-workflow <workflow.json> --connection <connection>
```

### Backup and restore

```bash
rauto backup create
rauto backup create --output ./backup/
rauto backup list
rauto backup restore <archive.tar.gz>
rauto backup restore <archive.tar.gz> --replace
```
