# Web 与 Agent 模式

`rauto` 同时提供两种服务形态：

- `rauto web`
- `rauto agent`

它们看起来都能启动 HTTP 服务，但职责并不相同。

## `rauto web`：本地自助控制台

启动方式：

```bash
rauto web --bind 127.0.0.1 --port 3000
```

访问：

```text
http://127.0.0.1:3000
```

### 主要能力

- Saved Connections 管理
- Template / Flow Template 管理
- Prompt Profile 管理与诊断
- Inventory 的分组与标签管理
- 命令、模板、命令流、事务、工作流、编排执行
- 黑名单管理
- 备份与恢复
- 录制与回放

## `rauto agent`：托管代理

启动方式：

```bash
rauto agent \
  --bind 0.0.0.0 \
  --port 8123 \
  --manager-url http://manager:50051 \
  --report-mode grpc \
  --agent-name agent-beijing-01 \
  --agent-token my-secret-token \
  --probe-report-interval 300
```

也可以把默认值写入：

```toml
[manager]
url = "http://manager:50051"
token = "my-secret-token"
report_mode = "grpc"

[agent]
name = "agent-beijing-01"
heartbeat_interval = 30
probe_report_interval = 300
```

### Agent 提供的能力

- 向 manager 注册与心跳
- 上报设备状态与 Inventory
- 执行 manager 下发的任务
- 回传任务事件、任务回调和错误信息
- 通过 token 保护浏览器/API 访问

## 两者职责边界

- `web`：本地 UI 控制台
- `agent`：接入统一平台的执行节点

## UI 差异

当前前端也区分了本地 web 模式与 agent 模式：

- 一些仅与托管任务相关的入口只在 agent 模式显示
- 本地 web 模式更偏向自助管理与执行

## 建议实践

- 单机自用或实验环境优先用 `rauto web`
- 平台化接入时再上 `rauto agent`
- agent 启动后务必配置 token 与 manager 地址
- 对外暴露 agent 时优先放在受控网络环境中

## 下一步

继续阅读：

- [Inventory、历史与运维能力](./inventory-and-operations.md)
