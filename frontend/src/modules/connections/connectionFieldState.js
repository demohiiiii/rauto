import { derived, get as getStore, writable } from "svelte/store";
import {
  blurEventTarget,
  callbackHandler,
  callIfFunction,
  eventContainsRelatedTarget,
  eventKeyIn,
  eventKeyIs,
  preventEventDefault,
} from "../../lib/events.js";
import { currentLanguageState, t, tr } from "../../lib/i18n.js";
import {
  displayString,
  safeString,
  selectOptionsWithCurrent,
} from "../../lib/ui.js";
import {
  addConnectionPickerSelection,
  addConnectionVarsRow,
  commitConnectionPickerSelection,
  connectionPickerChoices,
  connectionPickerCommitKeys,
  connectionPickerState,
  connectionPickerValues,
  connectionProfileSelectState,
  connectionVarRowsForState,
  connectionVarsState,
  CONNECTION_PICKER,
  CONNECTION_PROFILE_SELECT,
  CONNECTION_VARS,
  getConnectionGroupValues,
  getConnectionLabelValues,
  getConnectionVarsValue,
  hideConnectionPickerMenu,
  openConnectionPickerMenu,
  refreshConnectionGroupPickerOptions,
  refreshConnectionPickerOptions,
  refreshConnectionPickerSelected,
  refreshSavedConnectionGroupOptions,
  refreshSavedConnectionLabelOptions,
  removeConnectionPickerSelection,
  removeConnectionVarsRow,
  setConnectionDeviceProfiles,
  setConnectionInventorySnapshots,
  setConnectionPickerQueryValue,
  setConnectionPickerSavedConnections,
  setConnectionPickerSelectedValues,
  setConnectionVarRowName,
  setConnectionVarRowType,
  setConnectionVarRowValue,
  setConnectionVarsValue,
  setShowObjectPickerOptions,
  showObjectOptionMeta,
} from "./connectionFieldStoreState.js";

export {
  CONNECTION_PICKER,
  CONNECTION_PROFILE_SELECT,
  CONNECTION_VARS,
  connectionPickerState,
  connectionPickerValues,
  connectionProfileSelectState,
  connectionVarsState,
  getConnectionGroupValues,
  getConnectionLabelValues,
  getConnectionVarsValue,
  hideConnectionPickerMenu,
  refreshConnectionGroupPickerOptions,
  refreshConnectionPickerOptions,
  refreshConnectionPickerSelected,
  refreshSavedConnectionGroupOptions,
  refreshSavedConnectionLabelOptions,
  setConnectionDeviceProfiles,
  setConnectionInventorySnapshots,
  setConnectionPickerSavedConnections,
  setConnectionPickerSelectedValues,
  setConnectionVarsValue,
  setShowObjectPickerOptions,
  showObjectOptionMeta,
} from "./connectionFieldStoreState.js";
const CONNECTION_VAR_TYPE_OPTIONS = Object.freeze([
  ["string", "connectionVarTypeString"],
  ["number", "connectionVarTypeNumber"],
  ["boolean", "connectionVarTypeBoolean"],
  ["null", "connectionVarTypeNull"],
]);
const CONNECTION_VAR_BOOLEAN_OPTIONS = Object.freeze(["true", "false"]);
const SSH_SECURITY_OPTION_DEFS = Object.freeze([
  ["", "sshSecurityOptionDefault"],
  ["secure", "sshSecurityOptionSecure"],
  ["balanced", "sshSecurityOptionBalanced"],
  ["legacy-compatible", "sshSecurityOptionLegacy"],
]);
const LINUX_SHELL_OPTION_DEFS = Object.freeze([
  ["", "linuxShellOptionDefault"],
  ["posix", "linuxShellOptionPosix"],
  ["fish", "linuxShellOptionFish"],
]);
const SAVED_CONNECTION_EDITOR_DRAFT_FIELDS = [
  ["name", "name"],
  ["host", "host"],
  ["port", "port"],
  ["connect_timeout_secs", "connectTimeoutSecs"],
  ["username", "username"],
  ["password", "password"],
  ["enable_password", "enablePassword"],
  ["ssh_security", "sshSecurity"],
  ["linux_shell_flavor", "linuxShellFlavor"],
  ["device_profile", "deviceProfile"],
];
const TEMPORARY_CONNECTION_DRAFT_FIELDS = [
  ["host", "host"],
  ["port", "port"],
  ["connect_timeout_secs", "connectTimeoutSecs"],
  ["username", "username"],
  ["password", "password"],
  ["enable_password", "enablePassword"],
  ["ssh_security", "sshSecurity"],
  ["linux_shell_flavor", "linuxShellFlavor"],
  ["device_profile", "deviceProfile"],
];

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function connectionInputDisplay(labelKey) {
  const labelText = tr(labelKey, labelKey);
  return {
    ariaLabelText: labelText,
    placeholder: labelText,
  };
}

function connectionSelectOption(optionValue, labelKey) {
  return {
    optionLabel: tr(labelKey, optionValue || labelKey),
    optionValue,
  };
}

function connectionDraftDefaults(overrides = {}) {
  return {
    connectTimeoutSecs: "",
    deviceProfile: "",
    enabled: true,
    enablePassword: "",
    host: "",
    linuxShellFlavor: "",
    password: "",
    port: "",
    sshSecurity: "",
    username: "",
    ...overrides,
  };
}

function connectionDraftPatchFromValues(formValues = {}, fields = []) {
  const patch = {};
  fields.forEach(([sourceKey, draftKey]) => {
    if (hasOwn(formValues, sourceKey)) {
      patch[draftKey] = displayString(formValues[sourceKey] || "");
    }
  });
  if (hasOwn(formValues, "enabled")) {
    patch.enabled = formValues.enabled !== false;
  }
  return patch;
}

function applyConnectionDraftPatch(draft = {}, patch = {}) {
  Object.entries(patch).forEach(([draftField, draftValue]) => {
    draft[draftField] = draftValue;
  });
}

export function connectionBasicFieldsPresentation({
  deviceProfileOptions = [],
  fieldValues = {},
  focusHostRequestVersion = 0,
} = {}) {
  const profileOptions = Array.isArray(deviceProfileOptions)
    ? deviceProfileOptions
    : [];
  const sshSecurityTitle = tr("sshSecurityOptionDefault");
  const linuxShellTitle = tr("linuxShellOptionDefault");
  const deviceProfileTitle = tr("deviceProfilePlaceholder");
  return {
    connectTimeoutSecsInput: connectionInputDisplay(
      "connectTimeoutSecsPlaceholder",
    ),
    deviceProfileSelect: {
      ariaLabelText: deviceProfileTitle,
      deviceProfileOptionRows: [
        { optionLabel: deviceProfileTitle, optionValue: "" },
        ...profileOptions.map((deviceProfileOption) => ({
          optionLabel: deviceProfileOption,
          optionValue: deviceProfileOption,
        })),
      ],
      title: deviceProfileTitle,
    },
    enablePasswordInput: connectionInputDisplay("enablePasswordPlaceholder"),
    focusHostRequestVersion,
    hostInput: connectionInputDisplay("hostPlaceholder"),
    linuxShellFlavorSelect: {
      ariaLabelText: linuxShellTitle,
      linuxShellOptionRows: LINUX_SHELL_OPTION_DEFS.map(
        ([optionValue, labelKey]) =>
          connectionSelectOption(optionValue, labelKey),
      ),
      title: linuxShellTitle,
    },
    passwordInput: connectionInputDisplay("passwordPlaceholder"),
    portInput: connectionInputDisplay("portPlaceholder"),
    sshSecuritySelect: {
      ariaLabelText: sshSecurityTitle,
      sshSecurityOptionRows: SSH_SECURITY_OPTION_DEFS.map(
        ([optionValue, labelKey]) =>
          connectionSelectOption(optionValue, labelKey),
      ),
      title: sshSecurityTitle,
    },
    usernameInput: connectionInputDisplay("usernamePlaceholder"),
    values: {
      connectTimeoutSecs: displayString(fieldValues.connectTimeoutSecs),
      deviceProfile: displayString(fieldValues.deviceProfile),
      enablePassword: displayString(fieldValues.enablePassword),
      host: displayString(fieldValues.host),
      linuxShellFlavor: displayString(fieldValues.linuxShellFlavor),
      password: displayString(fieldValues.password),
      port: displayString(fieldValues.port),
      sshSecurity: displayString(fieldValues.sshSecurity),
      username: displayString(fieldValues.username),
    },
  };
}

export function savedConnectionEditorDraftDefaults() {
  return connectionDraftDefaults({ name: "" });
}

export function temporaryConnectionDraftDefaults() {
  return connectionDraftDefaults({ deviceProfile: "autodetect" });
}

export function applySavedConnectionEditorDraftFromFormState(
  draft = {},
  formState = {},
) {
  applyConnectionDraftPatch(
    draft,
    connectionDraftPatchFromValues(
      formState,
      SAVED_CONNECTION_EDITOR_DRAFT_FIELDS,
    ),
  );
}

export function applyTemporaryConnectionDraftFromFormState(
  draft = {},
  formState = {},
) {
  const patch = connectionDraftPatchFromValues(
    formState,
    TEMPORARY_CONNECTION_DRAFT_FIELDS,
  );
  if (hasOwn(patch, "deviceProfile") && !patch.deviceProfile) {
    patch.deviceProfile = "autodetect";
  }
  applyConnectionDraftPatch(draft, patch);
}

export function visibleConnectionProfileOptions(profiles = [], selected = "") {
  const profileRows = (Array.isArray(profiles) ? profiles : []).filter(Boolean);
  const current = displayString(selected || "").trim();
  return selectOptionsWithCurrent(profileRows, current);
}

export function connectionBasicFieldWiring(
  draft = {},
  applyDraftChange = null,
  fieldCfg = {},
) {
  const text = (fieldValue) => displayString(fieldValue || "");
  const update = (patch, effect = "") =>
    typeof applyDraftChange === "function"
      ? applyDraftChange(draft, patch, effect)
      : undefined;
  return {
    onDeviceProfileChange: (fieldValue) =>
      update(
        {
          deviceProfile: fieldCfg.defaultDeviceProfile
            ? text(fieldValue) || "autodetect"
            : text(fieldValue),
        },
        fieldCfg.deviceProfileEffect || "",
      ),
    onConnectTimeoutSecsInput: (fieldValue) =>
      update({ connectTimeoutSecs: text(fieldValue) }),
    onEnablePasswordInput: (fieldValue) =>
      update({ enablePassword: text(fieldValue) }),
    onHostInput: (fieldValue) => update({ host: text(fieldValue) }),
    onLinuxShellFlavorChange: (fieldValue) =>
      update({ linuxShellFlavor: text(fieldValue) }),
    onNameInput: (fieldValue) => update({ name: text(fieldValue) }),
    onPasswordInput: (fieldValue) => update({ password: text(fieldValue) }),
    onPortInput: (fieldValue) => update({ port: text(fieldValue) }),
    onSshSecurityChange: (fieldValue) =>
      update({ sshSecurity: text(fieldValue) }),
    onUsernameInput: (fieldValue) => update({ username: text(fieldValue) }),
  };
}

export function connectionTimeoutSecsValue(fieldValue = "") {
  const rawValue = displayString(fieldValue).trim();
  if (!rawValue) return null;
  const timeoutSecs = Number(rawValue);
  if (!Number.isSafeInteger(timeoutSecs) || timeoutSecs <= 0) {
    throw new Error(t("connectTimeoutSecsInvalid"));
  }
  return timeoutSecs;
}

export function connectionMetadataFieldsPresentation() {
  return {
    groupsPicker: {
      labelText: tr("inventoryFieldGroups"),
      pickerPlaceholder: tr("connectionGroupsPickerPlaceholder"),
    },
    labelsPicker: {
      labelText: tr("inventoryFieldLabels"),
      pickerPlaceholder: tr("connectionLabelsPickerPlaceholder"),
    },
  };
}

function connectionPickerFieldPresentation(
  state = {},
  choices = {},
  { labelText = "", pickerPlaceholder = "" } = {},
) {
  const selectedValues = Array.isArray(state.values) ? state.values : [];
  const normalizedQuery = displayString(choices.normalizedQuery || "");
  const placeholder = displayString(pickerPlaceholder);
  return {
    addCustomLabel: tr("connectionLabelsAddCustom"),
    canAddCustom: !!choices.canAddCustom,
    canRemoveLastOnBackspace: !normalizedQuery && selectedValues.length > 0,
    pickerField: {
      ariaLabelText: displayString(pickerPlaceholder, labelText),
      placeholder,
    },
    lastSelectedValue: selectedValues[selectedValues.length - 1] || "",
    noMatchText: tr("connectionPickerNoMatch"),
    normalizedQuery,
    open: !!state.open,
    optionRows: choices.optionRows || [],
    query: displayString(state.query || ""),
    removeItemLabel: tr("connectionPickerRemoveItem"),
    selectedRows: selectedValues.map((selectedValue) => ({
      selectedValue,
    })),
    showNoMatch: choices.showNoMatch,
    showObjectMenu: !!choices.showObjectMenu,
  };
}

export function createConnectionPickerFieldWorkspace() {
  const pickerFieldInputStateStore = writable({
    keyName: "",
    labelText: "",
    pickerPlaceholder: "",
  });
  const callbackInputsStateStore = writable({
    active: true,
    onSelectionChange: null,
  });
  const pickerStateSnapshotStore = writable({});
  const pickerDisplayStateStore = derived(
    [
      pickerFieldInputStateStore,
      pickerStateSnapshotStore,
      currentLanguageState,
    ],
    ([
      $pickerFieldInputStateStore,
      $pickerStateSnapshotStore,
      _currentLanguageState,
    ]) =>
      connectionPickerFieldPresentation(
        $pickerStateSnapshotStore,
        connectionPickerChoices(
          $pickerFieldInputStateStore.keyName,
          $pickerStateSnapshotStore,
        ),
        {
          labelText: $pickerFieldInputStateStore.labelText,
          pickerPlaceholder: $pickerFieldInputStateStore.pickerPlaceholder,
        },
      ),
    connectionPickerFieldPresentation({}, {}, {}),
  );
  const commitKeysStateStore = derived(
    pickerFieldInputStateStore,
    ($pickerFieldInputStateStore) =>
      connectionPickerCommitKeys($pickerFieldInputStateStore.keyName),
  );
  function currentPickerFieldActionHandlers() {
    const callbackInputs = getStore(callbackInputsStateStore);
    const pickerDisplay = getStore(pickerDisplayStateStore);
    const pickerFieldInputState = getStore(pickerFieldInputStateStore);
    return connectionPickerFieldActionHandlers({
      active: callbackInputs.active,
      commitKeys: getStore(commitKeysStateStore),
      keyName: pickerFieldInputState.keyName,
      onSelectionChange: callbackInputs.onSelectionChange,
      pickerDisplay,
    });
  }

  function addPickerValueAction(pickerValue = "") {
    return currentPickerFieldActionHandlers().addPickerValueAction(pickerValue);
  }

  function handleFocusOut(event) {
    return currentPickerFieldActionHandlers().focusOutHandler()(event);
  }

  function handleKeydown(event) {
    return currentPickerFieldActionHandlers().keydownHandler()(event);
  }

  function handleQueryInput(queryText = "") {
    return currentPickerFieldActionHandlers().queryInputHandler()(queryText);
  }

  function openPicker() {
    return currentPickerFieldActionHandlers().openPickerHandler()();
  }

  function removePickerValueAction(pickerValue = "") {
    return currentPickerFieldActionHandlers().removePickerValueAction(
      pickerValue,
    );
  }

  function setFieldContext({
    active = true,
    keyName = "",
    labelText = "",
    onSelectionChange = null,
    pickerPlaceholder = "",
    pickerState = {},
  } = {}) {
    pickerFieldInputStateStore.set({
      keyName,
      labelText,
      pickerPlaceholder,
    });
    pickerStateSnapshotStore.set(pickerState || {});
    callbackInputsStateStore.set({
      active: !!active,
      onSelectionChange,
    });
  }

  return {
    addPickerValueAction,
    commitKeysStateStore,
    handleFocusOut,
    handleKeydown,
    handleQueryInput,
    openPicker,
    pickerDisplayStateStore,
    removePickerValueAction,
    setFieldContext,
  };
}

function connectionVarsFieldPresentation({
  connectionVarRows = [],
  hasConnectionVarRows = false,
  labelTextKey = "inventoryFieldVars",
} = {}) {
  return {
    addButtonText: tr("addInlineBtn", "Add"),
    booleanValueOptions: CONNECTION_VAR_BOOLEAN_OPTIONS,
    connectionVarRows: Array.isArray(connectionVarRows)
      ? connectionVarRows
      : [],
    deleteLabel: tr("delete", "Delete"),
    emptyText: tr("connectionVarsEmpty", "No vars configured."),
    hasConnectionVarRows: !!hasConnectionVarRows,
    labelText: tr(labelTextKey, "Vars"),
    namePlaceholder: tr("connectionVarKeyPlaceholder", "key"),
    typeLabel: tr("connectionVarTypeLabel", "Type"),
    typeOptionRows: CONNECTION_VAR_TYPE_OPTIONS.map(
      ([typeValue, labelKey]) => ({
        labelText: tr(labelKey, typeValue),
        typeValue,
      }),
    ),
    valuePlaceholder: tr("connectionVarValuePlaceholder", "value"),
  };
}

export function createConnectionVarsFieldWorkspace() {
  const varsFieldInputStateStore = writable({
    labelTextKey: "inventoryFieldVars",
    keyName: "",
  });
  const varsStateSnapshotStore = writable({});
  let lastNotifiedVarsVersion = 0;
  const varsDisplayStateStore = derived(
    [varsFieldInputStateStore, varsStateSnapshotStore, currentLanguageState],
    ([
      $varsFieldInputStateStore,
      $varsStateSnapshotStore,
      _currentLanguageState,
    ]) =>
      connectionVarsFieldPresentation({
        connectionVarRows: connectionVarRowsForState($varsStateSnapshotStore),
        hasConnectionVarRows: $varsStateSnapshotStore.hasConnectionVarRows,
        labelTextKey: $varsFieldInputStateStore.labelTextKey,
      }),
  );

  function currentActionHandlers() {
    return connectionVarsFieldActionHandlers({
      keyName: getStore(varsFieldInputStateStore).keyName,
    });
  }

  function setFieldContext({
    active = true,
    keyName = "",
    labelTextKey = "inventoryFieldVars",
    onVarsChange = null,
    varsState = {},
  } = {}) {
    varsFieldInputStateStore.set({
      keyName,
      labelTextKey,
    });
    varsStateSnapshotStore.set(varsState || {});
    if (!active || typeof onVarsChange !== "function") return;
    const version = varsState.version || 0;
    if (version !== lastNotifiedVarsVersion) {
      lastNotifiedVarsVersion = version;
      onVarsChange(varsState.connectionVars);
    }
  }

  return {
    addVarRowAction() {
      return currentActionHandlers().addVarRowHandler()();
    },
    connectionVarNameHandler(connectionVarRow = {}) {
      return currentActionHandlers().connectionVarNameHandler(connectionVarRow);
    },
    connectionVarTypeHandler(connectionVarRow = {}) {
      return currentActionHandlers().connectionVarTypeHandler(connectionVarRow);
    },
    connectionVarValueHandler(connectionVarRow = {}) {
      return currentActionHandlers().connectionVarValueHandler(
        connectionVarRow,
      );
    },
    removeVarRowHandler(connectionVarRow = {}) {
      return currentActionHandlers().removeVarRowHandler(connectionVarRow);
    },
    setFieldContext,
    varsDisplayStateStore,
  };
}

function connectionVarsFieldInputHandlers({ keyName = "" } = {}) {
  return {
    addVarRowHandler() {
      return callbackHandler(addConnectionVarsRow, keyName);
    },
    connectionVarNameHandler(connectionVarRow = {}) {
      return callbackHandler(
        setConnectionVarRowName,
        keyName,
        connectionVarRow.id,
      );
    },
    connectionVarTypeHandler(connectionVarRow = {}) {
      return callbackHandler(
        setConnectionVarRowType,
        keyName,
        connectionVarRow.id,
      );
    },
    connectionVarValueHandler(connectionVarRow = {}) {
      return callbackHandler(
        setConnectionVarRowValue,
        keyName,
        connectionVarRow.id,
      );
    },
    removeVarRowHandler(connectionVarRow = {}) {
      return callbackHandler(
        removeConnectionVarsRow,
        keyName,
        connectionVarRow.id,
      );
    },
  };
}

function connectionVarsFieldActionHandlers(options = {}) {
  const inputHandlers = connectionVarsFieldInputHandlers(options);
  return {
    addVarRowHandler: inputHandlers.addVarRowHandler,
    connectionVarNameHandler: inputHandlers.connectionVarNameHandler,
    connectionVarTypeHandler: inputHandlers.connectionVarTypeHandler,
    connectionVarValueHandler: inputHandlers.connectionVarValueHandler,
    removeVarRowHandler: inputHandlers.removeVarRowHandler,
  };
}

function notifyConnectionPickerSelectionChange({
  active = true,
  keyName = "",
  onSelectionChange = null,
} = {}) {
  if (!active) return;
  callIfFunction(onSelectionChange, connectionPickerValues(keyName));
}

function connectionPickerFieldInputHandlers({
  active = true,
  commitKeys = [],
  keyName = "",
  onSelectionChange = null,
  pickerDisplay = {},
} = {}) {
  function notifySelectionChange() {
    notifyConnectionPickerSelectionChange({
      active,
      keyName,
      onSelectionChange,
    });
  }

  return {
    addPickerValueAction(pickerValue = "") {
      return () => {
        if (!active) return;
        if (addConnectionPickerSelection(keyName, pickerValue)) {
          openConnectionPickerMenu(keyName);
          notifySelectionChange();
        }
      };
    },
    closePickerHandler() {
      return callbackHandler(hideConnectionPickerMenu, keyName);
    },
    focusOutHandler() {
      return (event) => {
        if (!eventContainsRelatedTarget(event)) {
          hideConnectionPickerMenu(keyName);
        }
      };
    },
    keydownHandler() {
      return (event) => {
        if (!active) return;
        if (eventKeyIs(event, "Escape")) {
          hideConnectionPickerMenu(keyName);
          blurEventTarget(event);
          return;
        }
        if (
          eventKeyIs(event, "Backspace") &&
          pickerDisplay.canRemoveLastOnBackspace
        ) {
          preventEventDefault(event);
          removeConnectionPickerSelection(
            keyName,
            pickerDisplay.lastSelectedValue,
          );
          notifySelectionChange();
          return;
        }
        if (eventKeyIn(event, commitKeys)) {
          preventEventDefault(event);
          if (
            commitConnectionPickerSelection(
              keyName,
              pickerDisplay.normalizedQuery,
            )
          ) {
            notifySelectionChange();
          }
          openConnectionPickerMenu(keyName);
        }
      };
    },
    openPickerHandler() {
      return () => {
        if (!active) return;
        openConnectionPickerMenu(keyName);
      };
    },
    queryInputHandler() {
      return (queryText = "") => {
        if (!active) return;
        setConnectionPickerQueryValue(keyName, queryText);
        openConnectionPickerMenu(keyName);
      };
    },
    removePickerValueAction(pickerValue = "") {
      return () => {
        if (!active) return;
        removeConnectionPickerSelection(keyName, pickerValue);
        notifySelectionChange();
      };
    },
  };
}

function connectionPickerFieldActionHandlers(options = {}) {
  const inputHandlers = connectionPickerFieldInputHandlers(options);
  return {
    addPickerValueAction: inputHandlers.addPickerValueAction,
    closePickerHandler: inputHandlers.closePickerHandler,
    focusOutHandler: inputHandlers.focusOutHandler,
    keydownHandler: inputHandlers.keydownHandler,
    openPickerHandler: inputHandlers.openPickerHandler,
    queryInputHandler: inputHandlers.queryInputHandler,
    removePickerValueAction: inputHandlers.removePickerValueAction,
  };
}
