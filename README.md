# rauto - Network Device Automation CLI

[中文文档](README_zh.md)

`rauto` is a powerful CLI tool for network device automation, written in Rust. It leverages the [rneter](https://github.com/demohiiiii/rneter) library for intelligent SSH connection management and utilizes [minijinja](https://github.com/mitsuhiko/minijinja) for flexible command templating.

## Features

- **Double Template System**:
  - **Command Templates**: Generate complex command sets using Jinja2 templates (supports variables, loops, conditionals).
  - **Device Profiles**: Define device-specific connection parameters, prompts, and state transitions using TOML or built-in presets.
- **Intelligent Connection Handling**: Uses `rneter` to manage SSH sessions, automatically detecting prompts and handling state transitions (e.g., automatically entering "Enable" or "Config" mode).
- **Dry Run Support**: Preview rendered commands before executing them on actual devices.
- **Variable Injection**: Load template variables from JSON files.
- **Extensible**: Easily add support for new device types via custom TOML profiles.

## Installation

Ensure you have Rust and Cargo installed.

```bash
git clone https://github.com/yourusername/rauto.git
cd rauto
cargo build --release
```

The binary will be available at `target/release/rauto`.

## Usage

### 1. Template Mode (Recommended)

Render commands from a template and execute them on a device.

**Basic Usage:**
```bash
rauto template show_version.j2 --host 192.168.1.1 --username admin --password secret
```

**With Variables:**
Given a template `templates/commands/configure_vlan.j2` and variables file `templates/example_vars.json`:

```bash
rauto template configure_vlan.j2 \
    --vars templates/example_vars.json \
    --host 192.168.1.1 \
    --username admin
```

**Dry Run (Preview):**
```bash
rauto template configure_vlan.j2 --vars templates/example_vars.json --dry-run
```

### 2. Direct Execution

Execute raw commands directly without templates.

```bash
rauto exec "show ip int br" --host 192.168.1.1 --username admin
```

**Specifying Execution Mode:**
Execute a command in a specific mode (e.g., `Enable`, `Config`).

```bash
rauto exec "show bgp neighbor" --host 192.168.1.1 --mode Enable
```

### 3. Device Profiles

`rauto` supports built-in device profiles (inherited from `rneter`) and custom TOML profiles.

**List Available Profiles:**
```bash
rauto device list
```

**Using a Specific Profile:**
Default is `cisco`. To use Huawei VRP:

```bash
rauto template show_ver.j2 --host 1.2.3.4 --device-profile huawei
```

**Custom Device Profile:**
You can define custom profiles in `templates/devices/*.toml`.

Example `templates/devices/custom_cisco.toml`:
```toml
name = "custom_cisco"

[[prompts]]
state = "Enable"
patterns = ['^[^\s#]+#\s*$']

# ... see templates/devices/custom_cisco.toml for full example
```

Use it:
```bash
rauto exec "show ver" --host 1.2.3.4 --device-profile custom_cisco
```

## Directory Structure

By default, `rauto` looks for templates in the `templates/` directory in the current working directory.

```
.
├── templates/
│   ├── commands/           # Store your .j2 command templates here
│   │   ├── configure_vlan.j2
│   │   └── show_version.j2
│   ├── devices/            # Store custom .toml device profiles here
│   │   └── custom_cisco.toml
│   └── example_vars.json   # Example variable files
└── src/
```

You can specify a custom template directory using the `--template-dir` argument or `RAUTO_TEMPLATE_DIR` environment variable.

## Configuration

| Argument | Env Var | Description |
|----------|---------|-------------|
| `--host` | - | Device hostname or IP |
| `--username` | - | SSH username |
| `--password` | `RAUTO_PASSWORD` | SSH password |
| `--enable-password` | - | Enable/Secret password |
| `--port` | - | SSH port (default: 22) |
| `--device-profile` | - | Device type (default: cisco) |

## Template Syntax

`rauto` uses Minijinja, which is compatible with Jinja2.

**Example `configure_vlan.j2`:**
```jinja
conf t
{% for vlan in vlans %}
vlan {{ vlan.id }}
 name {{ vlan.name }}
{% endfor %}
end
```

**Example variables:**
```json
{
  "vlans": [
    { "id": 10, "name": "Marketing" },
    { "id": 20, "name": "Engineering" }
  ]
}
```

## License

MIT
