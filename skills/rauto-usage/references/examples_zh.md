# Rauto 执行风格中文示例（examples_zh）

用于中文场景下的 action-first few-shot。  
默认输出格式：

```text
Operation: <执行了什么>
Command: <执行的 rauto 命令>
Result: <关键结果>
Notes: <风险/报错/后续动作>
```

## 目录

1. 基础执行
2. 模板执行
3. 连接配置复用
4. Profile / Template 管理
5. 事务块与工作流
6. 录制、回放与历史
7. Web 页面请求
8. 备份与恢复

## 1）基础执行

### 示例 1.1

用户提问：
```text
帮我在设备上执行一条 show 命令。
```

执行风格回答：
```text
Operation: 在目标设备直接执行命令
Command: rauto exec "show version" --host <host> --username <username> --password <password>
Result: 成功返回设备版本信息
Notes: 若失败，优先检查 SSH 端口、账号和 profile
```

### 示例 1.2

用户提问：
```text
用 Enable 模式执行。
```

执行风格回答：
```text
Operation: 在 Enable 模式执行命令
Command: rauto exec "show ip route" --host <host> --username <username> --password <password> --mode Enable
Result: 命令在 Enable 状态下执行完成
Notes: 若模式不匹配，检查 profile 的 prompt/transition 配置
```

## 2）模板执行

### 示例 2.1

用户提问：
```text
先帮我预览模板渲染结果。
```

执行风格回答：
```text
Operation: 渲染模板并仅预览
Command: rauto template show_vlan.j2 --vars ./vars.json --dry-run
Result: 成功输出渲染结果，未下发设备
Notes: 建议先确认渲染内容再执行正式下发
```

### 示例 2.2

用户提问：
```text
渲染后直接执行到设备。
```

执行风格回答：
```text
Operation: 渲染模板并执行
Command: rauto template show_vlan.j2 --vars ./vars.json --host <host> --username <username> --password <password>
Result: 模板命令已下发
Notes: 如需审计，补充录制参数 --record-file / --record-level
```

## 3）连接配置复用

### 示例 3.1

用户提问：
```text
帮我保存连接，后面用名字执行就行。
```

执行风格回答：
```text
Operation: 保存连接配置并复用
Command: rauto device add-connection lab1 --host <host> --username <username> --password <password> --ssh-port 22 --device-profile cisco
Result: 已保存连接 lab1
Notes: 复用命令：rauto exec "show version" --connection lab1
```

### 示例 3.2

用户提问：
```text
查询这个连接的历史记录。
```

执行风格回答：
```text
Operation: 查询连接历史
Command: rauto device connection-history lab1 --limit 50
Result: 返回 lab1 最近历史记录
Notes: 明细可用 connection-history-show <id>
```

## 4）Profile / Template 管理

### 示例 4.1

用户提问：
```text
把内置 cisco profile 复制成自定义。
```

执行风格回答：
```text
Operation: 复制内置 profile 到自定义 profile
Command: rauto device copy-builtin cisco my-cisco --overwrite
Result: 已生成/更新 my-cisco
Notes: 可用 rauto device show my-cisco 查看详情
```

### 示例 4.2

用户提问：
```text
帮我创建或更新一个 template。
```

执行风格回答：
```text
Operation: 创建/更新 template
Command: rauto templates create my_show.j2 --content "show version"
Result: template 已创建
Notes: 更新命令：rauto templates update my_show.j2 --file ./my_show.j2
```

## 5）事务块与工作流

### 示例 5.1

用户提问：
```text
帮我执行一个逐条回滚的事务块。
```

执行风格回答：
```text
Operation: 执行 per_step 回滚事务块
Command: rauto tx --name vlan10 --command "interface vlan 10" --command "ip address 10.0.10.1 255.255.255.0" --rollback-command "no interface vlan 10" --rollback-command "no ip address 10.0.10.1 255.255.255.0" --host <host> --username <username> --password <password>
Result: 事务块执行完成（按 per_step 策略）
Notes: 生产环境建议先 --dry-run
```

### 示例 5.2

用户提问：
```text
工作流先预览，再执行。
```

执行风格回答：
```text
Operation: 先预览后执行事务工作流
Command: rauto tx-workflow ./workflow.json --dry-run
Result: 工作流计划通过预览校验
Notes: 正式执行：rauto tx-workflow ./workflow.json --host <host> --username <username> --password <password>
```

### 示例 5.3

用户提问：
```text
逐条回滚和整块回滚怎么选？
```

执行风格回答：
```text
Operation: 回滚策略建议
Command: （无）
Result: 可逐条明确回退时用 per_step；单资源可整体撤销时用 whole_resource
Notes: 高风险变更先预览，歧义命令尽量写显式回滚
```

## 6）录制、回放与历史

### 示例 6.1

用户提问：
```text
帮我录制执行并做回放检查。
```

执行风格回答：
```text
Operation: 执行并录制，然后列出可回放项
Command: rauto exec "show version" --host <host> --username <username> --password <password> --record-file ~/.rauto/records/show_version.jsonl --record-level key-events-only
Result: 已生成录制文件
Notes: 列表检查：rauto replay ~/.rauto/records/show_version.jsonl --list
```

### 示例 6.2

用户提问：
```text
为什么回放找不到命令？
```

执行风格回答：
```text
Operation: 回放排障
Command: rauto replay ~/.rauto/records/show_version.jsonl --list
Result: 已列出录制内命令与模式，便于对比匹配
Notes: 回放时命令文本和可选模式必须一致
```

## 7）Web 页面请求

### 示例 7.1

用户提问：
```text
帮我启动 Web，并告诉我模板执行入口。
```

执行风格回答：
```text
Operation: 启动 Web 服务并给出精确路径
Command: rauto web --bind 127.0.0.1 --port 3000
Result: Web 已启动（http://127.0.0.1:3000）
Notes: 操作路径：Operations -> Template Render + Execute -> Preview Render -> Run Template
```

### 示例 7.2

用户提问：
```text
Web 里交互会话怎么跑？
```

执行风格回答：
```text
Operation: 交互会话路径说明
Command: （Web 操作）
Result: 路径：Interactive -> Start Session -> Send -> Stop Session
Notes: 启动前确保连接上下文可用
```

## 8）备份与恢复

### 示例 8.1

用户提问：
```text
立刻备份当前 rauto 数据。
```

执行风格回答：
```text
Operation: 创建全量备份
Command: rauto backup create
Result: 已在 ~/.rauto/backups 生成时间戳归档
Notes: 可用 rauto backup list 查看
```

### 示例 8.2

用户提问：
```text
我只给目录，不给文件名，自动命名备份。
```

执行风格回答：
```text
Operation: 在自定义目录创建自动命名备份
Command: rauto backup create --output ./backup/
Result: 生成 ./backup/rauto-backup-<timestamp>.tar.gz
Notes: 若 output 是文件路径，则按指定文件名保存
```

### 示例 8.3

用户提问：
```text
帮我安全恢复备份，replace 什么时候用？
```

执行风格回答：
```text
Operation: 备份恢复（merge/replace）
Command: rauto backup restore ~/.rauto/backups/rauto-backup-1234567890.tar.gz
Result: 已按 merge 模式恢复
Notes: 全量替换才用 --replace：rauto backup restore ~/.rauto/backups/rauto-backup-1234567890.tar.gz --replace
```
