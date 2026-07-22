export const displayModeTabs = Object.freeze([
  { value: "list", labelKey: "displayModeList" },
  { value: "raw", labelKey: "displayModeRaw" },
]);

export const connectionModalModeTabs = Object.freeze([
  { value: "saved", labelKey: "connectionModalModeManage" },
  { value: "temporary", labelKey: "connectionModalModeTemporary" },
]);

export const INVENTORY_KIND = { groups: "groups", labels: "labels" };

export const inventorySectionTabs = Object.freeze([
  { value: INVENTORY_KIND.groups, labelKey: "inventoryGroupsTitle" },
  { value: INVENTORY_KIND.labels, labelKey: "inventoryLabelsTitle" },
]);

export const defaultInventorySection = INVENTORY_KIND.groups;
export const EMPTY_INVENTORY_HOST_SET = new Set();

export function normalizeInventorySection(inventorySection = "") {
  return inventorySection === INVENTORY_KIND.labels
    ? INVENTORY_KIND.labels
    : defaultInventorySection;
}

export function isInventoryGroupsSection(inventorySection = "") {
  return normalizeInventorySection(inventorySection) === INVENTORY_KIND.groups;
}

export const PROMPT_MODE = Object.freeze({
  builtin: "builtin",
  diagnose: "diagnose",
  edit: "edit",
});

export const promptModeTabs = Object.freeze([
  { value: PROMPT_MODE.builtin, labelKey: "promptModeProfiles" },
]);

export const defaultPromptMode = PROMPT_MODE.builtin;
export function normalizePromptMode(promptMode = "") {
  if (promptMode === PROMPT_MODE.edit || promptMode === PROMPT_MODE.diagnose) {
    return PROMPT_MODE.builtin;
  }
  const knownPromptMode = promptModeTabs.some(
    (promptModeTab) => promptModeTab.value === promptMode,
  );
  return knownPromptMode ? promptMode : defaultPromptMode;
}

export const SHOW_QUERY = Object.freeze({ batch: "batch", single: "single" });

export const showQueryTabs = Object.freeze([
  { value: SHOW_QUERY.single, labelKey: "showSingleTabTitle" },
  { value: SHOW_QUERY.batch, labelKey: "showBatchTabTitle" },
]);

export function normalizeShowQuery(showQuery = "") {
  return showQuery === SHOW_QUERY.batch ? SHOW_QUERY.batch : SHOW_QUERY.single;
}

export const STANDARD_EXEC_MODE = Object.freeze({
  direct: "direct",
  flow: "flow",
});

export const standardExecModeTabs = Object.freeze([
  { value: STANDARD_EXEC_MODE.direct, labelKey: "opExecCommand" },
  { value: STANDARD_EXEC_MODE.flow, labelKey: "opExecFlow" },
]);

export const commandFlowEditorViewTabs = Object.freeze([
  { value: "visual", labelKey: "flowVisualTab" },
  { value: "toml", labelKey: "flowTomlTab" },
  { value: "readonly", labelKey: "txBlockEditorReadonlyTab" },
]);

export const defaultStandardExecMode = STANDARD_EXEC_MODE.direct;

export function normalizeStandardExecMode(standardExecMode = "") {
  return standardExecModeTabs.some((tab) => tab.value === standardExecMode)
    ? standardExecMode
    : defaultStandardExecMode;
}

export const TX_EXECUTION_MODE = Object.freeze({
  direct: "direct",
  template: "template",
});

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
  txExecutionMode = "",
  fallback = TX_EXECUTION_MODE.direct,
) {
  return txExecutionMode === TX_EXECUTION_MODE.template ||
    txExecutionMode === TX_EXECUTION_MODE.direct
    ? txExecutionMode
    : fallback;
}
