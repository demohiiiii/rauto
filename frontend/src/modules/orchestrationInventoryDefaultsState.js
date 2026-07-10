import { derived as deriveStore, writable } from "svelte/store";
import { cloneJsonValue, plainObject, stringValue } from "../lib/jsonValue.js";
import { callIfFunction } from "../lib/events.js";
import { currentLanguageState } from "../lib/i18n.js";
import {
  orchestrationCloneFormModel,
  orchestrationExtraStringPresenceChangeHandler,
  orchestrationExtraStringValueChangeHandler,
  orchestrationJsonObjectPatchResult,
  orchestrationNullableFieldModePatch,
  orchestrationNormalizeConnectionPatch,
  orchestrationObjectExtra,
  orchestrationPatchPresenceChangeHandler,
  orchestrationPatchValueChangeHandler,
  orchestrationTargetDefaultsModelFromJson,
  orchestrationTargetInputModelFromJson,
  orchestrationToggleNullableFieldPresence,
  orchestrationToggleObjectFieldPresence,
} from "./orchestrationForms.js";
import {
  orchestrationInventoryDefaultsSectionDisplay,
  orchestrationJsonFieldText,
} from "./orchestrationFormDisplayState.js";
import { orchestrationInventoryEditorDisplay } from "./orchestrationInventoryDisplayState.js";

const cloneOrchestrationJsonValue = cloneJsonValue;
const orchestrationPlainObject = plainObject;
const orchestrationStringValue = stringValue;

function orchestrationInventoryGroupModelFromJson(name, source = {}) {
  const value = Array.isArray(source)
    ? { targets: source }
    : orchestrationPlainObject(source)
      ? source
      : {};
  const defaults = orchestrationPlainObject(value.defaults)
    ? orchestrationTargetDefaultsModelFromJson(value.defaults)
    : null;
  return {
    name: orchestrationStringValue(name),
    defaults,
    hasDefaults: Object.hasOwn(value, "defaults"),
    targets: Array.isArray(value.targets)
      ? value.targets.map((target) =>
          orchestrationTargetInputModelFromJson(target),
        )
      : [],
    hasTargets: Object.hasOwn(value, "targets") || Array.isArray(source),
    useDetailed:
      !!defaults ||
      (Array.isArray(value.targets) &&
        value.targets.some((target) => typeof target !== "string")),
    extra: orchestrationObjectExtra(value, new Set(["defaults", "targets"])),
  };
}

function orchestrationInventoryModelFromJson(source = {}) {
  const value = orchestrationPlainObject(source) ? source : {};
  return {
    defaults: orchestrationPlainObject(value.defaults)
      ? orchestrationTargetDefaultsModelFromJson(value.defaults)
      : null,
    hasDefaults: Object.hasOwn(value, "defaults"),
    groups: Object.entries(
      orchestrationPlainObject(value.groups) ? value.groups : {},
    ).map(([name, group]) =>
      orchestrationInventoryGroupModelFromJson(name, group),
    ),
    hasGroups: Object.hasOwn(value, "groups"),
    extra: orchestrationObjectExtra(value, new Set(["defaults", "groups"])),
  };
}

export function orchestrationInventoryFormModel(source = {}) {
  const value = orchestrationPlainObject(source) ? source : {};
  if (
    Array.isArray(value.groups) ||
    Object.hasOwn(value, "hasGroups") ||
    Object.hasOwn(value, "hasDefaults") ||
    Object.hasOwn(value, "extra")
  ) {
    return {
      defaults: value.defaults ? structuredClone(value.defaults) : null,
      hasDefaults:
        typeof value.hasDefaults === "boolean"
          ? value.hasDefaults
          : Object.hasOwn(value, "defaults"),
      groups: Array.isArray(value.groups) ? structuredClone(value.groups) : [],
      hasGroups:
        typeof value.hasGroups === "boolean"
          ? value.hasGroups
          : Array.isArray(value.groups),
      extra: orchestrationPlainObject(value.extra)
        ? cloneOrchestrationJsonValue(value.extra, {})
        : {},
    };
  }
  return orchestrationInventoryModelFromJson(source);
}

export function orchestrationDefaultTargetDefaultsModel() {
  return orchestrationTargetDefaultsModelFromJson({});
}

export function orchestrationCreateInventoryModel() {
  return orchestrationInventoryModelFromJson({ groups: {} });
}

export function orchestrationCreateInventoryGroupModel(
  name = "group1",
  source = { targets: [] },
) {
  return orchestrationInventoryGroupModelFromJson(name, source);
}

export function orchestrationInventoryDefaultsVarsUpdateResult(
  model,
  varsText,
) {
  return orchestrationJsonObjectPatchResult(model, varsText, (parsedVars) =>
    orchestrationPatchInventoryDefaults(model, {
      vars: parsedVars,
    }),
  );
}

export function orchestrationPatchInventory(model, patch = {}) {
  const next = orchestrationCloneFormModel(model);
  next.hasInventory = true;
  next.inventory = {
    ...orchestrationInventoryFormModel(next.inventory || {}),
    ...patch,
  };
  return next;
}

export function orchestrationPatchInventoryDefaults(model, patch = {}) {
  const next = orchestrationCloneFormModel(model);
  next.hasInventory = true;
  next.inventory = orchestrationInventoryFormModel(next.inventory || {});
  const currentDefaults =
    next.inventory.defaults || orchestrationDefaultTargetDefaultsModel();
  const normalizedPatch = orchestrationNormalizeConnectionPatch(patch);
  next.inventory.defaults = {
    ...currentDefaults,
    ...normalizedPatch,
    vars: Object.hasOwn(patch, "vars")
      ? cloneOrchestrationJsonValue(patch.vars, {})
      : currentDefaults.vars,
    hasUsername: Object.hasOwn(patch, "username")
      ? true
      : currentDefaults.hasUsername,
    hasPassword: Object.hasOwn(patch, "password")
      ? true
      : currentDefaults.hasPassword,
    hasPort: Object.hasOwn(patch, "port") ? true : currentDefaults.hasPort,
    hasEnablePassword: Object.hasOwn(patch, "enablePassword")
      ? true
      : currentDefaults.hasEnablePassword,
    hasSshSecurity: Object.hasOwn(patch, "sshSecurity")
      ? true
      : currentDefaults.hasSshSecurity,
    hasLinuxShellFlavor: Object.hasOwn(patch, "linuxShellFlavor")
      ? true
      : currentDefaults.hasLinuxShellFlavor,
    hasDeviceProfile: Object.hasOwn(patch, "deviceProfile")
      ? true
      : currentDefaults.hasDeviceProfile,
    hasTemplateDir: Object.hasOwn(patch, "templateDir")
      ? true
      : currentDefaults.hasTemplateDir,
    hasVars: Object.hasOwn(patch, "vars") ? true : currentDefaults.hasVars,
  };
  next.inventory.hasDefaults = true;
  return next;
}

export function orchestrationSetInventoryDefaultsFieldPresence(
  model,
  field,
  enabled,
) {
  const next = orchestrationCloneFormModel(model);
  next.hasInventory = true;
  next.inventory = orchestrationInventoryFormModel(next.inventory || {});
  const defaults =
    next.inventory.defaults || orchestrationDefaultTargetDefaultsModel();
  next.inventory.defaults = orchestrationToggleNullableFieldPresence(
    defaults,
    field,
    enabled,
  );
  next.inventory.hasDefaults = true;
  return next;
}

export function orchestrationSetInventoryDefaultsVarsPresence(model, enabled) {
  const next = orchestrationCloneFormModel(model);
  next.hasInventory = true;
  next.inventory = orchestrationInventoryFormModel(next.inventory || {});
  const defaults =
    next.inventory.defaults || orchestrationDefaultTargetDefaultsModel();
  next.inventory.defaults = orchestrationToggleObjectFieldPresence(
    defaults,
    "vars",
    enabled,
  );
  next.inventory.hasDefaults = true;
  return next;
}

export function orchestrationInventoryDefaultsBindings(model, onChange) {
  const applyChange = (nextModel) =>
    typeof onChange === "function" ? onChange(nextModel) : undefined;
  return {
    setDefaultField(fieldKey, fieldValue) {
      applyChange(
        orchestrationPatchInventoryDefaults(model, {
          [fieldKey]: fieldValue,
        }),
      );
    },
    setDefaultsExtra(extra) {
      applyChange(orchestrationPatchInventoryDefaults(model, { extra }));
    },
    setDefaultsVars(vars) {
      applyChange(orchestrationPatchInventoryDefaults(model, { vars }));
    },
    setDefaultFieldMode(fieldKey, mode) {
      applyChange(
        orchestrationPatchInventoryDefaults(
          model,
          orchestrationNullableFieldModePatch(
            model?.inventory?.defaults ||
              orchestrationDefaultTargetDefaultsModel(),
            fieldKey,
            mode,
          ),
        ),
      );
    },
    setDefaultFieldPresence(fieldKey, enabled) {
      applyChange(
        orchestrationSetInventoryDefaultsFieldPresence(
          model,
          fieldKey,
          enabled,
        ),
      );
    },
    setDefaultsVarsPresence(enabled) {
      applyChange(
        orchestrationSetInventoryDefaultsVarsPresence(model, enabled),
      );
    },
    setInventoryExtra(extra) {
      applyChange(orchestrationPatchInventory(model, { extra }));
    },
  };
}

function orchestrationInventoryDefaultsCallbacks(
  model,
  extraSource,
  onChange,
  onErrorChange,
) {
  function patchInventoryDefaults(patch = {}) {
    return callIfFunction(
      onChange,
      orchestrationPatchInventoryDefaults(model, patch),
    );
  }
  return {
    fieldPresenceHandler(fieldKey) {
      return orchestrationPatchPresenceChangeHandler(onChange, (enabled) =>
        orchestrationSetInventoryDefaultsFieldPresence(
          model,
          fieldKey,
          enabled,
        ),
      );
    },
    fieldValueHandler(fieldKey) {
      return orchestrationPatchValueChangeHandler(onChange, (value) =>
        orchestrationPatchInventoryDefaults(model, {
          [fieldKey]: value,
        }),
      );
    },
    fieldNullableModeHandler(fieldKey) {
      return orchestrationPatchValueChangeHandler(onChange, (mode) =>
        orchestrationPatchInventoryDefaults(
          model,
          orchestrationNullableFieldModePatch(
            model?.inventory?.defaults ||
              orchestrationDefaultTargetDefaultsModel(),
            fieldKey,
            mode,
          ),
        ),
      );
    },
    metadataPresenceHandler(fieldKey) {
      return orchestrationExtraStringPresenceChangeHandler(
        patchInventoryDefaults,
        extraSource,
        fieldKey,
      );
    },
    metadataValueHandler(fieldKey) {
      return orchestrationExtraStringValueChangeHandler(
        patchInventoryDefaults,
        extraSource,
        fieldKey,
      );
    },
    setDefaultsExtra(extra) {
      return patchInventoryDefaults({ extra });
    },
    setDefaultsVars(vars) {
      callIfFunction(onErrorChange, "");
      return patchInventoryDefaults({ vars });
    },
    setInventoryExtra(extra) {
      return callIfFunction(
        onChange,
        orchestrationPatchInventory(model, { extra }),
      );
    },
    varsPresenceHandler() {
      return orchestrationPatchPresenceChangeHandler(onChange, (enabled) =>
        orchestrationSetInventoryDefaultsVarsPresence(model, enabled),
      );
    },
  };
}

export function createOrchestrationInventoryDefaultsEditorWorkspace() {
  const inputStateStore = writable({
    inventoryDisplay: {},
    model: {},
    onChange: null,
    onErrorChange: null,
  });
  const defaultsDisplayStateStore = deriveStore(
    [inputStateStore, currentLanguageState],
    ([$inputStateStore]) =>
      orchestrationInventoryDefaultsSectionDisplay({
        defaultsModel:
          $inputStateStore.model?.inventory &&
          $inputStateStore.model.inventory.defaults
            ? $inputStateStore.model.inventory.defaults
            : {},
        defaultsFieldRows: $inputStateStore.inventoryDisplay?.defaultsFieldRows,
        defaultsVarsText: $inputStateStore.inventoryDisplay?.defaultsVarsText,
        jsonValueTypeRows: $inputStateStore.inventoryDisplay?.jsonValueTypeRows,
      }),
  );
  const defaultsCallbacksStateStore = deriveStore(
    [inputStateStore, defaultsDisplayStateStore],
    ([$inputStateStore, $defaultsDisplayStateStore]) =>
      orchestrationInventoryDefaultsCallbacks(
        $inputStateStore.model,
        $defaultsDisplayStateStore.extraField.source,
        $inputStateStore.onChange,
        $inputStateStore.onErrorChange,
      ),
  );

  return {
    defaultsCallbacksStateStore,
    defaultsDisplayStateStore,
    setInventoryDefaultsContext({
      inventoryDisplay = {},
      model = {},
      onChange = null,
      onErrorChange = null,
    } = {}) {
      inputStateStore.set({
        inventoryDisplay,
        model,
        onChange,
        onErrorChange,
      });
    },
  };
}

function inventoryObjectOrEmpty(value) {
  return value && typeof value === "object" ? value : {};
}

export function createOrchestrationInventoryPanelDisplayWorkspace({
  model = {},
} = {}) {
  const modelStateStore = writable(inventoryObjectOrEmpty(model));
  const inventoryDisplayStateStore = deriveStore(
    [modelStateStore, currentLanguageState],
    ([$modelStateStore]) =>
      orchestrationInventoryEditorDisplay($modelStateStore.inventory || {}),
  );
  return {
    inventoryDisplayStateStore,
    setInventoryDisplayContext({ model: nextModel = {} } = {}) {
      modelStateStore.set(inventoryObjectOrEmpty(nextModel));
    },
  };
}
