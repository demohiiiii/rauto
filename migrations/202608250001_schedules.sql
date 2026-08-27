CREATE TABLE IF NOT EXISTS schedules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    cron_expression TEXT NOT NULL,
    timezone TEXT NOT NULL,
    action_type TEXT NOT NULL,
    action_payload_json TEXT NOT NULL,
    payload_version INTEGER NOT NULL DEFAULT 1,
    enabled INTEGER NOT NULL DEFAULT 1,
    overlap_policy TEXT NOT NULL DEFAULT 'skip',
    misfire_policy TEXT NOT NULL DEFAULT 'fire_once',
    max_runtime_seconds INTEGER NOT NULL DEFAULT 3600,
    next_run_at_ms INTEGER,
    last_run_at_ms INTEGER,
    created_at_ms INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_schedules_due
ON schedules(enabled, next_run_at_ms);

CREATE TABLE IF NOT EXISTS schedule_runs (
    id TEXT PRIMARY KEY,
    schedule_id TEXT NOT NULL,
    task_id TEXT UNIQUE,
    trigger_type TEXT NOT NULL,
    scheduled_for_ms INTEGER NOT NULL,
    status TEXT NOT NULL,
    skip_reason TEXT,
    error TEXT,
    started_at_ms INTEGER,
    completed_at_ms INTEGER,
    lease_owner TEXT,
    lease_until_ms INTEGER,
    created_at_ms INTEGER NOT NULL,
    FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE,
    UNIQUE(schedule_id, scheduled_for_ms)
);

CREATE INDEX IF NOT EXISTS idx_schedule_runs_pending
ON schedule_runs(status, lease_until_ms, created_at_ms);

CREATE INDEX IF NOT EXISTS idx_schedule_runs_schedule_created
ON schedule_runs(schedule_id, created_at_ms DESC);
