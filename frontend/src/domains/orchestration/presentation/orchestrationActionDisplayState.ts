import { t } from "../../../lib/i18n.js";
import { plainObject, stringValue } from "../../../lib/jsonValue.js";
import { orchestrationJsonFieldText } from "./orchestrationFormFieldState.js";
import type {
  JsonObject,
  OrchestrationOptionRow,
  OrchestrationTxWorkflowSettingsDisplay,
  OrchestrationTxWorkflowSettingsPanelDisplay,
  OrchestrationVisualEditorDisplay,
  OrchestrationWorkflowSourceMode,
} from "../model/types.js";

const orchestrationPlainObject = (value: unknown): value is JsonObject =>
  plainObject(value) === true;
const orchestrationStringValue = (value: unknown, fallback = ""): string =>
  stringValue(value, fallback);

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

function orchestrationNonEmptyText(value: unknown): string {
  return orchestrationStringValue(value).trim();
}

export function orchestrationTxWorkflowActionSourceValue(
  action: unknown = {},
): OrchestrationWorkflowSourceMode {
  const actionValue = orchestrationPlainObject(action) ? action : {};
  if (actionValue.workflow != null) return "workflow_json";
  if (actionValue.hasWorkflowTemplateName) return "workflow_template_name";
  if (orchestrationNonEmptyText(actionValue.workflowTemplateName)) {
    return "workflow_template_name";
  }
  return "workflow_json";
}

export function orchestrationTxWorkflowSourceDisplay(
  txWorkflow: unknown = {},
): OrchestrationWorkflowSourceDisplay {
  const workflowValue = orchestrationPlainObject(txWorkflow) ? txWorkflow : {};
  const sourceMode = orchestrationTxWorkflowActionSourceValue(workflowValue);
  const primaryField: OrchestrationWorkflowPrimaryField =
    sourceMode === "workflow_template_name"
      ? {
          controlType: "select",
          enabled: true,
          fieldKey: "workflowTemplateName",
          labelText: t("orchestrationFormWorkflowTemplateName"),
          placeholderText: t("orchestrationFormWorkflowTemplatePlaceholder"),
          showPresenceToggle: false,
          valueText: orchestrationStringValue(
            workflowValue.workflowTemplateName ?? "",
          ),
        }
      : {
          controlType: "textarea",
          editorKind: "json-text",
          enabled: true,
          fieldKey: "workflow",
          labelText: t("orchestrationFormWorkflowJson"),
          placeholderText: "",
          showPresenceToggle: false,
          valueText: workflowValue.workflow
            ? orchestrationJsonFieldText(workflowValue.workflow, {})
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
          source: orchestrationPlainObject(workflowValue.workflowVars)
            ? workflowValue.workflowVars
            : {},
        }
      : null,
  };
}

export function orchestrationTxWorkflowActionSettingsDisplay(
  txWorkflow: unknown = {},
  sourceRows: readonly string[] = [],
): OrchestrationTxWorkflowSettingsDisplay {
  const txWorkflowValue = orchestrationPlainObject(txWorkflow)
    ? txWorkflow
    : {};
  return {
    sourceField: {
      controlType: "select",
      enabled: true,
      fieldKey: "sourceValue",
      labelKey: "orchestrationFormActionSource",
      labelText: t("orchestrationFormActionSource"),
      optionRows: (Array.isArray(sourceRows) ? sourceRows : []).map(
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
      valueText: orchestrationTxWorkflowActionSourceValue(txWorkflowValue),
    },
  };
}

export function orchestrationTxWorkflowActionSettingsPanelDisplay(
  txWorkflow: unknown = {},
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
  txWorkflow: unknown = {},
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
