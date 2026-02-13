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

### 4. Web Console (Axum)

Start the built-in web service and open the visual console in your browser:

```bash
npm install
npm run tailwind:build
rauto web --bind 127.0.0.1 --port 3000 --host 192.168.1.1 --username admin
```

Then visit `http://127.0.0.1:3000`.

The web console currently supports:
- Rendering command templates
- Executing a raw command
- Rendering + executing a template
- Listing built-in device profiles

Web static assets are under `static/`:
- `static/index.html`
- `static/app.js`
- `static/input.css` (Tailwind source)
- `static/output.css` (generated CSS)

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

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT
