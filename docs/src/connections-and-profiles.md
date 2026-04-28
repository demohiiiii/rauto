# Connections and Device Profiles

This chapter explains how `rauto` identifies a target device, and why the device profile is a core part of reliable execution.

## Two ways to define a target

`rauto` supports two connection sources:

- temporary connections provided directly on the command line through `--host`, `--username`, and `--password`
- saved connections that are stored under a name and reused later with `--connection <name>`

### Temporary connection example

```bash
rauto exec "show ip int br" \
  --host 192.168.1.1 \
  --username admin \
  --password secret \
  --device-profile cisco
```

This is a good fit for:

- quick validation
- one-off troubleshooting
- targets you have not decided to keep as reusable assets yet

### Saved connection example

```bash
rauto connection add lab1 \
  --host 192.168.1.1 \
  --username admin \
  --password secret \
  --device-profile cisco \
  --ssh-security balanced
```

Then you can reuse it:

```bash
rauto exec "show version" --connection lab1
```

This is a good fit for:

- frequently used devices
- repeated execution
- targets that should be reused by orchestration, inventory, and the Web UI

## Common saved-connection commands

```bash
rauto connection list
rauto connection show lab1
rauto connection delete lab1
```

Bulk import is also supported:

```bash
rauto connection import ./devices.csv
rauto connection import ./devices.xlsx
```

## What is a device profile?

A device profile decides:

- how prompts are detected
- how execution modes are switched
- how command completion is identified
- how device-specific interaction is handled

Built-in profiles cover common network vendors and Linux targets:

- network devices: `cisco`, `huawei`, `h3c`, `juniper`, `fortinet`, and more
- servers: `linux`

List available profiles:

```bash
rauto device list
```

Inspect a specific profile:

```bash
rauto device show cisco
rauto device show linux
```

## Custom profiles

You can copy a built-in profile and adapt it for your own environment:

```bash
rauto device copy-builtin cisco my_cisco
rauto device show my_cisco
```

Delete a custom profile when you no longer need it:

```bash
rauto device delete-custom my_cisco
```

If you see issues such as:

- incorrect prompt detection
- broken mode switching
- truncated or incomplete command output

the device profile is one of the first places to inspect.

## SSH compatibility profile

Saved connections can also control SSH compatibility through:

- `secure`
- `balanced`
- `legacy-compatible`

Example:

```bash
rauto connection add old-fw \
  --host 192.168.1.254 \
  --username admin \
  --password secret \
  --device-profile fortinet \
  --ssh-security legacy-compatible
```

## Linux shell flavor

For Linux targets, you can also choose a shell flavor:

- `posix`
- `fish`

This affects behaviors such as exit-code parsing.

## Recommended practice

- validate a target once with a temporary connection first
- save the connection after you confirm the profile works correctly
- check `ssh-security` early for older production devices
- keep reusable targets as saved connections so inventory and orchestration can share them

## Next steps

Continue with:

- [Templates and Direct Execution](./templates-and-exec.md)
- [Inventory, History, and Operations](./inventory-and-operations.md)
