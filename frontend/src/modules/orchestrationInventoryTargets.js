import { derived as deriveStore, writable } from "svelte/store";
import { stringValue } from "../lib/jsonValue.js";
import {
  callbackHandler,
  callbackMappedFormCheckedHandler,
} from "../lib/events.js";
import { currentLanguageState, t } from "../lib/i18n.js";
import {
  orchestrationConnectionTextValue,
  orchestrationCreateTargetInputModel,
  orchestrationDefaultTargetModel,
  orchestrationJsonObjectPatchResult,
  orchestrationNormalizeConnectionPatch,
  orchestrationNullableFieldModePatch,
  orchestrationToggleTargetFieldPresence,
} from "./orchestrationFormState.js";
import { orchestrationInventoryGroupTargetsDisplay } from "./orchestrationFormDisplayState.js";
import { orchestrationPatchInventoryGroup } from "./orchestrationInventoryGroupsState.js";

const orchestrationStringValue = stringValue;

function orchestrationInventoryGroupTargetsEditorBindings({
  onAddTarget = null,
  onAddSimpleTarget = null,
  onRemoveSimpleTarget = null,
  onRemoveTarget = null,
  onSetTargetsPresence = null,
  onTargetConnectionChange = null,
  onTargetExtraChange = null,
  onTargetFieldChange = null,
  onTargetFieldNullableModeChange = null,
  onTargetFieldPresenceChange = null,
  onTargetKindChange = null,
  onTargetVarsChange = null,
  onTargetVarsPresenceChange = null,
  onUpdateSimpleTarget = null,
} = {}) {
  return {
    addTargetHandler: callbackHandler(onAddTarget),
    addSimpleTargetHandler: callbackHandler(onAddSimpleTarget),
    removeSimpleTargetHandler(targetIndex = -1) {
      return callbackHandler(onRemoveSimpleTarget, targetIndex);
    },
    removeTargetHandler(targetIndex = -1) {
      return callbackHandler(onRemoveTarget, targetIndex);
    },
    setTargetsPresenceHandler() {
      return callbackMappedFormCheckedHandler(
        onSetTargetsPresence,
        (enabled) => enabled,
      );
    },
    simpleTargetValueHandler(targetIndex = -1) {
      return callbackHandler(onUpdateSimpleTarget, targetIndex);
    },
    targetConnectionHandler(targetIndex = -1) {
      return callbackHandler(onTargetConnectionChange, targetIndex);
    },
    targetExtraHandler(targetIndex = -1) {
      return callbackHandler(onTargetExtraChange, targetIndex);
    },
    targetFieldHandler(targetIndex = -1) {
      return callbackHandler(onTargetFieldChange, targetIndex);
    },
    targetFieldNullableModeHandler(targetIndex = -1) {
      return callbackHandler(onTargetFieldNullableModeChange, targetIndex);
    },
    targetFieldPresenceHandler(targetIndex = -1) {
      return callbackHandler(onTargetFieldPresenceChange, targetIndex);
    },
    targetKindHandler(targetIndex = -1) {
      return callbackHandler(onTargetKindChange, targetIndex);
    },
    targetVarsHandler(targetIndex = -1) {
      return callbackHandler(onTargetVarsChange, targetIndex);
    },
    targetVarsPresenceHandler(targetIndex = -1) {
      return callbackHandler(onTargetVarsPresenceChange, targetIndex);
    },
  };
}

function orchestrationInventoryGroupTargetsActionHandlers(options = {}) {
  return orchestrationInventoryGroupTargetsEditorBindings(options);
}

function orchestrationInventoryGroupTargetsSectionCallbacks(
  model,
  groupIndex,
  onChange,
) {
  const applyChange = (nextModel) =>
    typeof onChange === "function" ? onChange(nextModel) : undefined;
  return {
    addSimpleTarget() {
      applyChange(
        orchestrationAddInventoryGroupSimpleTarget(model, groupIndex),
      );
    },
    addTarget() {
      applyChange(orchestrationAddInventoryGroupTarget(model, groupIndex));
    },
    changeTargetConnection(targetIndex, connectionName) {
      applyChange(
        orchestrationPatchInventoryGroupTargetInput(
          model,
          groupIndex,
          targetIndex,
          { connection: connectionName },
        ),
      );
    },
    changeTargetExtra(targetIndex, extra) {
      applyChange(
        orchestrationPatchInventoryGroupTargetInput(
          model,
          groupIndex,
          targetIndex,
          {
            kind: "detailed",
            target: { extra },
          },
        ),
      );
    },
    changeTargetField(targetIndex, fieldName, fieldValue) {
      applyChange(
        orchestrationPatchInventoryGroupTargetInput(
          model,
          groupIndex,
          targetIndex,
          {
            kind: "detailed",
            target: { [fieldName]: fieldValue },
          },
        ),
      );
    },
    changeTargetFieldMode(targetIndex, fieldName, mode) {
      applyChange(
        orchestrationPatchInventoryGroupTargetInput(
          model,
          groupIndex,
          targetIndex,
          {
            kind: "detailed",
            target: orchestrationNullableFieldModePatch(
              model?.inventory?.groups?.[groupIndex]?.targets?.[targetIndex]
                ?.target || orchestrationDefaultTargetModel(),
              fieldName,
              mode,
            ),
          },
        ),
      );
    },
    changeTargetKind(targetIndex, targetKind) {
      applyChange(
        orchestrationPatchInventoryGroupTargetInput(
          model,
          groupIndex,
          targetIndex,
          { kind: targetKind },
        ),
      );
    },
    changeTargetVars(targetIndex, vars) {
      applyChange(
        orchestrationPatchInventoryGroupTargetInput(
          model,
          groupIndex,
          targetIndex,
          {
            kind: "detailed",
            target: { vars },
          },
        ),
      );
    },
    removeSimpleTarget(targetIndex) {
      applyChange(
        orchestrationRemoveInventoryGroupSimpleTarget(
          model,
          groupIndex,
          targetIndex,
        ),
      );
    },
    removeTarget(targetIndex) {
      applyChange(
        orchestrationRemoveInventoryGroupTarget(model, groupIndex, targetIndex),
      );
    },
    setTargetFieldPresence(targetIndex, fieldName, enabled) {
      applyChange(
        orchestrationSetInventoryGroupTargetFieldPresence(
          model,
          groupIndex,
          targetIndex,
          fieldName,
          enabled,
        ),
      );
    },
    setTargetVarsPresence(targetIndex, enabled) {
      applyChange(
        orchestrationSetInventoryGroupTargetVarsPresence(
          model,
          groupIndex,
          targetIndex,
          enabled,
        ),
      );
    },
    setTargetsPresence(enabled) {
      applyChange(
        orchestrationSetInventoryGroupTargetsPresence(
          model,
          groupIndex,
          enabled,
        ),
      );
    },
    updateSimpleTarget(targetIndex, connectionName) {
      applyChange(
        orchestrationUpdateInventoryGroupSimpleTarget(
          model,
          groupIndex,
          targetIndex,
          connectionName,
        ),
      );
    },
  };
}

function inventoryGroupOrEmpty(model, groupIndex) {
  const group = model?.inventory?.groups?.[groupIndex];
  return group && typeof group === "object" ? group : {};
}

function inventoryGroupTargets(group) {
  return Array.isArray(group?.targets) ? [...group.targets] : [];
}

export function orchestrationSetInventoryGroupTargetsPresence(
  model,
  groupIndex,
  enabled,
) {
  const currentGroup = inventoryGroupOrEmpty(model, groupIndex);
  return orchestrationPatchInventoryGroup(model, groupIndex, {
    hasTargets: !!enabled,
    targets: enabled ? inventoryGroupTargets(currentGroup) : [],
  });
}

export function orchestrationPatchInventoryGroupTargetsText(
  model,
  groupIndex,
  text,
) {
  return orchestrationPatchInventoryGroup(model, groupIndex, {
    hasTargets: true,
    targets: orchestrationStringValue(text)
      .split("\n")
      .map((targetText) => targetText.trim())
      .filter(Boolean),
  });
}

export function orchestrationAddInventoryGroupSimpleTarget(model, groupIndex) {
  const currentGroup = inventoryGroupOrEmpty(model, groupIndex);
  const targets = inventoryGroupTargets(currentGroup);
  targets.push(orchestrationCreateTargetInputModel("connection"));
  return orchestrationPatchInventoryGroup(model, groupIndex, {
    hasTargets: true,
    targets,
    useDetailed: false,
  });
}

export function orchestrationUpdateInventoryGroupSimpleTarget(
  model,
  groupIndex,
  targetIndex,
  connection,
) {
  return orchestrationPatchInventoryGroupTargetInput(
    model,
    groupIndex,
    targetIndex,
    {
      kind: "connection",
      connection,
    },
  );
}

export function orchestrationRemoveInventoryGroupSimpleTarget(
  model,
  groupIndex,
  targetIndex,
) {
  return orchestrationRemoveInventoryGroupTarget(
    model,
    groupIndex,
    targetIndex,
  );
}

export function orchestrationAddInventoryGroupTarget(model, groupIndex) {
  const currentGroup = inventoryGroupOrEmpty(model, groupIndex);
  const targets = inventoryGroupTargets(currentGroup);
  targets.push(orchestrationCreateTargetInputModel("connection"));
  return orchestrationPatchInventoryGroup(model, groupIndex, {
    hasTargets: true,
    targets,
  });
}

export function orchestrationRemoveInventoryGroupTarget(
  model,
  groupIndex,
  targetIndex,
) {
  const currentGroup = inventoryGroupOrEmpty(model, groupIndex);
  const targets = inventoryGroupTargets(currentGroup);
  targets.splice(targetIndex, 1);
  return orchestrationPatchInventoryGroup(model, groupIndex, {
    hasTargets: true,
    targets,
  });
}

export function orchestrationPatchInventoryGroupTargetInput(
  model,
  groupIndex,
  targetIndex,
  patch = {},
) {
  const currentGroup = inventoryGroupOrEmpty(model, groupIndex);
  const targets = inventoryGroupTargets(currentGroup);
  const current =
    targets[targetIndex] || orchestrationCreateTargetInputModel("connection");
  const kind =
    patch.kind === "connection" || patch.kind === "detailed"
      ? patch.kind
      : current.kind;
  const normalizedTargetPatch = orchestrationNormalizeConnectionPatch(
    patch.target || {},
  );
  const nextTarget =
    kind === "detailed"
      ? {
          kind: "detailed",
          connection: null,
          hasConnection: false,
          target: {
            ...(current.target || orchestrationDefaultTargetModel()),
            ...(Object.hasOwn(patch, "connection")
              ? {
                  connection: orchestrationConnectionTextValue(
                    patch.connection,
                  ),
                  hasConnection: true,
                }
              : {}),
            ...normalizedTargetPatch,
          },
        }
      : {
          kind: "connection",
          connection: Object.hasOwn(patch, "connection")
            ? orchestrationStringValue(patch.connection)
            : orchestrationStringValue(current.connection),
          hasConnection: true,
          target: null,
        };
  targets[targetIndex] = nextTarget;
  return orchestrationPatchInventoryGroup(model, groupIndex, {
    hasTargets: true,
    targets,
  });
}

export function orchestrationInventoryGroupTargetVarsUpdateResult(
  model,
  groupIndex,
  targetIndex,
  varsText,
) {
  return orchestrationJsonObjectPatchResult(model, varsText, (parsedVars) =>
    orchestrationPatchInventoryGroupTargetInput(
      model,
      groupIndex,
      targetIndex,
      {
        kind: "detailed",
        target: { vars: parsedVars },
      },
    ),
  );
}

export function orchestrationSetInventoryGroupTargetFieldPresence(
  model,
  groupIndex,
  targetIndex,
  field,
  enabled,
) {
  const currentGroup = inventoryGroupOrEmpty(model, groupIndex);
  const targets = inventoryGroupTargets(currentGroup);
  const current =
    targets[targetIndex] || orchestrationCreateTargetInputModel("detailed");
  targets[targetIndex] = {
    kind: "detailed",
    connection: null,
    hasConnection: false,
    target: orchestrationToggleTargetFieldPresence(
      current.target || orchestrationDefaultTargetModel(),
      field,
      enabled,
    ),
  };
  return orchestrationPatchInventoryGroup(model, groupIndex, {
    hasTargets: true,
    targets,
    useDetailed: true,
  });
}

export function orchestrationSetInventoryGroupTargetVarsPresence(
  model,
  groupIndex,
  targetIndex,
  enabled,
) {
  return orchestrationSetInventoryGroupTargetFieldPresence(
    model,
    groupIndex,
    targetIndex,
    "vars",
    enabled,
  );
}

export function createOrchestrationInventoryGroupTargetsEditorWorkspace({
  groupRow = {},
  onSetTargetsPresence = null,
  onAddSimpleTarget = null,
  onUpdateSimpleTarget = null,
  onRemoveSimpleTarget = null,
  onAddTarget = null,
  onRemoveTarget = null,
  onTargetKindChange = null,
  onTargetConnectionChange = null,
  onTargetFieldChange = null,
  onTargetFieldNullableModeChange = null,
  onTargetVarsChange = null,
  onTargetFieldPresenceChange = null,
  onTargetVarsPresenceChange = null,
  onTargetExtraChange = null,
} = {}) {
  const groupRowStateStore = writable(groupRow);
  const callbackInputsStateStore = writable({
    onSetTargetsPresence,
    onAddSimpleTarget,
    onUpdateSimpleTarget,
    onRemoveSimpleTarget,
    onAddTarget,
    onRemoveTarget,
    onTargetKindChange,
    onTargetConnectionChange,
    onTargetFieldChange,
    onTargetFieldNullableModeChange,
    onTargetVarsChange,
    onTargetFieldPresenceChange,
    onTargetVarsPresenceChange,
    onTargetExtraChange,
  });
  const targetsDisplayStateStore = deriveStore(
    [groupRowStateStore, currentLanguageState],
    ([$groupRowStateStore]) =>
      orchestrationInventoryGroupTargetsDisplay($groupRowStateStore, {
        addButtonLabelText: t("orchestrationFormAddTarget"),
        placeholderText: t("fieldConnection"),
        removeButtonLabelText: t("deleteBtn"),
        targetLabelText: t("orchestrationFormTarget"),
      }),
  );
  const targetActionHandlersStateStore = deriveStore(
    callbackInputsStateStore,
    ($callbackInputsStateStore) =>
      orchestrationInventoryGroupTargetsActionHandlers(
        $callbackInputsStateStore,
      ),
  );

  function setInventoryGroupTargetsContext({
    groupRow: nextGroupRow = {},
    onSetTargetsPresence: nextOnSetTargetsPresence = null,
    onAddSimpleTarget: nextOnAddSimpleTarget = null,
    onUpdateSimpleTarget: nextOnUpdateSimpleTarget = null,
    onRemoveSimpleTarget: nextOnRemoveSimpleTarget = null,
    onAddTarget: nextOnAddTarget = null,
    onRemoveTarget: nextOnRemoveTarget = null,
    onTargetKindChange: nextOnTargetKindChange = null,
    onTargetConnectionChange: nextOnTargetConnectionChange = null,
    onTargetFieldChange: nextOnTargetFieldChange = null,
    onTargetFieldNullableModeChange: nextOnTargetFieldNullableModeChange = null,
    onTargetVarsChange: nextOnTargetVarsChange = null,
    onTargetFieldPresenceChange: nextOnTargetFieldPresenceChange = null,
    onTargetVarsPresenceChange: nextOnTargetVarsPresenceChange = null,
    onTargetExtraChange: nextOnTargetExtraChange = null,
  } = {}) {
    groupRowStateStore.set(nextGroupRow);
    callbackInputsStateStore.set({
      onSetTargetsPresence: nextOnSetTargetsPresence,
      onAddSimpleTarget: nextOnAddSimpleTarget,
      onUpdateSimpleTarget: nextOnUpdateSimpleTarget,
      onRemoveSimpleTarget: nextOnRemoveSimpleTarget,
      onAddTarget: nextOnAddTarget,
      onRemoveTarget: nextOnRemoveTarget,
      onTargetKindChange: nextOnTargetKindChange,
      onTargetConnectionChange: nextOnTargetConnectionChange,
      onTargetFieldChange: nextOnTargetFieldChange,
      onTargetFieldNullableModeChange: nextOnTargetFieldNullableModeChange,
      onTargetVarsChange: nextOnTargetVarsChange,
      onTargetFieldPresenceChange: nextOnTargetFieldPresenceChange,
      onTargetVarsPresenceChange: nextOnTargetVarsPresenceChange,
      onTargetExtraChange: nextOnTargetExtraChange,
    });
  }

  return {
    setInventoryGroupTargetsContext,
    targetActionHandlersStateStore,
    targetsDisplayStateStore,
  };
}

export function createOrchestrationInventoryGroupTargetsSectionWorkspace() {
  const callbackInputsStateStore = writable({
    groupIndex: 0,
    model: {},
    onChange: null,
  });
  const sectionCallbacksStateStore = deriveStore(
    callbackInputsStateStore,
    ($callbackInputsStateStore) =>
      orchestrationInventoryGroupTargetsSectionCallbacks(
        $callbackInputsStateStore.model,
        $callbackInputsStateStore.groupIndex,
        $callbackInputsStateStore.onChange,
      ),
  );
  return {
    sectionCallbacksStateStore,
    setInventoryGroupTargetsSectionContext({
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
