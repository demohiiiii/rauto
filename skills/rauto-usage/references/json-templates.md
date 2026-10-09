# Transaction Workflows And Orchestration JSON

## Native Operations

New steps use `kind: "command"`, including interactive commands:

```json
{
  "kind": "command",
  "mode": "Root,User",
  "command": "example-command",
  "multiline_mode": "split_lines",
  "timeout": 30,
  "interaction": {
    "prompts": [
      {
        "patterns": ["(?i)continue\\?"],
        "response": "y\n",
        "record_input": false
      }
    ]
  }
}
```

`mode` and `command` are required strings in native JSON. Use the target
profile's actual modes, including ordered candidates; an empty mode is invalid
for execution. The Web form derives its initial mode from the selected profile,
but the CLI JSON loader does not fill omitted modes. `timeout` is optional
seconds, not the TOML field `timeout_secs`. `multiline_mode` defaults to
`split_lines`; `whole` submits the text once. Empty commands are invalid.

`interaction` and `dyn_params` have native defaults and can be omitted.
Prompt rules require regex `patterns` and a `response`. Native prompt JSON
has no `append_newline`; put the needed `\n` in the response itself.

The current rneter wire enum also accepts `kind: "flow"` with `steps`,
`stop_on_error`, and optional `max_steps`. This internal operation format is
distinct from single-command interactive TOML. Do not invent JSON
`kind: "interactive"`, `"command_flow"`, or `"template"`. For current editor
and template authoring, prefer a command with `interaction.prompts` and compose
multiple operations as workflow steps.

## Blocks And Workflows

A `TxWorkflow` requires `name`, `blocks`, and `fail_fast`. Each `TxBlock`
requires `name`, `rollback_policy`, `steps`, and `fail_fast`. Each step requires
`run`, optionally has `rollback`, and defaults `rollback_on_failure` to false.
Workflow blocks and block steps must be nonempty for execution.

This illustrative Linux workflow creates an otherwise absent directory and
supplies compensation. Preview it before any authorized real execution:

```json
{
  "name": "workflow-demo",
  "fail_fast": true,
  "blocks": [
    {
      "name": "create-demo-directory",
      "fail_fast": true,
      "rollback_policy": "per_step",
      "steps": [
        {
          "run": {
            "kind": "command",
            "mode": "Root,User",
            "command": "mkdir /tmp/rauto-demo",
            "timeout": 30
          },
          "rollback": {
            "kind": "command",
            "mode": "Root,User",
            "command": "rmdir /tmp/rauto-demo",
            "timeout": 30
          },
          "rollback_on_failure": false
        }
      ]
    }
  ]
}
```

There is no direct block execution command. A block runs inside a workflow;
for a single transaction, use a one-block workflow. Block templates remain
reusable resources in the workflow editor and `/api/tx-block-templates` CRUD.
There is no CLI block-template management subcommand.

## Rollback Behavior

| `rollback_policy` | Behavior |
| --- | --- |
| `"none"` | No block compensation |
| `"per_step"` | Reverse order of successful steps with rollback operations; the failed step participates only when `rollback_on_failure` is true |
| `{"whole_resource": {...}}` | One compensating operation, only if the trigger step succeeded |

Whole-resource example:

```json
{
  "whole_resource": {
    "trigger_step_index": 0,
    "rollback": {
      "kind": "command",
      "mode": "Root,User",
      "command": "rmdir /tmp/rauto-demo"
    }
  }
}
```

`trigger_step_index` defaults to zero and must fall within the block's steps.
`rollback_on_failure` is a step rollback setting, not an execution mode.
Successful workflows do not run their rollback operations. On workflow
failure, rneter can compensate previously committed blocks in reverse order.
Rollback is device-side compensation, not a database/SSH atomic transaction;
commands without compensation can leave changes behind. Inspect `committed`,
failure reasons, block/step results, and rollback errors, not only process exit.

## Saved Templates And Nested Blocks

```sh
rauto tx-workflow template create workflow-demo --file ./workflow.json
rauto tx-workflow template list
rauto tx-workflow --template workflow-demo --vars-json '{}' --dry-run --json
rauto orchestrate template create rollout --file ./plan.json
rauto orchestrate --template rollout --vars ./vars.json --dry-run --json
```

For saved JSON templates, rauto recursively renders string leaves with Jinja.
Context includes `vars`, flattened runtime variables, `connection`, and `now`;
available connection values depend on the selected target. Rendered strings
that parse as JSON become typed values, which permits numeric/boolean fields
such as `"{{ vars.timeout }}"`. Variable files are JSON objects.

A raw CLI file is already concrete JSON: `tx-workflow ./workflow.json` does
not render placeholders, and `--vars` does not change that. Use a saved template
or render the document before passing it as a file.

Web workflow execution and orchestration resolve nested block references:

```json
{
  "name": "block-instance",
  "tx_block_template_name": "saved-block",
  "tx_block_template_vars": {"value": "example"},
  "fail_fast": true
}
```

Use exactly one of `tx_block_template_name` or `tx_block_template_content`
(a JSON text string). Optional `name`/`fail_fast` override the expanded block.
The current standalone CLI `tx-workflow` loader does not expand these
references: materialize complete blocks for that entry point. Saving JSON
templates proves JSON syntax, not execution validity.

## Multi-Device Orchestration

```json
{
  "name": "rollout",
  "fail_fast": true,
  "rollback_on_stage_failure": true,
  "rollback_completed_stages_on_failure": false,
  "stages": [
    {
      "name": "canary",
      "strategy": "serial",
      "jobs": [
        {
          "name": "run-workflow",
          "strategy": "parallel",
          "max_parallel": 2,
          "targets": ["linux-01"],
          "target_groups": [],
          "target_tags": [],
          "action": {
            "kind": "tx_workflow",
            "workflow_template_name": "workflow-demo",
            "workflow_vars": {}
          }
        }
      ]
    }
  ]
}
```

Stages run in order. Stage `strategy` schedules jobs; job `strategy` schedules
targets. Each is `serial` or `parallel`; an explicit parallel `max_parallel`
must be positive (parallel concurrency defaults to 4). Stage `fail_fast`
defaults false; job `fail_fast` defaults true. They do not inherit plan
`fail_fast`, which defaults true. Both plan compensation flags default false.
Decide these explicitly for changes that must be compensated.

Every job selects saved connection names via `targets`, group names via
`target_groups`, or labels via `target_tags`. Selectors form a deduplicated
union; each job must resolve at least one target. Inline host/credential
objects and inventory file paths are unsupported.

Only `action.kind: "tx_workflow"` exists. Supply exactly one of a concrete
inline `workflow` object or `workflow_template_name`. `workflow_vars` is valid
only for a saved workflow template. Saved workflow/block templates render per
target during execution. Orchestration dry-run checks the plan and expands
selectors, but does not render or validate every action's workflow.

`rollback_on_stage_failure` compensates successful targets of a failed stage;
`rollback_completed_stages_on_failure` compensates successful earlier stages.
The failed target's workflow handles its own block rollback. Compensation is
derived from workflow rollback operations; inspect each target's
`compensation` result for attempted/skipped/failed operations.

Use [Validation](json-validation.md) before presenting a plan as checked.
Source contracts: `src/domain/orchestration/mod.rs`, `src/orchestrator.rs`,
`src/orchestrator/template_resolver.rs`, `src/cli/tx_workflow.rs`, and the
rneter `session`/`session::transaction` models pinned by `Cargo.lock`.
