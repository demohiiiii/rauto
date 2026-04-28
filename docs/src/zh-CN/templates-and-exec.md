# 模板与直接执行

`rauto` 最基础也最常用的两种能力是：

- `rauto exec`：直接执行一条命令
- `rauto template`：把模板渲染成命令后执行

## 直接执行

适合临时命令、排障命令、只执行一次的检查命令。

```bash
rauto exec "show version" \
  --connection lab1
```

如果目标需要特定模式，可以显式指定：

```bash
rauto exec "show bgp neighbor" \
  --connection lab1 \
  --mode Enable
```

### 什么时候优先用 `exec`

- 只跑一条或几条简单命令
- 命令内容不需要参数化
- 更重视快速验证而不是沉淀复用

## 模板执行

模板适合“命令结构固定，但参数会变化”的场景。

例如：

- VLAN 开通
- ACL 下发
- BGP 邻居配置
- 用户批量创建

### 基本示例

```bash
rauto template configure_vlan.j2 \
  --vars ./vars.json \
  --connection lab1
```

这里：

- `configure_vlan.j2` 是保存在 `rauto` 存储中的模板名
- `vars.json` 是模板变量文件

## 干跑模式

模板很适合先预览再执行：

```bash
rauto template configure_vlan.j2 \
  --vars ./vars.json \
  --dry-run
```

这一步通常应该成为生产变更前的固定习惯。

## 管理模板

```bash
rauto templates list
rauto templates show configure_vlan.j2
rauto templates create configure_vlan.j2 --file ./configure_vlan.j2
rauto templates update configure_vlan.j2 --file ./configure_vlan.j2
rauto templates delete configure_vlan.j2
```

模板也可以在 Web UI 中管理。

## 模板示例

一个非常简单的 Jinja 模板示意：

```jinja
vlan {{ vlan_id }}
name {{ vlan_name }}
```

变量文件：

```json
{
  "vlan_id": 120,
  "vlan_name": "STAFF"
}
```

执行后会渲染为：

```text
vlan 120
name STAFF
```

## 什么时候从 `exec` 升级到 `template`

当你满足下面任意一点时，建议转成模板：

- 同类命令要执行很多次
- 同一逻辑只是在参数上变化
- 希望减少人工拼命令的风险
- 想把执行逻辑同时复用到 CLI、Web、编排中

## 录制与审计

无论是 `exec` 还是 `template`，都支持录制：

```bash
rauto exec "show version" \
  --connection lab1 \
  --record-file ./session.jsonl \
  --record-level full
```

常用录制级别：

- `key-events-only`
- `full`

录制文件后续可以用于回放、排障和任务审计。

## 建议实践

- 一次性命令优先用 `exec`
- 会重复执行的配置逻辑尽早模板化
- 生产执行前优先 `--dry-run`
- 对重要操作开启录制

## 下一步

继续阅读：

- [命令流与文件上传](./flows-and-upload.md)
- [事务、工作流与编排](./transactions-and-orchestration.md)
