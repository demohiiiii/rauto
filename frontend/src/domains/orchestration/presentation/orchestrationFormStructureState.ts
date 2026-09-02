import { t } from "../../../lib/i18n.js";
import { plainObject, stringValue } from "../../../lib/jsonValue.js";
import {
  orchestrationJobFieldsDisplay,
  orchestrationRootFieldsDisplay,
  orchestrationStageFieldsDisplay,
} from "./orchestrationFormFieldState.js";
import type {
  JsonObject,
  OrchestrationJobSettingsPanelDisplay,
  OrchestrationPlanSettingsPanelDisplay,
  OrchestrationStageSettingsPanelDisplay,
  OrchestrationStagesPanelDisplay,
  OrchestrationVisualEditorDisplay,
} from "../model/types.js";

const orchestrationPlainObject = (value: unknown): value is JsonObject =>
  plainObject(value) === true;
const orchestrationStringValue = (value: unknown, fallback = ""): string =>
  stringValue(value, fallback);

interface OrchestrationTargetLabels {
  targetGroupLabelText?: string;
  targetLabelText?: string;
  targetTagLabelText?: string;
}

export function orchestrationPlanSettingsPanelDisplay(
  model: unknown = {},
  visualDisplay: unknown = {},
): OrchestrationPlanSettingsPanelDisplay {
  const planValue = orchestrationPlainObject(model) ? model : {};
  const displayValue = orchestrationPlainObject(visualDisplay)
    ? visualDisplay
    : {};
  return {
    rootFieldRows: orchestrationRootFieldsDisplay(
      planValue,
      Array.isArray(displayValue.booleanRows) ? displayValue.booleanRows : [],
    ),
  };
}

export function orchestrationJobEditorDisplay(
  jobRow: unknown = {},
): JsonObject {
  const row = orchestrationPlainObject(jobRow) ? jobRow : {};
  return {
    removeButtonLabel: t("deleteBtn"),
    titleText:
      orchestrationStringValue(row.titleText) ||
      `${t("orchestrationFormJob")} ${
        (typeof row.jobIndex === "number" ? row.jobIndex : 0) + 1
      }`,
  };
}

export function orchestrationStageSettingsPanelDisplay(
  stageRow: unknown = {},
  visualDisplay: unknown = {},
): OrchestrationStageSettingsPanelDisplay {
  const row = orchestrationPlainObject(stageRow) ? stageRow : {};
  const displayValue = orchestrationPlainObject(visualDisplay)
    ? visualDisplay
    : {};
  const stageValue = orchestrationPlainObject(row.stage) ? row.stage : {};
  return {
    fieldRows: orchestrationStageFieldsDisplay(
      stageValue,
      Array.isArray(displayValue.strategyRows) ? displayValue.strategyRows : [],
      Array.isArray(displayValue.booleanRows) ? displayValue.booleanRows : [],
    ),
  };
}

export function orchestrationJobSettingsPanelDisplay(
  job: unknown = {},
  visualDisplay: unknown = {},
): OrchestrationJobSettingsPanelDisplay {
  const jobValue = orchestrationPlainObject(job) ? job : {};
  const displayValue = orchestrationPlainObject(visualDisplay)
    ? visualDisplay
    : {};
  return {
    fieldRows: orchestrationJobFieldsDisplay(
      jobValue,
      Array.isArray(displayValue.strategyRows) ? displayValue.strategyRows : [],
      Array.isArray(displayValue.booleanRows) ? displayValue.booleanRows : [],
    ),
  };
}

export function orchestrationJobTargetsDisplay(
  _jobRow: unknown = {},
  {
    targetGroupLabelText = "",
    targetTagLabelText = "",
    targetLabelText = "",
  }: OrchestrationTargetLabels = {},
): JsonObject {
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

export const orchestrationEditorRunButtonDisplayPresentation = <T>(
  display: T = {} as T,
): T => display;

export function orchestrationStagesPanelDisplay(
  visualDisplay: OrchestrationVisualEditorDisplay,
): OrchestrationStagesPanelDisplay {
  return {
    addStageButtonLabel: t("orchestrationFormAddStage"),
    stageRows: visualDisplay.stageRows,
    titleText: t("orchestrationFormStage"),
  };
}
