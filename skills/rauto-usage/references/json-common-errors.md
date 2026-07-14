# JSON Common Errors and Fixes

Use this file when generated tx/workflow/orchestration JSON fails validation or dry-run.

Focus on converting real `rauto` failure messages into the smallest safe fix.

## 1) Tx Block

### Error

`missing field 'rollback_policy'`

### Cause

`TxBlock` requires `rollback_policy`.

### Fix

Add one of:

```json
"rollback_policy": "none"
```

```json
"rollback_policy": "per_step"
```

```json
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
}
```

### Error

`block has no steps`

### Cause

`steps` is missing or empty.

### Fix

Add at least one step:

```json
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
```

### Error

`step[0] forward operation: command mode is empty`

### Cause

`run.mode` is missing or empty for a `command` operation.

### Fix

Set a real mode such as `User`, `Enable`, `Config`, or the first mode of the selected profile.

### Error

`whole_resource trigger_step_index out of range`

### Cause

`trigger_step_index` is greater than available step indices.

### Fix

If block has `N` steps, valid indices are `0..N-1`.

## 2) Tx Workflow

### Error

`missing field 'blocks'`

### Cause

Workflow root must include `blocks`.

### Fix

Use workflow root shape:

```json
{
  "name": "demo-workflow",
  "fail_fast": true,
  "blocks": []
}
```

### Error

`tx workflow template not found`

### Cause

`workflow_template_name` references a template that does not exist in SQLite.

### Fix

Either:

- switch to an existing saved workflow template name
- use `workflow_template_content`
- use inline `workflow`
- use `workflow_file`

### Error

`tx block template not found`

### Cause

One workflow block uses `tx_block_template_name`, but that template is missing.

### Fix

Either create the referenced tx block template first or replace the block with inline tx block JSON.

### Error

`missing field 'rollback_policy' at line ...`

### Cause

A workflow block was written as inline `TxBlock` JSON but omitted `rollback_policy`.

### Fix

Every inline block must be a valid full `TxBlock`.

Wrong:

```json
{
  "name": "precheck",
  "steps": []
}
```

Correct:

```json
{
  "name": "precheck",
  "rollback_policy": "none",
  "fail_fast": true,
  "steps": [
    {
      "run": {
        "kind": "command",
        "mode": "User",
        "command": "date",
        "timeout": 30
      },
      "rollback": null,
      "rollback_on_failure": false
    }
  ]
}
```

## 3) Orchestration

### Error

`orchestration plan must contain at least one stage`

### Cause

`stages` is missing or empty.

### Fix

Add at least one stage with `name`, `strategy`, target scope, and action.

### Error

`stage 'publish' must contain at least one target or target_groups entry`

### Cause

Stage has no execution targets.

### Fix

Use one of:

```json
"targets": ["edge92", "edge94"]
```

or

```json
"target_groups": ["edge_nodes"]
```

### Error

`stage 'publish' tx_workflow requires exactly one source: workflow_file/workflow/workflow_template_name/workflow_template_content`

### Cause

No source or multiple workflow sources were set.

### Fix

Keep exactly one of:

- `workflow_file`
- `workflow`
- `workflow_template_name`
- `workflow_template_content`

### Error

`stage 'edge' tx_block template source cannot be combined with template/commands`

### Cause

`tx_block_template_name` or `tx_block_template_content` was mixed with `template` / `commands`.

### Fix

Choose exactly one tx-block source style:

- template source:
  - `tx_block_template_name` or `tx_block_template_content`
- command source:
  - `template` and/or `commands`

### Error

`stage 'publish' resolved no targets`

### Cause

`target_groups` points to an empty or missing inventory group, or all targets collapse after merge.

### Fix

Check:

- `inventory_file` path
- inline `inventory.groups`
- spelling of `target_groups`
- whether the selected group actually contains targets

## 4) Command / Flow Operation Mixups

### Error

`unknown variant 'command_flow'` or similar operation-kind failure

### Cause

Current runtime model uses:

- `kind: "command"`
- `kind: "flow"`

It does not use `kind: "command_flow"` or `kind: "template"`.

### Fix

Replace:

```json
"kind": "command_flow"
```

with:

```json
"kind": "flow"
```

and provide a valid `CommandFlow` object with `steps`.

## 5) Repair Strategy

When fixing invalid JSON, prefer this order:

1. Fix root shape first.
2. Fix missing required fields.
3. Fix invalid operation kinds.
4. Fix source-selection conflicts (`template` vs inline vs file).
5. Fix rollback details.
6. Re-run validator and only then propose execution.
