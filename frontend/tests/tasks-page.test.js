import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { get } from "svelte/store";
import {
  createTasksPageWorkspace,
  filteredTaskRuns,
  newTaskState,
  taskPagePresentation,
} from "../src/domains/tasks/index.ts";

function read(path) {
  return readFileSync(path, "utf8");
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function taskRun(taskId, overrides = {}) {
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

function taskDetail(taskId, overrides = {}) {
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

test("tasks page uses the tasks domain boundary", () => {
  const page = read("frontend/src/pages/TasksPage.svelte");
  const filterPanel = read("frontend/src/pages/tasks/TaskFiltersPanel.svelte");
  const detailPanel = read("frontend/src/pages/tasks/TaskDetailPanel.svelte");
  const domainIndex = read("frontend/src/domains/tasks/index.ts");
  const application = read(
    "frontend/src/domains/tasks/application/createTasksPageWorkspace.ts",
  );

  assert.match(page, /<script lang="ts">/);
  assert.match(page, /\$domains\/tasks\/index\.js/);
  assert.match(filterPanel, /\$domains\/tasks\/index\.js/);
  assert.match(detailPanel, /\$domains\/tasks\/index\.js/);
  assert.doesNotMatch(
    [page, filterPanel, detailPanel].join("\n"),
    /modules\/tasks/,
  );
  assert.match(domainIndex, /application\/createTasksPageWorkspace\.js/);
  assert.match(application, /tasksApi/);
});

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
  const queries = [];
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
  const first = deferred();
  const second = deferred();
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
  const first = deferred();
  const second = deferred();
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
  assert.equal(state.currentTaskDetail.task_id, "second");
});

test("list refresh cancels detail loading for a task no longer visible", async () => {
  const listResponse = deferred();
  const detailResponse = deferred();
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
