import { get, writable } from "svelte/store";
import {
  commandFlowTemplateModelFromToml,
  commandFlowTemplateModelToToml,
  defaultCommandFlowTemplateModel,
} from "./commandFlowTemplateModel.js";

export function createCommandFlowDraftWorkspace({ initialModel = null } = {}) {
  const startingModel = initialModel || defaultCommandFlowTemplateModel();
  const modelStateStore = writable(startingModel);
  const tomlTextStateStore = writable(
    commandFlowTemplateModelToToml(startingModel),
  );
  const errorStateStore = writable("");
  const activeTabStateStore = writable("visual");
  const inspectionStateStore = writable({
    errorMessage: "",
    loading: false,
    varsSchema: [],
  });
  let inspectionVersion = 0;
  let cleanTomlBaseline = get(tomlTextStateStore);

  function invalidateInspection() {
    inspectionVersion += 1;
    inspectionStateStore.set({
      errorMessage: "",
      loading: false,
      varsSchema: [],
    });
  }

  function setModel(model) {
    invalidateInspection();
    modelStateStore.set(model);
    tomlTextStateStore.set(commandFlowTemplateModelToToml(model));
    errorStateStore.set("");
  }

  function setTomlText(tomlText = "") {
    invalidateInspection();
    tomlTextStateStore.set(tomlText);
    try {
      modelStateStore.set(commandFlowTemplateModelFromToml(tomlText));
      errorStateStore.set("");
      return true;
    } catch (error) {
      errorStateStore.set(error?.message || String(error));
      return false;
    }
  }

  function markClean() {
    cleanTomlBaseline = get(tomlTextStateStore);
  }

  function markUnsaved() {
    cleanTomlBaseline = null;
  }

  function isDirty() {
    return (
      cleanTomlBaseline === null ||
      get(tomlTextStateStore) !== cleanTomlBaseline
    );
  }

  function replaceFromToml(tomlText = "") {
    if (!setTomlText(tomlText)) return false;
    markClean();
    return true;
  }

  function beginInspection() {
    inspectionVersion += 1;
    inspectionStateStore.update((state) => ({
      ...state,
      errorMessage: "",
      loading: true,
    }));
    return inspectionVersion;
  }

  function applyInspection(version, detail = {}) {
    if (version !== inspectionVersion) return false;
    inspectionStateStore.set({
      errorMessage: "",
      loading: false,
      varsSchema: Array.isArray(detail.vars_schema) ? detail.vars_schema : [],
    });
    return true;
  }

  function failInspection(version, error) {
    if (version !== inspectionVersion) return false;
    inspectionStateStore.set({
      errorMessage: error?.message || String(error || ""),
      loading: false,
      varsSchema: [],
    });
    return true;
  }

  return {
    activeTabStateStore,
    applyInspection,
    beginInspection,
    canSubmit() {
      const inspection = get(inspectionStateStore);
      return (
        !get(errorStateStore) && !inspection.errorMessage && !inspection.loading
      );
    },
    errorStateStore,
    failInspection,
    inspectionStateStore,
    isDirty,
    markClean,
    markUnsaved,
    modelStateStore,
    replaceFromToml,
    selectTab(tab = "visual") {
      activeTabStateStore.set(
        tab === "toml" || tab === "readonly" ? tab : "visual",
      );
    },
    setModel,
    setTomlText,
    tomlTextStateStore,
  };
}
