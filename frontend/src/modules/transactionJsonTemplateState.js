import { get as getStore, writable } from "svelte/store";

import {
  createTemplateResource,
  deleteTemplateResource,
  getTemplateResource,
  listTemplateResource,
  updateTemplateResource,
} from "../api/client.js";
import {
  promptForResourceName,
  safeString as safeTemplateString,
} from "../lib/ui.js";
import { TX_EDITOR, TX_TEMPLATE_KIND } from "./transactionJsonEditorState.js";

const EMPTY_OBJECT = Object.freeze({});

const jsonTemplateSelectState = {
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

const jsonTemplateSelectStates = new Map();
let activeJsonTemplateLibrary = null;

function callObjectFunction(target, name, ...args) {
  const fn = target?.[name];
  return typeof fn === "function" ? fn(...args) : undefined;
}

function defaultJsonTemplateSelectState(kind) {
  return jsonTemplateSelectState[kind] || { names: [], selected: "" };
}

function setJsonTemplateSelectState(kind, state) {
  jsonTemplateSelectState[kind] = state;
  jsonTemplateSelectStates.get(kind)?.set(state);
}

function jsonTemplateEditorContext(getEditorContext) {
  return typeof getEditorContext === "function"
    ? getEditorContext() || EMPTY_OBJECT
    : EMPTY_OBJECT;
}

function refreshTxWorkflowBuilderFromContext(getEditorContext) {
  const context = jsonTemplateEditorContext(getEditorContext);
  callObjectFunction(context, "refreshTxWorkflowBuilder");
}

function prettyJsonText(rawContent) {
  const text = safeTemplateString(rawContent).trim();
  if (!text) return "";
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch (_) {
    return text;
  }
}

function normalizeTxEditorKey(editorKey) {
  const key = safeTemplateString(editorKey).trim();
  return Object.values(TX_EDITOR).includes(key) ? key : "";
}

function normalizeJsonTemplateLibraryConfig(libraryCfg = {}) {
  return {
    configFor:
      typeof libraryCfg.configFor === "function"
        ? libraryCfg.configFor
        : () => null,
    getEditorContext:
      typeof libraryCfg.getEditorContext === "function"
        ? libraryCfg.getEditorContext
        : () => EMPTY_OBJECT,
    getSelectedName:
      typeof libraryCfg.getSelectedName === "function"
        ? libraryCfg.getSelectedName
        : () => "",
    normalizeEditorKey:
      typeof libraryCfg.normalizeEditorKey === "function"
        ? libraryCfg.normalizeEditorKey
        : normalizeTxEditorKey,
    setErrorStatus:
      typeof libraryCfg.setErrorStatus === "function"
        ? libraryCfg.setErrorStatus
        : () => {},
    setExecutionModes:
      typeof libraryCfg.setExecutionModes === "function"
        ? libraryCfg.setExecutionModes
        : () => {},
    setNamedStatus:
      typeof libraryCfg.setNamedStatus === "function"
        ? libraryCfg.setNamedStatus
        : () => {},
    setRunningStatus:
      typeof libraryCfg.setRunningStatus === "function"
        ? libraryCfg.setRunningStatus
        : () => {},
    setSelectedName:
      typeof libraryCfg.setSelectedName === "function"
        ? libraryCfg.setSelectedName
        : () => {},
    setStatus:
      typeof libraryCfg.setStatus === "function"
        ? libraryCfg.setStatus
        : () => {},
    tr:
      typeof libraryCfg.tr === "function"
        ? libraryCfg.tr
        : (key, fallback = key) => fallback,
    txEditor: libraryCfg.txEditor || TX_EDITOR,
    txTemplateKind: libraryCfg.txTemplateKind || TX_TEMPLATE_KIND,
    updateOptions:
      typeof libraryCfg.updateOptions === "function"
        ? libraryCfg.updateOptions
        : () => {},
  };
}

function setPrettyJsonToEditor(
  editorKey,
  rawContent,
  getEditorContext,
  normalizeEditorKey,
  txEditor,
) {
  const normalizedEditorKey = normalizeEditorKey(editorKey);
  const text = prettyJsonText(rawContent);
  const editors = jsonTemplateEditorContext(getEditorContext).editors || null;
  const setTxBlockText = editors?.setTxBlockEditorRawText;
  if (normalizedEditorKey === txEditor.txBlock && setTxBlockText) {
    setTxBlockText(text);
    return;
  }
  const setTxWorkflowText = editors?.setTxWorkflowEditorText;
  if (normalizedEditorKey === txEditor.txWorkflow && setTxWorkflowText) {
    setTxWorkflowText(text, { notify: true });
    return;
  }
  const setOrchestrationText = editors?.setOrchestrationEditorText;
  if (normalizedEditorKey === txEditor.orchestration && setOrchestrationText) {
    setOrchestrationText(text, { notify: true });
    return;
  }
  throw new Error(`${normalizedEditorKey} editor is not ready`);
}

function editorRaw(editorKey, getEditorContext, normalizeEditorKey, txEditor) {
  const normalizedEditorKey = normalizeEditorKey(editorKey);
  const editors = jsonTemplateEditorContext(getEditorContext).editors || null;
  const txWorkflowRaw = editors?.txWorkflowEditorRaw;
  if (normalizedEditorKey === txEditor.txWorkflow && txWorkflowRaw) {
    return txWorkflowRaw().trim();
  }
  const orchestrationRaw = editors?.orchestrationEditorRaw;
  if (normalizedEditorKey === txEditor.orchestration && orchestrationRaw) {
    return orchestrationRaw().trim();
  }
  const txBlockRaw = editors?.txBlockEditorRaw;
  if (normalizedEditorKey === txEditor.txBlock && txBlockRaw) {
    return txBlockRaw().trim();
  }
  return "";
}

function refreshJsonTemplateEditorPreview(
  kind,
  getEditorContext,
  txTemplateKind,
) {
  const context = jsonTemplateEditorContext(getEditorContext);
  if (kind === txTemplateKind.txWorkflow) {
    callObjectFunction(context, "updateTxWorkflowPreviewFromEditor");
  }
  if (kind === txTemplateKind.orchestration) {
    callObjectFunction(context, "updateOrchestrationPreviewFromEditor");
  }
}

function switchTxExecutionMode(kind, txTemplateKind, setExecutionModes) {
  setExecutionModes({
    txBlock: kind === txTemplateKind.txBlock ? "template" : undefined,
    txWorkflow: kind === txTemplateKind.txWorkflow ? "template" : undefined,
    orchestration:
      kind === txTemplateKind.orchestration ? "template" : undefined,
  });
}

function normalizeJsonEditorContent(editorKey, requiredKey, libraryConfig) {
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
  );
  return normalized;
}

function jsonTemplateContentFromEditor(kind, cfg, libraryConfig) {
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
  );
}

function createJsonTemplateCache(txTemplateKind) {
  return {
    [txTemplateKind.txBlock]: [],
    [txTemplateKind.txWorkflow]: [],
    [txTemplateKind.orchestration]: [],
  };
}

function createJsonTemplateNamesFor(cache) {
  return function namesFor(kind) {
    return cache[kind].map((templateMeta) => templateMeta.name).filter(Boolean);
  };
}

function createJsonTemplateLoader({
  configFor,
  getSelectedName,
  libraryConfig,
  setSelectedName,
}) {
  return async function loadTemplateIntoEditor(kind, nameOverride = "") {
    const cfg = configFor(kind);
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
      const detail = await getTemplateResource(cfg.apiBase, name);
      setSelectedName(kind, detail.name || name);
      if (detail?.content) {
        setPrettyJsonToEditor(
          cfg.runEditor,
          detail.content,
          libraryConfig.getEditorContext,
          libraryConfig.normalizeEditorKey,
          libraryConfig.txEditor,
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
}) {
  async function saveTemplateFromExecution(kind) {
    const cfg = configFor(kind);
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
        ? await updateTemplateResource(cfg.apiBase, name, content)
        : await createTemplateResource(cfg.apiBase, name, content);
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

  async function deleteTemplateFromExecution(kind) {
    const cfg = configFor(kind);
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
      await deleteTemplateResource(cfg.apiBase, name);
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
}) {
  return async function createTemplateDraft(kind) {
    const cfg = configFor(kind);
    const name = promptForResourceName(libraryConfig.tr(cfg.newPromptKey));
    if (!name) return;
    if (namesFor(kind).includes(name)) {
      setSelectedName(kind, name);
      await loadTemplateIntoEditor(kind);
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
      const content = jsonTemplateContentFromEditor(kind, cfg, libraryConfig);
      const createdTemplatePayload = await createTemplateResource(
        cfg.apiBase,
        name,
        content,
      );
      await loadJsonTemplatesByKind(kind);
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
      libraryConfig.setErrorStatus(cfg.runOutput, error);
    }
  };
}

export function jsonTemplateSelectStateFor(kind) {
  if (!jsonTemplateSelectStates.has(kind)) {
    jsonTemplateSelectStates.set(
      kind,
      writable(defaultJsonTemplateSelectState(kind)),
    );
  }
  return jsonTemplateSelectStates.get(kind);
}

export function updateJsonTemplateSelectOptions(kind, selectInput = {}) {
  const state = {
    names: Array.isArray(selectInput.names) ? selectInput.names : [],
    selected: safeTemplateString(selectInput.selected || "").trim(),
  };
  setJsonTemplateSelectState(kind, state);
}

export function jsonTemplateSelectValue(kind) {
  return safeTemplateString(
    getStore(jsonTemplateSelectStateFor(kind))?.selected || "",
  ).trim();
}

export function setJsonTemplateSelectValue(kind, templateName = "") {
  const state = jsonTemplateSelectState[kind] || { names: [], selected: "" };
  updateJsonTemplateSelectOptions(kind, {
    names: state.names,
    selected: templateName,
  });
}

export async function loadAllJsonTemplates() {
  await callObjectFunction(activeJsonTemplateLibrary, "loadAllJsonTemplates");
}

export function createJsonTemplateLibrary(libraryCfg = {}) {
  const libraryConfig = normalizeJsonTemplateLibraryConfig(libraryCfg);
  const cache = createJsonTemplateCache(libraryConfig.txTemplateKind);
  const namesFor = createJsonTemplateNamesFor(cache);

  function refreshJsonTemplateOptionsByKind(kind) {
    const cfg = libraryConfig.configFor(kind);
    if (!cfg) return;
    libraryConfig.updateOptions(kind, {
      names: namesFor(kind),
      selected: libraryConfig.getSelectedName(kind),
    });
  }

  function refreshJsonTemplateListByKind() {
    // Lists are driven by Svelte pages; keep a stable hook for module callers.
  }

  function refreshAllJsonTemplateOptions() {
    refreshJsonTemplateOptionsByKind(libraryConfig.txTemplateKind.txBlock);
    refreshJsonTemplateOptionsByKind(libraryConfig.txTemplateKind.txWorkflow);
    refreshJsonTemplateOptionsByKind(
      libraryConfig.txTemplateKind.orchestration,
    );
  }

  function refreshAllJsonTemplateLists() {
    refreshJsonTemplateListByKind(libraryConfig.txTemplateKind.txBlock);
    refreshJsonTemplateListByKind(libraryConfig.txTemplateKind.txWorkflow);
    refreshJsonTemplateListByKind(libraryConfig.txTemplateKind.orchestration);
  }

  async function loadJsonTemplatesByKind(kind) {
    const cfg = libraryConfig.configFor(kind);
    if (!cfg) return;
    try {
      const templateListPayload = await listTemplateResource(cfg.apiBase);
      cache[kind] = Array.isArray(templateListPayload)
        ? templateListPayload
        : [];
      refreshJsonTemplateOptionsByKind(kind);
      refreshJsonTemplateListByKind(kind);
    } catch (error) {
      cache[kind] = [];
      refreshJsonTemplateOptionsByKind(kind);
      refreshJsonTemplateListByKind(kind, error.message);
    }
  }

  async function loadTxBlockTemplates() {
    await loadJsonTemplatesByKind(libraryConfig.txTemplateKind.txBlock);
    refreshTxWorkflowBuilderFromContext(libraryConfig.getEditorContext);
  }

  async function loadTxWorkflowTemplates() {
    await loadJsonTemplatesByKind(libraryConfig.txTemplateKind.txWorkflow);
  }

  async function loadOrchestrationTemplates() {
    await loadJsonTemplatesByKind(libraryConfig.txTemplateKind.orchestration);
  }

  async function loadLibraryTemplates() {
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

  const jsonTemplateLibrary = {
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

  function activate() {
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
