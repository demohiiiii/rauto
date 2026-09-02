import {
  derived as deriveStore,
  get as getStore,
  writable,
} from "svelte/store";
import { currentLanguageState } from "../../../lib/i18n.js";
import {
  txWorkflowEditorFormStateFromJsonText,
  txWorkflowFormModelFromJson,
  txWorkflowFormModelToJsonText,
} from "$domains/transactions/index.js";
import type {
  JsonErrorDetail,
  TxWorkflowFormModel,
} from "$domains/transactions/index.js";
import { orchestrationTxWorkflowSourcePanelDisplay } from "../presentation/orchestrationActionDisplayState.js";
import type {
  JsonObject,
  OrchestrationTxWorkflowActionModel,
  OrchestrationTxWorkflowSourceBindings,
} from "../model/types.js";

type EditorDisplayMode = "form" | "json";
type SourceBindingKey = "setJsonText" | "setTemplateName" | "setWorkflowVars";
type SourceBindings = Partial<OrchestrationTxWorkflowSourceBindings>;
type SourceTextHandler = (value: string) => void;
type SourceVarsHandler = (value: JsonObject) => void;

interface EmbeddedFormState {
  formError: string;
  formErrorDetail?: JsonErrorDetail | null;
  formModel: TxWorkflowFormModel;
}

interface SourceEditorContext {
  sourceBindings?: SourceBindings | null;
  sourceValue?: string;
  txWorkflow?: Partial<OrchestrationTxWorkflowActionModel>;
}

export function orchestrationTxWorkflowEmbeddedFormState(
  jsonText = "",
  currentModel: TxWorkflowFormModel | null = null,
): EmbeddedFormState {
  const baseModel = currentModel || txWorkflowFormModelFromJson();
  if (!jsonText.trim()) {
    return {
      formError: "",
      formModel: baseModel,
    };
  }
  const nextState = txWorkflowEditorFormStateFromJsonText(jsonText, baseModel);
  return {
    ...nextState,
    formModel: nextState.formModel || baseModel,
  };
}

export function orchestrationTxWorkflowEmbeddedJsonText(
  formModel: TxWorkflowFormModel | null = null,
): string {
  return txWorkflowFormModelToJsonText(
    formModel || txWorkflowFormModelFromJson(),
  );
}

function sourceBindingHandler(
  sourceBindings: SourceBindings | null,
  key: "setWorkflowVars",
): SourceVarsHandler | undefined;
function sourceBindingHandler(
  sourceBindings: SourceBindings | null,
  key: "setJsonText" | "setTemplateName",
): SourceTextHandler | undefined;
function sourceBindingHandler(
  sourceBindings: SourceBindings | null,
  key: SourceBindingKey,
): SourceTextHandler | SourceVarsHandler | undefined {
  if (key === "setWorkflowVars") return sourceBindings?.setWorkflowVars;
  if (key === "setTemplateName") return sourceBindings?.setTemplateName;
  return sourceBindings?.setJsonText;
}

export function orchestrationTxWorkflowEmbeddedEditorBindings(
  onSourceChange: SourceTextHandler | null | undefined,
) {
  const applySourceChange = (nextValue: string): void => {
    onSourceChange?.(nextValue);
  };
  return {
    applyFormModel(nextModel: TxWorkflowFormModel): EmbeddedFormState {
      applySourceChange(orchestrationTxWorkflowEmbeddedJsonText(nextModel));
      return {
        formError: "",
        formModel: nextModel,
      };
    },
    applyJsonText(
      nextValue: string,
      currentFormModel: TxWorkflowFormModel | null = null,
    ): EmbeddedFormState {
      applySourceChange(nextValue);
      return orchestrationTxWorkflowEmbeddedFormState(
        nextValue,
        nextValue.trim() ? currentFormModel : null,
      );
    },
    deriveStateFromSource(
      sourceValue: string,
      currentFormModel: TxWorkflowFormModel | null = null,
    ): EmbeddedFormState {
      return orchestrationTxWorkflowEmbeddedFormState(
        sourceValue,
        sourceValue.trim() ? currentFormModel : null,
      );
    },
  };
}

function orchestrationTxWorkflowSourceEditorBindings(
  sourceBindings: SourceBindings | null = null,
) {
  const initialTxWorkflow: Partial<OrchestrationTxWorkflowActionModel> = {};
  const sourceBindingsStateStore = writable<SourceBindings | null>(
    sourceBindings,
  );
  const txWorkflowStateStore =
    writable<Partial<OrchestrationTxWorkflowActionModel>>(initialTxWorkflow);
  const workflowEmbeddedBindings = () =>
    orchestrationTxWorkflowEmbeddedEditorBindings(
      sourceBindingHandler(getStore(sourceBindingsStateStore), "setJsonText"),
    );
  const editorDisplayModeStore = writable<EditorDisplayMode>("form");
  const formModelStore = writable<TxWorkflowFormModel>(
    txWorkflowFormModelFromJson(),
  );
  const formErrorStore = writable("");
  let appliedSourceBindings = sourceBindings;
  let appliedTxWorkflow = initialTxWorkflow;
  let appliedSourceValue = "";
  const sourceDisplayStateStore = deriveStore(
    [txWorkflowStateStore, currentLanguageState],
    ([$txWorkflowStateStore]) =>
      orchestrationTxWorkflowSourcePanelDisplay($txWorkflowStateStore),
  );

  const applyState = (nextState: EmbeddedFormState): void => {
    formModelStore.set(nextState.formModel);
    formErrorStore.set(nextState.formError || "");
  };

  return {
    editorDisplayModeStore,
    embeddedFormChangeHandler() {
      return (nextModel: TxWorkflowFormModel): void => {
        applyState(workflowEmbeddedBindings().applyFormModel(nextModel));
      };
    },
    embeddedJsonChangeHandler() {
      return (nextValue: string): void => {
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
    primaryFieldChangeHandler(
      handlerKey: "json" | "templateName" = "json",
    ): SourceTextHandler | undefined {
      return sourceBindingHandler(
        getStore(sourceBindingsStateStore),
        handlerKey === "templateName" ? "setTemplateName" : "setJsonText",
      );
    },
    selectEditorView(nextView: string): void {
      editorDisplayModeStore.set(nextView === "json" ? "json" : "form");
    },
    setSourceContext({
      sourceValue = "",
      sourceBindings: nextSourceBindings = null,
      txWorkflow: nextTxWorkflow = {},
    }: SourceEditorContext = {}): void {
      const nextDisplay =
        orchestrationTxWorkflowSourcePanelDisplay(nextTxWorkflow);
      const nextSourceValue = sourceValue.trim()
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
    workflowVarsHandler(): SourceVarsHandler | undefined {
      return sourceBindingHandler(
        getStore(sourceBindingsStateStore),
        "setWorkflowVars",
      );
    },
  };
}

export function createOrchestrationTxWorkflowSourceWorkspace(
  sourceBindings: SourceBindings | null = null,
) {
  return orchestrationTxWorkflowSourceEditorBindings(sourceBindings);
}
