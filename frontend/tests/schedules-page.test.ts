import assert from "node:assert/strict";
import test from "node:test";
import { get } from "svelte/store";
import {
  configTargetsFromAction,
  createSchedulesPageWorkspace,
} from "../src/domains/schedules/index.js";
import type {
  ScheduleForm,
  ScheduleRun,
  StoredSchedule,
} from "../src/domains/schedules/index.js";
import {
  availableConfigKinds,
  defaultScheduleForm,
  definitionFromForm,
} from "../src/domains/schedules/model/scheduleForm.js";

function schedule(id: string): StoredSchedule {
  return {
    action: { type: "orchestrate", template_name: "backup", vars: {} },
    created_at: "2026-09-04T00:00:00Z",
    cron_expression: "0 2 * * *",
    enabled: true,
    id,
    last_run_at: null,
    max_runtime_seconds: 3600,
    misfire_policy: "fire_once",
    name: id,
    next_run_at: "2026-09-05T02:00:00+08:00",
    overlap_policy: "skip",
    timezone: "Asia/Shanghai",
    updated_at: "2026-09-04T00:00:00Z",
  };
}

function scheduleRun(id: string, scheduleId: string): ScheduleRun {
  return {
    completed_at: null,
    created_at: "2026-09-04T00:00:00Z",
    error: null,
    id,
    schedule_id: scheduleId,
    schedule_name: scheduleId,
    scheduled_for: "2026-09-04T00:00:00Z",
    skip_reason: null,
    started_at: null,
    status: "queued",
    task_id: null,
    trigger_type: "manual",
  };
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test("legacy config fetch targets remain selected when editing", () => {
  assert.deepEqual(
    configTargetsFromAction({
      connection_name: " edge-1 ",
      targets: [],
    }),
    ["edge-1"],
  );
  assert.deepEqual(
    configTargetsFromAction({
      connection_name: "edge-1",
      targets: ["edge-1", " edge-2 "],
    }),
    ["edge-1", "edge-2"],
  );
});

test("schedule forms serialize each supported action with concrete fields", () => {
  const common: ScheduleForm = {
    ...defaultScheduleForm(),
    name: " nightly ",
    cronExpression: " 0 2 * * * ",
    timezone: " Asia/Shanghai ",
    varsJson: '{"site":"lab"}',
  };

  assert.deepEqual(definitionFromForm(common), {
    action: {
      template_name: "",
      type: "orchestrate",
      vars: { site: "lab" },
    },
    cron_expression: "0 2 * * *",
    enabled: true,
    max_runtime_seconds: 3600,
    misfire_policy: "fire_once",
    name: "nightly",
    overlap_policy: "skip",
    timezone: "Asia/Shanghai",
  });

  assert.deepEqual(
    definitionFromForm({
      ...common,
      actionType: "config_fetch",
      configGroups: ["campus"],
      configKind: "running",
      configLabels: ["core"],
      configTargets: ["edge-1"],
    }).action,
    {
      groups: ["campus"],
      kind: "running",
      labels: ["core"],
      targets: ["edge-1"],
      type: "config_fetch",
    },
  );

  assert.deepEqual(
    definitionFromForm({
      ...common,
      actionType: "tx_workflow",
      connectionName: "edge-1",
      txWorkflowTemplateName: "upgrade",
    }).action,
    {
      connection_name: "edge-1",
      template_name: "upgrade",
      type: "tx_workflow",
      vars: { site: "lab" },
    },
  );
});

test("configuration kinds are intersected across selected device profiles", () => {
  const workspace = createSchedulesPageWorkspace();
  const state = {
    ...get(workspace.displayStateStore),
    configCommands: [
      {
        command: "show running-config",
        device_profile: "ios",
        kind: "running",
      },
      {
        command: "show startup-config",
        device_profile: "ios",
        kind: "startup",
      },
      {
        command: "show configuration",
        device_profile: "junos",
        kind: "running",
      },
    ],
    connections: [
      { device_profile: "ios", name: "edge-1" },
      { device_profile: "junos", name: "edge-2" },
    ],
    form: {
      ...defaultScheduleForm(),
      configTargets: ["edge-1", "edge-2"],
    },
  };

  assert.deepEqual(availableConfigKinds(state), ["running"]);
});

test("schedule run responses cannot overwrite a newer selection", async () => {
  const pendingRuns = new Map<
    string,
    ReturnType<typeof deferred<ScheduleRun[]>>
  >();
  const schedules = [schedule("schedule-a"), schedule("schedule-b")];
  const workspace = createSchedulesPageWorkspace({
    api: {
      listConfigCommands: async () => [],
      listConnections: async () => [],
      listInventoryGroups: async () => [],
      listInventoryLabels: async () => [],
      listSchedules: async () => schedules,
      listTemplateResource: async () => [],
      listScheduleRuns: (id) => {
        const request = deferred<ScheduleRun[]>();
        pendingRuns.set(id, request);
        return request.promise;
      },
    },
  });
  await workspace.setPageContext({ active: true });

  const selectA = workspace.selectSchedule("schedule-a")();
  const selectB = workspace.selectSchedule("schedule-b")();
  pendingRuns.get("schedule-b")?.resolve([scheduleRun("run-b", "schedule-b")]);
  await selectB;
  pendingRuns.get("schedule-a")?.resolve([scheduleRun("run-a", "schedule-a")]);
  await selectA;

  const display = get(workspace.displayStateStore);
  assert.equal(display.selectedId, "schedule-b");
  assert.deepEqual(
    display.runs.map((run) => run.id),
    ["run-b"],
  );
});
