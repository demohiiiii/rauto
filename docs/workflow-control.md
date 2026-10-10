# Workflow loops and choices

Workflow `blocks` can contain ordinary transaction blocks, reusable block
references, and nested `loop` or `choice` structures. Add them from the workflow
canvas footer, then select a structure to edit its expression and operations.
The body and choice branches reuse the transaction block editor, including
templates, interactive commands, and rollback configuration.
Loop nodes do not need a name. Add, move, copy, or delete their transaction
blocks directly on the canvas; select a body block to edit it in the inspector.
Choice nodes use a separate orange accent. Each branch displays complete block
cards with multiline commands and rollback operations. Edit conditions, add or
reorder condition branches, and manage their blocks directly on the canvas.

Control expressions are MiniJinja expressions without `{{ }}`. They are evaluated
from the workflow variables and connection context **before device execution**.
They do not inspect command output or implement retry-until-success behavior.

## Loop

`iterations` must evaluate to a nonnegative integer or a JSON list. Integer
loops set the item to `0` through `count - 1`; list loops set it to the current
element. `item_variable` defaults to `item` and must be a valid identifier that
does not replace a reserved context name such as `vars`, `connection`, or `loop`.

The item is available as both `item` and `vars.item` (or the chosen variable
name). `loop.index` starts at 1, `loop.index0` starts at 0, and `loop.first`,
`loop.last`, and `loop.length` are also available. These values are scoped to
the loop body. Nested loops restore the enclosing context when they finish.

```json
{
  "kind": "loop",
  "iterations": "vars.interfaces",
  "item_variable": "interface",
  "blocks": [
    {
      "name": "inspect-{{ interface }}",
      "fail_fast": true,
      "rollback_policy": "none",
      "steps": [
        {
          "run": {
            "kind": "command",
            "mode": "Enable",
            "command": "show interfaces {{ interface }}"
          }
        }
      ]
    }
  ]
}
```

Use `"iterations": "3"` for three repetitions. An empty list or zero count
adds no transaction blocks.

## Choice

`branches` contains one or more ordered conditions. Each `condition` must return
a boolean; the **first true branch** runs. When none matches, `else` runs
(it is optional and defaults to an empty list). A matching branch with no blocks
does nothing and does not fall through to later branches.

Only the selected branch is rendered, and conditions after the first match are
not evaluated. Variables used only in unused branches need not exist.

```json
{
  "kind": "choice",
  "name": "Optional inspection",
  "branches": [
    { "condition": "vars.environment == 'production'", "blocks": [] },
    { "condition": "vars.inspect_enabled", "blocks": [] }
  ],
  "else": []
}
```

Populate any branch with transaction blocks, block references, or additional
control structures. Comparisons such as `vars.environment == 'production'`
and boolean combinations such as `vars.enabled and vars.role == 'access'`
are supported.
Existing `condition` / `then` / `else` choices remain readable and are converted
to the branch-list format when edited in the Web workbench. Do not combine
`branches` with `condition` or `then` in one node.

## Execution and validation

CLI saved templates, Web workflow execution, scheduled workflows, and
orchestration expand controls through the same renderer. Raw CLI workflow files
with control structures also accept `--vars` or `--vars-json`; ordinary raw files
retain their existing behavior. Standalone CLI workflows still require concrete
transaction blocks rather than saved block references.

Orchestration expands inline workflows with controls separately for each target.
Their `connection` values belong to that target, and shared values come from
`plan_vars` (CLI template `--vars` / `--vars-json`). Saved workflow templates
continue to use their job's `workflow_vars`. Plan previews and orchestration
dry runs retain the inline controls until targets are resolved for execution.

```sh
rauto tx-workflow workflow.json --vars-json '{"interfaces":["Gi0/1","Gi0/2"]}' --dry-run --json
```

The expanded workflow runs through rneter's existing transaction executor.
Iteration and branch blocks retain their rollback operations; a later failure
can roll back committed blocks from earlier iterations in reverse order.
Execution results and recordings describe the expanded blocks in execution order.

Control nesting is limited to 16 levels. Expansion is limited to 1,000 visited
nodes, iterations, and condition checks combined. A loop may contain at most
1,000 items, and a choice may contain at most 1,000 conditions.
Invalid expressions, undefined values, negative/fractional counts, and nonboolean
conditions fail before commands are sent. The final workflow must contain at
least one valid transaction block, following the existing rneter invariant.
