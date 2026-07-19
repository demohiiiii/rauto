import {
  derived as deriveStore,
  get as getStore,
  writable,
} from "svelte/store";
import { currentLanguageState } from "../../lib/i18n.js";
import { stringValue } from "../../lib/jsonValue.js";
import { orchestrationTxWorkflowSourcePanelDisplay } from "./orchestrationActionDisplayState.js";
import {
  txWorkflowEditorFormStateFromJsonText,
  txWorkflowFormModelFromJson,
  txWorkflowFormModelToJsonText,
} from "../transactions/transactionWorkflowFormModels.js";

const orchestrationStringValue = stringValue;

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
  const workflowEmbeddedBindings = () =>
    orchestrationTxWorkflowEmbeddedEditorBindings(
      sourceBindingHandler(getStore(sourceBindingsStateStore), "setJsonText"),
    );
  const editorDisplayModeStore = writable("form");
  const formModelStore = writable(txWorkflowFormModelFromJson());
  const formErrorStore = writable("");
  let appliedSourceBindings = workflowArgs.sourceBindings;
  let appliedTxWorkflow = workflowArgs.txWorkflow;
  let appliedSourceValue = "";
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
    embeddedFormChangeHandler() {
      return (nextModel) => {
        applyState(workflowEmbeddedBindings().applyFormModel(nextModel));
      };
    },
    embeddedJsonChangeHandler() {
      return (nextValue) => {
        applyState(
          workflowEmbeddedBindings().applyJsonText(
            nextValue,
            getStore(formModelStore),
          ),
        );
      };
    },
    formErrorStore,
    formModelStore,
    primaryFieldChangeHandler(handlerKey = "json") {
      return sourceBindingHandler(
        getStore(sourceBindingsStateStore),
        handlerKey === "templateName" ? "setTemplateName" : "setJsonText",
      );
    },
    selectEditorView(nextView) {
      editorDisplayModeStore.set(nextView === "json" ? "json" : "form");
    },
    setSourceContext({
      sourceValue = "",
      sourceBindings: nextSourceBindings = null,
      txWorkflow: nextTxWorkflow = {},
    } = {}) {
      const nextDisplay =
        orchestrationTxWorkflowSourcePanelDisplay(nextTxWorkflow);
      const nextSourceValue =
        typeof sourceValue === "string" && sourceValue.trim()
          ? sourceValue
          : nextDisplay.sourceMode === "workflow_json"
            ? nextDisplay.primaryField.valueText
            : "";
      if (
        Object.is(appliedSourceBindings, nextSourceBindings) &&
        Object.is(appliedTxWorkflow, nextTxWorkflow) &&
        appliedSourceValue === nextSourceValue
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
      if (nextSourceValue) {
        applyState(
          workflowEmbeddedBindings().deriveStateFromSource(
            nextSourceValue,
            getStore(formModelStore),
          ),
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
