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

## Rendered command preview

The transaction workflow and orchestration Web pages share a **Preview commands**
action in the execution bar. It renders the current source and runtime variables,
expands loops and choices, resolves block/workflow templates, and displays complete
commands, interactive responses and configured rollbacks. Orchestration previews
are resolved separately for each stage/job/target using its saved connection.
The dialog also provides the rendered workflow JSON. Changed inputs invalidate
the preview; use **Render again** to update it.

Previews do not open device sessions or create execution-history entries. They
show commands prepared before execution; rollback execution still depends on
failure and trigger policies. Authentication secrets are masked in previews.

HTTP clients use `POST /api/tx/workflow` with `dry_run: true` and
`preview_commands: true` for a workflow; the flag requires a resolved target and
masks authentication material while preserving the original dry-run contract.
For orchestration, use `POST /api/orchestrate` with both `dry_run: true` and
`preview_commands: true`; the response adds `rendered_workflows`, containing
stage/job indices and names, target connection/host, and the fully rendered
workflow. Omitting `preview_commands` preserves the existing plan-only dry run.
The agent gRPC orchestration request supports the same flag and returns
`rendered_workflows_json`. CLI dry-run flags retain their existing output; the
per-device preview selector is a Web capability.

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

## Controls inside a transaction block

A transaction block's `steps` also accepts loops and choices. Use `steps`
instead of `blocks` for their bodies and condition branches. The canvas provides
Command, Loop, and Choice actions inside each block and each nested body. Select
an individual command or rollback command to open its existing editor. The same
components are used by transaction workflows and orchestration.

```json
{
  "name": "addresses",
  "rollback_policy": "per_step",
  "fail_fast": true,
  "steps": [
    {
      "kind": "loop",
      "iterations": "vars.addresses",
      "item_variable": "address",
      "steps": [
        {
          "kind": "choice",
          "branches": [
            {
              "condition": "address.enabled",
              "steps": [
                {
                  "run": {
                    "kind": "command",
                    "mode": "Config",
                    "command": "ip address {{ address.value }}"
                  },
                  "rollback": {
                    "kind": "command",
                    "mode": "Config",
                    "command": "no ip address {{ address.value }}"
                  },
                  "rollback_on_failure": true
                }
              ]
            }
          ],
          "else": []
        }
      ]
    }
  ]
}
```

For example, supply `{"addresses":[{"value":"192.0.2.1","enabled":true}]}`
as runtime variables. Item variables, `vars.address`, and `loop` metadata are
scoped exactly as for workflow-level controls; nested controls restore their
parent scope. All expressions are evaluated before execution using runtime
variables and device context. They cannot depend on the output of earlier commands.

Expansion retains **one transaction block** and its rollback policy. Per-command
rollback remains paired with its run command, including `rollback_on_failure`.
The rendered-command preview shows the flattened commands and their rollbacks.
A skipped branch or zero-iteration loop adds no commands. If expansion leaves
an entire transaction block empty, validation rejects it before opening a device
session. The shared 16-level nesting and 1,000-node expansion limits apply
across both workflow-level and command-level controls.

With `whole_resource`, `trigger_step_index` is a zero-based index into the
**source** `steps` array. If the selected source slot is a control, the trigger
maps to its final expanded command; the whole-resource rollback becomes eligible
when that command succeeds. Controls before the trigger shift its concrete
index automatically. A trigger pointing at a control that expands to no commands
is rejected instead of silently targeting another command.

The existing Web, CLI, schedule, and orchestration workflow entry points expand
these structures before passing concrete commands to rneter. Saved workflow and
block templates use the same expansion where template references are supported;
standalone CLI workflows continue to require concrete blocks. No new endpoint
is required.
