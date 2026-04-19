# JSON Validation Runbook

Use this file when validating newly generated tx/workflow/orchestration JSON.

## Tool

`skills/rauto-usage/scripts/validate_json_plans.py`

This tool is **CLI-backed**:

- `tx-workflow` -> `rauto tx-workflow <file> --dry-run --json`
- `orchestration` -> `rauto orchestrate <file> --dry-run --json`
- `tx-block` -> wraps block into a temporary one-block workflow, then runs `rauto tx-workflow --dry-run --json`

## Quick Commands

```bash
# 1) Auto-detect plan kind and validate (prefer local binary if installed)
python3 skills/rauto-usage/scripts/validate_json_plans.py --file ./plan.json

# 2) Validate tx block
python3 skills/rauto-usage/scripts/validate_json_plans.py --kind tx-block --file ./tx-block.json

# 3) Validate tx workflow
python3 skills/rauto-usage/scripts/validate_json_plans.py --kind tx-workflow --file ./workflow.json

# 4) Validate orchestration
python3 skills/rauto-usage/scripts/validate_json_plans.py --kind orchestration --file ./orchestration.json

# 5) JSON output for pipelines
python3 skills/rauto-usage/scripts/validate_json_plans.py --file ./plan.json --json

# 6) Force source-tree execution (no installed binary required)
python3 skills/rauto-usage/scripts/validate_json_plans.py --file ./plan.json --rauto-bin "cargo run --quiet --"
```

## What This Validation Guarantees

- The JSON can be parsed by current `rauto` implementation for the target command.
- Current in-code validation checks in `rauto` pass (the same checks used before real execution).
- Future model/schema changes in `rauto` are automatically inherited by this validator.

## Common Failure Classes

- Invalid JSON syntax before `rauto` runs.
- Missing required fields such as `rollback_policy`, `steps`, `blocks`, or `stages`.
- Invalid `SessionOperation.kind` values.
- Invalid `whole_resource.trigger_step_index`.
- Invalid workflow or orchestration source combinations.
- Invalid stage strategy or unresolved orchestration inventory usage.

## Recommended Workflow

1. Generate JSON from template or AI output.
2. Run validator script and fix all errors.
   If dry-run output is unclear, check `references/json-common-errors.md` for direct repair patterns.
3. If the plan is for direct CLI execution, run the matching native dry-run manually:
   - `rauto tx-workflow ... --dry-run`
   - `rauto orchestrate ... --dry-run`
4. Execute actual run.
