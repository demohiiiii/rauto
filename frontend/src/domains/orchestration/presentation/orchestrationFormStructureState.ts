import { t } from "../../../lib/i18n.js";
import {
  orchestrationJobFieldsDisplay,
  orchestrationRootFieldsDisplay,
  orchestrationStageFieldsDisplay,
} from "./orchestrationFormFieldState.js";
import type {
  OrchestrationJobEditorDisplay,
  OrchestrationJobEditorRow,
  OrchestrationJobModel,
  OrchestrationJobSettingsPanelDisplay,
  OrchestrationJobTargetsDisplay,
  OrchestrationPlanFormModel,
  OrchestrationPlanSettingsPanelDisplay,
  OrchestrationStageEditorRow,
  OrchestrationStageSettingsPanelDisplay,
  OrchestrationStagesPanelDisplay,
  OrchestrationVisualEditorDisplay,
} from "../model/types.js";

interface OrchestrationTargetLabels {
  targetGroupLabelText?: string;
  targetLabelText?: string;
  targetTagLabelText?: string;
}

export function orchestrationPlanSettingsPanelDisplay(
  model: Partial<OrchestrationPlanFormModel> = {},
  visualDisplay: Partial<OrchestrationVisualEditorDisplay> = {},
): OrchestrationPlanSettingsPanelDisplay {
  return {
    rootFieldRows: orchestrationRootFieldsDisplay(
      model,
      visualDisplay.booleanRows ?? [],
    ),
  };
}

export function orchestrationJobEditorDisplay(
  jobRow: Partial<OrchestrationJobEditorRow> = {},
): OrchestrationJobEditorDisplay {
  return {
    removeButtonLabel: t("deleteBtn"),
    titleText:
      jobRow.titleText ||
      `${t("orchestrationFormJob")} ${(jobRow.jobIndex ?? 0) + 1}`,
  };
}

export function orchestrationStageSettingsPanelDisplay(
  stageRow: Partial<OrchestrationStageEditorRow> = {},
  visualDisplay: Partial<OrchestrationVisualEditorDisplay> = {},
): OrchestrationStageSettingsPanelDisplay {
  return {
    fieldRows: orchestrationStageFieldsDisplay(
      stageRow.stage ?? {},
      visualDisplay.strategyRows ?? [],
      visualDisplay.booleanRows ?? [],
    ),
  };
}

export function orchestrationJobSettingsPanelDisplay(
  job: Partial<OrchestrationJobModel> = {},
  visualDisplay: Partial<OrchestrationVisualEditorDisplay> = {},
): OrchestrationJobSettingsPanelDisplay {
  return {
    fieldRows: orchestrationJobFieldsDisplay(
      job,
      visualDisplay.strategyRows ?? [],
      visualDisplay.booleanRows ?? [],
    ),
  };
}

export function orchestrationJobTargetsDisplay(
  _jobRow: Partial<OrchestrationJobEditorRow> = {},
  {
    targetGroupLabelText = "",
    targetTagLabelText = "",
    targetLabelText = "",
  }: OrchestrationTargetLabels = {},
): OrchestrationJobTargetsDisplay {
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
