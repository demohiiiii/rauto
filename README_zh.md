# rauto - 网络设备自动化 CLI

[![Crates.io](https://img.shields.io/crates/v/rauto.svg)](https://crates.io/crates/rauto)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[English Documentation](README.md)

`rauto` 是一个用 Rust 编写的强大的网络设备自动化 CLI 工具。它利用 [rneter](https://github.com/demohiiiii/rneter) 库进行智能 SSH 连接管理，并使用 [minijinja](https://github.com/mitsuhiko/minijinja) 实现灵活的命令模板功能。

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

### Claude Code 示例

如果你使用 Claude Code skills，请将目录复制到 Claude Code 的 skills 路径：
```bash
cp -R rauto/skills/rauto-usage ~/.claude/skills/
```

Claude Code 的个人 skills 默认路径是 `~/.claude/skills/`。citeturn0view0

## 使用方法

### 1. 模板模式（推荐）

从模板渲染命令并在设备上执行。

**基本用法：**
```bash
rauto template show_version.j2 \
    --host 192.168.1.1 \
    --username admin \
    --password secret \
    --ssh-port 22
```

**使用变量：**
假设有一个模板 `templates/commands/configure_vlan.j2` 和变量文件 `templates/example_vars.json`：

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

**自定义设备配置：**
你可以在 `templates/devices/*.toml` 中定义自定义配置。

示例 `templates/devices/custom_cisco.toml`：
```toml
name = "custom_cisco"

# 注意：在 TOML 中，顶层键值对必须在表格（[[prompts]] 等）之前定义
more_patterns = ['^.*?--More--.*?$']
error_patterns = ['^% Invalid input detected', '^% Incomplete command']

[[prompts]]
state = "Enable"
patterns = ['^[^\s#]+#\s*$']

# ... 查看 templates/devices/custom_cisco.toml 获取完整示例
```

使用它：
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
rauto device copy-builtin cisco my_cisco
rauto device delete-custom my_cisco
rauto device test-connection \
    --host 192.168.1.1 \
    --username admin \
    --password secret \
    --ssh-port 22
```

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
- 基于已保存连接执行命令（先加载连接，再选择直接执行或模板渲染执行）。
- 分页管理 profile（内置/自定义）与 template。
- 在页面中管理数据备份：创建/列出/下载/恢复 `~/.rauto` 备份归档。
- 在 Prompt 管理 -> 诊断页里可视化查看 profile 状态机诊断结果。
- 支持中英文界面切换。
- 支持执行录制与浏览器内回放（可列出事件，或按命令/模式回放）。

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
rauto device add-connection lab1 \
    --host 192.168.1.1 \
    --username admin \
    --ssh-port 22 \
    --device-profile cisco

# 复用已保存配置执行命令
rauto exec "show version" --connection lab1

# 在成功连接后保存当前有效配置
rauto device test-connection \
    --connection lab1 \
    --save-connection lab1_backup

# 管理已保存配置
rauto device list-connections
rauto device show-connection lab1
rauto device delete-connection lab1
```

密码保存规则：
- 在 `exec/template/device test-connection` 中使用 `--save-connection` 时，默认不保存密码；加上 `--save-password` 才会保存密码字段。
- 使用 `device add-connection` 时，仅当显式传入 `--password` / `--enable-password` 才会保存密码字段。

### 7. 数据备份与恢复

对当前 `rauto` 全部运行数据（连接、profile、模板、录制等）做备份：

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

### 8. CLI 速查表

**连接排障**
```bash
rauto device test-connection \
    --host 192.168.1.1 \
    --username admin \
    --password secret \
    --ssh-port 22
```

**连接配置档**
```bash
rauto device add-connection lab1 \
    --host 192.168.1.1 \
    --username admin \
    --ssh-port 22 \
    --device-profile cisco
rauto exec "show version" --connection lab1
rauto device list-connections
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
# 执行 JSON 工作流
rauto tx-workflow ./workflow.json \
    --host 192.168.1.1 \
    --username admin \
    --password secret

# 仅预览：打印 JSON 并退出
rauto tx-workflow ./workflow.json --dry-run
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

**CLI 与 Web UI 对应关系**
```text
Web 操作界面                   CLI
------------------------------ ---------------------------------------------
直接执行命令                   rauto exec
模板渲染并执行                 rauto template
事务块执行                     rauto tx
事务工作流                     rauto tx-workflow

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

默认目录：
- `~/.rauto/connections`（已保存连接配置）
- `~/.rauto/profiles`（自定义设备 profile）
- `~/.rauto/templates/commands`
- `~/.rauto/templates/devices`
- `~/.rauto/records`（会话录制文件）
- `~/.rauto/backups`（备份归档）

这些目录会在启动时自动创建。

为了兼容历史用法，仍会回退检查当前目录下的 `./templates/`。

```
~/.rauto
├── connections/            # 已保存连接配置 (*.toml)
├── profiles/               # 从内置复制/创建的自定义 profile
├── templates/
│   ├── commands/           # 在此存储 .j2 命令模板
│   └── devices/            # 在此存储自定义 .toml 设备配置
├── records/                # 会话录制输出 (*.jsonl)
└── backups/                # 备份归档 (*.tar.gz)
```

你可以使用 `--template-dir` 参数或 `RAUTO_TEMPLATE_DIR` 环境变量指定自定义模板目录。

## 配置选项

| 参数 | 环境变量 | 描述 |
|----------|---------|-------------|
| `--host` | - | 设备主机名或 IP |
| `--username` | - | SSH 用户名 |
| `--password` | `RAUTO_PASSWORD` | SSH 密码 |
| `--enable-password` | - | Enable/Secret 密码 |
| `--ssh-port` | - | SSH 端口 (默认: 22) |
| `--device-profile` | - | 设备类型 (默认: cisco) |
| `--connection` | - | 按名称加载已保存连接配置 |
| `--save-connection` | - | 成功连接后保存当前有效连接配置 |
| `--save-password` | - | 配合 `--save-connection` 使用时保存密码/enable_password |

录制/回放相关参数（命令级参数）：
- `exec/template --record-file <path>`：执行后保存录制 JSONL。
- `exec/template --record-level <off|key-events-only|full>`：录制粒度。
- `replay <record_file> --list`：列出录制中的命令输出事件。
- `replay <record_file> --command <cmd> [--mode <mode>]`：回放单条命令输出。

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
