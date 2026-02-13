# rauto - Network Device Automation CLI

[![Crates.io](https://img.shields.io/crates/v/rauto.svg)](https://crates.io/crates/rauto)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[中文文档](README_zh.md)

`rauto` is a powerful CLI tool for network device automation, written in Rust. It leverages the [rneter](https://github.com/demohiiiii/rneter) library for intelligent SSH connection management and utilizes [minijinja](https://github.com/mitsuhiko/minijinja) for flexible command templating.

## Features

- **Double Template System**: Command Templates (Jinja2) & Device Profiles (TOML).
- **Intelligent Connection Handling**: Uses `rneter` for SSH state management.
- **Dry Run Support**: Preview commands before execution.
- **Variable Injection**: Load variables from JSON.
- **Extensible**: Custom TOML device profiles.
- **Built-in Web Console**: Start browser UI with `rauto web`.
- **Embedded Web Assets**: Frontend files are embedded into the binary for release usage.

## Installation

### From Binary (Recommended)

Download the latest release for your platform from [GitHub Releases](https://github.com/demohiiiii/rauto/releases).

### From Crates.io

```bash
cargo install rauto
```

### From Source

Ensure you have Rust and Cargo installed.

```bash
git clone https://github.com/demohiiiii/rauto.git
cd rauto
cargo build --release
```

The binary will be available at `target/release/rauto`.

## Usage

### 1. Template Mode (Recommended)

Render commands from a template and execute them on a device.

**Basic Usage:**
```bash
rauto template show_version.j2 \
    --host 192.168.1.1 \
    --username admin \
    --password secret \
    --ssh-port 22
```

**With Variables:**
Given a template `templates/commands/configure_vlan.j2` and variables file `templates/example_vars.json`:

```bash
rauto template configure_vlan.j2 \
    --vars templates/example_vars.json \
    --host 192.168.1.1 \
    --username admin \
    --password secret \
    --ssh-port 22
```

**Dry Run (Preview):**
```bash
rauto template configure_vlan.j2 \
    --vars templates/example_vars.json \
    --dry-run
```

### 2. Direct Execution

Execute raw commands directly without templates.

```bash
rauto exec "show ip int br" \
    --host 192.168.1.1 \
    --username admin \
    --password secret \
    --ssh-port 22
```

**Specifying Execution Mode:**
Execute a command in a specific mode (e.g., `Enable`, `Config`).

```bash
rauto exec "show bgp neighbor" \
    --host 192.168.1.1 \
    --username admin \
    --password secret \
    --ssh-port 22 \
    --mode Enable
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
rauto template show_ver.j2 \
    --host 192.168.1.1 \
    --username admin \
    --password secret \
    --ssh-port 22 \
    --device-profile huawei
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
rauto exec "show ver" \
    --host 192.168.1.1 \
    --username admin \
    --password secret \
    --ssh-port 22 \
    --device-profile custom_cisco
```

**Useful profile management commands:**
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

### 4. Web Console (Axum)

Start the built-in web service and open the visual console in your browser:

```bash
rauto web \
    --bind 127.0.0.1 \
    --port 3000 \
    --host 192.168.1.1 \
    --username admin \
    --password secret \
    --ssh-port 22
```

Then visit `http://127.0.0.1:3000`.

Web assets are embedded into the binary at build time.  
For released binaries, users only need to run the executable (no extra `static/` files required at runtime).

### 5. Template Storage Commands

```bash
rauto templates list
rauto templates show show_version.j2
rauto templates delete show_version.j2
```

### 6. CLI Quick Reference

**Connection troubleshooting**
```bash
rauto device test-connection \
    --host 192.168.1.1 \
    --username admin \
    --password secret \
    --ssh-port 22
```

**Profile management**
```bash
rauto device list
rauto device show cisco
rauto device copy-builtin cisco my_cisco
rauto device show my_cisco
rauto device delete-custom my_cisco
```

**Template storage management**
```bash
rauto templates list
rauto templates show show_version.j2
rauto templates delete show_version.j2
```

**Start web console**
```bash
rauto web \
    --bind 127.0.0.1 \
    --port 3000
```

## Directory Structure

By default, `rauto` stores and reads templates under `~/.rauto/templates/`.

Default directories:
- `~/.rauto/templates/commands`
- `~/.rauto/templates/devices`

These folders are auto-created on startup.

For backward compatibility, local `./templates/` is still checked as a fallback.

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
| `--ssh-port` | - | SSH port (default: 22) |
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

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT
