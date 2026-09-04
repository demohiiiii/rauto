import assert from "node:assert/strict";
import test from "node:test";
import { get } from "svelte/store";
import {
  TEMPLATE_MANAGER_KIND,
  configCatalogKindNames,
  createContentTemplateWorkspace,
  createShowObjectWorkspace,
  createTextfsmMappingWorkspace,
  defaultTemplateResourceContent,
  profileModeNames,
  profileNamesFromOverview,
  templateResourceDefinitions,
} from "../src/domains/templates/index.js";
import type {
  CustomShowObjectApiPayload,
  CustomShowObjectApiRow,
  TemplateResourceApiMeta,
  TemplateVariableField,
  TextfsmMappingApiPayload,
  TextfsmMappingApiRow,
} from "../src/domains/templates/model/types.js";

function resourceMeta(
  name: string,
  source = "custom",
): TemplateResourceApiMeta {
  return {
    content_type: "text/plain",
    created_at_ms: 1,
    kind: "template",
    name,
    size_bytes: 1,
    source,
    updated_at_ms: 1,
  };
}

function variableField(name: string): TemplateVariableField {
  return {
    allow_empty: false,
    default: null,
    description: null,
    label: name,
    name,
    options: [],
    placeholder: null,
    required: true,
    type: "string",
  };
}

test("config catalog selectors normalize backend profile, kind, and mode options", () => {
  assert.deepEqual(
    profileNamesFromOverview({
      builtins: [
        { aliases: [], name: "cisco_ios", summary: "" },
        { aliases: [], name: " huawei_vrp ", summary: "" },
      ],
      custom: [
        { name: "lab_switch", path: "" },
        { name: "cisco_ios", path: "" },
      ],
    }),
    ["cisco_ios", "huawei_vrp", "lab_switch"],
  );
  assert.deepEqual(
    configCatalogKindNames([
      {
        command: "",
        device_profile: "",
        kind: "startup",
        mode: null,
        source: "custom",
      },
      {
        command: "",
        device_profile: "",
        kind: " candidate ",
        mode: null,
        source: "custom",
      },
      {
        command: "",
        device_profile: "",
        kind: "running",
        mode: null,
        source: "custom",
      },
      {
        command: "",
        device_profile: "",
        kind: "",
        mode: null,
        source: "custom",
      },
    ]),
    ["running", "startup", "candidate"],
  );
  assert.deepEqual(
    profileModeNames({
      default_mode: "Login",
      modes: ["Login", " Enable ", "Login", ""],
      name: "cisco_ios",
    }),
    ["Login", "Enable"],
  );
});

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
  const flowDefinition = templateResourceDefinitions.flow;
  assert.ok(flowDefinition);
  assert.equal(flowDefinition.builtinApiBase, "/api/flow-templates/builtins");
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
  const creates: Array<{ base: string; content: string; name: string }> = [];
  const workspace = createContentTemplateWorkspace({
    confirmDiscard: async () => true,
    api: {
      listTemplateResource: async (base) =>
        base.endsWith("/builtins")
          ? [resourceMeta("cisco-like-copy", "builtin")]
          : [resourceMeta("custom-copy")],
      getTemplateResource: async (base, name) => ({
        name,
        content: `name = "${name}"\n[[steps]]\ncommand = "show version"`,
        vars_schema: [],
      }),
      createTemplateResource: async (base, name, content) => {
        creates.push({ base, name, content });
        return { name, content };
      },
      inspectCommandFlowTemplate: async (content) => ({
        name: "flow",
        content,
        vars_schema: [],
      }),
    },
  });

  await workspace.activate(TEMPLATE_MANAGER_KIND.flow);
  const selected = get(workspace.stateStore).selected;
  assert.ok(selected);
  assert.equal(selected.builtin, true);
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
      listTemplateResource: async () => [resourceMeta("show-version")],
      getTemplateResource: async () => ({
        name: "show-version",
        content: "show {{old_value}}",
      }),
      inspectCommandTemplate: async (content) => ({
        vars_schema: [
          variableField(
            content.includes("new_value") ? "new_value" : "old_value",
          ),
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
  const writes: TextfsmMappingApiPayload[] = [];
  const deletes: Array<Omit<TextfsmMappingApiPayload, "template_name">> = [];
  let mappings: TextfsmMappingApiRow[] = [
    {
      device_profile: "ios",
      command: "show version",
      template_name: "ios_version",
      created_at_ms: 1,
      updated_at_ms: 1,
    },
  ];
  const workspace = createTextfsmMappingWorkspace({
    api: {
      getDeviceProfilesOverview: async () => ({
        builtins: [{ aliases: [], name: "ios", summary: "" }],
        custom: [],
      }),
      listTemplateResource: async () => [resourceMeta("ios_version")],
      listTextfsmMappings: async () => mappings,
      saveTextfsmMapping: async (payload) => {
        writes.push(payload);
        const saved = {
          ...payload,
          created_at_ms: 1,
          updated_at_ms: 2,
        };
        mappings = [saved];
        return saved;
      },
      deleteTextfsmMapping: async (payload) => {
        deletes.push(payload);
        return { ok: true };
      },
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
  const deletes: Array<
    Pick<CustomShowObjectApiPayload, "device_profile" | "object">
  > = [];
  const saves: CustomShowObjectApiPayload[] = [];
  let objects: CustomShowObjectApiRow[] = [
    {
      device_profile: "ios",
      object: "version",
      command: "show version",
      mode: "Enable",
      textfsm_mapping_command: null,
      textfsm_template_name: null,
      enabled: true,
      created_at_ms: 1,
      updated_at_ms: 1,
    },
  ];
  const workspace = createShowObjectWorkspace({
    onChanged: async () => {},
    api: {
      getDeviceProfilesOverview: async () => ({
        builtins: [{ aliases: [], name: "ios", summary: "" }],
        custom: [],
      }),
      getProfileModes: async () => ({
        default_mode: "Enable",
        modes: ["Enable", "Config"],
        name: "ios",
      }),
      listCustomShowObjects: async () => objects,
      listTemplateResource: async () => [],
      listTextfsmMappings: async () => [],
      saveCustomShowObject: async (payload) => {
        saves.push(payload);
        const saved = {
          ...payload,
          enabled: payload.enabled ?? true,
          created_at_ms: 1,
          updated_at_ms: 2,
        };
        objects = [saved];
        return saved;
      },
      deleteCustomShowObject: async (payload) => {
        deletes.push(payload);
        return { ok: true };
      },
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
        builtins: [{ aliases: [], name: "ios", summary: "" }],
        custom: [],
      }),
      getProfileModes: async () => ({
        modes: [],
        default_mode: "",
        name: "ios",
      }),
      listTextfsmMappings: async () => [],
      saveCustomShowObject: async (): Promise<CustomShowObjectApiRow> => {
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
