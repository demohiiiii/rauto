import {
  callbackMappedFormCheckedHandler,
  callbackMappedFormValueHandler,
  formCheckedHandler,
  formValueHandler,
} from "../../../lib/events.js";
import {
  txExtraStringPresenceChangeHandler,
  txExtraStringValueChangeHandler,
  txSetExtraStringFieldPresence,
  txSetExtraStringFieldValue,
} from "../model/transactionMetadataFields.js";
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
} from "../model/transactionBlockMutations.js";
import type {
  JsonObject,
  TxBlockFormModel,
  TxCommandModel,
  TxFlowModel,
  TxOperationKind,
  TxOperationModel,
  TxRollbackKind,
  TxStepFormModel,
} from "../model/types.js";

type ChangeHandler<T> = ((nextModel: T) => unknown) | null | undefined;
type FormEventHandler = (event: unknown) => unknown;
type ModelMutation<TModel, TArgs extends unknown[]> = (
  model: TModel,
  ...args: TArgs
) => TModel;

export type TxBlockStepChangeHandler = (
  patchOrField: string | Partial<TxStepFormModel>,
  enabled?: boolean,
) => unknown;

interface TxBlockStepEditorBindingOptions {
  onStepChange?: TxBlockStepChangeHandler | null;
}

function txModelChangeHandler<TModel, TArgs extends unknown[]>(
  model: TModel,
  onChange: ChangeHandler<TModel>,
  mutation: ModelMutation<TModel, TArgs>,
): (...args: TArgs) => unknown {
  return (...args) => txBlockApplyChange(onChange, mutation(model, ...args));
}

export function txBlockEditorBindings(
  model: TxBlockFormModel,
  onChange: ChangeHandler<TxBlockFormModel>,
) {
  const stepCount = Array.isArray(model?.steps) ? model.steps.length : 0;
  const validStepIndex = (stepIndex: number): boolean =>
    Number.isInteger(stepIndex) && stepIndex >= 0 && stepIndex < stepCount;
  const applyModelChange = <TArgs extends unknown[]>(
    mutation: ModelMutation<TxBlockFormModel, TArgs>,
  ) => txModelChangeHandler(model, onChange, mutation);
  return {
    addStep: applyModelChange(txBlockAddStep),
    duplicateStep(stepIndex: number): boolean {
      if (!validStepIndex(stepIndex)) return false;
      applyModelChange(txBlockDuplicateStep)(stepIndex);
      return true;
    },
    moveStep(fromIndex: number, toIndex: number): boolean {
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

export function txBlockVisualEditorBindings(
  model: TxBlockFormModel,
  onChange: ChangeHandler<TxBlockFormModel>,
) {
  const bindings = txBlockEditorBindings(model, onChange);
  return {
    appendStep() {
      bindings.addStep();
    },
    rollbackKindValueHandler() {
      return callbackMappedFormValueHandler(
        (value) => bindings.setRollbackKind(value as TxRollbackKind),
        (value) => value,
      );
    },
    rootPresenceHandler(field: string): FormEventHandler {
      return callbackMappedFormCheckedHandler(
        (enabled) => bindings.setRootFieldPresence(field, enabled),
        (enabled) => enabled,
      );
    },
    rootValueHandler(field: string): FormEventHandler {
      return callbackMappedFormValueHandler(
        (value) => bindings.setRootValue(field, value),
        (value) => value,
      );
    },
    setWholeResourceExtra(extra: JsonObject): void {
      bindings.setWholeResourceExtra(extra);
    },
    setWholeResourceRollback(operation: TxOperationModel): void {
      bindings.setWholeResourceRollback(operation);
    },
    stepChangeAction(stepIndex: number) {
      return (
        patchOrField: string | Partial<TxStepFormModel>,
        enabled = false,
      ) =>
        typeof patchOrField === "string"
          ? bindings.setStepFieldPresence(stepIndex, patchOrField, enabled)
          : bindings.patchStep(stepIndex, patchOrField);
    },
    stepRemoveAction(stepIndex: number) {
      return () => bindings.removeStep(stepIndex);
    },
    stepRollbackChangeAction(stepIndex: number) {
      return (operation: TxOperationModel | null) =>
        bindings.setStepRollback(stepIndex, operation);
    },
    stepRollbackEnabledAction(stepIndex: number) {
      return (enabled: boolean) =>
        bindings.setStepRollbackEnabled(stepIndex, enabled);
    },
    stepRunChangeAction(stepIndex: number) {
      return (operation: TxOperationModel) =>
        bindings.setStepRun(stepIndex, operation);
    },
    wholeFieldPresenceHandler(field: string): FormEventHandler | null {
      if (field !== "triggerStepIndex") return null;
      return callbackMappedFormCheckedHandler(
        bindings.setWholeResourceTriggerPresence,
        (enabled) => enabled,
      );
    },
    wholeFieldValueHandler(field: string): FormEventHandler {
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
    wholeResourceExtraPresenceHandler(fieldKey: string) {
      return txExtraStringPresenceChangeHandler(
        (extra) => bindings.setWholeResourceExtra(extra as JsonObject),
        () => model?.rollbackPolicy?.wholeResource?.extra,
        fieldKey,
      );
    },
    wholeResourceExtraValueHandler(fieldKey: string) {
      return txExtraStringValueChangeHandler(
        (extra) => bindings.setWholeResourceExtra(extra as JsonObject),
        () => model?.rollbackPolicy?.wholeResource?.extra,
        fieldKey,
      );
    },
  };
}

function txBlockCommandBindings(
  command: TxCommandModel,
  onChange: ChangeHandler<Partial<TxCommandModel>>,
) {
  return {
    setExtra(extra: JsonObject): void {
      txBlockApplyChange(onChange, { extra });
    },
    setField(key: string, value: unknown): void {
      txBlockApplyChange(onChange, { [key]: value });
    },
    setTimeoutSecs(value: unknown): void {
      txBlockApplyChange(onChange, {
        timeout: txBlockNumberFormValue(value),
        hasTimeout: true,
      });
    },
    setTimeoutPresence(enabled: boolean): void {
      txBlockApplyChange(
        onChange,
        txBlockSetCommandTimeoutPresence(command, enabled),
      );
    },
  };
}

export function txBlockCommandEditorBindings(
  command: TxCommandModel,
  onChange: ChangeHandler<Partial<TxCommandModel>>,
) {
  const bindings = txBlockCommandBindings(command, onChange);
  return {
    fieldPresenceHandler(fieldKey: string): FormEventHandler | null {
      if (fieldKey !== "timeout") return null;
      return callbackMappedFormCheckedHandler(
        bindings.setTimeoutPresence,
        (enabled) => enabled,
      );
    },
    fieldValueHandler(fieldKey: string): FormEventHandler {
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
    metadataPresenceHandler(fieldKey: string): FormEventHandler {
      return callbackMappedFormCheckedHandler(
        (enabled) =>
          bindings.setExtra(
            txSetExtraStringFieldPresence(command.extra, fieldKey, enabled),
          ),
        (enabled) => enabled,
      );
    },
    metadataValueHandler(fieldKey: string): FormEventHandler {
      return callbackMappedFormValueHandler(
        (value) =>
          bindings.setExtra(
            txSetExtraStringFieldValue(command.extra, fieldKey, value),
          ),
        (value) => value,
      );
    },
    setExtra(extra: JsonObject): void {
      bindings.setExtra(extra);
    },
  };
}

function txBlockCommandDynParamsBindings(
  command: TxCommandModel,
  onChange: ChangeHandler<TxCommandModel>,
) {
  const applyCommandChange = <TArgs extends unknown[]>(
    mutation: ModelMutation<TxCommandModel, TArgs>,
  ) => txModelChangeHandler(command, onChange, mutation);
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

export function txBlockCommandDynParamsEditorBindings(
  command: TxCommandModel,
  onChange: ChangeHandler<TxCommandModel>,
) {
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
    extraParamKeyHandler(paramKey: string): FormEventHandler {
      return formValueHandler((nextKey) =>
        bindings.renameExtraParam(paramKey, nextKey),
      );
    },
    extraParamValueHandler(paramKey: string): FormEventHandler {
      return formValueHandler((paramValue) =>
        bindings.setExtraParamValue(paramKey, paramValue),
      );
    },
    removeExtraParamHandler(paramKey: string) {
      return () => bindings.removeExtraParam(paramKey);
    },
  };
}

export function txBlockOperationBindings(
  operation: TxOperationModel,
  onChange: ChangeHandler<TxOperationModel>,
) {
  return {
    setCommand(commandPatch: Partial<TxCommandModel>): void {
      txBlockApplyChange(
        onChange,
        txBlockPatchCommand(operation, commandPatch),
      );
    },
    setKind(kind: TxOperationKind): void {
      txBlockApplyChange(onChange, txBlockChangeOperationKind(operation, kind));
    },
  };
}

export function txBlockStepEditorBindings(
  _step: Partial<TxStepFormModel> = {},
  { onStepChange = null }: TxBlockStepEditorBindingOptions = {},
) {
  return {
    fieldPresenceHandler(fieldKey: string): FormEventHandler {
      return callbackMappedFormCheckedHandler(
        (enabled) =>
          typeof onStepChange === "function"
            ? onStepChange(fieldKey, enabled)
            : undefined,
        (enabled) => enabled,
      );
    },
    fieldValueHandler(_fieldKey: string): FormEventHandler {
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

function txBlockCommandInteractionBindings(
  command: TxCommandModel,
  onChange: ChangeHandler<TxCommandModel>,
) {
  const applyCommandChange = <TArgs extends unknown[]>(
    mutation: ModelMutation<TxCommandModel, TArgs>,
  ) => txModelChangeHandler(command, onChange, mutation);
  return {
    addPrompt: applyCommandChange(txBlockAddCommandPrompt),
    removePrompt: applyCommandChange(txBlockRemoveCommandPrompt),
    setInteractionExtra: applyCommandChange(
      txBlockPatchCommandInteractionExtra,
    ),
    setPromptExtra(promptIndex: number, extra: JsonObject): void {
      applyCommandChange(txBlockUpdateCommandPrompt)(promptIndex, { extra });
    },
    setPromptFieldPresence: applyCommandChange(
      txBlockSetCommandPromptFieldPresence,
    ),
    addPromptPattern: applyCommandChange(txBlockAddCommandPromptPattern),
    removePromptPattern: applyCommandChange(txBlockRemoveCommandPromptPattern),
    setPromptPatterns(promptIndex: number, patternText: unknown): void {
      applyCommandChange(txBlockUpdateCommandPrompt)(promptIndex, {
        patterns: txBlockCommandPromptPatternsFromText(patternText),
      });
    },
    setPromptPatternValue: applyCommandChange(
      txBlockSetCommandPromptPatternValue,
    ),
    setPromptRecordInput(promptIndex: number, value: unknown): void {
      applyCommandChange(txBlockUpdateCommandPrompt)(promptIndex, {
        recordInput: value === "true",
        hasRecordInput: true,
      });
    },
    setPromptResponse(promptIndex: number, response: string): void {
      applyCommandChange(txBlockUpdateCommandPrompt)(promptIndex, { response });
    },
  };
}

export function txBlockCommandInteractionEditorBindings(
  command: TxCommandModel,
  onChange: ChangeHandler<TxCommandModel>,
) {
  const bindings = txBlockCommandInteractionBindings(command, onChange);
  return {
    addPrompt: bindings.addPrompt,
    setInteractionExtra: bindings.setInteractionExtra,
    promptActionHandlers(promptIndex: number) {
      return {
        deletePromptAction() {
          return () => bindings.removePrompt(promptIndex);
        },
        addPatternAction() {
          return () => bindings.addPromptPattern(promptIndex);
        },
        extraChangeHandler() {
          return (extra: JsonObject) =>
            bindings.setPromptExtra(promptIndex, extra);
        },
        fieldPresenceHandler(fieldKey: string) {
          return (enabled: boolean) =>
            bindings.setPromptFieldPresence(promptIndex, fieldKey, enabled);
        },
        metadataPresenceHandler(fieldKey: string) {
          return (enabled: boolean) => {
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
        metadataValueHandler(fieldKey: string) {
          return (value: unknown) => {
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
          return (value: unknown) =>
            bindings.setPromptRecordInput(promptIndex, value);
        },
        patternValueHandler(patternIndex: number, value: unknown): void {
          bindings.setPromptPatternValue(promptIndex, patternIndex, value);
        },
        removePatternAction(patternIndex: number): void {
          bindings.removePromptPattern(promptIndex, patternIndex);
        },
        textValueHandler(fieldKey: string) {
          return fieldKey === "patterns"
            ? (value: string) => bindings.setPromptPatterns(promptIndex, value)
            : (value: string) => bindings.setPromptResponse(promptIndex, value);
        },
      };
    },
  };
}

function txBlockFlowBindings(
  operation: TxOperationModel,
  onChange: ChangeHandler<TxOperationModel>,
) {
  const applyFlowChange = <TArgs extends unknown[]>(
    mutation: ModelMutation<TxOperationModel, TArgs>,
  ) => txModelChangeHandler(operation, onChange, mutation);
  return {
    addStep: applyFlowChange(txBlockAddFlowStep),
    duplicateStep: applyFlowChange(txBlockDuplicateFlowStep),
    moveStep: applyFlowChange(txBlockMoveFlowStep),
    patchStep(stepIndex: number, patch: Partial<TxCommandModel>): void {
      const currentStep =
        operation.flow?.steps?.[stepIndex] || txBlockCommandDraft();
      applyFlowChange(txBlockUpdateFlowStep)(stepIndex, {
        ...currentStep,
        ...patch,
      });
    },
    removeStep: applyFlowChange(txBlockRemoveFlowStep),
    setExtra(extra: JsonObject): void {
      applyFlowChange(txBlockPatchFlow)({ extra });
    },
    setFieldPresence(field: string, enabled: boolean): void {
      const patch =
        field === "maxSteps"
          ? txBlockSetFlowMaxStepsPresence(operation.flow, enabled)
          : txBlockSetFlowFieldPresence(operation.flow, field, enabled);
      applyFlowChange(txBlockPatchFlow)(patch);
    },
    setMaxSteps(value: unknown): void {
      applyFlowChange(txBlockPatchFlow)({
        maxSteps: txBlockNumberFormValue(value),
        hasMaxSteps: true,
      });
    },
    setStopOnError(value: unknown): void {
      applyFlowChange(txBlockPatchFlow)({
        stopOnError: value === "true",
        hasStopOnError: true,
      });
    },
  };
}

export function txBlockFlowEditorBindings(
  operation: TxOperationModel,
  onChange: ChangeHandler<TxOperationModel>,
) {
  const bindings = txBlockFlowBindings(operation, onChange);
  return {
    addStep() {
      bindings.addStep();
    },
    duplicateStep(stepIndex: number): void {
      bindings.duplicateStep(stepIndex);
    },
    moveStep(fromIndex: number, toIndex: number): void {
      bindings.moveStep(fromIndex, toIndex);
    },
    patchStep(stepIndex: number, patch: Partial<TxCommandModel>): void {
      bindings.patchStep(stepIndex, patch);
    },
    removeStep(stepIndex: number): void {
      bindings.removeStep(stepIndex);
    },
    setExtra(extra: JsonObject): void {
      bindings.setExtra(extra);
    },
    setFieldPresence(field: string, enabled: boolean): void {
      bindings.setFieldPresence(field, enabled);
    },
    setMaxSteps(value: unknown): void {
      bindings.setMaxSteps(value);
    },
    setStopOnError(value: unknown): void {
      bindings.setStopOnError(value);
    },
    flowFieldPresenceHandler(fieldKey: string) {
      return (enabled: boolean) => bindings.setFieldPresence(fieldKey, enabled);
    },
    flowFieldValueHandler(fieldKey: string) {
      return fieldKey === "stopOnError"
        ? bindings.setStopOnError
        : bindings.setMaxSteps;
    },
    duplicateStepHandler(stepIndex: number) {
      return () => bindings.duplicateStep(stepIndex);
    },
    moveStepHandler(fromIndex: number, toIndex: number) {
      return () => bindings.moveStep(fromIndex, toIndex);
    },
    removeStepHandler(stepIndex: number) {
      return () => bindings.removeStep(stepIndex);
    },
    stepChangeHandler(stepIndex: number) {
      return (patch: Partial<TxCommandModel>) =>
        bindings.patchStep(stepIndex, patch);
    },
  };
}
