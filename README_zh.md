# rauto - 网络设备自动化 CLI

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[English Documentation](README.md)

`rauto` 是一个用 Rust 编写的强大的网络设备自动化 CLI 工具。它利用 [rneter](https://github.com/demohiiiii/rneter) 库进行智能 SSH 连接管理，并使用 [minijinja](https://github.com/mitsuhiko/minijinja) 实现灵活的命令模板功能。

## 功能特性

- **双层模板系统**：
  - **命令模板**：使用 Jinja2 模板生成复杂的命令集（支持变量、循环、条件判断）。
  - **设备配置模板**：使用 TOML 或内置预设定义特定设备的连接参数、提示符和状态转换。
- **智能连接处理**：使用 `rneter` 管理 SSH 会话，自动检测提示符并处理状态转换（例如，自动进入 "Enable" 或 "Config" 模式）。
- **Dry Run 支持**：在实际设备上执行之前预览渲染后的命令。
- **变量注入**：从 JSON 文件加载模板变量。
- **可扩展性**：通过自定义 TOML 配置文件轻松添加对新设备类型的支持。

## 安装

确保你已经安装了 Rust 和 Cargo。

```bash
git clone https://github.com/yourusername/rauto.git
cd rauto
cargo build --release
```

编译后的二进制文件位于 `target/release/rauto`。

## 使用方法

### 1. 模板模式（推荐）

从模板渲染命令并在设备上执行。

**基本用法：**
```bash
rauto template show_version.j2 --host 192.168.1.1 --username admin --password secret
```

**使用变量：**
假设有一个模板 `templates/commands/configure_vlan.j2` 和变量文件 `templates/example_vars.json`：

```bash
rauto template configure_vlan.j2 \
    --vars templates/example_vars.json \
    --host 192.168.1.1 \
    --username admin
```

**Dry Run（预览）：**
```bash
rauto template configure_vlan.j2 --vars templates/example_vars.json --dry-run
```

### 2. 直接执行

直接执行原始命令，无需模板。

```bash
rauto exec "show ip int br" --host 192.168.1.1 --username admin
```

**指定执行模式：**
在特定模式下执行命令（例如 `Enable`, `Config`）。

```bash
rauto exec "show bgp neighbor" --host 192.168.1.1 --mode Enable
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
rauto template show_ver.j2 --host 1.2.3.4 --device-profile huawei
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
rauto exec "show ver" --host 1.2.3.4 --device-profile custom_cisco
```

## 目录结构

默认情况下，`rauto` 在当前工作目录的 `templates/` 目录中查找模板。

```
.
├── templates/
│   ├── commands/           #在此存储 .j2 命令模板
│   │   ├── configure_vlan.j2
│   │   └── show_version.j2
│   ├── devices/            # 在此存储自定义 .toml 设备配置
│   │   └── custom_cisco.toml
│   └── example_vars.json   # 示例变量文件
└── src/
```

你可以使用 `--template-dir` 参数或 `RAUTO_TEMPLATE_DIR` 环境变量指定自定义模板目录。

## 配置选项

| 参数 | 环境变量 | 描述 |
|----------|---------|-------------|
| `--host` | - | 设备主机名或 IP |
| `--username` | - | SSH 用户名 |
| `--password` | `RAUTO_PASSWORD` | SSH 密码 |
| `--enable-password` | - | Enable/Secret 密码 |
| `--port` | - | SSH 端口 (默认: 22) |
| `--device-profile` | - | 设备类型 (默认: cisco) |

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
