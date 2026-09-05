import { get as getStore, writable } from "svelte/store";
import type { Writable } from "svelte/store";
import type { TxExecutionMode } from "../../../config/dashboardModes.js";
import { transactionJsonTemplateRuntime } from "../infrastructure/transactionJsonTemplateRuntime.js";
import type {
  JsonObject,
  JsonTemplateActionContext,
  JsonTemplateSelectState,
  TransactionTemplateResource,
  TransactionTemplateSummary,
} from "../model/types.js";
import { TX_EDITOR, TX_TEMPLATE_KIND } from "./transactionJsonEditorState.js";
import type { TxEditorKey } from "./transactionJsonEditorState.js";

interface JsonTemplateKindConfig {
  apiBase: string;
  emptyKey?: string;
  nameRequiredKey: string;
  newPromptKey: string;
  runEditor: TxEditorKey;
  runOutput: string;
}

interface JsonTemplateEditorKinds {
  orchestration: string;
  txBlock: string;
  txWorkflow: string;
}

interface JsonTemplateEditorPort {
  orchestrationEditorRaw?(): string;
  setOrchestrationEditorText?(
    text: string,
    options?: { notify?: boolean },
  ): void;
  setTxBlockEditorRawText?(text: string, options?: { notify?: boolean }): void;
  setTxWorkflowEditorText?(text: string, options?: { notify?: boolean }): void;
  txBlockEditorRaw?(): string;
  txWorkflowEditorRaw?(): string;
}

interface JsonTemplateEditorContext {
  buildTxBlockTemplatePayloadFromEditor?(): JsonObject;
  editors?: JsonTemplateEditorPort | null;
  refreshTxWorkflowBuilder?(): void;
  updateOrchestrationPreviewFromEditor?(): void;
  updateTxWorkflowPreviewFromEditor?(): void;
}

interface JsonTemplateExecutionModes {
  orchestration?: TxExecutionMode;
  txBlock?: TxExecutionMode;
  txWorkflow?: TxExecutionMode;
}

interface JsonTemplateLibraryConfig {
  configFor(kind: string): JsonTemplateKindConfig | null;
  createTemplateResource(
    apiBase: string,
    name: string,
    content: string,
  ): Promise<TransactionTemplateResource>;
  deleteTemplateResource(apiBase: string, name: string): Promise<object>;
  getEditorContext(): JsonTemplateEditorContext;
  getTemplateResource(
    apiBase: string,
    name: string,
  ): Promise<TransactionTemplateResource>;
  getSelectedName(kind: string): string;
  listTemplateResource(apiBase: string): Promise<TransactionTemplateSummary[]>;
  normalizeEditorKey(editorKey: string): string;
  promptForResourceName(message: string): string | null;
  setErrorStatus(output: string, error: unknown): void;
  setExecutionModes(modes: JsonTemplateExecutionModes): void;
  setNamedStatus(
    output: string,
    action: string,
    fallback: string,
    name: string,
  ): void;
  setRunningStatus(output: string): void;
  setSelectedName(kind: string, name: string): void;
  setStatus(output: string, message: string, tone: string): void;
  tr(key: string, fallback?: string): string;
  txEditor: JsonTemplateEditorKinds;
  txTemplateKind: JsonTemplateEditorKinds;
  updateTemplateResource(
    apiBase: string,
    name: string,
    content: string,
  ): Promise<TransactionTemplateResource>;
  updateOptions(kind: string, state: JsonTemplateSelectState): void;
}

type JsonTemplateLibraryConfigInput = Partial<JsonTemplateLibraryConfig>;

interface JsonTemplateLibrary {
  activate?: () => () => void;
  createTemplateDraft(
    kind: string,
    actionContext?: JsonTemplateActionContext | null,
  ): Promise<TransactionTemplateResource | null | void>;
  deleteTemplateFromExecution(kind: string): Promise<void>;
  loadAllJsonTemplates(): Promise<void>;
  loadJsonTemplatesByKind(
    kind: string,
    actionContext?: JsonTemplateActionContext | null,
  ): Promise<void>;
  loadOrchestrationTemplates(): Promise<void>;
  loadTemplateIntoEditor(
    kind: string,
    nameOverride?: string,
    actionContext?: JsonTemplateActionContext | null,
  ): Promise<TransactionTemplateResource | null>;
  loadTxBlockTemplates(): Promise<void>;
  loadTxWorkflowTemplates(): Promise<void>;
  refreshAllJsonTemplateLists(): void;
  refreshAllJsonTemplateOptions(): void;
  saveTemplateFromExecution(kind: string): Promise<void>;
}

type TemplateCache = Record<string, TransactionTemplateSummary[]>;

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
  getEditorContext: () => JsonTemplateEditorContext,
): JsonTemplateEditorContext {
  return getEditorContext();
}

function refreshTxWorkflowBuilderFromContext(
  getEditorContext: () => JsonTemplateEditorContext,
): void {
  const context = jsonTemplateEditorContext(getEditorContext);
  context.refreshTxWorkflowBuilder?.();
}

function prettyJsonText(rawContent: string): string {
  const text = rawContent.trim();
  if (!text) return "";
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

function normalizeTxEditorKey(editorKey: string): string {
  const key = editorKey.trim();
  return Object.values<string>(TX_EDITOR).includes(key) ? key : "";
}

function normalizeJsonTemplateLibraryConfig(
  config: JsonTemplateLibraryConfigInput = {},
): JsonTemplateLibraryConfig {
  return {
    configFor: config.configFor ?? (() => null),
    createTemplateResource:
      config.createTemplateResource ??
      transactionJsonTemplateRuntime.createTemplateResource,
    deleteTemplateResource:
      config.deleteTemplateResource ??
      transactionJsonTemplateRuntime.deleteTemplateResource,
    getEditorContext: config.getEditorContext ?? (() => ({})),
    getTemplateResource:
      config.getTemplateResource ??
      transactionJsonTemplateRuntime.getTemplateResource,
    getSelectedName: config.getSelectedName ?? (() => ""),
    listTemplateResource:
      config.listTemplateResource ??
      transactionJsonTemplateRuntime.listTemplateResource,
    normalizeEditorKey: config.normalizeEditorKey ?? normalizeTxEditorKey,
    promptForResourceName:
      config.promptForResourceName ??
      transactionJsonTemplateRuntime.promptForResourceName,
    setErrorStatus: config.setErrorStatus ?? (() => undefined),
    setExecutionModes: config.setExecutionModes ?? (() => undefined),
    setNamedStatus: config.setNamedStatus ?? (() => undefined),
    setRunningStatus: config.setRunningStatus ?? (() => undefined),
    setSelectedName: config.setSelectedName ?? (() => undefined),
    setStatus: config.setStatus ?? (() => undefined),
    tr: config.tr ?? ((key: string, fallback: string = key) => fallback),
    txEditor: config.txEditor ?? TX_EDITOR,
    txTemplateKind: config.txTemplateKind ?? TX_TEMPLATE_KIND,
    updateTemplateResource:
      config.updateTemplateResource ??
      transactionJsonTemplateRuntime.updateTemplateResource,
    updateOptions: config.updateOptions ?? (() => undefined),
  };
}

function setPrettyJsonToEditor(
  editorKey: string,
  rawContent: string,
  getEditorContext: () => JsonTemplateEditorContext,
  normalizeEditorKey: (editorKey: string) => string,
  txEditor: JsonTemplateEditorKinds,
  actionContext: JsonTemplateActionContext | null = null,
): void {
  const normalizedEditorKey = normalizeEditorKey(editorKey);
  const text = prettyJsonText(rawContent);
  const editors = jsonTemplateEditorContext(getEditorContext).editors;
  const setTxBlockText = editors?.setTxBlockEditorRawText;
  if (
    normalizedEditorKey === txEditor.txBlock &&
    typeof setTxBlockText === "function"
  ) {
    runOwnedEditorMutation(actionContext, () => setTxBlockText(text));
    return;
  }
  const setTxWorkflowText = editors?.setTxWorkflowEditorText;
  if (
    normalizedEditorKey === txEditor.txWorkflow &&
    typeof setTxWorkflowText === "function"
  ) {
    runOwnedEditorMutation(actionContext, () =>
      setTxWorkflowText(text, { notify: true }),
    );
    return;
  }
  const setOrchestrationText = editors?.setOrchestrationEditorText;
  if (
    normalizedEditorKey === txEditor.orchestration &&
    typeof setOrchestrationText === "function"
  ) {
    runOwnedEditorMutation(actionContext, () =>
      setOrchestrationText(text, { notify: true }),
    );
    return;
  }
  throw new Error(`${normalizedEditorKey} editor is not ready`);
}

function runOwnedEditorMutation<TResult>(
  actionContext: JsonTemplateActionContext | null,
  operation: () => TResult,
): TResult | undefined {
  if (typeof actionContext?.runOwnedEditorMutation === "function") {
    return actionContext.runOwnedEditorMutation(operation);
  }
  return operation();
}

function editorRaw(
  editorKey: string,
  getEditorContext: () => JsonTemplateEditorContext,
  normalizeEditorKey: (editorKey: string) => string,
  txEditor: JsonTemplateEditorKinds,
): string {
  const normalizedEditorKey = normalizeEditorKey(editorKey);
  const editors = jsonTemplateEditorContext(getEditorContext).editors;
  const txWorkflowRaw = editors?.txWorkflowEditorRaw;
  if (
    normalizedEditorKey === txEditor.txWorkflow &&
    typeof txWorkflowRaw === "function"
  ) {
    return txWorkflowRaw().trim();
  }
  const orchestrationRaw = editors?.orchestrationEditorRaw;
  if (
    normalizedEditorKey === txEditor.orchestration &&
    typeof orchestrationRaw === "function"
  ) {
    return orchestrationRaw().trim();
  }
  const txBlockRaw = editors?.txBlockEditorRaw;
  if (
    normalizedEditorKey === txEditor.txBlock &&
    typeof txBlockRaw === "function"
  ) {
    return txBlockRaw().trim();
  }
  return "";
}

function refreshJsonTemplateEditorPreview(
  kind: string,
  getEditorContext: () => JsonTemplateEditorContext,
  txTemplateKind: JsonTemplateEditorKinds,
): void {
  const context = jsonTemplateEditorContext(getEditorContext);
  if (kind === txTemplateKind.txWorkflow) {
    context.updateTxWorkflowPreviewFromEditor?.();
  }
  if (kind === txTemplateKind.orchestration) {
    context.updateOrchestrationPreviewFromEditor?.();
  }
}

function switchTxExecutionMode(
  kind: string,
  txTemplateKind: JsonTemplateEditorKinds,
  setExecutionModes: (modes: JsonTemplateExecutionModes) => void,
): void {
  setExecutionModes({
    txBlock: kind === txTemplateKind.txBlock ? "template" : undefined,
    txWorkflow: kind === txTemplateKind.txWorkflow ? "template" : undefined,
    orchestration:
      kind === txTemplateKind.orchestration ? "template" : undefined,
  });
}

function normalizeJsonEditorContent(
  editorKey: string,
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
    const buildPayload = jsonTemplateEditorContext(
      libraryConfig.getEditorContext,
    ).buildTxBlockTemplatePayloadFromEditor;
    if (!buildPayload) {
      throw new Error(`${cfg.runEditor} editor is not ready`);
    }
    return JSON.stringify(buildPayload(), null, 2);
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
type SetSelectedName = (kind: string, name: string) => void;
type NamesFor = (kind: string) => string[];
type LoadJsonTemplatesByKind = (
  kind: string,
  actionContext?: JsonTemplateActionContext | null,
) => Promise<void>;
type LoadTemplateIntoEditor = (
  kind: string,
  nameOverride?: string,
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
    nameOverride = "",
    actionContext: JsonTemplateActionContext | null = null,
  ): Promise<TransactionTemplateResource | null> {
    const cfg = configFor(kind);
    if (!cfg) return null;
    const name = (nameOverride || getSelectedName(kind)).trim();
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
      const detail = await libraryConfig.getTemplateResource(cfg.apiBase, name);
      if (
        typeof actionContext?.isCurrent === "function" &&
        !actionContext.isCurrent()
      ) {
        return detail;
      }
      setSelectedName(kind, detail.name || name);
      if (detail.content) {
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
        detail.name || name,
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
      const savedTemplatePayload = exists
        ? await libraryConfig.updateTemplateResource(cfg.apiBase, name, content)
        : await libraryConfig.createTemplateResource(
            cfg.apiBase,
            name,
            content,
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
  ): Promise<TransactionTemplateResource | null | void> {
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
      const createdTemplatePayload = await libraryConfig.createTemplateResource(
        cfg.apiBase,
        name,
        content,
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
    selected: (selectInput.selected ?? "").trim(),
  };
  setJsonTemplateSelectState(kind, state);
}

export function jsonTemplateSelectValue(kind: string): string {
  return getStore(jsonTemplateSelectStateFor(kind)).selected.trim();
}

export function setJsonTemplateSelectValue(
  kind: string,
  templateName = "",
): void {
  const state = jsonTemplateSelectState[kind] || { names: [], selected: "" };
  updateJsonTemplateSelectOptions(kind, {
    names: state.names,
    selected: templateName,
  });
}

export async function loadAllJsonTemplates(): Promise<void> {
  await activeJsonTemplateLibrary?.loadAllJsonTemplates();
}

export function createJsonTemplateLibrary(
  libraryCfg: JsonTemplateLibraryConfigInput = {},
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

  function refreshJsonTemplateListByKind(): void {
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
    refreshJsonTemplateListByKind();
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
      cache[kind] = templateListPayload;
      refreshJsonTemplateOptionsByKind(kind);
      refreshJsonTemplateListByKind();
    } catch {
      if (
        typeof actionContext?.isCurrent === "function" &&
        !actionContext.isCurrent()
      ) {
        return;
      }
      cache[kind] = [];
      refreshJsonTemplateOptionsByKind(kind);
      refreshJsonTemplateListByKind();
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
