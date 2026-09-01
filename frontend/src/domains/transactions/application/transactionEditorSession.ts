import { derived, get, readonly, writable } from "svelte/store";
import type { Readable } from "svelte/store";
import type {
  TransactionEditorSessionState,
  TransactionEditorView,
  TransactionParsedFormState,
} from "../model/types.js";

interface TransactionEditorSessionConfig<TModel, TErrorDetail> {
  buildDefaultFormModel(): TModel;
  formModelToJsonText(model: TModel): string;
  inputFormStateFromJsonText(
    jsonText: string,
    currentModel: TModel,
  ): TransactionParsedFormState<TModel, TErrorDetail>;
  publishFormChange?: ((model: TModel, jsonText: string) => unknown) | null;
}

interface ChangeFormModelOptions {
  editorDisplayMode?: unknown;
  notify?: boolean;
}

const sessionText = (value: unknown): string => {
  if (value == null) return "";
  return typeof value === "string" ? value : String(value);
};

const editorView = (value: unknown): TransactionEditorView => {
  if (value === "json" || value === "readonly") return value;
  return "form";
};

export function createTransactionEditorSession<TModel, TErrorDetail = unknown>({
  buildDefaultFormModel,
  formModelToJsonText,
  inputFormStateFromJsonText,
  publishFormChange = null,
}: TransactionEditorSessionConfig<TModel, TErrorDetail>) {
  const defaultFormModel = buildDefaultFormModel();
  const defaultJsonText = formModelToJsonText(defaultFormModel);
  const writableSessionStateStore = writable<
    TransactionEditorSessionState<TModel, TErrorDetail>
  >({
    editorDisplayMode: "form",
    formError: "",
    formErrorDetail: null,
    formModel: defaultFormModel,
    jsonText: defaultJsonText,
    lastValidJson: defaultJsonText,
    syncStatus: "synced",
  });
  const sessionStateStore = readonly(writableSessionStateStore);
  const projectState = <
    TField extends keyof TransactionEditorSessionState<TModel, TErrorDetail>,
  >(
    fieldName: TField,
  ): Readable<TransactionEditorSessionState<TModel, TErrorDetail>[TField]> =>
    derived(sessionStateStore, (sessionState) => sessionState[fieldName]);
  const formModelStateStore = projectState("formModel");
  const formErrorStateStore = projectState("formError");
  const formErrorDetailStateStore = projectState("formErrorDetail");
  const jsonTextStateStore = projectState("jsonText");
  const lastValidJsonStateStore = projectState("lastValidJson");
  const editorDisplayModeStateStore = projectState("editorDisplayMode");
  const syncStatusStateStore = projectState("syncStatus");

  function currentFormModel(): TModel {
    return get(sessionStateStore).formModel;
  }

  function replaceJsonText(
    jsonText: unknown = "",
    parsedState: TransactionParsedFormState<TModel, TErrorDetail> | null = null,
  ): boolean {
    const nextJsonText = sessionText(jsonText);
    const currentState = get(sessionStateStore);
    const nextState =
      parsedState ||
      inputFormStateFromJsonText(nextJsonText, currentState.formModel);

    if (nextState.formError) {
      writableSessionStateStore.set({
        ...currentState,
        formError: sessionText(nextState.formError),
        formErrorDetail: nextState.formErrorDetail ?? null,
        jsonText: nextJsonText,
        syncStatus: "invalid-json",
      });
      return false;
    }

    writableSessionStateStore.set({
      ...currentState,
      formError: "",
      formErrorDetail: null,
      formModel: nextState.formModel,
      jsonText: nextJsonText,
      lastValidJson: nextJsonText,
      syncStatus: "synced",
    });
    return true;
  }

  function replaceExternalJson(
    jsonText: unknown = "",
    parsedState: TransactionParsedFormState<TModel, TErrorDetail> | null = null,
  ): boolean {
    return replaceJsonText(jsonText, parsedState);
  }

  function changeFormModel(
    nextModel: TModel,
    { editorDisplayMode, notify = true }: ChangeFormModelOptions = {},
  ): void {
    const nextJsonText = formModelToJsonText(nextModel);
    const currentState = get(sessionStateStore);
    writableSessionStateStore.set({
      ...currentState,
      editorDisplayMode:
        editorDisplayMode === undefined
          ? currentState.editorDisplayMode
          : editorView(editorDisplayMode),
      formError: "",
      formErrorDetail: null,
      formModel: nextModel,
      jsonText: nextJsonText,
      lastValidJson: nextJsonText,
      syncStatus: "synced",
    });
    if (notify && typeof publishFormChange === "function") {
      publishFormChange(nextModel, nextJsonText);
    }
  }

  function selectEditorView(nextView: unknown = ""): boolean {
    const normalizedView = editorView(nextView);
    const currentState = get(sessionStateStore);
    if (
      normalizedView !== "json" &&
      currentState.syncStatus === "invalid-json"
    ) {
      return false;
    }
    writableSessionStateStore.set({
      ...currentState,
      editorDisplayMode: normalizedView,
    });
    return true;
  }

  return {
    changeFormModel,
    currentFormModel,
    editorDisplayModeStateStore,
    formErrorDetailStateStore,
    formErrorStateStore,
    formModelStateStore,
    jsonTextStateStore,
    lastValidJsonStateStore,
    replaceExternalJson,
    replaceJsonText,
    selectEditorView,
    sessionStateStore,
    syncStatusStateStore,
  };
}
