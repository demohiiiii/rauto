# Rauto 中文问答示例（examples_zh）

用于中文场景下的 few-shot 参考，帮助 AI 输出更稳定的 rauto 使用指导。

## 目录

1. 基础执行
2. 模板执行
3. 连接配置复用
4. Profile / Template 管理
5. 事务块与工作流
6. 录制、回放与历史
7. Web 页面操作引导
8. 备份与恢复

## 双语对照索引

本文件与 `examples.md` 使用相同示例编号，按编号一一对应。

```text
1.1 <-> 1.1   基础执行 / Basic exec
1.2 <-> 1.2   Enable 模式 / Enable mode
2.1 <-> 2.1   模板预览 / Template dry-run
2.2 <-> 2.2   模板执行 / Template execute
3.1 <-> 3.1   保存连接 / Save connection
3.2 <-> 3.2   连接历史 / Connection history
4.1 <-> 4.1   复制内置 profile / Copy builtin profile
4.2 <-> 4.2   模板管理 / Template CRUD
5.1 <-> 5.1   事务逐条回滚 / Tx per-step rollback
5.2 <-> 5.2   工作流预览与执行 / Tx workflow preview+run
5.3 <-> 5.3   回滚策略选择 / Rollback policy choice
6.1 <-> 6.1   录制与回放 / Record and replay
6.2 <-> 6.2   回放排障 / Replay troubleshooting
7.1 <-> 7.1   Web 模板流程 / Web template flow
7.2 <-> 7.2   Web 交互会话 / Web interactive
8.1 <-> 8.1   全量备份 / Backup all data
8.2 <-> 8.2   自动时间命名 / Auto timestamp filename
8.3 <-> 8.3   安全恢复 / Safe restore
```

## 1）基础执行

### 示例 1.1

用户提问：
```text
我想快速执行一条 show 命令，怎么做？
```

回答范式：
```bash
rauto exec "show version" \
  --host <host> --username <username> --password <password>
```

### 示例 1.2

用户提问：
```text
我需要在 Enable 模式执行命令。
```

回答范式：
```bash
rauto exec "show ip route" \
  --host <host> --username <username> --password <password> \
  --mode Enable
```

## 2）模板执行

### 示例 2.1

用户提问：
```text
先预览模板渲染结果，再决定是否执行。
```

回答范式：
```bash
rauto template show_vlan.j2 --vars ./vars.json --dry-run
```

### 示例 2.2

用户提问：
```text
我要用模板直接下发到设备。
```

回答范式：
```bash
rauto template show_vlan.j2 \
  --vars ./vars.json \
  --host <host> --username <username> --password <password>
```

## 3）连接配置复用

### 示例 3.1

用户提问：
```text
每次都输 host/user 太麻烦，怎么复用？
```

回答范式：
```bash
rauto device add-connection lab1 \
  --host <host> --username <username> --password <password> \
  --ssh-port 22 --device-profile cisco

rauto exec "show version" --connection lab1
```

### 示例 3.2

用户提问：
```text
怎么查看某个连接的历史执行记录？
```

回答范式：
```bash
rauto device connection-history lab1 --limit 50
rauto device connection-history-show lab1 <history-id>
```

## 4）Profile / Template 管理

### 示例 4.1

用户提问：
```text
我想把内置 profile 复制成自定义 profile 再修改。
```

回答范式：
```bash
rauto device copy-builtin cisco my-cisco --overwrite
rauto device show my-cisco
```

### 示例 4.2

用户提问：
```text
如何在命令行创建并更新 template？
```

回答范式：
```bash
rauto templates create my_show.j2 --content "show version"
rauto templates update my_show.j2 --file ./my_show.j2
rauto templates list
```

## 5）事务块与工作流

### 示例 5.1

用户提问：
```text
我需要逐条回滚的事务块示例。
```

回答范式：
```bash
rauto tx \
  --name vlan10 \
  --command "interface vlan 10" \
  --command "ip address 10.0.10.1 255.255.255.0" \
  --rollback-command "no interface vlan 10" \
  --rollback-command "no ip address 10.0.10.1 255.255.255.0" \
  --host <host> --username <username> --password <password>
```

### 示例 5.2

用户提问：
```text
事务工作流如何先预览再执行？
```

回答范式：
```bash
rauto tx-workflow ./workflow.json --dry-run
rauto tx-workflow ./workflow.json \
  --host <host> --username <username> --password <password>
```

### 示例 5.3

用户提问：
```text
逐条回滚和整块回滚怎么选？
```

回答范式：
```text
命令可明确一一回退时优先用 per_step；
对象型资源可用单条撤销命令时用 whole_resource；
高风险变更先 dry-run/preview，再执行。
```

## 6）录制、回放与历史

### 示例 6.1

用户提问：
```text
我想录制执行过程并离线回放。
```

回答范式：
```bash
rauto exec "show version" \
  --host <host> --username <username> --password <password> \
  --record-file ~/.rauto/records/show_version.jsonl \
  --record-level key-events-only

rauto replay ~/.rauto/records/show_version.jsonl --list
rauto replay ~/.rauto/records/show_version.jsonl \
  --command "show version" --mode Enable
```

### 示例 6.2

用户提问：
```text
为什么回放里找不到命令？
```

回答范式：
```text
先用 replay --list 看录制里实际命令；
确认命令字符串完全一致；
如果加了 --mode，要确保模式也匹配。
```

## 7）Web 页面操作引导

### 示例 7.1

用户提问：
```text
给我一个 Web 上模板执行的完整流程。
```

回答范式：
```text
1）启动：rauto web --bind 127.0.0.1 --port 3000
2）打开 Operations 页签
3）切换到 Template Render + Execute
4）填写 template 与 vars JSON
5）先点 Preview Render，再点 Run Template
```

### 示例 7.2

用户提问：
```text
Web 里如何使用交互会话？
```

回答范式：
```text
进入 Interactive 页签，点击 Start Session，输入命令点 Send，结束时点 Stop Session。
```

## 8）备份与恢复

### 示例 8.1

用户提问：
```text
我想备份当前所有 rauto 数据。
```

回答范式：
```bash
rauto backup create
```

### 示例 8.2

用户提问：
```text
不指定文件名，只指定目录，自动按时间命名可以吗？
```

回答范式：
```bash
rauto backup create --output ./backup/
```

### 示例 8.3

用户提问：
```text
恢复备份有哪些安全建议？
```

回答范式：
```text
先用 merge 恢复验证；
只有在明确要覆盖当前数据时才用 --replace；
恢复后检查连接、模板、profile 是否符合预期。
```

对应命令：
```bash
# merge
rauto backup restore ~/.rauto/backups/rauto-backup-1234567890.tar.gz

# replace
rauto backup restore ~/.rauto/backups/rauto-backup-1234567890.tar.gz --replace
```
