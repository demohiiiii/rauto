# JSON Authoring Guide (Tx Block / Tx Workflow / Orchestrate)

Use this guide when creating runnable JSON for:

- Web/API tx-block execution payloads
- `rauto tx-workflow <workflow-file>`
- `rauto orchestrate <plan-file>`
- saved JSON templates executed with `--template`

## Authoring Workflow

1. Pick target type (`tx-block`, `tx-workflow`, `orchestration`).
2. Start from the closest template below.
3. Fill connection-sensitive vars with placeholders (`{{peer.host}}`, `{{password}}`, etc.).
4. Validate before execution using `scripts/validate_json_plans.py`.
5. Run native CLI dry-run first for `tx-workflow` / `orchestrate` when available.

## 1) Tx Block JSON

Tx block JSON is a single `TxBlock` object, not a wrapper.

Notes:

- This shape is used directly by Web/API execution and template rendering.
- Current CLI `rauto tx` is still parameter-driven, not `rauto tx <file>`.
- The bundled validator checks tx-block JSON by wrapping it into a temporary one-block workflow and delegating validation to `rauto tx-workflow --dry-run`.

### 1.1 Basic command operation (recommended baseline)

```json
{
  "name": "linux-load-and-restart",
  "rollback_policy": "per_step",
  "fail_fast": true,
  "steps": [
    {
      "run": {
        "kind": "command",
        "mode": "User",
        "command": "docker load -i /tmp/app.tar",
        "timeout": 900
      },
      "rollback": null,
      "rollback_on_failure": false
    },
    {
      "run": {
        "kind": "command",
        "mode": "User",
        "command": "cd /srv/app && docker compose down && docker compose up -d",
        "timeout": 900
      },
      "rollback": {
        "kind": "command",
        "mode": "User",
        "command": "cd /srv/app && docker compose up -d",
        "timeout": 900
      },
      "rollback_on_failure": true
    }
  ]
}
```

### 1.2 `flow` operation inside tx step

Use this when one step itself is multi-command interactive logic.

```json
{
  "name": "interactive-upgrade-step",
  "rollback_policy": "none",
  "fail_fast": true,
  "steps": [
    {
      "run": {
        "kind": "flow",
        "steps": [
          {
            "mode": "Enable",
            "command": "copy scp: flash:/new.bin",
            "timeout": 300,
            "interaction": {
              "prompts": [
                {
                  "patterns": ["Address or name of remote host"],
                  "response": "192.168.1.50\n"
                }
              ]
            }
          }
        ],
        "stop_on_error": true
      },
      "rollback": null,
      "rollback_on_failure": false
    }
  ]
}
```

### 1.3 Whole-resource rollback policy

```json
{
  "name": "core-policy-publish",
  "rollback_policy": {
    "whole_resource": {
      "rollback": {
        "kind": "command",
        "mode": "Config",
        "command": "rollback configuration last 1",
        "timeout": 120
      },
      "trigger_step_index": 0
    }
  },
  "fail_fast": true,
  "steps": [
    {
      "run": {
        "kind": "command",
        "mode": "Config",
        "command": "set policy id 300 action permit",
        "timeout": 30
      },
      "rollback": null,
      "rollback_on_failure": false
    }
  ]
}
```

## 2) Tx Workflow JSON

Workflow file is a single `TxWorkflow` object:

- `name`
- `fail_fast`
- `blocks: []`

### 2.1 Inline blocks

```json
{
  "name": "linux-image-publish",
  "fail_fast": true,
  "blocks": [
    {
      "name": "precheck",
      "rollback_policy": "none",
      "fail_fast": true,
      "steps": [
        {
          "run": {
            "kind": "command",
            "mode": "User",
            "command": "uname -a",
            "timeout": 30
          },
          "rollback": null,
          "rollback_on_failure": false
        }
      ]
    },
    {
      "name": "apply",
      "rollback_policy": "per_step",
      "fail_fast": true,
      "steps": [
        {
          "run": {
            "kind": "command",
            "mode": "User",
            "command": "docker load -i /tmp/app.tar",
            "timeout": 900
          },
          "rollback": null,
          "rollback_on_failure": false
        }
      ]
    }
  ]
}
```

### 2.2 Block template reference in workflow

This shape is supported by rauto before workflow parsing:

```json
{
  "name": "edge-publish-by-templates",
  "fail_fast": true,
  "blocks": [
    {
      "name": "precheck",
      "fail_fast": true,
      "tx_block_template_name": "linux-precheck",
      "tx_block_template_vars": {
        "ticket": "CHG-2026-0419"
      }
    },
    {
      "name": "apply",
      "tx_block_template_name": "linux-apply",
      "tx_block_template_vars": {
        "image_file": "app.tar"
      }
    }
  ]
}
```

## 3) Orchestration JSON

Orchestration file is a single plan object:

- `name`
- `fail_fast` (optional)
- `inventory_file` or inline `inventory`
- `stages: []`

### 3.1 Tx workflow action rollout

```json
{
  "name": "dc-linux-rollout",
  "fail_fast": true,
  "inventory": {
    "groups": {
      "edge_nodes": ["edge92", "edge94"]
    }
  },
  "stages": [
    {
      "name": "publish",
      "strategy": "parallel",
      "max_parallel": 2,
      "target_groups": ["edge_nodes"],
      "action": {
        "kind": "tx_workflow",
        "workflow_template_name": "linux-image-publish",
        "workflow_vars": {
          "image_file": "app.tar"
        }
      }
    }
  ]
}
```

### 3.2 Tx block action with command source

```json
{
  "name": "switch-batch-change",
  "fail_fast": true,
  "stages": [
    {
      "name": "core",
      "strategy": "serial",
      "targets": ["core-01", "core-02"],
      "action": {
        "kind": "tx_block",
        "name": "core-vlan-120",
        "mode": "Config",
        "commands": [
          "vlan 120",
          "name STAFF"
        ],
        "rollback_commands": [
          "undo vlan 120"
        ],
        "rollback_on_failure": false
      }
    }
  ]
}
```

### 3.3 Tx block action with template source

```json
{
  "name": "switch-batch-template-change",
  "stages": [
    {
      "name": "edge",
      "strategy": "parallel",
      "targets": ["sw-01", "sw-02"],
      "action": {
        "kind": "tx_block",
        "tx_block_template_name": "switch-vlan-template",
        "tx_block_template_vars": {
          "vlan_id": 120,
          "vlan_name": "STAFF"
        }
      }
    }
  ]
}
```

## 4) Variable and Connection Reference Rules

- `{{param_name}}`: runtime vars first, then current selected connection fields.
- `{{connection_name.param_name}}`: pull from another saved connection.
- `{{edge94.host}}`, `{{edge94.username}}`, `{{edge94.password}}`: cross-connection direct access.
- Secret fields should be masked in preview/log outputs.

## 5) CLI Template Commands

Workflow/orchestration JSON template management is nested under the execution command:

```bash
rauto tx-workflow template list
rauto tx-workflow template create workflow-rollout --file ./workflow-template.json
rauto tx-workflow --template workflow-rollout --vars ./workflow-vars.json --dry-run

rauto orchestrate template list
rauto orchestrate template create campus-rollout --file ./orchestration-template.json
rauto orchestrate --template campus-rollout --vars-json '{"site":"dc-a"}' --view
```

Do not use flat command names such as `tx-workflow-template`.

Template render context includes `vars`, `now`, current connection fields, and top-level aliases for runtime vars. String values containing Jinja syntax are rendered recursively; if a rendered string parses as JSON, the JSON value is preserved.

## 6) Validation Command

```bash
# Auto-detect kind
python3 skills/rauto-usage/scripts/validate_json_plans.py --file ./plan.json

# Force one kind
python3 skills/rauto-usage/scripts/validate_json_plans.py --kind tx-workflow --file ./workflow.json

# Machine-readable report
python3 skills/rauto-usage/scripts/validate_json_plans.py --kind orchestration --file ./orchestration.json --json
```

Note: this validator calls `rauto --dry-run` internally, so it follows current runtime validation rules.
