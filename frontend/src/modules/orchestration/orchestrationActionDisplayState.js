import { t } from "../../lib/i18n.js";
import { plainObject, stringValue } from "../../lib/jsonValue.js";
import { orchestrationJsonFieldText } from "./orchestrationFormDisplayState.js";

const orchestrationPlainObject = plainObject;
const orchestrationStringValue = stringValue;

function orchestrationNonEmptyText(value) {
  return orchestrationStringValue(value).trim();
}

export function orchestrationTxWorkflowActionSourceValue(action = {}) {
  if (action.workflow != null) return "workflow_json";
  if (action.hasWorkflowTemplateName) return "workflow_template_name";
  if (orchestrationNonEmptyText(action.workflowTemplateName)) {
    return "workflow_template_name";
  }
  return "workflow_json";
}

export function orchestrationTxWorkflowSourceDisplay(txWorkflow = {}) {
  const workflowValue = orchestrationPlainObject(txWorkflow) ? txWorkflow : {};
  const sourceMode = orchestrationTxWorkflowActionSourceValue(workflowValue);
  const primaryField =
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
  txWorkflow = {},
  sourceRows = [],
) {
  const txWorkflowValue = orchestrationPlainObject(txWorkflow)
    ? txWorkflow
    : {};
  return {
    sourceField: {
      controlType: "select",
      enabled: true,
      fieldKey: "sourceValue",
      labelText: t("orchestrationFormActionSource"),
      optionRows: (Array.isArray(sourceRows) ? sourceRows : []).map(
        (optionValue) => ({
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
  txWorkflow = {},
  visualDisplay = {},
) {
  return {
    settingsDisplay: orchestrationTxWorkflowActionSettingsDisplay(
      txWorkflow,
      visualDisplay.txWorkflowActionSourceRows || [],
    ),
  };
}

export function orchestrationTxWorkflowSourcePanelDisplay(txWorkflow = {}) {
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
