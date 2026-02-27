# Rauto AI Prompt-to-Answer Examples

Use these examples as few-shot patterns when answering users.

## Table of Contents

1. Basic execution
2. Templates
3. Saved connections
4. Profiles and templates management
5. Tx block/workflow orchestration
6. Recording/replay/history
7. Web-first guidance
8. Backup and restore

## Bilingual Pairing Index

This file is paired with `examples_zh.md` using the same example IDs.

```text
1.1 <-> 1.1   Basic exec / 基础执行
1.2 <-> 1.2   Enable mode / Enable 模式
2.1 <-> 2.1   Template dry-run / 模板预览
2.2 <-> 2.2   Template execute / 模板执行
3.1 <-> 3.1   Save connection / 保存连接
3.2 <-> 3.2   Connection history / 连接历史
4.1 <-> 4.1   Copy builtin profile / 复制内置 profile
4.2 <-> 4.2   Template CRUD / 模板管理
5.1 <-> 5.1   Tx per-step rollback / 事务逐条回滚
5.2 <-> 5.2   Tx workflow preview+run / 工作流预览与执行
5.3 <-> 5.3   Rollback policy choice / 回滚策略选择
6.1 <-> 6.1   Record and replay / 录制与回放
6.2 <-> 6.2   Replay troubleshooting / 回放排障
7.1 <-> 7.1   Web template flow / Web 模板流程
7.2 <-> 7.2   Web interactive / Web 交互会话
8.1 <-> 8.1   Backup all data / 全量备份
8.2 <-> 8.2   Auto timestamp filename / 自动时间命名
8.3 <-> 8.3   Safe restore / 安全恢复
```

## 1) Basic execution

### Example 1.1

User ask:
```text
How do I quickly run one show command?
```

Answer pattern:
```bash
rauto exec "show version" --host <host> --username <username> --password <password>
```

### Example 1.2

User ask:
```text
Run command under Enable mode.
```

Answer pattern:
```bash
rauto exec "show ip route" \
  --host <host> --username <username> --password <password> \
  --mode Enable
```

## 2) Templates

### Example 2.1

User ask:
```text
Preview template output before touching device.
```

Answer pattern:
```bash
rauto template show_vlan.j2 --vars ./vars.json --dry-run
```

### Example 2.2

User ask:
```text
Render and execute template on device.
```

Answer pattern:
```bash
rauto template show_vlan.j2 \
  --vars ./vars.json \
  --host <host> --username <username> --password <password>
```

## 3) Saved connections

### Example 3.1

User ask:
```text
I do not want to type host/user every time.
```

Answer pattern:
```bash
rauto device add-connection lab1 \
  --host <host> --username <username> --password <password> \
  --ssh-port 22 --device-profile cisco

rauto exec "show version" --connection lab1
```

### Example 3.2

User ask:
```text
How to inspect execution history for one connection?
```

Answer pattern:
```bash
rauto device connection-history lab1 --limit 50
rauto device connection-history-show lab1 <history-id>
```

## 4) Profiles and templates management

### Example 4.1

User ask:
```text
Copy builtin profile then customize.
```

Answer pattern:
```bash
rauto device copy-builtin cisco my-cisco --overwrite
rauto device show my-cisco
```

### Example 4.2

User ask:
```text
Create and edit command templates from CLI.
```

Answer pattern:
```bash
rauto templates create my_show.j2 --content "show version"
rauto templates update my_show.j2 --file ./my_show.j2
rauto templates list
```

## 5) Tx block/workflow orchestration

### Example 5.1

User ask:
```text
Use per-step rollback for a tx block.
```

Answer pattern:
```bash
rauto tx \
  --name vlan10 \
  --command "interface vlan 10" \
  --command "ip address 10.0.10.1 255.255.255.0" \
  --rollback-command "no interface vlan 10" \
  --rollback-command "no ip address 10.0.10.1 255.255.255.0" \
  --host <host> --username <username> --password <password>
```

### Example 5.2

User ask:
```text
I want to preview workflow first, then execute.
```

Answer pattern:
```bash
rauto tx-workflow ./workflow.json --dry-run
rauto tx-workflow ./workflow.json --host <host> --username <username> --password <password>
```

### Example 5.3

User ask:
```text
Should I use merge or replace rollback strategy?
```

Answer pattern:
```text
Use per_step when each command has explicit undo.
Use whole_resource when one undo command can safely remove the resource.
Always preview/dry-run before execute.
```

## 6) Recording/replay/history

### Example 6.1

User ask:
```text
Record command and replay later.
```

Answer pattern:
```bash
rauto exec "show version" \
  --host <host> --username <username> --password <password> \
  --record-file ~/.rauto/records/show_version.jsonl \
  --record-level key-events-only

rauto replay ~/.rauto/records/show_version.jsonl --list
rauto replay ~/.rauto/records/show_version.jsonl --command "show version" --mode Enable
```

### Example 6.2

User ask:
```text
Why no replay data appears?
```

Answer pattern:
```text
Check recording level is not off.
Check record file exists and is non-empty.
Use replay --list first to verify commands in JSONL.
```

## 7) Web-first guidance

### Example 7.1

User ask:
```text
Show me full web flow for template execution.
```

Answer pattern:
```text
1) Run: rauto web --bind 127.0.0.1 --port 3000
2) Open Operations tab.
3) Choose "Template Render + Execute".
4) Fill template and vars JSON.
5) Click "Preview Render", then "Run Template".
```

### Example 7.2

User ask:
```text
How to use interactive mode in web?
```

Answer pattern:
```text
Open Interactive tab -> Start Session -> Send commands -> Stop Session.
```

## 8) Backup and restore

### Example 8.1

User ask:
```text
Backup all current rauto data.
```

Answer pattern:
```bash
rauto backup create
```

### Example 8.2

User ask:
```text
Create backup under custom folder without naming file.
```

Answer pattern:
```bash
rauto backup create --output ./backup/
```

### Example 8.3

User ask:
```text
Restore backup safely.
```

Answer pattern:
```bash
# safer: merge restore
rauto backup restore ~/.rauto/backups/rauto-backup-1234567890.tar.gz

# destructive: replace restore
rauto backup restore ~/.rauto/backups/rauto-backup-1234567890.tar.gz --replace
```
