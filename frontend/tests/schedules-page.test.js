import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  configTargetsFromAction,
  createSchedulesPageWorkspace,
} from "../src/modules/schedules/schedulesState.js";
import { dashboardNavigationItems } from "../src/config/dashboardNavigation.js";

function read(path) {
  return readFileSync(path, "utf8");
}

test("schedules are a local-web operations page", () => {
  const navigation = read("frontend/src/config/dashboardNavigation.js");
  const shell = read("frontend/src/modules/dashboard/dashboardShell.js");
  const page = read("frontend/src/pages/SchedulesPage.svelte");
  const editor = read(
    "frontend/src/components/schedules/ScheduleEditorDialog.svelte",
  );
  const state = read("frontend/src/modules/schedules/schedulesState.js");

  assert.match(navigation, /id: "schedules"/);
  assert.match(navigation, /path: "\/app\/schedules"/);
  assert.equal(
    dashboardNavigationItems.find((item) => item.routeId === "schedules")
      ?.group,
    "operations",
  );
  assert.match(navigation, /import\("\.\.\/pages\/SchedulesPage\.svelte"\)/);
  assert.match(shell, /tab !== "schedules" \|\| !dashboard\.managedAgentMode/);
  assert.match(page, /workspace\.runNow\(schedule\)/);
  assert.match(page, /workspace\.toggleEnabled\(schedule\)/);
  assert.match(page, /workspace\.remove\(schedule\.id\)/);
  assert.match(page, /<Trash2Icon/);
  assert.match(page, /ScheduleEditorDialog/);
  assert.doesNotMatch(page, /schedule-name/);
  assert.match(editor, /<Dialog\.Root/);
  assert.doesNotMatch(editor, /workspace\.remove/);
  assert.doesNotMatch(editor, /Trash2Icon/);
  assert.match(editor, /form\.actionType === "config_fetch"/);
  assert.match(editor, /form\.actionType === "tx_workflow"/);
  assert.match(editor, /<MultiSelectField/);
  assert.match(editor, /form\.configTargets/);
  assert.match(editor, /form\.configGroups/);
  assert.match(editor, /form\.configLabels/);
  assert.match(editor, /display\.cronPreview/);
  assert.match(state, /listConnections\(\)/);
  assert.match(state, /listInventoryGroups\(\)/);
  assert.match(state, /listInventoryLabels\(\)/);
  assert.match(state, /previewSchedule/);
  assert.match(state, /\/api\/tx-workflow-templates/);
  assert.match(state, /type: "orchestrate"/);
  assert.match(state, /type: "config_fetch"/);
  assert.match(state, /type: "tx_workflow"/);
  assert.doesNotMatch(editor, /normalized/i);
  assert.doesNotMatch(state, /normalized/i);
});

test("multi-select summarizes multiple selected values without growing the trigger", () => {
  const field = read(
    "frontend/src/components/fragments/MultiSelectField.svelte",
  );

  assert.match(field, /class="h-10 min-w-0 w-full/);
  assert.match(field, /selectedRows\[0\]\.label/);
  assert.match(field, /\+\{selectedRows\.length - 1\}/);
  assert.doesNotMatch(field, /#each selectedRows/);
});

test("schedule client helpers match the backend routes", () => {
  const client = read("frontend/src/api/client.js");

  assert.match(client, /export function listSchedules\(\)/);
  assert.match(client, /"GET", "\/api\/schedules"/);
  assert.match(client, /export function previewSchedule\(payload\)/);
  assert.match(client, /"POST", "\/api\/schedules\/preview"/);
  assert.match(client, /export function createSchedule\(payload\)/);
  assert.match(
    client,
    /`\/api\/schedules\/\$\{encodeURIComponent\(scheduleId\)\}`/,
  );
  assert.match(client, /\$\{encodeURIComponent\(scheduleId\)\}\/run/);
  assert.match(
    client,
    /\$\{encodeURIComponent\(scheduleId\)\}\/runs\?limit=\$\{limit\}/,
  );
});

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

test("schedule run responses cannot overwrite a newer selection", async () => {
  const pendingRuns = new Map();
  const deferred = () => {
    let resolve;
    const promise = new Promise((done) => {
      resolve = done;
    });
    return { promise, resolve };
  };
  const schedules = ["schedule-a", "schedule-b"].map((id) => ({
    id,
    name: id,
    action: { type: "orchestrate", template_name: "backup" },
  }));
  const workspace = createSchedulesPageWorkspace({
    api: {
      listConfigCommands: async () => [],
      listConnections: async () => [],
      listInventoryGroups: async () => [],
      listInventoryLabels: async () => [],
      listSchedules: async () => schedules,
      listTemplateResource: async () => [],
      listScheduleRuns: (id) => {
        const request = deferred();
        pendingRuns.set(id, request);
        return request.promise;
      },
    },
  });
  await workspace.setPageContext({ active: true });

  const selectA = workspace.selectSchedule("schedule-a")();
  const selectB = workspace.selectSchedule("schedule-b")();
  pendingRuns.get("schedule-b").resolve([{ id: "run-b" }]);
  await selectB;
  pendingRuns.get("schedule-a").resolve([{ id: "run-a" }]);
  await selectA;

  let display;
  const unsubscribe = workspace.displayStateStore.subscribe((value) => {
    display = value;
  });
  assert.equal(display.selectedId, "schedule-b");
  assert.deepEqual(
    display.runs.map((run) => run.id),
    ["run-b"],
  );
  unsubscribe();
});
