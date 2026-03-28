# Tx Workflow JSON Templates (EN)

Use this file when the agent needs to provide a runnable `workflow.json` for `rauto tx-workflow`.

Important: `rauto` now follows `rneter 0.4.0` transaction schema. Use `run` / `rollback` operations and `whole_resource.rollback`. Do not use the deprecated `command`, `rollback_command`, or `undo_command` fields.

## 1) Minimal per-step rollback workflow

```json
{
  "name": "minimal-vlan-workflow",
  "fail_fast": true,
  "blocks": [
    {
      "name": "vlan-10",
      "kind": "config",
      "fail_fast": true,
      "rollback_policy": "per_step",
      "steps": [
        {
          "run": {
            "kind": "command",
            "mode": "Config",
            "command": "vlan 10",
            "timeout": 10
          },
          "rollback": {
            "kind": "command",
            "mode": "Config",
            "command": "no vlan 10",
            "timeout": 10
          },
          "rollback_on_failure": false
        },
        {
          "run": {
            "kind": "command",
            "mode": "Config",
            "command": "name USERS",
            "timeout": 10
          },
          "rollback": {
            "kind": "command",
            "mode": "Config",
            "command": "no name USERS",
            "timeout": 10
          },
          "rollback_on_failure": false
        }
      ]
    }
  ]
}
```

## 2) Whole-resource rollback workflow

```json
{
  "name": "policy-publish-workflow",
  "fail_fast": true,
  "blocks": [
    {
      "name": "publish-policy",
      "kind": "config",
      "fail_fast": true,
      "rollback_policy": {
        "whole_resource": {
          "rollback": {
            "kind": "command",
            "mode": "Config",
            "command": "delete security policies from-zone trust to-zone untrust policy allow-web",
            "timeout": 10
          },
          "trigger_step_index": 0
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
          "rollback": null,
          "rollback_on_failure": false
        },
        {
          "run": {
            "kind": "command",
            "mode": "Config",
            "command": "set security policies from-zone trust to-zone untrust policy allow-web then permit",
            "timeout": 10
          },
          "rollback": null,
          "rollback_on_failure": false
        }
      ]
    }
  ]
}
```

## 3) Advanced multi-block example

See the repo examples:

- [/Users/adam/Project/rauto-all/rauto/templates/examples/core-vlan-workflow.json](/Users/adam/Project/rauto-all/rauto/templates/examples/core-vlan-workflow.json)
- [/Users/adam/Project/rauto-all/rauto/templates/examples/fabric-change-workflow.json](/Users/adam/Project/rauto-all/rauto/templates/examples/fabric-change-workflow.json)

## Run

```bash
rauto tx-workflow ./workflow.json --dry-run
rauto tx-workflow ./workflow.json --connection <connection>
rauto tx-workflow ./workflow.json --connection <connection> --record-level key-events-only
```

## Validation focus

1. Check `block_results[*].step_results` for per-step execution and rollback state.
2. Check `forward_operation_steps`, `rollback_operation_steps`, and `block_rollback_steps` when you need child-step level detail.
3. Use recording plus replay for audit if the workflow is long-running or rollback-heavy.
