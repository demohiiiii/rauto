# Recurring Schedules

Schedules are persisted cron definitions. CLI/Web can create and inspect them;
execution needs a running `rauto web` scheduler using the same `RAUTO_HOME`.
`schedule run` queues a run; it is not a standalone executor.

## Commands

```sh
rauto schedule list --json
rauto schedule show nightly-config --json
rauto schedule preview '0 2 * * *' --timezone Asia/Shanghai --count 5 --json
rauto schedule create --file ./schedule.json --json
rauto schedule update nightly-config --file ./schedule.json --json
rauto schedule disable nightly-config
rauto schedule enable nightly-config
rauto schedule run nightly-config --json
rauto schedule runs nightly-config --limit 20 --json
```

Selectors are a schedule ID or exact name. Create/update accepts `--file` or
`--content` JSON. Cron has five fields (minute/hour/day/month/weekday), not
seconds. Timezone is an IANA name and defaults to `Asia/Shanghai`.

## Definition

```json
{
  "name": "nightly-config",
  "cron_expression": "0 2 * * *",
  "timezone": "Asia/Shanghai",
  "enabled": true,
  "overlap_policy": "skip",
  "misfire_policy": "fire_once",
  "max_runtime_seconds": 3600,
  "action": {
    "type": "config_fetch",
    "targets": ["core-01"],
    "groups": [],
    "labels": [],
    "kind": "running"
  }
}
```

| Field | Meaning/default |
| --- | --- |
| `enabled` | Defaults true |
| `overlap_policy` | `skip` (default) or `allow` when a prior run overlaps |
| `misfire_policy` | `fire_once` (default) or `skip` for missed occurrences |
| `max_runtime_seconds` | Defaults 3600, allowed 1-86400 |

Scheduled actions use the discriminator `type`, distinct from orchestration
actions' `kind`:

- `config_fetch`: saved `targets`, `groups`, and/or `labels`, plus config `kind`.
- `tx_workflow`: `connection_name`, `template_name`, and optional `vars` JSON.
- `orchestrate`: `template_name` and optional `vars` JSON; targets come from the
  saved orchestration template.

Example workflow action:

```json
{
  "type": "tx_workflow",
  "connection_name": "core-01",
  "template_name": "workflow-demo",
  "vars": {"value": "example"}
}
```

Creation validates required fields, cron/timezone, runtime limits, referenced
saved connections/templates, and known configuration mappings. It does not
prove that commands or credentials will succeed on a device. Use the current
template/plan checks before scheduling changes.

When a run stays queued, confirm Web is running with the same runtime path.
Use `schedule runs` for persisted `queued`, `running`, `success`, `failed`, and
`skipped` outcomes, plus Task Center for execution detail. Stop the service
only when the requested service session should end; it drives recurring jobs.

Source: `src/domain/scheduling/mod.rs`, `src/scheduler/`,
`src/cli/schedule.rs`, and `src/web/handlers/schedules.rs`.
