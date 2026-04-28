# Transactions, Workflows, and Orchestration

This chapter covers one of the most powerful parts of `rauto`.

You can think about these features as three layers of abstraction:

- `tx`: a single transaction block on one device
- `tx-workflow`: multiple transaction blocks combined into a structured workflow on one device
- `orchestrate`: staged rollout across multiple devices

## `tx`: a single transaction block

This is a good fit when:

- a change contains only a small number of steps
- you want rollback logic for each step
- or you want a shared rollback action when the block fails

### Example: per-step rollback

```bash
rauto tx \
  --name vlan-change \
  --command "vlan 120" \
  --command "name campus-users" \
  --rollback-command "no vlan 120" \
  --rollback-command "default name" \
  --rollback-on-failure \
  --mode Config \
  --connection core-01
```

### Example: flow-driven transaction

```bash
rauto tx \
  --run-kind command-flow \
  --flow-template cisco_like_copy \
  --flow-vars ./flow-vars.json \
  --rollback-flow-file ./rollback-flow.toml \
  --connection core-01
```

### Common flags

- `--dry-run`: print the normalized execution plan only
- `--json`: output JSON results
- `--record-file` / `--record-level`: preserve execution recording

## `tx-workflow`: structured transaction workflow

When one change contains multiple blocks, each with its own failure strategy and rollback behavior, `tx-workflow` is usually the better fit.

### Preview or inspect a workflow

```bash
rauto tx-workflow ./workflow.json --view
rauto tx-workflow ./workflow.json --dry-run
rauto tx-workflow ./workflow.json --dry-run --json
```

### Execute a workflow

```bash
rauto tx-workflow ./workflow.json \
  --connection core-01
```

### Good use cases

- firewall policy publication
- staged delivery of VLANs, address objects, and policies
- multi-step changes that still stay on a single device

## `orchestrate`: multi-device rollout

When the same change must run across multiple devices in stages, serial paths, or parallel waves, use `orchestrate`.

### Common commands

```bash
rauto orchestrate ./orchestration.json --view
rauto orchestrate ./orchestration.json --dry-run
rauto orchestrate ./orchestration.json --record-level full
rauto orchestrate ./orchestration.json --json
```

### Good use cases

- core tier first, access tier second
- one stage runs serially while another runs in parallel
- every device runs the same action but with different variables
- rollback or compensation is needed when a stage fails

## How to choose between them

### Use `tx`

Use it when:

- only one device is involved
- the number of steps is small
- you want to organize execution directly on the command line

### Use `tx-workflow`

Use it when:

- only one device is involved
- the structure is more complex than a simple `tx`
- you want the execution model captured in a JSON file

### Use `orchestrate`

Use it when:

- multiple devices are involved
- execution is split into multiple stages
- serial, parallel, or grouped target strategies are required

## Relationship with Inventory

`orchestrate` can select targets through an inventory file or Inventory groups.

That means you can organize devices such as:

- core devices
- aggregation devices
- access devices

into different target groups and let the orchestration plan execute by group.

## Recommended practice

- start with `tx --dry-run` to validate the single-device behavior
- promote stable logic into `tx-workflow`
- move to `orchestrate` once the change expands to multiple devices
- enable `--record-level full` for important releases
- rehearse rollback logic in a lab before running in production

## Next steps

Continue with:

- [Web and Agent Modes](./web-and-agent.md)
- [Inventory, History, and Operations](./inventory-and-operations.md)
