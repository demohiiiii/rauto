import { t } from "../../../lib/i18n.js";
import { orchestrationJsonFieldText } from "./orchestrationFormFieldState.js";
import type {
  JsonObject,
  OrchestrationOptionRow,
  OrchestrationTxWorkflowActionModel,
  OrchestrationTxWorkflowSettingsDisplay,
  OrchestrationTxWorkflowSettingsPanelDisplay,
  OrchestrationVisualEditorDisplay,
  OrchestrationWorkflowSourceMode,
} from "../model/types.js";

export interface OrchestrationWorkflowPrimaryField extends JsonObject {
  controlType: "input" | "select" | "textarea";
  enabled: boolean;
  fieldKey: string;
  labelText: string;
  placeholderText: string;
  showPresenceToggle: boolean;
  valueText: string;
}

export interface OrchestrationWorkflowVarsField extends JsonObject {
  fieldKey: "workflowVars";
  labelText: string;
  present: boolean;
  source: JsonObject;
}

export interface OrchestrationWorkflowSourceDisplay extends JsonObject {
  primaryField: OrchestrationWorkflowPrimaryField;
  showWorkflowVars: boolean;
  sourceMode: OrchestrationWorkflowSourceMode;
  varsField: OrchestrationWorkflowVarsField | null;
}

export interface OrchestrationTxWorkflowSourcePanelDisplay extends OrchestrationWorkflowSourceDisplay {
  primaryFieldHandlerKey: "json" | "templateName";
  showInputField: boolean;
  showJsonTextField: boolean;
  showTextAreaField: boolean;
  showVarsField: boolean;
  varsFieldHandlerKey: "" | "workflowVars";
}

function orchestrationNonEmptyText(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

export function orchestrationTxWorkflowActionSourceValue(
  action: Partial<OrchestrationTxWorkflowActionModel> = {},
): OrchestrationWorkflowSourceMode {
  if (action.workflow != null) return "workflow_json";
  if (action.hasWorkflowTemplateName) return "workflow_template_name";
  if (orchestrationNonEmptyText(action.workflowTemplateName)) {
    return "workflow_template_name";
  }
  return "workflow_json";
}

export function orchestrationTxWorkflowSourceDisplay(
  txWorkflow: Partial<OrchestrationTxWorkflowActionModel> = {},
): OrchestrationWorkflowSourceDisplay {
  const sourceMode = orchestrationTxWorkflowActionSourceValue(txWorkflow);
  const primaryField: OrchestrationWorkflowPrimaryField =
    sourceMode === "workflow_template_name"
      ? {
          controlType: "select",
          enabled: true,
          fieldKey: "workflowTemplateName",
          labelText: t("orchestrationFormWorkflowTemplateName"),
          placeholderText: t("orchestrationFormWorkflowTemplatePlaceholder"),
          showPresenceToggle: false,
          valueText: txWorkflow.workflowTemplateName ?? "",
        }
      : {
          controlType: "textarea",
          editorKind: "json-text",
          enabled: true,
          fieldKey: "workflow",
          labelText: t("orchestrationFormWorkflowJson"),
          placeholderText: "",
          showPresenceToggle: false,
          valueText: txWorkflow.workflow
            ? orchestrationJsonFieldText(txWorkflow.workflow, {})
            : "",
        };
  const showWorkflowVars = sourceMode === "workflow_template_name";
  return {
    primaryField,
    showWorkflowVars,
    sourceMode,
    varsField: showWorkflowVars
      ? {
          fieldKey: "workflowVars",
          labelText: t("orchestrationFormWorkflowVars"),
          present: true,
          source: txWorkflow.workflowVars ?? {},
        }
      : null,
  };
}

export function orchestrationTxWorkflowActionSettingsDisplay(
  txWorkflow: Partial<OrchestrationTxWorkflowActionModel> = {},
  sourceRows: readonly OrchestrationWorkflowSourceMode[] = [],
): OrchestrationTxWorkflowSettingsDisplay {
  return {
    sourceField: {
      controlType: "select",
      enabled: true,
      fieldKey: "sourceValue",
      labelKey: "orchestrationFormActionSource",
      labelText: t("orchestrationFormActionSource"),
      optionRows: sourceRows.map(
        (optionValue): OrchestrationOptionRow => ({
          optionLabel:
            optionValue === "workflow_json"
              ? t("orchestrationTxWorkflowSourceJson")
              : t("orchestrationTxWorkflowSourceTemplateName"),
          optionValue,
        }),
      ),
      placeholderText: "",
      showPresenceToggle: false,
      valueText: orchestrationTxWorkflowActionSourceValue(txWorkflow),
    },
  };
}

export function orchestrationTxWorkflowActionSettingsPanelDisplay(
  txWorkflow: Partial<OrchestrationTxWorkflowActionModel> = {},
  visualDisplay: OrchestrationVisualEditorDisplay,
): OrchestrationTxWorkflowSettingsPanelDisplay {
  return {
    settingsDisplay: orchestrationTxWorkflowActionSettingsDisplay(
      txWorkflow,
      visualDisplay.txWorkflowActionSourceRows,
    ),
  };
}

export function orchestrationTxWorkflowSourcePanelDisplay(
  txWorkflow: Partial<OrchestrationTxWorkflowActionModel> = {},
): OrchestrationTxWorkflowSourcePanelDisplay {
  const sourceDisplay = orchestrationTxWorkflowSourceDisplay(txWorkflow);
  return {
    ...sourceDisplay,
    primaryFieldHandlerKey:
      sourceDisplay.primaryField.fieldKey === "workflowTemplateName"
        ? "templateName"
        : "json",
    showInputField: sourceDisplay.primaryField.controlType === "input",
    showJsonTextField: sourceDisplay.primaryField.controlType !== "input",
    showTextAreaField: sourceDisplay.primaryField.controlType !== "input",
    showVarsField:
      !!sourceDisplay.showWorkflowVars && !!sourceDisplay.varsField,
    varsFieldHandlerKey: sourceDisplay.varsField ? "workflowVars" : "",
  };
}
