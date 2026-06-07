export const JSON_TEMPLATE_MANAGERS = {
  tx_block: {
    apiBase: "/api/tx-block-templates",
    runSelectId: "tx-block-template-name",
    emptyKey: "txBlockTemplateListEmpty",
    newPromptKey: "txBlockTemplateNewPrompt",
    nameRequiredKey: "txBlockTemplateNameRequired",
    runOutId: "tx-plan-out",
    runEditorId: "tx-block-json",
  },
  tx_workflow: {
    apiBase: "/api/tx-workflow-templates",
    runSelectId: "tx-workflow-template-name",
    emptyKey: "txWorkflowTemplateListEmpty",
    newPromptKey: "txWorkflowTemplateNewPrompt",
    nameRequiredKey: "txWorkflowTemplateNameRequired",
    runOutId: "tx-workflow-plan-out",
    runEditorId: "tx-workflow-json",
  },
  orchestration: {
    apiBase: "/api/orchestration-templates",
    runSelectId: "orchestration-template-name",
    emptyKey: "orchestrationTemplateListEmpty",
    newPromptKey: "orchestrationTemplateNewPrompt",
    nameRequiredKey: "orchestrationTemplateNameRequired",
    runOutId: "orchestration-plan-out",
    runEditorId: "orchestration-json",
  },
};

export function jsonTemplateConfigFor(kind) {
  return JSON_TEMPLATE_MANAGERS[kind] || null;
}
