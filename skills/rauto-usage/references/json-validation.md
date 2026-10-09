# JSON Checks And Their Limits

## Bundled Helper

Run `scripts/validate_json_plans.py` relative to this skill directory, not the
project directory. Select the current checkout's built binary explicitly:

```sh
python3 scripts/validate_json_plans.py --file ./workflow.json \
  --rauto-bin /path/to/rauto/target/debug/rauto --json
python3 scripts/validate_json_plans.py --kind tx-block --file ./block.json
python3 scripts/validate_json_plans.py --kind orchestration --file ./plan.json
```

Kinds are `auto`, `tx-block`, `tx-workflow`, and `orchestration`. The helper
accepts bare payloads or wrappers containing `tx_block`, `workflow`, or `plan`.
It unwraps a request before calling the CLI; connection options, vars, and other
request fields are not forwarded. Render templates first when checking these
bare payloads. A block is wrapped in a temporary one-block workflow.

Binary selection is explicit `--rauto-bin`, then `$RAUTO_BIN`, installed
`rauto`, then `cargo run --quiet --` from the current working directory. A
source fallback requires the project's toolchain and build dependencies.
`--timeout` bounds the subprocess (default 120 seconds); increase it if source
compilation needs longer. Exit 0 means the native check passed, 1 means rauto
rejected the document, and 2 means input/launch/timeout failure.

For offline fixtures, export a temporary `RAUTO_HOME`. For real group/label
resolution, use the intended runtime store within the user's requested scope.
The helper inherits `RAUTO_HOME`; it does not isolate or change it for you.

## Actual Validation Scope

| Check | What it establishes | What it does not establish |
| --- | --- | --- |
| CLI `tx-workflow <file> --dry-run --json` | Native deserialization; saved-template rendering when invoked with `--template` | `TxWorkflow.validate()`, nonempty commands/blocks, rollback trigger bounds, profile modes, blacklist, SSH execution |
| Helper `tx-block` | Same workflow deserialization for one wrapped block | Block/operation invariants or rollback effectiveness |
| CLI `orchestrate <file> --dry-run --json` | Plan rules, action source exclusivity, stage/job settings, group/label selector expansion | Direct saved-name existence/authentication, nested workflow rendering/validation, prompt matching, device execution |
| Web `POST /api/tx/workflow` with `dry_run: true` | Template rendering, nested block expansion, native workflow invariants | SSH success, profile mode compatibility, blacklist at real execution, actual compensation |
| Web saved-workflow `.../preview` | Variable rendering preview with unresolved paths | Workflow invariants, full connection context, nested block expansion, execution |

The helper reports `scope` and notes alongside `ok`. Never interpret `ok: true`
as a full execution-readiness guarantee. Native CLI workflow preview currently
accepts some structurally invalid workflows, including empty blocks and
out-of-range rollback triggers. Do not build a second full validator in a skill
to conceal those application limitations.

When a running Web service is available and full native workflow invariants
need checking, use the authenticated dry-run endpoint with this request shape:

```json
{
  "workflow": {"name": "example", "fail_fast": true, "blocks": []},
  "dry_run": true
}
```

That empty example must be rejected. A saved-template request keeps required
`workflow: null` and adds `workflow_template_name` and `workflow_vars`.
Supply connection context if template variables need it. API authentication
and response shapes are documented in [Web](web-runbook.md).

## Failure To Remedy

| Failure | Remedy |
| --- | --- |
| JSON parser line/column error | Fix syntax before inspecting device state |
| Missing `mode`, `command`, `blocks`, `steps`, `fail_fast`, or `rollback_policy` | Follow [native models](json-templates.md); do not rely on UI defaults in CLI files |
| Unknown operation kind | Use `command` with optional prompt rules; retain `flow` only for its actual native wire format |
| Invalid strategy/source combination | Use `serial`/`parallel`, positive parallelism, exactly one workflow source |
| Unknown group or selectors resolve no targets | Inspect `inventory group list/show` and saved connection labels in the intended runtime; do not replace selectors with unsupported inline targets |
| Unresolved placeholder in raw CLI file | Use saved-template execution or render the file first |
| Nested block reference rejected by CLI workflow | Expand it into a concrete block or use Web/orchestration |
| Workflow preview passes but execution rejects it | Check the native invariants listed above; passing the parse preview is insufficient |

Repair demonstrated schema errors and rerun the relevant check. Report missing
runtime state and any unperformed validation separately from the checks that
passed. Do not test a change by executing it against real devices without an
execution request.

The helper's behavior tests use isolated runtime directories and never connect
to devices. To run both unit and native checks:

```sh
RAUTO_BIN=/path/to/rauto/target/debug/rauto python3 scripts/test_validate_json_plans.py
```
