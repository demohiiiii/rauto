import {
  derived as deriveStore,
  get as getStore,
  writable,
} from "svelte/store";
import type { Readable, Writable } from "svelte/store";
import { jsonLanguage } from "@codemirror/lang-json";

import { formValueHandler } from "../../../lib/events.js";
import { currentLanguageState, t } from "../../../lib/i18n.js";
import { createSwitchingStore } from "../../../lib/svelte.js";
import { safeString as safeTemplateString } from "../../../lib/ui.js";

type TxVarsSource = "assistant" | "editor" | "external" | string;
type TxVarsValueType = "boolean" | "json" | "null" | "number" | "string";

interface TxVarsTextState {
  errorKind: string;
  errorMessage: string;
  raw: string;
  source: TxVarsSource;
  version: number;
}

interface TxVarsAssistantConfig {
  key: string;
  prefix: string;
  statusOutput: string;
}

interface TxVarsAssistantEntry {
  id: string;
  key: string;
  type: string;
  valueText: string;
}

interface TxVarsAssistantState {
  assistantEntries: TxVarsAssistantEntry[];
  version?: number;
}

interface TxVarsValueTypeOption {
  labelKey: string;
  value: TxVarsValueType;
}

interface TxVarsParseResult {
  errorKind: string;
  errorMessage: string;
  orderedKeys: string[];
  parsedValue: Record<string, unknown>;
}

interface TxVarsAssistantCardOptions {
  getPrefix?: (() => unknown) | null;
}

interface TxVarsAssistantActivation {
  active?: boolean;
  prefix?: unknown;
}

interface TxVarsAssistantLifecycleState {
  initializedKey: string;
  syncedVarsVersion: number;
}

type SetAssistantStatus = (
  output: string,
  message: string,
  tone: string,
) => unknown;

const switchingStore = createSwitchingStore as unknown as <TSource, TValue>(
  sourceStore: Readable<TSource>,
  resolveTargetStore: (source: TSource) => Readable<TValue> | null,
  initialValue: TValue,
) => Readable<TValue>;

export const TX_VARS = Object.freeze({
  orchestrationDirect: "orchestrationDirect",
  orchestrationTemplate: "orchestrationTemplate",
  txBlockDirect: "txBlockDirect",
  txBlockTemplate: "txBlockTemplate",
  txWorkflowDirect: "txWorkflowDirect",
  txWorkflowTemplate: "txWorkflowTemplate",
});

const TX_VARS_KEYS = new Set(Object.values(TX_VARS));

export const TX_VARS_ASSISTANT_VALUE_TYPE_OPTIONS: readonly TxVarsValueTypeOption[] =
  Object.freeze([
    { value: "string", labelKey: "txVarsFormTypeString" },
    { value: "number", labelKey: "txVarsFormTypeNumber" },
    { value: "boolean", labelKey: "txVarsFormTypeBoolean" },
    { value: "null", labelKey: "txVarsFormTypeNull" },
    { value: "json", labelKey: "txVarsFormTypeJson" },
  ]);

const TX_VARS_ASSISTANTS: readonly TxVarsAssistantConfig[] = [
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

const txVarsTextStates = new Map<string, Writable<TxVarsTextState>>();
const txVarsTextState = new Map<string, string>();
const txVarsAssistantState = new Map<string, TxVarsAssistantState>();
const txVarsAssistantStates = new Map<
  string,
  Writable<Required<TxVarsAssistantState>>
>();
let txVarsAssistantEntrySeq = 0;

const txVarsAssistantEntryFieldPatches = Object.freeze({
  key: (entryKey: unknown) => ({ key: txVarsSafeString(entryKey) }),
  type: (entryType: unknown) => ({ type: txVarsSafeString(entryType) }),
  valueText: (entryValueText: unknown) => ({
    valueText: txVarsSafeString(entryValueText),
  }),
});

function normalizeTransactionKey(
  rawKey: unknown,
  validKeys: ReadonlySet<string>,
  fallback = "",
): string {
  const key = safeTemplateString(rawKey || "").trim();
  if (!key) return fallback;
  return validKeys.has(key) ? key : fallback || key;
}

function txVarsSafeString(varsValue: unknown): string {
  if (varsValue == null) return "";
  return typeof varsValue === "string" ? varsValue : String(varsValue);
}

function normalizeTxVarsKey(txKey: unknown): string {
  const raw =
    txKey && typeof txKey === "object" && "key" in txKey
      ? (txKey as { key?: unknown }).key
      : txKey;
  return normalizeTransactionKey(txVarsSafeString(raw).trim(), TX_VARS_KEYS);
}

function txVarsTextStoreFor(varsKey: unknown): Writable<TxVarsTextState> {
  const key = normalizeTxVarsKey(varsKey);
  if (!txVarsTextStates.has(key)) {
    txVarsTextStates.set(
      key,
      writable({
        errorKind: "",
        errorMessage: "",
        raw: txVarsTextState.get(key) || "",
        source: "external",
        version: 0,
      }),
    );
  }
  return txVarsTextStates.get(key)!;
}

export function txVarsTextStateFor(
  varsKey: unknown,
): Writable<TxVarsTextState> {
  return txVarsTextStoreFor(varsKey);
}

export function setTxVarsRawText(
  varsKey: unknown,
  rawText: unknown = "",
  { source = "external" }: { source?: TxVarsSource } = {},
): void {
  const key = normalizeTxVarsKey(varsKey);
  const next = txVarsSafeString(rawText);
  const parseResult = txVarsParseText(next);
  txVarsTextState.set(key, next);
  txVarsTextStoreFor(key).update((state) => ({
    errorKind: parseResult.errorKind,
    errorMessage: parseResult.errorMessage,
    raw: next,
    source,
    version: (state?.version || 0) + 1,
  }));

  // Keep the structured form in sync with JSON edits. Assistant-originated
  // updates already come from the structured form and must not re-enter it.
  if (source !== "assistant" && !parseResult.errorKind) {
    const assistantConfig = txVarsAssistantConfig(key);
    if (assistantConfig) {
      setTxVarsAssistantEntries(
        assistantConfig,
        txVarsAssistantEntriesFromValue(
          parseResult.parsedValue,
          parseResult.orderedKeys,
        ),
      );
    }
  }
}

function txVarsRawText(varsKey: unknown): string {
  return txVarsSafeString(getStore(txVarsTextStateFor(varsKey))?.raw || "");
}

function txVarsAssistantConfig(varsKey: unknown): TxVarsAssistantConfig | null {
  const key = normalizeTxVarsKey(varsKey);
  return (
    TX_VARS_ASSISTANTS.find((txVarsAssistant) => txVarsAssistant.key === key) ||
    null
  );
}

function txVarsAssistantConfigByPrefix(
  prefix: unknown,
): TxVarsAssistantConfig | null {
  const normalizedPrefix = txVarsSafeString(prefix);
  return (
    TX_VARS_ASSISTANTS.find(
      (txVarsAssistant) => txVarsAssistant.prefix === normalizedPrefix,
    ) || null
  );
}

export function requiredTxVarsAssistantConfigByPrefix(
  prefix: unknown,
): TxVarsAssistantConfig {
  const txVarsAssistant = txVarsAssistantConfigByPrefix(prefix);
  if (!txVarsAssistant) {
    throw new Error(`Unknown transaction vars assistant prefix: ${prefix}`);
  }
  return txVarsAssistant;
}

function txVarsAssistantEntryInputPresentation(
  assistantEntry: Partial<TxVarsAssistantEntry> = {},
  {
    valueTypeOptions = [],
  }: { valueTypeOptions?: readonly TxVarsValueTypeOption[] } = {},
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
  state: Partial<TxVarsAssistantState> = {},
  {
    valueTypeOptions = [],
  }: { valueTypeOptions?: readonly TxVarsValueTypeOption[] } = {},
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
    title: t("txVarsFormTitle"),
  };
}

function txVarsAssistantEntry(
  entryKey: unknown = "",
  entryType: unknown = "string",
  valueText: unknown = "",
): TxVarsAssistantEntry {
  txVarsAssistantEntrySeq += 1;
  return {
    id: `tx-vars-${txVarsAssistantEntrySeq}`,
    key: txVarsSafeString(entryKey),
    type: txVarsSafeString(entryType) || "string",
    valueText: txVarsSafeString(valueText),
  };
}

function txVarsAssistantInferType(varsValue: unknown): TxVarsValueType {
  if (varsValue === null) return "null";
  if (typeof varsValue === "string") return "string";
  if (typeof varsValue === "number") return "number";
  if (typeof varsValue === "boolean") return "boolean";
  return "json";
}

function txVarsAssistantEntriesFromValue(
  varsValue: unknown,
  orderedKeys: readonly string[] | null = null,
): TxVarsAssistantEntry[] {
  const objectValue =
    varsValue && typeof varsValue === "object" && !Array.isArray(varsValue)
      ? (varsValue as Record<string, unknown>)
      : {};
  const entryKeys = Array.isArray(orderedKeys)
    ? orderedKeys.filter((entryKey) => Object.hasOwn(objectValue, entryKey))
    : Object.keys(objectValue);
  return entryKeys.map((entryKey) => {
    const assistantValue = objectValue[entryKey];
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

function txVarsOrderedKeysFromJson(rawText: string): string[] {
  const tree = jsonLanguage.parser.parse(rawText);
  const cursor = tree.cursor();
  if (!cursor.firstChild()) return [];
  do {
    if (cursor.name !== "Object" || !cursor.firstChild()) continue;
    const keys: string[] = [];
    do {
      if (String(cursor.name) !== "Property" || !cursor.firstChild()) continue;
      do {
        if (String(cursor.name) !== "PropertyName") continue;
        const parsedKey: unknown = JSON.parse(
          rawText.slice(cursor.from, cursor.to),
        );
        keys.push(txVarsSafeString(parsedKey));
        break;
      } while (cursor.nextSibling());
      cursor.parent();
    } while (cursor.nextSibling());
    cursor.parent();

    const lastIndexes = new Map(keys.map((key, index) => [key, index]));
    return keys.filter((key, index) => lastIndexes.get(key) === index);
  } while (cursor.nextSibling());
  return [];
}

function txVarsParseText(rawText: unknown = ""): TxVarsParseResult {
  const trimmedText = txVarsSafeString(rawText).trim();
  if (!trimmedText) {
    return {
      errorKind: "",
      errorMessage: "",
      orderedKeys: [],
      parsedValue: {},
    };
  }

  try {
    const parsedValue: unknown = JSON.parse(trimmedText);
    if (
      !parsedValue ||
      typeof parsedValue !== "object" ||
      Array.isArray(parsedValue)
    ) {
      return {
        errorKind: "object-required",
        errorMessage: "",
        orderedKeys: [],
        parsedValue: {},
      };
    }
    return {
      errorKind: "",
      errorMessage: "",
      orderedKeys: txVarsOrderedKeysFromJson(trimmedText),
      parsedValue: parsedValue as Record<string, unknown>,
    };
  } catch (error) {
    return {
      errorKind: "invalid",
      errorMessage:
        error instanceof Error ? error.message : String(error || ""),
      orderedKeys: [],
      parsedValue: {},
    };
  }
}

function txVarsAssistantParseValue(
  assistantEntry: Partial<TxVarsAssistantEntry>,
): unknown {
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

function txVarsAssistantEntriesToJsonText(
  assistantEntries: readonly TxVarsAssistantEntry[],
): string {
  const entries = (Array.isArray(assistantEntries) ? assistantEntries : [])
    .map((assistantEntry) => ({
      key: txVarsSafeString(assistantEntry?.key).trim(),
      value: txVarsAssistantParseValue(assistantEntry || {}),
    }))
    .filter((entry) => entry.key);
  const lastIndexes = new Map(
    entries.map((entry, index) => [entry.key, index]),
  );
  const serializedEntries = entries
    .filter((entry, index) => lastIndexes.get(entry.key) === index)
    .map((entry) => {
      const valueText = JSON.stringify(entry.value, null, 2).replace(
        /\n/g,
        "\n  ",
      );
      return `  ${JSON.stringify(entry.key)}: ${valueText}`;
    });

  if (!serializedEntries.length) return "{}";
  return `{\n${serializedEntries.join(",\n")}\n}`;
}

function txVarsAssistantGetState(
  assistantConfig: TxVarsAssistantConfig,
): TxVarsAssistantState {
  if (!txVarsAssistantState.has(assistantConfig.key)) {
    txVarsAssistantState.set(assistantConfig.key, { assistantEntries: [] });
  }
  return txVarsAssistantState.get(assistantConfig.key)!;
}

function txVarsAssistantStoreFor(
  assistantConfig: TxVarsAssistantConfig,
): Writable<Required<TxVarsAssistantState>> {
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
  return txVarsAssistantStates.get(assistantConfig.key)!;
}

export function txVarsAssistantStateFor(
  assistantConfig: TxVarsAssistantConfig,
): Writable<Required<TxVarsAssistantState>> {
  return txVarsAssistantStoreFor(assistantConfig);
}

function setTxVarsAssistantEntries(
  assistantConfig: TxVarsAssistantConfig,
  assistantEntries: readonly TxVarsAssistantEntry[] = [],
): void {
  const assistantState = txVarsAssistantGetState(assistantConfig);
  assistantState.assistantEntries = Array.isArray(assistantEntries)
    ? assistantEntries
    : [];
  txVarsAssistantStoreFor(assistantConfig).update((currentState) => ({
    assistantEntries: [...assistantState.assistantEntries],
    version: (currentState?.version || 0) + 1,
  }));
}

function txVarsAssistantEntries(
  assistantConfig: TxVarsAssistantConfig,
): TxVarsAssistantEntry[] {
  return [...(txVarsAssistantGetState(assistantConfig).assistantEntries || [])];
}

function txVarsAssistantSyncTextarea(
  assistantConfig: TxVarsAssistantConfig,
): boolean {
  const assistantState = txVarsAssistantGetState(assistantConfig);
  const nextText = txVarsAssistantEntriesToJsonText(
    assistantState.assistantEntries,
  );
  const changed = txVarsRawText(assistantConfig.key) !== nextText;
  setTxVarsRawText(assistantConfig.key, nextText, { source: "assistant" });
  return changed;
}

function setAssistantStatus(
  setStatus: SetAssistantStatus | null,
  statusOutput: string,
  message: string,
  tone = "info",
): void {
  if (typeof setStatus !== "function" || !statusOutput) return;
  setStatus(statusOutput, message, tone);
}

export function addTxVarsAssistantEntry(
  assistantConfig: TxVarsAssistantConfig | null | undefined,
): boolean {
  if (!assistantConfig) return false;
  setTxVarsAssistantEntries(assistantConfig, [
    ...txVarsAssistantEntries(assistantConfig),
    txVarsAssistantEntry(),
  ]);
  txVarsAssistantSyncTextarea(assistantConfig);
  return true;
}

export function clearTxVarsAssistantEntries(
  assistantConfig: TxVarsAssistantConfig | null | undefined,
): boolean {
  if (!assistantConfig) return false;
  setTxVarsAssistantEntries(assistantConfig, []);
  txVarsAssistantSyncTextarea(assistantConfig);
  return true;
}

export function removeTxVarsAssistantEntry(
  assistantConfig: TxVarsAssistantConfig | null | undefined,
  entryId: unknown,
): boolean {
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
  assistantConfig: TxVarsAssistantConfig | null | undefined,
  entryId: unknown,
  patch: Partial<TxVarsAssistantEntry> = {},
): boolean {
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
  varsKey: unknown,
  {
    keepStateOnError = true,
    setStatus = null,
    silent = false,
  }: {
    keepStateOnError?: boolean;
    setStatus?: SetAssistantStatus | null;
    silent?: boolean;
  } = {},
): boolean {
  const assistantConfig = txVarsAssistantConfig(varsKey);
  if (!assistantConfig) return false;
  const parseResult = txVarsParseText(txVarsRawText(assistantConfig.key));
  if (parseResult.errorKind) {
    if (!silent) {
      const message =
        parseResult.errorKind === "object-required"
          ? t("txVarsFormJsonObjectRequired")
          : `${t("txVarsFormJsonInvalid")}: ${parseResult.errorMessage}`;
      setAssistantStatus(
        setStatus,
        assistantConfig.statusOutput,
        message,
        "error",
      );
    }
    if (!keepStateOnError) {
      setTxVarsAssistantEntries(assistantConfig, []);
    }
    return false;
  }
  setTxVarsAssistantEntries(
    assistantConfig,
    txVarsAssistantEntriesFromValue(
      parseResult.parsedValue,
      parseResult.orderedKeys,
    ),
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

function txVarsAssistantCardActions(assistantConfig: TxVarsAssistantConfig) {
  return {
    addEntry() {
      addTxVarsAssistantEntry(assistantConfig);
    },
    clearEntries() {
      clearTxVarsAssistantEntries(assistantConfig);
    },
    removeEntryAction(entryId: unknown) {
      return () => removeTxVarsAssistantEntry(assistantConfig, entryId);
    },
    updateEntryJsonValue(entryId: unknown) {
      return (entryValueText: unknown) =>
        updateTxVarsAssistantEntry(
          assistantConfig,
          entryId,
          txVarsAssistantEntryFieldPatches.valueText(entryValueText),
        );
    },
    updateEntryKey(entryId: unknown) {
      return (entryKey: unknown) =>
        updateTxVarsAssistantEntry(
          assistantConfig,
          entryId,
          txVarsAssistantEntryFieldPatches.key(entryKey),
        );
    },
    updateEntryType(entryId: unknown) {
      return formValueHandler((entryType: unknown) =>
        updateTxVarsAssistantEntry(
          assistantConfig,
          entryId,
          txVarsAssistantEntryFieldPatches.type(entryType),
        ),
      );
    },
    updateEntryValue(entryId: unknown) {
      return (entryValueText: unknown) =>
        updateTxVarsAssistantEntry(
          assistantConfig,
          entryId,
          txVarsAssistantEntryFieldPatches.valueText(entryValueText),
        );
    },
  };
}

export function createTxVarsAssistantCardWorkspace({
  getPrefix = null,
}: TxVarsAssistantCardOptions = {}) {
  const resolvePrefix = (prefix: unknown = ""): string =>
    txVarsSafeString(prefix || "") ||
    (typeof getPrefix === "function"
      ? txVarsSafeString(getPrefix())
      : txVarsSafeString(prefix));
  const assistantConfigStateStore = writable(
    requiredTxVarsAssistantConfigByPrefix(resolvePrefix()),
  );
  const assistantStateStore = switchingStore(
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
  const varsTextStateStore = switchingStore(
    assistantConfigStateStore,
    ($assistantConfigStateStore) =>
      $assistantConfigStateStore?.key
        ? txVarsTextStateFor($assistantConfigStateStore.key)
        : null,
    {
      raw: "",
      source: "external",
      errorKind: "",
      errorMessage: "",
      version: 0,
    },
  );
  const assistantActionsStateStore = deriveStore(
    assistantConfigStateStore,
    ($assistantConfigStateStore) =>
      txVarsAssistantCardActions($assistantConfigStateStore),
  );
  const assistantDisplayStateStore = deriveStore(
    [assistantStateStore, currentLanguageState],
    ([$assistantStateStore]) =>
      txVarsAssistantPresentation($assistantStateStore, {
        valueTypeOptions: TX_VARS_ASSISTANT_VALUE_TYPE_OPTIONS,
      }),
  );
  const assistantLifecycleStateStore = writable<TxVarsAssistantLifecycleState>({
    initializedKey: "",
    syncedVarsVersion: -1,
  });

  function setAssistantPrefix(prefix: unknown = ""): void {
    assistantConfigStateStore.set(
      requiredTxVarsAssistantConfigByPrefix(resolvePrefix(prefix)),
    );
  }

  function applyAssistantActivation(active = false): void {
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
      silent: true,
    });
  }

  return {
    assistantActionsStateStore,
    assistantConfigStateStore,
    assistantDisplayStateStore,
    assistantStateStore,
    setAssistantCardContext({
      active = false,
      prefix = "",
    }: TxVarsAssistantActivation = {}) {
      setAssistantPrefix(prefix);
      applyAssistantActivation(active);
    },
    assistantLifecycleStateStore,
    varsTextStateStore,
  };
}
