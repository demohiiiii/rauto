import { get as getStore, writable } from "svelte/store";
import type { JsonObject } from "../model/types.js";

const EMPTY_TEXT = "";

export const TX_TEMPLATE_KIND = Object.freeze({
  orchestration: "orchestration",
  txBlock: "tx_block",
  txWorkflow: "tx_workflow",
} as const);

export const TX_EDITOR = Object.freeze({
  orchestration: "orchestration",
  txBlock: "txBlock",
  txWorkflow: "txWorkflow",
} as const);

export type TxEditorKey = (typeof TX_EDITOR)[keyof typeof TX_EDITOR];

type UnknownFunction = (...args: unknown[]) => unknown;

interface TxJsonEditorHostConfig {
  onInput: ((text: string) => unknown) | null;
  refreshEditor: (() => unknown) | null;
  setEditorText: ((text: string) => unknown) | null;
  setEditorTheme: ((theme: string) => unknown) | null;
}

interface TxJsonEditorHostPort {
  applyEditorHostState(): void;
  raw(): string;
  resize(): void;
  setText(text: string, options?: { notify?: boolean }): void;
  setTheme(theme: string): void;
  setup(): void;
}

export interface TxJsonEditorsHost {
  applyEditorHostState(editorKey: TxEditorKey): void;
  orchestrationEditorRaw(): string;
  parseTxBlockEditorJson(): JsonObject;
  resizeOrchestrationJsonEditor(): void;
  resizeTxBlockJsonEditor(): void;
  resizeTxWorkflowJsonEditor(): void;
  setOrchestrationEditorJson(value: JsonObject): void;
  setOrchestrationEditorRawText(
    text: string,
    options?: { notify?: boolean },
  ): void;
  setOrchestrationEditorText(
    text: string,
    options?: { notify?: boolean },
  ): void;
  setOrchestrationJsonEditorTheme(theme: string): void;
  setTxBlockEditorJson(value: JsonObject): void;
  setTxBlockEditorRawText(text: string, options?: { notify?: boolean }): void;
  setTxBlockEditorText(text: string, options?: { notify?: boolean }): void;
  setTxBlockJsonEditorTheme(theme: string): void;
  setTxWorkflowEditorJson(value: JsonObject): void;
  setTxWorkflowEditorRawText(
    text: string,
    options?: { notify?: boolean },
  ): void;
  setTxWorkflowEditorText(text: string, options?: { notify?: boolean }): void;
  setTxWorkflowJsonEditorTheme(theme: string): void;
  setupOrchestrationJsonEditor(): void;
  setupTxBlockJsonEditor(): void;
  setupTxWorkflowJsonEditor(): void;
  txBlockEditorRaw(): string;
  txWorkflowEditorRaw(): string;
}

type AttachTxJsonEditorHost = (
  key: TxEditorKey | undefined,
  config: Partial<TxJsonEditorHostConfig>,
) => () => void;

type SetTxJsonEditorRawText = (
  editorKey: TxEditorKey | undefined,
  rawText: string,
  options?: { notify?: boolean },
) => void;

const TX_EDITOR_KEYS = new Set<string>(Object.values(TX_EDITOR));

let activeTxJsonEditors: TxJsonEditorsHost | null = null;
const txJsonEditorHosts = new Map<string, TxJsonEditorHostConfig>();

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
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

function txEditorText(value: string | null | undefined): string {
  if (value == null) return EMPTY_TEXT;
  return typeof value === "string" ? value : String(value);
}

function normalizeTxEditorKey(
  editorKey: TxEditorKey | undefined,
): TxEditorKey | "" {
  const key = txEditorText(editorKey).trim();
  return TX_EDITOR_KEYS.has(key) ? (key as TxEditorKey) : EMPTY_TEXT;
}

function attachTxJsonEditorHost(
  key: TxEditorKey | undefined,
  hostConfig: Partial<TxJsonEditorHostConfig> = {},
): () => void {
  const normalizedKey = normalizeTxEditorKey(key);
  const registeredHost = {
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
  };
  txJsonEditorHosts.set(normalizedKey, registeredHost);
  callObjectFunction(
    activeTxJsonEditors,
    "applyEditorHostState",
    normalizedKey,
  );
  return () => {
    if (txJsonEditorHosts.get(normalizedKey) === registeredHost) {
      txJsonEditorHosts.delete(normalizedKey);
    }
  };
}

function txJsonEditorBindings({
  connectHost: attachHost = attachTxJsonEditorHost,
  editorKey,
  onInput,
  setRawText = setTxJsonEditorRawText,
  value,
}: {
  connectHost?: AttachTxJsonEditorHost;
  editorKey?: TxEditorKey;
  onInput?: ((text: string) => unknown) | null;
  setRawText?: SetTxJsonEditorRawText;
  value?: string;
} = {}) {
  const dependencyState = {
    editorKey,
    hasValue: value !== undefined,
    onInput,
    value: txEditorText(value || EMPTY_TEXT),
  };
  const editorTextStore = writable(
    dependencyState.hasValue ? dependencyState.value : EMPTY_TEXT,
  );
  const editorThemeStore = writable("dark");
  let connectionOwner = 0;
  let disconnectHost: (() => void) | null = null;
  let hostConnected = false;

  function syncCurrentValue(): void {
    if (!dependencyState.hasValue) return;
    setRawText(dependencyState.editorKey, dependencyState.value, {
      notify: false,
    });
  }

  function disconnectCurrentHost(): void {
    const disconnect = disconnectHost;
    disconnectHost = null;
    hostConnected = false;
    if (typeof disconnect === "function") disconnect();
  }

  function connectCurrentHost(): void {
    syncCurrentValue();
    disconnectHost = attachHost(dependencyState.editorKey, {
      onInput: dependencyState.onInput,
      refreshEditor() {},
      setEditorText(jsonText: string) {
        editorTextStore.set(txEditorText(jsonText || EMPTY_TEXT));
      },
      setEditorTheme(theme: string) {
        editorThemeStore.set(txEditorText(theme || "dark") || "dark");
      },
    });
    hostConnected = true;
  }

  return {
    connectHost() {
      connectionOwner += 1;
      const owner = connectionOwner;
      disconnectCurrentHost();
      connectCurrentHost();
      return () => {
        if (owner !== connectionOwner) return;
        connectionOwner += 1;
        disconnectCurrentHost();
      };
    },
    editorTextStore,
    editorThemeStore,
    handleChange(jsonText: string) {
      const nextText = txEditorText(jsonText || EMPTY_TEXT);
      dependencyState.hasValue = true;
      dependencyState.value = nextText;
      editorTextStore.set(nextText);
      setRawText(dependencyState.editorKey, nextText, { notify: true });
    },
    setEditorContext({
      editorKey: nextEditorKey = dependencyState.editorKey,
      onInput: nextOnInput = dependencyState.onInput,
      value,
    }: {
      editorKey?: TxEditorKey;
      onInput?: ((text: string) => unknown) | null;
      value?: string;
    } = {}) {
      const connectionChanged =
        nextEditorKey !== dependencyState.editorKey ||
        nextOnInput !== dependencyState.onInput;
      dependencyState.editorKey = nextEditorKey;
      dependencyState.onInput = nextOnInput;
      if (value !== undefined) {
        const nextText = txEditorText(value || EMPTY_TEXT);
        dependencyState.hasValue = true;
        dependencyState.value = nextText;
        if (getStore(editorTextStore) !== nextText) {
          editorTextStore.set(nextText);
        }
      }
      if (connectionChanged && hostConnected) {
        disconnectCurrentHost();
        connectCurrentHost();
        return;
      }
      if (hostConnected) syncCurrentValue();
    },
  };
}

function createJsonEditorHost({
  editorKey,
}: {
  editorKey: TxEditorKey;
}): TxJsonEditorHostPort {
  let currentText = EMPTY_TEXT;
  let currentTheme = "dark";
  const editorHost = () => txJsonEditorHosts.get(editorKey) || {};
  const notifyInput = (nextText: string) =>
    callObjectFunction(editorHost(), "onInput", nextText);
  const refreshEditor = () => callObjectFunction(editorHost(), "refreshEditor");
  const applyTextToEditor = (next: string) =>
    callObjectFunction(editorHost(), "setEditorText", next);
  const applyThemeToEditor = (theme: string) =>
    callObjectFunction(editorHost(), "setEditorTheme", theme);

  function setText(
    nextText: string,
    { notify = false }: { notify?: boolean } = {},
  ): void {
    const next = txEditorText(nextText || EMPTY_TEXT);
    const changed = currentText !== next;
    currentText = next;
    applyTextToEditor(next);
    if (notify && changed) notifyInput(currentText);
  }

  function setup(): void {
    applyThemeToEditor(currentTheme);
    applyTextToEditor(currentText);
  }

  function setTheme(theme: string): void {
    currentTheme = txEditorText(theme || "dark") || "dark";
    applyThemeToEditor(currentTheme);
  }

  function resize(): void {
    refreshEditor();
  }

  function raw(): string {
    return txEditorText(currentText || EMPTY_TEXT);
  }

  function applyEditorHostState(): void {
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
  value,
}: {
  connectHost?: AttachTxJsonEditorHost;
  editorKey?: TxEditorKey;
  onInput?: ((text: string) => unknown) | null;
  setRawText?: SetTxJsonEditorRawText;
  value?: string;
} = {}) {
  return txJsonEditorBindings({
    connectHost,
    editorKey,
    onInput,
    setRawText,
    value,
  });
}

export function createTxJsonEditorsHost({
  txBlockDefaultJsonText = "{}",
  txBlockJsonInvalidShapeMessage = "tx block json must be an object",
  txBlockJsonRequiredMessage = "tx block json is required",
  txWorkflowDefaultJsonText = "{}",
  orchestrationDefaultJsonText = "{}",
}: {
  orchestrationDefaultJsonText?: string;
  txBlockDefaultJsonText?: string;
  txBlockJsonInvalidShapeMessage?: string;
  txBlockJsonRequiredMessage?: string;
  txWorkflowDefaultJsonText?: string;
} = {}): TxJsonEditorsHost {
  const txBlock = createJsonEditorHost({
    editorKey: TX_EDITOR.txBlock,
  });
  const txWorkflow = createJsonEditorHost({
    editorKey: TX_EDITOR.txWorkflow,
  });
  const orchestration = createJsonEditorHost({
    editorKey: TX_EDITOR.orchestration,
  });

  const setTxBlockEditorRawText = (
    rawText: string,
    { notify = true }: { notify?: boolean } = {},
  ) => txBlock.setText(rawText, { notify });
  const setTxBlockEditorJson = (jsonValue: JsonObject) => {
    const next =
      jsonValue && typeof jsonValue === "object" && !Array.isArray(jsonValue)
        ? JSON.stringify(jsonValue, null, 2)
        : txBlockDefaultJsonText;
    txBlock.setText(next, { notify: true });
  };
  const parseTxBlockEditorJson = (): JsonObject => {
    const raw = txBlock.raw().trim();
    if (!raw) throw new Error(txBlockJsonRequiredMessage);
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(txBlockJsonInvalidShapeMessage);
    }
    setTxBlockEditorJson(parsed as JsonObject);
    return parsed as JsonObject;
  };

  const setTxWorkflowEditorJson = (jsonValue: JsonObject) => {
    const next =
      jsonValue && typeof jsonValue === "object" && !Array.isArray(jsonValue)
        ? JSON.stringify(jsonValue, null, 2)
        : txWorkflowDefaultJsonText;
    txWorkflow.setText(next, { notify: true });
  };

  const setOrchestrationEditorJson = (jsonValue: JsonObject) => {
    const next =
      jsonValue && typeof jsonValue === "object" && !Array.isArray(jsonValue)
        ? JSON.stringify(jsonValue, null, 2)
        : orchestrationDefaultJsonText;
    orchestration.setText(next, { notify: true });
  };

  const editors: TxJsonEditorsHost = {
    applyEditorHostState(editorKey: TxEditorKey) {
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
    setOrchestrationEditorRawText: (
      rawText: string,
      { notify = true }: { notify?: boolean } = {},
    ) => orchestration.setText(rawText, { notify }),
    setOrchestrationEditorText: orchestration.setText,
    setOrchestrationJsonEditorTheme: orchestration.setTheme,
    setTxBlockEditorJson,
    setTxBlockEditorRawText,
    setTxBlockEditorText: txBlock.setText,
    setTxBlockJsonEditorTheme: txBlock.setTheme,
    setTxWorkflowEditorJson,
    setTxWorkflowEditorRawText: (
      rawText: string,
      { notify = true }: { notify?: boolean } = {},
    ) => txWorkflow.setText(rawText, { notify }),
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

export function clearTxJsonEditorsHost(
  expectedHost?: TxJsonEditorsHost | null,
): void {
  if (expectedHost !== undefined && activeTxJsonEditors !== expectedHost) {
    return;
  }
  activeTxJsonEditors = null;
}

export function requireTxJsonEditor<TMethod extends keyof TxJsonEditorsHost>(
  editorMethodName: TMethod,
): TxJsonEditorsHost[TMethod] {
  const fn = activeTxJsonEditors && activeTxJsonEditors[editorMethodName];
  if (typeof fn !== "function") {
    throw new Error(`${editorMethodName} is not ready`);
  }
  return fn as TxJsonEditorsHost[TMethod];
}

export function setTxJsonEditorRawText(
  editorKey: TxEditorKey | undefined,
  rawText: string,
  { notify = false }: { notify?: boolean } = {},
): void {
  const normalizedKey = normalizeTxEditorKey(editorKey);
  const editors = activeTxJsonEditors;
  if (!editors) return;
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

export function txJsonEditorRawText(
  editorKey: TxEditorKey | undefined,
): string {
  const normalizedKey = normalizeTxEditorKey(editorKey);
  const editors = activeTxJsonEditors;
  if (!editors) return EMPTY_TEXT;
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
