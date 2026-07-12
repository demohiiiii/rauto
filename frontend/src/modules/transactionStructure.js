export function txStructureMappingEntry({
  editorKind = "field",
  formPath = "",
  jsonPath = "",
  labelKey = "",
  scope = "",
}) {
  return Object.freeze({
    editorKind,
    formPath,
    jsonPath,
    labelKey,
    scope,
  });
}

const EMPTY_METADATA_FIELD_DEFS = Object.freeze([]);

const TX_BLOCK_JSON_STRUCTURE_MAPPING = Object.freeze([
  txStructureMappingEntry({
    scope: "root",
    jsonPath: "name",
    formPath: "name",
    labelKey: "txBlockFormName",
  }),
  txStructureMappingEntry({
    scope: "root",
    jsonPath: "fail_fast",
    formPath: "failFast",
    editorKind: "presence-field",
    labelKey: "txBlockFormFailFast",
  }),
  txStructureMappingEntry({
    scope: "root",
    jsonPath: "rollback_policy",
    formPath: "rollbackPolicy",
    editorKind: "rollback-policy",
  }),
  txStructureMappingEntry({
    scope: "root",
    jsonPath: "steps",
    formPath: "steps",
    editorKind: "step-list",
  }),
  txStructureMappingEntry({
    scope: "root",
    jsonPath: "extra.*",
    formPath: "extra.*",
    editorKind: "json-object-extra",
  }),
  txStructureMappingEntry({
    scope: "rollback_policy",
    jsonPath: "kind",
    formPath: "kind",
    editorKind: "select-field",
    labelKey: "txBlockFormRollbackPolicy",
  }),
  txStructureMappingEntry({
    scope: "rollback_policy.whole_resource",
    jsonPath: "trigger_step_index",
    formPath: "wholeResource.triggerStepIndex",
    labelKey: "txBlockFormTriggerStepIndex",
  }),
  txStructureMappingEntry({
    scope: "rollback_policy.whole_resource",
    jsonPath: "rollback",
    formPath: "wholeResource.rollback",
    editorKind: "operation-editor",
  }),
  txStructureMappingEntry({
    scope: "rollback_policy.whole_resource",
    jsonPath: "extra.*",
    formPath: "wholeResource.extra.*",
    editorKind: "json-object-extra",
  }),
  txStructureMappingEntry({
    scope: "step",
    jsonPath: "run",
    formPath: "run",
    editorKind: "operation-editor",
  }),
  txStructureMappingEntry({
    scope: "step",
    jsonPath: "rollback",
    formPath: "rollback",
    editorKind: "rollback-operation",
  }),
  txStructureMappingEntry({
    scope: "step",
    jsonPath: "rollback_on_failure",
    formPath: "rollbackOnFailure",
    editorKind: "presence-field",
    labelKey: "txBlockFormRollbackOnFailure",
  }),
  txStructureMappingEntry({
    scope: "step",
    jsonPath: "extra.*",
    formPath: "extra.*",
    editorKind: "json-object-extra",
  }),
  txStructureMappingEntry({
    scope: "operation",
    jsonPath: "kind",
    formPath: "kind",
    editorKind: "select-field",
    labelKey: "txBlockFormOperationKind",
  }),
  txStructureMappingEntry({
    scope: "operation.command",
    jsonPath: "mode",
    formPath: "command.mode",
    labelKey: "txBlockFormMode",
  }),
  txStructureMappingEntry({
    scope: "operation.command",
    jsonPath: "command",
    formPath: "command.command",
    labelKey: "txBlockFormCommand",
  }),
  txStructureMappingEntry({
    scope: "operation.command",
    jsonPath: "timeout",
    formPath: "command.timeout",
    editorKind: "presence-field",
    labelKey: "txBlockFormTimeout",
  }),
  txStructureMappingEntry({
    scope: "operation.command",
    jsonPath: "dyn_params",
    formPath: "command.dynParams",
    editorKind: "string-map",
    labelKey: "txBlockFormDynParams",
  }),
  txStructureMappingEntry({
    scope: "operation.command",
    jsonPath: "interaction",
    formPath: "command.interaction",
    editorKind: "interaction-editor",
  }),
  txStructureMappingEntry({
    scope: "operation.command",
    jsonPath: "extra.*",
    formPath: "command.extra.*",
    editorKind: "json-object-extra",
  }),
  txStructureMappingEntry({
    scope: "operation.command.interaction",
    jsonPath: "prompts",
    formPath: "prompts",
    editorKind: "prompt-list",
  }),
  txStructureMappingEntry({
    scope: "operation.command.interaction",
    jsonPath: "extra.*",
    formPath: "extra.*",
    editorKind: "json-object-extra",
  }),
  txStructureMappingEntry({
    scope: "operation.command.prompt",
    jsonPath: "patterns",
    formPath: "patterns",
    editorKind: "string-list",
    labelKey: "txBlockFormPatterns",
  }),
  txStructureMappingEntry({
    scope: "operation.command.prompt",
    jsonPath: "response",
    formPath: "response",
    labelKey: "txBlockFormResponse",
  }),
  txStructureMappingEntry({
    scope: "operation.command.prompt",
    jsonPath: "record_input",
    formPath: "recordInput",
    editorKind: "presence-field",
    labelKey: "txBlockFormRecordInput",
  }),
  txStructureMappingEntry({
    scope: "operation.command.prompt",
    jsonPath: "extra.*",
    formPath: "extra.*",
    editorKind: "json-object-extra",
  }),
  txStructureMappingEntry({
    scope: "operation.flow",
    jsonPath: "steps",
    formPath: "flow.steps",
    editorKind: "flow-step-list",
  }),
  txStructureMappingEntry({
    scope: "operation.flow",
    jsonPath: "stop_on_error",
    formPath: "flow.stopOnError",
    editorKind: "presence-field",
    labelKey: "txBlockFormStopOnError",
  }),
  txStructureMappingEntry({
    scope: "operation.flow",
    jsonPath: "max_steps",
    formPath: "flow.maxSteps",
    editorKind: "presence-field",
    labelKey: "txBlockFormMaxSteps",
  }),
  txStructureMappingEntry({
    scope: "operation.flow",
    jsonPath: "extra.*",
    formPath: "flow.extra.*",
    editorKind: "json-object-extra",
  }),
  txStructureMappingEntry({
    scope: "operation.flow.step",
    jsonPath: "mode",
    formPath: "mode",
    labelKey: "txBlockFormMode",
  }),
  txStructureMappingEntry({
    scope: "operation.flow.step",
    jsonPath: "command",
    formPath: "command",
    labelKey: "txBlockFormCommand",
  }),
  txStructureMappingEntry({
    scope: "operation.flow.step",
    jsonPath: "timeout",
    formPath: "timeout",
    editorKind: "presence-field",
    labelKey: "txBlockFormTimeout",
  }),
  txStructureMappingEntry({
    scope: "operation.flow.step",
    jsonPath: "dyn_params",
    formPath: "dynParams",
    editorKind: "string-map",
    labelKey: "txBlockFormDynParams",
  }),
  txStructureMappingEntry({
    scope: "operation.flow.step",
    jsonPath: "interaction",
    formPath: "interaction",
    editorKind: "interaction-editor",
  }),
  txStructureMappingEntry({
    scope: "operation.flow.step",
    jsonPath: "extra.*",
    formPath: "extra.*",
    editorKind: "json-object-extra",
  }),
  txStructureMappingEntry({
    scope: "operation.template",
    jsonPath: "current_connection_alias",
    formPath: "template.currentConnectionAlias",
    editorKind: "presence-field",
    labelKey: "txBlockFormCurrentConnectionAlias",
  }),
  txStructureMappingEntry({
    scope: "operation.template",
    jsonPath: "template",
    formPath: "template.template",
    editorKind: "template-definition-editor",
  }),
  txStructureMappingEntry({
    scope: "operation.template",
    jsonPath: "runtime",
    formPath: "template.runtime",
    editorKind: "template-runtime-editor",
  }),
  txStructureMappingEntry({
    scope: "operation.template",
    jsonPath: "extra.*",
    formPath: "template.extra.*",
    editorKind: "json-object-extra",
  }),
  txStructureMappingEntry({
    scope: "operation.template.definition",
    jsonPath: "name",
    formPath: "name",
    labelKey: "txBlockFormTemplateName",
  }),
  txStructureMappingEntry({
    scope: "operation.template.definition",
    jsonPath: "description",
    formPath: "description",
    editorKind: "presence-field",
    labelKey: "txBlockFormDescription",
  }),
  txStructureMappingEntry({
    scope: "operation.template.definition",
    jsonPath: "vars",
    formPath: "vars",
    editorKind: "template-var-list",
  }),
  txStructureMappingEntry({
    scope: "operation.template.definition",
    jsonPath: "stop_on_error",
    formPath: "stopOnError",
    editorKind: "presence-field",
    labelKey: "txBlockFormStopOnError",
  }),
  txStructureMappingEntry({
    scope: "operation.template.definition",
    jsonPath: "default_mode",
    formPath: "defaultMode",
    editorKind: "presence-field",
    labelKey: "txBlockFormDefaultMode",
  }),
  txStructureMappingEntry({
    scope: "operation.template.definition",
    jsonPath: "steps",
    formPath: "steps",
    editorKind: "template-step-list",
  }),
  txStructureMappingEntry({
    scope: "operation.template.definition",
    jsonPath: "extra.*",
    formPath: "extra.*",
    editorKind: "json-object-extra",
  }),
  txStructureMappingEntry({
    scope: "operation.template.var",
    jsonPath: "name",
    formPath: "name",
    labelKey: "txBlockFormName",
  }),
  txStructureMappingEntry({
    scope: "operation.template.var",
    jsonPath: "label",
    formPath: "label",
    editorKind: "presence-field",
    labelKey: "txBlockFormLabel",
  }),
  txStructureMappingEntry({
    scope: "operation.template.var",
    jsonPath: "description",
    formPath: "description",
    editorKind: "presence-field",
    labelKey: "txBlockFormDescription",
  }),
  txStructureMappingEntry({
    scope: "operation.template.var",
    jsonPath: "type",
    formPath: "type",
    editorKind: "presence-field",
    labelKey: "txBlockFormType",
  }),
  txStructureMappingEntry({
    scope: "operation.template.var",
    jsonPath: "required",
    formPath: "required",
    editorKind: "presence-field",
    labelKey: "txBlockFormRequired",
  }),
  txStructureMappingEntry({
    scope: "operation.template.var",
    jsonPath: "placeholder",
    formPath: "placeholder",
    editorKind: "presence-field",
    labelKey: "txBlockFormPlaceholder",
  }),
  txStructureMappingEntry({
    scope: "operation.template.var",
    jsonPath: "options",
    formPath: "options",
    editorKind: "string-list",
    labelKey: "txBlockFormOptions",
  }),
  txStructureMappingEntry({
    scope: "operation.template.var",
    jsonPath: "default",
    formPath: "defaultValue",
    editorKind: "typed-value",
    labelKey: "txBlockFormDefaultPlaceholder",
  }),
  txStructureMappingEntry({
    scope: "operation.template.var",
    jsonPath: "extra.*",
    formPath: "extra.*",
    editorKind: "json-object-extra",
  }),
  txStructureMappingEntry({
    scope: "operation.template.step",
    jsonPath: "command",
    formPath: "command",
    labelKey: "txBlockFormCommand",
  }),
  txStructureMappingEntry({
    scope: "operation.template.step",
    jsonPath: "mode",
    formPath: "mode",
    editorKind: "presence-field",
    labelKey: "txBlockFormMode",
  }),
  txStructureMappingEntry({
    scope: "operation.template.step",
    jsonPath: "timeout_secs",
    formPath: "timeoutSecs",
    editorKind: "presence-field",
    labelKey: "txBlockFormTimeout",
  }),
  txStructureMappingEntry({
    scope: "operation.template.step",
    jsonPath: "prompts",
    formPath: "prompts",
    editorKind: "template-prompt-list",
  }),
  txStructureMappingEntry({
    scope: "operation.template.step",
    jsonPath: "extra.*",
    formPath: "extra.*",
    editorKind: "json-object-extra",
  }),
  txStructureMappingEntry({
    scope: "operation.template.prompt",
    jsonPath: "patterns",
    formPath: "patterns",
    editorKind: "string-list",
    labelKey: "txBlockFormPatterns",
  }),
  txStructureMappingEntry({
    scope: "operation.template.prompt",
    jsonPath: "response",
    formPath: "response",
    labelKey: "txBlockFormResponse",
  }),
  txStructureMappingEntry({
    scope: "operation.template.prompt",
    jsonPath: "append_newline",
    formPath: "appendNewline",
    editorKind: "presence-field",
    labelKey: "txBlockFormAppendNewline",
  }),
  txStructureMappingEntry({
    scope: "operation.template.prompt",
    jsonPath: "record_input",
    formPath: "recordInput",
    editorKind: "presence-field",
    labelKey: "txBlockFormRecordInput",
  }),
  txStructureMappingEntry({
    scope: "operation.template.prompt",
    jsonPath: "extra.*",
    formPath: "extra.*",
    editorKind: "json-object-extra",
  }),
  txStructureMappingEntry({
    scope: "operation.template.runtime",
    jsonPath: "default_mode",
    formPath: "defaultMode",
    editorKind: "presence-field",
    labelKey: "txBlockFormRuntimeDefaultMode",
  }),
  txStructureMappingEntry({
    scope: "operation.template.runtime",
    jsonPath: "connection_name",
    formPath: "connectionName",
    editorKind: "presence-field",
    labelKey: "txBlockFormConnectionName",
  }),
  txStructureMappingEntry({
    scope: "operation.template.runtime",
    jsonPath: "host",
    formPath: "host",
    editorKind: "presence-field",
    labelKey: "txBlockFormHost",
  }),
  txStructureMappingEntry({
    scope: "operation.template.runtime",
    jsonPath: "username",
    formPath: "username",
    editorKind: "presence-field",
    labelKey: "txBlockFormUsername",
  }),
  txStructureMappingEntry({
    scope: "operation.template.runtime",
    jsonPath: "device_profile",
    formPath: "deviceProfile",
    editorKind: "presence-field",
    labelKey: "txBlockFormDeviceProfile",
  }),
  txStructureMappingEntry({
    scope: "operation.template.runtime",
    jsonPath: "vars",
    formPath: "vars",
    editorKind: "typed-object",
    labelKey: "txBlockFormRuntimeVars",
  }),
  txStructureMappingEntry({
    scope: "operation.template.runtime",
    jsonPath: "extra.*",
    formPath: "extra.*",
    editorKind: "json-object-extra",
  }),
  txStructureMappingEntry({
    scope: "operation.template.runtime.var",
    jsonPath: "*",
    formPath: "*",
    editorKind: "typed-value",
  }),
]);

function txWorkflowInlineBlockMappingEntries() {
  return TX_BLOCK_JSON_STRUCTURE_MAPPING.map((entry) =>
    txStructureMappingEntry({
      ...entry,
      scope: `block.inline.${entry.scope}`,
    }),
  );
}

const TX_WORKFLOW_JSON_STRUCTURE_MAPPING = Object.freeze([
  txStructureMappingEntry({
    scope: "root",
    jsonPath: "name",
    formPath: "name",
    labelKey: "txWorkflowFormName",
  }),
  txStructureMappingEntry({
    scope: "root",
    jsonPath: "fail_fast",
    formPath: "failFast",
    editorKind: "presence-field",
    labelKey: "txBlockFormFailFast",
  }),
  txStructureMappingEntry({
    scope: "root",
    jsonPath: "blocks",
    formPath: "blocks",
    editorKind: "workflow-block-list",
    labelKey: "txWorkflowFormBlocks",
  }),
  txStructureMappingEntry({
    scope: "root",
    jsonPath: "extra.*",
    formPath: "extra.*",
    editorKind: "json-object-extra",
  }),
  txStructureMappingEntry({
    scope: "block",
    jsonPath: "source",
    formPath: "sourceKind",
    editorKind: "derived-source-switch",
    labelKey: "txWorkflowFormBlockSource",
  }),
  ...txWorkflowInlineBlockMappingEntries(),
  txStructureMappingEntry({
    scope: "block.template_ref",
    jsonPath: "name",
    formPath: "name",
    editorKind: "presence-field",
    labelKey: "txBlockFormName",
  }),
  txStructureMappingEntry({
    scope: "block.template_ref",
    jsonPath: "fail_fast",
    formPath: "failFast",
    editorKind: "presence-field",
    labelKey: "txBlockFormFailFast",
  }),
  txStructureMappingEntry({
    scope: "block.template_ref",
    jsonPath: "tx_block_template_name",
    formPath: "txBlockTemplateName",
    editorKind: "presence-field",
    labelKey: "txWorkflowFormBlockTemplateName",
  }),
  txStructureMappingEntry({
    scope: "block.template_ref",
    jsonPath: "tx_block_template_content",
    formPath: "txBlockTemplateContent",
    editorKind: "presence-field",
    labelKey: "txWorkflowFormBlockTemplateContent",
  }),
  txStructureMappingEntry({
    scope: "block.template_ref",
    jsonPath: "tx_block_template_vars",
    formPath: "txBlockTemplateVars",
    editorKind: "typed-object",
    labelKey: "txWorkflowFormBlockTemplateVars",
  }),
  txStructureMappingEntry({
    scope: "block.template_ref",
    jsonPath: "extra.*",
    formPath: "extra.*",
    editorKind: "json-object-extra",
  }),
]);

export function txBlockJsonStructureMapping() {
  return TX_BLOCK_JSON_STRUCTURE_MAPPING;
}

export function txWorkflowJsonStructureMapping() {
  return TX_WORKFLOW_JSON_STRUCTURE_MAPPING;
}
export const TX_WORKFLOW_ROOT_METADATA_FIELD_DEFS = Object.freeze([]);
export const TX_WORKFLOW_INLINE_BLOCK_METADATA_FIELD_DEFS = Object.freeze([]);
export const TX_WORKFLOW_TEMPLATE_REF_METADATA_FIELD_DEFS = Object.freeze([]);

export function txWorkflowInlineCommandMetadataFieldDefs() {
  return EMPTY_METADATA_FIELD_DEFS;
}

export function txBlockFlowMetadataFieldDefs() {
  return EMPTY_METADATA_FIELD_DEFS;
}

export function txBlockFlowStepMetadataFieldDefs() {
  return EMPTY_METADATA_FIELD_DEFS;
}

export function txBlockPromptMetadataFieldDefs() {
  return EMPTY_METADATA_FIELD_DEFS;
}

export function txBlockTemplateDefinitionMetadataFieldDefs() {
  return EMPTY_METADATA_FIELD_DEFS;
}

export function txBlockTemplateOperationMetadataFieldDefs() {
  return EMPTY_METADATA_FIELD_DEFS;
}

export function txBlockTemplateRuntimeMetadataFieldDefs() {
  return EMPTY_METADATA_FIELD_DEFS;
}

export function txBlockTemplateVarMetadataFieldDefs() {
  return EMPTY_METADATA_FIELD_DEFS;
}

export function txBlockTemplateStepMetadataFieldDefs() {
  return EMPTY_METADATA_FIELD_DEFS;
}
