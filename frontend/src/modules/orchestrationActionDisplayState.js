import { t } from "../lib/i18n.js";
import {
  nullableNumberValue,
  plainObject,
  stringValue,
} from "../lib/jsonValue.js";
import { selectOptionsWithCurrent } from "../lib/ui.js";
import { txExtraStringFieldRows } from "./transactionMetadataFields.js";
import {
  ORCHESTRATION_TX_BLOCK_DIRECT_METADATA_FIELD_DEFS,
  ORCHESTRATION_TX_BLOCK_EXECUTION_FIELD_DEFS,
  ORCHESTRATION_TX_BLOCK_FLOW_METADATA_FIELD_DEFS,
  ORCHESTRATION_TX_BLOCK_TEMPLATE_METADATA_FIELD_DEFS,
  ORCHESTRATION_TX_WORKFLOW_METADATA_FIELD_DEFS,
  orchestrationJsonFieldText,
  orchestrationNullableModeRows,
  orchestrationTextListRows,
} from "./orchestrationFormDisplayState.js";

const orchestrationPlainObject = plainObject;
const orchestrationStringValue = stringValue;
const orchestrationNullableNumberValue = nullableNumberValue;

function orchestrationNonEmptyText(value) {
  return orchestrationStringValue(value).trim();
}

function orchestrationTxBlockActionSourceValue(action = {}) {
  if (action.hasTxBlockTemplateName) {
    return "tx_block_template_name";
  }
  if (orchestrationNonEmptyText(action.txBlockTemplateName)) {
    return "tx_block_template_name";
  }
  if (action.hasTxBlockTemplateContent) {
    return "tx_block_template_content";
  }
  if (orchestrationNonEmptyText(action.txBlockTemplateContent)) {
    return "tx_block_template_content";
  }
  if (action.hasFlowTemplateName) {
    return "flow_template_name";
  }
  if (orchestrationNonEmptyText(action.flowTemplateName)) {
    return "flow_template_name";
  }
  if (action.hasFlowTemplateContent) {
    return "flow_template_content";
  }
  if (orchestrationNonEmptyText(action.flowTemplateContent)) {
    return "flow_template_content";
  }
  return "direct";
}

export function orchestrationTxWorkflowActionSourceValue(action = {}) {
  if (action.workflow != null) return "workflow_json";
  if (action.hasWorkflowFile) return "workflow_file";
  if (orchestrationNonEmptyText(action.workflowFile)) return "workflow_file";
  if (action.hasWorkflowTemplateName) {
    return "workflow_template_name";
  }
  if (orchestrationNonEmptyText(action.workflowTemplateName)) {
    return "workflow_template_name";
  }
  if (action.hasWorkflowTemplateContent) {
    return "workflow_template_content";
  }
  if (orchestrationNonEmptyText(action.workflowTemplateContent)) {
    return "workflow_template_content";
  }
  return "workflow_json";
}

export function orchestrationTxWorkflowSourceDisplay(txWorkflow = {}) {
  const workflowValue = orchestrationPlainObject(txWorkflow) ? txWorkflow : {};
  const sourceMode = orchestrationTxWorkflowActionSourceValue(workflowValue);
  const nullableModeRows = orchestrationNullableModeRows();
  const primaryField =
    sourceMode === "workflow_file"
      ? {
          controlType: "input",
          enabled:
            !!workflowValue.hasWorkflowFile ||
            workflowValue.workflowFile !== null,
          fieldKey: "workflowFile",
          inputType: "text",
          labelText: t("orchestrationFormWorkflowFile"),
          nullableModeRows,
          nullableModeValue:
            workflowValue.workflowFile === null ? "null" : "value",
          placeholderText: "",
          showNullableModeSelect:
            !!workflowValue.hasWorkflowFile ||
            workflowValue.workflowFile !== null,
          showPresenceToggle: true,
          valueText: orchestrationStringValue(workflowValue.workflowFile ?? ""),
        }
      : sourceMode === "workflow_template_name"
        ? {
            controlType: "input",
            enabled:
              !!workflowValue.hasWorkflowTemplateName ||
              workflowValue.workflowTemplateName !== null,
            fieldKey: "workflowTemplateName",
            inputType: "text",
            labelText: t("orchestrationFormWorkflowTemplateName"),
            nullableModeRows,
            nullableModeValue:
              workflowValue.workflowTemplateName === null ? "null" : "value",
            placeholderText: "",
            showNullableModeSelect:
              !!workflowValue.hasWorkflowTemplateName ||
              workflowValue.workflowTemplateName !== null,
            showPresenceToggle: true,
            valueText: orchestrationStringValue(
              workflowValue.workflowTemplateName ?? "",
            ),
          }
        : sourceMode === "workflow_template_content"
          ? {
              controlType: "textarea",
              editorKind: "json-text",
              enabled:
                !!workflowValue.hasWorkflowTemplateContent ||
                workflowValue.workflowTemplateContent !== null,
              fieldKey: "workflowTemplateContent",
              labelText: t("orchestrationFormWorkflowTemplateContent"),
              placeholderText: "",
              showPresenceToggle: true,
              valueText: orchestrationStringValue(
                workflowValue.workflowTemplateContent ?? "",
              ),
            }
          : {
              controlType: "textarea",
              editorKind: "json-text",
              enabled:
                !!workflowValue.hasWorkflow || workflowValue.workflow !== null,
              fieldKey: "workflow",
              labelText: t("orchestrationFormWorkflowJson"),
              placeholderText: "",
              showPresenceToggle: true,
              valueText: workflowValue.workflow
                ? orchestrationJsonFieldText(workflowValue.workflow, {})
                : "",
            };
  const showWorkflowVars =
    sourceMode === "workflow_template_name" ||
    sourceMode === "workflow_template_content";
  const varsField = showWorkflowVars
    ? {
        fieldKey: "workflowVars",
        labelText: t("orchestrationFormWorkflowVars"),
        present:
          !!workflowValue.hasWorkflowVars ||
          Object.keys(workflowValue.workflowVars || {}).length > 0,
        source: orchestrationPlainObject(workflowValue.workflowVars)
          ? workflowValue.workflowVars
          : {},
      }
    : null;
  return {
    primaryField,
    showWorkflowVars,
    sourceMode,
    varsField,
  };
}

export function orchestrationTxBlockActionRows(
  action = {},
  stageIndex,
  jobIndex,
) {
  return {
    commandRows: orchestrationTextListRows(action.commands),
    flowVarsText: orchestrationJsonFieldText(action.flowVars, {}),
    jobIndex,
    rollbackCommandRows: orchestrationTextListRows(action.rollbackCommands),
    sourceValue: orchestrationTxBlockActionSourceValue(action),
    stageIndex,
    txBlockTemplateVarsText: orchestrationJsonFieldText(
      action.txBlockTemplateVars,
      {},
    ),
    varsText: orchestrationJsonFieldText(action.vars, {}),
  };
}

export function orchestrationTxBlockTemplateSourceDisplay(
  txBlock = {},
  txBlockRows = {},
) {
  const txBlockValue = orchestrationPlainObject(txBlock) ? txBlock : {};
  const nullableModeRows = orchestrationNullableModeRows();
  const sourceMode =
    orchestrationNonEmptyText(txBlockValue.txBlockTemplateName) ||
    (!orchestrationNonEmptyText(txBlockValue.txBlockTemplateContent) &&
      txBlockValue.hasTxBlockTemplateName)
      ? "tx_block_template_name"
      : "tx_block_template_content";
  const primaryField =
    sourceMode === "tx_block_template_name"
      ? {
          controlType: "input",
          enabled:
            !!txBlockValue.hasTxBlockTemplateName ||
            txBlockValue.txBlockTemplateName !== null,
          fieldKey: "txBlockTemplateName",
          inputType: "text",
          labelText: t("orchestrationFormTxBlockTemplateName"),
          nullableModeRows,
          nullableModeValue:
            txBlockValue.txBlockTemplateName === null ? "null" : "value",
          placeholderText: "",
          showNullableModeSelect:
            !!txBlockValue.hasTxBlockTemplateName ||
            txBlockValue.txBlockTemplateName !== null,
          showPresenceToggle: true,
          valueText: orchestrationStringValue(
            txBlockValue.txBlockTemplateName ?? "",
          ),
        }
      : {
          controlType: "textarea",
          editorKind: "json-text",
          enabled:
            !!txBlockValue.hasTxBlockTemplateContent ||
            txBlockValue.txBlockTemplateContent !== null,
          fieldKey: "txBlockTemplateContent",
          labelText: t("orchestrationFormTxBlockTemplateContent"),
          placeholderText: "",
          showPresenceToggle: true,
          valueText: orchestrationStringValue(
            txBlockValue.txBlockTemplateContent ?? "",
          ),
        };
  return {
    primaryField,
    sourceMode,
    varsField: {
      editorKind: "json-text",
      fieldKey: "txBlockTemplateVars",
      labelText: t("orchestrationFormTxBlockTemplateVars"),
      present:
        !!txBlockValue.hasTxBlockTemplateVars ||
        Object.keys(txBlockValue.txBlockTemplateVars || {}).length > 0,
      source: orchestrationPlainObject(txBlockValue.txBlockTemplateVars)
        ? txBlockValue.txBlockTemplateVars
        : {},
      valueText: orchestrationStringValue(
        txBlockRows.txBlockTemplateVarsText ?? "{}",
      ),
    },
  };
}

export function orchestrationTxBlockFlowSourceDisplay(
  txBlock = {},
  txBlockRows = {},
) {
  const txBlockValue = orchestrationPlainObject(txBlock) ? txBlock : {};
  const nullableModeRows = orchestrationNullableModeRows();
  const sourceMode =
    orchestrationNonEmptyText(txBlockValue.flowTemplateName) ||
    (!orchestrationNonEmptyText(txBlockValue.flowTemplateContent) &&
      txBlockValue.hasFlowTemplateName)
      ? "flow_template_name"
      : "flow_template_content";
  const primaryField =
    sourceMode === "flow_template_name"
      ? {
          controlType: "input",
          enabled:
            !!txBlockValue.hasFlowTemplateName ||
            txBlockValue.flowTemplateName !== null,
          fieldKey: "flowTemplateName",
          inputType: "text",
          labelText: t("orchestrationFormFlowTemplateName"),
          nullableModeRows,
          nullableModeValue:
            txBlockValue.flowTemplateName === null ? "null" : "value",
          placeholderText: "",
          showNullableModeSelect:
            !!txBlockValue.hasFlowTemplateName ||
            txBlockValue.flowTemplateName !== null,
          showPresenceToggle: true,
          valueText: orchestrationStringValue(
            txBlockValue.flowTemplateName ?? "",
          ),
        }
      : {
          controlType: "textarea",
          editorKind: "textarea",
          enabled:
            !!txBlockValue.hasFlowTemplateContent ||
            txBlockValue.flowTemplateContent !== null,
          fieldKey: "flowTemplateContent",
          labelText: t("orchestrationFormFlowTemplateContent"),
          placeholderText: "",
          showPresenceToggle: true,
          valueText: orchestrationStringValue(
            txBlockValue.flowTemplateContent ?? "",
          ),
        };
  return {
    flowVarsField: {
      editorKind: "json-text",
      fieldKey: "flowVars",
      labelText: t("orchestrationFormFlowVars"),
      present:
        !!txBlockValue.hasFlowVars ||
        Object.keys(txBlockValue.flowVars || {}).length > 0,
      source: orchestrationPlainObject(txBlockValue.flowVars)
        ? txBlockValue.flowVars
        : {},
      valueText: orchestrationStringValue(txBlockRows.flowVarsText ?? "{}"),
    },
    primaryField,
    rollbackCommandsField: {
      fieldKey: "rollbackCommands",
      itemRows: Array.isArray(txBlockRows.rollbackCommandRows)
        ? txBlockRows.rollbackCommandRows
        : [],
      labelText: t("txBlockFormRollbackOperation"),
      present:
        !!txBlockValue.hasRollbackCommands ||
        (Array.isArray(txBlockValue.rollbackCommands) &&
          txBlockValue.rollbackCommands.length > 0),
    },
    sourceMode,
  };
}

export function orchestrationTxBlockFlowSourcePanelDisplay(
  txBlock = {},
  txBlockRows = {},
) {
  const sourceDisplay = orchestrationTxBlockFlowSourceDisplay(
    txBlock,
    txBlockRows,
  );
  return {
    ...sourceDisplay,
    primaryFieldHandlerKey:
      sourceDisplay.primaryField.fieldKey === "flowTemplateName"
        ? "templateName"
        : "templateContent",
    rollbackCommandsFieldHandlerKey: "rollbackCommands",
    showInputField: sourceDisplay.primaryField.controlType === "input",
    showTextAreaField: sourceDisplay.primaryField.controlType !== "input",
    varsFieldHandlerKey: "flowVars",
  };
}

export function orchestrationTxBlockActionSettingsDisplay(
  txBlock = {},
  sourceRows = [],
) {
  const txBlockValue = orchestrationPlainObject(txBlock) ? txBlock : {};
  return {
    nameField: {
      controlType: "input",
      enabled: !!txBlockValue.hasName || txBlockValue.name !== null,
      fieldKey: "name",
      inputType: "text",
      labelText: t("orchestrationFormActionName"),
      placeholderText: "",
      showPresenceToggle: true,
      valueText: orchestrationStringValue(txBlockValue.name ?? ""),
    },
    sourceField: {
      controlType: "select",
      enabled: true,
      fieldKey: "sourceValue",
      labelText: t("orchestrationFormActionSource"),
      optionRows: (Array.isArray(sourceRows) ? sourceRows : []).map(
        (optionValue) => ({
          optionLabel:
            optionValue === "direct"
              ? t("orchestrationTxBlockSourceDirect")
              : optionValue === "tx_block_template_name"
                ? t("orchestrationTxBlockSourceTemplateName")
                : optionValue === "tx_block_template_content"
                  ? t("orchestrationTxBlockSourceTemplateContent")
                  : optionValue === "flow_template_name"
                    ? t("orchestrationTxBlockSourceFlowTemplateName")
                    : t("orchestrationTxBlockSourceFlowTemplateContent"),
          optionValue,
        }),
      ),
      placeholderText: "",
      showPresenceToggle: false,
      valueText: orchestrationTxBlockActionSourceValue(txBlockValue),
    },
  };
}

export function orchestrationTxBlockExecutionFieldsDisplay(
  txBlock = {},
  booleanRows = [],
  { showMode = true } = {},
) {
  const txBlockValue = orchestrationPlainObject(txBlock) ? txBlock : {};
  return ORCHESTRATION_TX_BLOCK_EXECUTION_FIELD_DEFS.filter(
    (fieldDef) => showMode || fieldDef.fieldKey !== "mode",
  ).map((fieldDef) => {
    const presenceKey = `has${fieldDef.fieldKey[0].toUpperCase()}${fieldDef.fieldKey.slice(1)}`;
    if (fieldDef.optionKind === "boolean") {
      return {
        ...fieldDef,
        enabled:
          !!txBlockValue[presenceKey] || !!txBlockValue.rollbackOnFailure,
        labelText: t(fieldDef.labelKey),
        optionRows: selectOptionsWithCurrent(
          booleanRows,
          txBlockValue.rollbackOnFailure ? "true" : "false",
        ).map((optionValue) => ({
          optionLabel: optionValue,
          optionValue,
        })),
        placeholderText: "",
        showPresenceToggle: true,
        valueText: txBlockValue.rollbackOnFailure ? "true" : "false",
      };
    }
    const valueText =
      fieldDef.inputType === "number"
        ? (orchestrationNullableNumberValue(txBlockValue[fieldDef.fieldKey]) ??
          "")
        : orchestrationStringValue(txBlockValue[fieldDef.fieldKey] ?? "");
    return {
      ...fieldDef,
      enabled:
        !!txBlockValue[presenceKey] || txBlockValue[fieldDef.fieldKey] !== null,
      labelText: t(fieldDef.labelKey),
      placeholderText: "",
      showPresenceToggle: true,
      valueText,
    };
  });
}

export function orchestrationTxBlockDirectSourceDisplay(
  txBlock = {},
  txBlockRows = {},
) {
  const txBlockValue = orchestrationPlainObject(txBlock) ? txBlock : {};
  return {
    commandsField: {
      fieldKey: "commands",
      itemRows: Array.isArray(txBlockRows.commandRows)
        ? txBlockRows.commandRows
        : [],
      labelText: t("txBlockFormCommand"),
      present:
        !!txBlockValue.hasCommands ||
        (Array.isArray(txBlockValue.commands) &&
          txBlockValue.commands.length > 0),
    },
    rollbackCommandsField: {
      fieldKey: "rollbackCommands",
      itemRows: Array.isArray(txBlockRows.rollbackCommandRows)
        ? txBlockRows.rollbackCommandRows
        : [],
      labelText: t("txBlockFormRollbackOperation"),
      present:
        !!txBlockValue.hasRollbackCommands ||
        (Array.isArray(txBlockValue.rollbackCommands) &&
          txBlockValue.rollbackCommands.length > 0),
    },
    templateField: {
      controlType: "input",
      enabled: !!txBlockValue.hasTemplate || txBlockValue.template !== null,
      fieldKey: "template",
      inputType: "text",
      labelText: t("orchestrationFormCommandTemplate"),
      placeholderText: "",
      showPresenceToggle: true,
      valueText: orchestrationStringValue(txBlockValue.template ?? ""),
    },
    varsField: {
      editorKind: "json-text",
      fieldKey: "vars",
      labelText: t("orchestrationFormVars"),
      present:
        !!txBlockValue.hasVars ||
        Object.keys(txBlockValue.vars || {}).length > 0,
      source: orchestrationPlainObject(txBlockValue.vars)
        ? txBlockValue.vars
        : {},
      valueText: orchestrationStringValue(txBlockRows.varsText ?? "{}"),
    },
  };
}

export function orchestrationTxBlockDirectSourcePanelDisplay(
  txBlock = {},
  txBlockRows = {},
) {
  return {
    ...orchestrationTxBlockDirectSourceDisplay(txBlock, txBlockRows),
    commandsFieldHandlerKey: "commands",
    rollbackCommandsFieldHandlerKey: "rollbackCommands",
    templateFieldHandlerKey: "template",
    varsFieldHandlerKey: "vars",
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
              : optionValue === "workflow_file"
                ? t("orchestrationTxWorkflowSourceFile")
                : optionValue === "workflow_template_name"
                  ? t("orchestrationTxWorkflowSourceTemplateName")
                  : t("orchestrationTxWorkflowSourceTemplateContent"),
          optionValue,
        }),
      ),
      placeholderText: "",
      showPresenceToggle: false,
      valueText: orchestrationTxWorkflowActionSourceValue(txWorkflowValue),
    },
  };
}

export function orchestrationJobActionEditorDisplay(
  jobRow = {},
  visualDisplay = {},
) {
  const actionKindRows = Array.isArray(visualDisplay.actionKindRows)
    ? visualDisplay.actionKindRows
    : [];
  const actionKind =
    jobRow?.job?.action?.kind === "tx_workflow" ? "tx_workflow" : "tx_block";
  return {
    actionKindField: {
      labelText: t("orchestrationFormActionKind"),
      optionRows: actionKindRows.map((optionValue) => ({
        optionLabel: optionValue,
        optionValue,
      })),
      valueText: actionKind,
    },
    showTxBlockAction: actionKind === "tx_block",
    showTxWorkflowAction: actionKind === "tx_workflow",
  };
}

export function orchestrationTxBlockActionEditorDisplay(txBlockRows = {}) {
  const sourceValue = orchestrationStringValue(
    txBlockRows.sourceValue,
    "direct",
  );
  return {
    showDirectEditor: sourceValue === "direct",
    showFlowEditor: ["flow_template_name", "flow_template_content"].includes(
      sourceValue,
    ),
    showTemplateEditor: [
      "tx_block_template_name",
      "tx_block_template_content",
    ].includes(sourceValue),
    sourceValue,
  };
}

export function orchestrationTxBlockActionSettingsPanelDisplay(
  txBlock = {},
  visualDisplay = {},
) {
  const actionValue = orchestrationPlainObject(txBlock) ? txBlock : {};
  const settingsDisplay = orchestrationTxBlockActionSettingsDisplay(
    actionValue,
    visualDisplay.txBlockActionSourceRows || [],
  );
  const sourceField =
    settingsDisplay &&
    typeof settingsDisplay === "object" &&
    orchestrationPlainObject(settingsDisplay.sourceField)
      ? settingsDisplay.sourceField
      : {};
  const sourceValue = orchestrationStringValue(sourceField.valueText, "direct");
  const metadataFieldDefs =
    sourceValue === "direct"
      ? ORCHESTRATION_TX_BLOCK_DIRECT_METADATA_FIELD_DEFS
      : sourceValue === "tx_block_template_name" ||
          sourceValue === "tx_block_template_content"
        ? ORCHESTRATION_TX_BLOCK_TEMPLATE_METADATA_FIELD_DEFS
        : sourceValue === "flow_template_name" ||
            sourceValue === "flow_template_content"
          ? ORCHESTRATION_TX_BLOCK_FLOW_METADATA_FIELD_DEFS
          : [];
  return {
    extraField: {
      source: orchestrationPlainObject(actionValue.extra)
        ? actionValue.extra
        : {},
      titleText: t("orchestrationFormTxBlockActionExtra"),
      typeRows: Array.isArray(visualDisplay.jsonValueTypeRows)
        ? visualDisplay.jsonValueTypeRows
        : [],
    },
    metadataFieldRows: txExtraStringFieldRows(
      actionValue.extra,
      metadataFieldDefs,
    ),
    settingsDisplay,
  };
}

export function orchestrationTxWorkflowActionSettingsPanelDisplay(
  txWorkflow = {},
  visualDisplay = {},
) {
  return {
    extraField: {
      source:
        orchestrationPlainObject(txWorkflow) &&
        orchestrationPlainObject(txWorkflow.extra)
          ? txWorkflow.extra
          : {},
      titleText: t("orchestrationFormTxWorkflowActionExtra"),
      typeRows: Array.isArray(visualDisplay.jsonValueTypeRows)
        ? visualDisplay.jsonValueTypeRows
        : [],
    },
    metadataFieldRows: txExtraStringFieldRows(
      orchestrationPlainObject(txWorkflow) ? txWorkflow.extra : {},
      ORCHESTRATION_TX_WORKFLOW_METADATA_FIELD_DEFS,
    ),
    settingsDisplay: orchestrationTxWorkflowActionSettingsDisplay(
      txWorkflow,
      visualDisplay.txWorkflowActionSourceRows || [],
    ),
  };
}

export function orchestrationTxBlockTemplateSourcePanelDisplay(
  txBlock = {},
  txBlockRows = {},
) {
  const sourceDisplay = orchestrationTxBlockTemplateSourceDisplay(
    txBlock,
    txBlockRows,
  );
  return {
    ...sourceDisplay,
    primaryFieldHandlerKey:
      sourceDisplay.primaryField.controlType === "input"
        ? "templateName"
        : "templateContent",
    showInputField: sourceDisplay.primaryField.controlType === "input",
    showJsonTextField: sourceDisplay.primaryField.controlType !== "input",
    showVarsField: true,
    varsFieldHandlerKey: "templateVars",
  };
}

export function orchestrationTxWorkflowSourcePanelDisplay(txWorkflow = {}) {
  const sourceDisplay = orchestrationTxWorkflowSourceDisplay(txWorkflow);
  const primaryFieldHandlerKey =
    sourceDisplay.primaryField.fieldKey === "workflowFile"
      ? "file"
      : sourceDisplay.primaryField.fieldKey === "workflowTemplateName"
        ? "templateName"
        : sourceDisplay.primaryField.fieldKey === "workflow"
          ? "json"
          : "templateContent";
  return {
    ...sourceDisplay,
    primaryFieldHandlerKey,
    showInputField: sourceDisplay.primaryField.controlType === "input",
    showJsonTextField: sourceDisplay.primaryField.controlType !== "input",
    showTextAreaField: sourceDisplay.primaryField.controlType !== "input",
    showVarsField:
      !!sourceDisplay.showWorkflowVars && !!sourceDisplay.varsField,
    varsFieldHandlerKey: sourceDisplay.varsField ? "workflowVars" : "",
  };
}
