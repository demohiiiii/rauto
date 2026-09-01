import {
  derived as deriveStore,
  get as getStore,
  writable,
} from "svelte/store";
import { currentLanguageState } from "../../../lib/i18n.js";
import { stringValue } from "../../../lib/jsonValue.js";
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

type EditorDisplayMode = "form" | "json";
type SourceBindingHandler = (...args: unknown[]) => unknown;
type SourceBindingKey = "setJsonText" | "setTemplateName" | "setWorkflowVars";

interface EmbeddedFormState {
  formError: string;
  formErrorDetail?: JsonErrorDetail | null;
  formModel: TxWorkflowFormModel;
}

interface SourceEditorContext {
  sourceBindings?: unknown;
  sourceValue?: unknown;
  txWorkflow?: unknown;
}

interface SourceEditorInput {
  sourceBindings: unknown;
  txWorkflow: unknown;
}

const orchestrationStringValue = stringValue as (
  value: unknown,
  fallback?: string,
) => string;

function objectRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function orchestrationTxWorkflowEmbeddedFormState(
  jsonText: unknown = "",
  currentModel: TxWorkflowFormModel | null = null,
): EmbeddedFormState {
  const baseModel = currentModel || txWorkflowFormModelFromJson();
  if (typeof jsonText !== "string" || !jsonText.trim()) {
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
  sourceBindings: unknown = null,
  key: SourceBindingKey = "setJsonText",
): SourceBindingHandler | undefined {
  const bindings = objectRecord(sourceBindings);
  const handler = bindings?.[key];
  return typeof handler === "function"
    ? (handler as SourceBindingHandler)
    : undefined;
}

export function orchestrationTxWorkflowEmbeddedEditorBindings(
  onSourceChange: unknown,
) {
  const applySourceChange = (nextValue: string): unknown =>
    typeof onSourceChange === "function"
      ? (onSourceChange as SourceBindingHandler)(nextValue)
      : undefined;
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
      sourceValue: unknown,
      currentFormModel: TxWorkflowFormModel | null = null,
    ): EmbeddedFormState {
      return orchestrationTxWorkflowEmbeddedFormState(
        sourceValue,
        orchestrationStringValue(sourceValue).trim() ? currentFormModel : null,
      );
    },
  };
}

function sourceEditorInput(args: unknown): SourceEditorInput {
  const input = objectRecord(args);
  return input && ("sourceBindings" in input || "txWorkflow" in input)
    ? {
        sourceBindings: input.sourceBindings ?? null,
        txWorkflow: input.txWorkflow ?? {},
      }
    : {
        sourceBindings: args,
        txWorkflow: {},
      };
}

function orchestrationTxWorkflowSourceEditorBindings(args: unknown = null) {
  const workflowArgs = sourceEditorInput(args);
  const sourceBindingsStateStore = writable<unknown>(
    workflowArgs.sourceBindings,
  );
  const txWorkflowStateStore = writable<unknown>(workflowArgs.txWorkflow);
  const workflowEmbeddedBindings = () =>
    orchestrationTxWorkflowEmbeddedEditorBindings(
      sourceBindingHandler(getStore(sourceBindingsStateStore), "setJsonText"),
    );
  const editorDisplayModeStore = writable<EditorDisplayMode>("form");
  const formModelStore = writable<TxWorkflowFormModel>(
    txWorkflowFormModelFromJson(),
  );
  const formErrorStore = writable("");
  let appliedSourceBindings = workflowArgs.sourceBindings;
  let appliedTxWorkflow = workflowArgs.txWorkflow;
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
    ): SourceBindingHandler | undefined {
      return sourceBindingHandler(
        getStore(sourceBindingsStateStore),
        handlerKey === "templateName" ? "setTemplateName" : "setJsonText",
      );
    },
    selectEditorView(nextView: unknown): void {
      editorDisplayModeStore.set(nextView === "json" ? "json" : "form");
    },
    setSourceContext({
      sourceValue = "",
      sourceBindings: nextSourceBindings = null,
      txWorkflow: nextTxWorkflow = {},
    }: SourceEditorContext = {}): void {
      const nextDisplay =
        orchestrationTxWorkflowSourcePanelDisplay(nextTxWorkflow);
      const primaryField = objectRecord(nextDisplay.primaryField);
      const nextSourceValue =
        typeof sourceValue === "string" && sourceValue.trim()
          ? sourceValue
          : nextDisplay.sourceMode === "workflow_json"
            ? orchestrationStringValue(primaryField?.valueText)
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
    workflowVarsHandler(): SourceBindingHandler | undefined {
      return sourceBindingHandler(
        getStore(sourceBindingsStateStore),
        "setWorkflowVars",
      );
    },
  };
}

export function createOrchestrationTxWorkflowSourceWorkspace(
  sourceBindings: unknown = null,
) {
  return orchestrationTxWorkflowSourceEditorBindings(sourceBindings);
}
