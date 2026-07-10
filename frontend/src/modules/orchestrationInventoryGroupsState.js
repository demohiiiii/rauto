import {
  derived as deriveStore,
  get as getStore,
  writable,
} from "svelte/store";
import { callIfFunction } from "../lib/events.js";
import { currentLanguageState } from "../lib/i18n.js";
import {
  orchestrationCloneFormModel,
  orchestrationExtraStringPresenceChangeHandler,
  orchestrationExtraStringValueChangeHandler,
  orchestrationJsonObjectPatchResult,
  orchestrationNullableFieldModePatch,
  orchestrationNormalizeConnectionPatch,
  orchestrationPatchPresenceChangeHandler,
  orchestrationPatchValueChangeHandler,
  orchestrationToggleNullableFieldPresence,
  orchestrationToggleObjectFieldPresence,
} from "./orchestrationForms.js";
import {
  orchestrationInventoryGroupSettingsDisplay,
  orchestrationInventoryPanelDisplay,
} from "./orchestrationFormDisplayState.js";
import {
  orchestrationCreateInventoryGroupModel,
  orchestrationCreateInventoryModel,
  orchestrationDefaultTargetDefaultsModel,
  orchestrationInventoryFormModel,
  createOrchestrationInventoryPanelDisplayWorkspace,
} from "./orchestrationInventoryDefaultsState.js";

function orchestrationNextInventoryGroupName(groups = []) {
  const usedNames = new Set(
    (Array.isArray(groups) ? groups : []).map((group) => `${group.name || ""}`),
  );
  let index = 1;
  while (usedNames.has(`group${index}`)) index += 1;
  return `group${index}`;
}

export function orchestrationAddInventoryGroup(model) {
  const next = orchestrationCloneFormModel(model);
  next.hasInventory = true;
  next.inventory = orchestrationInventoryFormModel(next.inventory || {});
  next.inventory.groups = Array.isArray(next.inventory.groups)
    ? next.inventory.groups
    : [];
  next.inventory.groups.push(
    orchestrationCreateInventoryGroupModel(
      orchestrationNextInventoryGroupName(next.inventory.groups),
      { targets: [] },
    ),
  );
  next.inventory.hasGroups = true;
  return next;
}

export function orchestrationRemoveInventoryGroup(model, groupIndex) {
  const next = orchestrationCloneFormModel(model);
  next.hasInventory = true;
  next.inventory = orchestrationInventoryFormModel(next.inventory || {});
  next.inventory.groups = Array.isArray(next.inventory.groups)
    ? next.inventory.groups
    : [];
  next.inventory.groups.splice(groupIndex, 1);
  next.inventory.hasGroups = true;
  return next;
}

export function orchestrationPatchInventoryGroup(
  model,
  groupIndex,
  patch = {},
) {
  const next = orchestrationCloneFormModel(model);
  next.hasInventory = true;
  next.inventory = orchestrationInventoryFormModel(next.inventory || {});
  next.inventory.groups = Array.isArray(next.inventory.groups)
    ? next.inventory.groups
    : [];
  const currentGroup =
    next.inventory.groups[groupIndex] ||
    orchestrationCreateInventoryGroupModel();
  next.inventory.groups[groupIndex] = {
    ...currentGroup,
    ...patch,
    name: Object.hasOwn(patch, "name")
      ? `${patch.name ?? ""}`
      : currentGroup.name,
    useDetailed: Object.hasOwn(patch, "useDetailed")
      ? !!patch.useDetailed
      : currentGroup.useDetailed,
    hasDefaults: Object.hasOwn(patch, "hasDefaults")
      ? !!patch.hasDefaults
      : Object.hasOwn(patch, "defaults")
        ? true
        : currentGroup.hasDefaults,
    hasTargets: Object.hasOwn(patch, "hasTargets")
      ? !!patch.hasTargets
      : Object.hasOwn(patch, "targets")
        ? true
        : currentGroup.hasTargets,
  };
  next.inventory.hasGroups = true;
  return next;
}

export function orchestrationPatchInventoryGroupDefaults(
  model,
  groupIndex,
  patch = {},
) {
  const next = orchestrationCloneFormModel(model);
  next.hasInventory = true;
  next.inventory = orchestrationInventoryFormModel(next.inventory || {});
  next.inventory.groups = Array.isArray(next.inventory.groups)
    ? next.inventory.groups
    : [];
  const currentGroup =
    next.inventory.groups[groupIndex] ||
    orchestrationCreateInventoryGroupModel();
  const currentDefaults =
    currentGroup.defaults || orchestrationDefaultTargetDefaultsModel();
  const normalizedPatch = orchestrationNormalizeConnectionPatch(patch);
  const nextDefaults = {
    ...currentDefaults,
    ...normalizedPatch,
  };
  nextDefaults.vars = Object.hasOwn(patch, "vars")
    ? structuredClone(patch.vars)
    : currentDefaults.vars;
  nextDefaults.hasUsername = Object.hasOwn(patch, "username")
    ? true
    : currentDefaults.hasUsername;
  nextDefaults.hasPassword = Object.hasOwn(patch, "password")
    ? true
    : currentDefaults.hasPassword;
  nextDefaults.hasPort = Object.hasOwn(patch, "port")
    ? true
    : currentDefaults.hasPort;
  nextDefaults.hasEnablePassword = Object.hasOwn(patch, "enablePassword")
    ? true
    : currentDefaults.hasEnablePassword;
  nextDefaults.hasSshSecurity = Object.hasOwn(patch, "sshSecurity")
    ? true
    : currentDefaults.hasSshSecurity;
  nextDefaults.hasLinuxShellFlavor = Object.hasOwn(patch, "linuxShellFlavor")
    ? true
    : currentDefaults.hasLinuxShellFlavor;
  nextDefaults.hasDeviceProfile = Object.hasOwn(patch, "deviceProfile")
    ? true
    : currentDefaults.hasDeviceProfile;
  nextDefaults.hasTemplateDir = Object.hasOwn(patch, "templateDir")
    ? true
    : currentDefaults.hasTemplateDir;
  nextDefaults.hasVars = Object.hasOwn(patch, "vars")
    ? true
    : currentDefaults.hasVars;
  next.inventory.groups[groupIndex] = {
    ...currentGroup,
    defaults: nextDefaults,
    hasDefaults: true,
  };
  next.inventory.hasGroups = true;
  return next;
}

export function orchestrationInventoryGroupDefaultsVarsUpdateResult(
  model,
  groupIndex,
  varsText,
) {
  return orchestrationJsonObjectPatchResult(model, varsText, (parsedVars) =>
    orchestrationPatchInventoryGroupDefaults(model, groupIndex, {
      vars: parsedVars,
    }),
  );
}

export function orchestrationSetInventoryGroupDefaultsFieldPresence(
  model,
  groupIndex,
  field,
  enabled,
) {
  const next = orchestrationCloneFormModel(model);
  next.hasInventory = true;
  next.inventory = orchestrationInventoryFormModel(next.inventory || {});
  next.inventory.groups = Array.isArray(next.inventory.groups)
    ? next.inventory.groups
    : [];
  const currentGroup =
    next.inventory.groups[groupIndex] ||
    orchestrationCreateInventoryGroupModel();
  const currentDefaults =
    currentGroup.defaults || orchestrationDefaultTargetDefaultsModel();
  next.inventory.groups[groupIndex] = {
    ...currentGroup,
    defaults: orchestrationToggleNullableFieldPresence(
      currentDefaults,
      field,
      enabled,
    ),
    hasDefaults: true,
  };
  next.inventory.hasGroups = true;
  return next;
}

export function orchestrationSetInventoryGroupDefaultsVarsPresence(
  model,
  groupIndex,
  enabled,
) {
  const next = orchestrationCloneFormModel(model);
  next.hasInventory = true;
  next.inventory = orchestrationInventoryFormModel(next.inventory || {});
  next.inventory.groups = Array.isArray(next.inventory.groups)
    ? next.inventory.groups
    : [];
  const currentGroup =
    next.inventory.groups[groupIndex] ||
    orchestrationCreateInventoryGroupModel();
  const currentDefaults =
    currentGroup.defaults || orchestrationDefaultTargetDefaultsModel();
  next.inventory.groups[groupIndex] = {
    ...currentGroup,
    defaults: orchestrationToggleObjectFieldPresence(
      currentDefaults,
      "vars",
      enabled,
    ),
    hasDefaults: true,
  };
  next.inventory.hasGroups = true;
  return next;
}

export function orchestrationInventoryGroupSettingsBindings(
  model,
  groupIndex,
  onChange,
) {
  const applyChange = (nextModel) =>
    typeof onChange === "function" ? onChange(nextModel) : undefined;
  return {
    setDefaultField(fieldKey, fieldValue) {
      applyChange(
        orchestrationPatchInventoryGroupDefaults(model, groupIndex, {
          [fieldKey]: fieldValue,
        }),
      );
    },
    setDefaultsExtra(extra) {
      applyChange(
        orchestrationPatchInventoryGroupDefaults(model, groupIndex, { extra }),
      );
    },
    setDefaultsVars(vars) {
      applyChange(
        orchestrationPatchInventoryGroupDefaults(model, groupIndex, { vars }),
      );
    },
    setDefaultFieldMode(fieldKey, mode) {
      applyChange(
        orchestrationPatchInventoryGroupDefaults(
          model,
          groupIndex,
          orchestrationNullableFieldModePatch(
            model?.inventory?.groups?.[groupIndex]?.defaults ||
              orchestrationDefaultTargetDefaultsModel(),
            fieldKey,
            mode,
          ),
        ),
      );
    },
    setDefaultFieldPresence(fieldKey, enabled) {
      applyChange(
        orchestrationSetInventoryGroupDefaultsFieldPresence(
          model,
          groupIndex,
          fieldKey,
          enabled,
        ),
      );
    },
    setDefaultsVarsPresence(enabled) {
      applyChange(
        orchestrationSetInventoryGroupDefaultsVarsPresence(
          model,
          groupIndex,
          enabled,
        ),
      );
    },
    setGroupExtra(extra) {
      applyChange(
        orchestrationPatchInventoryGroup(model, groupIndex, { extra }),
      );
    },
    setGroupName(groupName) {
      applyChange(
        orchestrationPatchInventoryGroup(model, groupIndex, {
          name: groupName,
        }),
      );
    },
    setUseDetailed(useDetailed) {
      applyChange(
        orchestrationPatchInventoryGroup(model, groupIndex, {
          useDetailed,
        }),
      );
    },
  };
}

export function orchestrationSetInventoryEnabled(model, enabled) {
  const next = orchestrationCloneFormModel(model);
  next.hasInventory = !!enabled;
  next.inventory = enabled
    ? next.inventory || orchestrationCreateInventoryModel()
    : null;
  return next;
}

function orchestrationInventoryPanelCallbacks(model, onChange) {
  return {
    addInventoryGroup() {
      return callIfFunction(onChange, orchestrationAddInventoryGroup(model));
    },
    setInventoryEnabledHandler() {
      return (enabled) =>
        callIfFunction(
          onChange,
          orchestrationSetInventoryEnabled(model, enabled),
        );
    },
  };
}

function inventoryObjectOrEmpty(value) {
  return value && typeof value === "object" ? value : {};
}

export function createOrchestrationInventoryPanelWorkspace({
  model = {},
  onChange = null,
} = {}) {
  const modelStateStore = writable(inventoryObjectOrEmpty(model));
  const onChangeStateStore = writable(onChange);
  const inventoryDisplayWorkspace =
    createOrchestrationInventoryPanelDisplayWorkspace({
      model,
    });
  const { inventoryDisplayStateStore, setInventoryDisplayContext } =
    inventoryDisplayWorkspace;
  const inventoryPanelDisplayStateStore = deriveStore(
    [modelStateStore, inventoryDisplayStateStore, currentLanguageState],
    ([$modelStateStore, $inventoryDisplayStateStore]) =>
      orchestrationInventoryPanelDisplay(
        $modelStateStore,
        $inventoryDisplayStateStore,
      ),
  );
  const panelCallbacksStateStore = deriveStore(
    [modelStateStore, onChangeStateStore],
    ([$modelStateStore, $onChangeStateStore]) =>
      orchestrationInventoryPanelCallbacks(
        $modelStateStore,
        $onChangeStateStore,
      ),
  );
  const setInventoryEnabledHandlerStateStore = deriveStore(
    panelCallbacksStateStore,
    ($panelCallbacksStateStore) =>
      $panelCallbacksStateStore.setInventoryEnabledHandler(),
  );
  return {
    inventoryDisplayStateStore,
    inventoryPanelDisplayStateStore,
    panelCallbacksStateStore,
    setInventoryEnabledHandlerStateStore,
    setInventoryPanelContext({
      model: nextModel = {},
      onChange: nextOnChange = null,
    } = {}) {
      modelStateStore.set(inventoryObjectOrEmpty(nextModel));
      onChangeStateStore.set(nextOnChange);
      setInventoryDisplayContext({ model: nextModel });
    },
  };
}

function orchestrationInventoryGroupEditorCallbacks(
  model,
  groupIndex = 0,
  onChange,
) {
  return {
    removeInventoryGroup() {
      return callIfFunction(
        onChange,
        orchestrationRemoveInventoryGroup(model, groupIndex),
      );
    },
  };
}

export function createOrchestrationInventoryGroupEditorWorkspace() {
  const callbackInputsStateStore = writable({
    groupIndex: 0,
    model: {},
    onChange: null,
  });

  function currentActionHandlers() {
    const callbackInputs = getStore(callbackInputsStateStore);
    return orchestrationInventoryGroupEditorCallbacks(
      callbackInputs.model,
      callbackInputs.groupIndex,
      callbackInputs.onChange,
    );
  }

  return {
    removeInventoryGroup() {
      return currentActionHandlers().removeInventoryGroup();
    },
    setInventoryGroupContext({
      groupIndex: nextGroupIndex = 0,
      model: nextModel = {},
      onChange: nextOnChange = null,
    } = {}) {
      callbackInputsStateStore.set({
        groupIndex: Number.isInteger(nextGroupIndex) ? nextGroupIndex : 0,
        model: nextModel,
        onChange: nextOnChange,
      });
    },
  };
}

function orchestrationInventoryGroupSettingsCallbacks(
  model,
  groupIndex,
  defaultsExtraSource,
  groupExtraSource,
  onChange,
  onErrorChange,
) {
  function patchInventoryGroup(patch = {}) {
    return callIfFunction(
      onChange,
      orchestrationPatchInventoryGroup(model, groupIndex, patch),
    );
  }
  function patchInventoryGroupDefaults(patch = {}) {
    return callIfFunction(
      onChange,
      orchestrationPatchInventoryGroupDefaults(model, groupIndex, patch),
    );
  }
  return {
    defaultFieldPresenceHandler(fieldKey) {
      return orchestrationPatchPresenceChangeHandler(onChange, (enabled) =>
        orchestrationSetInventoryGroupDefaultsFieldPresence(
          model,
          groupIndex,
          fieldKey,
          enabled,
        ),
      );
    },
    defaultFieldValueHandler(fieldKey) {
      return orchestrationPatchValueChangeHandler(onChange, (value) =>
        orchestrationPatchInventoryGroupDefaults(model, groupIndex, {
          [fieldKey]: value,
        }),
      );
    },
    defaultFieldNullableModeHandler(fieldKey) {
      return orchestrationPatchValueChangeHandler(onChange, (mode) =>
        orchestrationPatchInventoryGroupDefaults(
          model,
          groupIndex,
          orchestrationNullableFieldModePatch(
            model?.inventory?.groups?.[groupIndex]?.defaults ||
              orchestrationDefaultTargetDefaultsModel(),
            fieldKey,
            mode,
          ),
        ),
      );
    },
    defaultsMetadataPresenceHandler(fieldKey) {
      return orchestrationExtraStringPresenceChangeHandler(
        patchInventoryGroupDefaults,
        defaultsExtraSource,
        fieldKey,
      );
    },
    defaultsMetadataValueHandler(fieldKey) {
      return orchestrationExtraStringValueChangeHandler(
        patchInventoryGroupDefaults,
        defaultsExtraSource,
        fieldKey,
      );
    },
    defaultsVarsPresenceHandler() {
      return orchestrationPatchPresenceChangeHandler(onChange, (enabled) =>
        orchestrationSetInventoryGroupDefaultsVarsPresence(
          model,
          groupIndex,
          enabled,
        ),
      );
    },
    groupMetadataPresenceHandler(fieldKey) {
      return orchestrationExtraStringPresenceChangeHandler(
        patchInventoryGroup,
        groupExtraSource,
        fieldKey,
      );
    },
    groupMetadataValueHandler(fieldKey) {
      return orchestrationExtraStringValueChangeHandler(
        patchInventoryGroup,
        groupExtraSource,
        fieldKey,
      );
    },
    nameValueHandler() {
      return (value) => patchInventoryGroup({ name: value });
    },
    setDefaultsExtra(extra) {
      return patchInventoryGroupDefaults({ extra });
    },
    setDefaultsVars(vars) {
      callIfFunction(onErrorChange, "");
      return patchInventoryGroupDefaults({ vars });
    },
    setGroupExtra(extra) {
      return patchInventoryGroup({ extra });
    },
    useDetailedCheckedHandler() {
      return (enabled) => patchInventoryGroup({ useDetailed: enabled });
    },
  };
}

export function createOrchestrationInventoryGroupSettingsEditorWorkspace() {
  const inputStateStore = writable({
    groupRow: {},
    inventoryDisplay: {},
    model: {},
    onChange: null,
    onErrorChange: null,
  });
  const groupSettingsDisplayStateStore = deriveStore(
    [inputStateStore, currentLanguageState],
    ([$inputStateStore]) =>
      orchestrationInventoryGroupSettingsDisplay($inputStateStore.groupRow, {
        jsonValueTypeRows: $inputStateStore.inventoryDisplay?.jsonValueTypeRows,
      }),
  );
  const groupSettingsCallbacksStateStore = deriveStore(
    [inputStateStore, groupSettingsDisplayStateStore],
    ([$inputStateStore, $groupSettingsDisplayStateStore]) =>
      orchestrationInventoryGroupSettingsCallbacks(
        $inputStateStore.model,
        $inputStateStore.groupRow?.groupIndex,
        $groupSettingsDisplayStateStore.defaultsExtraField.source,
        $groupSettingsDisplayStateStore.groupExtraField.source,
        $inputStateStore.onChange,
        $inputStateStore.onErrorChange,
      ),
  );

  return {
    groupSettingsCallbacksStateStore,
    groupSettingsDisplayStateStore,
    setInventoryGroupSettingsContext({
      groupRow = {},
      inventoryDisplay = {},
      model = {},
      onChange = null,
      onErrorChange = null,
    } = {}) {
      inputStateStore.set({
        groupRow,
        inventoryDisplay,
        model,
        onChange,
        onErrorChange,
      });
    },
  };
}
