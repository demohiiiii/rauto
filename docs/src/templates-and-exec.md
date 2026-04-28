# Templates and Direct Execution

The two most fundamental and frequently used `rauto` capabilities are:

- `rauto exec`: execute a command directly
- `rauto template`: render a template into commands and execute the result

## Direct execution

This mode is best for temporary commands, troubleshooting, and one-time validation.

```bash
rauto exec "show version" \
  --connection lab1
```

If the target needs a specific execution mode, specify it explicitly:

```bash
rauto exec "show bgp neighbor" \
  --connection lab1 \
  --mode Enable
```

### When to prefer `exec`

- you only need one command or a few simple commands
- the command content does not need parameterization
- fast validation is more important than reuse

## Template execution

Templates are a good fit when the command structure stays stable but the parameters change.

Examples include:

- VLAN provisioning
- ACL rollout
- BGP neighbor configuration
- bulk user creation

### Basic example

```bash
rauto template configure_vlan.j2 \
  --vars ./vars.json \
  --connection lab1
```

Here:

- `configure_vlan.j2` is the template name stored in `rauto`
- `vars.json` is the template variable file

## Dry-run mode

Templates are especially useful because you can preview before you execute:

```bash
rauto template configure_vlan.j2 \
  --vars ./vars.json \
  --dry-run
```

This should usually be part of your standard production workflow.

## Managing templates

```bash
rauto templates list
rauto templates show configure_vlan.j2
rauto templates create configure_vlan.j2 --file ./configure_vlan.j2
rauto templates update configure_vlan.j2 --file ./configure_vlan.j2
rauto templates delete configure_vlan.j2
```

Templates can also be managed in the Web UI.

## Example template

Here is a very simple Jinja example:

```jinja
vlan {{ vlan_id }}
name {{ vlan_name }}
```

Variable file:

```json
{
  "vlan_id": 120,
  "vlan_name": "STAFF"
}
```

It will render to:

```text
vlan 120
name STAFF
```

## When to upgrade from `exec` to `template`

Move to a template when any of the following becomes true:

- the same kind of command needs to run many times
- the logic is stable but only the parameters change
- you want to reduce the risk of hand-built commands
- you want the same execution model reused across CLI, Web, and orchestration

## Recording and audit

Both `exec` and `template` support recording:

```bash
rauto exec "show version" \
  --connection lab1 \
  --record-file ./session.jsonl \
  --record-level full
```

Common recording levels:

- `key-events-only`
- `full`

Recorded files are useful for replay, troubleshooting, and task audit trails.

## Recommended practice

- use `exec` for one-off commands
- template repeated configuration logic early
- prefer `--dry-run` before production execution
- enable recording for important operations

## Next steps

Continue with:

- [Command Flows and Upload](./flows-and-upload.md)
- [Transactions, Workflows, and Orchestration](./transactions-and-orchestration.md)
