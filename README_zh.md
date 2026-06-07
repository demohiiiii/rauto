<div align="center">

<img src="frontend/public/rauto-icon.svg" alt="rauto icon" width="112" />

# rauto

**AI 时代操控网络设备的双手**

[![Crates.io](https://img.shields.io/crates/v/rauto.svg)](https://crates.io/crates/rauto)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)
[![官网](https://img.shields.io/badge/%E5%AE%98%E7%BD%91-rauto.top-0ea5e9?style=for-the-badge&logo=googlechrome&logoColor=white)](https://rauto.top)

[官网](https://rauto.top) · [English Documentation](README.md)

</div>

`rauto` 是一个用 Rust 编写的开箱即用的网络自动化工具集，提供 CLI、Web 和 agent API 三种操作入口，用于统一操作各类网络设备。它基于 [rneter](https://github.com/demohiiiii/rneter) 处理 SSH 会话连接，基于 [minijinja](https://github.com/mitsuhiko/minijinja) 实现命令模板渲染，为网络工程师、自动化开发者以及 AI 驱动的网络控制场景提供简单、高性能、可扩展的设备访问、事务执行和多设备编排能力。

## 快速开始

```bash
cargo install rauto

# 默认使用 autodetect 自动识别设备 profile
rauto exec "uname -a" --host 192.168.1.10 --username root --password '******'

# 如果要连接 Cisco 这类网络设备，显式指定 cisco profile
rauto exec "show version" --host 192.168.1.1 --username admin --password '******' --device-profile cisco

rauto web --bind 127.0.0.1 --port 3000
```

## 目录导航

- [功能特性](#功能特性)
- [安装](#安装)
  - [二进制文件安装推荐](#二进制文件安装推荐)
  - [通过-cratesio-安装](#通过-cratesio-安装)
  - [源码安装](#源码安装)
- [Codex Skill可选](#codex-skill可选)
- [使用方法](#使用方法)
  - [命令选型指南](#命令选型指南)
  - [模板模式](#模板模式)
  - [直接执行](#直接执行)
  - [命令流程模板](#命令流程模板)
  - [SFTP-上传](#sftp-上传)
  - [设备配置模板](#设备配置模板)
  - [Web-控制台](#web-控制台)
    - [Agent-模式](#agent-模式)
  - [Template-存储管理命令](#template-存储管理命令)
  - [已保存连接配置](#已保存连接配置)
  - [数据备份与恢复](#数据备份与恢复)
  - [命令黑名单](#命令黑名单)
  - [事务块](#事务块)
  - [事务工作流](#事务工作流)
  - [多设备编排](#多设备编排)
  - [可复用执行模板](#可复用执行模板)
  - [Inventory-CLI](#inventory-cli)
- [目录结构](#目录结构)
- [配置选项](#配置选项)
- [模板语法](#模板语法)
- [贡献代码](#贡献代码)
- [许可证](#许可证)

## 功能特性

- **开箱即用的查询能力**：内置 show 对象、TextFSM 解析和 Excel 导出，Web 端支持单设备/多设备按对象查询，CLI 支持按连接名、分组和标签批量执行。
- **双层模板系统**：命令模板 (Jinja2) 与 设备配置模板 (TOML)。
- **智能连接处理**：使用 `rneter` 管理 SSH 会话状态。
- **Dry Run 支持**：在执行前预览命令。
- **变量注入**：从 JSON 文件加载变量。
- **可扩展性**：支持自定义 TOML 设备配置。
- **内置 Web 控制台**：通过 `rauto web` 启动浏览器页面。
- **内嵌静态资源**：发布二进制时前端资源已打包到可执行文件中。
- **连接配置档复用**：支持按名称保存/加载连接参数。
- **批量导入连接**：支持从 CSV / Excel 批量导入并按名称 upsert 已保存连接。
- **SSH 安全档位**：可按目标选择 `secure`、`balanced`、`legacy-compatible`；默认使用 `legacy-compatible`。
- **Inventory 分组与标签**：支持用分组和标签组织已保存连接。
- **会话录制与回放**：支持将 SSH 会话录制为 JSONL 并离线回放。
- **可复用命令流程模板**：支持把向导式 CLI 交互保存为可复用模板，用来执行设备侧文件传输、安装向导、功能确认等多步交互流程。
- **可复用执行模板**：支持把 tx block / workflow / orchestration JSON 保存为可复用模板，并在执行前渲染变量。
- **SFTP 上传**：支持将本地文件直接上传到暴露 `sftp` 子系统的 SSH 主机。
- **数据备份与恢复**：支持对 `~/.rauto` 运行数据做全量备份与恢复。
- **异步任务追踪**：可在 Web UI 中查看排队中、运行中、已完成任务的状态、事件、附件与录制。
- **Agent 模式**：支持通过 `rauto agent` 接入 manager，完成注册、心跳、受保护 API 与任务回调。
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

确保你已经安装了 Rust、Cargo、Node.js 和 npm。

```bash
git clone https://github.com/demohiiiii/rauto.git
cd rauto
npm ci
npm run web:build
cargo build --release
```

编译后的二进制文件位于 `target/release/rauto`。

## Codex Skill（可选）

本仓库包含一个 `skills/rauto-usage/`，适合在 Codex 或 Claude Code 中配合 `rauto` 使用。

适用于已经启用了 skill 加载能力的 Codex 兼容客户端。
将该目录复制到对应客户端配置的 skills 目录即可。

安装方式：

```bash
cp -R skills/rauto-usage "$CODEX_HOME/skills/"
```

如果你的 Codex 环境没有暴露 `$CODEX_HOME`，请把 `skills/rauto-usage/` 复制到客户端实际配置的 skills 目录中。
如果你使用 Claude Code，通常可复制到 `~/.claude/skills/`。

## 使用方法

### 命令选型指南

| 如果你想要...                  | 推荐命令            | 说明                                                      |
| ------------------------------ | ------------------- | --------------------------------------------------------- |
| 立即执行一条命令               | `rauto exec`        | 适合临时直连执行；可配合 `--mode` 限定目标模式。          |
| 按 profile 执行 NTC 支持的 show 对象 | `rauto show`        | 将 `interfaces`、`route` 等对象映射为设备实际命令。    |
| 用变量渲染一个可复用命令模板   | `rauto template`    | 适合命令文本来自已保存 Jinja 模板的场景。                 |
| 驱动交互式问答/确认流程        | `rauto flow`        | 适合复制向导、安装向导和多轮 prompt/response 场景。       |
| 通过远端 SFTP 直接上传本地文件 | `rauto upload`      | 要求目标 SSH 服务暴露 `sftp` 子系统。                     |
| 执行一个带回滚能力的事务块     | `rauto tx`          | 适合单目标、单事务单元、需要步骤级或资源级回滚的场景。    |
| 从 JSON 执行多步骤事务工作流   | `rauto tx-workflow` | 适合把事务拆成命名 block/stage 并保存在 workflow 文件中。 |
| 执行多设备分阶段计划           | `rauto orchestrate` | 适合面向多台已保存连接做串行/并发编排发布。               |

### 模板模式

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

### 直接执行

直接执行原始命令，无需模板。

```bash
rauto exec "show ip int br" \
    --host 192.168.1.1 \
    --username admin \
    --password secret \
    --ssh-port 22
```

如果没有传 `--device-profile`，`rauto exec` 会使用默认的 `autodetect` 解析流程，在执行前尝试识别实际应使用的内置 profile。
这个自动探测步骤只负责选择设备 profile，不会分析命令文本来判断它是 `show` 命令、`config` 命令，还是其他依赖模式的命令。

`exec` 的模式选择规则如下：

- 传了 `--mode` 时，会先根据当前选中的 profile 校验该 mode，再按这个 mode 执行。
- 未传 `--mode` 时，会使用当前 profile 的 `default_mode`。

### Show 模式

执行内置命令表支持的 show 对象时，不需要手写具体设备命令。
`rauto show` 会解析目标 profile，把对象映射为对应平台的实际命令，执行后默认用 TextFSM 解析输出。
Web UI 中也可以在 **普通下发 -> 查询** 使用同样的能力。

```bash
rauto show interfaces \
    --host 192.168.1.1 \
    --username admin \
    --password secret \
    --ssh-port 22
```

对象包括 `version`、`interfaces`、`interface-brief`、`route`、`arp`、`lldp`、`mac`、`vlan`、`access-list`、`object-group`、`security-policy`、`nat-policy` 等；可用 `--list` 查看当前平台支持的全部对象。
这些对象定义在内置的 `assets/show_catalog/commands-mapping.toml` 命令表中；命令表可以绑定平台级或单个对象的执行 mode。显式传入的 `--mode` 优先级最高，其次是命令表绑定的 mode，最后才是 profile 默认 mode。
当前 show 功能主要基于 [ntc-templates](https://github.com/networktocode/ntc-templates) 提供的命令索引和 TextFSM 解析模板：`rauto` 把不同平台中语义相同的查询整合成统一 object，例如 `interfaces`、`route`、`arp`、`vlan`。命令执行后的 TextFSM 解析默认使用内置的 [ntc-templates](https://github.com/networktocode/ntc-templates) 模板；如果自定义 show object 绑定了自定义 TextFSM 模板，则优先使用绑定模板。

```bash
rauto show --list --device-profile cisco_ios
rauto show route --print-command
rauto show interfaces --no-parse
```

也可以对多个已保存连接批量执行同一个 show 对象。目标可以直接通过连接名指定，也可以通过 inventory 分组或标签选择。真正执行命令前，`rauto` 会先解析所有目标的 profile，并检查每个设备是否都有该对象对应的 show 命令；只要有任一目标缺少映射，整次执行会在下发命令前报错退出。

```bash
rauto show interfaces \
    --target core-sw1 \
    --target core-sw2 \
    --group access \
    --label campus \
    --print-command

rauto show route --group core --tag prod --textfsm-excel ./routes.xlsx
```

你也可以把某个 profile 的自定义 show object 保存到 SQLite。同一个 `(device_profile, object)` 下，自定义 show object 会覆盖内置命令表，可以绑定执行 mode，也可以绑定自定义 TextFSM 模板；绑定模板的优先级高于命令映射和内置 NTC 模板。

```bash
rauto show-object set \
    --profile my_custom_profile \
    --object access-list \
    --command "show access-lists" \
    --mode enable \
    --textfsm-template my_access_list

rauto show-object list --profile my_custom_profile
rauto show-object delete --profile my_custom_profile --object access-list
```

### TextFSM 解析

`show`、`exec`、`template` 和 `flow` 可以在命令执行后用 TextFSM 解析输出。

- `show` 默认启用 TextFSM 解析。只想看原始输出时传 `--no-parse`。
- 默认不会解析。需要解析时传 `--parse-textfsm`。
- 手动解析：传 `--textfsm-template <path>`，使用指定 TextFSM 模板文件，优先级最高。
- 多命令解析：`template` 和 `flow` 可以重复传多个 `--textfsm-template <path>`，按命令顺序匹配模板文件；如果模板文件数量少于命令数量，最后一个模板会用于后续所有命令。
- 平台推断：启用解析且未传 `--textfsm-platform` 时，`rauto` 会从当前连接的 device profile 推断 [ntc-templates](https://github.com/networktocode/ntc-templates) platform，例如 `cisco_ios`、`huawei -> huawei_vrp`、`cisco_xe -> cisco_ios`。
- 平台覆盖：只有在你想在启用解析后强制覆盖推断结果，或者按其他 NTC platform 解析时，才传 `--textfsm-platform <platform>`。
- 宽松解析：默认会在解析前过滤 TextFSM 模板里的 `^. -> Error` 这类兜底 Error 规则，避免某些非关键行未匹配时导致整次解析失败。需要严格保留 Error 规则时，传 `--textfsm-strict-errors`。
- Excel 导出：传 `--textfsm-excel <file.xlsx>` 可以把解析成功的表格行导出为 Excel 工作簿。对 `exec`、`template` 和 `flow` 来说，这个参数也会启用 TextFSM 解析。
- 如果没有启用解析，也没有指定模板，则只展示原始输出。
- 解析失败不会阻断命令执行；原始输出仍会返回，解析错误会单独展示。

自定义 TextFSM 模板和映射可以保存到 SQLite。启用解析且没有显式传 `--textfsm-template` 时，`rauto` 会先查自定义映射 `(device_profile, command) -> template`；没有命中时，才回退到内置 [ntc-templates](https://github.com/networktocode/ntc-templates) 模板。

Web UI 中可以在 **Template Manager -> TextFSM Templates** 管理同一套自定义 TextFSM 模板、profile 命令映射和自定义 show object。

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

**启用 TextFSM 解析：**

```bash
rauto exec "show version" \
    --connection core-01 \
    --parse-textfsm
```

**导出解析结果到 Excel：**

```bash
rauto exec "show version" \
    --connection core-01 \
    --parse-textfsm \
    --textfsm-excel ./show-version.xlsx
```

**在需要时覆盖推断的平台：**

```bash
rauto exec "show version" \
    --connection core-01 \
    --parse-textfsm \
    --textfsm-platform cisco_ios
```

**使用指定 TextFSM 模板文件解析输出：**

```bash
rauto template show_version.j2 \
    --connection core-01 \
    --textfsm-template ./templates/cisco_ios_show_version.textfsm
```

**按命令顺序为多命令模板指定多个解析模板：**

```bash
rauto template check_basic.j2 \
    --connection core-01 \
    --textfsm-template ./templates/cisco_ios_show_version.textfsm \
    --textfsm-template ./templates/cisco_ios_show_interfaces.textfsm
```

**保存自定义 TextFSM 模板，并绑定到某个 profile 的命令：**

```bash
rauto textfsm template create my_show_version \
    --file ./templates/my_show_version.textfsm

rauto textfsm mapping set \
    --profile my_custom_profile \
    --command "show version" \
    --template my_show_version
```

### 命令流程模板

`rauto flow` 用来执行已保存或临时提供的交互式 `CommandFlow` 模板。这是更通用的一层能力，适合处理向导式 CLI 交互，例如设备侧文件传输、安装向导、功能确认提示等。

管理已保存模板：

```bash
rauto flow-template list
rauto flow-template show cisco_like_copy
rauto flow-template create cisco_like_copy --file ./templates/examples/cisco-like-command-flow.toml
rauto flow-template create linux_scp_with_current_and_peer --file ./templates/examples/linux-scp-with-current-and-peer-command-flow.toml
rauto flow-template update cisco_like_copy --file ./my-flow-template.toml
rauto flow-template delete cisco_like_copy
```

执行已保存模板，并传入运行时变量：

```bash
rauto flow \
    --template cisco_like_copy \
    --vars-json '{"command":"copy scp: flash:/new.bin","server_addr":"192.168.1.50","remote_path":"/images/new.bin","transfer_username":"backup","transfer_password":"secret"}' \
    --connection core-01
```

说明：

- `rauto flow` 是 CLI 里执行交互式命令流程的推荐入口。
- 已保存的命令流程模板存放在 SQLite 中，CLI 和 Web 共用同一套模板。
- 内置命令流程模板可通过 `/api/flow-templates/builtins` 获取；执行时支持 `builtin:<name>`（CLI `--template` 与 Web 下拉值都可用）。
- 命令流程模板遵循 rneter 当前的 `{{var}}` 内联 `CommandFlowTemplate` 模型，并按线性步骤执行，通过 prompt 交互规则驱动多轮问答。
- 命令流程模板现在可以声明 `vars` 列表，支持 `name`、`type`、`required`、`default`、`options`、`label`、`description` 等字段，便于运行时校验变量，也便于 Web 自动渲染输入表单。
- 运行时变量会同时注入到模板顶层字段和 `vars` 嵌套对象中。
- 运行时变量支持两种引用：`连接名.参数名`（跨连接取值）与 `参数名`（先查请求变量，再回退当前目标连接参数）。
- 命令流程模板支持顶层字段 `current_connection_alias = "<别名>"`。配置后可直接在模板里使用 `{{别名.host}}`、`{{别名.username}}`、`{{别名.password}}` 等，且不需要把这个别名写进 `[[vars]]`。
- 连接别名变量支持“变量值指向连接名”的模式。例如 `peer=edge94` 后，可直接引用 `{{peer.host}}` / `{{peer.username}}` / `{{peer.password}}`。
- 如果某个步骤没有显式写 `mode`，`rauto` 会使用设备 profile 定义的第一个状态。
- 现在所有执行都会默认保存会话记录。
- `--record-level key-events-only` 会保存最小审计信息：输入命令和设备回显。
- `--record-level full` 会进一步保存更完整的 prompt 和状态变更信息。
- `--record-file` 仍然可以把同一份 JSONL 录制额外导出到文件。

可直接修改的示例模板：

- [templates/examples/cisco-like-command-flow.toml](templates/examples/cisco-like-command-flow.toml)
- [templates/examples/linux-scp-with-current-and-peer-command-flow.toml](templates/examples/linux-scp-with-current-and-peer-command-flow.toml)

示例：只传一个 `peer` 变量执行 Linux SCP 流程

```bash
rauto flow \
    --template linux_scp_with_current_and_peer \
    --connection edge92 \
    --vars-json '{"peer":"edge94","local_path":"/tmp/app.tar","remote_path":"/tmp/app.tar"}'
```

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
- `--record-level <key-events-only|full>`
- `--record-file <path>`

### 设备配置模板

`rauto` 支持内置的设备配置（继承自 `rneter`）和自定义 TOML 配置。

当前 `rneter` 提供的内置 profile 包括：

- 网络设备厂商：`cisco_ios`、`cisco_xe`、`huawei`、`h3c_comware`、`hp_comware`、`hillstone_stoneos`、`juniper_junos`、`array`、`arista_eos`、`aruba_aoscx`、`cisco_asa`、`cisco_nxos`、`dell_os10`、`fortinet`、`paloalto_panos`、`topsec`、`venustech`、`dptech`、`chaitin`、`qianxin`、`maipu`、`ruijie_os`、`zte_zxros`、`checkpoint_gaia`
- 服务器：`linux`

**Mode 命名建议：**
当你创建或修改自定义设备 profile 时，如果设备语义能够对应，建议尽量复用已有的模式命名，例如 `Login`、`Enable`、`Config`。

这样做的好处：

- 让 `exec --mode`、`tx --mode` 和命令流程步骤中的 `mode` 在不同厂商 profile 之间保持一致。
- 便于复用示例、模板和日常操作习惯，不必为不同 profile 反复记忆一套新的模式命名。
- 在内置 profile 和自定义 profile 之间切换时，更容易理解默认 mode 回退和 mode 校验行为。
- 阅读录制结果、tx 输出、编排计划，或排查 mode 相关问题时，整体会更直观、更少歧义。

**列出可用配置：**

```bash
rauto profile list
```

**自动探测 profile：**
默认 profile 是 `autodetect`，普通执行会在运行命令前自动解析出实际内置 profile。也可以显式探测某台设备：

```bash
rauto profile autodetect \
    --host 192.168.1.1 \
    --username admin \
    --password secret \
    --ssh-port 22
```

使用 `-v` 打印按分数排序的候选摘要，使用 `-vv` 追加完整 debug 报告：

```bash
rauto profile autodetect -v --host 192.168.1.1 --username admin --password secret
rauto profile autodetect -vv --host 192.168.1.1 --username admin --password secret
```

当普通执行路径使用 autodetect 时，探测出的 profile 会决定后续的 mode 校验和默认 mode 回退逻辑。autodetect 不会根据命令文本自动推断执行模式；如果某条命令必须在 `Enable`、`Config`、`Shell` 等特定状态下运行，请显式使用 `exec --mode <mode>`。
成功的 autodetect 结果会按 `host:port` 缓存在本地运行数据库里，因此后续连接同一目标时可以直接复用已识别出的 profile，而不必重复探测；如果你显式指定了 profile，则仍然以显式指定为准。
当启用 `--parse-textfsm` 且没有传 `--textfsm-platform` 时，`rauto` 会根据当前连接的 device profile 自动推断对应的 NTC platform，用于 TextFSM 解析。

**使用特定配置：**
需要绕过自动探测时，可以使用 `--device-profile` 显式指定设备 profile。例如指定 Huawei profile：

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
rauto profile list
rauto profile autodetect --host 192.168.1.1 --username admin --password secret
rauto profile autodetect -v --host 192.168.1.1 --username admin --password secret
rauto profile show cisco_ios
rauto profile show linux
rauto profile copy-builtin cisco_ios my_cisco
rauto profile delete-custom my_cisco
rauto connection test \
    --host 192.168.1.1 \
    --username admin \
    --password secret
```

说明：

- `rauto profile list` 会包含 `autodetect` 伪 profile、当前 `rneter` 暴露的内置 profile，以及保存在 SQLite 中的自定义 profile。
- `rauto profile show <builtin>` 和 `rauto profile copy-builtin <builtin> <custom>` 都会基于当前 `rneter` 导出的内置 handler 配置工作。

### Web 控制台

启动内置 Web 服务，并在浏览器中打开可视化页面：

```bash
rauto web \
    --bind 127.0.0.1 \
    --port 3000 \
    --host 192.168.1.1 \
    --username admin \
    --password secret
```

然后访问 `http://127.0.0.1:3000`。

Web 静态资源在构建时会嵌入二进制。  
对于发布后的可执行文件，运行时不再依赖本地 `static/` 目录。

Web 前端由 Svelte 5 构建。
从源码构建时，请先执行 `npm run web:build` 再编译 Rust 二进制。

```bash
npm run frontend:build  # 仅构建 Svelte 控制台入口
npm run web:build       # 构建嵌入式 Web 控制台资源
```

Web 控制台主要能力：

- 在页面中管理连接配置：新增、加载、更新、删除、查看详情。
- 支持在页面中下载连接导入模板，并从 CSV / Excel 批量导入已保存连接。
- 在页面连接参数和已保存连接中选择 SSH 安全档位：`secure`、`balanced`、`legacy-compatible`。
- 在 `Operations` 里统一执行直接命令、模板执行、命令流程、事务块、事务工作流和多设备编排。
- 在 `Template 管理` 中统一管理 profile、命令模板和命令流程模板。
- 在 `资源清单` 中通过分组（Groups）与标签（Labels）组织已保存连接（仅 Web 提供完整管理界面）。
- 在 `任务中心` 中查看异步任务运行情况（状态、事件、附件、录制）。
- 使用独立的 `SFTP 上传` 页面执行直接文件上传。
- 在页面中管理命令黑名单：新增、删除、校验带 `*` 通配符的规则。
- 在页面中管理数据备份：创建/列出/下载/恢复 `~/.rauto` 备份归档。
- 在 `Prompt 管理` -> 诊断页里可视化查看 profile 状态机诊断结果。
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

### Template 存储管理命令

```bash
rauto templates list
rauto templates show show_version.j2
rauto templates delete show_version.j2
```

### 已保存连接配置

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

- 在 `exec/template/connection test` 中使用 `--save-connection` 时，会保存当前有效连接配置；如果连接中包含密码字段，也会一并保存。
- 使用 `connection add` 时，如果显式传入 `--password` / `--enable-password`，会保存对应密码字段。
- 已保存密码会先加密后写入 `~/.rauto/rauto.db`；解密主密钥仅在系统 keyring 中保存一份（一次授权后进程内缓存）。
- `--ssh-security <secure|balanced|legacy-compatible>` 用于控制 SSH 算法兼容档位，并会一起保存到连接配置中。未指定时默认使用兼容性最广的 `legacy-compatible`。
- `--linux-shell-flavor <posix|fish>` 用于控制 Linux shell 的退出码解析策略（`posix` 同时接受 `bash` 别名）。

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
name,host,username,password,port,enable_password,ssh_security,linux_shell_flavor,device_profile,template_dir
core-sw-01,192.168.1.1,admin,secret,22,,balanced,,cisco,
linux-jump-01,192.168.1.10,root,secret,22,,secure,posix,linux,
```

说明：

- 如果未提供 `name`，`rauto` 会基于 `host` 自动生成连接名。
- 导入按连接名做 upsert。
- 某一行未提供密码字段时，如果该连接已存在，则会保留原有的加密密码数据。
- 在 Web UI 中，可通过 `Saved Connections -> Download Template` 下载起始 CSV 模板。
- 仓库里也提供了中英文两份示例文件：
- [templates/examples/connection-import-template-en.csv](templates/examples/connection-import-template-en.csv)
- [templates/examples/connection-import-template-zh.csv](templates/examples/connection-import-template-zh.csv)

### 数据备份与恢复

备份当前 `rauto` 的运行时数据存储和备份配置：

注意：备份归档会包含 `rauto.db`、模板和其他运行时文件，但不会导出系统 keyring 中保存的主密钥。恢复到另一台机器或全新系统账号后，如需继续使用已保存连接中的加密密码，请重新保存密码（或导入同一主密钥）。

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

### 命令黑名单

可以使用全局黑名单，在命令真正发送到设备前拒绝执行。CLI 和 Web 的执行链路都会生效，包括 `exec`、模板执行、`flow`、`tx`、`tx-workflow` 和 `orchestrate`。

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

### 事务块

`rauto tx` 用于在单个目标上执行一个带回滚能力的事务块。
当你需要一个紧凑的执行单元，并希望显式控制回滚，但又不想引入完整 `tx-workflow` JSON 结构时，优先使用它。

常见用法：

```bash
rauto tx \
    --name vlan-change \
    --command "vlan 120" \
    --command "name campus-users" \
    --rollback-command "no vlan 120" \
    --rollback-command "default name" \
    --rollback-on-failure \
    --mode Config \
    --host 192.168.1.1 \
    --username admin \
    --password secret

rauto tx \
    --run-kind command-flow \
    --flow-template cisco_like_copy \
    --flow-vars ./flow-vars.json \
    --rollback-flow-file ./rollback-flow.toml \
    --host 192.168.1.1 \
    --username admin \
    --password secret
```

说明：

- `--run-kind commands` 使用重复的 `--command` 与可选的步骤级 `--rollback-command`。
- `--run-kind command-flow` 使用已保存或临时提供的命令流程模板来执行正向和回滚路径。
- `--dry-run` 会打印标准化后的 tx block，而不真正执行。
- `--json` 会以 JSON 形式输出执行结果。
- `--record-file` 与 `--record-level` 的行为和其他执行命令一致。

### 事务工作流

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

### 多设备编排

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
  "rollback_on_stage_failure": true,
  "rollback_completed_stages_on_failure": false,
  "stages": [
    {
      "name": "core",
      "strategy": "serial",
      "jobs": [
        {
          "name": "core-workflow",
          "strategy": "serial",
          "targets": ["core-01", "core-02"],
          "action": {
            "kind": "tx_workflow",
            "workflow_file": "./workflows/core-vlan.json"
          }
        }
      ]
    },
    {
      "name": "access",
      "strategy": "parallel",
      "max_parallel": 2,
      "jobs": [
        {
          "name": "access-rollout",
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
  ]
}
```

`rollback_on_stage_failure=true` 表示同一 stage 内某个目标失败后，会对该
stage 中其它已经成功的目标执行补偿回滚。`rollback_completed_stages_on_failure=true`
表示后续 stage 失败时，还会按 stage 逆序对之前已完成 stage 的成功目标执行补偿回滚。

**Inventory + 分组示例**

```json
{
  "name": "campus-vlan-rollout",
  "inventory_file": "./inventory.json",
  "stages": [
    {
      "name": "core",
      "strategy": "serial",
      "jobs": [
        {
          "name": "core-workflow",
          "strategy": "serial",
          "target_groups": ["core"],
          "action": {
            "kind": "tx_workflow",
            "workflow_file": "./workflows/core-vlan.json"
          }
        }
      ]
    },
    {
      "name": "access",
      "strategy": "serial",
      "jobs": [
        {
          "name": "access-rollout",
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
- [templates/examples/linux-image-rollout-orchestration.json](templates/examples/linux-image-rollout-orchestration.json)
- [templates/examples/linux-image-export-and-transfer-workflow.json](templates/examples/linux-image-export-and-transfer-workflow.json)
- [templates/examples/linux-image-export-and-transfer-with-password-scp-workflow.json](templates/examples/linux-image-export-and-transfer-with-password-scp-workflow.json)
- [templates/examples/linux-image-load-and-restart-workflow.json](templates/examples/linux-image-load-and-restart-workflow.json)

说明：

- `stage.jobs` 定义阶段内的执行单元；每个 job 独立定义 `targets` / `target_groups` 与 `action`。
- `stage.strategy` / `stage.max_parallel` 控制 job 级并发；`job.strategy` / `job.max_parallel` 控制目标级并发。
- `targets` 可以直接引用已保存连接名，也可以写内联连接字段。
- `target_groups` 可以从 `inventory_file` 或内联 `inventory.groups` 加载目标列表。
- `inventory.defaults` 会作用到所有分组和 job 内联 `targets`；group 的 `defaults` 会覆盖 inventory 默认值。
- `tx_block` job 支持两种来源模式：
  - 命令模式（`template` / `commands` + `vars`）
  - 事务块模板模式（`tx_block_template_name` / `tx_block_template_content` + `tx_block_template_vars`）
- `tx_workflow` job 支持四种来源模式（四选一）：
  - `workflow_file`
  - 内联 `workflow`
  - `workflow_template_name`
  - `workflow_template_content`（配合 `workflow_vars`）
- 多设备编排当前已同时支持 Web UI 与 CLI。

### 可复用执行模板

`rauto` 现已支持将执行 JSON 存成可复用模板（SQLite），并在执行时进行变量渲染：

- `tx block templates`：`/api/tx-block-templates`
- `tx workflow templates`：`/api/tx-workflow-templates`
- `orchestration templates`：`/api/orchestration-templates`

执行接口新增模板输入（三选一模式：内联 JSON / 已保存模板名 / 模板内容）：

- `POST /api/tx/block`：
  - `tx_block_template_name`
  - `tx_block_template_content`
  - `tx_block_template_vars`
- `POST /api/tx/workflow`：
  - `workflow_template_name`
  - `workflow_template_content`
  - `workflow_vars`
- `POST /api/orchestrate`：
  - `plan_template_name`
  - `plan_template_content`
  - `plan_vars`

CLI 模板管理入口放在对应执行命令下面：

```bash
rauto tx-workflow template list
rauto tx-workflow template show workflow-rollout
rauto tx-workflow template create workflow-rollout --file ./workflow-template.json
rauto tx-workflow template update workflow-rollout --file ./workflow-template.json
rauto tx-workflow template delete workflow-rollout

rauto orchestrate template list
rauto orchestrate template show campus-rollout
rauto orchestrate template create campus-rollout --file ./orchestration-template.json
rauto orchestrate template update campus-rollout --file ./orchestration-template.json
rauto orchestrate template delete campus-rollout
```

基于已保存模板执行：

```bash
rauto tx-workflow --template workflow-rollout --vars ./workflow-vars.json --dry-run
rauto orchestrate --template campus-rollout --vars-json '{"site":"dc-a"}' --view
```

变量渲染上下文说明：

- `vars`：请求里传入的 `*_vars`
- `connection`：单设备执行时的已解析连接参数（host/username/password/port/device_profile 等；如果是 saved connection，会额外提供 `connection.saved` 元数据）
- `defaults`：编排执行时的全局默认连接参数（来自全局配置）
- `now`：当前时间（`rfc3339` / `timestamp_ms`）
- 支持顶层简写：`{{ peer_host }}` 会先查请求 vars，再回退当前目标连接参数。
- 支持直接连接对象引用：`{{ edge94.host }}`、`{{ edge94.password }}`、`{{ edge94.vars.site }}`。

字符串字段支持模板语法（minijinja），例如：

```json
{
  "command": "scp /tmp/{{ image_file }} {{ edge94.username }}@{{ edge94.host }}:/tmp/{{ image_file }}"
}
```

Web UI（`Operations -> Orchestrated Delivery`）也已同步支持单独填写：

- `Tx Workflow` 的 `workflow_vars`
- `Orchestration` 的 `plan_vars`

### Inventory CLI

当前不再提供独立的 inventory 目标记录层。

saved connection 就是 inventory 目标的来源（包含 `enabled`、`labels`、`groups`、`vars` 等元数据），
Inventory CLI 重点保留分组管理和变量合并预览能力。

管理 group：

```bash
rauto inventory group list
rauto inventory group show access --json
rauto inventory group upsert access --file ./group-access.json
rauto inventory group delete access
```

预览变量合并结果（顺序：`group vars -> saved connection vars -> runtime vars`）：

```bash
rauto inventory resolve-vars \
  --host edge-sw-01 \
  --group access \
  --vars-json '{"ticket":"CHG-42"}' \
  --json
```

Group JSON 结构：

```json
{
  "name": "access",
  "description": "Campus access switches",
  "hosts": ["edge-sw-01", "edge-sw-02"],
  "vars": {
    "role": "access"
  }
}
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

| 参数                   | 环境变量         | 描述                                                                        |
| ---------------------- | ---------------- | --------------------------------------------------------------------------- |
| `--host`               | -                | 设备主机名或 IP（`-H`）                                                     |
| `--username`           | -                | SSH 用户名                                                                  |
| `--password`           | `RAUTO_PASSWORD` | SSH 密码                                                                    |
| `--enable-password`    | -                | Enable/Secret 密码                                                          |
| `--ssh-port`           | -                | SSH 端口 (默认: 22)                                                         |
| `--ssh-security`       | -                | SSH 安全档位（默认：`legacy-compatible`）：`secure`、`balanced`、`legacy-compatible` |
| `--linux-shell-flavor` | -                | Linux shell 退出码解析档位：`posix`（兼容 `bash`）或 `fish`                 |
| `--device-profile`     | -                | 设备类型/profile（默认：`autodetect`；例如：`huawei`、`linux`、`fortinet`、`cisco_ios`） |
| `--force-autodetect`   | -                | 忽略已缓存的 autodetect 结果并重新探测目标设备                                |
| `--connection`         | -                | 按名称加载已保存连接配置（`-c`）                                            |
| `--save-connection`    | -                | 成功连接后保存当前有效连接配置（`-S`）                                      |

常用短选项速查：

- 全局：`-H/--host`、`-u/--username`、`-p/--password`、`-P/--ssh-port`、`-e/--enable-password`、`-d/--device-profile`、`-c/--connection`、`-S/--save-connection`
- Flow：`-t/--template`、`-f/--file`、`-v/--vars`、`-r/--record-file`、`-l/--record-level`
- Exec：`-m/--mode`、`-r/--record-file`、`-l/--record-level`
- Show：`-m/--mode`、`-r/--record-file`、`-l/--record-level`
- Tx：`-t/--template`、`-m/--mode`、`-v/--vars`、`-r/--record-file`、`-l/--record-level`

常用命令级参数：

- `exec --mode <mode>` / `exec -m <mode>`：在指定模式下执行原始命令，例如 `Enable`、`Config`、`Shell`。
- `exec` 不带 `--mode`：使用当前 profile 的 `default_mode`；不会根据 `show ...`、`interface ...` 这类命令文本自动判断模式。
- `show <object>`：执行内置 show 对象，例如 `version`、`interfaces`、`route`、`arp`。
- `show --list`：列出可用 show 对象。可配合 `--device-profile` 或 `--textfsm-platform` 缩小范围。
- `show --no-parse`：关闭默认 TextFSM 解析，只展示原始输出。
- `show --print-command`：执行前打印内部解析出的设备命令。
- `show-object set/list/delete`：管理保存到 SQLite 的 profile 级自定义 show object。同一 profile 和 object 下，自定义对象会覆盖内置 show 映射。
- `--force-autodetect`：跳过本地 `host:port` autodetect 缓存，重新探测并刷新缓存。适合设备更换、同 IP/端口后的设备类型变化等特殊情况。
- `exec/template/flow --parse-textfsm`：启用 TextFSM 解析命令输出；不传时默认跳过 TextFSM，除非你指定了手动模板。
- `exec/template/flow --textfsm-platform <platform>`：在启用解析后覆盖内置 TextFSM 自动选择时推断的平台。
- `exec/template/flow --textfsm-template <path>`：使用指定 TextFSM 模板文件解析命令输出。对 `template` 和 `flow` 可以重复传多个，按命令顺序匹配；数量不足时复用最后一个模板。
- `show/exec/template/flow --textfsm-strict-errors`：严格保留 TextFSM `-> Error` 规则，不在解析前过滤。
- `show/exec/template/flow --textfsm-excel <file.xlsx>`：把 TextFSM 解析成功的表格行导出为 Excel。
- `textfsm template ...`：管理保存到 SQLite 的自定义 TextFSM 模板。
- `textfsm mapping ...`：管理自定义 `(device profile, command) -> TextFSM template` 映射。启用解析且没有显式指定模板文件时，自定义映射优先级高于内置 NTC 模板。
- `template --vars <file>` / `template -v <file>`：为已保存命令模板加载 JSON/YAML 变量文件。
- `flow --template <name>` / `flow -t <name>`：运行已保存的命令流程模板。
- `flow --file <path>` / `flow -f <path>`：从 TOML 文件运行临时命令流程模板。
- `flow --vars <file>` / `flow -v <file>` / `flow --vars-json <json>`：为命令流程模板提供文件变量或内联 JSON 变量。
- `template --dry-run`：只渲染模板，不在目标上执行。
- `tx --mode <mode>` / `tx -m <mode>`：强制 tx 命令或命令流程步骤在指定模式下运行。
- `tx --dry-run`：只打印计划中的 tx block，而不真正执行。

录制/回放相关参数（命令级参数）：

- `exec/template/flow/tx --record-file <path>` / `-r <path>`：执行后保存录制 JSONL。
- `exec/template/flow/tx --record-level <key-events-only|full>` / `-l <level>`：录制粒度。
- `replay <record_file> --list`：列出录制中的命令输出事件。
- `replay <record_file> --command <cmd> [--mode <mode>]`：回放单条命令输出。
- 回放得到的 `SessionEvent::CommandOutput` 可能额外包含 `exit_code`，尤其适用于 Linux shell 类流程。

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

Apache License 2.0
