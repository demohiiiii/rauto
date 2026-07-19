import assert from "node:assert/strict";
import test from "node:test";
import { get } from "svelte/store";
import {
  TEMPLATE_MANAGER_KIND,
  createContentTemplateWorkspace,
  createShowObjectWorkspace,
  createTextfsmMappingWorkspace,
  defaultTemplateResourceContent,
  templateResourceDefinitions,
} from "../src/modules/templates/templateManagerState.js";

test("template manager maps every backend content-template endpoint", () => {
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(templateResourceDefinitions).map(([kind, definition]) => [
        kind,
        definition.apiBase,
      ]),
    ),
    {
      command: "/api/templates",
      flow: "/api/flow-templates",
      "tx-block": "/api/tx-block-templates",
      "tx-workflow": "/api/tx-workflow-templates",
      orchestration: "/api/orchestration-templates",
      textfsm: "/api/textfsm/templates",
    },
  );
  assert.equal(
    templateResourceDefinitions.flow.builtinApiBase,
    "/api/flow-templates/builtins",
  );
});

test("new structured templates include current command multiline fields", () => {
  const txBlock = JSON.parse(
    defaultTemplateResourceContent(TEMPLATE_MANAGER_KIND.txBlock, "precheck"),
  );
  const flow = defaultTemplateResourceContent(
    TEMPLATE_MANAGER_KIND.flow,
    "show-version",
  );

  assert.equal(txBlock.name, "precheck");
  assert.equal(txBlock.steps[0].run.kind, "command");
  assert.equal(txBlock.steps[0].run.multiline_mode, "split_lines");
  assert.match(flow, /name = "show-version"/);
  assert.match(flow, /multiline_mode = "split_lines"/);
});

test("built-in flows are read-only and can be saved as custom snapshots", async () => {
  const creates = [];
  const workspace = createContentTemplateWorkspace({
    confirmDiscard: async () => true,
    api: {
      listTemplateResource: async (base) =>
        base.endsWith("/builtins")
          ? [{ name: "cisco-like-copy", source: "builtin" }]
          : [{ name: "custom-copy", source: "custom" }],
      getTemplateResource: async (base, name) => ({
        name,
        content: `name = "${name}"\n[[steps]]\ncommand = "show version"`,
        vars_schema: [],
      }),
      createTemplateResource: async (base, name, content) => {
        creates.push({ base, name, content });
        return { name, content };
      },
    },
  });

  await workspace.activate(TEMPLATE_MANAGER_KIND.flow);
  assert.equal(get(workspace.stateStore).selected.builtin, true);
  assert.equal((await workspace.save()).ok, false);
  assert.equal((await workspace.saveAs("copy-snapshot")).ok, true);
  assert.equal(creates[0].base, "/api/flow-templates");
  assert.equal(creates[0].name, "copy-snapshot");
  assert.match(creates[0].content, /^name = "copy-snapshot"/);
});

test("command edits refresh inferred variables through backend inspection", async () => {
  const workspace = createContentTemplateWorkspace({
    confirmDiscard: async () => true,
    api: {
      listTemplateResource: async () => [{ name: "show-version" }],
      getTemplateResource: async () => ({
        name: "show-version",
        content: "show {{old_value}}",
      }),
      inspectCommandTemplate: async (content) => ({
        vars_schema: [
          {
            name: content.includes("new_value") ? "new_value" : "old_value",
          },
        ],
      }),
    },
  });

  await workspace.load(TEMPLATE_MANAGER_KIND.command);
  workspace.setContent("show {{new_value}}");
  await new Promise((resolve) => setTimeout(resolve, 350));

  assert.deepEqual(
    get(workspace.stateStore).varsSchema.map((field) => field.name),
    ["new_value"],
  );
});

test("changing a TextFSM mapping identity removes the previous mapping", async () => {
  const writes = [];
  const deletes = [];
  let mappings = [
    {
      device_profile: "ios",
      command: "show version",
      template_name: "ios_version",
    },
  ];
  const workspace = createTextfsmMappingWorkspace({
    api: {
      getDeviceProfilesOverview: async () => ({
        builtins: [{ name: "ios" }],
        custom: [],
      }),
      listTemplateResource: async () => [{ name: "ios_version" }],
      listTextfsmMappings: async () => mappings,
      saveTextfsmMapping: async (payload) => {
        writes.push(payload);
        mappings = [payload];
      },
      deleteTextfsmMapping: async (payload) => deletes.push(payload),
    },
  });

  await workspace.load();
  workspace.select(get(workspace.stateStore).mappings[0]);
  workspace.patchForm({ command: "show system" });
  assert.equal((await workspace.save()).ok, true);
  assert.equal(writes[0].command, "show system");
  assert.deepEqual(deletes, [
    { device_profile: "ios", command: "show version" },
  ]);
});

test("changing a custom show object identity removes the previous object", async () => {
  const deletes = [];
  const saves = [];
  let objects = [
    {
      device_profile: "ios",
      object: "version",
      command: "show version",
      mode: "Enable",
      enabled: true,
    },
  ];
  const workspace = createShowObjectWorkspace({
    onChanged: async () => {},
    api: {
      getDeviceProfilesOverview: async () => ({
        builtins: [{ name: "ios" }],
        custom: [],
      }),
      getProfileModes: async () => ({
        default_mode: "Enable",
        modes: ["Enable", "Config"],
      }),
      listCustomShowObjects: async () => objects,
      listTemplateResource: async () => [],
      listTextfsmMappings: async () => [],
      saveCustomShowObject: async (payload) => {
        saves.push(payload);
        objects = [payload];
      },
      deleteCustomShowObject: async (payload) => deletes.push(payload),
    },
  });

  await workspace.load();
  await workspace.select(get(workspace.stateStore).objects[0]);
  await workspace.patchForm({ object: "system-version" });
  assert.equal((await workspace.save()).ok, true);
  assert.equal(saves[0].object, "system-version");
  assert.deepEqual(deletes, [{ device_profile: "ios", object: "version" }]);
});

test("resource workspaces clear loading state and expose request failures", async () => {
  const mappings = createTextfsmMappingWorkspace({
    api: {
      getDeviceProfilesOverview: async () => ({ builtins: [], custom: [] }),
      listTemplateResource: async () => [],
      listTextfsmMappings: async () => {
        throw new Error("mapping load failed");
      },
    },
  });

  assert.equal(await mappings.load(), false);
  assert.equal(get(mappings.stateStore).loadingAction, "");
  assert.equal(get(mappings.stateStore).errorMessage, "mapping load failed");

  const objects = createShowObjectWorkspace({
    onChanged: async () => {},
    api: {
      getDeviceProfilesOverview: async () => ({
        builtins: [{ name: "ios" }],
        custom: [],
      }),
      getProfileModes: async () => ({ modes: [], default_mode: "" }),
      listTextfsmMappings: async () => [],
      saveCustomShowObject: async () => {
        throw new Error("object save failed");
      },
    },
  });
  await objects.patchForm({
    deviceProfile: "ios",
    object: "version",
    command: "show version",
  });

  assert.deepEqual(await objects.save(), {
    ok: false,
    message: "object save failed",
  });
  assert.equal(get(objects.stateStore).loadingAction, "");
  assert.equal(get(objects.stateStore).errorMessage, "object save failed");
});
