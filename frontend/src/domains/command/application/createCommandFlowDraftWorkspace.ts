import { get, writable } from "svelte/store";
import {
  commandFlowTemplateModelFromToml,
  commandFlowTemplateModelToToml,
  defaultCommandFlowTemplateModel,
} from "../model/commandFlowTemplate.js";
import type {
  CommandFlowDraftOptions,
  CommandFlowDraftWorkspace,
  CommandFlowInspectionPayload,
  CommandFlowInspectionState,
  CommandFlowTemplateModel,
} from "../model/types.js";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error ?? "");
}

function emptyInspectionState(): CommandFlowInspectionState {
  return {
    errorMessage: "",
    loading: false,
    varsSchema: [],
  };
}

export function createCommandFlowDraftWorkspace({
  initialModel = null,
}: CommandFlowDraftOptions = {}): CommandFlowDraftWorkspace {
  const startingModel = initialModel ?? defaultCommandFlowTemplateModel();
  const modelStateStore = writable<CommandFlowTemplateModel>(startingModel);
  const tomlTextStateStore = writable(
    commandFlowTemplateModelToToml(startingModel),
  );
  const errorStateStore = writable("");
  const activeTabStateStore = writable<"visual" | "toml" | "readonly">(
    "visual",
  );
  const inspectionStateStore = writable<CommandFlowInspectionState>(
    emptyInspectionState(),
  );
  let inspectionVersion = 0;
  let cleanTomlBaseline: string | null = get(tomlTextStateStore);

  function invalidateInspection(): void {
    inspectionVersion += 1;
    inspectionStateStore.set(emptyInspectionState());
  }

  function setModel(model: CommandFlowTemplateModel): void {
    invalidateInspection();
    modelStateStore.set(model);
    tomlTextStateStore.set(commandFlowTemplateModelToToml(model));
    errorStateStore.set("");
  }

  function setTomlText(tomlText = ""): boolean {
    invalidateInspection();
    tomlTextStateStore.set(tomlText);
    try {
      modelStateStore.set(commandFlowTemplateModelFromToml(tomlText));
      errorStateStore.set("");
      return true;
    } catch (error) {
      errorStateStore.set(errorMessage(error));
      return false;
    }
  }

  function markClean(): void {
    cleanTomlBaseline = get(tomlTextStateStore);
  }

  function markUnsaved(): void {
    cleanTomlBaseline = null;
  }

  function isDirty(): boolean {
    return (
      cleanTomlBaseline === null ||
      get(tomlTextStateStore) !== cleanTomlBaseline
    );
  }

  function replaceFromToml(tomlText = ""): boolean {
    if (!setTomlText(tomlText)) return false;
    markClean();
    return true;
  }

  function beginInspection(): number {
    inspectionVersion += 1;
    inspectionStateStore.update((state) => ({
      ...state,
      errorMessage: "",
      loading: true,
    }));
    return inspectionVersion;
  }

  function applyInspection(
    version: number,
    detail: CommandFlowInspectionPayload = {},
  ): boolean {
    if (version !== inspectionVersion) return false;
    inspectionStateStore.set({
      errorMessage: "",
      loading: false,
      varsSchema: Array.isArray(detail.vars_schema) ? detail.vars_schema : [],
    });
    return true;
  }

  function failInspection(version: number, error: unknown): boolean {
    if (version !== inspectionVersion) return false;
    inspectionStateStore.set({
      errorMessage: errorMessage(error),
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
