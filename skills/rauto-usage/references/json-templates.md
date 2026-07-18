# JSON Authoring Guide (Tx Block / Tx Workflow / Orchestrate)

Use this guide when creating runnable JSON for:

- reusable tx-block authoring units embedded in workflows or orchestration
- `rauto tx-workflow <workflow-file>`
- `rauto orchestrate <plan-file>`
- saved JSON templates executed with `--template`

## Authoring Workflow

1. Pick target type (`tx-block`, `tx-workflow`, `orchestration`).
2. Start from the closest template below.
3. Fill connection-sensitive vars with placeholders (`{{peer.host}}`, `{{password}}`, etc.).
4. Validate before execution using `scripts/validate_json_plans.py`.
5. Run native CLI dry-run first for `tx-workflow` / `orchestrate` when available.

Use this JSON family for config-changing work. For read-only state/config retrieval, prefer `rauto show` instead of authoring a transaction solely to run show commands.
When a config change benefits from prechecks, add `show`-equivalent read commands as precheck steps before the change block or run `rauto show` separately first.

## 1) Tx Block JSON

Tx block JSON is a single `TxBlock` object, not a wrapper.

Notes:

- This shape is used for tx-block template rendering and as an inline unit in larger JSON plans.
- Current CLI `rauto tx` is still parameter-driven, not `rauto tx <file>`.
- The bundled validator checks tx-block JSON by wrapping it into a temporary one-block workflow and delegating validation to `rauto tx-workflow --dry-run`.
- Use only operation kinds `command` and `flow`; do not create a `kind: "template"` operation.
- Write `multiline_mode` explicitly for commands, rollback commands, and flow steps. Use `split_lines` unless the complete text must be submitted once.

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
        "multiline_mode": "split_lines",
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
        "multiline_mode": "split_lines",
        "timeout": 900
      },
      "rollback": {
        "kind": "command",
        "mode": "User",
        "command": "cd /srv/app && docker compose up -d",
        "multiline_mode": "split_lines",
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
            "multiline_mode": "split_lines",
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
- `stages: []`; each stage contains `jobs: []`
- Each job selects saved connections through `targets`, `target_groups`, or `target_tags`
- Every `targets` entry must be a saved connection name; inline target objects are rejected
- Do not add `inventory` or `inventory_file`; groups are persisted rauto resources
- Device groups contain saved-device membership only; group variables and target overrides are not supported
- Multiple direct/group/tag selectors use union semantics and deduplicate by saved-device name

### 3.1 Tx workflow action rollout

```json
{
  "name": "dc-linux-rollout",
  "fail_fast": true,
  "stages": [
    {
      "name": "publish",
      "strategy": "parallel",
      "max_parallel": 2,
      "jobs": [
        {
          "name": "publish-image",
          "strategy": "parallel",
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
  ]
}
```

### 3.2 Inline transaction workflow action

```json
{
  "name": "switch-batch-change",
  "fail_fast": true,
  "stages": [
    {
      "name": "core",
      "strategy": "serial",
      "jobs": [
        {
          "name": "core-vlan-120",
          "strategy": "serial",
          "targets": ["core-01", "core-02"],
          "action": {
            "kind": "tx_workflow",
            "workflow": {
              "name": "switch-vlan-change",
              "fail_fast": true,
              "blocks": [
                {
                  "name": "configure-vlan",
                  "rollback_policy": "per_step",
                  "steps": [
                    {
                      "run": {
                        "kind": "command",
                        "mode": "Config",
                        "command": "vlan 120\nname STAFF"
                      },
                      "rollback": {
                        "kind": "command",
                        "mode": "Config",
                        "command": "no vlan 120"
                      }
                    }
                  ]
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

### 3.3 Saved workflow template action

```json
{
  "name": "switch-batch-template-change",
  "stages": [
    {
      "name": "edge",
      "strategy": "parallel",
      "jobs": [
        {
          "name": "edge-vlan",
          "strategy": "parallel",
          "targets": ["sw-01", "sw-02"],
          "action": {
            "kind": "tx_workflow",
            "workflow_template_name": "switch-vlan-workflow",
            "workflow_vars": {
              "vlan_id": 120,
              "vlan_name": "STAFF"
            }
          }
        }
      ]
    }
  ]
}
```

Every orchestration action is `kind: "tx_workflow"`. Use exactly one of
`workflow` or `workflow_template_name`; `workflow_vars` is only valid with a
saved workflow template.

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
