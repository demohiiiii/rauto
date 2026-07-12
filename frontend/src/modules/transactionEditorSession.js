import { derived, get, readonly, writable } from "svelte/store";

const sessionText = (value) => {
  if (value == null) return "";
  return typeof value === "string" ? value : String(value);
};

export function createTransactionEditorSession({
  buildDefaultFormModel,
  formModelToJsonText,
  inputFormStateFromJsonText,
  publishFormChange = null,
} = {}) {
  const defaultFormModel = buildDefaultFormModel();
  const defaultJsonText = formModelToJsonText(defaultFormModel);
  const writableSessionStateStore = writable({
    editorDisplayMode: "form",
    formError: "",
    formErrorDetail: null,
    formModel: defaultFormModel,
    jsonText: defaultJsonText,
    lastValidJson: defaultJsonText,
    syncStatus: "synced",
  });
  const sessionStateStore = readonly(writableSessionStateStore);
  const projectState = (fieldName) =>
    derived(sessionStateStore, (sessionState) => sessionState[fieldName]);
  const formModelStateStore = projectState("formModel");
  const formErrorStateStore = projectState("formError");
  const formErrorDetailStateStore = projectState("formErrorDetail");
  const jsonTextStateStore = projectState("jsonText");
  const lastValidJsonStateStore = projectState("lastValidJson");
  const editorDisplayModeStateStore = projectState("editorDisplayMode");
  const syncStatusStateStore = projectState("syncStatus");

  function currentFormModel() {
    return get(sessionStateStore).formModel;
  }

  function replaceJsonText(jsonText = "", parsedState = null) {
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

  function replaceExternalJson(jsonText = "", parsedState = null) {
    return replaceJsonText(jsonText, parsedState);
  }

  function changeFormModel(
    nextModel,
    { editorDisplayMode, notify = true } = {},
  ) {
    const nextJsonText = formModelToJsonText(nextModel);
    const currentState = get(sessionStateStore);
    writableSessionStateStore.set({
      ...currentState,
      editorDisplayMode:
        editorDisplayMode === undefined
          ? currentState.editorDisplayMode
          : editorDisplayMode === "json"
            ? "json"
            : "form",
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

  function selectEditorView(nextView = "") {
    const normalizedView = nextView === "json" ? "json" : "form";
    const currentState = get(sessionStateStore);
    if (
      normalizedView === "form" &&
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
