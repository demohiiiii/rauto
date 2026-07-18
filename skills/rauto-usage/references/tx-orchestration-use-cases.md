# Tx / Workflow / Orchestration Use Cases

Use these patterns as few-shot references when AI needs to generate new JSON plans.

## Case 1: Single Linux host restart (tx block)

- Goal: restart one service safely.
- Recommended: one tx block with `per_step` rollback.
- Key points:
  - step 1: stop service
  - step 2: start service
  - rollback: start service command for failed restart step

## Case 2: Single host publish pipeline (tx workflow)

- Goal: precheck -> apply -> verify on one host.
- Recommended: workflow with 3 blocks.
- Key points:
  - precheck block uses `rollback_policy: none`
  - apply block uses `rollback_policy: per_step`
  - verify block can use `whole_resource` rollback if needed

## Case 3: Multi-host staged rollout (orchestration + tx_workflow)

- Goal: run same workflow across host groups.
- Recommended: orchestration with two stages:
  - stage A serial on core nodes
  - stage B parallel on edge nodes with `max_parallel`
- Key points:
  - target scope via `target_groups`
  - action.kind = `tx_workflow`
  - source via inline `workflow` or saved `workflow_template_name`

## Case 4: Network switch config change (orchestration + workflow template)

- Goal: push same config block to many switches.
- Recommended: save a transaction workflow template and reference it from each orchestration job.
- Key points:
  - orchestration action is always `kind: "tx_workflow"`
  - select exactly one source: inline `workflow` or `workflow_template_name`
  - pass template variables through `workflow_vars`
  - tx block templates may still be expanded inside the selected workflow, but are never direct orchestration actions

## Case 5: Interactive copy flow as one tx step

- Goal: run interactive device copy command inside transaction.
- Recommended: tx block step `run.kind = flow`.
- Key points:
  - define prompt-response rules in flow steps
  - keep `stop_on_error=true`
  - decide rollback strategy explicitly (`none` or `per_step`)

## Case 6: Cross-connection parameter rendering

- Goal: source host sends files to peer host.
- Recommended:
  - vars include peer connection name
  - command strings use `{{peer.host}}`, `{{peer.username}}`, `{{peer.password}}`
- Key points:
  - plain `{{param}}` first resolves runtime vars, then current connection fields
  - secrets should be masked in previews
