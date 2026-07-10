import {
  derived as deriveStore,
  get as getStore,
  writable,
} from "svelte/store";
import { formChecked, formValue } from "../lib/events.js";
import { plainObject, stringValue } from "../lib/jsonValue.js";
import { currentLanguageState } from "../lib/i18n.js";
import {
  orchestrationTxBlockExecutionFieldsDisplay,
  orchestrationTxBlockDirectSourcePanelDisplay,
  orchestrationTxBlockFlowSourcePanelDisplay,
  orchestrationTxBlockTemplateSourcePanelDisplay,
  orchestrationTxWorkflowSourcePanelDisplay,
} from "./orchestrationActionDisplayState.js";
import { orchestrationTxBlockExecutionCallbacks } from "./orchestrationTxBlockActionEditors.js";
import {
  txBlockEditorFormStateFromJsonText,
  txBlockFormModelFromJson,
  txBlockFormModelToJsonText,
  txWorkflowEditorFormStateFromJsonText,
  txWorkflowFormModelFromJson,
  txWorkflowFormModelToJsonText,
} from "./transactionFormModels.js";

const orchestrationStringValue = stringValue;
const orchestrationPlainObject = plainObject;

function sourceFieldValue(value, fallback = "") {
  return value && typeof value === "object" && "currentTarget" in value
    ? formValue(value, fallback)
    : (value ?? fallback);
}

function sourceFieldChecked(value) {
  return value && typeof value === "object" && "currentTarget" in value
    ? formChecked(value)
    : !!value;
}

export function orchestrationTxBlockEmbeddedFormState(
  jsonText = "",
  currentModel = null,
) {
  const baseModel = currentModel || txBlockFormModelFromJson();
  if (typeof jsonText !== "string" || !jsonText.trim()) {
    return {
      formError: "",
      formModel: baseModel,
    };
  }
  return txBlockEditorFormStateFromJsonText(jsonText, baseModel);
}

export function orchestrationTxBlockEmbeddedJsonText(formModel = null) {
  return txBlockFormModelToJsonText(formModel || txBlockFormModelFromJson());
}

export function orchestrationTxWorkflowEmbeddedFormState(
  jsonText = "",
  currentModel = null,
) {
  const baseModel = currentModel || txWorkflowFormModelFromJson();
  if (typeof jsonText !== "string" || !jsonText.trim()) {
    return {
      formError: "",
      formModel: baseModel,
    };
  }
  return txWorkflowEditorFormStateFromJsonText(jsonText, baseModel);
}

export function orchestrationTxWorkflowEmbeddedJsonText(formModel = null) {
  return txWorkflowFormModelToJsonText(
    formModel || txWorkflowFormModelFromJson(),
  );
}

function sourceBindingHandler(sourceBindings = null, key = "") {
  return sourceBindings &&
    typeof sourceBindings === "object" &&
    typeof sourceBindings[key] === "function"
    ? sourceBindings[key]
    : undefined;
}

export function orchestrationTxBlockEmbeddedEditorBindings(onSourceChange) {
  const applySourceChange = (nextValue) =>
    typeof onSourceChange === "function"
      ? onSourceChange(nextValue)
      : undefined;
  return {
    applyFormModel(nextModel) {
      applySourceChange(orchestrationTxBlockEmbeddedJsonText(nextModel));
      return {
        formError: "",
        formModel: nextModel,
      };
    },
    applyJsonText(nextValue, currentFormModel = null) {
      applySourceChange(nextValue);
      return orchestrationTxBlockEmbeddedFormState(
        nextValue,
        nextValue.trim() ? currentFormModel : null,
      );
    },
    deriveStateFromSource(sourceValue, currentFormModel = null) {
      return orchestrationTxBlockEmbeddedFormState(
        sourceValue,
        orchestrationStringValue(sourceValue).trim() ? currentFormModel : null,
      );
    },
  };
}

function normalizeTxBlockTemplateSourceWorkspaceArgs(args = null) {
  if (
    args &&
    typeof args === "object" &&
    ("sourceBindings" in args || "txBlock" in args || "txBlockRows" in args)
  ) {
    return {
      sourceBindings: args.sourceBindings ?? null,
      txBlock: args.txBlock ?? {},
      txBlockRows: args.txBlockRows ?? {},
    };
  }
  return {
    sourceBindings: args,
    txBlock: {},
    txBlockRows: {},
  };
}

function orchestrationTxBlockTemplateSourceEditorBindings(args = null) {
  const {
    sourceBindings: initialSourceBindings,
    txBlock: initialTxBlock,
    txBlockRows: initialTxBlockRows,
  } = normalizeTxBlockTemplateSourceWorkspaceArgs(args);
  const sourceBindingsStateStore = writable(initialSourceBindings);
  const txBlockStateStore = writable(initialTxBlock);
  const txBlockRowsStateStore = writable(initialTxBlockRows);
  const embeddedBindings = orchestrationTxBlockEmbeddedEditorBindings(
    (nextValue) =>
      sourceBindingHandler(
        getStore(sourceBindingsStateStore),
        "setTemplateContent",
      )?.(nextValue),
  );
  const editorDisplayModeStore = writable("form");
  const formModelStore = writable(
    embeddedBindings.deriveStateFromSource("").formModel,
  );
  const formErrorStore = writable("");
  const sourceDisplayStateStore = deriveStore(
    [txBlockStateStore, txBlockRowsStateStore, currentLanguageState],
    ([$txBlockStateStore, $txBlockRowsStateStore]) =>
      orchestrationTxBlockTemplateSourcePanelDisplay(
        $txBlockStateStore,
        $txBlockRowsStateStore,
      ),
  );

  const applyState = (nextState = {}) => {
    formModelStore.set(nextState.formModel);
    formErrorStore.set(nextState.formError || "");
  };

  return {
    editorDisplayModeStore,
    fieldPresenceHandler(field) {
      return (event) => {
        sourceBindingHandler(
          getStore(sourceBindingsStateStore),
          "setFieldPresence",
        )?.(field, !!event?.currentTarget?.checked);
      };
    },
    fieldNullableModeHandler(field) {
      return (event) => {
        const nextValue = event?.currentTarget?.value ?? "value";
        const bindings = getStore(sourceBindingsStateStore);
        if (field === "txBlockTemplateName") {
          return sourceBindingHandler(
            bindings,
            "setTemplateNameMode",
          )?.(nextValue);
        }
        return undefined;
      };
    },
    formErrorStore,
    formModelStore,
    objectPresenceHandler(field) {
      return (event) => {
        sourceBindingHandler(
          getStore(sourceBindingsStateStore),
          "setObjectPresence",
        )?.(field, !!event?.currentTarget?.checked);
      };
    },
    selectEditorView(nextView) {
      editorDisplayModeStore.set(nextView === "json" ? "json" : "form");
    },
    setSourceContext({
      sourceValue = "",
      sourceBindings: nextSourceBindings = null,
      txBlock: nextTxBlock = {},
      txBlockRows: nextTxBlockRows = {},
    } = {}) {
      sourceBindingsStateStore.set(nextSourceBindings);
      txBlockStateStore.set(nextTxBlock);
      txBlockRowsStateStore.set(nextTxBlockRows);
      const nextSourceValue =
        typeof sourceValue === "string"
          ? sourceValue
          : orchestrationStringValue(nextTxBlock?.txBlockTemplateContent);
      if (nextSourceValue) {
        applyState(
          embeddedBindings.deriveStateFromSource(
            nextSourceValue,
            getStore(formModelStore),
          ),
        );
      }
    },
    sourceDisplayStateStore,
    templateContentFormChangeHandler() {
      return (nextModel) => {
        applyState(embeddedBindings.applyFormModel(nextModel));
      };
    },
    templateContentJsonChangeHandler() {
      return (nextValue) => {
        applyState(
          embeddedBindings.applyJsonText(nextValue, getStore(formModelStore)),
        );
      };
    },
    templateNameHandler() {
      return sourceBindingHandler(
        getStore(sourceBindingsStateStore),
        "setTemplateName",
      );
    },
    templateVarsHandler() {
      return sourceBindingHandler(
        getStore(sourceBindingsStateStore),
        "setTemplateVars",
      );
    },
  };
}

export function createOrchestrationTxBlockTemplateSourceWorkspace(args = null) {
  return orchestrationTxBlockTemplateSourceEditorBindings(args);
}

export function createOrchestrationTxBlockExecutionSettingsWorkspace({
  onModeInput = null,
  onResourceRollbackInput = null,
  onRollbackOnFailureChange = null,
  onRollbackTriggerInput = null,
  onSetFieldPresence = null,
  onTimeoutInput = null,
  showMode = true,
  txBlock = {},
} = {}) {
  const callbackInputsStateStore = writable({
    onModeInput,
    onResourceRollbackInput,
    onRollbackOnFailureChange,
    onRollbackTriggerInput,
    onSetFieldPresence,
    onTimeoutInput,
  });
  const showModeStateStore = writable(!!showMode);
  const txBlockStateStore = writable(
    orchestrationPlainObject(txBlock) ? txBlock : {},
  );
  const executionFieldRowsStateStore = deriveStore(
    [txBlockStateStore, showModeStateStore, currentLanguageState],
    ([$txBlockStateStore, $showModeStateStore]) =>
      orchestrationTxBlockExecutionFieldsDisplay(
        $txBlockStateStore,
        ["true", "false"],
        { showMode: $showModeStateStore },
      ),
  );
  const executionCallbacksStateStore = deriveStore(
    callbackInputsStateStore,
    ($callbackInputsStateStore) =>
      orchestrationTxBlockExecutionCallbacks($callbackInputsStateStore),
  );

  function setExecutionSettingsContext({
    onModeInput: nextOnModeInput = null,
    onResourceRollbackInput: nextOnResourceRollbackInput = null,
    onRollbackOnFailureChange: nextOnRollbackOnFailureChange = null,
    onRollbackTriggerInput: nextOnRollbackTriggerInput = null,
    onSetFieldPresence: nextOnSetFieldPresence = null,
    onTimeoutInput: nextOnTimeoutInput = null,
    showMode: nextShowMode = true,
    txBlock: nextTxBlock = {},
  } = {}) {
    callbackInputsStateStore.set({
      onModeInput: nextOnModeInput,
      onResourceRollbackInput: nextOnResourceRollbackInput,
      onRollbackOnFailureChange: nextOnRollbackOnFailureChange,
      onRollbackTriggerInput: nextOnRollbackTriggerInput,
      onSetFieldPresence: nextOnSetFieldPresence,
      onTimeoutInput: nextOnTimeoutInput,
    });
    showModeStateStore.set(!!nextShowMode);
    txBlockStateStore.set(
      orchestrationPlainObject(nextTxBlock) ? nextTxBlock : {},
    );
  }

  return {
    executionCallbacksStateStore,
    executionFieldRowsStateStore,
    setExecutionSettingsContext,
  };
}

export function orchestrationTxWorkflowEmbeddedEditorBindings(onSourceChange) {
  const applySourceChange = (nextValue) =>
    typeof onSourceChange === "function"
      ? onSourceChange(nextValue)
      : undefined;
  return {
    applyFormModel(nextModel) {
      applySourceChange(orchestrationTxWorkflowEmbeddedJsonText(nextModel));
      return {
        formError: "",
        formModel: nextModel,
      };
    },
    applyJsonText(nextValue, currentFormModel = null) {
      applySourceChange(nextValue);
      return orchestrationTxWorkflowEmbeddedFormState(
        nextValue,
        nextValue.trim() ? currentFormModel : null,
      );
    },
    deriveStateFromSource(sourceValue, currentFormModel = null) {
      return orchestrationTxWorkflowEmbeddedFormState(
        sourceValue,
        orchestrationStringValue(sourceValue).trim() ? currentFormModel : null,
      );
    },
  };
}

function orchestrationTxWorkflowSourceEditorBindings(args = null) {
  const workflowArgs =
    args &&
    typeof args === "object" &&
    ("sourceBindings" in args || "txWorkflow" in args)
      ? {
          sourceBindings: args.sourceBindings ?? null,
          txWorkflow: args.txWorkflow ?? {},
        }
      : {
          sourceBindings: args,
          txWorkflow: {},
        };
  const sourceBindingsStateStore = writable(workflowArgs.sourceBindings);
  const txWorkflowStateStore = writable(workflowArgs.txWorkflow);
  const workflowEmbeddedBindingHandler = (handlerKey = "json") =>
    orchestrationTxWorkflowEmbeddedEditorBindings(
      handlerKey === "json"
        ? sourceBindingHandler(
            getStore(sourceBindingsStateStore),
            "setJsonText",
          )
        : sourceBindingHandler(
            getStore(sourceBindingsStateStore),
            "setTemplateContent",
          ),
    );
  const editorDisplayModeStore = writable("form");
  const formModelStore = writable(
    workflowEmbeddedBindingHandler().deriveStateFromSource("").formModel,
  );
  const formErrorStore = writable("");
  let appliedSourceBindings = workflowArgs.sourceBindings;
  let appliedTxWorkflow = workflowArgs.txWorkflow;
  let appliedSourceValue = "";
  let appliedPrimarySourceHandlerKey = "json";
  const sourceDisplayStateStore = deriveStore(
    [txWorkflowStateStore, currentLanguageState],
    ([$txWorkflowStateStore]) =>
      orchestrationTxWorkflowSourcePanelDisplay($txWorkflowStateStore),
  );

  const applyState = (nextState = {}) => {
    formModelStore.set(nextState.formModel);
    formErrorStore.set(nextState.formError || "");
  };

  return {
    editorDisplayModeStore,
    embeddedFormChangeHandler(handlerKey = "json") {
      const embeddedBindings = workflowEmbeddedBindingHandler(handlerKey);
      return (nextModel) => {
        applyState(embeddedBindings.applyFormModel(nextModel));
      };
    },
    embeddedJsonChangeHandler(handlerKey = "json") {
      const embeddedBindings = workflowEmbeddedBindingHandler(handlerKey);
      return (nextValue) => {
        applyState(
          embeddedBindings.applyJsonText(nextValue, getStore(formModelStore)),
        );
      };
    },
    fieldPresenceHandler(field) {
      return (event) => {
        sourceBindingHandler(
          getStore(sourceBindingsStateStore),
          "setFieldPresence",
        )?.(field, !!event?.currentTarget?.checked);
      };
    },
    fieldNullableModeHandler(field) {
      return (event) => {
        const nextValue = event?.currentTarget?.value ?? "value";
        const bindings = getStore(sourceBindingsStateStore);
        if (field === "workflowFile") {
          return sourceBindingHandler(
            bindings,
            "setWorkflowFileMode",
          )?.(nextValue);
        }
        if (field === "workflowTemplateName") {
          return sourceBindingHandler(
            bindings,
            "setTemplateNameMode",
          )?.(nextValue);
        }
        return undefined;
      };
    },
    formErrorStore,
    formModelStore,
    objectPresenceHandler(field) {
      return (event) => {
        sourceBindingHandler(
          getStore(sourceBindingsStateStore),
          "setObjectPresence",
        )?.(field, !!event?.currentTarget?.checked);
      };
    },
    primaryFieldChangeHandler(handlerKey = "json") {
      const handlers = {
        file: sourceBindingHandler(
          getStore(sourceBindingsStateStore),
          "setWorkflowFile",
        ),
        json: sourceBindingHandler(
          getStore(sourceBindingsStateStore),
          "setJsonText",
        ),
        templateContent: sourceBindingHandler(
          getStore(sourceBindingsStateStore),
          "setTemplateContent",
        ),
        templateName: sourceBindingHandler(
          getStore(sourceBindingsStateStore),
          "setTemplateName",
        ),
      };
      return handlers[handlerKey];
    },
    selectEditorView(nextView) {
      editorDisplayModeStore.set(nextView === "json" ? "json" : "form");
    },
    setSourceContext({
      primarySourceHandlerKey = "",
      sourceValue = "",
      sourceBindings: nextSourceBindings = null,
      txWorkflow: nextTxWorkflow = {},
    } = {}) {
      const nextSourceValue =
        typeof sourceValue === "string"
          ? sourceValue
          : orchestrationStringValue(nextTxWorkflow?.workflowTemplateContent);
      const nextPrimarySourceHandlerKey =
        primarySourceHandlerKey ||
        orchestrationTxWorkflowSourcePanelDisplay(nextTxWorkflow)
          .primaryFieldHandlerKey ||
        "json";
      if (
        Object.is(appliedSourceBindings, nextSourceBindings) &&
        Object.is(appliedTxWorkflow, nextTxWorkflow) &&
        appliedSourceValue === nextSourceValue &&
        appliedPrimarySourceHandlerKey === nextPrimarySourceHandlerKey
      ) {
        return;
      }
      if (!Object.is(appliedSourceBindings, nextSourceBindings)) {
        sourceBindingsStateStore.set(nextSourceBindings);
      }
      if (!Object.is(appliedTxWorkflow, nextTxWorkflow)) {
        txWorkflowStateStore.set(nextTxWorkflow);
      }
      appliedSourceBindings = nextSourceBindings;
      appliedTxWorkflow = nextTxWorkflow;
      appliedSourceValue = nextSourceValue;
      appliedPrimarySourceHandlerKey = nextPrimarySourceHandlerKey;
      if (nextSourceValue) {
        applyState(
          workflowEmbeddedBindingHandler(
            nextPrimarySourceHandlerKey,
          ).deriveStateFromSource(nextSourceValue, getStore(formModelStore)),
        );
      }
    },
    sourceDisplayStateStore,
    workflowVarsHandler() {
      return sourceBindingHandler(
        getStore(sourceBindingsStateStore),
        "setWorkflowVars",
      );
    },
  };
}

export function createOrchestrationTxWorkflowSourceWorkspace(
  sourceBindings = null,
) {
  return orchestrationTxWorkflowSourceEditorBindings(sourceBindings);
}

function orchestrationTxBlockDirectSourceEditorBindings(sourceBindings = null) {
  return {
    appendListItem(listName = "") {
      return sourceBindingHandler(
        sourceBindings,
        "addListItemAction",
      )?.(listName);
    },
    changeListItem(listName = "") {
      return sourceBindingHandler(
        sourceBindings,
        "updateListItemAction",
      )?.(listName);
    },
    deleteListItem(listName = "") {
      return sourceBindingHandler(
        sourceBindings,
        "removeListItemAction",
      )?.(listName);
    },
    fieldToggleHandler(field) {
      return (enabled) =>
        sourceBindingHandler(sourceBindings, "fieldPresenceChange")?.(
          field,
          sourceFieldChecked(enabled),
        );
    },
    listToggleHandler(field) {
      const directHandler = sourceBindingHandler(
        sourceBindings,
        "listPresenceChange",
      );
      if (typeof directHandler === "function") {
        return (enabled) => directHandler(field, sourceFieldChecked(enabled));
      }
      const legacyHandler = sourceBindingHandler(
        sourceBindings,
        "listPresenceHandler",
      )?.(field);
      return (enabled) =>
        legacyHandler?.({
          currentTarget: { checked: sourceFieldChecked(enabled) },
        });
    },
    objectToggleHandler(field) {
      return (enabled) =>
        sourceBindingHandler(sourceBindings, "objectPresenceChange")?.(
          field,
          sourceFieldChecked(enabled),
        );
    },
    templateChangeHandler() {
      const handler = sourceBindingHandler(
        sourceBindings,
        "templateValueHandler",
      );
      return typeof handler === "function"
        ? (() => {
            const valueHandler = handler();
            return (value) => valueHandler(sourceFieldValue(value));
          })()
        : (value) =>
            sourceBindingHandler(
              sourceBindings,
              "setTemplate",
            )?.(sourceFieldValue(value));
    },
    varsChangeHandler() {
      return sourceBindingHandler(sourceBindings, "setVars");
    },
  };
}

function orchestrationTxBlockDirectSourceActionHandlers(sourceBindings = null) {
  return orchestrationTxBlockDirectSourceEditorBindings(sourceBindings);
}

export function createOrchestrationTxBlockDirectSourceWorkspace({
  sourceBindings = null,
  txBlock = {},
  txBlockRows = {},
} = {}) {
  const sourceBindingsStateStore = writable(sourceBindings);
  const txBlockStateStore = writable(txBlock);
  const txBlockRowsStateStore = writable(txBlockRows);
  const sourceActionHandlersStateStore = deriveStore(
    sourceBindingsStateStore,
    ($sourceBindingsStateStore) =>
      orchestrationTxBlockDirectSourceActionHandlers($sourceBindingsStateStore),
  );
  const sourceDisplayStateStore = deriveStore(
    [txBlockStateStore, txBlockRowsStateStore, currentLanguageState],
    ([$txBlockStateStore, $txBlockRowsStateStore]) =>
      orchestrationTxBlockDirectSourcePanelDisplay(
        $txBlockStateStore,
        $txBlockRowsStateStore,
      ),
  );

  function setSourceContext({
    sourceBindings: nextSourceBindings = null,
    txBlock: nextTxBlock = {},
    txBlockRows: nextTxBlockRows = {},
  } = {}) {
    sourceBindingsStateStore.set(nextSourceBindings);
    txBlockStateStore.set(nextTxBlock);
    txBlockRowsStateStore.set(nextTxBlockRows);
  }

  return {
    setSourceContext,
    sourceActionHandlersStateStore,
    sourceDisplayStateStore,
  };
}

function orchestrationTxBlockFlowSourceEditorBindings(sourceBindings = null) {
  return {
    appendListItem(listName = "") {
      return sourceBindingHandler(
        sourceBindings,
        "addListItemAction",
      )?.(listName);
    },
    changeListItem(listName = "") {
      return sourceBindingHandler(
        sourceBindings,
        "updateListItemAction",
      )?.(listName);
    },
    deleteListItem(listName = "") {
      return sourceBindingHandler(
        sourceBindings,
        "removeListItemAction",
      )?.(listName);
    },
    fieldToggleHandler(field) {
      return (enabled) =>
        sourceBindingHandler(sourceBindings, "fieldPresenceChange")?.(
          field,
          sourceFieldChecked(enabled),
        );
    },
    nullableModeHandler(field) {
      if (field !== "flowTemplateName") {
        return null;
      }
      return (value) =>
        sourceBindingHandler(
          sourceBindings,
          "setFlowTemplateNameMode",
        )?.(sourceFieldValue(value, "value"));
    },
    flowVarsChangeHandler() {
      return sourceBindingHandler(sourceBindings, "setFlowVars");
    },
    listToggleHandler(field) {
      const directHandler = sourceBindingHandler(
        sourceBindings,
        "listPresenceChange",
      );
      if (typeof directHandler === "function") {
        return (enabled) => directHandler(field, sourceFieldChecked(enabled));
      }
      const legacyHandler = sourceBindingHandler(
        sourceBindings,
        "listPresenceHandler",
      )?.(field);
      return (enabled) =>
        legacyHandler?.({
          currentTarget: { checked: sourceFieldChecked(enabled) },
        });
    },
    objectToggleHandler(field) {
      return (enabled) =>
        sourceBindingHandler(sourceBindings, "objectPresenceChange")?.(
          field,
          sourceFieldChecked(enabled),
        );
    },
    sourceInputHandler(handlerKey = "templateContent") {
      const handler =
        handlerKey === "templateName"
          ? sourceBindingHandler(sourceBindings, "flowTemplateNameValueHandler")
          : sourceBindingHandler(
              sourceBindings,
              "flowTemplateContentValueHandler",
            );
      if (typeof handler === "function") {
        const valueHandler = handler();
        return (value) => valueHandler(sourceFieldValue(value));
      }
      const setter =
        handlerKey === "templateName"
          ? sourceBindingHandler(sourceBindings, "setFlowTemplateName")
          : sourceBindingHandler(sourceBindings, "setFlowTemplateContent");
      return (value) => setter?.(sourceFieldValue(value));
    },
  };
}

function orchestrationTxBlockFlowSourceActionHandlers(sourceBindings = null) {
  return orchestrationTxBlockFlowSourceEditorBindings(sourceBindings);
}

export function createOrchestrationTxBlockFlowSourceWorkspace({
  sourceBindings = null,
  txBlock = {},
  txBlockRows = {},
} = {}) {
  const sourceBindingsStateStore = writable(sourceBindings);
  const txBlockStateStore = writable(txBlock);
  const txBlockRowsStateStore = writable(txBlockRows);
  const sourceActionHandlersStateStore = deriveStore(
    sourceBindingsStateStore,
    ($sourceBindingsStateStore) =>
      orchestrationTxBlockFlowSourceActionHandlers($sourceBindingsStateStore),
  );
  const sourceDisplayStateStore = deriveStore(
    [txBlockStateStore, txBlockRowsStateStore, currentLanguageState],
    ([$txBlockStateStore, $txBlockRowsStateStore]) =>
      orchestrationTxBlockFlowSourcePanelDisplay(
        $txBlockStateStore,
        $txBlockRowsStateStore,
      ),
  );

  function setSourceContext({
    sourceBindings: nextSourceBindings = null,
    txBlock: nextTxBlock = {},
    txBlockRows: nextTxBlockRows = {},
  } = {}) {
    sourceBindingsStateStore.set(nextSourceBindings);
    txBlockStateStore.set(nextTxBlock);
    txBlockRowsStateStore.set(nextTxBlockRows);
  }

  return {
    setSourceContext,
    sourceActionHandlersStateStore,
    sourceDisplayStateStore,
  };
}
