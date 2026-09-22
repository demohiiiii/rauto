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

export function normalizeShowQuery(showQuery: unknown = ""): ShowQuery {
  return showQuery === SHOW_QUERY.batch ? SHOW_QUERY.batch : SHOW_QUERY.single;
}

export type DeliveryTargetMode = "single" | "batch";

export const executionScopeTabs = Object.freeze([
  { value: "single", labelKey: "executionSingleTab" },
  { value: "batch", labelKey: "executionBatchTab" },
]);

export const interactiveEditorViewTabs = Object.freeze([
  { value: "visual", labelKey: "interactiveVisualTab" },
  { value: "toml", labelKey: "interactiveTomlTab" },
  { value: "readonly", labelKey: "txBlockEditorReadonlyTab" },
]);

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
