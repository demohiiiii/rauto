import {
  callbackMappedFormCheckedHandler,
  callbackMappedFormValueHandler,
  formCheckedHandler,
  formValueHandler,
} from "../lib/events.js";
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
  txBlockDuplicateStep,
  txBlockMoveStep,
  txBlockNullableTextValue,
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
  txBlockSetCommandInteractionPresence,
  txBlockSetCommandInteractionPromptsPresence,
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
  txInteractionExtraSource,
} from "./transactionBlockMutations.js";

export {
  txBlockNullableTextValue,
  txBlockPatchStepRun,
  txBlockSetCommandDynParamsPresence,
  txBlockSetCommandInteractionPresence,
  txBlockSetCommandPromptFieldPresence,
  txBlockSetCommandTimeoutPresence,
  txBlockSetFlowFieldPresence,
  txBlockSetFlowMaxStepsPresence,
  txBlockSetRootFieldPresence,
  txBlockSetStepFieldPresence,
  txBlockSetStepRollbackEnabled,
  txBlockUpdateCommandDynParam,
  txCommandPromptExtraSource,
  txInteractionExtraSource,
} from "./transactionBlockMutations.js";

export function txBlockEditorBindings(model, onChange) {
  const stepCount = Array.isArray(model?.steps) ? model.steps.length : 0;
  const validStepIndex = (stepIndex) =>
    Number.isInteger(stepIndex) && stepIndex >= 0 && stepIndex < stepCount;
  return {
    addStep() {
      txBlockApplyChange(onChange, txBlockAddStep(model));
    },
    duplicateStep(stepIndex) {
      if (!validStepIndex(stepIndex)) return false;
      txBlockApplyChange(onChange, txBlockDuplicateStep(model, stepIndex));
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
      txBlockApplyChange(onChange, txBlockMoveStep(model, fromIndex, toIndex));
      return true;
    },
    patchStep(stepIndex, patch) {
      txBlockApplyChange(onChange, txBlockPatchStep(model, stepIndex, patch));
    },
    removeStep(stepIndex) {
      txBlockApplyChange(onChange, txBlockRemoveStep(model, stepIndex));
    },
    setRollbackKind(kind) {
      txBlockApplyChange(onChange, txBlockChangeRollbackKind(model, kind));
    },
    setRootFieldPresence(field, enabled) {
      txBlockApplyChange(
        onChange,
        txBlockSetRootFieldPresence(model, field, enabled),
      );
    },
    setRootValue(field, value) {
      txBlockApplyChange(onChange, txBlockChangeRoot(model, field, value));
    },
    setStepFieldPresence(stepIndex, field, enabled) {
      txBlockApplyChange(
        onChange,
        txBlockSetStepFieldPresence(model, stepIndex, field, enabled),
      );
    },
    setStepRollback(stepIndex, operation) {
      txBlockApplyChange(
        onChange,
        txBlockPatchStepRollback(model, stepIndex, operation),
      );
    },
    setStepRollbackEnabled(stepIndex, enabled) {
      txBlockApplyChange(
        onChange,
        txBlockSetStepRollbackEnabled(model, stepIndex, enabled),
      );
    },
    setStepRun(stepIndex, operation) {
      txBlockApplyChange(
        onChange,
        txBlockPatchStepRun(model, stepIndex, operation),
      );
    },
    setWholeResourceExtra(extra) {
      txBlockApplyChange(
        onChange,
        txBlockChangeWholeResourceExtra(model, extra),
      );
    },
    setWholeResourceRollback(operation) {
      txBlockApplyChange(
        onChange,
        txBlockChangeWholeResourceRollback(model, operation),
      );
    },
    setWholeResourceTrigger(value) {
      txBlockApplyChange(
        onChange,
        txBlockChangeWholeResourceTrigger(model, value),
      );
    },
    setWholeResourceTriggerPresence(enabled) {
      txBlockApplyChange(
        onChange,
        txBlockSetWholeResourceTriggerPresence(model, enabled),
      );
    },
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

export function txBlockCommandBindings(command, onChange) {
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

export function txBlockCommandDynParamsBindings(command, onChange) {
  return {
    addExtraParam() {
      txBlockApplyChange(
        onChange,
        txBlockUpdateCommandDynParam(command, "", ""),
      );
    },
    removeExtraParam(key) {
      txBlockApplyChange(onChange, txBlockRemoveCommandDynParam(command, key));
    },
    renameExtraParam(key, nextKey) {
      txBlockApplyChange(
        onChange,
        txBlockRenameCommandDynParam(command, key, nextKey),
      );
    },
    setDynParamsPresence(enabled) {
      txBlockApplyChange(
        onChange,
        txBlockSetCommandDynParamsPresence(command, enabled),
      );
    },
    setExtraParamValue(key, value) {
      txBlockApplyChange(
        onChange,
        txBlockUpdateCommandDynParam(command, key, value),
      );
    },
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

export function txBlockCommandInteractionBindings(command, onChange) {
  return {
    addPrompt() {
      txBlockApplyChange(onChange, txBlockAddCommandPrompt(command));
    },
    removePrompt(promptIndex) {
      txBlockApplyChange(
        onChange,
        txBlockRemoveCommandPrompt(command, promptIndex),
      );
    },
    setInteractionExtra(extra) {
      txBlockApplyChange(
        onChange,
        txBlockPatchCommandInteractionExtra(command, extra),
      );
    },
    setInteractionPresence(enabled) {
      txBlockApplyChange(
        onChange,
        txBlockSetCommandInteractionPresence(command, enabled),
      );
    },
    setPromptsPresence(enabled) {
      txBlockApplyChange(
        onChange,
        txBlockSetCommandInteractionPromptsPresence(command, enabled),
      );
    },
    setPromptExtra(promptIndex, extra) {
      txBlockApplyChange(
        onChange,
        txBlockUpdateCommandPrompt(command, promptIndex, { extra }),
      );
    },
    setPromptFieldPresence(promptIndex, field, enabled) {
      txBlockApplyChange(
        onChange,
        txBlockSetCommandPromptFieldPresence(
          command,
          promptIndex,
          field,
          enabled,
        ),
      );
    },
    addPromptPattern(promptIndex) {
      txBlockApplyChange(
        onChange,
        txBlockAddCommandPromptPattern(command, promptIndex),
      );
    },
    removePromptPattern(promptIndex, patternIndex) {
      txBlockApplyChange(
        onChange,
        txBlockRemoveCommandPromptPattern(command, promptIndex, patternIndex),
      );
    },
    setPromptPatterns(promptIndex, patternText) {
      txBlockApplyChange(
        onChange,
        txBlockUpdateCommandPrompt(command, promptIndex, {
          patterns: txBlockCommandPromptPatternsFromText(patternText),
        }),
      );
    },
    setPromptPatternValue(promptIndex, patternIndex, patternValue) {
      txBlockApplyChange(
        onChange,
        txBlockSetCommandPromptPatternValue(
          command,
          promptIndex,
          patternIndex,
          patternValue,
        ),
      );
    },
    setPromptRecordInput(promptIndex, value) {
      txBlockApplyChange(
        onChange,
        txBlockUpdateCommandPrompt(command, promptIndex, {
          recordInput: value === "true",
          hasRecordInput: true,
        }),
      );
    },
    setPromptResponse(promptIndex, response) {
      txBlockApplyChange(
        onChange,
        txBlockUpdateCommandPrompt(command, promptIndex, {
          response,
        }),
      );
    },
  };
}

export function txBlockCommandInteractionEditorBindings(command, onChange) {
  const bindings = txBlockCommandInteractionBindings(command, onChange);
  return {
    addPrompt() {
      bindings.addPrompt();
    },
    removePrompt(promptIndex) {
      bindings.removePrompt(promptIndex);
    },
    setInteractionExtra(extra) {
      bindings.setInteractionExtra(extra);
    },
    setInteractionMetadataPresence(fieldKey, enabled) {
      bindings.setInteractionExtra(
        txSetExtraStringFieldPresence(
          txInteractionExtraSource(command),
          fieldKey,
          enabled,
        ),
      );
    },
    setInteractionMetadataValue(fieldKey, value) {
      bindings.setInteractionExtra(
        txSetExtraStringFieldValue(
          txInteractionExtraSource(command),
          fieldKey,
          value,
        ),
      );
    },
    setInteractionPresence(enabled) {
      bindings.setInteractionPresence(enabled);
    },
    setPromptExtra(promptIndex, extra) {
      bindings.setPromptExtra(promptIndex, extra);
    },
    setPromptFieldPresence(promptIndex, field, enabled) {
      bindings.setPromptFieldPresence(promptIndex, field, enabled);
    },
    addPromptPattern(promptIndex) {
      bindings.addPromptPattern(promptIndex);
    },
    removePromptPattern(promptIndex, patternIndex) {
      bindings.removePromptPattern(promptIndex, patternIndex);
    },
    setPromptMetadataPresence(promptIndex, fieldKey, enabled) {
      bindings.setPromptExtra(
        promptIndex,
        txSetExtraStringFieldPresence(
          txCommandPromptExtraSource(command, promptIndex),
          fieldKey,
          enabled,
        ),
      );
    },
    setPromptMetadataValue(promptIndex, fieldKey, value) {
      bindings.setPromptExtra(
        promptIndex,
        txSetExtraStringFieldValue(
          txCommandPromptExtraSource(command, promptIndex),
          fieldKey,
          value,
        ),
      );
    },
    setPromptPatterns(promptIndex, patternText) {
      bindings.setPromptPatterns(promptIndex, patternText);
    },
    setPromptPatternValue(promptIndex, patternIndex, patternValue) {
      bindings.setPromptPatternValue(promptIndex, patternIndex, patternValue);
    },
    setPromptRecordInput(promptIndex, value) {
      bindings.setPromptRecordInput(promptIndex, value);
    },
    setPromptResponse(promptIndex, response) {
      bindings.setPromptResponse(promptIndex, response);
    },
    setPromptsPresence(enabled) {
      bindings.setPromptsPresence(enabled);
    },
    deletePromptHandler(promptIndex) {
      return () => bindings.removePrompt(promptIndex);
    },
    interactionMetadataPresenceHandler(fieldKey) {
      return (enabled) => {
        bindings.setInteractionExtra(
          txSetExtraStringFieldPresence(
            txInteractionExtraSource(command),
            fieldKey,
            enabled,
          ),
        );
      };
    },
    interactionMetadataValueHandler(fieldKey) {
      return (value) => {
        bindings.setInteractionExtra(
          txSetExtraStringFieldValue(
            txInteractionExtraSource(command),
            fieldKey,
            value,
          ),
        );
      };
    },
    promptExtraChangeHandler(promptIndex) {
      return (extra) => bindings.setPromptExtra(promptIndex, extra);
    },
    promptMetadataPresenceHandler(promptIndex, fieldKey) {
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
    promptMetadataValueHandler(promptIndex, fieldKey) {
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
    promptPresenceHandler(promptIndex, fieldKey) {
      return (enabled) =>
        bindings.setPromptFieldPresence(promptIndex, fieldKey, enabled);
    },
    promptRecordHandler(promptIndex) {
      return (value) => bindings.setPromptRecordInput(promptIndex, value);
    },
    promptTextHandler(promptIndex, fieldKey) {
      return fieldKey === "patterns"
        ? (value) => bindings.setPromptPatterns(promptIndex, value)
        : (value) => bindings.setPromptResponse(promptIndex, value);
    },
    promptEditorBindings(promptIndex) {
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
        patternValueHandler(patternIndex) {
          return (value) =>
            bindings.setPromptPatternValue(promptIndex, patternIndex, value);
        },
        removePatternAction(patternIndex) {
          return () => bindings.removePromptPattern(promptIndex, patternIndex);
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

export function txBlockFlowBindings(operation, onChange) {
  return {
    addStep() {
      txBlockApplyChange(onChange, txBlockAddFlowStep(operation));
    },
    patchStep(stepIndex, patch) {
      const currentStep =
        operation.flow?.steps?.[stepIndex] || txBlockCommandDraft();
      txBlockApplyChange(
        onChange,
        txBlockUpdateFlowStep(operation, stepIndex, {
          ...currentStep,
          ...patch,
        }),
      );
    },
    removeStep(stepIndex) {
      txBlockApplyChange(onChange, txBlockRemoveFlowStep(operation, stepIndex));
    },
    setExtra(extra) {
      txBlockApplyChange(onChange, txBlockPatchFlow(operation, { extra }));
    },
    setFieldPresence(field, enabled) {
      const patch =
        field === "maxSteps"
          ? txBlockSetFlowMaxStepsPresence(operation.flow, enabled)
          : txBlockSetFlowFieldPresence(operation.flow, field, enabled);
      txBlockApplyChange(onChange, txBlockPatchFlow(operation, patch));
    },
    setMaxSteps(value) {
      txBlockApplyChange(
        onChange,
        txBlockPatchFlow(operation, {
          maxSteps: txBlockNumberFormValue(value),
          hasMaxSteps: true,
        }),
      );
    },
    setStopOnError(value) {
      txBlockApplyChange(
        onChange,
        txBlockPatchFlow(operation, {
          stopOnError: value === "true",
          hasStopOnError: true,
        }),
      );
    },
  };
}

export function txBlockFlowEditorBindings(operation, onChange) {
  const bindings = txBlockFlowBindings(operation, onChange);
  return {
    addStep() {
      bindings.addStep();
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
    setMetadataPresence(fieldKey, enabled) {
      bindings.setExtra(
        txSetExtraStringFieldPresence(operation.flow?.extra, fieldKey, enabled),
      );
    },
    setMetadataValue(fieldKey, value) {
      bindings.setExtra(
        txSetExtraStringFieldValue(operation.flow?.extra, fieldKey, value),
      );
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
    metadataPresenceHandler(fieldKey) {
      return (enabled) => {
        bindings.setExtra(
          txSetExtraStringFieldPresence(
            operation.flow?.extra,
            fieldKey,
            enabled,
          ),
        );
      };
    },
    metadataValueHandler(fieldKey) {
      return (value) => {
        bindings.setExtra(
          txSetExtraStringFieldValue(operation.flow?.extra, fieldKey, value),
        );
      };
    },
    removeStepHandler(stepIndex) {
      return () => bindings.removeStep(stepIndex);
    },
    stepChangeHandler(stepIndex) {
      return (patch) => bindings.patchStep(stepIndex, patch);
    },
  };
}
