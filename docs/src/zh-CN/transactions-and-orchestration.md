# 事务、工作流与编排

这一章是 `rauto` 的核心进阶能力。

可以把它们理解为三层抽象：

- `tx`：单设备上的一个事务块
- `tx-workflow`：单设备上的多个事务块组成的工作流
- `orchestrate`：跨多设备、分阶段执行的发布编排

## `tx`：单块事务

适合：

- 一次变更由少量步骤组成
- 希望为每一步定义回滚逻辑
- 或者希望在失败时执行统一资源回滚

### 示例：按步骤回滚

```bash
rauto tx \
  --name vlan-change \
  --command "vlan 120" \
  --command "name campus-users" \
  --rollback-command "no vlan 120" \
  --rollback-command "default name" \
  --rollback-on-failure \
  --mode Config \
  --connection core-01
```

### 示例：命令流驱动事务

```bash
rauto tx \
  --run-kind command-flow \
  --flow-template cisco_like_copy \
  --flow-vars ./flow-vars.json \
  --rollback-flow-file ./rollback-flow.toml \
  --connection core-01
```

### 常用参数

- `--dry-run`：只看规范化后的执行计划
- `--json`：输出 JSON 结果
- `--record-file` / `--record-level`：保留录制

## `tx-workflow`：结构化事务工作流

当一个变更包含多个块，并且每个块都有独立的失败策略和回滚策略时，建议使用 `tx-workflow`。

### 查看或预演工作流

```bash
rauto tx-workflow ./workflow.json --view
rauto tx-workflow ./workflow.json --dry-run
rauto tx-workflow ./workflow.json --dry-run --json
```

### 执行工作流

```bash
rauto tx-workflow ./workflow.json \
  --connection core-01
```

## `orchestrate`：多设备编排

当同一变更需要在多台设备上按阶段、串行或并行执行时，就应该用 `orchestrate`。

### 常见命令

```bash
rauto orchestrate ./orchestration.json --view
rauto orchestrate ./orchestration.json --dry-run
rauto orchestrate ./orchestration.json --record-level full
rauto orchestrate ./orchestration.json --json
```

## 三者怎么选

### 用 `tx`

当你满足以下特点时：

- 单设备
- 步骤不多
- 希望直接在命令行组织执行

### 用 `tx-workflow`

当你满足以下特点时：

- 单设备
- 结构比 `tx` 更复杂
- 希望用 JSON 文件沉淀执行模型

### 用 `orchestrate`

当你满足以下特点时：

- 多设备
- 多阶段
- 存在串行/并行/分组执行策略

## 与 Inventory 的关系

`orchestrate` 可以结合 Inventory 文件或 Inventory 分组进行目标选择。

## 建议实践

- 先用 `tx --dry-run` 验证单设备动作
- 再把稳定的逻辑沉淀成 `tx-workflow`
- 多设备推广时再上升到 `orchestrate`
- 对重要发布开启 `--record-level full`
- 先在实验环境演练回滚逻辑，再上生产

## 下一步

继续阅读：

- [Web 与 Agent 模式](./web-and-agent.md)
- [Inventory、历史与运维能力](./inventory-and-operations.md)
