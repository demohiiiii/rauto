# Rauto Execution-Style Prompt Examples (EN)

Use these as few-shot examples for action-first agent behavior.
Default output shape after execution:

```text
Operation: <what was done>
Command: <exact rauto command>
Result: <key outcome>
Notes: <risk/error/follow-up>
```

## Table of Contents

1. Basic execution
2. Templates
3. Saved connections
4. Profiles and templates management
5. Tx block/workflow orchestration
6. Recording/replay/history
7. Web-first requests
8. Backup and restore

## 1) Basic execution

### Example 1.1

User ask:
```text
Run one show command on my device.
```

Execution-style answer:
```text
Operation: Execute direct command on target device
Command: rauto exec "show version" --host <host> --username <username> --password <password>
Result: Command executed; captured version output from device
Notes: If connection fails, verify SSH port/profile credentials
```

### Example 1.2

User ask:
```text
Run it in Enable mode.
```

Execution-style answer:
```text
Operation: Execute direct command with explicit mode
Command: rauto exec "show ip route" --host <host> --username <username> --password <password> --mode Enable
Result: Command executed in Enable mode
Notes: If mode mismatch appears, verify profile prompt/state mapping
```

## 2) Templates

### Example 2.1

User ask:
```text
Preview template output first.
```

Execution-style answer:
```text
Operation: Render template without device execution
Command: rauto template show_vlan.j2 --vars ./vars.json --dry-run
Result: Template rendered successfully; no commands sent to device
Notes: Review rendered commands before live execution
```

### Example 2.2

User ask:
```text
Now execute the rendered template.
```

Execution-style answer:
```text
Operation: Render and execute template on target device
Command: rauto template show_vlan.j2 --vars ./vars.json --host <host> --username <username> --password <password>
Result: Template commands executed on target
Notes: Add recording flags if audit/replay is required
```

## 3) Saved connections

### Example 3.1

User ask:
```text
Save this connection and reuse it.
```

Execution-style answer:
```text
Operation: Save connection profile and run command by profile name
Command: rauto device add-connection lab1 --host <host> --username <username> --password <password> --ssh-port 22 --device-profile cisco
Result: Saved connection lab1
Notes: Reuse with: rauto exec "show version" --connection lab1
```

### Example 3.2

User ask:
```text
Show history for that saved connection.
```

Execution-style answer:
```text
Operation: Query connection-scoped execution history
Command: rauto device connection-history lab1 --limit 50
Result: Returned recent history entries for lab1
Notes: Use connection-history-show with an entry ID for event-level detail
```

## 4) Profiles and templates management

### Example 4.1

User ask:
```text
Copy builtin cisco profile to a custom one.
```

Execution-style answer:
```text
Operation: Duplicate builtin profile to custom profile
Command: rauto device copy-builtin cisco my-cisco --overwrite
Result: Custom profile my-cisco created/updated
Notes: Inspect with: rauto device show my-cisco
```

### Example 4.2

User ask:
```text
Create or update a template for me.
```

Execution-style answer:
```text
Operation: Create/update command template
Command: rauto templates create my_show.j2 --content "show version"
Result: Template created (or use update command if exists)
Notes: Update form: rauto templates update my_show.j2 --file ./my_show.j2
```

## 5) Tx block/workflow orchestration

### Example 5.1

User ask:
```text
Run a tx block with per-step rollback.
```

Execution-style answer:
```text
Operation: Execute tx block with explicit per-step rollback
Command: rauto tx --name vlan10 --command "interface vlan 10" --command "ip address 10.0.10.1 255.255.255.0" --rollback-command "no interface vlan 10" --rollback-command "no ip address 10.0.10.1 255.255.255.0" --host <host> --username <username> --password <password>
Result: Tx block executed with rollback policy per_step
Notes: Use --dry-run first when changing production config
```

### Example 5.2

User ask:
```text
Preview workflow then run it.
```

Execution-style answer:
```text
Operation: Dry-run then execute tx workflow
Command: rauto tx-workflow ./workflow.json --dry-run
Result: Workflow plan validated
Notes: Execute after review: rauto tx-workflow ./workflow.json --host <host> --username <username> --password <password>
```

### Example 5.3

User ask:
```text
Which rollback mode should I pick?
```

Execution-style answer:
```text
Operation: Provide rollback policy recommendation
Command: (no command; policy guidance)
Result: per_step for explicit per-command undo, whole_resource for single-resource undo command
Notes: Prefer preview before execution and explicit rollback commands for ambiguous syntax
```

## 6) Recording/replay/history

### Example 6.1

User ask:
```text
Record this run and replay later.
```

Execution-style answer:
```text
Operation: Execute with recording and list replayable entries
Command: rauto exec "show version" --host <host> --username <username> --password <password> --record-file ~/.rauto/records/show_version.jsonl --record-level key-events-only
Result: Recording file generated
Notes: Replay list: rauto replay ~/.rauto/records/show_version.jsonl --list
```

### Example 6.2

User ask:
```text
Why replay cannot find my command?
```

Execution-style answer:
```text
Operation: Replay troubleshooting
Command: rauto replay ~/.rauto/records/show_version.jsonl --list
Result: Listed recorded command strings/modes to verify exact match
Notes: Command text and optional mode must match replay query
```

## 7) Web-first requests

### Example 7.1

User ask:
```text
Start web UI and tell me where to run template execution.
```

Execution-style answer:
```text
Operation: Start web service and provide exact UI path
Command: rauto web --bind 127.0.0.1 --port 3000
Result: Web UI started at http://127.0.0.1:3000
Notes: Use Operations -> Template Render + Execute -> Preview Render -> Run Template
```

### Example 7.2

User ask:
```text
How to run interactive mode in web?
```

Execution-style answer:
```text
Operation: Web interactive session guidance
Command: (web UI operation)
Result: Path: Interactive tab -> Start Session -> Send -> Stop Session
Notes: Ensure valid connection context before starting session
```

## 8) Backup and restore

### Example 8.1

User ask:
```text
Backup all rauto data now.
```

Execution-style answer:
```text
Operation: Create runtime data backup
Command: rauto backup create
Result: Backup archive created under ~/.rauto/backups with timestamp filename
Notes: List backups with: rauto backup list
```

### Example 8.2

User ask:
```text
Use my directory but auto-generate backup filename.
```

Execution-style answer:
```text
Operation: Create backup in custom directory with auto timestamp filename
Command: rauto backup create --output ./backup/
Result: Backup created as ./backup/rauto-backup-<timestamp>.tar.gz
Notes: If output is a file path, that exact filename is used
```

### Example 8.3

User ask:
```text
Restore safely; when should replace be used?
```

Execution-style answer:
```text
Operation: Restore backup in merge/replace modes
Command: rauto backup restore ~/.rauto/backups/rauto-backup-1234567890.tar.gz
Result: Merge restore completed
Notes: Use --replace only for full replacement: rauto backup restore ~/.rauto/backups/rauto-backup-1234567890.tar.gz --replace
```
