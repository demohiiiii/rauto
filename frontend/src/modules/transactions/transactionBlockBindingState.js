import {
  callbackMappedFormCheckedHandler,
  callbackMappedFormValueHandler,
  formCheckedHandler,
  formValueHandler,
} from "../../lib/events.js";
import {
  txExtraStringPresenceChangeHandler,
  txExtraStringValueChangeHandler,
  txSetExtraStringFieldPresence,
  txSetExtraStringFieldValue,
} from "./transactionMetadataFields.js";
import {
  txBlockAddCommandPrompt,
  txBlockAddCommandPromptPattern,
  txBlockAddFlowStep,
  txBlockAddStep,
  txBlockApplyChange,
  txBlockChangeOperationKind,
  txBlockChangeRollbackKind,
  txBlockChangeRoot,
  txBlockChangeWholeResourceExtra,
  txBlockChangeWholeResourceRollback,
  txBlockChangeWholeResourceTrigger,
  txBlockCommandDraft,
  txBlockCommandPromptPatternsFromText,
  txBlockDuplicateFlowStep,
  txBlockDuplicateStep,
  txBlockMoveFlowStep,
  txBlockMoveStep,
  txBlockNumberFormValue,
  txBlockPatchCommand,
  txBlockPatchCommandInteractionExtra,
  txBlockPatchFlow,
  txBlockPatchStep,
  txBlockPatchStepRollback,
  txBlockPatchStepRun,
  txBlockRemoveCommandDynParam,
  txBlockRemoveCommandPrompt,
  txBlockRemoveCommandPromptPattern,
  txBlockRemoveFlowStep,
  txBlockRemoveStep,
  txBlockRenameCommandDynParam,
  txBlockSetCommandPromptFieldPresence,
  txBlockSetCommandPromptPatternValue,
  txBlockSetCommandTimeoutPresence,
  txBlockSetCommandDynParamsPresence,
  txBlockSetFlowFieldPresence,
  txBlockSetFlowMaxStepsPresence,
  txBlockSetRootFieldPresence,
  txBlockSetStepFieldPresence,
  txBlockSetStepRollbackEnabled,
  txBlockSetWholeResourceTriggerPresence,
  txBlockUpdateCommandDynParam,
  txBlockUpdateCommandPrompt,
  txBlockUpdateFlowStep,
  txCommandPromptExtraSource,
} from "./transactionBlockMutations.js";

function txModelChangeHandler(model, onChange, mutation) {
  return (...args) => txBlockApplyChange(onChange, mutation(model, ...args));
}

export function txBlockEditorBindings(model, onChange) {
  const stepCount = Array.isArray(model?.steps) ? model.steps.length : 0;
  const validStepIndex = (stepIndex) =>
    Number.isInteger(stepIndex) && stepIndex >= 0 && stepIndex < stepCount;
  const applyModelChange = (mutation) =>
    txModelChangeHandler(model, onChange, mutation);
  return {
    addStep: applyModelChange(txBlockAddStep),
    duplicateStep(stepIndex) {
      if (!validStepIndex(stepIndex)) return false;
      applyModelChange(txBlockDuplicateStep)(stepIndex);
      return true;
    },
    moveStep(fromIndex, toIndex) {
      if (
        !validStepIndex(fromIndex) ||
        !validStepIndex(toIndex) ||
        fromIndex === toIndex
      ) {
        return false;
      }
      applyModelChange(txBlockMoveStep)(fromIndex, toIndex);
      return true;
    },
    patchStep: applyModelChange(txBlockPatchStep),
    removeStep: applyModelChange(txBlockRemoveStep),
    setRollbackKind: applyModelChange(txBlockChangeRollbackKind),
    setRootFieldPresence: applyModelChange(txBlockSetRootFieldPresence),
    setRootValue: applyModelChange(txBlockChangeRoot),
    setStepFieldPresence: applyModelChange(txBlockSetStepFieldPresence),
    setStepRollback: applyModelChange(txBlockPatchStepRollback),
    setStepRollbackEnabled: applyModelChange(txBlockSetStepRollbackEnabled),
    setStepRun: applyModelChange(txBlockPatchStepRun),
    setWholeResourceExtra: applyModelChange(txBlockChangeWholeResourceExtra),
    setWholeResourceRollback: applyModelChange(
      txBlockChangeWholeResourceRollback,
    ),
    setWholeResourceTrigger: applyModelChange(
      txBlockChangeWholeResourceTrigger,
    ),
    setWholeResourceTriggerPresence: applyModelChange(
      txBlockSetWholeResourceTriggerPresence,
    ),
  };
}

export function txBlockVisualEditorBindings(model, onChange) {
  const bindings = txBlockEditorBindings(model, onChange);
  return {
    appendStep() {
      bindings.addStep();
    },
    rollbackKindValueHandler() {
      return callbackMappedFormValueHandler(
        bindings.setRollbackKind,
        (value) => value,
      );
    },
    rootPresenceHandler(field) {
      return callbackMappedFormCheckedHandler(
        (enabled) => bindings.setRootFieldPresence(field, enabled),
        (enabled) => enabled,
      );
    },
    rootValueHandler(field) {
      return callbackMappedFormValueHandler(
        (value) => bindings.setRootValue(field, value),
        (value) => value,
      );
    },
    setWholeResourceExtra(extra) {
      bindings.setWholeResourceExtra(extra);
    },
    setWholeResourceRollback(operation) {
      bindings.setWholeResourceRollback(operation);
    },
    stepChangeAction(stepIndex) {
      return (patchOrField, enabled) =>
        typeof patchOrField === "string"
          ? bindings.setStepFieldPresence(stepIndex, patchOrField, enabled)
          : bindings.patchStep(stepIndex, patchOrField);
    },
    stepRemoveAction(stepIndex) {
      return () => bindings.removeStep(stepIndex);
    },
    stepRollbackChangeAction(stepIndex) {
      return (operation) => bindings.setStepRollback(stepIndex, operation);
    },
    stepRollbackEnabledAction(stepIndex) {
      return (enabled) => bindings.setStepRollbackEnabled(stepIndex, enabled);
    },
    stepRunChangeAction(stepIndex) {
      return (operation) => bindings.setStepRun(stepIndex, operation);
    },
    wholeFieldPresenceHandler(field) {
      if (field !== "triggerStepIndex") return null;
      return callbackMappedFormCheckedHandler(
        bindings.setWholeResourceTriggerPresence,
        (enabled) => enabled,
      );
    },
    wholeFieldValueHandler(field) {
      if (field !== "triggerStepIndex") {
        return callbackMappedFormValueHandler(
          () => undefined,
          (value) => value,
        );
      }
      return callbackMappedFormValueHandler(
        bindings.setWholeResourceTrigger,
        (value) => value,
      );
    },
    wholeResourceExtraPresenceHandler(fieldKey) {
      return txExtraStringPresenceChangeHandler(
        bindings.setWholeResourceExtra,
        () => model?.rollbackPolicy?.wholeResource?.extra,
        fieldKey,
      );
    },
    wholeResourceExtraValueHandler(fieldKey) {
      return txExtraStringValueChangeHandler(
        bindings.setWholeResourceExtra,
        () => model?.rollbackPolicy?.wholeResource?.extra,
        fieldKey,
      );
    },
  };
}

function txBlockCommandBindings(command, onChange) {
  return {
    setExtra(extra) {
      txBlockApplyChange(onChange, { extra });
    },
    setField(key, value) {
      txBlockApplyChange(onChange, { [key]: value });
    },
    setTimeoutSecs(value) {
      txBlockApplyChange(onChange, {
        timeout: txBlockNumberFormValue(value),
        hasTimeout: true,
      });
    },
    setTimeoutPresence(enabled) {
      txBlockApplyChange(
        onChange,
        txBlockSetCommandTimeoutPresence(command, enabled),
      );
    },
  };
}

export function txBlockCommandEditorBindings(command, onChange) {
  const bindings = txBlockCommandBindings(command, onChange);
  return {
    fieldPresenceHandler(fieldKey) {
      if (fieldKey !== "timeout") return null;
      return callbackMappedFormCheckedHandler(
        bindings.setTimeoutPresence,
        (enabled) => enabled,
      );
    },
    fieldValueHandler(fieldKey) {
      if (fieldKey === "timeout") {
        return callbackMappedFormValueHandler(
          bindings.setTimeoutSecs,
          (value) => value,
        );
      }
      return callbackMappedFormValueHandler(
        (value) => bindings.setField(fieldKey, value),
        (value) => value,
      );
    },
    metadataPresenceHandler(fieldKey) {
      return callbackMappedFormCheckedHandler(
        (enabled) =>
          bindings.setExtra(
            txSetExtraStringFieldPresence(command.extra, fieldKey, enabled),
          ),
        (enabled) => enabled,
      );
    },
    metadataValueHandler(fieldKey) {
      return callbackMappedFormValueHandler(
        (value) =>
          bindings.setExtra(
            txSetExtraStringFieldValue(command.extra, fieldKey, value),
          ),
        (value) => value,
      );
    },
    setExtra(extra) {
      bindings.setExtra(extra);
    },
  };
}

function txBlockCommandDynParamsBindings(command, onChange) {
  const applyCommandChange = (mutation) =>
    txModelChangeHandler(command, onChange, mutation);
  return {
    addExtraParam() {
      applyCommandChange(txBlockUpdateCommandDynParam)("", "");
    },
    removeExtraParam: applyCommandChange(txBlockRemoveCommandDynParam),
    renameExtraParam: applyCommandChange(txBlockRenameCommandDynParam),
    setDynParamsPresence: applyCommandChange(
      txBlockSetCommandDynParamsPresence,
    ),
    setExtraParamValue: applyCommandChange(txBlockUpdateCommandDynParam),
  };
}

export function txBlockCommandDynParamsEditorBindings(command, onChange) {
  const bindings = txBlockCommandDynParamsBindings(command, onChange);
  return {
    addExtraParam() {
      return bindings.addExtraParam();
    },
    dynParamsPresenceHandler() {
      return formCheckedHandler((enabled) =>
        bindings.setDynParamsPresence(enabled),
      );
    },
    extraParamKeyHandler(paramKey) {
      return formValueHandler((nextKey) =>
        bindings.renameExtraParam(paramKey, nextKey),
      );
    },
    extraParamValueHandler(paramKey) {
      return formValueHandler((paramValue) =>
        bindings.setExtraParamValue(paramKey, paramValue),
      );
    },
    removeExtraParamHandler(paramKey) {
      return () => bindings.removeExtraParam(paramKey);
    },
  };
}

export function txBlockOperationBindings(operation, onChange) {
  return {
    setCommand(commandPatch) {
      txBlockApplyChange(
        onChange,
        txBlockPatchCommand(operation, commandPatch),
      );
    },
    setKind(kind) {
      txBlockApplyChange(onChange, txBlockChangeOperationKind(operation, kind));
    },
  };
}

export function txBlockStepEditorBindings(
  step = {},
  { onStepChange = null } = {},
) {
  return {
    fieldPresenceHandler(fieldKey) {
      return callbackMappedFormCheckedHandler(
        (enabled) =>
          typeof onStepChange === "function"
            ? onStepChange(fieldKey, enabled)
            : undefined,
        (enabled) => enabled,
      );
    },
    fieldValueHandler(fieldKey) {
      return callbackMappedFormValueHandler(
        (value) =>
          typeof onStepChange === "function"
            ? onStepChange({
                rollbackOnFailure: value === "true",
                hasRollbackOnFailure: true,
              })
            : undefined,
        (value) => value,
      );
    },
  };
}

function txBlockCommandInteractionBindings(command, onChange) {
  const applyCommandChange = (mutation) =>
    txModelChangeHandler(command, onChange, mutation);
  return {
    addPrompt: applyCommandChange(txBlockAddCommandPrompt),
    removePrompt: applyCommandChange(txBlockRemoveCommandPrompt),
    setInteractionExtra: applyCommandChange(
      txBlockPatchCommandInteractionExtra,
    ),
    setPromptExtra(promptIndex, extra) {
      applyCommandChange(txBlockUpdateCommandPrompt)(promptIndex, { extra });
    },
    setPromptFieldPresence: applyCommandChange(
      txBlockSetCommandPromptFieldPresence,
    ),
    addPromptPattern: applyCommandChange(txBlockAddCommandPromptPattern),
    removePromptPattern: applyCommandChange(txBlockRemoveCommandPromptPattern),
    setPromptPatterns(promptIndex, patternText) {
      applyCommandChange(txBlockUpdateCommandPrompt)(promptIndex, {
        patterns: txBlockCommandPromptPatternsFromText(patternText),
      });
    },
    setPromptPatternValue: applyCommandChange(
      txBlockSetCommandPromptPatternValue,
    ),
    setPromptRecordInput(promptIndex, value) {
      applyCommandChange(txBlockUpdateCommandPrompt)(promptIndex, {
        recordInput: value === "true",
        hasRecordInput: true,
      });
    },
    setPromptResponse(promptIndex, response) {
      applyCommandChange(txBlockUpdateCommandPrompt)(promptIndex, { response });
    },
  };
}

export function txBlockCommandInteractionEditorBindings(command, onChange) {
  const bindings = txBlockCommandInteractionBindings(command, onChange);
  return {
    addPrompt: bindings.addPrompt,
    setInteractionExtra: bindings.setInteractionExtra,
    promptActionHandlers(promptIndex) {
      return {
        deletePromptAction() {
          return () => bindings.removePrompt(promptIndex);
        },
        addPatternAction() {
          return () => bindings.addPromptPattern(promptIndex);
        },
        extraChangeHandler() {
          return (extra) => bindings.setPromptExtra(promptIndex, extra);
        },
        fieldPresenceHandler(fieldKey) {
          return (enabled) =>
            bindings.setPromptFieldPresence(promptIndex, fieldKey, enabled);
        },
        metadataPresenceHandler(fieldKey) {
          return (enabled) => {
            bindings.setPromptExtra(
              promptIndex,
              txSetExtraStringFieldPresence(
                txCommandPromptExtraSource(command, promptIndex),
                fieldKey,
                enabled,
              ),
            );
          };
        },
        metadataValueHandler(fieldKey) {
          return (value) => {
            bindings.setPromptExtra(
              promptIndex,
              txSetExtraStringFieldValue(
                txCommandPromptExtraSource(command, promptIndex),
                fieldKey,
                value,
              ),
            );
          };
        },
        recordValueHandler() {
          return (value) => bindings.setPromptRecordInput(promptIndex, value);
        },
        patternValueHandler(patternIndex, value) {
          bindings.setPromptPatternValue(promptIndex, patternIndex, value);
        },
        removePatternAction(patternIndex) {
          bindings.removePromptPattern(promptIndex, patternIndex);
        },
        textValueHandler(fieldKey) {
          return fieldKey === "patterns"
            ? (value) => bindings.setPromptPatterns(promptIndex, value)
            : (value) => bindings.setPromptResponse(promptIndex, value);
        },
      };
    },
  };
}

function txBlockFlowBindings(operation, onChange) {
  const applyFlowChange = (mutation) =>
    txModelChangeHandler(operation, onChange, mutation);
  return {
    addStep: applyFlowChange(txBlockAddFlowStep),
    duplicateStep: applyFlowChange(txBlockDuplicateFlowStep),
    moveStep: applyFlowChange(txBlockMoveFlowStep),
    patchStep(stepIndex, patch) {
      const currentStep =
        operation.flow?.steps?.[stepIndex] || txBlockCommandDraft();
      applyFlowChange(txBlockUpdateFlowStep)(stepIndex, {
        ...currentStep,
        ...patch,
      });
    },
    removeStep: applyFlowChange(txBlockRemoveFlowStep),
    setExtra(extra) {
      applyFlowChange(txBlockPatchFlow)({ extra });
    },
    setFieldPresence(field, enabled) {
      const patch =
        field === "maxSteps"
          ? txBlockSetFlowMaxStepsPresence(operation.flow, enabled)
          : txBlockSetFlowFieldPresence(operation.flow, field, enabled);
      applyFlowChange(txBlockPatchFlow)(patch);
    },
    setMaxSteps(value) {
      applyFlowChange(txBlockPatchFlow)({
        maxSteps: txBlockNumberFormValue(value),
        hasMaxSteps: true,
      });
    },
    setStopOnError(value) {
      applyFlowChange(txBlockPatchFlow)({
        stopOnError: value === "true",
        hasStopOnError: true,
      });
    },
  };
}

export function txBlockFlowEditorBindings(operation, onChange) {
  const bindings = txBlockFlowBindings(operation, onChange);
  return {
    addStep() {
      bindings.addStep();
    },
    duplicateStep(stepIndex) {
      bindings.duplicateStep(stepIndex);
    },
    moveStep(fromIndex, toIndex) {
      bindings.moveStep(fromIndex, toIndex);
    },
    patchStep(stepIndex, patch) {
      bindings.patchStep(stepIndex, patch);
    },
    removeStep(stepIndex) {
      bindings.removeStep(stepIndex);
    },
    setExtra(extra) {
      bindings.setExtra(extra);
    },
    setFieldPresence(field, enabled) {
      bindings.setFieldPresence(field, enabled);
    },
    setMaxSteps(value) {
      bindings.setMaxSteps(value);
    },
    setStopOnError(value) {
      bindings.setStopOnError(value);
    },
    flowFieldPresenceHandler(fieldKey) {
      return (enabled) => bindings.setFieldPresence(fieldKey, enabled);
    },
    flowFieldValueHandler(fieldKey) {
      return fieldKey === "stopOnError"
        ? bindings.setStopOnError
        : bindings.setMaxSteps;
    },
    duplicateStepHandler(stepIndex) {
      return () => bindings.duplicateStep(stepIndex);
    },
    moveStepHandler(fromIndex, toIndex) {
      return () => bindings.moveStep(fromIndex, toIndex);
    },
    removeStepHandler(stepIndex) {
      return () => bindings.removeStep(stepIndex);
    },
    stepChangeHandler(stepIndex) {
      return (patch) => bindings.patchStep(stepIndex, patch);
    },
  };
}
