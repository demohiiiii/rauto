import { derived, get, writable } from "svelte/store";
import {
  createTemplateResource,
  deleteCustomShowObject,
  deleteTemplateResource,
  deleteTextfsmMapping,
  getDeviceProfilesOverview,
  getProfileModes,
  getTemplateResource,
  inspectCommandFlowTemplate,
  inspectCommandTemplate,
  listCustomShowObjects,
  listTemplateResource,
  listTextfsmMappings,
  saveCustomShowObject,
  saveTextfsmMapping,
  updateTemplateResource,
} from "../api/client.js";
import { browserConfirm } from "../lib/browser.js";
import { tr } from "../lib/i18n.js";
import {
  commandFlowTemplateModelFromToml,
  commandFlowTemplateModelToToml,
} from "./commandFlowTemplateModel.js";
import {
  notifyCustomShowObjectsChanged,
  setCachedDeviceProfiles,
} from "./templatesShowObjects.js";

export const TEMPLATE_MANAGER_KIND = Object.freeze({
  command: "command",
  flow: "flow",
  txBlock: "tx-block",
  txWorkflow: "tx-workflow",
  orchestration: "orchestration",
  textfsm: "textfsm",
  textfsmMappings: "textfsm-mappings",
  showObjects: "show-objects",
});

export const templateManagerSections = Object.freeze([
  {
    key: TEMPLATE_MANAGER_KIND.command,
    group: "execution",
    labelKey: "templateManagerCommandTitle",
    descriptionKey: "templateManagerCommandDescription",
  },
  {
    key: TEMPLATE_MANAGER_KIND.flow,
    group: "execution",
    labelKey: "templateManagerFlowTitle",
    descriptionKey: "templateManagerFlowDescription",
  },
  {
    key: TEMPLATE_MANAGER_KIND.txBlock,
    group: "transaction",
    labelKey: "templateManagerTxBlockTitle",
    descriptionKey: "templateManagerTxBlockDescription",
  },
  {
    key: TEMPLATE_MANAGER_KIND.txWorkflow,
    group: "transaction",
    labelKey: "templateManagerTxWorkflowTitle",
    descriptionKey: "templateManagerTxWorkflowDescription",
  },
  {
    key: TEMPLATE_MANAGER_KIND.orchestration,
    group: "transaction",
    labelKey: "templateManagerOrchestrationTitle",
    descriptionKey: "templateManagerOrchestrationDescription",
  },
  {
    key: TEMPLATE_MANAGER_KIND.textfsm,
    group: "parsing",
    labelKey: "templateManagerTextfsmTitle",
    descriptionKey: "templateManagerTextfsmDescription",
  },
  {
    key: TEMPLATE_MANAGER_KIND.textfsmMappings,
    group: "parsing",
    labelKey: "templateManagerMappingTitle",
    descriptionKey: "templateManagerMappingDescription",
  },
  {
    key: TEMPLATE_MANAGER_KIND.showObjects,
    group: "parsing",
    labelKey: "templateManagerShowObjectTitle",
    descriptionKey: "templateManagerShowObjectDescription",
  },
]);

export const contentTemplateKinds = new Set([
  TEMPLATE_MANAGER_KIND.command,
  TEMPLATE_MANAGER_KIND.flow,
  TEMPLATE_MANAGER_KIND.txBlock,
  TEMPLATE_MANAGER_KIND.txWorkflow,
  TEMPLATE_MANAGER_KIND.orchestration,
  TEMPLATE_MANAGER_KIND.textfsm,
]);

export const templateResourceDefinitions = Object.freeze({
  [TEMPLATE_MANAGER_KIND.command]: {
    apiBase: "/api/templates",
    format: "jinja",
    contentType: "text/plain",
  },
  [TEMPLATE_MANAGER_KIND.flow]: {
    apiBase: "/api/flow-templates",
    builtinApiBase: "/api/flow-templates/builtins",
    format: "toml",
    contentType: "application/toml",
  },
  [TEMPLATE_MANAGER_KIND.txBlock]: {
    apiBase: "/api/tx-block-templates",
    format: "json",
    contentType: "application/json",
  },
  [TEMPLATE_MANAGER_KIND.txWorkflow]: {
    apiBase: "/api/tx-workflow-templates",
    format: "json",
    contentType: "application/json",
  },
  [TEMPLATE_MANAGER_KIND.orchestration]: {
    apiBase: "/api/orchestration-templates",
    format: "json",
    contentType: "application/json",
  },
  [TEMPLATE_MANAGER_KIND.textfsm]: {
    apiBase: "/api/textfsm/templates",
    format: "textfsm",
    contentType: "text/plain",
  },
});

const defaultApi = {
  createTemplateResource,
  deleteCustomShowObject,
  deleteTemplateResource,
  deleteTextfsmMapping,
  getDeviceProfilesOverview,
  getProfileModes,
  getTemplateResource,
  inspectCommandFlowTemplate,
  inspectCommandTemplate,
  listCustomShowObjects,
  listTemplateResource,
  listTextfsmMappings,
  saveCustomShowObject,
  saveTextfsmMapping,
  updateTemplateResource,
};

const safeText = (value) => (value == null ? "" : String(value));
const trimmedText = (value) => safeText(value).trim();
const listValue = (value) => (Array.isArray(value) ? value : []);

function uniqueNames(values = []) {
  return listValue(values)
    .map((value) => trimmedText(value))
    .filter((value, index, names) => value && names.indexOf(value) === index);
}

export function profileNamesFromOverview(payload = {}) {
  return uniqueNames([
    ...listValue(payload.builtins).map((profile) => profile?.name),
    ...listValue(payload.custom).map((profile) => profile?.name),
  ]);
}

function resourceKey(name, builtin = false) {
  return `${builtin ? "builtin" : "custom"}:${trimmedText(name)}`;
}

function normalizeResourceMeta(meta = {}, builtin = false) {
  const name = trimmedText(meta.name);
  return {
    ...meta,
    name,
    key: resourceKey(name, builtin),
    builtin,
    source: builtin ? "builtin" : trimmedText(meta.source) || "custom",
    content_type: trimmedText(meta.content_type),
    size_bytes: Number(meta.size_bytes) || 0,
    created_at_ms: Number(meta.created_at_ms) || 0,
    updated_at_ms: Number(meta.updated_at_ms) || 0,
  };
}

function emptyContentSession(kind) {
  return {
    kind,
    items: [],
    selected: null,
    content: "",
    originalContent: "",
    varsSchema: [],
    search: "",
    loadingAction: "",
    errorMessage: "",
    loaded: false,
  };
}

function jsonTemplateContent(name, value) {
  return JSON.stringify({ ...value, name }, null, 2);
}

export function defaultTemplateResourceContent(kind, name = "") {
  const safeName = trimmedText(name) || "new-template";
  if (kind === TEMPLATE_MANAGER_KIND.command) return "show version";
  if (kind === TEMPLATE_MANAGER_KIND.flow) {
    return `name = ${JSON.stringify(safeName)}\nstop_on_error = true\n\n[[steps]]\ncommand = "show version"\nmultiline_mode = "split_lines"\n`;
  }
  if (kind === TEMPLATE_MANAGER_KIND.txBlock) {
    return jsonTemplateContent(safeName, {
      rollback_policy: "none",
      steps: [
        {
          run: {
            kind: "command",
            mode: "",
            command: "show version",
            multiline_mode: "split_lines",
            timeout: 30,
          },
          rollback: null,
          rollback_on_failure: false,
        },
      ],
      fail_fast: true,
    });
  }
  if (kind === TEMPLATE_MANAGER_KIND.txWorkflow) {
    return jsonTemplateContent(safeName, {
      fail_fast: true,
      blocks: [
        {
          name: "precheck",
          rollback_policy: "none",
          fail_fast: true,
          steps: [
            {
              run: {
                kind: "command",
                mode: "",
                command: "show version",
                multiline_mode: "split_lines",
                timeout: 30,
              },
              rollback: null,
              rollback_on_failure: false,
            },
          ],
        },
      ],
    });
  }
  if (kind === TEMPLATE_MANAGER_KIND.orchestration) {
    return jsonTemplateContent(safeName, {
      fail_fast: true,
      rollback_on_stage_failure: true,
      rollback_completed_stages_on_failure: false,
      inventory: { groups: {} },
      stages: [],
    });
  }
  if (kind === TEMPLATE_MANAGER_KIND.textfsm) {
    return "Value VERSION (\\S+)\n\nStart\n  ^Version: ${VERSION} -> Record\n";
  }
  return "";
}

function contentWithEmbeddedName(kind, content, name) {
  if (kind === TEMPLATE_MANAGER_KIND.flow) {
    return commandFlowTemplateModelToToml({
      ...commandFlowTemplateModelFromToml(content),
      name,
    });
  }
  if (
    kind !== TEMPLATE_MANAGER_KIND.txBlock &&
    kind !== TEMPLATE_MANAGER_KIND.txWorkflow &&
    kind !== TEMPLATE_MANAGER_KIND.orchestration
  ) {
    return content;
  }
  const value = JSON.parse(content);
  if (!value || Array.isArray(value) || typeof value !== "object") {
    throw new Error(
      tr(
        "templateManagerJsonObjectRequired",
        "JSON template must be an object",
      ),
    );
  }
  return JSON.stringify({ ...value, name }, null, 2);
}

function publishContentSession(stateStore, session) {
  stateStore.set({
    ...session,
    dirty: session.content !== session.originalContent,
  });
}

export function createContentTemplateWorkspace(options = {}) {
  const api = { ...defaultApi, ...(options.api || {}) };
  const confirmDiscard =
    options.confirmDiscard ||
    (() =>
      browserConfirm(
        tr(
          "templateManagerDiscardConfirm",
          "Discard the unsaved template changes?",
        ),
      ));
  const sessions = new Map();
  const countsStore = writable({});
  const stateStore = writable(
    emptyContentSession(TEMPLATE_MANAGER_KIND.command),
  );
  let activeKind = TEMPLATE_MANAGER_KIND.command;
  let requestVersion = 0;
  let inspectionVersion = 0;
  let inspectionTimer = null;

  function sessionFor(kind = activeKind) {
    if (!sessions.has(kind)) sessions.set(kind, emptyContentSession(kind));
    return sessions.get(kind);
  }

  function publish(kind = activeKind) {
    if (kind === activeKind)
      publishContentSession(stateStore, sessionFor(kind));
  }

  function updateCounts(kind, count) {
    countsStore.update((counts) => ({ ...counts, [kind]: count }));
  }

  async function inspectSelectedContent(session, detail = {}) {
    if (session.kind === TEMPLATE_MANAGER_KIND.flow) {
      const inspection = Array.isArray(detail.vars_schema)
        ? detail
        : await api.inspectCommandFlowTemplate(session.content);
      session.varsSchema = listValue(inspection?.vars_schema);
      return;
    }
    if (session.kind !== TEMPLATE_MANAGER_KIND.command) {
      session.varsSchema = [];
      return;
    }
    try {
      const inspection = await api.inspectCommandTemplate(session.content);
      session.varsSchema = listValue(inspection?.vars_schema);
    } catch (_) {
      session.varsSchema = [];
    }
  }

  async function loadSelectedDetail(kind, selected, version) {
    const session = sessionFor(kind);
    session.loadingAction = "detail";
    session.errorMessage = "";
    publish(kind);
    try {
      const definition = templateResourceDefinitions[kind];
      const apiBase = selected.builtin
        ? definition.builtinApiBase
        : definition.apiBase;
      const detail = await api.getTemplateResource(apiBase, selected.name);
      if (version !== requestVersion) return false;
      session.selected = { ...selected, name: detail?.name || selected.name };
      session.content = safeText(detail?.content);
      session.originalContent = session.content;
      await inspectSelectedContent(session, detail);
      session.loadingAction = "";
      publish(kind);
      return true;
    } catch (error) {
      if (version !== requestVersion) return false;
      session.loadingAction = "";
      session.errorMessage = error?.message || String(error);
      publish(kind);
      return false;
    }
  }

  async function load(
    kind = activeKind,
    { force = false, selectedKey = "" } = {},
  ) {
    if (!contentTemplateKinds.has(kind)) return false;
    const session = sessionFor(kind);
    if (session.loaded && !force) {
      publish(kind);
      return true;
    }
    const version = ++requestVersion;
    const definition = templateResourceDefinitions[kind];
    session.loadingAction = "list";
    session.errorMessage = "";
    publish(kind);
    try {
      const [customPayload, builtinPayload] = await Promise.all([
        api.listTemplateResource(definition.apiBase),
        definition.builtinApiBase
          ? api.listTemplateResource(definition.builtinApiBase)
          : Promise.resolve([]),
      ]);
      if (version !== requestVersion) return false;
      const customItems = listValue(customPayload)
        .map((meta) => normalizeResourceMeta(meta, false))
        .filter((item) => item.name);
      const builtinItems = listValue(builtinPayload)
        .map((meta) => normalizeResourceMeta(meta, true))
        .filter((item) => item.name);
      session.items = [...builtinItems, ...customItems];
      session.loaded = true;
      session.loadingAction = "";
      updateCounts(kind, session.items.length);

      const preferredKey = selectedKey || session.selected?.key || "";
      const selected =
        session.items.find((item) => item.key === preferredKey) ||
        session.items[0] ||
        null;
      if (!selected) {
        session.selected = null;
        session.content = "";
        session.originalContent = "";
        session.varsSchema = [];
        publish(kind);
        return true;
      }
      return loadSelectedDetail(kind, selected, version);
    } catch (error) {
      if (version !== requestVersion) return false;
      session.loaded = true;
      session.loadingAction = "";
      session.errorMessage = error?.message || String(error);
      session.items = [];
      updateCounts(kind, 0);
      publish(kind);
      return false;
    }
  }

  async function activate(kind) {
    if (!contentTemplateKinds.has(kind)) return false;
    const current = sessionFor(activeKind);
    if (kind !== activeKind && current.content !== current.originalContent) {
      if (!(await confirmDiscard())) return false;
    }
    activeKind = kind;
    publish(kind);
    return load(kind);
  }

  async function selectResource(key) {
    const session = sessionFor();
    const selected = session.items.find((item) => item.key === key);
    if (!selected || selected.key === session.selected?.key) return true;
    if (
      session.content !== session.originalContent &&
      !(await confirmDiscard())
    ) {
      return false;
    }
    const version = ++requestVersion;
    return loadSelectedDetail(activeKind, selected, version);
  }

  function setContent(content) {
    const session = sessionFor();
    session.content = safeText(content);
    session.errorMessage = "";
    publish();
    scheduleContentInspection(session);
  }

  function scheduleContentInspection(session) {
    inspectionVersion += 1;
    const version = inspectionVersion;
    if (inspectionTimer) clearTimeout(inspectionTimer);
    if (
      session.kind !== TEMPLATE_MANAGER_KIND.command &&
      session.kind !== TEMPLATE_MANAGER_KIND.flow
    ) {
      session.varsSchema = [];
      publish();
      return;
    }
    const content = session.content;
    inspectionTimer = setTimeout(async () => {
      try {
        const inspection =
          session.kind === TEMPLATE_MANAGER_KIND.flow
            ? await api.inspectCommandFlowTemplate(content)
            : await api.inspectCommandTemplate(content);
        if (version !== inspectionVersion || session.content !== content)
          return;
        session.varsSchema = listValue(inspection?.vars_schema);
        publish(session.kind);
      } catch (_) {
        if (version !== inspectionVersion || session.content !== content)
          return;
        session.varsSchema = [];
        publish(session.kind);
      }
    }, 300);
  }

  function setSearch(search) {
    const session = sessionFor();
    session.search = safeText(search);
    publish();
  }

  async function createDraft(name) {
    const session = sessionFor();
    const normalizedName = trimmedText(name);
    if (!normalizedName) {
      return {
        ok: false,
        message: tr("templateNameRequired", "Template name is required"),
      };
    }
    const existing = session.items.find(
      (item) => !item.builtin && item.name === normalizedName,
    );
    if (existing) {
      await selectResource(existing.key);
      return {
        ok: false,
        message: tr("templateExistsHint", "Template already exists"),
      };
    }
    if (
      session.content !== session.originalContent &&
      !(await confirmDiscard())
    ) {
      return { ok: false, cancelled: true };
    }
    session.selected = {
      key: resourceKey(normalizedName, false),
      name: normalizedName,
      builtin: false,
      source: "draft",
      isDraft: true,
      content_type: templateResourceDefinitions[activeKind].contentType,
      size_bytes: 0,
      created_at_ms: 0,
      updated_at_ms: 0,
    };
    session.content = defaultTemplateResourceContent(
      activeKind,
      normalizedName,
    );
    session.originalContent = "";
    session.varsSchema = [];
    session.errorMessage = "";
    publish();
    return { ok: true };
  }

  async function saveAs(name) {
    const session = sessionFor();
    const normalizedName = trimmedText(name);
    if (!normalizedName) {
      return {
        ok: false,
        message: tr("templateNameRequired", "Template name is required"),
      };
    }
    if (
      session.items.some(
        (item) => !item.builtin && item.name === normalizedName,
      )
    ) {
      return {
        ok: false,
        message: tr("templateExistsHint", "Template already exists"),
      };
    }
    return persist({ name: normalizedName, create: true });
  }

  async function persist({ name = "", create = false } = {}) {
    const session = sessionFor();
    const selected = session.selected;
    const targetName = trimmedText(name || selected?.name);
    if (!selected || !targetName) {
      return {
        ok: false,
        message: tr("templateNameRequired", "Template name is required"),
      };
    }
    if (selected.builtin && !create) {
      return {
        ok: false,
        message: tr(
          "templateManagerBuiltinReadonly",
          "Built-in templates are read-only",
        ),
      };
    }
    session.loadingAction = create || selected.isDraft ? "create" : "save";
    session.errorMessage = "";
    publish();
    try {
      const definition = templateResourceDefinitions[activeKind];
      const content = contentWithEmbeddedName(
        activeKind,
        session.content,
        targetName,
      );
      const shouldCreate = create || !!selected.isDraft;
      const saved = shouldCreate
        ? await api.createTemplateResource(
            definition.apiBase,
            targetName,
            content,
          )
        : await api.updateTemplateResource(
            definition.apiBase,
            targetName,
            content,
          );
      session.content = safeText(saved?.content ?? content);
      session.originalContent = session.content;
      session.loadingAction = "";
      session.selected = {
        ...selected,
        key: resourceKey(saved?.name || targetName, false),
        name: saved?.name || targetName,
        builtin: false,
        isDraft: false,
        source: "custom",
      };
      publish();
      await load(activeKind, {
        force: true,
        selectedKey: session.selected.key,
      });
      return { ok: true, name: session.selected?.name || targetName };
    } catch (error) {
      session.loadingAction = "";
      session.errorMessage = error?.message || String(error);
      publish();
      return { ok: false, message: session.errorMessage };
    }
  }

  async function deleteSelected() {
    const session = sessionFor();
    const selected = session.selected;
    if (!selected || selected.builtin || selected.isDraft) {
      return {
        ok: false,
        message: tr(
          "templateManagerDeleteUnavailable",
          "This resource cannot be deleted",
        ),
      };
    }
    session.loadingAction = "delete";
    session.errorMessage = "";
    publish();
    try {
      await api.deleteTemplateResource(
        templateResourceDefinitions[activeKind].apiBase,
        selected.name,
      );
      session.selected = null;
      session.content = "";
      session.originalContent = "";
      session.loadingAction = "";
      publish();
      await load(activeKind, { force: true });
      return { ok: true, name: selected.name };
    } catch (error) {
      session.loadingAction = "";
      session.errorMessage = error?.message || String(error);
      publish();
      return { ok: false, message: session.errorMessage };
    }
  }

  function formatContent() {
    const session = sessionFor();
    if (templateResourceDefinitions[activeKind].format !== "json") {
      return { ok: false };
    }
    try {
      session.content = JSON.stringify(JSON.parse(session.content), null, 2);
      session.errorMessage = "";
      publish();
      return { ok: true };
    } catch (error) {
      session.errorMessage = error?.message || String(error);
      publish();
      return { ok: false, message: session.errorMessage };
    }
  }

  const filteredItemsStore = derived(stateStore, (state) => {
    const query = trimmedText(state.search).toLowerCase();
    return query
      ? state.items.filter((item) => item.name.toLowerCase().includes(query))
      : state.items;
  });

  return {
    activate,
    countsStore,
    createDraft,
    deleteSelected,
    filteredItemsStore,
    formatContent,
    load,
    refresh: () => load(activeKind, { force: true }),
    save: () => persist(),
    saveAs,
    selectResource,
    setContent,
    setSearch,
    stateStore,
  };
}

function emptyMappingForm(profiles = [], templates = []) {
  return {
    deviceProfile: profiles[0] || "",
    command: "",
    templateName: templates[0] || "",
  };
}

function mappingIdentity(mapping = {}) {
  return `${trimmedText(mapping.device_profile ?? mapping.deviceProfile)}\u0000${trimmedText(mapping.command)}`;
}

function normalizeMapping(mapping = {}) {
  return {
    ...mapping,
    deviceProfile: trimmedText(mapping.device_profile ?? mapping.deviceProfile),
    command: trimmedText(mapping.command),
    templateName: trimmedText(mapping.template_name ?? mapping.templateName),
  };
}

export function createTextfsmMappingWorkspace(options = {}) {
  const api = { ...defaultApi, ...(options.api || {}) };
  const stateStore = writable({
    profiles: [],
    templates: [],
    mappings: [],
    form: emptyMappingForm(),
    originalIdentity: "",
    search: "",
    loadingAction: "",
    errorMessage: "",
  });

  async function loadReferences() {
    const [profilesPayload, templatesPayload] = await Promise.all([
      api.getDeviceProfilesOverview(),
      api.listTemplateResource("/api/textfsm/templates"),
    ]);
    const profiles = profileNamesFromOverview(profilesPayload);
    const templates = uniqueNames(
      listValue(templatesPayload).map((item) => item?.name),
    );
    setCachedDeviceProfiles(profiles);
    stateStore.update((state) => ({
      ...state,
      profiles,
      templates,
      form: {
        ...state.form,
        deviceProfile: state.form.deviceProfile || profiles[0] || "",
        templateName: state.form.templateName || templates[0] || "",
      },
    }));
  }

  async function load() {
    stateStore.update((state) => ({
      ...state,
      loadingAction: "load",
      errorMessage: "",
    }));
    try {
      await loadReferences();
      const mappings = listValue(await api.listTextfsmMappings()).map(
        normalizeMapping,
      );
      stateStore.update((state) => ({ ...state, mappings, loadingAction: "" }));
      return true;
    } catch (error) {
      stateStore.update((state) => ({
        ...state,
        loadingAction: "",
        errorMessage: error?.message || String(error),
      }));
      return false;
    }
  }

  function createDraft() {
    stateStore.update((state) => ({
      ...state,
      form: emptyMappingForm(state.profiles, state.templates),
      originalIdentity: "",
      errorMessage: "",
    }));
  }

  function select(mapping) {
    const normalized = normalizeMapping(mapping);
    stateStore.update((state) => ({
      ...state,
      form: normalized,
      originalIdentity: mappingIdentity(normalized),
      errorMessage: "",
    }));
  }

  function patchForm(patch) {
    stateStore.update((state) => ({
      ...state,
      form: { ...state.form, ...patch },
    }));
  }

  function setSearch(search) {
    stateStore.update((state) => ({ ...state, search: safeText(search) }));
  }

  async function save() {
    const state = get(stateStore);
    const form = normalizeMapping(state.form);
    if (!form.deviceProfile || !form.command || !form.templateName) {
      return {
        ok: false,
        message: tr(
          "textfsmMappingRequired",
          "Profile, command, and template are required",
        ),
      };
    }
    stateStore.update((value) => ({
      ...value,
      loadingAction: "save",
      errorMessage: "",
    }));
    try {
      await api.saveTextfsmMapping({
        device_profile: form.deviceProfile,
        command: form.command,
        template_name: form.templateName,
      });
      const nextIdentity = mappingIdentity(form);
      if (state.originalIdentity && state.originalIdentity !== nextIdentity) {
        const [oldProfile, oldCommand] = state.originalIdentity.split("\u0000");
        await api.deleteTextfsmMapping({
          device_profile: oldProfile,
          command: oldCommand,
        });
      }
      await load();
      const saved = get(stateStore).mappings.find(
        (mapping) => mappingIdentity(mapping) === nextIdentity,
      );
      if (saved) select(saved);
      return { ok: true };
    } catch (error) {
      stateStore.update((value) => ({
        ...value,
        loadingAction: "",
        errorMessage: error?.message || String(error),
      }));
      return { ok: false, message: error?.message || String(error) };
    }
  }

  async function remove() {
    const state = get(stateStore);
    const identity = state.originalIdentity || mappingIdentity(state.form);
    const [deviceProfile, command] = identity.split("\u0000");
    if (!deviceProfile || !command) {
      return {
        ok: false,
        message: tr(
          "textfsmMappingDeleteRequired",
          "Profile and command are required",
        ),
      };
    }
    stateStore.update((value) => ({
      ...value,
      loadingAction: "delete",
      errorMessage: "",
    }));
    try {
      await api.deleteTextfsmMapping({
        device_profile: deviceProfile,
        command,
      });
      await load();
      createDraft();
      return { ok: true };
    } catch (error) {
      stateStore.update((value) => ({
        ...value,
        loadingAction: "",
        errorMessage: error?.message || String(error),
      }));
      return { ok: false, message: error?.message || String(error) };
    }
  }

  const filteredMappingsStore = derived(stateStore, (state) => {
    const query = trimmedText(state.search).toLowerCase();
    if (!query) return state.mappings;
    return state.mappings.filter((mapping) =>
      `${mapping.deviceProfile} ${mapping.command} ${mapping.templateName}`
        .toLowerCase()
        .includes(query),
    );
  });

  return {
    createDraft,
    filteredMappingsStore,
    load,
    patchForm,
    remove,
    save,
    select,
    setSearch,
    stateStore,
  };
}

function emptyShowObjectForm(profiles = []) {
  return {
    deviceProfile: profiles[0] || "",
    object: "",
    command: "",
    mode: "",
    textfsmMappingCommand: "",
    textfsmTemplateName: "",
    useMapping: false,
    enabled: true,
  };
}

function showObjectIdentity(value = {}) {
  return `${trimmedText(value.device_profile ?? value.deviceProfile)}\u0000${trimmedText(value.object)}`;
}

function normalizeShowObject(value = {}) {
  const textfsmMappingCommand = trimmedText(
    value.textfsm_mapping_command ?? value.textfsmMappingCommand,
  );
  return {
    ...value,
    deviceProfile: trimmedText(value.device_profile ?? value.deviceProfile),
    object: trimmedText(value.object),
    command: trimmedText(value.command),
    mode: trimmedText(value.mode),
    textfsmMappingCommand,
    textfsmTemplateName: trimmedText(
      value.textfsm_template_name ?? value.textfsmTemplateName,
    ),
    useMapping: !!textfsmMappingCommand,
    enabled: value.enabled !== false,
  };
}

export function createShowObjectWorkspace(options = {}) {
  const api = { ...defaultApi, ...(options.api || {}) };
  const onChanged = options.onChanged || notifyCustomShowObjectsChanged;
  const stateStore = writable({
    profiles: [],
    templates: [],
    mappings: [],
    modes: [],
    objects: [],
    form: emptyShowObjectForm(),
    originalIdentity: "",
    search: "",
    loadingAction: "",
    errorMessage: "",
  });

  async function loadProfileContext(profile, selectedMode = "") {
    const normalizedProfile = trimmedText(profile);
    if (!normalizedProfile) {
      stateStore.update((state) => ({ ...state, mappings: [], modes: [] }));
      return;
    }
    const [mappingsPayload, modesPayload] = await Promise.all([
      api.listTextfsmMappings(normalizedProfile),
      api.getProfileModes(normalizedProfile),
    ]);
    const mappings = listValue(mappingsPayload).map(normalizeMapping);
    const modes = uniqueNames(modesPayload?.modes);
    const mode = modes.includes(selectedMode)
      ? selectedMode
      : modes.includes(modesPayload?.default_mode)
        ? modesPayload.default_mode
        : "";
    stateStore.update((state) => ({
      ...state,
      mappings,
      modes,
      form: { ...state.form, mode: state.form.mode || mode },
    }));
  }

  async function load() {
    stateStore.update((state) => ({
      ...state,
      loadingAction: "load",
      errorMessage: "",
    }));
    try {
      const [profilesPayload, templatesPayload, objectsPayload] =
        await Promise.all([
          api.getDeviceProfilesOverview(),
          api.listTemplateResource("/api/textfsm/templates"),
          api.listCustomShowObjects(),
        ]);
      const profiles = profileNamesFromOverview(profilesPayload);
      const templates = uniqueNames(
        listValue(templatesPayload).map((item) => item?.name),
      );
      const objects = listValue(objectsPayload).map(normalizeShowObject);
      setCachedDeviceProfiles(profiles);
      stateStore.update((state) => ({
        ...state,
        profiles,
        templates,
        objects,
        form: {
          ...state.form,
          deviceProfile: state.form.deviceProfile || profiles[0] || "",
        },
        loadingAction: "",
      }));
      const profile = get(stateStore).form.deviceProfile;
      if (profile) await loadProfileContext(profile, get(stateStore).form.mode);
      return true;
    } catch (error) {
      stateStore.update((state) => ({
        ...state,
        loadingAction: "",
        errorMessage: error?.message || String(error),
      }));
      return false;
    }
  }

  function createDraft() {
    const state = get(stateStore);
    stateStore.update((value) => ({
      ...value,
      form: emptyShowObjectForm(state.profiles),
      originalIdentity: "",
      errorMessage: "",
    }));
    if (state.profiles[0]) void loadProfileContext(state.profiles[0]);
  }

  async function select(object) {
    const normalized = normalizeShowObject(object);
    stateStore.update((state) => ({
      ...state,
      form: normalized,
      originalIdentity: showObjectIdentity(normalized),
      errorMessage: "",
    }));
    await loadProfileContext(normalized.deviceProfile, normalized.mode);
    stateStore.update((state) => ({ ...state, form: normalized }));
  }

  async function patchForm(patch) {
    const previous = get(stateStore).form;
    const next = { ...previous, ...patch };
    if (Object.hasOwn(patch, "deviceProfile")) {
      next.mode = "";
      next.textfsmMappingCommand = "";
      if (next.useMapping) next.command = "";
    }
    if (Object.hasOwn(patch, "useMapping")) {
      next.useMapping = !!patch.useMapping;
      next.textfsmMappingCommand = next.useMapping
        ? next.textfsmMappingCommand
        : "";
      if (next.useMapping) next.command = next.textfsmMappingCommand;
    }
    if (Object.hasOwn(patch, "textfsmMappingCommand")) {
      next.textfsmMappingCommand = trimmedText(patch.textfsmMappingCommand);
      if (next.useMapping) next.command = next.textfsmMappingCommand;
    }
    stateStore.update((state) => ({ ...state, form: next }));
    if (Object.hasOwn(patch, "deviceProfile")) {
      await loadProfileContext(next.deviceProfile);
    }
  }

  function setSearch(search) {
    stateStore.update((state) => ({ ...state, search: safeText(search) }));
  }

  async function save() {
    const state = get(stateStore);
    const form = normalizeShowObject(state.form);
    if (!form.deviceProfile || !form.object || !form.command) {
      return {
        ok: false,
        message: tr(
          "showObjectCustomRequired",
          "Profile, object, and command are required",
        ),
      };
    }
    if (form.useMapping && !form.textfsmMappingCommand) {
      return {
        ok: false,
        message: tr(
          "showObjectMappingRequired",
          "Select a profile command mapping",
        ),
      };
    }
    stateStore.update((value) => ({
      ...value,
      loadingAction: "save",
      errorMessage: "",
    }));
    try {
      await api.saveCustomShowObject({
        device_profile: form.deviceProfile,
        object: form.object,
        command: form.command,
        mode: form.mode || null,
        textfsm_mapping_command: form.useMapping
          ? form.textfsmMappingCommand
          : null,
        textfsm_template_name: form.textfsmTemplateName || null,
        enabled: form.enabled,
      });
      const nextIdentity = showObjectIdentity(form);
      if (state.originalIdentity && state.originalIdentity !== nextIdentity) {
        const [oldProfile, oldObject] = state.originalIdentity.split("\u0000");
        await api.deleteCustomShowObject({
          device_profile: oldProfile,
          object: oldObject,
        });
      }
      await onChanged();
      await load();
      const saved = get(stateStore).objects.find(
        (object) => showObjectIdentity(object) === nextIdentity,
      );
      if (saved) await select(saved);
      return { ok: true };
    } catch (error) {
      stateStore.update((value) => ({
        ...value,
        loadingAction: "",
        errorMessage: error?.message || String(error),
      }));
      return { ok: false, message: error?.message || String(error) };
    }
  }

  async function remove() {
    const state = get(stateStore);
    const identity = state.originalIdentity || showObjectIdentity(state.form);
    const [deviceProfile, object] = identity.split("\u0000");
    if (!deviceProfile || !object) {
      return {
        ok: false,
        message: tr(
          "showObjectCustomDeleteRequired",
          "Profile and object are required",
        ),
      };
    }
    stateStore.update((value) => ({
      ...value,
      loadingAction: "delete",
      errorMessage: "",
    }));
    try {
      await api.deleteCustomShowObject({
        device_profile: deviceProfile,
        object,
      });
      await onChanged();
      await load();
      createDraft();
      return { ok: true };
    } catch (error) {
      stateStore.update((value) => ({
        ...value,
        loadingAction: "",
        errorMessage: error?.message || String(error),
      }));
      return { ok: false, message: error?.message || String(error) };
    }
  }

  const filteredObjectsStore = derived(stateStore, (state) => {
    const query = trimmedText(state.search).toLowerCase();
    if (!query) return state.objects;
    return state.objects.filter((object) =>
      `${object.deviceProfile} ${object.object} ${object.command}`
        .toLowerCase()
        .includes(query),
    );
  });

  return {
    createDraft,
    filteredObjectsStore,
    load,
    patchForm,
    remove,
    save,
    select,
    setSearch,
    stateStore,
  };
}
