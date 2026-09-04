import { derived, writable } from "svelte/store";
import { templatesApi } from "../infrastructure/templatesApi.js";
import { templatesRuntime } from "../infrastructure/templatesRuntime.js";
import {
  TEMPLATE_MANAGER_KIND,
  contentTemplateKinds,
  contentWithEmbeddedName,
  defaultTemplateResourceContent,
  normalizeResourceMeta,
  resourceKey,
  templateResourceDefinitions,
  trimmedText,
} from "../model/templateResources.js";
import type {
  ContentTemplateWorkspace,
  ContentTemplateWorkspaceOptions,
  TemplateApi,
  TemplateContentSession,
  TemplateManagerKind,
  TemplateResourceDefinition,
  TemplateResourceMeta,
  WorkspaceResult,
} from "../model/types.js";
import {
  workspaceErrorMessage,
  workspaceFailure,
} from "./templateWorkspaceSupport.js";

function emptyContentSession(
  kind: TemplateManagerKind,
): TemplateContentSession {
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

function publishContentSession(
  stateStore: ContentTemplateWorkspace["stateStore"],
  session: TemplateContentSession,
): void {
  stateStore.set({
    ...session,
    dirty: session.content !== session.originalContent,
  });
}

function isContentTemplateKind(value: TemplateManagerKind): boolean {
  return contentTemplateKinds.has(value);
}

function resourceDefinition(
  kind: TemplateManagerKind,
): TemplateResourceDefinition {
  const definition = templateResourceDefinitions[kind];
  if (!definition) throw new Error(`unknown template resource kind: ${kind}`);
  return definition;
}

export function createContentTemplateWorkspace({
  api: apiOverrides = {},
  confirmDiscard = templatesRuntime.confirmDiscard,
}: ContentTemplateWorkspaceOptions = {}): ContentTemplateWorkspace {
  const api: TemplateApi = { ...templatesApi, ...apiOverrides };
  const sessions = new Map<TemplateManagerKind, TemplateContentSession>();
  const countsStore = writable<Record<string, number>>({});
  const stateStore = writable<TemplateContentSession>(
    emptyContentSession(TEMPLATE_MANAGER_KIND.command),
  );
  let activeKind: TemplateManagerKind = TEMPLATE_MANAGER_KIND.command;
  let requestVersion = 0;
  let inspectionVersion = 0;
  let inspectionTimer: ReturnType<typeof setTimeout> | null = null;

  function sessionFor(kind = activeKind): TemplateContentSession {
    let session = sessions.get(kind);
    if (!session) {
      session = emptyContentSession(kind);
      sessions.set(kind, session);
    }
    return session;
  }

  function publish(kind = activeKind): void {
    if (kind === activeKind) {
      publishContentSession(stateStore, sessionFor(kind));
    }
  }

  function updateCounts(kind: TemplateManagerKind, count: number): void {
    countsStore.update((counts) => ({ ...counts, [kind]: count }));
  }

  async function inspectSelectedContent(
    session: TemplateContentSession,
  ): Promise<void> {
    if (session.kind === TEMPLATE_MANAGER_KIND.flow) {
      const inspection = await api.inspectCommandFlowTemplate(session.content);
      session.varsSchema = inspection.vars_schema;
      return;
    }
    if (session.kind !== TEMPLATE_MANAGER_KIND.command) {
      session.varsSchema = [];
      return;
    }
    try {
      const inspection = await api.inspectCommandTemplate(session.content);
      session.varsSchema = inspection.vars_schema;
    } catch {
      session.varsSchema = [];
    }
  }

  async function loadSelectedDetail(
    kind: TemplateManagerKind,
    selected: TemplateResourceMeta,
    version: number,
  ): Promise<boolean> {
    const session = sessionFor(kind);
    session.loadingAction = "detail";
    session.errorMessage = "";
    publish(kind);
    try {
      const definition = resourceDefinition(kind);
      const apiBase = selected.builtin
        ? definition.builtinApiBase
        : definition.apiBase;
      if (!apiBase) throw new Error(`template resource has no API: ${kind}`);
      const detail = await api.getTemplateResource(apiBase, selected.name);
      if (version !== requestVersion) return false;
      session.selected = {
        ...selected,
        name: trimmedText(detail.name) || selected.name,
      };
      session.content = detail.content;
      session.originalContent = session.content;
      await inspectSelectedContent(session);
      session.loadingAction = "";
      publish(kind);
      return true;
    } catch (error) {
      if (version !== requestVersion) return false;
      session.loadingAction = "";
      session.errorMessage = workspaceErrorMessage(error);
      publish(kind);
      return false;
    }
  }

  async function load(
    kindValue: TemplateManagerKind = activeKind,
    { force = false, selectedKey = "" } = {},
  ): Promise<boolean> {
    if (!isContentTemplateKind(kindValue)) return false;
    const kind = kindValue;
    const session = sessionFor(kind);
    if (session.loaded && !force) {
      publish(kind);
      return true;
    }
    const version = ++requestVersion;
    const definition = resourceDefinition(kind);
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
      const customItems = customPayload
        .map((meta) => normalizeResourceMeta(meta, false))
        .filter((item) => item.name);
      const builtinItems = builtinPayload
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
      session.errorMessage = workspaceErrorMessage(error);
      session.items = [];
      updateCounts(kind, 0);
      publish(kind);
      return false;
    }
  }

  async function activate(kindValue: TemplateManagerKind): Promise<boolean> {
    if (!isContentTemplateKind(kindValue)) return false;
    const current = sessionFor(activeKind);
    if (
      kindValue !== activeKind &&
      current.content !== current.originalContent &&
      !(await confirmDiscard())
    ) {
      return false;
    }
    activeKind = kindValue;
    publish(kindValue);
    return load(kindValue);
  }

  async function selectResource(key: string): Promise<boolean> {
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

  function scheduleContentInspection(session: TemplateContentSession): void {
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
        session.varsSchema = inspection.vars_schema;
        publish(session.kind);
      } catch {
        if (version !== inspectionVersion || session.content !== content)
          return;
        session.varsSchema = [];
        publish(session.kind);
      }
    }, 300);
  }

  function setContent(content: string): void {
    const session = sessionFor();
    session.content = content;
    session.errorMessage = "";
    publish();
    scheduleContentInspection(session);
  }

  function setSearch(search: string): void {
    const session = sessionFor();
    session.search = search;
    publish();
  }

  async function createDraft(name: string): Promise<WorkspaceResult> {
    const session = sessionFor();
    const normalizedName = trimmedText(name);
    if (!normalizedName) {
      return workspaceFailure(
        "templateNameRequired",
        "Template name is required",
      );
    }
    const existing = session.items.find(
      (item) => !item.builtin && item.name === normalizedName,
    );
    if (existing) {
      await selectResource(existing.key);
      return workspaceFailure("templateExistsHint", "Template already exists");
    }
    if (
      session.content !== session.originalContent &&
      !(await confirmDiscard())
    ) {
      return { ok: false, cancelled: true };
    }
    const definition = resourceDefinition(activeKind);
    session.selected = {
      key: resourceKey(normalizedName, false),
      name: normalizedName,
      builtin: false,
      source: "draft",
      kind: activeKind,
      isDraft: true,
      content_type: definition.contentType,
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

  async function persist({
    name = "",
    create = false,
  }: { name?: string; create?: boolean } = {}): Promise<WorkspaceResult> {
    const session = sessionFor();
    const selected = session.selected;
    const targetName = trimmedText(name || selected?.name || "");
    if (!selected || !targetName) {
      return workspaceFailure(
        "templateNameRequired",
        "Template name is required",
      );
    }
    if (selected.builtin && !create) {
      return workspaceFailure(
        "templateManagerBuiltinReadonly",
        "Built-in templates are read-only",
      );
    }
    session.loadingAction = create || selected.isDraft ? "create" : "save";
    session.errorMessage = "";
    publish();
    try {
      const definition = resourceDefinition(activeKind);
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
      session.content = saved.content;
      session.originalContent = session.content;
      session.loadingAction = "";
      session.selected = {
        ...selected,
        key: resourceKey(saved.name || targetName, false),
        name: trimmedText(saved.name) || targetName,
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
      session.errorMessage = workspaceErrorMessage(error);
      publish();
      return { ok: false, message: session.errorMessage };
    }
  }

  async function saveAs(name: string): Promise<WorkspaceResult> {
    const session = sessionFor();
    const normalizedName = trimmedText(name);
    if (!normalizedName) {
      return workspaceFailure(
        "templateNameRequired",
        "Template name is required",
      );
    }
    if (
      session.items.some(
        (item) => !item.builtin && item.name === normalizedName,
      )
    ) {
      return workspaceFailure("templateExistsHint", "Template already exists");
    }
    return persist({ name: normalizedName, create: true });
  }

  async function deleteSelected(): Promise<WorkspaceResult> {
    const session = sessionFor();
    const selected = session.selected;
    if (!selected || selected.builtin || selected.isDraft) {
      return workspaceFailure(
        "templateManagerDeleteUnavailable",
        "This resource cannot be deleted",
      );
    }
    session.loadingAction = "delete";
    session.errorMessage = "";
    publish();
    try {
      await api.deleteTemplateResource(
        resourceDefinition(activeKind).apiBase,
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
      session.errorMessage = workspaceErrorMessage(error);
      publish();
      return { ok: false, message: session.errorMessage };
    }
  }

  function formatContent(): WorkspaceResult {
    const session = sessionFor();
    if (resourceDefinition(activeKind).format !== "json") return { ok: false };
    try {
      session.content = JSON.stringify(JSON.parse(session.content), null, 2);
      session.errorMessage = "";
      publish();
      return { ok: true };
    } catch (error) {
      session.errorMessage = workspaceErrorMessage(error);
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
