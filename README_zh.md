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

# 现在默认使用 linux profile
rauto exec "uname -a" --host 192.168.1.10 --username root --password '******'

# 如果要连接 Cisco 这类网络设备，显式指定 cisco profile
rauto exec "show version" --host 192.168.1.1 --username admin --password '******' --device-profile cisco

rauto web --bind 127.0.0.1 --port 3000
```

## 目录导航

- [功能特性](#功能特性)
- [安装](#安装)
- [使用方法](#使用方法)
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
- **可复用命令流程模板**：支持把向导式 CLI 交互保存为可复用模板，用来执行设备侧文件传输、安装向导、功能确认等多步交互流程。
- **SFTP 上传**：支持将本地文件直接上传到暴露 `sftp` 子系统的 SSH 主机。
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

本仓库包含一个 `skills/rauto-usage/`，适合在 Codex 或 Claude Code 中配合 `rauto` 使用。

安装方式：

```bash
cp -R rauto/skills/rauto-usage "$CODEX_HOME/skills/"
```

如果你使用 Claude Code，通常可复制到 `~/.claude/skills/`。

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

### 命令流程模板

`rauto flow` 用来执行已保存或临时提供的交互式 `CommandFlow` 模板。这是更通用的一层能力，适合处理向导式 CLI 交互，例如设备侧文件传输、安装步骤选择、功能确认提示等。

管理已保存模板：

```bash
rauto flow-template list
rauto flow-template show cisco_like_copy
rauto flow-template create cisco_like_copy --file ./templates/examples/cisco-like-command-flow.toml
rauto flow-template update cisco_like_copy --file ./my-flow-template.toml
rauto flow-template delete cisco_like_copy
```

执行已保存模板，并传入运行时变量：

```bash
rauto flow \
    --template cisco_like_copy \
    --vars-json '{"protocol":"scp","direction":"to_device","server_addr":"192.168.1.50","remote_path":"/images/new.bin","device_path":"flash:/new.bin","transfer_username":"backup","transfer_password":"secret"}' \
    --connection core-01
```

说明：

- `rauto flow` 是 CLI 里执行交互式命令流程的推荐入口。
- 已保存的命令流程模板存放在 SQLite 中，CLI 和 Web 共用同一套模板。
- 命令流程模板现在直接遵循 `rneter 0.4.0` 的结构化 `CommandFlowTemplate` 模型，不再使用之前那套临时字符串模板形态。
- 命令流程模板现在可以声明 `vars` 列表，支持 `name`、`type`、`required`、`default`、`options`、`label`、`description` 等字段，便于运行时校验变量，也便于 Web 自动渲染输入表单。
- 运行时变量会同时注入到模板顶层字段和 `vars` 嵌套对象中。
- 如果某个步骤没有显式写 `mode`，`rauto` 会使用设备 profile 定义的第一个状态。
- `--record-level` 和 `--record-file` 的行为与其他 CLI 执行命令一致。

可直接修改的示例模板：

- [templates/examples/cisco-like-command-flow.toml](templates/examples/cisco-like-command-flow.toml)

### SFTP 上传

`rauto upload` 和使用内置文件传输模板的 `rauto flow` 定位不同：

- `rauto flow` 可以通过已保存或内置的命令流程模板，驱动设备侧 `copy scp:` / `copy tftp:` 交互流程。
- `rauto upload` 用于通过远端 SSH 服务暴露的 `sftp` 子系统，直接上传本地文件。

当目标主机支持 SFTP 时，优先使用 `rauto upload`。这在 Linux 主机上很常见，但很多网络设备并不提供 SFTP 子系统。

```bash
rauto upload \
    --local-path ./configs/daemon.conf \
    --remote-path /tmp/daemon.conf \
    --host 192.168.1.20 \
    --username admin \
    --password secret
```

可选参数：

- `--buffer-size <bytes>`
- `--timeout-secs <seconds>`
- `--show-progress`
- `--record-level <off|key-events-only|full>`
- `--record-file <path>`

### 3. 设备配置模板

`rauto` 支持内置的设备配置（继承自 `rneter`）和自定义 TOML 配置。

当前 `rneter 0.4.0` 提供的内置 profile 包括：

- 网络设备厂商：`cisco`、`huawei`、`h3c`、`hillstone`、`juniper`、`array`、`arista`、`fortinet`、`paloalto`、`topsec`、`venustech`、`dptech`、`chaitin`、`qianxin`、`maipu`、`checkpoint`
- 服务器：`linux`

**列出可用配置：**

```bash
rauto device list
```

**使用特定配置：**
默认为 `linux`。要使用 Huawei VRP：

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
- 支持在页面中下载连接导入模板，并从 CSV / Excel 批量导入已保存连接。
- 在页面连接参数和已保存连接中选择 SSH 安全档位：`secure`、`balanced`、`legacy-compatible`。
- 在 `Operations` 里统一执行直接命令、模板执行、命令流程、事务块、事务工作流和多设备编排。
- 在 `Template Manager` 中统一管理 profile、命令模板和命令流程模板。
- 使用独立的 `SFTP 上传` 页面执行直接文件上传。
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

Agent 模式提供：

- 通过 `grpc` 或 `http` 完成 manager 注册、心跳、设备清单同步和离线通知
- 在同一端口上提供给 manager 调用的 HTTP / gRPC 任务接口
- 通过当前上报通道回传异步任务事件和最终任务回调
- 提供受保护的状态查看与批量探测接口，方便 manager 做健康检查
- 配置 token 后，浏览器端和 manager 侧请求都会按同一套 token 机制受保护

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

批量导入：

```bash
# 从 CSV 导入已保存连接
rauto connection import ./devices.csv

# 从 Excel 导入已保存连接
rauto connection import ./devices.xlsx
```

支持的文件类型：

- `.csv`
- `.xlsx`
- `.xls`
- `.xlsm`
- `.xlsb`

推荐表头：

```csv
name,host,username,password,port,enable_password,ssh_security,device_profile,template_dir
core-sw-01,192.168.1.1,admin,secret,22,,balanced,cisco,
linux-jump-01,192.168.1.10,root,secret,22,,secure,linux,
```

说明：

- 如果未提供 `name`，`rauto` 会基于 `host` 自动生成连接名。
- 导入按连接名做 upsert。
- 某一行未提供密码字段时，如果该连接已存在，则会保留原有的加密密码。
- 在 Web UI 中，可通过 `Saved Connections -> Download Template` 下载起始 CSV 模板。
- 仓库里也提供了中英文两份示例文件：
- [templates/examples/connection-import-template-en.csv](templates/examples/connection-import-template-en.csv)
- [templates/examples/connection-import-template-zh.csv](templates/examples/connection-import-template-zh.csv)

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
          "run": {
            "kind": "command",
            "mode": "Config",
            "command": "address-book global address WEB01 10.0.10.1/32",
            "timeout": 10
          },
          "rollback": {
            "kind": "command",
            "mode": "Config",
            "command": "delete address-book global address WEB01",
            "timeout": 10
          }
        }
      ]
    },
    {
      "name": "policy",
      "kind": "config",
      "fail_fast": true,
      "rollback_policy": {
        "whole_resource": {
          "rollback": {
            "kind": "command",
            "mode": "Config",
            "command": "delete security policies from-zone trust to-zone untrust policy allow-web",
            "timeout": 10
          }
        }
      },
      "steps": [
        {
          "run": {
            "kind": "command",
            "mode": "Config",
            "command": "set security policies from-zone trust to-zone untrust policy allow-web match source-address WEB01",
            "timeout": 10
          },
          "rollback": null
        }
      ]
    }
  ]
}
```

可直接改的示例文件：

- [templates/examples/core-vlan-workflow.json](templates/examples/core-vlan-workflow.json)

更复杂的示例文件：

- [templates/examples/fabric-change-workflow.json](templates/examples/fabric-change-workflow.json)

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

- [templates/examples/campus-vlan-orchestration.json](templates/examples/campus-vlan-orchestration.json)
- [templates/examples/campus-inventory.json](templates/examples/campus-inventory.json)

更复杂的示例文件：

- [templates/examples/fabric-advanced-orchestration.json](templates/examples/fabric-advanced-orchestration.json)
- [templates/examples/fabric-advanced-inventory.json](templates/examples/fabric-advanced-inventory.json)

说明：

- `targets` 可以直接引用已保存连接名，也可以写内联连接字段。
- `target_groups` 可以从 `inventory_file` 或内联 `inventory.groups` 加载目标列表。
- `inventory.defaults` 会作用到所有分组和阶段内联 `targets`；group 的 `defaults` 会覆盖 inventory 默认值。
- `tx_block` 阶段会复用现有模板/回滚能力，并支持按目标覆盖 `vars`。
- `tx_workflow` 阶段会直接复用现有单设备工作流 JSON。
- 多设备编排当前已同时支持 Web UI 与 CLI。

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
| `--device-profile`  | -                | 设备类型/profile（默认：`linux`；例如：`huawei`、`linux`、`fortinet`） |
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
