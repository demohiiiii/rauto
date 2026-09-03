import { get as getStore, writable } from "svelte/store";
import type { Writable } from "svelte/store";
import { transactionJsonTemplateRuntime } from "../infrastructure/transactionJsonTemplateRuntime.js";
import type {
  JsonObject,
  JsonTemplateActionContext,
  JsonTemplateSelectState,
  TransactionTemplateResource,
} from "../model/types.js";
import { TX_EDITOR, TX_TEMPLATE_KIND } from "./transactionJsonEditorState.js";

type UnknownFunction = (...args: unknown[]) => unknown;

interface JsonTemplateKindConfig extends JsonObject {
  apiBase: string;
  nameRequiredKey: string;
  newPromptKey: string;
  runEditor: string;
  runOutput: string;
}

interface JsonTemplateEditorKinds extends JsonObject {
  orchestration: string;
  txBlock: string;
  txWorkflow: string;
}

interface JsonTemplateLibraryConfig {
  configFor(kind: string): JsonTemplateKindConfig | null;
  createTemplateResource(
    apiBase: string,
    name: string,
    content: string,
  ): Promise<unknown>;
  deleteTemplateResource(apiBase: string, name: string): Promise<unknown>;
  getEditorContext(): JsonObject;
  getTemplateResource(apiBase: string, name: string): Promise<unknown>;
  getSelectedName(kind: string): string;
  listTemplateResource(apiBase: string): Promise<unknown>;
  normalizeEditorKey(editorKey: unknown): string;
  promptForResourceName(message: string): string | null;
  setErrorStatus(output: string, error: unknown): unknown;
  setExecutionModes(modes: JsonObject): unknown;
  setNamedStatus(
    output: string,
    action: string,
    fallback: string,
    name: string,
  ): unknown;
  setRunningStatus(output: string): unknown;
  setSelectedName(kind: string, name: string): unknown;
  setStatus(output: string, message: string, tone: string): unknown;
  tr(key: string, fallback?: string): string;
  txEditor: JsonTemplateEditorKinds;
  txTemplateKind: JsonTemplateEditorKinds;
  updateTemplateResource(
    apiBase: string,
    name: string,
    content: string,
  ): Promise<unknown>;
  updateOptions(kind: string, state: JsonTemplateSelectState): unknown;
}

interface JsonTemplateLibrary extends JsonObject {
  activate?: () => () => void;
  createTemplateDraft(
    kind: string,
    actionContext?: JsonTemplateActionContext | null,
  ): Promise<unknown>;
  deleteTemplateFromExecution(kind: string): Promise<void>;
  loadAllJsonTemplates(): Promise<void>;
  loadJsonTemplatesByKind(
    kind: string,
    actionContext?: JsonTemplateActionContext | null,
  ): Promise<void>;
  loadOrchestrationTemplates(): Promise<void>;
  loadTemplateIntoEditor(
    kind: string,
    nameOverride?: unknown,
    actionContext?: JsonTemplateActionContext | null,
  ): Promise<TransactionTemplateResource | null>;
  loadTxBlockTemplates(): Promise<void>;
  loadTxWorkflowTemplates(): Promise<void>;
  refreshAllJsonTemplateLists(): void;
  refreshAllJsonTemplateOptions(): void;
  saveTemplateFromExecution(kind: string): Promise<void>;
}

type TemplateCache = Record<string, TransactionTemplateResource[]>;

const EMPTY_OBJECT: Readonly<JsonObject> = Object.freeze({});

const jsonTemplateSelectState: Record<string, JsonTemplateSelectState> = {
  [TX_TEMPLATE_KIND.txBlock]: {
    names: [],
    selected: "",
  },
  [TX_TEMPLATE_KIND.txWorkflow]: {
    names: [],
    selected: "",
  },
  [TX_TEMPLATE_KIND.orchestration]: {
    names: [],
    selected: "",
  },
};

const jsonTemplateSelectStates = new Map<
  string,
  Writable<JsonTemplateSelectState>
>();
let activeJsonTemplateLibrary: JsonTemplateLibrary | null = null;

function recordValue(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function callObjectFunction(
  target: unknown,
  name: string,
  ...args: unknown[]
): unknown {
  const fn = recordValue(target)[name];
  return typeof fn === "function"
    ? (fn as UnknownFunction)(...args)
    : undefined;
}

function safeTemplateString(value: unknown): string {
  if (value == null) return "-";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

function functionValue<T>(source: JsonObject, key: string, fallback: T): T {
  const value = source[key];
  return typeof value === "function" ? (value as unknown as T) : fallback;
}

function templateResource(value: unknown): TransactionTemplateResource {
  return recordValue(value);
}

function defaultJsonTemplateSelectState(kind: string): JsonTemplateSelectState {
  return jsonTemplateSelectState[kind] || { names: [], selected: "" };
}

function setJsonTemplateSelectState(
  kind: string,
  state: JsonTemplateSelectState,
): void {
  jsonTemplateSelectState[kind] = state;
  jsonTemplateSelectStates.get(kind)?.set(state);
}

function jsonTemplateEditorContext(
  getEditorContext: () => JsonObject,
): JsonObject {
  return getEditorContext() || EMPTY_OBJECT;
}

function refreshTxWorkflowBuilderFromContext(
  getEditorContext: () => JsonObject,
): void {
  const context = jsonTemplateEditorContext(getEditorContext);
  callObjectFunction(context, "refreshTxWorkflowBuilder");
}

function prettyJsonText(rawContent: unknown): string {
  const text = safeTemplateString(rawContent).trim();
  if (!text) return "";
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

function normalizeTxEditorKey(editorKey: unknown): string {
  const key = safeTemplateString(editorKey).trim();
  return Object.values<string>(TX_EDITOR).includes(key) ? key : "";
}

function normalizeJsonTemplateLibraryConfig(
  libraryCfg: unknown = {},
): JsonTemplateLibraryConfig {
  const config = recordValue(libraryCfg);
  return {
    configFor: functionValue(config, "configFor", () => null),
    createTemplateResource: functionValue(
      config,
      "createTemplateResource",
      transactionJsonTemplateRuntime.createTemplateResource,
    ),
    deleteTemplateResource: functionValue(
      config,
      "deleteTemplateResource",
      transactionJsonTemplateRuntime.deleteTemplateResource,
    ),
    getEditorContext: functionValue(config, "getEditorContext", () => ({})),
    getTemplateResource: functionValue(
      config,
      "getTemplateResource",
      transactionJsonTemplateRuntime.getTemplateResource,
    ),
    getSelectedName: functionValue(config, "getSelectedName", () => ""),
    listTemplateResource: functionValue(
      config,
      "listTemplateResource",
      transactionJsonTemplateRuntime.listTemplateResource,
    ),
    normalizeEditorKey: functionValue(
      config,
      "normalizeEditorKey",
      normalizeTxEditorKey,
    ),
    promptForResourceName: functionValue(
      config,
      "promptForResourceName",
      transactionJsonTemplateRuntime.promptForResourceName,
    ),
    setErrorStatus: functionValue(config, "setErrorStatus", () => undefined),
    setExecutionModes: functionValue(
      config,
      "setExecutionModes",
      () => undefined,
    ),
    setNamedStatus: functionValue(config, "setNamedStatus", () => undefined),
    setRunningStatus: functionValue(
      config,
      "setRunningStatus",
      () => undefined,
    ),
    setSelectedName: functionValue(config, "setSelectedName", () => undefined),
    setStatus: functionValue(config, "setStatus", () => undefined),
    tr: functionValue(
      config,
      "tr",
      (key: string, fallback: string = key) => fallback,
    ),
    txEditor: recordValue(
      config.txEditor || TX_EDITOR,
    ) as JsonTemplateEditorKinds,
    txTemplateKind: recordValue(
      config.txTemplateKind || TX_TEMPLATE_KIND,
    ) as JsonTemplateEditorKinds,
    updateTemplateResource: functionValue(
      config,
      "updateTemplateResource",
      transactionJsonTemplateRuntime.updateTemplateResource,
    ),
    updateOptions: functionValue(config, "updateOptions", () => undefined),
  };
}

function setPrettyJsonToEditor(
  editorKey: unknown,
  rawContent: unknown,
  getEditorContext: () => JsonObject,
  normalizeEditorKey: (editorKey: unknown) => string,
  txEditor: JsonTemplateEditorKinds,
  actionContext: JsonTemplateActionContext | null = null,
): void {
  const normalizedEditorKey = normalizeEditorKey(editorKey);
  const text = prettyJsonText(rawContent);
  const editors = recordValue(
    jsonTemplateEditorContext(getEditorContext).editors,
  );
  const setTxBlockText = editors.setTxBlockEditorRawText;
  if (
    normalizedEditorKey === txEditor.txBlock &&
    typeof setTxBlockText === "function"
  ) {
    runOwnedEditorMutation(actionContext, () =>
      (setTxBlockText as UnknownFunction)(text),
    );
    return;
  }
  const setTxWorkflowText = editors.setTxWorkflowEditorText;
  if (
    normalizedEditorKey === txEditor.txWorkflow &&
    typeof setTxWorkflowText === "function"
  ) {
    runOwnedEditorMutation(actionContext, () =>
      (setTxWorkflowText as UnknownFunction)(text, { notify: true }),
    );
    return;
  }
  const setOrchestrationText = editors.setOrchestrationEditorText;
  if (
    normalizedEditorKey === txEditor.orchestration &&
    typeof setOrchestrationText === "function"
  ) {
    runOwnedEditorMutation(actionContext, () =>
      (setOrchestrationText as UnknownFunction)(text, { notify: true }),
    );
    return;
  }
  throw new Error(`${normalizedEditorKey} editor is not ready`);
}

function runOwnedEditorMutation(
  actionContext: JsonTemplateActionContext | null,
  operation: () => unknown,
): unknown {
  if (typeof actionContext?.runOwnedEditorMutation === "function") {
    return actionContext.runOwnedEditorMutation(operation);
  }
  return typeof operation === "function" ? operation() : undefined;
}

function editorRaw(
  editorKey: unknown,
  getEditorContext: () => JsonObject,
  normalizeEditorKey: (editorKey: unknown) => string,
  txEditor: JsonTemplateEditorKinds,
): string {
  const normalizedEditorKey = normalizeEditorKey(editorKey);
  const editors = recordValue(
    jsonTemplateEditorContext(getEditorContext).editors,
  );
  const txWorkflowRaw = editors.txWorkflowEditorRaw;
  if (
    normalizedEditorKey === txEditor.txWorkflow &&
    typeof txWorkflowRaw === "function"
  ) {
    return safeTemplateString((txWorkflowRaw as UnknownFunction)()).trim();
  }
  const orchestrationRaw = editors.orchestrationEditorRaw;
  if (
    normalizedEditorKey === txEditor.orchestration &&
    typeof orchestrationRaw === "function"
  ) {
    return safeTemplateString((orchestrationRaw as UnknownFunction)()).trim();
  }
  const txBlockRaw = editors.txBlockEditorRaw;
  if (
    normalizedEditorKey === txEditor.txBlock &&
    typeof txBlockRaw === "function"
  ) {
    return safeTemplateString((txBlockRaw as UnknownFunction)()).trim();
  }
  return "";
}

function refreshJsonTemplateEditorPreview(
  kind: string,
  getEditorContext: () => JsonObject,
  txTemplateKind: JsonTemplateEditorKinds,
): void {
  const context = jsonTemplateEditorContext(getEditorContext);
  if (kind === txTemplateKind.txWorkflow) {
    callObjectFunction(context, "updateTxWorkflowPreviewFromEditor");
  }
  if (kind === txTemplateKind.orchestration) {
    callObjectFunction(context, "updateOrchestrationPreviewFromEditor");
  }
}

function switchTxExecutionMode(
  kind: string,
  txTemplateKind: JsonTemplateEditorKinds,
  setExecutionModes: (modes: JsonObject) => unknown,
): void {
  setExecutionModes({
    txBlock: kind === txTemplateKind.txBlock ? "template" : undefined,
    txWorkflow: kind === txTemplateKind.txWorkflow ? "template" : undefined,
    orchestration:
      kind === txTemplateKind.orchestration ? "template" : undefined,
  });
}

function normalizeJsonEditorContent(
  editorKey: unknown,
  requiredKey: string,
  libraryConfig: JsonTemplateLibraryConfig,
  actionContext: JsonTemplateActionContext | null = null,
): string {
  const raw = editorRaw(
    editorKey,
    libraryConfig.getEditorContext,
    libraryConfig.normalizeEditorKey,
    libraryConfig.txEditor,
  );
  if (!raw) {
    throw new Error(libraryConfig.tr(requiredKey));
  }
  const normalized = JSON.stringify(JSON.parse(raw), null, 2);
  setPrettyJsonToEditor(
    editorKey,
    normalized,
    libraryConfig.getEditorContext,
    libraryConfig.normalizeEditorKey,
    libraryConfig.txEditor,
    actionContext,
  );
  return normalized;
}

function jsonTemplateContentFromEditor(
  kind: string,
  cfg: JsonTemplateKindConfig,
  libraryConfig: JsonTemplateLibraryConfig,
  actionContext: JsonTemplateActionContext | null = null,
): string {
  if (kind === libraryConfig.txTemplateKind.txBlock) {
    return JSON.stringify(
      callObjectFunction(
        jsonTemplateEditorContext(libraryConfig.getEditorContext),
        "buildTxBlockTemplatePayloadFromEditor",
      ),
      null,
      2,
    );
  }
  return normalizeJsonEditorContent(
    cfg.runEditor,
    kind === libraryConfig.txTemplateKind.txWorkflow
      ? "txWorkflowJsonRequired"
      : "orchestrationJsonRequired",
    libraryConfig,
    actionContext,
  );
}

function createJsonTemplateCache(
  txTemplateKind: JsonTemplateEditorKinds,
): TemplateCache {
  return {
    [txTemplateKind.txBlock]: [],
    [txTemplateKind.txWorkflow]: [],
    [txTemplateKind.orchestration]: [],
  };
}

function createJsonTemplateNamesFor(cache: TemplateCache) {
  return function namesFor(kind: string): string[] {
    return (cache[kind] || [])
      .map((templateMeta) => templateMeta.name)
      .filter((name): name is string => Boolean(name));
  };
}

type ConfigFor = (kind: string) => JsonTemplateKindConfig | null;
type GetSelectedName = (kind: string) => string;
type SetSelectedName = (kind: string, name: string) => unknown;
type NamesFor = (kind: string) => string[];
type LoadJsonTemplatesByKind = (
  kind: string,
  actionContext?: JsonTemplateActionContext | null,
) => Promise<void>;
type LoadTemplateIntoEditor = (
  kind: string,
  nameOverride?: unknown,
  actionContext?: JsonTemplateActionContext | null,
) => Promise<TransactionTemplateResource | null>;

function createJsonTemplateLoader({
  configFor,
  getSelectedName,
  libraryConfig,
  setSelectedName,
}: {
  configFor: ConfigFor;
  getSelectedName: GetSelectedName;
  libraryConfig: JsonTemplateLibraryConfig;
  setSelectedName: SetSelectedName;
}): LoadTemplateIntoEditor {
  return async function loadTemplateIntoEditor(
    kind: string,
    nameOverride: unknown = "",
    actionContext: JsonTemplateActionContext | null = null,
  ): Promise<TransactionTemplateResource | null> {
    const cfg = configFor(kind);
    if (!cfg) return null;
    const name = safeTemplateString(
      nameOverride || getSelectedName(kind),
    ).trim();
    if (!name) {
      libraryConfig.setStatus(
        cfg.runOutput,
        libraryConfig.tr(cfg.nameRequiredKey),
        "error",
      );
      return null;
    }
    libraryConfig.setRunningStatus(cfg.runOutput);
    try {
      const detail = templateResource(
        await libraryConfig.getTemplateResource(cfg.apiBase, name),
      );
      if (
        typeof actionContext?.isCurrent === "function" &&
        !actionContext.isCurrent()
      ) {
        return detail;
      }
      setSelectedName(kind, detail.name || name);
      if (detail?.content) {
        setPrettyJsonToEditor(
          cfg.runEditor,
          detail.content,
          libraryConfig.getEditorContext,
          libraryConfig.normalizeEditorKey,
          libraryConfig.txEditor,
          actionContext,
        );
        refreshJsonTemplateEditorPreview(
          kind,
          libraryConfig.getEditorContext,
          libraryConfig.txTemplateKind,
        );
      }
      libraryConfig.setNamedStatus(
        cfg.runOutput,
        "loaded",
        "Loaded",
        detail?.name || name,
      );
      return detail;
    } catch (error) {
      if (
        typeof actionContext?.isCurrent === "function" &&
        !actionContext.isCurrent()
      ) {
        return null;
      }
      libraryConfig.setErrorStatus(cfg.runOutput, error);
      return null;
    }
  };
}

function createJsonTemplateMutations({
  configFor,
  getSelectedName,
  libraryConfig,
  loadJsonTemplatesByKind,
  namesFor,
  setSelectedName,
}: {
  configFor: ConfigFor;
  getSelectedName: GetSelectedName;
  libraryConfig: JsonTemplateLibraryConfig;
  loadJsonTemplatesByKind: LoadJsonTemplatesByKind;
  namesFor: NamesFor;
  setSelectedName: SetSelectedName;
}) {
  async function saveTemplateFromExecution(kind: string): Promise<void> {
    const cfg = configFor(kind);
    if (!cfg) return;
    const name = getSelectedName(kind);
    if (!name) {
      libraryConfig.setStatus(
        cfg.runOutput,
        libraryConfig.tr(cfg.nameRequiredKey),
        "error",
      );
      return;
    }
    libraryConfig.setRunningStatus(cfg.runOutput);
    try {
      const content = jsonTemplateContentFromEditor(kind, cfg, libraryConfig);
      const exists = namesFor(kind).includes(name);
      const savedTemplatePayload = templateResource(
        exists
          ? await libraryConfig.updateTemplateResource(
              cfg.apiBase,
              name,
              content,
            )
          : await libraryConfig.createTemplateResource(
              cfg.apiBase,
              name,
              content,
            ),
      );
      await loadJsonTemplatesByKind(kind);
      setSelectedName(kind, savedTemplatePayload.name || name);
      if (kind === libraryConfig.txTemplateKind.txBlock) {
        refreshTxWorkflowBuilderFromContext(libraryConfig.getEditorContext);
      }
      libraryConfig.setNamedStatus(
        cfg.runOutput,
        exists ? "saved" : "created",
        exists ? "Saved" : "Created",
        savedTemplatePayload.name || name,
      );
    } catch (error) {
      libraryConfig.setErrorStatus(cfg.runOutput, error);
    }
  }

  async function deleteTemplateFromExecution(kind: string): Promise<void> {
    const cfg = configFor(kind);
    if (!cfg) return;
    const name = getSelectedName(kind);
    if (!name) {
      libraryConfig.setStatus(
        cfg.runOutput,
        libraryConfig.tr(cfg.nameRequiredKey),
        "error",
      );
      return;
    }
    libraryConfig.setRunningStatus(cfg.runOutput);
    try {
      await libraryConfig.deleteTemplateResource(cfg.apiBase, name);
      await loadJsonTemplatesByKind(kind);
      setSelectedName(kind, "");
      if (kind === libraryConfig.txTemplateKind.txBlock) {
        refreshTxWorkflowBuilderFromContext(libraryConfig.getEditorContext);
      }
      libraryConfig.setNamedStatus(cfg.runOutput, "deleted", "Deleted", name);
    } catch (error) {
      libraryConfig.setErrorStatus(cfg.runOutput, error);
    }
  }

  return {
    deleteTemplateFromExecution,
    saveTemplateFromExecution,
  };
}

function createJsonTemplateDraftOperation({
  configFor,
  getSelectedName,
  libraryConfig,
  loadJsonTemplatesByKind,
  loadTemplateIntoEditor,
  namesFor,
  setSelectedName,
}: {
  configFor: ConfigFor;
  getSelectedName: GetSelectedName;
  libraryConfig: JsonTemplateLibraryConfig;
  loadJsonTemplatesByKind: LoadJsonTemplatesByKind;
  loadTemplateIntoEditor: LoadTemplateIntoEditor;
  namesFor: NamesFor;
  setSelectedName: SetSelectedName;
}) {
  return async function createTemplateDraft(
    kind: string,
    actionContext: JsonTemplateActionContext | null = null,
  ): Promise<unknown> {
    const cfg = configFor(kind);
    if (!cfg) return;
    const name = libraryConfig.promptForResourceName(
      libraryConfig.tr(cfg.newPromptKey),
    );
    if (!name) return;
    if (namesFor(kind).includes(name)) {
      setSelectedName(kind, name);
      await loadTemplateIntoEditor(kind, "", actionContext);
      if (
        typeof actionContext?.isCurrent === "function" &&
        !actionContext.isCurrent()
      ) {
        return;
      }
      libraryConfig.setStatus(
        cfg.runOutput,
        libraryConfig.tr("templateExistsHint", "Template already exists"),
        "warning",
      );
      return;
    }
    switchTxExecutionMode(
      kind,
      libraryConfig.txTemplateKind,
      libraryConfig.setExecutionModes,
    );
    libraryConfig.setRunningStatus(cfg.runOutput);
    try {
      const content = jsonTemplateContentFromEditor(
        kind,
        cfg,
        libraryConfig,
        actionContext,
      );
      const createdTemplatePayload = templateResource(
        await libraryConfig.createTemplateResource(cfg.apiBase, name, content),
      );
      if (
        typeof actionContext?.isCurrent === "function" &&
        !actionContext.isCurrent()
      ) {
        return createdTemplatePayload;
      }
      await loadJsonTemplatesByKind(kind, actionContext);
      if (
        typeof actionContext?.isCurrent === "function" &&
        !actionContext.isCurrent()
      ) {
        return createdTemplatePayload;
      }
      setSelectedName(kind, createdTemplatePayload.name || name);
      if (kind === libraryConfig.txTemplateKind.txBlock) {
        refreshTxWorkflowBuilderFromContext(libraryConfig.getEditorContext);
      }
      libraryConfig.setNamedStatus(
        cfg.runOutput,
        "created",
        "Created",
        createdTemplatePayload.name || name,
      );
    } catch (error) {
      if (
        typeof actionContext?.isCurrent === "function" &&
        !actionContext.isCurrent()
      ) {
        return null;
      }
      libraryConfig.setErrorStatus(cfg.runOutput, error);
    }
  };
}

export function jsonTemplateSelectStateFor(
  kind: string,
): Writable<JsonTemplateSelectState> {
  let state = jsonTemplateSelectStates.get(kind);
  if (!state) {
    state = writable(defaultJsonTemplateSelectState(kind));
    jsonTemplateSelectStates.set(kind, state);
  }
  return state;
}

export function updateJsonTemplateSelectOptions(
  kind: string,
  selectInput: Partial<JsonTemplateSelectState> = {},
): void {
  const state = {
    names: Array.isArray(selectInput.names) ? selectInput.names : [],
    selected: safeTemplateString(selectInput.selected || "").trim(),
  };
  setJsonTemplateSelectState(kind, state);
}

export function jsonTemplateSelectValue(kind: string): string {
  return safeTemplateString(
    getStore(jsonTemplateSelectStateFor(kind))?.selected || "",
  ).trim();
}

export function setJsonTemplateSelectValue(
  kind: string,
  templateName: unknown = "",
): void {
  const state = jsonTemplateSelectState[kind] || { names: [], selected: "" };
  updateJsonTemplateSelectOptions(kind, {
    names: state.names,
    selected: safeTemplateString(templateName),
  });
}

export async function loadAllJsonTemplates() {
  await callObjectFunction(activeJsonTemplateLibrary, "loadAllJsonTemplates");
}

export function createJsonTemplateLibrary(
  libraryCfg: unknown = {},
): JsonTemplateLibrary {
  const libraryConfig = normalizeJsonTemplateLibraryConfig(libraryCfg);
  const cache = createJsonTemplateCache(libraryConfig.txTemplateKind);
  const namesFor = createJsonTemplateNamesFor(cache);

  function refreshJsonTemplateOptionsByKind(kind: string): void {
    const cfg = libraryConfig.configFor(kind);
    if (!cfg) return;
    libraryConfig.updateOptions(kind, {
      names: namesFor(kind),
      selected: libraryConfig.getSelectedName(kind),
    });
  }

  function refreshJsonTemplateListByKind(
    _kind?: unknown,
    _error?: unknown,
  ): void {
    // Lists are driven by Svelte pages; keep a stable hook for module callers.
  }

  function refreshAllJsonTemplateOptions(): void {
    refreshJsonTemplateOptionsByKind(libraryConfig.txTemplateKind.txBlock);
    refreshJsonTemplateOptionsByKind(libraryConfig.txTemplateKind.txWorkflow);
    refreshJsonTemplateOptionsByKind(
      libraryConfig.txTemplateKind.orchestration,
    );
  }

  function refreshAllJsonTemplateLists(): void {
    refreshJsonTemplateListByKind(libraryConfig.txTemplateKind.txBlock);
    refreshJsonTemplateListByKind(libraryConfig.txTemplateKind.txWorkflow);
    refreshJsonTemplateListByKind(libraryConfig.txTemplateKind.orchestration);
  }

  async function loadJsonTemplatesByKind(
    kind: string,
    actionContext: JsonTemplateActionContext | null = null,
  ): Promise<void> {
    const cfg = libraryConfig.configFor(kind);
    if (!cfg) return;
    try {
      const templateListPayload = await libraryConfig.listTemplateResource(
        cfg.apiBase,
      );
      if (
        typeof actionContext?.isCurrent === "function" &&
        !actionContext.isCurrent()
      ) {
        return;
      }
      cache[kind] = Array.isArray(templateListPayload)
        ? templateListPayload.map(templateResource)
        : [];
      refreshJsonTemplateOptionsByKind(kind);
      refreshJsonTemplateListByKind(kind);
    } catch (error) {
      if (
        typeof actionContext?.isCurrent === "function" &&
        !actionContext.isCurrent()
      ) {
        return;
      }
      cache[kind] = [];
      refreshJsonTemplateOptionsByKind(kind);
      refreshJsonTemplateListByKind(kind, error);
    }
  }

  async function loadTxBlockTemplates(): Promise<void> {
    await loadJsonTemplatesByKind(libraryConfig.txTemplateKind.txBlock);
    refreshTxWorkflowBuilderFromContext(libraryConfig.getEditorContext);
  }

  async function loadTxWorkflowTemplates(): Promise<void> {
    await loadJsonTemplatesByKind(libraryConfig.txTemplateKind.txWorkflow);
  }

  async function loadOrchestrationTemplates(): Promise<void> {
    await loadJsonTemplatesByKind(libraryConfig.txTemplateKind.orchestration);
  }

  async function loadLibraryTemplates(): Promise<void> {
    await Promise.allSettled([
      loadTxBlockTemplates(),
      loadTxWorkflowTemplates(),
      loadOrchestrationTemplates(),
    ]);
  }

  const loadTemplateIntoEditor = createJsonTemplateLoader({
    configFor: libraryConfig.configFor,
    getSelectedName: libraryConfig.getSelectedName,
    libraryConfig,
    setSelectedName: libraryConfig.setSelectedName,
  });
  const { deleteTemplateFromExecution, saveTemplateFromExecution } =
    createJsonTemplateMutations({
      configFor: libraryConfig.configFor,
      getSelectedName: libraryConfig.getSelectedName,
      libraryConfig,
      loadJsonTemplatesByKind,
      namesFor,
      setSelectedName: libraryConfig.setSelectedName,
    });
  const createTemplateDraft = createJsonTemplateDraftOperation({
    configFor: libraryConfig.configFor,
    getSelectedName: libraryConfig.getSelectedName,
    libraryConfig,
    loadJsonTemplatesByKind,
    loadTemplateIntoEditor,
    namesFor,
    setSelectedName: libraryConfig.setSelectedName,
  });

  const jsonTemplateLibrary: JsonTemplateLibrary = {
    createTemplateDraft,
    deleteTemplateFromExecution,
    loadAllJsonTemplates: loadLibraryTemplates,
    loadJsonTemplatesByKind,
    loadOrchestrationTemplates,
    loadTemplateIntoEditor,
    loadTxBlockTemplates,
    loadTxWorkflowTemplates,
    refreshAllJsonTemplateLists,
    refreshAllJsonTemplateOptions,
    saveTemplateFromExecution,
  };

  function activate(): () => void {
    activeJsonTemplateLibrary = jsonTemplateLibrary;
    refreshAllJsonTemplateOptions();
    return function deactivateJsonTemplateLibrary() {
      if (activeJsonTemplateLibrary === jsonTemplateLibrary) {
        activeJsonTemplateLibrary = null;
      }
    };
  }

  return {
    ...jsonTemplateLibrary,
    activate,
  };
}
