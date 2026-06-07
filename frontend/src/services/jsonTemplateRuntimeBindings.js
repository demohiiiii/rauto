import { withLoading } from "./templateUi.js";

export function createJsonTemplateBindings(byId, handlers) {
  const {
    createTemplateDraft,
    deleteTemplateFromExecution,
    loadTemplateIntoEditor,
    saveTemplateFromExecution,
  } = handlers;

  return [
    [
      "tx-block-editor-new-btn",
      "click",
      () =>
        withLoading("tx-block-editor-new-btn", () =>
          createTemplateDraft("tx_block"),
        ),
    ],
    [
      "tx-block-template-run-new-btn",
      "click",
      () =>
        withLoading("tx-block-template-run-new-btn", () =>
          createTemplateDraft("tx_block"),
        ),
    ],
    [
      "tx-block-template-run-save-btn",
      "click",
      () =>
        withLoading("tx-block-template-run-save-btn", () =>
          saveTemplateFromExecution("tx_block"),
        ),
    ],
    [
      "tx-block-template-run-delete-btn",
      "click",
      () =>
        withLoading("tx-block-template-run-delete-btn", () =>
          deleteTemplateFromExecution("tx_block"),
        ),
    ],
    [
      "tx-block-template-name",
      "change",
      async () => {
        if (!byId("tx-block-template-name")?.value.trim()) return;
        await loadTemplateIntoEditor("tx_block");
      },
    ],
    [
      "tx-workflow-json-new-btn",
      "click",
      () =>
        withLoading("tx-workflow-json-new-btn", () =>
          createTemplateDraft("tx_workflow"),
        ),
    ],
    [
      "tx-workflow-template-run-new-btn",
      "click",
      () =>
        withLoading("tx-workflow-template-run-new-btn", () =>
          createTemplateDraft("tx_workflow"),
        ),
    ],
    [
      "tx-workflow-template-run-save-btn",
      "click",
      () =>
        withLoading("tx-workflow-template-run-save-btn", () =>
          saveTemplateFromExecution("tx_workflow"),
        ),
    ],
    [
      "tx-workflow-template-run-delete-btn",
      "click",
      () =>
        withLoading("tx-workflow-template-run-delete-btn", () =>
          deleteTemplateFromExecution("tx_workflow"),
        ),
    ],
    [
      "tx-workflow-template-name",
      "change",
      async () => {
        if (!byId("tx-workflow-template-name")?.value.trim()) return;
        await loadTemplateIntoEditor("tx_workflow");
      },
    ],
    [
      "orchestration-json-new-btn",
      "click",
      () =>
        withLoading("orchestration-json-new-btn", () =>
          createTemplateDraft("orchestration"),
        ),
    ],
    [
      "orchestration-template-run-new-btn",
      "click",
      () =>
        withLoading("orchestration-template-run-new-btn", () =>
          createTemplateDraft("orchestration"),
        ),
    ],
    [
      "orchestration-template-run-save-btn",
      "click",
      () =>
        withLoading("orchestration-template-run-save-btn", () =>
          saveTemplateFromExecution("orchestration"),
        ),
    ],
    [
      "orchestration-template-run-delete-btn",
      "click",
      () =>
        withLoading("orchestration-template-run-delete-btn", () =>
          deleteTemplateFromExecution("orchestration"),
        ),
    ],
    [
      "orchestration-template-name",
      "change",
      async () => {
        if (!byId("orchestration-template-name")?.value.trim()) return;
        await loadTemplateIntoEditor("orchestration");
      },
    ],
  ];
}

export function attachJsonTemplateBindings(byId, bindings) {
  bindings.forEach(([id, event, handler]) => {
    byId(id)?.addEventListener(event, handler);
  });
  return () => {
    bindings.forEach(([id, event, handler]) => {
      byId(id)?.removeEventListener(event, handler);
    });
  };
}

export function registerJsonTemplateGlobals(handlers) {
  const {
    createTemplateDraft,
    deleteTemplateFromExecution,
    loadAllJsonTemplates,
    loadJsonTemplatesByKind,
    loadOrchestrationTemplates,
    loadTemplateIntoEditor,
    loadTxBlockTemplates,
    loadTxWorkflowTemplates,
    renderAllJsonTemplateLists,
    renderAllJsonTemplateOptions,
    saveTemplateFromExecution,
  } = handlers;

  window.loadJsonTemplatesByKind = loadJsonTemplatesByKind;
  window.loadTxBlockTemplates = loadTxBlockTemplates;
  window.loadTxWorkflowTemplates = loadTxWorkflowTemplates;
  window.loadOrchestrationTemplates = loadOrchestrationTemplates;
  window.loadAllJsonTemplates = loadAllJsonTemplates;
  window.renderAllJsonTemplateOptions = renderAllJsonTemplateOptions;
  window.renderAllJsonTemplateLists = renderAllJsonTemplateLists;
  window.loadTxBlockTemplateIntoEditorByName = (name) =>
    loadTemplateIntoEditor("tx_block", name);
  window.loadSelectedTxBlockTemplateForExecution = () =>
    loadTemplateIntoEditor("tx_block");
  window.saveTxBlockTemplateFromEditor = () =>
    saveTemplateFromExecution("tx_block");
  window.deleteTxBlockTemplateFromManager = () =>
    deleteTemplateFromExecution("tx_block");
  window.createTxBlockTemplateDraftFromManager = () =>
    createTemplateDraft("tx_block");
  window.loadSelectedTxWorkflowTemplateForExecution = () =>
    loadTemplateIntoEditor("tx_workflow");
  window.saveTxWorkflowTemplateFromExecution = () =>
    saveTemplateFromExecution("tx_workflow");
  window.deleteTxWorkflowTemplateFromExecution = () =>
    deleteTemplateFromExecution("tx_workflow");
  window.createTxWorkflowTemplateDraftFromExecution = () =>
    createTemplateDraft("tx_workflow");
  window.loadSelectedOrchestrationTemplateForExecution = () =>
    loadTemplateIntoEditor("orchestration");
  window.saveOrchestrationTemplateFromExecution = () =>
    saveTemplateFromExecution("orchestration");
  window.deleteOrchestrationTemplateFromExecution = () =>
    deleteTemplateFromExecution("orchestration");
  window.createOrchestrationTemplateDraftFromExecution = () =>
    createTemplateDraft("orchestration");
}
