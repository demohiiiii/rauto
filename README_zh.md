<div align="center">

# rauto

**AI 时代操控网络设备的双手**

[![Crates.io](https://img.shields.io/crates/v/rauto.svg)](https://crates.io/crates/rauto)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![官网](https://img.shields.io/badge/%E5%AE%98%E7%BD%91-rauto.top-0ea5e9?style=for-the-badge&logo=googlechrome&logoColor=white)](https://rauto.top)

[官网](https://rauto.top) · [English Documentation](README.md)

</div>

`rauto` 是一个用 Rust 编写的网络自动化工具集，提供 CLI、Web 和 agent API 三种操作入口，用于统一操作各类网络设备。它基于 [rneter](https://github.com/demohiiiii/rneter) 处理 SSH 会话连接，基于 [minijinja](https://github.com/mitsuhiko/minijinja) 实现命令模板渲染，为网络工程师、自动化开发者以及 AI 驱动的网络控制场景提供简单、高性能、可扩展的设备访问、事务执行和多设备编排能力。

## 快速开始

```bash
cargo install rauto
rauto exec "show version" --host 192.168.1.1 --username admin --password '******'
rauto web --bind 127.0.0.1 --port 3000
```

## 目录导航

- [功能特性](#功能特性)
- [安装](#安装)
- [Codex Skill（可选）](#codex-skill可选)
- [使用方法](#使用方法)
  - [模板模式（推荐）](#1-模板模式推荐)
  - [直接执行](#2-直接执行)
  - [设备配置模板](#3-设备配置模板)
  - [Web 控制台（Axum）](#4-web-控制台axum)
  - [Template 存储管理命令](#5-template-存储管理命令)
  - [已保存连接配置](#6-已保存连接配置)
  - [数据备份与恢复](#7-数据备份与恢复)
  - [命令黑名单](#8-命令黑名单)
  - [CLI 速查表](#9-cli-速查表)
- [目录结构](#目录结构)
- [配置选项](#配置选项)
- [模板语法](#模板语法)
- [贡献代码](#贡献代码)
- [许可证](#许可证)

## 功能特性

- **双层模板系统**：命令模板 (Jinja2) 与 设备配置模板 (TOML)。
- **智能连接处理**：使用 `rneter` 管理 SSH 会话状态。
- **Dry Run 支持**：在执行前预览命令。
- **变量注入**：从 JSON 文件加载变量。
- **可扩展性**：支持自定义 TOML 设备配置。
- **内置 Web 控制台**：通过 `rauto web` 启动浏览器页面。
- **内嵌静态资源**：发布二进制时前端资源已打包到可执行文件中。
- **连接配置档复用**：支持按名称保存/加载连接参数。
- **会话录制与回放**：支持将 SSH 会话录制为 JSONL 并离线回放。
- **数据备份与恢复**：支持对 `~/.rauto` 运行数据做全量备份与恢复。
- **多设备编排执行（Web + CLI）**：支持基于计划文件对多台设备分阶段串行/并发执行，并复用现有 `tx` / `tx-workflow` 能力。
- **命令黑名单**：支持在命令真正下发前做全局拦截，并支持 `*` 通配符。

## 安装

### 二进制文件安装（推荐）

从 [GitHub Releases](https://github.com/demohiiiii/rauto/releases) 下载适用于您平台的最新版本。

### 通过 Crates.io 安装

```bash
cargo install rauto
```

### 源码安装

确保你已经安装了 Rust 和 Cargo。

```bash
git clone https://github.com/demohiiiii/rauto.git
cd rauto
cargo build --release
```

编译后的二进制文件位于 `target/release/rauto`。

## Codex Skill（可选）

本仓库包含 rauto 使用 skill，位于 `skills/rauto-usage/`。

推荐用法：

- 如果你是通过 Codex 或 Claude Code 来操作 `rauto`，优先安装并使用这个 skill。
- 这个 skill 是“直接执行优先”的：读操作会直接运行对应 `rauto` 命令；变更操作会优先走 `tx` / `tx-workflow`，并优先做回滚设计或 `--dry-run`。
- 返回结果也会更聚焦，通常只给你关键结论、执行命令和后续建议。

### 安装到本机

1. 拉取代码：

```bash
git clone https://github.com/demohiiiii/rauto.git
```

2. 复制 skill 到本机的 Codex skills 目录：

```bash
cp -R rauto/skills/rauto-usage "$CODEX_HOME/skills/"
```

说明：

- 如果未设置 `CODEX_HOME`，通常默认是 `~/.codex`。
- 可检查 `$CODEX_HOME/skills/rauto-usage` 是否存在。

### 推荐提示词

你可以显式通过 `$rauto-usage` 调用这个 skill，例如：

```text
使用 $rauto-usage 测试已保存连接 lab1，并执行 "show version"。
使用 $rauto-usage 先预览 templates/examples/fabric-advanced-orchestration.json，再等我确认后执行。
使用 $rauto-usage 查看 lab1 的连接历史，只总结失败项。
使用 $rauto-usage 渲染 configure_vlan.j2，变量文件用 templates/example_vars.json，并先 dry-run。
```

如果你的 agent 支持自动路由 skill，直接自然描述需求通常也可以：

```text
在我保存的连接 lab1 上执行一个 show 命令。
帮我预览这个 tx workflow，并说明回滚策略。
帮我检查 core-01 最近的执行历史，只看报错。
```

### Claude Code 示例

如果你使用 Claude Code skills，请将目录复制到 Claude Code 的 skills 路径：

```bash
cp -R rauto/skills/rauto-usage ~/.claude/skills/
```

`~/.claude/skills/` 通常是 Claude Code 的个人 skills 路径；如果你的本地配置使用的是别的目录，就复制到对应目录即可。

## 使用方法

### 1. 模板模式（推荐）

从模板渲染命令并在设备上执行。
模板内容保存在 SQLite 中，可通过 `rauto templates` 或 Web UI 管理。

**基本用法：**

```bash
rauto template show_version.j2 \
    --host 192.168.1.1 \
    --username admin \
    --password secret \
    --ssh-port 22
```

**使用变量：**
假设已经保存了一个模板 `configure_vlan.j2`，并有变量文件 `templates/example_vars.json`：

```bash
rauto template configure_vlan.j2 \
    --vars templates/example_vars.json \
    --host 192.168.1.1 \
    --username admin \
    --password secret \
    --ssh-port 22
```

**Dry Run（预览）：**

```bash
rauto template configure_vlan.j2 \
    --vars templates/example_vars.json \
    --dry-run
```

### 2. 直接执行

直接执行原始命令，无需模板。

```bash
rauto exec "show ip int br" \
    --host 192.168.1.1 \
    --username admin \
    --password secret \
    --ssh-port 22
```

**指定执行模式：**
在特定模式下执行命令（例如 `Enable`, `Config`）。

```bash
rauto exec "show bgp neighbor" \
    --host 192.168.1.1 \
    --username admin \
    --password secret \
    --ssh-port 22 \
    --mode Enable
```

### 3. 设备配置模板

`rauto` 支持内置的设备配置（继承自 `rneter`）和自定义 TOML 配置。

当前 `rneter 0.3.2` 提供的内置 profile 包括：

- 网络设备厂商：`cisco`、`huawei`、`h3c`、`hillstone`、`juniper`、`array`、`arista`、`fortinet`、`paloalto`、`topsec`、`venustech`、`dptech`、`chaitin`、`qianxin`、`maipu`、`checkpoint`
- 服务器：`linux`

**列出可用配置：**

```bash
rauto device list
```

**使用特定配置：**
默认为 `cisco`。要使用 Huawei VRP：

```bash
rauto template show_ver.j2 \
    --host 192.168.1.1 \
    --username admin \
    --password secret \
    --ssh-port 22 \
    --device-profile huawei
```

**使用 Linux profile：**

```bash
rauto exec "systemctl status sshd" \
    --host 192.168.1.10 \
    --username admin \
    --password secret \
    --ssh-port 22 \
    --device-profile linux
```

**自定义设备配置：**
自定义设备 profile 现在保存在 SQLite 中，通过 `rauto device` 或 Web UI 管理。

创建或复制后可直接这样使用：

```bash
rauto exec "show ver" \
    --host 192.168.1.1 \
    --username admin \
    --password secret \
    --ssh-port 22 \
    --device-profile custom_cisco
```

**常用 profile 管理命令：**

```bash
rauto device list
rauto device show cisco
rauto device show linux
rauto device copy-builtin cisco my_cisco
rauto device delete-custom my_cisco
rauto connection test \
    --host 192.168.1.1 \
    --username admin \
    --password secret \
    --ssh-port 22
```

说明：

- `rauto device list` 会跟随当前 `rneter` 暴露的内置模板目录。
- `rauto device show <builtin>` 和 `rauto device copy-builtin <builtin> <custom>` 都会基于当前 `rneter` 导出的内置 handler 配置工作。

### 4. Web 控制台（Axum）

启动内置 Web 服务，并在浏览器中打开可视化页面：

```bash
rauto web \
    --bind 127.0.0.1 \
    --port 3000 \
    --host 192.168.1.1 \
    --username admin \
    --password secret \
    --ssh-port 22
```

然后访问 `http://127.0.0.1:3000`。

Web 静态资源在构建时会嵌入二进制。  
对于发布后的可执行文件，运行时不再依赖本地 `static/` 目录。

Web 控制台主要能力：

- 在页面中管理连接配置：新增、加载、更新、删除、查看详情。
- 在页面连接参数和已保存连接中选择 SSH 安全档位：`secure`、`balanced`、`legacy-compatible`。
- 基于已保存连接执行命令（先加载连接，再选择直接执行或模板渲染执行）。
- 分页管理 profile（内置/自定义）与 template。
- 在页面中管理命令黑名单：新增、删除、校验带 `*` 通配符的规则。
- 在页面中管理数据备份：创建/列出/下载/恢复 `~/.rauto` 备份归档。
- 在 Prompt 管理 -> 诊断页里可视化查看 profile 状态机诊断结果。
- 支持中英文界面切换。
- 支持执行录制与浏览器内回放（可列出事件，或按命令/模式回放）。

#### Agent 模式

现在 `rauto web` 保持为本地自管的 UI。需要连接 `rauto-manager`、注册心跳和受保护 API 时，改用专门的 `rauto agent` 启动。

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

也可以把默认配置放到 `~/.rauto/agent.toml`：

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

Agent 模式新增能力：

- 公开 `GET /api/agent/info`，用于 Manager 做可达性检查和发现。
- 受保护的 `GET /api/agent/status`，用于查看运行状态和心跳时间。
- 受保护的 `POST /api/devices/probe`，用于批量探测已保存连接的 TCP 可达性。
- 在同一个 agent 端口上额外暴露 gRPC 任务服务：`rauto.agent.v1.AgentTaskService`。
- 启动后后台自动注册、定时心跳，以及退出时尽力发送离线通知。
- 对 manager 的上报支持两种传输方式：
- `grpc`（默认）：通过 `rauto.manager.v1.AgentReportingService` 上报，适合 manager 可以暴露 gRPC 端口的场景。
- `http`：通过 manager 的 HTTP 接口上报，适合只暴露 HTTP(S) 的部署形态，比如 Vercel 这一类环境。
- 在注册成功后和已保存连接变更时，会自动做设备清单全量同步，只同步 `name`、`host`、`port`、`device_profile`。
- 按周期存活探测刷新时，会做状态增量更新（`probe_report_interval` 默认 `300` 秒，设为 `0` 可关闭）。
- agent 模式下只传 `task_id` 也可以启用异步任务事件和任务回调；这两类上报都会通过当前选择的上报模式回传给 `rauto-manager`。
- 从 `rneter 0.3.3` 开始，Linux 场景下的命令执行可能返回 `exit_code`；`exec` / `interactive` 响应、模板逐条执行结果以及任务事件详情现在都会在可用时携带它。
- 事务结果现在会包含逐步级别的 `step_results`，manager 在处理最终回调时可以直接拿到每一步的执行/回滚状态，而不只看块级成功失败。
- 受管任务接口另外提供了给 manager 调用的 HTTP 异步入口：
- `POST /api/exec/async`
- `POST /api/template/execute/async`
- `POST /api/tx/block/async`
- `POST /api/tx/workflow/async`
- `POST /api/orchestrate/async`
- 这些异步接口要求运行在 agent 模式下，并且请求中带非空 `task_id`；接口会立即返回 `202 Accepted`，后续执行结果仍通过现有的任务事件和任务回调链路回传。
- 同一个 agent 端口也暴露了下面这些 gRPC 任务方法：
- `GetAgentInfo`
- `GetAgentStatus`
- `ProbeDevices`
- `ExecuteCommand`
- `ExecuteTemplate`
- `ExecuteTxBlock`
- `ExecuteTxBlockAsync`
- `ExecuteTxWorkflowAsync`
- `ExecuteOrchestrationAsync`
- `exec`、`template_execute`、`tx_block` 走同步 gRPC 方法。
- `tx_block` 也额外提供异步 gRPC 方法，方便 manager 走立即接受、后台执行的模式。
- `tx_workflow` 和 `orchestrate` 仍然只保留异步方法，因为这两类任务通常耗时较长。
- 配置 token 时，对 manager 的外呼会同时带上 `Authorization: Bearer <token>` 和 `X-API-Key: <token>`。
- 如果 agent 模式启动时配置了 token，浏览器中的 Web UI 请求也需要在页面头部填写同一个 token。

### 5. Template 存储管理命令

```bash
rauto templates list
rauto templates show show_version.j2
rauto templates delete show_version.j2
```

### 6. 已保存连接配置

你可以按名称保存并复用连接参数：

```bash
# 直接通过命令参数新增/更新连接配置
rauto connection add lab1 \
    --host 192.168.1.1 \
    --username admin \
    --ssh-port 22 \
    --ssh-security balanced \
    --device-profile cisco

# 复用已保存配置执行命令
rauto exec "show version" --connection lab1

# 在成功连接后保存当前有效配置
rauto connection test \
    --connection lab1 \
    --save-connection lab1_backup

# 管理已保存配置
rauto connection list
rauto connection show lab1
rauto connection delete lab1
rauto history list lab1 --limit 20
```

密码保存规则：

- 在 `exec/template/connection test` 中使用 `--save-connection` 时，默认不保存密码；加上 `--save-password` 才会保存密码字段。
- 使用 `connection add` 时，仅当显式传入 `--password` / `--enable-password` 才会保存密码字段。
- 已保存密码会加密后写入 `~/.rauto/rauto.db`；本地解密密钥保存在 `~/.rauto/master.key` 中。
- `--ssh-security <secure|balanced|legacy-compatible>` 用于控制 SSH 算法兼容档位，并会一起保存到连接配置中。

### 7. 数据备份与恢复

备份当前 `rauto` 的运行时数据存储和备份配置：

注意：备份归档会同时包含 `rauto.db` 和 `master.key`，因此恢复备份时也会恢复已保存连接的密码。

```bash
# 备份到默认路径：~/.rauto/backups/rauto-backup-<timestamp>.tar.gz
rauto backup create

# 备份到自定义路径
rauto backup create --output ./rauto-backup.tar.gz

# 列出默认备份目录
rauto backup list

# 恢复备份（合并到当前 ~/.rauto）
rauto backup restore ./rauto-backup.tar.gz

# 恢复前先替换当前 ~/.rauto
rauto backup restore ./rauto-backup.tar.gz --replace
```

### 8. 命令黑名单

可以使用全局黑名单，在命令真正发送到设备前拒绝执行。CLI 和 Web 的执行链路都会生效，包括 `exec`、模板执行、`tx`、`tx-workflow`、`orchestrate` 和 interactive command。

```bash
# 查看当前黑名单
rauto blacklist list

# 添加黑名单模式
rauto blacklist add "write erase"
rauto blacklist add "reload*"
rauto blacklist add "format *"

# 检查某条命令是否会命中黑名单
rauto blacklist check "reload in 5"

# 删除模式
rauto blacklist delete "reload*"
```

说明：

- `*` 可以匹配任意长度字符，也包括空格。
- 匹配不区分大小写，并且按整条命令文本匹配。
- 黑名单数据保存在 `~/.rauto/rauto.db` 中。

### 9. CLI 速查表

**连接排障**

```bash
rauto connection test \
    --host 192.168.1.1 \
    --username admin \
    --password secret \
    --ssh-port 22
```

**连接配置档**

```bash
rauto connection add lab1 \
    --host 192.168.1.1 \
    --username admin \
    --ssh-port 22 \
    --device-profile cisco
rauto exec "show version" --connection lab1
rauto connection list
rauto history list lab1 --limit 20
```

**命令黑名单**

```bash
rauto blacklist add "reload*"
rauto blacklist add "write erase"
rauto blacklist list
rauto blacklist check "reload in 5"
```

**Profile 管理**

```bash
rauto device list
rauto device show cisco
rauto device copy-builtin cisco my_cisco
rauto device show my_cisco
rauto device delete-custom my_cisco
```

**Template 存储管理**

```bash
rauto templates list
rauto templates show show_version.j2
rauto templates delete show_version.j2
```

**会话录制与回放**

```bash
# 录制直接执行
rauto exec "show version" \
    --host 192.168.1.1 \
    --username admin \
    --password secret \
    --record-file ~/.rauto/records/show_version.jsonl \
    --record-level full

# 录制模板执行
rauto template show_version.j2 \
    --host 192.168.1.1 \
    --username admin \
    --password secret \
    --record-file ~/.rauto/records/template_run.jsonl \
    --record-level key-events-only

# 回放 / 查看
rauto replay ~/.rauto/records/show_version.jsonl --list
rauto replay ~/.rauto/records/show_version.jsonl --command "show version" --mode Enable
```

**数据备份与恢复**

```bash
rauto backup create
rauto backup list
rauto backup restore ~/.rauto/backups/rauto-backup-1234567890.tar.gz --replace
```

**事务块执行**

```bash
# 自动推断逐条回滚
rauto tx \
    --command "interface vlan 10" \
    --command "ip address 10.0.10.1 255.255.255.0" \
    --host 192.168.1.1 \
    --username admin \
    --password secret

# 显式逐条回滚（重复参数）
rauto tx \
    --command "interface vlan 10" \
    --command "ip address 10.0.10.1 255.255.255.0" \
    --rollback-command "no interface vlan 10" \
    --rollback-command "no ip address 10.0.10.1 255.255.255.0" \
    --host 192.168.1.1 \
    --username admin \
    --password secret

# 从文件读取逐条回滚（每行一条，空行会忽略）
rauto tx \
    --command "interface vlan 10" \
    --command "ip address 10.0.10.1 255.255.255.0" \
    --rollback-commands-file ./rollback.txt \
    --host 192.168.1.1 \
    --username admin \
    --password secret

# 从 JSON 数组读取逐条回滚
rauto tx \
    --command "interface vlan 10" \
    --command "ip address 10.0.10.1 255.255.255.0" \
    --rollback-commands-json ./rollback.json \
    --host 192.168.1.1 \
    --username admin \
    --password secret

# 整块回滚
rauto tx \
    --command "vlan 10" \
    --resource-rollback-command "no vlan 10" \
    --host 192.168.1.1 \
    --username admin \
    --password secret
```

**事务工作流**

```bash
# 终端可视化查看工作流结构（默认启用 ANSI 颜色）
# 如需关闭颜色：NO_COLOR=1
rauto tx-workflow ./workflow.json --view

# 执行 JSON 工作流
rauto tx-workflow ./workflow.json \
    --host 192.168.1.1 \
    --username admin \
    --password secret

# 仅预览：默认打印可视化流程并退出
rauto tx-workflow ./workflow.json --dry-run

# 仅预览原始 JSON
rauto tx-workflow ./workflow.json --dry-run --json
```

**事务工作流 JSON 示例**

```json
{
  "name": "fw-policy-publish",
  "fail_fast": true,
  "blocks": [
    {
      "name": "addr-objects",
      "kind": "config",
      "fail_fast": true,
      "rollback_policy": "per_step",
      "steps": [
        {
          "mode": "Config",
          "command": "address-book global address WEB01 10.0.10.1/32",
          "timeout_secs": 10,
          "rollback_command": "delete address-book global address WEB01"
        }
      ]
    },
    {
      "name": "policy",
      "kind": "config",
      "fail_fast": true,
      "rollback_policy": {
        "whole_resource": {
          "mode": "Config",
          "undo_command": "delete security policies from-zone trust to-zone untrust policy allow-web",
          "timeout_secs": 10
        }
      },
      "steps": [
        {
          "mode": "Config",
          "command": "set security policies from-zone trust to-zone untrust policy allow-web match source-address WEB01",
          "timeout_secs": 10,
          "rollback_command": null
        }
      ]
    }
  ]
}
```

可直接改的示例文件：

- [templates/examples/core-vlan-workflow.json](/Users/adam/Project/rauto-all/rauto/templates/examples/core-vlan-workflow.json)

更复杂的示例文件：

- [templates/examples/fabric-change-workflow.json](/Users/adam/Project/rauto-all/rauto/templates/examples/fabric-change-workflow.json)

**多设备编排**

```bash
# 终端中预览编排结构
rauto orchestrate ./orchestration.json --view

# Dry-run：打印标准化计划后退出
rauto orchestrate ./orchestration.json --dry-run

# 执行多设备计划
rauto orchestrate ./orchestration.json --record-level full

# 以 JSON 输出执行结果
rauto orchestrate ./orchestration.json --json
```

**编排计划 JSON 示例**

```json
{
  "name": "campus-vlan-rollout",
  "fail_fast": true,
  "stages": [
    {
      "name": "core",
      "strategy": "serial",
      "targets": ["core-01", "core-02"],
      "action": {
        "kind": "tx_workflow",
        "workflow_file": "./workflows/core-vlan.json"
      }
    },
    {
      "name": "access",
      "strategy": "parallel",
      "max_parallel": 10,
      "targets": [
        {
          "connection": "sw-01",
          "vars": {
            "hostname": "sw-01"
          }
        },
        {
          "connection": "sw-02",
          "vars": {
            "hostname": "sw-02"
          }
        }
      ],
      "action": {
        "kind": "tx_block",
        "name": "access-vlan",
        "template": "configure_vlan.j2",
        "mode": "Config",
        "vars": {
          "vlans": [
            {
              "id": 120,
              "name": "STAFF"
            }
          ]
        }
      }
    }
  ]
}
```

**Inventory + 分组示例**

```json
{
  "name": "campus-vlan-rollout",
  "inventory_file": "./inventory.json",
  "stages": [
    {
      "name": "core",
      "strategy": "serial",
      "target_groups": ["core"],
      "action": {
        "kind": "tx_workflow",
        "workflow_file": "./workflows/core-vlan.json"
      }
    },
    {
      "name": "access",
      "strategy": "parallel",
      "max_parallel": 20,
      "target_groups": ["access"],
      "action": {
        "kind": "tx_block",
        "template": "configure_vlan.j2",
        "mode": "Config",
        "vars": {
          "vlans": [
            {
              "id": 120,
              "name": "STAFF"
            }
          ]
        }
      }
    }
  ]
}
```

```json
{
  "defaults": {
    "username": "ops",
    "port": 22,
    "vars": {
      "tenant": "campus"
    }
  },
  "groups": {
    "core": ["core-01", "core-02"],
    "access": {
      "defaults": {
        "username": "admin",
        "port": 22,
        "device_profile": "huawei",
        "vars": {
          "site": "campus-a",
          "region": "east"
        }
      },
      "targets": [
        { "connection": "sw-01", "vars": { "hostname": "sw-01" } },
        { "connection": "sw-02", "vars": { "hostname": "sw-02" } }
      ]
    }
  }
}
```

可直接改的示例文件：

- [templates/examples/campus-vlan-orchestration.json](/Users/adam/Project/rauto-all/rauto/templates/examples/campus-vlan-orchestration.json)
- [templates/examples/campus-inventory.json](/Users/adam/Project/rauto-all/rauto/templates/examples/campus-inventory.json)

更复杂的示例文件：

- [templates/examples/fabric-advanced-orchestration.json](/Users/adam/Project/rauto-all/rauto/templates/examples/fabric-advanced-orchestration.json)
- [templates/examples/fabric-advanced-inventory.json](/Users/adam/Project/rauto-all/rauto/templates/examples/fabric-advanced-inventory.json)

说明：

- `targets` 可以直接引用已保存连接名，也可以写内联连接字段。
- `target_groups` 可以从 `inventory_file` 或内联 `inventory.groups` 加载目标列表。
- `inventory.defaults` 会作用到所有分组和阶段内联 `targets`；group 的 `defaults` 会覆盖 inventory 默认值。
- `tx_block` 阶段会复用现有模板/回滚能力，并支持按目标覆盖 `vars`。
- `tx_workflow` 阶段会直接复用现有单设备工作流 JSON。
- 多设备编排当前已同时支持 Web UI 与 CLI。

**CLI 与 Web UI 对应关系**

```text
Web 操作界面                   CLI
------------------------------ ---------------------------------------------
直接执行命令                   rauto exec
模板渲染并执行                 rauto template
事务块执行                     rauto tx
事务工作流                     rauto tx-workflow
多设备编排执行                 rauto orchestrate
连接配置管理                   rauto connection
连接历史查看                   rauto history
命令黑名单                     rauto blacklist

Prompt 管理                    CLI
------------------------------ ---------------------------------------------
内置 profile                   rauto device list / rauto device show <name>
复制内置到自定义               rauto device copy-builtin <builtin> <custom>
自定义 profile 管理            rauto device show/delete <custom>

Template 管理                  CLI
------------------------------ ---------------------------------------------
列出模板                       rauto templates list
查看模板                       rauto templates show <name>
删除模板                       rauto templates delete <name>

会话回放                        CLI
------------------------------ ---------------------------------------------
列出记录                       rauto replay <jsonl> --list
回放命令                       rauto replay <jsonl> --command "<cmd>" [--mode <Mode>]
```

**功能差异**

```text
功能                                      Web UI  CLI
----------------------------------------- ------- ----
连接配置增删改查                          Yes     Yes
执行历史浏览                              Yes     Yes (按文件)
会话录制（自动）                          Yes     Yes
会话回放列表/查看                          Yes     Yes
回放表格/详情抽屉                          Yes     No
Prompt profile 诊断页面                    Yes     No
工作流构建器（可视化）                      Yes     No
事务工作流 JSON 执行                       Yes     Yes
多设备编排计划 JSON 执行                   Yes     Yes
命令黑名单管理                              Yes     Yes
```

**迁移提示（Web ⇄ CLI）**

```text
工作流构建器 → CLI
  1. Web 中进入事务工作流，点击“生成 JSON”。
  2. 更多操作 → 下载 JSON。
  3. CLI 执行：rauto tx-workflow ./workflow.json

事务块逐条回滚 → CLI
  1. Web 选择“自定义逐条回滚”。
  2. 选择“文本”，复制回滚行。
  3. CLI 执行：rauto tx --rollback-commands-file ./rollback.txt ...（顺序一致）

CLI 录制 → Web 回放
  1. CLI 使用 --record-file 生成 JSONL。
  2. Web → 会话回放，粘贴 JSONL 查看。
```

**启动 Web 控制台**

```bash
rauto web \
    --bind 127.0.0.1 \
    --port 3000
```

## 目录结构

默认情况下，`rauto` 将运行时数据存储在 `~/.rauto/` 下。

默认运行时数据：

- `~/.rauto/rauto.db`（已保存连接、历史录制、黑名单、自定义设备 profile、托管模板）
- `~/.rauto/backups`（备份归档）

启动时会自动创建 `~/.rauto` 和 `~/.rauto/backups`。

```
~/.rauto
├── rauto.db                # SQLite 运行时数据存储
└── backups/                # 备份归档 (*.tar.gz)
```

## 配置选项

| 参数                | 环境变量         | 描述                                                    |
| ------------------- | ---------------- | ------------------------------------------------------- |
| `--host`            | -                | 设备主机名或 IP                                         |
| `--username`        | -                | SSH 用户名                                              |
| `--password`        | `RAUTO_PASSWORD` | SSH 密码                                                |
| `--enable-password` | -                | Enable/Secret 密码                                      |
| `--ssh-port`        | -                | SSH 端口 (默认: 22)                                     |
| `--ssh-security`    | -                | SSH 安全档位：`secure`、`balanced`、`legacy-compatible` |
| `--device-profile`  | -                | 设备类型/profile（默认：`cisco`；例如：`huawei`、`linux`、`fortinet`） |
| `--connection`      | -                | 按名称加载已保存连接配置                                |
| `--save-connection` | -                | 成功连接后保存当前有效连接配置                          |
| `--save-password`   | -                | 配合 `--save-connection` 使用时保存密码/enable_password |

录制/回放相关参数（命令级参数）：

- `exec/template --record-file <path>`：执行后保存录制 JSONL。
- `exec/template --record-level <off|key-events-only|full>`：录制粒度。
- `replay <record_file> --list`：列出录制中的命令输出事件。
- `replay <record_file> --command <cmd> [--mode <mode>]`：回放单条命令输出。
- 在 `rneter 0.3.3` 下，回放得到的 `SessionEvent::CommandOutput` 可能额外包含 `exit_code`，尤其适用于 Linux shell 类流程。

## 模板语法

`rauto` 使用 Minijinja，它与 Jinja2 兼容。

**示例 `configure_vlan.j2`：**

```jinja
conf t
{% for vlan in vlans %}
vlan {{ vlan.id }}
 name {{ vlan.name }}
{% endfor %}
end
```

**示例变量：**

```json
{
  "vlans": [
    { "id": 10, "name": "市场部" },
    { "id": 20, "name": "工程部" }
  ]
}
```

## 贡献代码

欢迎贡献代码！请随时提交 Pull Request。

1. Fork 本仓库
2. 创建你的特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交你的更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 提交 Pull Request

## 许可证

MIT
