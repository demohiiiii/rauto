# Scheduled Automation

Load this reference when creating, updating, running, or diagnosing persisted rauto schedules.

## Runtime Model

- Schedule definitions and run records live in the local rauto SQLite database.
- `rauto schedule` manages that database without requiring HTTP or a running Web service.
- A running `rauto web` process owns cron evaluation and queued-run execution. `schedule run` queues a manual run; it does not start a daemon or execute the action in the CLI process.
- Use the same `RAUTO_HOME` for CLI management and the Web scheduler.
- Select schedules by stable ID or exact name.

## Definition

Create and update consume a complete `ScheduleDefinition` JSON using exactly one of `--file` or `--content`:

```json
{
  "name": "nightly-configs",
  "cron_expression": "0 2 * * *",
  "timezone": "Asia/Shanghai",
  "enabled": true,
  "overlap_policy": "skip",
  "misfire_policy": "fire_once",
  "max_runtime_seconds": 3600,
  "action": {
    "type": "config_fetch",
    "targets": ["core-01"],
    "groups": ["core"],
    "labels": ["production"],
    "kind": "running"
  }
}
```

Rules:

- Cron expressions have five fields. Preview them with `rauto schedule preview '<cron>' --timezone <iana-zone>`; `--count` defaults to 5 and accepts 1 through 100.
- `timezone` is an IANA timezone and defaults to `Asia/Shanghai`.
- `overlap_policy` is `skip` or `allow`; `misfire_policy` is `fire_once` or `skip`.
- `max_runtime_seconds` defaults to 3600 and must be between 1 and 86400.
- `update` replaces the complete definition. Load the current JSON with `schedule show --json`, edit it, and submit the full result.
- Creation/update validates referenced saved connections and templates before persistence.

## Actions

### Orchestration Template

```json
{
  "type": "orchestrate",
  "template_name": "campus-rollout",
  "vars": { "site": "dc-a" }
}
```

The named orchestration template must already exist. Use the transaction/orchestration references when authoring that template.

### Multi-Target Configuration Collection

```json
{
  "type": "config_fetch",
  "targets": ["core-01", "core-02"],
  "groups": ["distribution"],
  "labels": ["production"],
  "kind": "running"
}
```

Targets, groups, and labels form a deduplicated union and may select multiple devices. Every resolved device must have a usable configuration command for the requested kind. Successful runs create raw configuration history records with source `cron`; unchanged collections remain visible while sharing deduplicated content.

### Single-Device Transaction Workflow

```json
{
  "type": "tx_workflow",
  "connection_name": "core-01",
  "template_name": "validated-maintenance",
  "vars": { "interface": "GigabitEthernet0/1" }
}
```

The connection and transaction workflow template must already exist. This action intentionally targets one saved device; use orchestration when a workflow must fan out across devices.

## Commands

```bash
rauto schedule preview "0 2 * * *" --timezone Asia/Shanghai --count 5
rauto schedule create --file ./schedule.json
rauto schedule update nightly-configs --file ./schedule.json
rauto schedule list
rauto schedule show nightly-configs --json
rauto schedule disable nightly-configs
rauto schedule enable nightly-configs
rauto schedule run nightly-configs --json
rauto schedule runs nightly-configs --limit 20 --json
rauto schedule delete nightly-configs
```

Interpret manual-run status exactly:

- `queued`: a running Web scheduler may claim and execute it.
- `skipped`: final; inspect `skip_reason`, usually an overlap-policy decision.
- `running`, `success`, or `failed`: inspect the run and associated task result rather than queueing duplicates blindly.

Require confirmation before deleting a schedule. Disabling preserves its definition and history and is the preferred reversible pause.
