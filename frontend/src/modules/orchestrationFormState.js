import { callIfFunction, formChecked, formValue } from "../lib/events.js";
import {
  txSetExtraStringFieldPresence,
  txSetExtraStringFieldValue,
} from "./transactionMetadataFields.js";

function orchestrationInputValue(value, fallback = "") {
  return value && typeof value === "object" && "currentTarget" in value
    ? formValue(value, fallback)
    : (value ?? fallback);
}

function orchestrationInputChecked(value) {
  return value && typeof value === "object" && "currentTarget" in value
    ? formChecked(value)
    : !!value;
}

export function orchestrationExtraStringValueChangeHandler(
  callback,
  extraSource,
  fieldKey,
  wrapResult = (extra) => extra,
) {
  return (value) =>
    callIfFunction(
      callback,
      wrapResult(
        txSetExtraStringFieldValue(
          typeof extraSource === "function" ? extraSource() : extraSource,
          fieldKey,
          orchestrationInputValue(value),
        ),
      ),
    );
}

export function orchestrationExtraStringPresenceChangeHandler(
  callback,
  extraSource,
  fieldKey,
  wrapResult = (extra) => extra,
) {
  return (enabled) =>
    callIfFunction(
      callback,
      wrapResult(
        txSetExtraStringFieldPresence(
          typeof extraSource === "function" ? extraSource() : extraSource,
          fieldKey,
          orchestrationInputChecked(enabled),
        ),
      ),
    );
}

export function orchestrationPatchValueChangeHandler(
  callback,
  patchFactory = (value) => value,
) {
  return (value) =>
    callIfFunction(callback, patchFactory(orchestrationInputValue(value)));
}

export function orchestrationPatchPresenceChangeHandler(
  callback,
  patchFactory = (enabled) => enabled,
) {
  return (enabled) =>
    callIfFunction(callback, patchFactory(orchestrationInputChecked(enabled)));
}
export {
  orchestrationCloneFormModel,
  orchestrationCreateJobModel,
  orchestrationCreateStageModel,
  orchestrationCreateTxWorkflowActionModel,
  orchestrationPatchJobDraft,
  orchestrationPlanFormModelFromJson,
  orchestrationPlanFormModelFromJsonText,
  orchestrationPlanFormModelToJsonText,
} from "./orchestrationPlanFormModels.js";

export {
  orchestrationConnectionTextValue,
  orchestrationJsonFieldValue,
  orchestrationJsonObjectPatchResult,
  orchestrationJsonPatchResult,
  orchestrationNullableFieldModePatch,
  orchestrationNullableTextValue,
  orchestrationObjectExtra,
  orchestrationToggleNullableFieldPresence,
  orchestrationToggleObjectFieldPresence,
} from "./orchestrationTargetFormModels.js";
