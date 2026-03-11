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

1. Install and verify
2. Basic execution
3. Templates
4. Saved connections
5. Profiles and templates management
6. Tx block/workflow orchestration
7. Recording/replay/history
8. Web-first requests
9. Backup and restore

## 1) Install and verify

### Example 1.1

User ask:
```text
Install the latest rauto on this machine for me.
```

Execution-style answer:
```text
Operation: Install rauto from official GitHub Releases for this machine
Command: Resolve the latest GitHub Releases asset for the current OS/arch, download it, extract it, install `rauto` into a user-local bin path, then run `rauto --version`
Result: Release binary installed and verified
Notes: Prefer GitHub Releases by default; use a source build only when the user explicitly wants the current checkout
```

### Example 1.2

User ask:
```text
Check whether rauto is already installed here.
```

Execution-style answer:
```text
Operation: Verify local rauto installation state
Command: command -v rauto && rauto --version
Result: Reported resolved binary path and version
Notes: If not found, detect OS/arch and choose the matching GitHub Releases asset
```

### Example 1.3

User ask:
```text
Upgrade my rauto install.
```

Execution-style answer:
```text
Operation: Upgrade existing rauto from official GitHub Releases
Command: Resolve the latest matching GitHub Releases asset, download it, replace the current user-local binary, then run `rauto --version`
Result: Existing install replaced with the latest release binary
Notes: Confirm overwrite intent first if the current installation target is ambiguous
```

## 2) Basic execution

### Example 2.1

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

### Example 2.2

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

## 3) Templates

### Example 3.1

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

### Example 3.2

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

## 4) Saved connections

### Example 4.1

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

### Example 4.2

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

## 5) Profiles and templates management

### Example 5.1

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

### Example 5.2

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

## 6) Tx block/workflow orchestration

### Example 6.1

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

### Example 6.2

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

### Example 6.3

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

### Example 6.4

User ask:
```text
Give me a detailed whole-resource rollback tx example with trigger step.
```

Execution-style answer:
```text
Operation: Execute tx block with whole-resource rollback and trigger control
Command: rauto tx --name fw-policy-publish --command "set security policies from-zone trust to-zone untrust policy allow-web match source-address WEB01" --command "set security policies from-zone trust to-zone untrust policy allow-web match destination-address any" --command "set security policies from-zone trust to-zone untrust policy allow-web then permit" --resource-rollback-command "delete security policies from-zone trust to-zone untrust policy allow-web" --rollback-trigger-step-index 0 --mode Config --host <host> --username <username> --password <password>
Result: Tx block executed under whole_resource rollback strategy
Notes: Preview first with --dry-run; use explicit rollback command for policy-like resources
```

### Example 6.5

User ask:
```text
Use rollback commands from file/JSON for per-step tx execution.
```

Execution-style answer:
```text
Operation: Execute tx block with external rollback list
Command: rauto tx --name vlan-batch --command "interface vlan 10" --command "ip address 10.0.10.1 255.255.255.0" --rollback-commands-file ./rollback.txt --rollback-on-failure --mode Config --host <host> --username <username> --password <password>
Result: Tx executed with per-step rollback commands loaded from file
Notes: Alternative JSON input: --rollback-commands-json ./rollback.json ; empty rollback lines are allowed and will be skipped
```

### Example 6.6

User ask:
```text
I need a full tx-workflow run sequence (preview + execute + recording).
```

Execution-style answer:
```text
Operation: Preview and execute tx workflow with recording
Command: rauto tx-workflow ./workflow.json --dry-run
Result: Workflow structure validated before execution
Notes: Execute with recording: rauto tx-workflow ./workflow.json --host <host> --username <username> --password <password> --record-file ~/.rauto/records/tx_workflow.jsonl --record-level key-events-only
```

### Example 6.7

User ask:
```text
I need multi-block orchestration with compensation rollback if a later block fails.
```

Execution-style answer:
```text
Operation: Preview and execute multi-block tx workflow with compensation rollback visibility
Command: rauto tx-workflow ./workflow.json --dry-run
Result: Workflow and rollback plan validated before live execution
Notes: Execute with audit trail: rauto tx-workflow ./workflow.json --connection <connection> --record-file ~/.rauto/records/fw_publish.jsonl --record-level key-events-only ; then verify rollback_attempted/rollback_succeeded/rollback_errors in output
```

### Example 6.8

User ask:
```text
Generate deployment commands for me.
```

Execution-style answer:
```text
Operation: Propose rollback-capable deployment plan (not executed yet)
Planned Command: rauto tx-workflow ./workflow.json --connection <connection>
Result: Change plan prepared with rollback path; waiting for human confirmation
Notes: Preview first: rauto tx-workflow ./workflow.json --dry-run ; execute only after explicit confirmation
```

## 7) Recording/replay/history

### Example 7.1

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

### Example 7.2

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

### Example 7.3

User ask:
```text
Show event-level detail for one history entry under a saved connection.
```

Execution-style answer:
```text
Operation: Query history then inspect one event-level entry
Command: rauto device connection-history lab1 --limit 50
Result: Returned ordered history entries with IDs
Notes: Detail view: rauto device connection-history-show lab1 <history-id> ; machine-readable: rauto device connection-history-show lab1 <history-id> --json
```

### Example 7.4

User ask:
```text
Give me an auditable execution chain for a saved connection.
```

Execution-style answer:
```text
Operation: Execute, persist record, inspect connection history, and replay
Command: rauto exec "show version" --connection lab1 --record-file ~/.rauto/records/lab1_show_version.jsonl --record-level key-events-only
Result: Command executed with durable recording and connection-bound history entry
Notes: Continue with: rauto device connection-history lab1 --limit 20 ; rauto device connection-history-show lab1 <history-id> ; rauto replay ~/.rauto/records/lab1_show_version.jsonl --list
```

## 8) Web-first requests

### Example 8.1

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

### Example 8.2

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

## 9) Backup and restore

### Example 9.1

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

### Example 9.2

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

### Example 9.3

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
