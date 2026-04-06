CREATE TABLE IF NOT EXISTS task_runs (
    task_id TEXT PRIMARY KEY,
    operation TEXT NOT NULL,
    status TEXT NOT NULL,
    outcome TEXT,
    summary TEXT NOT NULL,
    success INTEGER NOT NULL,
    agent_name TEXT,
    source TEXT,
    target_label TEXT,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    execution_time_ms INTEGER,
    has_recording INTEGER NOT NULL DEFAULT 0,
    has_error INTEGER NOT NULL DEFAULT 0,
    result_summary_json TEXT,
    result_json TEXT,
    error_json TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_task_runs_status_started_at
ON task_runs(status, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_task_runs_operation_started_at
ON task_runs(operation, started_at DESC);

CREATE TABLE IF NOT EXISTS task_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL,
    seq INTEGER NOT NULL,
    operation TEXT NOT NULL,
    event_type TEXT NOT NULL,
    level TEXT NOT NULL,
    stage TEXT,
    message TEXT NOT NULL,
    progress INTEGER,
    details_json TEXT,
    occurred_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_task_events_task_seq
ON task_events(task_id, seq ASC);
