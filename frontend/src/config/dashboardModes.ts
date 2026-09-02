export const displayModeTabs = Object.freeze([
  { value: "list", labelKey: "displayModeList" },
  { value: "raw", labelKey: "displayModeRaw" },
]);

export const connectionModalModeTabs = Object.freeze([
  { value: "saved", labelKey: "connectionModalModeManage" },
  { value: "temporary", labelKey: "connectionModalModeTemporary" },
]);

export const INVENTORY_KIND = Object.freeze({
  devices: "devices",
  groups: "groups",
  labels: "labels",
});

export type InventorySection =
  (typeof INVENTORY_KIND)[keyof typeof INVENTORY_KIND];

export const inventorySectionTabs = Object.freeze([
  { value: INVENTORY_KIND.devices, labelKey: "inventoryDevicesTitle" },
  { value: INVENTORY_KIND.groups, labelKey: "inventoryGroupsTitle" },
  { value: INVENTORY_KIND.labels, labelKey: "inventoryLabelsTitle" },
]);

export const defaultInventorySection = INVENTORY_KIND.devices;
export const EMPTY_INVENTORY_HOST_SET = new Set<string>();

export function normalizeInventorySection(
  inventorySection: unknown = "",
): InventorySection {
  return (
    inventorySectionTabs.find((tab) => tab.value === inventorySection)?.value ??
    defaultInventorySection
  );
}

export function isInventoryGroupsSection(
  inventorySection: unknown = "",
): boolean {
  return normalizeInventorySection(inventorySection) === INVENTORY_KIND.groups;
}

export const PROMPT_MODE = Object.freeze({
  builtin: "builtin",
  diagnose: "diagnose",
  edit: "edit",
});

export type PromptMode = (typeof PROMPT_MODE)[keyof typeof PROMPT_MODE];

export const promptModeTabs = Object.freeze([
  { value: PROMPT_MODE.builtin, labelKey: "promptModeProfiles" },
]);

export const defaultPromptMode = PROMPT_MODE.builtin;
export function normalizePromptMode(promptMode: unknown = ""): PromptMode {
  if (promptMode === PROMPT_MODE.edit || promptMode === PROMPT_MODE.diagnose) {
    return PROMPT_MODE.builtin;
  }
  const knownPromptMode = promptModeTabs.find(
    (promptModeTab) => promptModeTab.value === promptMode,
  );
  return knownPromptMode?.value ?? defaultPromptMode;
}

export const SHOW_QUERY = Object.freeze({ batch: "batch", single: "single" });

export type ShowQuery = (typeof SHOW_QUERY)[keyof typeof SHOW_QUERY];

export const showQueryTabs = Object.freeze([
  { value: SHOW_QUERY.single, labelKey: "showSingleTabTitle" },
  { value: SHOW_QUERY.batch, labelKey: "showBatchTabTitle" },
]);

export function normalizeShowQuery(showQuery: unknown = ""): ShowQuery {
  return showQuery === SHOW_QUERY.batch ? SHOW_QUERY.batch : SHOW_QUERY.single;
}

export const STANDARD_EXEC_MODE = Object.freeze({
  direct: "direct",
  flow: "flow",
});

export type StandardExecMode =
  (typeof STANDARD_EXEC_MODE)[keyof typeof STANDARD_EXEC_MODE];

export const standardExecModeTabs = Object.freeze([
  { value: STANDARD_EXEC_MODE.direct, labelKey: "opExecCommand" },
  { value: STANDARD_EXEC_MODE.flow, labelKey: "opExecFlow" },
]);

export const BATCH_EXEC_MODE = Object.freeze({
  command: "command",
  flow: "flow",
});

export type BatchExecMode =
  (typeof BATCH_EXEC_MODE)[keyof typeof BATCH_EXEC_MODE];

export const batchExecModeTabs = Object.freeze([
  { value: BATCH_EXEC_MODE.command, labelKey: "opExecCommand" },
  { value: BATCH_EXEC_MODE.flow, labelKey: "opExecFlow" },
]);

export const defaultBatchExecMode = BATCH_EXEC_MODE.command;

export function normalizeBatchExecMode(
  batchExecMode: unknown = "",
): BatchExecMode {
  return (
    batchExecModeTabs.find((tab) => tab.value === batchExecMode)?.value ??
    defaultBatchExecMode
  );
}

export const commandFlowEditorViewTabs = Object.freeze([
  { value: "visual", labelKey: "flowVisualTab" },
  { value: "toml", labelKey: "flowTomlTab" },
  { value: "readonly", labelKey: "txBlockEditorReadonlyTab" },
]);

export const defaultStandardExecMode = STANDARD_EXEC_MODE.direct;

export function normalizeStandardExecMode(
  standardExecMode: unknown = "",
): StandardExecMode {
  return (
    standardExecModeTabs.find((tab) => tab.value === standardExecMode)?.value ??
    defaultStandardExecMode
  );
}

export const TX_EXECUTION_MODE = Object.freeze({
  direct: "direct",
  template: "template",
});

export type TxExecutionMode =
  (typeof TX_EXECUTION_MODE)[keyof typeof TX_EXECUTION_MODE];

export const txTemplateModeTabs = Object.freeze([
  { value: TX_EXECUTION_MODE.direct, labelKey: "txBlockModeDirect" },
  { value: TX_EXECUTION_MODE.template, labelKey: "txBlockModeTemplate" },
]);

export const txBlockEditorViewTabs = Object.freeze([
  { value: "form", labelKey: "txBlockEditorFormTab" },
  { value: "json", labelKey: "txBlockEditorJsonTab" },
]);

export const txBlockReadonlyEditorViewTabs = Object.freeze([
  ...txBlockEditorViewTabs,
  { value: "readonly", labelKey: "txBlockEditorReadonlyTab" },
]);

export function normalizeTxExecutionMode(
  txExecutionMode?: unknown,
): TxExecutionMode;
export function normalizeTxExecutionMode<TFallback>(
  txExecutionMode: unknown,
  fallback: TFallback,
): TxExecutionMode | TFallback;
export function normalizeTxExecutionMode(
  txExecutionMode: unknown = "",
  fallback: unknown = TX_EXECUTION_MODE.direct,
): TxExecutionMode | unknown {
  return txExecutionMode === TX_EXECUTION_MODE.template ||
    txExecutionMode === TX_EXECUTION_MODE.direct
    ? txExecutionMode
    : fallback;
}
