import { get as getStore, writable } from "svelte/store";
import { t } from "../lib/i18n.js";
import { displayString, safeString } from "../lib/ui.js";

export const CONNECTION_PICKER = Object.freeze({
  batchShowGroups: "connectionPicker.batchShow.groups",
  batchShowLabels: "connectionPicker.batchShow.labels",
  batchShowObject: "connectionPicker.batchShow.object",
  batchShowTargets: "connectionPicker.batchShow.targets",
  orchestrationTargetGroups: "connectionPicker.orchestration.targetGroups",
  orchestrationTargetTags: "connectionPicker.orchestration.targetTags",
  orchestrationTargets: "connectionPicker.orchestration.targets",
  savedEditGroups: "connectionPicker.savedEdit.groups",
  savedEditLabels: "connectionPicker.savedEdit.labels",
  savedGroups: "connectionPicker.saved.groups",
  savedLabels: "connectionPicker.saved.labels",
  showObject: "connectionPicker.show.object",
});

export const CONNECTION_VARS = Object.freeze({
  saved: "connectionVars.saved",
  savedEdit: "connectionVars.savedEdit",
});

export const CONNECTION_PROFILE_SELECT = Object.freeze({
  editor: "connectionProfile.editor",
  temporary: "connectionProfile.temporary",
});

const CONNECTION_PICKER_KEYS = new Set(Object.values(CONNECTION_PICKER));
const CONNECTION_VARS_KEYS = new Set(Object.values(CONNECTION_VARS));
const CONNECTION_PROFILE_SELECT_KEYS = new Set(
  Object.values(CONNECTION_PROFILE_SELECT),
);
const CONNECTION_VARS_ROW_KEY_PREFIX = Object.freeze({
  [CONNECTION_VARS.saved]: "connectionVarsSaved",
  [CONNECTION_VARS.savedEdit]: "connectionVarsSavedEdit",
});
const CONNECTION_PICKER_CONFIGS = {
  [CONNECTION_PICKER.savedLabels]: {
    kind: "labels",
  },
  [CONNECTION_PICKER.savedEditLabels]: {
    kind: "labels",
  },
  [CONNECTION_PICKER.savedGroups]: {
    kind: "groups",
  },
  [CONNECTION_PICKER.savedEditGroups]: {
    kind: "groups",
  },
  [CONNECTION_PICKER.batchShowTargets]: {
    kind: "devices",
  },
  [CONNECTION_PICKER.batchShowGroups]: {
    kind: "groups",
  },
  [CONNECTION_PICKER.batchShowLabels]: {
    kind: "labels",
  },
  [CONNECTION_PICKER.orchestrationTargetGroups]: {
    kind: "groups",
  },
  [CONNECTION_PICKER.orchestrationTargetTags]: {
    kind: "labels",
    allowCustom: false,
  },
  [CONNECTION_PICKER.orchestrationTargets]: {
    kind: "devices",
    allowCustom: false,
  },
  [CONNECTION_PICKER.showObject]: {
    kind: "show-objects",
  },
  [CONNECTION_PICKER.batchShowObject]: {
    kind: "show-objects",
  },
};

const connectionPickerValueState = new Map();
const connectionPickerStates = new Map();
const connectionProfileSelectStates = new Map();
const connectionVarsValueState = new Map();
const connectionVarsStates = new Map();
const showObjectOptionsState = new Map();

let connectionInventoryGroupsSnapshot = [];
let connectionInventoryLabelsSnapshot = [];
let connectionDeviceProfilesSnapshot = [];
let savedConnectionsSnapshot = [];

function normalizeMappedKey(key, validKeys = null, fallback = "") {
  const mapKey = String(key ?? "").trim();
  if (!mapKey) return fallback;
  return validKeys && !validKeys.has(mapKey) ? fallback || mapKey : mapKey;
}

function normalizeConnectionPickerKey(key) {
  return normalizeMappedKey(key, CONNECTION_PICKER_KEYS);
}

function normalizeConnectionVarsKey(key) {
  return normalizeMappedKey(key, CONNECTION_VARS_KEYS);
}

function normalizeConnectionProfileSelectKey(key) {
  return normalizeMappedKey(
    key,
    CONNECTION_PROFILE_SELECT_KEYS,
    CONNECTION_PROFILE_SELECT.temporary,
  );
}

function connectionPickerConfig(key) {
  return CONNECTION_PICKER_CONFIGS[normalizeConnectionPickerKey(key)] || null;
}

function connectionProfileValues() {
  return Array.from(
    new Set(
      connectionDeviceProfilesSnapshot
        .map((profileName) => displayString(profileName).trim())
        .filter(Boolean),
    ),
  ).sort((leftValue, rightValue) =>
    leftValue.localeCompare(rightValue, undefined, { sensitivity: "base" }),
  );
}

function connectionProfileSelectPayload() {
  return {
    profiles: connectionProfileValues(),
  };
}

function connectionProfileSelectStoreFor(key) {
  const normalizedKey = normalizeConnectionProfileSelectKey(key);
  if (!connectionProfileSelectStates.has(normalizedKey)) {
    connectionProfileSelectStates.set(
      normalizedKey,
      writable(connectionProfileSelectPayload()),
    );
  }
  return connectionProfileSelectStates.get(normalizedKey);
}

function updateConnectionProfileSelectState(key) {
  const normalizedKey = normalizeConnectionProfileSelectKey(key);
  connectionProfileSelectStates
    .get(normalizedKey)
    ?.set(connectionProfileSelectPayload());
}

function updateConnectionProfileSelectStates() {
  connectionProfileSelectStates.forEach((_, key) => {
    updateConnectionProfileSelectState(key);
  });
}

function normalizeConnectionPickerValues(pickerValues = []) {
  const seenValues = new Set();
  return (pickerValues || [])
    .map((pickerValue) => safeString(pickerValue || "").trim())
    .filter((pickerValue) => {
      if (!pickerValue || seenValues.has(pickerValue)) return false;
      seenValues.add(pickerValue);
      return true;
    });
}

function normalizeShowObjectOptions(objects = []) {
  return (Array.isArray(objects) ? objects : [])
    .map((showObjectOption) => ({
      command: safeString(showObjectOption?.command || ""),
      mode: safeString(showObjectOption?.mode || ""),
      object: safeString(showObjectOption?.object || "").trim(),
      source: safeString(showObjectOption?.source || ""),
      textfsmMappingCommand: safeString(
        showObjectOption?.textfsm_mapping_command ??
          showObjectOption?.textfsmMappingCommand ??
          "",
      ),
      textfsmTemplate: safeString(
        showObjectOption?.textfsm_template_name ??
          showObjectOption?.textfsmTemplateName ??
          "",
      ),
    }))
    .filter((showObjectOption) => showObjectOption.object);
}

function defaultConnectionPickerState(key) {
  const pickerKey = normalizeConnectionPickerKey(key);
  return {
    open: false,
    query: "",
    showObjects: showObjectOptionsState.get(pickerKey) || [],
    values: connectionPickerValueState.get(pickerKey) || [],
    version: 0,
  };
}

function connectionPickerStoreFor(key) {
  const pickerKey = normalizeConnectionPickerKey(key);
  if (!connectionPickerStates.has(pickerKey)) {
    connectionPickerStates.set(
      pickerKey,
      writable(defaultConnectionPickerState(pickerKey)),
    );
  }
  if (!connectionPickerValueState.has(pickerKey)) {
    connectionPickerValueState.set(pickerKey, []);
  }
  return connectionPickerStates.get(pickerKey);
}

function updateConnectionPickerState(key, updater) {
  const pickerKey = normalizeConnectionPickerKey(key);
  const store = connectionPickerStoreFor(pickerKey);
  store.update((state) => {
    const nextState = updater(state || defaultConnectionPickerState(pickerKey));
    const resolvedState = {
      ...defaultConnectionPickerState(pickerKey),
      ...(nextState || {}),
      version: (state?.version || 0) + 1,
    };
    connectionPickerValueState.set(pickerKey, resolvedState.values || []);
    return resolvedState;
  });
}

function showObjectOptionValues(key) {
  const cachedOptions = showObjectOptionsState.get(
    normalizeConnectionPickerKey(key),
  );
  if (cachedOptions) {
    return cachedOptions.map((showObjectOption) => showObjectOption.object);
  }
  return [];
}

function connectionPickerOptionValues(
  kind,
  selectedValues = [],
  sourceKey = "",
) {
  const normalizedSourceKey = normalizeConnectionPickerKey(sourceKey);
  const normalizedSelectedValues =
    normalizeConnectionPickerValues(selectedValues);
  const availableValues =
    kind === "groups"
      ? connectionInventoryGroupsSnapshot.map((inventoryGroup) =>
          safeString(inventoryGroup?.name || "").trim(),
        )
      : kind === "devices"
        ? savedConnectionsSnapshot.map((savedConnection) =>
            safeString(savedConnection?.name || "").trim(),
          )
        : kind === "show-objects"
          ? showObjectOptionValues(normalizedSourceKey)
          : connectionInventoryLabelsSnapshot.map((inventoryLabel) =>
              safeString(inventoryLabel?.name || "").trim(),
            );
  return normalizeConnectionPickerValues([
    ...availableValues,
    ...normalizedSelectedValues,
  ]).sort((leftValue, rightValue) => leftValue.localeCompare(rightValue));
}

export function showObjectOptionMeta(pickerKey, showObjectValue = "") {
  const normalizedPickerKey = normalizeConnectionPickerKey(pickerKey);
  const normalizedShowObjectValue = safeString(showObjectValue || "").trim();
  const cachedShowObjectOption = showObjectOptionsState
    .get(normalizedPickerKey)
    ?.find(
      (showObjectOption) =>
        showObjectOption.object === normalizedShowObjectValue,
    );
  if (cachedShowObjectOption) {
    return {
      command: cachedShowObjectOption.command,
      mode: cachedShowObjectOption.mode,
      object: cachedShowObjectOption.object,
      source: cachedShowObjectOption.source,
      textfsmMappingCommand: cachedShowObjectOption.textfsmMappingCommand,
      textfsmTemplate: cachedShowObjectOption.textfsmTemplate,
    };
  }
  return {
    object: normalizedShowObjectValue,
    command: "",
    mode: "",
    source: "",
    textfsmMappingCommand: "",
    textfsmTemplate: "",
  };
}

function connectionPickerOptionRow(kind, pickerKey, optionValue) {
  if (kind !== "show-objects") {
    return {
      isShowObject: false,
      label: optionValue,
      nameText: "",
      value: optionValue,
    };
  }
  const meta = showObjectOptionMeta(pickerKey, optionValue);
  return {
    isShowObject: true,
    label: meta.object,
    nameText: meta.object,
    value: optionValue,
  };
}

function showObjectSearchText(pickerKey, showObjectValue) {
  return showObjectOptionMeta(pickerKey, showObjectValue).object.toLowerCase();
}

function setConnectionPickerValues(key, pickerValues) {
  const pickerKey = normalizeConnectionPickerKey(key);
  const normalizedValues = normalizeConnectionPickerValues(pickerValues);
  connectionPickerValueState.set(pickerKey, normalizedValues);
  updateConnectionPickerState(pickerKey, (state) => ({
    ...state,
    query: "",
    values: normalizedValues,
  }));
}

function refreshConnectionPickerMenu(key) {
  updateConnectionPickerState(key, (state) => ({ ...state }));
}

function refreshConnectionPicker(key) {
  refreshConnectionPickerSelected(key);
  refreshConnectionPickerMenu(key);
}

function refreshConnectionGroupsForPicker(pickerKey, selectedValues = null) {
  if (Array.isArray(selectedValues)) {
    setConnectionPickerValues(pickerKey, selectedValues);
    return;
  }
  refreshConnectionPicker(pickerKey);
}

function connectionVarsRowKeyPrefix(key) {
  const normalizedKey = normalizeConnectionVarsKey(key);
  return CONNECTION_VARS_ROW_KEY_PREFIX[normalizedKey] || normalizedKey;
}

function inferConnectionVarType(varValue) {
  if (varValue === null) return "null";
  if (typeof varValue === "number") return "number";
  if (typeof varValue === "boolean") return "boolean";
  return "string";
}

function connectionVarValueToInput(varValue) {
  if (varValue == null) return "";
  if (typeof varValue === "object") {
    try {
      return JSON.stringify(varValue);
    } catch (_) {
      return String(varValue);
    }
  }
  return String(varValue);
}

function parseConnectionVarValue(type, rawValue) {
  const varText = safeString(rawValue || "");
  if (type === "number") {
    if (!varText.trim()) return null;
    const parsedNumber = Number(varText);
    if (!Number.isFinite(parsedNumber)) {
      throw new Error(t("connectionVarNumberInvalid"));
    }
    return parsedNumber;
  }
  if (type === "boolean") {
    return varText === "true";
  }
  if (type === "null") {
    return null;
  }
  return varText;
}

function normalizeConnectionVarRows(key, connectionVars = {}) {
  const idPrefix = connectionVarsRowKeyPrefix(key);
  const normalizedConnectionVars =
    connectionVars &&
    typeof connectionVars === "object" &&
    !Array.isArray(connectionVars)
      ? connectionVars
      : {};
  return Object.entries(normalizedConnectionVars).map(
    ([varName, varValue], index) => ({
      id: `${idPrefix}-${index}-${varName}`,
      name: varName,
      type: inferConnectionVarType(varValue),
      value: connectionVarValueToInput(varValue),
    }),
  );
}

function connectionVarRowsToConnectionVars(
  connectionVarRows = [],
  { strict = true } = {},
) {
  const connectionVars = {};
  for (const connectionVarRow of Array.isArray(connectionVarRows)
    ? connectionVarRows
    : []) {
    const connectionVarName = safeString(connectionVarRow.name || "").trim();
    if (!connectionVarName) continue;
    try {
      connectionVars[connectionVarName] = parseConnectionVarValue(
        connectionVarRow.type || "string",
        connectionVarRow.value,
      );
    } catch (error) {
      if (strict) throw error;
    }
  }
  return connectionVars;
}

function setConnectionVarsState(key, vars = {}) {
  const varsKey = normalizeConnectionVarsKey(key);
  const normalizedConnectionVars =
    vars && typeof vars === "object" && !Array.isArray(vars) ? vars : {};
  connectionVarsValueState.set(varsKey, normalizedConnectionVars);
  return normalizedConnectionVars;
}

function defaultConnectionVarsState(key) {
  const varsKey = normalizeConnectionVarsKey(key);
  const connectionVars = connectionVarsValueState.get(varsKey) || {};
  const connectionVarRows = normalizeConnectionVarRows(varsKey, connectionVars);
  return {
    connectionVarRows,
    connectionVars,
    hasConnectionVarRows: connectionVarRows.length > 0,
    version: 0,
  };
}

function connectionVarsStoreFor(key) {
  const varsKey = normalizeConnectionVarsKey(key);
  if (!connectionVarsStates.has(varsKey)) {
    connectionVarsStates.set(
      varsKey,
      writable(defaultConnectionVarsState(varsKey)),
    );
  }
  return connectionVarsStates.get(varsKey);
}

function setConnectionVarRows(key, connectionVarRows = []) {
  const varsKey = normalizeConnectionVarsKey(key);
  const normalizedRows = Array.isArray(connectionVarRows)
    ? connectionVarRows
    : [];
  const connectionVars = connectionVarRowsToConnectionVars(normalizedRows, {
    strict: false,
  });
  setConnectionVarsState(varsKey, connectionVars);
  connectionVarsStoreFor(varsKey).update((state) => ({
    ...state,
    connectionVarRows: normalizedRows,
    connectionVars,
    hasConnectionVarRows: normalizedRows.length > 0,
    version: (state?.version || 0) + 1,
  }));
  return true;
}

function applyConnectionVarsRowPatch(key, id, patch = {}) {
  const varsKey = normalizeConnectionVarsKey(key);
  const connectionVarRows =
    getStore(connectionVarsStoreFor(varsKey)).connectionVarRows || [];
  setConnectionVarRows(
    varsKey,
    connectionVarRows.map((connectionVarRow) => {
      if (connectionVarRow.id !== id) return connectionVarRow;
      const nextConnectionVarRow = { ...connectionVarRow, ...patch };
      if (patch.type === "boolean" && nextConnectionVarRow.value !== "true") {
        nextConnectionVarRow.value = "false";
      }
      if (patch.type === "null") {
        nextConnectionVarRow.value = "";
      }
      return nextConnectionVarRow;
    }),
  );
}

export function connectionProfileSelectState(key) {
  return connectionProfileSelectStoreFor(key);
}

export function setConnectionDeviceProfiles(profiles = []) {
  connectionDeviceProfilesSnapshot = Array.isArray(profiles) ? profiles : [];
  updateConnectionProfileSelectStates();
  return connectionDeviceProfilesSnapshot;
}

export function connectionPickerState(key) {
  return connectionPickerStoreFor(key);
}

export function connectionPickerValues(key) {
  const pickerConfig = connectionPickerConfig(key);
  if (!pickerConfig) return [];
  return (
    getStore(connectionPickerStoreFor(normalizeConnectionPickerKey(key)))
      .values || []
  );
}

export function connectionPickerChoices(key, pickerState = {}) {
  const pickerKey = normalizeConnectionPickerKey(key);
  const pickerConfig = connectionPickerConfig(pickerKey);
  const selectedValues = Array.isArray(pickerState?.values)
    ? pickerState.values
    : [];
  const query = safeString(pickerState?.query || "").trim();
  const lowerQuery = query.toLowerCase();
  const selectedValueSet = new Set(selectedValues);
  const optionValues = connectionPickerOptionValues(
    pickerConfig?.kind || "",
    selectedValues,
    pickerKey,
  ).filter(
    (optionValue) =>
      !selectedValueSet.has(optionValue) &&
      (!lowerQuery ||
        (pickerConfig?.kind === "show-objects"
          ? showObjectSearchText(pickerKey, optionValue).includes(lowerQuery)
          : optionValue.toLowerCase().includes(lowerQuery))),
  );
  const kind = pickerConfig?.kind || "";
  const optionRows = optionValues.map((optionValue) =>
    connectionPickerOptionRow(kind, pickerKey, optionValue),
  );
  const canAddCustom =
    kind === "labels" &&
    pickerConfig?.allowCustom !== false &&
    !!query &&
    !selectedValues.includes(query) &&
    !optionValues.includes(query);
  return {
    canAddCustom,
    hasOptionRows: optionRows.length > 0,
    kind,
    normalizedQuery: query,
    options: optionValues,
    optionRows,
    pickerKey,
    showObjectMenu: kind === "show-objects",
    showNoMatch: optionRows.length === 0 && !canAddCustom,
  };
}

export function connectionPickerCommitKeys(key) {
  const pickerConfig = connectionPickerConfig(key);
  return pickerConfig?.kind === "labels" ? ["Enter", ","] : ["Enter"];
}

function setConnectionPickerOpen(key, open = true) {
  updateConnectionPickerState(key, (state) => ({ ...state, open: !!open }));
}

function setConnectionPickerQuery(key, query = "") {
  updateConnectionPickerState(key, (state) => ({
    ...state,
    query: safeString(query || ""),
  }));
}

export function hideConnectionPickerMenu(key) {
  setConnectionPickerOpen(key, false);
}

export function openConnectionPickerMenu(key) {
  setConnectionPickerOpen(key, true);
}

export function setConnectionPickerQueryValue(key, query = "") {
  setConnectionPickerQuery(key, query);
}

function getConnectionPickerSelectedValues(key) {
  return connectionPickerValues(key);
}

export function refreshConnectionPickerSelected(key) {
  updateConnectionPickerState(key, (state) => ({ ...state }));
}

export function setShowObjectPickerOptions(
  key,
  options = [],
  selectedValues = null,
  onSelectionChange = null,
) {
  const pickerKey = normalizeConnectionPickerKey(key);
  const normalizedOptions = normalizeShowObjectOptions(options);
  showObjectOptionsState.set(pickerKey, normalizedOptions);
  if (connectionPickerConfig(pickerKey)?.kind !== "show-objects") {
    return false;
  }
  updateConnectionPickerState(pickerKey, (state) => ({
    ...state,
    query: "",
    showObjects: normalizedOptions,
    values:
      selectedValues == null
        ? state.values || []
        : normalizeConnectionPickerValues(selectedValues),
  }));
  if (Array.isArray(selectedValues)) {
    connectionPickerValueState.set(
      pickerKey,
      normalizeConnectionPickerValues(selectedValues),
    );
  }
  if (typeof onSelectionChange === "function") {
    onSelectionChange(getConnectionPickerSelectedValues(pickerKey));
  }
  return true;
}

function addConnectionPickerValue(key, rawValue) {
  const nextValue = safeString(rawValue || "").trim();
  if (!nextValue) return false;
  const pickerKey = normalizeConnectionPickerKey(key);
  const nextValues = new Set(getConnectionPickerSelectedValues(pickerKey));
  if (nextValues.has(nextValue)) return false;
  nextValues.add(nextValue);
  setConnectionPickerValues(pickerKey, Array.from(nextValues));
  return true;
}

function removeConnectionPickerValue(key, rawValue) {
  const nextValue = safeString(rawValue || "").trim();
  if (!nextValue) return false;
  const pickerKey = normalizeConnectionPickerKey(key);
  const nextValues = getConnectionPickerSelectedValues(pickerKey).filter(
    (pickerValue) => pickerValue !== nextValue,
  );
  setConnectionPickerValues(pickerKey, nextValues);
  return true;
}

function commitConnectionPickerInput(key, rawInput = "") {
  const normalizedInput = safeString(rawInput || "").trim();
  if (!normalizedInput) return false;
  const pickerKey = normalizeConnectionPickerKey(key);
  const pickerConfig = connectionPickerConfig(pickerKey);
  if (!pickerConfig) return false;
  if (pickerConfig.kind === "labels" && pickerConfig.allowCustom !== false) {
    return addConnectionPickerValue(pickerKey, normalizedInput);
  }
  const matchingOption = connectionPickerOptionValues(
    pickerConfig.kind,
    getConnectionPickerSelectedValues(pickerKey),
    pickerKey,
  ).find((pickerValue) => pickerValue === normalizedInput);
  if (!matchingOption) return false;
  return addConnectionPickerValue(pickerKey, matchingOption);
}

export function addConnectionPickerSelection(key, rawValue) {
  return addConnectionPickerValue(key, rawValue);
}

export function removeConnectionPickerSelection(key, rawValue) {
  return removeConnectionPickerValue(key, rawValue);
}

export function commitConnectionPickerSelection(key, rawInput = "") {
  return commitConnectionPickerInput(key, rawInput);
}

export function refreshSavedConnectionGroupOptions(selectedValues = null) {
  refreshConnectionGroupsForPicker(
    CONNECTION_PICKER.savedGroups,
    selectedValues,
  );
  refreshConnectionGroupsForPicker(
    CONNECTION_PICKER.savedEditGroups,
    selectedValues,
  );
}

export function refreshSavedConnectionLabelOptions(selectedValues = null) {
  refreshConnectionGroupsForPicker(
    CONNECTION_PICKER.savedLabels,
    selectedValues,
  );
  refreshConnectionGroupsForPicker(
    CONNECTION_PICKER.savedEditLabels,
    selectedValues,
  );
}

export function setConnectionInventorySnapshots({ groups, labels } = {}) {
  connectionInventoryGroupsSnapshot = Array.isArray(groups) ? groups : [];
  connectionInventoryLabelsSnapshot = Array.isArray(labels) ? labels : [];
  refreshSavedConnectionGroupOptions();
  refreshSavedConnectionLabelOptions();
  refreshConnectionPicker(CONNECTION_PICKER.batchShowGroups);
  refreshConnectionPicker(CONNECTION_PICKER.batchShowLabels);
  refreshConnectionPicker(CONNECTION_PICKER.orchestrationTargetGroups);
  refreshConnectionPicker(CONNECTION_PICKER.orchestrationTargetTags);
}

export function setConnectionPickerSavedConnections(savedConnections = []) {
  savedConnectionsSnapshot = Array.isArray(savedConnections)
    ? savedConnections
    : [];
  refreshConnectionPicker(CONNECTION_PICKER.batchShowTargets);
  refreshConnectionPicker(CONNECTION_PICKER.orchestrationTargets);
}

export function setConnectionPickerSelectedValues(key, selectedValues = []) {
  setConnectionPickerValues(key, selectedValues);
}

export function refreshConnectionPickerOptions(key) {
  refreshConnectionPicker(key);
}

export function refreshConnectionGroupPickerOptions(
  key,
  selectedValues = null,
) {
  refreshConnectionGroupsForPicker(key, selectedValues);
}

export function getConnectionLabelValues(key) {
  return connectionPickerValues(key);
}

export function getConnectionGroupValues(key) {
  return connectionPickerValues(key);
}

export function setConnectionVarsValue(key, vars = {}) {
  const varsKey = normalizeConnectionVarsKey(key);
  const normalizedConnectionVars = setConnectionVarsState(varsKey, vars);
  const connectionVarRows = normalizeConnectionVarRows(
    varsKey,
    normalizedConnectionVars,
  );
  connectionVarsStoreFor(varsKey).update((state) => ({
    ...state,
    connectionVarRows,
    connectionVars: normalizedConnectionVars,
    hasConnectionVarRows: connectionVarRows.length > 0,
    version: (state?.version || 0) + 1,
  }));
  return normalizedConnectionVars;
}

export function getConnectionVarsValue(key) {
  const varsKey = normalizeConnectionVarsKey(key);
  const connectionVarRows =
    getStore(connectionVarsStoreFor(varsKey)).connectionVarRows || [];
  const connectionVars = connectionVarRowsToConnectionVars(connectionVarRows, {
    strict: true,
  });
  setConnectionVarsState(varsKey, connectionVars);
  return connectionVars;
}

export const connectionVarsState = (key) => connectionVarsStoreFor(key);

function connectionVarRowPresentation(connectionVarRow = {}) {
  const type = displayString(connectionVarRow.type || "string");
  return {
    ...connectionVarRow,
    disableValueInput: type === "null",
    showBooleanSelect: type === "boolean",
    valueInputValue:
      type === "boolean" && connectionVarRow.value !== "true"
        ? "false"
        : connectionVarRow.value,
  };
}

export function connectionVarRowsForState(connectionVarsState = {}) {
  const connectionVarRows = Array.isArray(connectionVarsState.connectionVarRows)
    ? connectionVarsState.connectionVarRows
    : [];
  return connectionVarRows.map(connectionVarRowPresentation);
}

export function addConnectionVarsRow(key) {
  const varsKey = normalizeConnectionVarsKey(key);
  const connectionVarRows =
    getStore(connectionVarsStoreFor(varsKey)).connectionVarRows || [];
  const idPrefix = connectionVarsRowKeyPrefix(varsKey);
  setConnectionVarRows(varsKey, [
    ...connectionVarRows,
    {
      id: `${idPrefix}-${Date.now()}-${connectionVarRows.length}`,
      name: "",
      type: "string",
      value: "",
    },
  ]);
}

export function removeConnectionVarsRow(key, id) {
  const varsKey = normalizeConnectionVarsKey(key);
  const connectionVarRows =
    getStore(connectionVarsStoreFor(varsKey)).connectionVarRows || [];
  setConnectionVarRows(
    varsKey,
    connectionVarRows.filter((connectionVarRow) => connectionVarRow.id !== id),
  );
}

export const setConnectionVarRowName = (key, id, connectionVarName = "") =>
  applyConnectionVarsRowPatch(key, id, {
    name: displayString(connectionVarName || ""),
  });

export const setConnectionVarRowType = (key, id, connectionVarType = "") =>
  applyConnectionVarsRowPatch(key, id, {
    type: displayString(connectionVarType || ""),
  });

export const setConnectionVarRowValue = (key, id, connectionVarValue = "") =>
  applyConnectionVarsRowPatch(key, id, {
    value: displayString(connectionVarValue || ""),
  });
