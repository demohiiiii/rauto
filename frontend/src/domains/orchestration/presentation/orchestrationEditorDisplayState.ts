import { t, tr } from "../../../lib/i18n.js";

export const orchestrationJsonPlaceholder =
  '{"name":"campus-rollout","stages":[{"name":"phase-1","strategy":"parallel","jobs":[]}]}';

export interface OrchestrationEditorRunPanelDisplay {
  editorTitle: string;
  executeButtonLabel: string;
  importButtonLabel: string;
  jsonHint: string;
  newButtonLabel: string;
  placeholderText: string;
  planButtonLabel: string;
}

export function orchestrationEditorRunPanelDisplay(
  jsonPlaceholder = "",
): OrchestrationEditorRunPanelDisplay {
  const placeholderText = tr("orchestrationJsonPlaceholder", jsonPlaceholder);
  return {
    editorTitle: t("orchestrationEditorTitle"),
    executeButtonLabel: t("orchestrationExecBtn"),
    importButtonLabel: t("orchestrationImportFileBtn"),
    jsonHint: t("orchestrationJsonHint"),
    newButtonLabel: t("newBtn"),
    placeholderText,
    planButtonLabel: t("orchestrationPlanBtn"),
  };
}
