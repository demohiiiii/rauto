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
    jsonPath: "multiline_mode",
    formPath: "command.multilineMode",
    editorKind: "multiline-mode",
    labelKey: "commandMultilineMode",
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
    jsonPath: "multiline_mode",
    formPath: "multilineMode",
    editorKind: "multiline-mode",
    labelKey: "commandMultilineMode",
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

export function txBlockPromptMetadataFieldDefs() {
  return EMPTY_METADATA_FIELD_DEFS;
}
