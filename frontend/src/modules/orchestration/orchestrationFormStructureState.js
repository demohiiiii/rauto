import { t } from "../../lib/i18n.js";
import { plainObject, stringValue } from "../../lib/jsonValue.js";
import {
  orchestrationJobFieldsDisplay,
  orchestrationRootFieldsDisplay,
  orchestrationStageFieldsDisplay,
} from "./orchestrationFormFieldState.js";

const orchestrationPlainObject = plainObject;
const orchestrationStringValue = stringValue;

export function orchestrationPlanSettingsPanelDisplay(
  model = {},
  visualDisplay = {},
) {
  const planValue = orchestrationPlainObject(model) ? model : {};
  return {
    rootFieldRows: orchestrationRootFieldsDisplay(
      planValue,
      Array.isArray(visualDisplay.booleanRows) ? visualDisplay.booleanRows : [],
    ),
  };
}

export function orchestrationJobEditorDisplay(jobRow = {}) {
  return {
    removeButtonLabel: t("deleteBtn"),
    titleText:
      orchestrationStringValue(jobRow.titleText) ||
      `${t("orchestrationFormJob")} ${(jobRow.jobIndex ?? 0) + 1}`,
  };
}

export function orchestrationStageSettingsPanelDisplay(
  stageRow = {},
  visualDisplay = {},
) {
  const stageValue = orchestrationPlainObject(stageRow.stage)
    ? stageRow.stage
    : {};
  return {
    fieldRows: orchestrationStageFieldsDisplay(
      stageValue,
      Array.isArray(visualDisplay.strategyRows)
        ? visualDisplay.strategyRows
        : [],
      Array.isArray(visualDisplay.booleanRows) ? visualDisplay.booleanRows : [],
    ),
  };
}

export function orchestrationJobSettingsPanelDisplay(
  job = {},
  visualDisplay = {},
) {
  const jobValue = orchestrationPlainObject(job) ? job : {};
  return {
    fieldRows: orchestrationJobFieldsDisplay(
      jobValue,
      Array.isArray(visualDisplay.strategyRows)
        ? visualDisplay.strategyRows
        : [],
      Array.isArray(visualDisplay.booleanRows) ? visualDisplay.booleanRows : [],
    ),
  };
}

export function orchestrationJobTargetsDisplay(
  _jobRow = {},
  {
    targetGroupLabelText = "",
    targetTagLabelText = "",
    targetLabelText = "",
  } = {},
) {
  return {
    targetGroupsField: {
      labelText: targetGroupLabelText,
      placeholderText: targetGroupLabelText,
    },
    targetTagsField: {
      labelText: targetTagLabelText,
      placeholderText: targetTagLabelText,
    },
    targetsField: {
      labelText: targetLabelText,
      placeholderText: targetLabelText,
    },
  };
}

export const orchestrationEditorRunButtonDisplayPresentation = (display = {}) =>
  display;

export function orchestrationStagesPanelDisplay(visualDisplay = {}) {
  return {
    addStageButtonLabel: t("orchestrationFormAddStage"),
    stageRows: Array.isArray(visualDisplay.stageRows)
      ? visualDisplay.stageRows
      : [],
    titleText: t("orchestrationFormStage"),
  };
}
