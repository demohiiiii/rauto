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

## Case 4: Network switch config change (orchestration + tx_block template source)

- Goal: push same config block to many switches.
- Recommended: orchestration stage using `tx_block_template_name`.
- Key points:
  - no mixing `tx_block_template_*` with inline `commands/template`
  - pass per-target vars through `tx_block_template_vars`

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
