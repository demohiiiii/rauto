import { get as getStore, writable } from "svelte/store";

const EMPTY_TEXT = "";

export const TX_TEMPLATE_KIND = Object.freeze({
  orchestration: "orchestration",
  txBlock: "tx_block",
  txWorkflow: "tx_workflow",
});

export const TX_EDITOR = Object.freeze({
  orchestration: "orchestration",
  txBlock: "txBlock",
  txWorkflow: "txWorkflow",
});

const TX_EDITOR_KEYS = new Set(Object.values(TX_EDITOR));

let activeTxJsonEditors = null;
const txJsonEditorHosts = new Map();

function callObjectFunction(target, name, ...args) {
  const fn = target?.[name];
  return typeof fn === "function" ? fn(...args) : undefined;
}

function txEditorText(value) {
  if (value == null) return EMPTY_TEXT;
  return typeof value === "string" ? value : String(value);
}

function normalizeTxEditorKey(editorKey) {
  const key = txEditorText(editorKey).trim();
  return TX_EDITOR_KEYS.has(key) ? key : EMPTY_TEXT;
}

function attachTxJsonEditorHost(key, hostConfig = {}) {
  const normalizedKey = normalizeTxEditorKey(key);
  txJsonEditorHosts.set(normalizedKey, {
    onInput:
      typeof hostConfig.onInput === "function" ? hostConfig.onInput : null,
    refreshEditor:
      typeof hostConfig.refreshEditor === "function"
        ? hostConfig.refreshEditor
        : null,
    setEditorText:
      typeof hostConfig.setEditorText === "function"
        ? hostConfig.setEditorText
        : null,
    setEditorTheme:
      typeof hostConfig.setEditorTheme === "function"
        ? hostConfig.setEditorTheme
        : null,
  });
  callObjectFunction(
    activeTxJsonEditors,
    "applyEditorHostState",
    normalizedKey,
  );
  return () => {
    if (txJsonEditorHosts.get(normalizedKey)) {
      txJsonEditorHosts.delete(normalizedKey);
    }
  };
}

function txJsonEditorBindings({
  connectHost = attachTxJsonEditorHost,
  editorKey,
  onInput,
  setRawText = setTxJsonEditorRawText,
} = {}) {
  const dependencyState = {
    editorKey,
    onInput,
  };
  const editorTextStore = writable(EMPTY_TEXT);
  const editorThemeStore = writable("dark");

  return {
    connectHost() {
      return connectHost(dependencyState.editorKey, {
        onInput: dependencyState.onInput,
        refreshEditor() {},
        setEditorText(jsonText) {
          editorTextStore.set(txEditorText(jsonText || EMPTY_TEXT));
        },
        setEditorTheme(theme) {
          editorThemeStore.set(txEditorText(theme || "dark") || "dark");
        },
      });
    },
    editorTextStore,
    editorThemeStore,
    handleChange(jsonText) {
      const nextText = txEditorText(jsonText || EMPTY_TEXT);
      editorTextStore.set(nextText);
      setRawText(dependencyState.editorKey, nextText, { notify: true });
    },
    setEditorContext({
      editorKey: nextEditorKey = dependencyState.editorKey,
      onInput: nextOnInput = dependencyState.onInput,
      value,
    } = {}) {
      dependencyState.editorKey = nextEditorKey;
      dependencyState.onInput = nextOnInput;
      if (value === undefined) return;
      const nextText = txEditorText(value || EMPTY_TEXT);
      if (getStore(editorTextStore) !== nextText) {
        editorTextStore.set(nextText);
      }
    },
  };
}

function createJsonEditorHost({ editorKey }) {
  let currentText = EMPTY_TEXT;
  let currentTheme = "dark";
  const editorHost = () => txJsonEditorHosts.get(editorKey) || {};
  const notifyInput = (nextText) =>
    callObjectFunction(editorHost(), "onInput", nextText);
  const refreshEditor = () => callObjectFunction(editorHost(), "refreshEditor");
  const applyTextToEditor = (next) =>
    callObjectFunction(editorHost(), "setEditorText", next);
  const applyThemeToEditor = (theme) =>
    callObjectFunction(editorHost(), "setEditorTheme", theme);

  function setText(nextText, { notify = false } = {}) {
    const next = txEditorText(nextText || EMPTY_TEXT);
    const changed = currentText !== next;
    currentText = next;
    applyTextToEditor(next);
    if (notify && changed) notifyInput(currentText);
  }

  function setup() {
    applyThemeToEditor(currentTheme);
    applyTextToEditor(currentText);
  }

  function setTheme(theme) {
    currentTheme = txEditorText(theme || "dark") || "dark";
    applyThemeToEditor(currentTheme);
  }

  function resize() {
    refreshEditor();
  }

  function raw() {
    return txEditorText(currentText || EMPTY_TEXT);
  }

  function applyEditorHostState() {
    applyThemeToEditor(currentTheme);
    applyTextToEditor(currentText);
  }

  return {
    applyEditorHostState,
    raw,
    resize,
    setText,
    setTheme,
    setup,
  };
}

export function createTxJsonEditorWorkspace({
  connectHost = attachTxJsonEditorHost,
  editorKey,
  onInput,
  setRawText = setTxJsonEditorRawText,
} = {}) {
  return txJsonEditorBindings({
    connectHost,
    editorKey,
    onInput,
    setRawText,
  });
}

export function createTxJsonEditorsHost({
  txBlockDefaultJsonText = "{}",
  txBlockJsonInvalidShapeMessage = "tx block json must be an object",
  txBlockJsonRequiredMessage = "tx block json is required",
  txWorkflowDefaultJsonText = "{}",
  orchestrationDefaultJsonText = "{}",
} = {}) {
  const txBlock = createJsonEditorHost({
    editorKey: TX_EDITOR.txBlock,
  });
  const txWorkflow = createJsonEditorHost({
    editorKey: TX_EDITOR.txWorkflow,
  });
  const orchestration = createJsonEditorHost({
    editorKey: TX_EDITOR.orchestration,
  });

  const setTxBlockEditorRawText = (rawText, { notify = true } = {}) =>
    txBlock.setText(rawText, { notify });
  const setTxBlockEditorJson = (jsonValue) => {
    const next =
      jsonValue && typeof jsonValue === "object" && !Array.isArray(jsonValue)
        ? JSON.stringify(jsonValue, null, 2)
        : txBlockDefaultJsonText;
    txBlock.setText(next, { notify: true });
  };
  const parseTxBlockEditorJson = () => {
    const raw = txBlock.raw().trim();
    if (!raw) throw new Error(txBlockJsonRequiredMessage);
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(txBlockJsonInvalidShapeMessage);
    }
    setTxBlockEditorJson(parsed);
    return parsed;
  };

  const setTxWorkflowEditorJson = (jsonValue) => {
    const next =
      jsonValue && typeof jsonValue === "object" && !Array.isArray(jsonValue)
        ? JSON.stringify(jsonValue, null, 2)
        : txWorkflowDefaultJsonText;
    txWorkflow.setText(next, { notify: true });
  };

  const setOrchestrationEditorJson = (jsonValue) => {
    const next =
      jsonValue && typeof jsonValue === "object" && !Array.isArray(jsonValue)
        ? JSON.stringify(jsonValue, null, 2)
        : orchestrationDefaultJsonText;
    orchestration.setText(next, { notify: true });
  };

  const editors = {
    applyEditorHostState(editorKey) {
      const normalizedKey = normalizeTxEditorKey(editorKey);
      if (normalizedKey === TX_EDITOR.txBlock) {
        txBlock.applyEditorHostState();
        return;
      }
      if (normalizedKey === TX_EDITOR.txWorkflow) {
        txWorkflow.applyEditorHostState();
        return;
      }
      if (normalizedKey === TX_EDITOR.orchestration) {
        orchestration.applyEditorHostState();
      }
    },
    orchestrationEditorRaw: orchestration.raw,
    parseTxBlockEditorJson,
    resizeOrchestrationJsonEditor: orchestration.resize,
    resizeTxBlockJsonEditor: txBlock.resize,
    resizeTxWorkflowJsonEditor: txWorkflow.resize,
    setOrchestrationEditorJson,
    setOrchestrationEditorRawText: (rawText, { notify = true } = {}) =>
      orchestration.setText(rawText, { notify }),
    setOrchestrationEditorText: orchestration.setText,
    setOrchestrationJsonEditorTheme: orchestration.setTheme,
    setTxBlockEditorJson,
    setTxBlockEditorRawText,
    setTxBlockEditorText: txBlock.setText,
    setTxBlockJsonEditorTheme: txBlock.setTheme,
    setTxWorkflowEditorJson,
    setTxWorkflowEditorRawText: (rawText, { notify = true } = {}) =>
      txWorkflow.setText(rawText, { notify }),
    setTxWorkflowEditorText: txWorkflow.setText,
    setTxWorkflowJsonEditorTheme: txWorkflow.setTheme,
    setupOrchestrationJsonEditor: orchestration.setup,
    setupTxBlockJsonEditor: txBlock.setup,
    setupTxWorkflowJsonEditor: txWorkflow.setup,
    txBlockEditorRaw: txBlock.raw,
    txWorkflowEditorRaw: txWorkflow.raw,
  };

  activeTxJsonEditors = editors;
  return editors;
}

export function clearTxJsonEditorsHost() {
  activeTxJsonEditors = null;
}

export function requireTxJsonEditor(editorMethodName) {
  const fn = activeTxJsonEditors && activeTxJsonEditors[editorMethodName];
  if (typeof fn !== "function") {
    throw new Error(`${editorMethodName} is not ready`);
  }
  return fn;
}

export function setTxJsonEditorRawText(
  editorKey,
  rawText,
  { notify = false } = {},
) {
  const normalizedKey = normalizeTxEditorKey(editorKey);
  const editors = activeTxJsonEditors || {};
  if (normalizedKey === TX_EDITOR.txBlock) {
    callObjectFunction(editors, "setTxBlockEditorRawText", rawText, {
      notify,
    });
    return;
  }
  if (normalizedKey === TX_EDITOR.txWorkflow) {
    callObjectFunction(editors, "setTxWorkflowEditorText", rawText, {
      notify,
    });
    return;
  }
  if (normalizedKey === TX_EDITOR.orchestration) {
    callObjectFunction(editors, "setOrchestrationEditorText", rawText, {
      notify,
    });
  }
}

export function txJsonEditorRawText(editorKey) {
  const normalizedKey = normalizeTxEditorKey(editorKey);
  const editors = activeTxJsonEditors || {};
  if (normalizedKey === TX_EDITOR.txBlock) {
    return typeof editors.txBlockEditorRaw === "function"
      ? editors.txBlockEditorRaw()
      : EMPTY_TEXT;
  }
  if (normalizedKey === TX_EDITOR.txWorkflow) {
    return typeof editors.txWorkflowEditorRaw === "function"
      ? editors.txWorkflowEditorRaw()
      : EMPTY_TEXT;
  }
  if (normalizedKey === TX_EDITOR.orchestration) {
    return typeof editors.orchestrationEditorRaw === "function"
      ? editors.orchestrationEditorRaw()
      : EMPTY_TEXT;
  }
  return EMPTY_TEXT;
}
