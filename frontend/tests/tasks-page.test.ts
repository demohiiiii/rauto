import assert from "node:assert/strict";
import test from "node:test";
import { get } from "svelte/store";
import {
  createTasksPageWorkspace,
  filteredTaskRuns,
  newTaskState,
  taskPagePresentation,
} from "../src/domains/tasks/index.js";
import type {
  TaskQuery,
  TaskRun,
  TaskRunDetail,
} from "../src/domains/tasks/model/types.js";

function deferred<T>(): {
  promise: Promise<T>;
  reject: (reason?: Error) => void;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason?: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function taskRun(taskId: string, overrides: Partial<TaskRun> = {}): TaskRun {
  return {
    agent_name: null,
    completed_at: null,
    execution_time_ms: null,
    has_error: false,
    has_recording: false,
    operation: "exec",
    outcome: "success",
    source: null,
    started_at: "2026-08-31T10:00:00Z",
    status: "success",
    success: true,
    summary: `task ${taskId}`,
    target_label: null,
    task_id: taskId,
    ...overrides,
  };
}

function taskDetail(
  taskId: string,
  overrides: Partial<TaskRunDetail> = {},
): TaskRunDetail {
  return {
    ...taskRun(taskId),
    artifacts: [],
    created_at: "2026-08-31T10:00:00Z",
    error: null,
    events: [],
    result: null,
    result_summary: null,
    updated_at: "2026-08-31T10:00:00Z",
    ...overrides,
  };
}

test("task presentation maps filter options to both select contracts", () => {
  const display = taskPagePresentation(newTaskState());
  const limitOption = display.taskFilters.fields.limit.options[0];
  const eventOption = display.taskEventsDisplay.eventGroupOptionRows[0];

  assert.deepEqual(limitOption, {
    label: "20",
    optionLabel: "20",
    optionValue: "20",
    value: "20",
  });
  assert.equal(eventOption.optionValue, "all");
  assert.equal(eventOption.value, "all");
  assert.deepEqual(
    display.taskFilters.fields.operation.options.map(
      (option) => option.optionValue,
    ),
    [
      "",
      "exec",
      "template_execute",
      "command_flow",
      "upload",
      "tx_block",
      "tx_workflow",
      "orchestrate",
      "device_discovery",
    ],
  );
});

test("task model filters runs without changing the API result list", () => {
  const state = {
    ...newTaskState(),
    errorFilter: "no",
    outcome: "success",
    recording: "yes",
    runs: [
      taskRun("matching", {
        has_recording: true,
        summary: "nightly edge backup",
      }),
      taskRun("failed", { has_error: true, outcome: "failed" }),
    ],
    search: "edge",
  };

  assert.deepEqual(
    filteredTaskRuns(state).map((run) => run.task_id),
    ["matching"],
  );
  assert.equal(state.runs.length, 2);
});

test("tasks workspace loads once per active page lifecycle", async () => {
  const queries: Array<TaskQuery | undefined> = [];
  const workspace = createTasksPageWorkspace({
    api: {
      async listTasks(query) {
        queries.push(query);
        return [taskRun(`task-${queries.length}`)];
      },
    },
  });

  await workspace.setPageContext({ active: true });
  await workspace.setPageContext({ active: true });
  assert.equal(queries.length, 1);
  assert.deepEqual(queries[0], { limit: 50, operation: "", status: "" });

  await workspace.setPageContext({ active: false });
  await workspace.setPageContext({ active: true });
  assert.equal(queries.length, 2);

  workspace.destroy();
  assert.deepEqual(get(workspace.taskStateStore), newTaskState());
});

test("latest task list response wins when server filters change quickly", async () => {
  const first = deferred<TaskRun[]>();
  const second = deferred<TaskRun[]>();
  let calls = 0;
  const workspace = createTasksPageWorkspace({
    api: {
      listTasks() {
        calls += 1;
        return calls === 1 ? first.promise : second.promise;
      },
    },
  });

  workspace.updateTaskOperation("exec");
  workspace.updateTaskStatus("success");
  second.resolve([taskRun("newest")]);
  await second.promise;
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(get(workspace.taskStateStore).runs[0].task_id, "newest");

  first.resolve([taskRun("stale")]);
  await first.promise;
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(get(workspace.taskStateStore).runs[0].task_id, "newest");
});

test("latest selected task detail wins when responses arrive out of order", async () => {
  const first = deferred<TaskRunDetail>();
  const second = deferred<TaskRunDetail>();
  const workspace = createTasksPageWorkspace({
    api: {
      getTask(taskId) {
        return taskId === "first" ? first.promise : second.promise;
      },
    },
  });

  const firstRequest = workspace.selectTask("first")();
  const secondRequest = workspace.selectTask("second")();
  second.resolve(taskDetail("second"));
  await secondRequest;
  assert.equal(get(workspace.taskStateStore).currentTaskId, "second");

  first.resolve(taskDetail("first"));
  await firstRequest;
  const state = get(workspace.taskStateStore);
  assert.equal(state.currentTaskId, "second");
  assert.equal(state.currentTaskDetail?.task_id, "second");
});

test("list refresh cancels detail loading for a task no longer visible", async () => {
  const listResponse = deferred<TaskRun[]>();
  const detailResponse = deferred<TaskRunDetail>();
  const workspace = createTasksPageWorkspace({
    api: {
      getTask() {
        return detailResponse.promise;
      },
      listTasks() {
        return listResponse.promise;
      },
    },
  });

  const detailRequest = workspace.selectTask("removed")();
  workspace.updateTaskStatus("success");
  listResponse.resolve([]);
  await listResponse.promise;
  await new Promise((resolve) => setTimeout(resolve, 0));

  detailResponse.resolve(taskDetail("removed"));
  await detailRequest;
  const state = get(workspace.taskStateStore);
  assert.equal(state.currentTaskId, "");
  assert.equal(state.currentTaskDetail, null);
  assert.equal(state.detailStatus, null);
});
