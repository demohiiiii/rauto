import {
  derived as deriveStore,
  get as getStore,
  writable,
} from "svelte/store";

import { formValueHandler } from "../lib/events.js";
import { currentLanguageState, t } from "../lib/i18n.js";
import { createSwitchingStore } from "../lib/svelte.js";
import { safeString as safeTemplateString } from "../lib/ui.js";

export const TX_VARS = Object.freeze({
  orchestrationDirect: "orchestrationDirect",
  orchestrationTemplate: "orchestrationTemplate",
  txBlockDirect: "txBlockDirect",
  txBlockTemplate: "txBlockTemplate",
  txWorkflowDirect: "txWorkflowDirect",
  txWorkflowTemplate: "txWorkflowTemplate",
});

const TX_VARS_KEYS = new Set(Object.values(TX_VARS));

export const TX_VARS_ASSISTANT_VALUE_TYPE_OPTIONS = Object.freeze([
  { value: "string", labelKey: "txVarsFormTypeString" },
  { value: "number", labelKey: "txVarsFormTypeNumber" },
  { value: "boolean", labelKey: "txVarsFormTypeBoolean" },
  { value: "null", labelKey: "txVarsFormTypeNull" },
  { value: "json", labelKey: "txVarsFormTypeJson" },
]);

const TX_VARS_ASSISTANTS = [
  {
    key: TX_VARS.txBlockDirect,
    prefix: "tx-block-direct",
    statusOutput: "txBlockPlan",
  },
  {
    key: TX_VARS.txBlockTemplate,
    prefix: "tx-block-template",
    statusOutput: "txBlockPlan",
  },
  {
    key: TX_VARS.txWorkflowDirect,
    prefix: "tx-workflow-direct",
    statusOutput: "txWorkflowPlan",
  },
  {
    key: TX_VARS.txWorkflowTemplate,
    prefix: "tx-workflow-template",
    statusOutput: "txWorkflowPlan",
  },
  {
    key: TX_VARS.orchestrationDirect,
    prefix: "orchestration-direct",
    statusOutput: "orchestrationPlan",
  },
  {
    key: TX_VARS.orchestrationTemplate,
    prefix: "orchestration-template",
    statusOutput: "orchestrationPlan",
  },
];

const txVarsTextStates = new Map();
const txVarsTextState = new Map();
const txVarsAssistantState = new Map();
const txVarsAssistantStates = new Map();
let txVarsAssistantEntrySeq = 0;

const txVarsAssistantEntryFieldPatches = Object.freeze({
  key: (entryKey) => ({ key: entryKey }),
  type: (entryType) => ({ type: entryType }),
  valueText: (entryValueText) => ({ valueText: entryValueText }),
});

function normalizeTransactionKey(rawKey, validKeys, fallback = "") {
  const key = safeTemplateString(rawKey || "").trim();
  if (!key) return fallback;
  return validKeys.has(key) ? key : fallback || key;
}

function txVarsSafeString(varsValue) {
  if (varsValue == null) return "";
  return typeof varsValue === "string" ? varsValue : String(varsValue);
}

function normalizeTxVarsKey(txKey) {
  const raw =
    txKey && typeof txKey === "object" && "key" in txKey ? txKey.key : txKey;
  return normalizeTransactionKey(txVarsSafeString(raw).trim(), TX_VARS_KEYS);
}

function txVarsTextStoreFor(varsKey) {
  const key = normalizeTxVarsKey(varsKey);
  if (!txVarsTextStates.has(key)) {
    txVarsTextStates.set(
      key,
      writable({
        raw: txVarsTextState.get(key) || "",
        source: "external",
        version: 0,
      }),
    );
  }
  return txVarsTextStates.get(key);
}

export function txVarsTextStateFor(varsKey) {
  return txVarsTextStoreFor(varsKey);
}

export function setTxVarsRawText(
  varsKey,
  rawText = "",
  { source = "external" } = {},
) {
  const key = normalizeTxVarsKey(varsKey);
  const next = txVarsSafeString(rawText);
  txVarsTextState.set(key, next);
  txVarsTextStoreFor(key).update((state) => ({
    raw: next,
    source,
    version: (state?.version || 0) + 1,
  }));
}

function txVarsRawText(varsKey) {
  return txVarsSafeString(getStore(txVarsTextStateFor(varsKey))?.raw || "");
}

function txVarsAssistantConfig(varsKey) {
  const key = normalizeTxVarsKey(varsKey);
  return (
    TX_VARS_ASSISTANTS.find((txVarsAssistant) => txVarsAssistant.key === key) ||
    null
  );
}

function txVarsAssistantConfigByPrefix(prefix) {
  return (
    TX_VARS_ASSISTANTS.find(
      (txVarsAssistant) => txVarsAssistant.prefix === prefix,
    ) || null
  );
}

export function requiredTxVarsAssistantConfigByPrefix(prefix) {
  const txVarsAssistant = txVarsAssistantConfigByPrefix(prefix);
  if (!txVarsAssistant) {
    throw new Error(`Unknown transaction vars assistant prefix: ${prefix}`);
  }
  return txVarsAssistant;
}

function txVarsAssistantEntryInputPresentation(
  assistantEntry = {},
  { valueTypeOptions = [] } = {},
) {
  const type = txVarsSafeString(assistantEntry.type) || "string";
  return {
    controlKind: type === "json" ? "json-editor" : "text-input",
    entryId: txVarsSafeString(assistantEntry.id),
    keyValue: txVarsSafeString(assistantEntry.key),
    keyPlaceholder: t("txVarsFormKeyPlaceholder"),
    placeholder:
      type === "boolean" ? "true / false" : type === "number" ? "123" : "",
    removeButtonLabel: t("txVarsFormRemoveBtn"),
    showJsonEditor: type === "json",
    typeOptionRows: (Array.isArray(valueTypeOptions)
      ? valueTypeOptions
      : []
    ).map((typeOption) => ({
      labelText: t(typeOption.labelKey),
      typeValue: txVarsSafeString(typeOption.value),
    })),
    typeValue: type,
    valueText: txVarsSafeString(assistantEntry.valueText),
  };
}

export function txVarsAssistantPresentation(
  state = {},
  { valueTypeOptions = [] } = {},
) {
  const assistantEntries = Array.isArray(state?.assistantEntries)
    ? state.assistantEntries
    : [];
  return {
    addButtonLabel: t("txVarsFormAddBtn"),
    assistantEntryInputRows: assistantEntries.map((assistantEntry) =>
      txVarsAssistantEntryInputPresentation(assistantEntry, {
        valueTypeOptions,
      }),
    ),
    clearButtonLabel: t("txVarsFormClearBtn"),
    hasAssistantEntries: assistantEntries.length > 0,
    hintText: t("txVarsFormHint"),
    syncButtonLabel: t("txVarsFormSyncBtn"),
    syncedMessage: t("txVarsFormSynced"),
    title: t("txVarsFormTitle"),
  };
}

function txVarsAssistantEntry(
  entryKey = "",
  entryType = "string",
  valueText = "",
) {
  txVarsAssistantEntrySeq += 1;
  return {
    id: `tx-vars-${txVarsAssistantEntrySeq}`,
    key: txVarsSafeString(entryKey),
    type: txVarsSafeString(entryType) || "string",
    valueText: txVarsSafeString(valueText),
  };
}

function txVarsAssistantInferType(varsValue) {
  if (varsValue === null) return "null";
  if (typeof varsValue === "string") return "string";
  if (typeof varsValue === "number") return "number";
  if (typeof varsValue === "boolean") return "boolean";
  return "json";
}

function txVarsAssistantEntriesFromValue(varsValue) {
  const objectValue =
    varsValue && typeof varsValue === "object" && !Array.isArray(varsValue)
      ? varsValue
      : {};
  return Object.entries(objectValue).map(([entryKey, assistantValue]) => {
    const entryType = txVarsAssistantInferType(assistantValue);
    if (entryType === "json") {
      return txVarsAssistantEntry(
        entryKey,
        entryType,
        JSON.stringify(assistantValue, null, 2),
      );
    }
    if (entryType === "null") {
      return txVarsAssistantEntry(entryKey, entryType, "");
    }
    return txVarsAssistantEntry(entryKey, entryType, String(assistantValue));
  });
}

function txVarsAssistantParseValue(assistantEntry) {
  const entryType = txVarsSafeString(assistantEntry.type).trim() || "string";
  const entryValueText = txVarsSafeString(assistantEntry.valueText);
  const trimmedValueText = entryValueText.trim();
  if (entryType === "null") return null;
  if (entryType === "number") {
    const parsedValue = Number(trimmedValueText);
    return Number.isFinite(parsedValue) ? parsedValue : entryValueText;
  }
  if (entryType === "boolean") {
    const loweredValue = trimmedValueText.toLowerCase();
    if (["true", "1", "yes", "y", "on"].includes(loweredValue)) return true;
    if (["false", "0", "no", "n", "off"].includes(loweredValue)) return false;
    return entryValueText;
  }
  if (entryType === "json") {
    if (!trimmedValueText) return {};
    try {
      return JSON.parse(trimmedValueText);
    } catch (_) {
      return entryValueText;
    }
  }
  return entryValueText;
}

function txVarsAssistantEntriesToObject(assistantEntries) {
  const objectValue = {};
  for (const assistantEntry of Array.isArray(assistantEntries)
    ? assistantEntries
    : []) {
    const entryKey = txVarsSafeString(assistantEntry?.key).trim();
    if (!entryKey) continue;
    objectValue[entryKey] = txVarsAssistantParseValue(assistantEntry || {});
  }
  return objectValue;
}

function txVarsAssistantGetState(assistantConfig) {
  if (!txVarsAssistantState.has(assistantConfig.key)) {
    txVarsAssistantState.set(assistantConfig.key, { assistantEntries: [] });
  }
  return txVarsAssistantState.get(assistantConfig.key);
}

function txVarsAssistantStoreFor(assistantConfig) {
  if (!txVarsAssistantStates.has(assistantConfig.key)) {
    txVarsAssistantStates.set(
      assistantConfig.key,
      writable({
        assistantEntries: [
          ...(txVarsAssistantGetState(assistantConfig).assistantEntries || []),
        ],
        version: 0,
      }),
    );
  }
  return txVarsAssistantStates.get(assistantConfig.key);
}

export function txVarsAssistantStateFor(assistantConfig) {
  return txVarsAssistantStoreFor(assistantConfig);
}

function setTxVarsAssistantEntries(assistantConfig, assistantEntries = []) {
  const assistantState = txVarsAssistantGetState(assistantConfig);
  assistantState.assistantEntries = Array.isArray(assistantEntries)
    ? assistantEntries
    : [];
  txVarsAssistantStoreFor(assistantConfig).update((currentState) => ({
    assistantEntries: [...assistantState.assistantEntries],
    version: (currentState?.version || 0) + 1,
  }));
}

function txVarsAssistantEntries(assistantConfig) {
  return [...(txVarsAssistantGetState(assistantConfig).assistantEntries || [])];
}

function txVarsAssistantSyncTextarea(assistantConfig) {
  const assistantState = txVarsAssistantGetState(assistantConfig);
  const nextText = JSON.stringify(
    txVarsAssistantEntriesToObject(assistantState.assistantEntries),
    null,
    2,
  );
  const changed = txVarsRawText(assistantConfig.key) !== nextText;
  setTxVarsRawText(assistantConfig.key, nextText, { source: "assistant" });
  return changed;
}

function setAssistantStatus(setStatus, statusOutput, message, tone = "info") {
  if (typeof setStatus !== "function" || !statusOutput) return;
  setStatus(statusOutput, message, tone);
}

export function addTxVarsAssistantEntry(assistantConfig) {
  if (!assistantConfig) return false;
  setTxVarsAssistantEntries(assistantConfig, [
    ...txVarsAssistantEntries(assistantConfig),
    txVarsAssistantEntry(),
  ]);
  txVarsAssistantSyncTextarea(assistantConfig);
  return true;
}

export function clearTxVarsAssistantEntries(assistantConfig) {
  if (!assistantConfig) return false;
  setTxVarsAssistantEntries(assistantConfig, []);
  txVarsAssistantSyncTextarea(assistantConfig);
  return true;
}

export function removeTxVarsAssistantEntry(assistantConfig, entryId) {
  if (!assistantConfig || !entryId) return false;
  setTxVarsAssistantEntries(
    assistantConfig,
    txVarsAssistantEntries(assistantConfig).filter(
      (assistantEntry) => assistantEntry.id !== entryId,
    ),
  );
  txVarsAssistantSyncTextarea(assistantConfig);
  return true;
}

export function updateTxVarsAssistantEntry(
  assistantConfig,
  entryId,
  patch = {},
) {
  if (!assistantConfig || !entryId || !patch || typeof patch !== "object") {
    return false;
  }
  setTxVarsAssistantEntries(
    assistantConfig,
    txVarsAssistantEntries(assistantConfig).map((assistantEntry) =>
      assistantEntry.id === entryId
        ? { ...assistantEntry, ...patch }
        : assistantEntry,
    ),
  );
  txVarsAssistantSyncTextarea(assistantConfig);
  return true;
}

export function applyTxVarsAssistantEntriesFromText(
  varsKey,
  { keepStateOnError = true, setStatus = null, silent = false } = {},
) {
  const assistantConfig = txVarsAssistantConfig(varsKey);
  if (!assistantConfig) return false;
  const rawText = txVarsRawText(assistantConfig.key).trim();
  let parsedValue = {};
  if (rawText) {
    try {
      parsedValue = JSON.parse(rawText);
      if (
        !parsedValue ||
        typeof parsedValue !== "object" ||
        Array.isArray(parsedValue)
      ) {
        throw new Error(t("txVarsFormJsonObjectRequired"));
      }
    } catch (error) {
      if (!silent) {
        const message = error?.message || t("requestFailed");
        setAssistantStatus(
          setStatus,
          assistantConfig.statusOutput,
          `${t("txVarsFormJsonInvalid")}: ${message}`,
          "error",
        );
      }
      if (!keepStateOnError) {
        setTxVarsAssistantEntries(assistantConfig, []);
      }
      return false;
    }
  }
  setTxVarsAssistantEntries(
    assistantConfig,
    txVarsAssistantEntriesFromValue(parsedValue),
  );
  return true;
}

export function setupTxVarsAssistants() {
  TX_VARS_ASSISTANTS.forEach((assistantConfig) => {
    applyTxVarsAssistantEntriesFromText(assistantConfig.key, {
      silent: true,
    });
  });
}

export function refreshTxVarsAssistants() {
  TX_VARS_ASSISTANTS.forEach((assistantConfig) => {
    setTxVarsAssistantEntries(
      assistantConfig,
      txVarsAssistantGetState(assistantConfig).assistantEntries || [],
    );
  });
}

function applyTxVarsAssistantEntriesFromTextWithStatus(
  assistantConfig,
  setStatus,
) {
  if (!assistantConfig) return false;
  const synced = applyTxVarsAssistantEntriesFromText(assistantConfig.key, {
    setStatus,
    silent: false,
  });
  if (synced) {
    setAssistantStatus(
      setStatus,
      assistantConfig.statusOutput,
      t("txVarsFormSynced"),
      "success",
    );
  }
  return synced;
}

function txVarsAssistantCardActions(assistantConfig, setStatus) {
  return {
    addEntry() {
      addTxVarsAssistantEntry(assistantConfig);
    },
    clearEntries() {
      clearTxVarsAssistantEntries(assistantConfig);
    },
    removeEntryAction(entryId) {
      return () => removeTxVarsAssistantEntry(assistantConfig, entryId);
    },
    applyEntriesFromText() {
      applyTxVarsAssistantEntriesFromTextWithStatus(assistantConfig, setStatus);
    },
    updateEntryJsonValue(entryId) {
      return (entryValueText) =>
        updateTxVarsAssistantEntry(
          assistantConfig,
          entryId,
          txVarsAssistantEntryFieldPatches.valueText(entryValueText),
        );
    },
    updateEntryKey(entryId) {
      return formValueHandler((entryKey) =>
        updateTxVarsAssistantEntry(
          assistantConfig,
          entryId,
          txVarsAssistantEntryFieldPatches.key(entryKey),
        ),
      );
    },
    updateEntryType(entryId) {
      return formValueHandler((entryType) =>
        updateTxVarsAssistantEntry(
          assistantConfig,
          entryId,
          txVarsAssistantEntryFieldPatches.type(entryType),
        ),
      );
    },
    updateEntryValue(entryId) {
      return formValueHandler((entryValueText) =>
        updateTxVarsAssistantEntry(
          assistantConfig,
          entryId,
          txVarsAssistantEntryFieldPatches.valueText(entryValueText),
        ),
      );
    },
  };
}

export function createTxVarsAssistantCardWorkspace({
  getPrefix = null,
  setStatus = null,
} = {}) {
  const resolvePrefix = (prefix = "") =>
    txVarsSafeString(prefix || "") ||
    (typeof getPrefix === "function"
      ? txVarsSafeString(getPrefix())
      : txVarsSafeString(prefix));
  const assistantConfigStateStore = writable(
    requiredTxVarsAssistantConfigByPrefix(resolvePrefix()),
  );
  const assistantStateStore = createSwitchingStore(
    assistantConfigStateStore,
    ($assistantConfigStateStore) =>
      $assistantConfigStateStore
        ? txVarsAssistantStateFor($assistantConfigStateStore)
        : null,
    {
      assistantEntries: [],
      version: 0,
    },
  );
  const varsTextStateStore = createSwitchingStore(
    assistantConfigStateStore,
    ($assistantConfigStateStore) =>
      $assistantConfigStateStore?.key
        ? txVarsTextStateFor($assistantConfigStateStore.key)
        : null,
    {
      raw: "",
      source: "external",
      version: 0,
    },
  );
  const assistantActionsStateStore = deriveStore(
    assistantConfigStateStore,
    ($assistantConfigStateStore) =>
      txVarsAssistantCardActions($assistantConfigStateStore, setStatus),
  );
  const assistantDisplayStateStore = deriveStore(
    [assistantStateStore, currentLanguageState],
    ([$assistantStateStore]) =>
      txVarsAssistantPresentation($assistantStateStore, {
        valueTypeOptions: TX_VARS_ASSISTANT_VALUE_TYPE_OPTIONS,
      }),
  );
  const assistantLifecycleStateStore = writable({
    initializedKey: "",
    syncedVarsVersion: -1,
  });

  function setAssistantPrefix(prefix = "") {
    assistantConfigStateStore.set(
      requiredTxVarsAssistantConfigByPrefix(resolvePrefix(prefix)),
    );
  }

  function applyAssistantActivation(active = false) {
    setAssistantPrefix();
    if (!active) return;
    const assistantConfig = getStore(assistantConfigStateStore);
    const varsTextState = getStore(varsTextStateStore);
    const nextSyncState = {
      ...(getStore(assistantLifecycleStateStore) || {}),
    };

    if (nextSyncState.initializedKey !== assistantConfig.key) {
      nextSyncState.initializedKey = assistantConfig.key;
      nextSyncState.syncedVarsVersion = -1;
    }

    if (varsTextState.version === nextSyncState.syncedVarsVersion) {
      assistantLifecycleStateStore.set(nextSyncState);
      return;
    }
    nextSyncState.syncedVarsVersion = varsTextState.version;
    assistantLifecycleStateStore.set(nextSyncState);

    if (varsTextState.source === "assistant") return;
    applyTxVarsAssistantEntriesFromText(assistantConfig.key, {
      setStatus,
      silent: true,
    });
  }

  return {
    assistantActionsStateStore,
    assistantConfigStateStore,
    assistantDisplayStateStore,
    assistantStateStore,
    setAssistantCardContext({ active = false, prefix = "" } = {}) {
      setAssistantPrefix(prefix);
      applyAssistantActivation(active);
    },
    assistantLifecycleStateStore,
    varsTextStateStore,
  };
}
