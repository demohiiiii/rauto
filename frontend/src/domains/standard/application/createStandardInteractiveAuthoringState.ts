import { createTemplateAuthoringSession } from "$domains/templates/index.js";
import { derived, get, writable } from "svelte/store";
import {
  interactiveTemplateModelToToml,
  createInteractiveDraftWorkspace,
  defaultInteractiveTemplateModel,
  normalizeLoadedInteractiveTemplateToml,
} from "$domains/command/index.js";
import type { InteractiveTemplateModel } from "$domains/command/index.js";
import { t } from "../../../lib/i18n.js";
import type {
  StandardInteractiveAuthoringState,
  StandardCommandStatusTone,
  StandardInteractiveAuthoringOptions,
  StandardInteractiveSelection,
  StandardInteractiveTemplateDetail,
} from "../model/types.js";

function normalizedName(value = ""): string {
  return value.trim();
}

function errorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message ?? "");
  }
  return String(error ?? "");
}

function templateContent(detail: StandardInteractiveTemplateDetail): string {
  return detail.content;
}

function defaultSelection(): StandardInteractiveSelection {
  return { kind: "new", name: "", value: "" };
}

export function createStandardInteractiveAuthoringState({
  confirmDiscard = () => true,
  createTemplate = async (name, content) => ({ name, content }),
  getTemplate = async (name) => ({
    name,
    content: "",
    vars_schema: [],
  }),
  inspectTemplate = async (content) => ({
    name: "",
    content,
    vars_schema: [],
  }),
  onInspection = () => {},
  parseBuiltinSelection = () => null,
  refreshTemplates = async () => {},
  updateTemplate = async (name, content) => ({ name, content }),
}: StandardInteractiveAuthoringOptions = {}): StandardInteractiveAuthoringState {
  const draft = createInteractiveDraftWorkspace();
  draft.markClean();
  const selectionStateStore =
    writable<StandardInteractiveSelection>(defaultSelection());
  const operationStateStore = writable({
    loadingAction: "",
    statusMessage: "",
    statusTone: "info" as StandardCommandStatusTone,
  });
  const session =
    createTemplateAuthoringSession<StandardInteractiveTemplateDetail>({
      isBusy: () => !!get(operationStateStore).loadingAction,
    });
  const { nameDialogStateStore } = session;
  let loadVersion = 0;
  let inspectionTimer: ReturnType<typeof setTimeout> | null = null;

  const actionStateStore = derived(
    [
      selectionStateStore,
      session.stateStore,
      operationStateStore,
      draft.modelStateStore,
      draft.errorStateStore,
      draft.inspectionStateStore,
    ] as const,
    ([selection, authoring, operation, model, parseError, inspection]) => {
      const valid =
        !parseError && !inspection.errorMessage && !inspection.loading;
      const usable = valid && !!model.command.trim();
      const { readonly, editing } = authoring;
      return {
        canRun: usable && !operation.loadingAction,
        canSave: usable && !readonly && !operation.loadingAction,
        canSaveAs: usable && !operation.loadingAction,
        canEditTemplate:
          selection.kind === "custom" && !editing && !operation.loadingAction,
        editing,
        readonly,
        dirty: draft.isDirty(),
        loadingAction: operation.loadingAction,
        statusMessage: operation.statusMessage,
        statusTone: operation.statusTone,
      };
    },
  );

  function setStatus(
    message = "",
    tone: StandardCommandStatusTone = "info",
  ): void {
    operationStateStore.update((state) => ({
      ...state,
      statusMessage: message,
      statusTone: tone,
    }));
  }

  function setLoadingAction(loadingAction = ""): void {
    operationStateStore.update((state) => ({ ...state, loadingAction }));
  }

  function clearInspectionTimer(): void {
    if (!inspectionTimer) return;
    clearTimeout(inspectionTimer);
    inspectionTimer = null;
  }

  async function performInspection(
    version: number,
    content: string,
  ): Promise<boolean> {
    try {
      const detail = await inspectTemplate(content);
      if (!draft.applyInspection(version, detail)) return false;
      onInspection(detail);
      return true;
    } catch (error) {
      if (!draft.failInspection(version, error)) return false;
      onInspection(null);
      return false;
    }
  }

  function scheduleInspection(): void {
    clearInspectionTimer();
    const version = draft.beginInspection();
    const content = get(draft.tomlTextStateStore);
    inspectionTimer = setTimeout(() => {
      inspectionTimer = null;
      void performInspection(version, content);
    }, 300);
  }

  async function inspectCurrent(): Promise<boolean> {
    clearInspectionTimer();
    if (get(draft.errorStateStore)) return false;
    const version = draft.beginInspection();
    return performInspection(version, get(draft.tomlTextStateStore));
  }

  function classifySelection(value = ""): StandardInteractiveSelection {
    const normalized = normalizedName(value);
    if (!normalized) return defaultSelection();
    const builtinName = parseBuiltinSelection(normalized);
    return builtinName
      ? { kind: "builtin", name: builtinName, value: normalized }
      : { kind: "custom", name: normalized, value: normalized };
  }

  async function allowReplacement(): Promise<boolean> {
    if (!draft.isDirty()) return true;
    return !!(await confirmDiscard(t("interactiveDraftDiscardConfirm")));
  }

  function applyNamedModel(name: string): void {
    const model = get(draft.modelStateStore);
    if (model.name === name) return;
    draft.setModel({ ...model, name });
  }

  function applyLoadedDetail(
    selection: StandardInteractiveSelection,
    detail: StandardInteractiveTemplateDetail,
  ): void {
    const content = normalizeLoadedInteractiveTemplateToml(
      templateContent(detail),
    );
    if (!draft.replaceFromToml(content)) {
      throw new Error(get(draft.errorStateStore));
    }
    applyNamedModel(selection.name);
    draft.markClean();
    const inspectionVersion = draft.beginInspection();
    draft.applyInspection(inspectionVersion, detail);
    onInspection(detail);
    selectionStateStore.set(selection);
  }

  async function selectTemplate(value = ""): Promise<boolean> {
    if (get(operationStateStore).loadingAction.startsWith("save")) return false;
    if (!(await allowReplacement())) return false;
    const selection = classifySelection(value);
    const version = ++loadVersion;
    clearInspectionTimer();
    if (selection.kind === "new") {
      session.adoptSource("manual");
      setLoadingAction();
      draft.setModel(defaultInteractiveTemplateModel());
      draft.markClean();
      selectionStateStore.set(selection);
      onInspection(null);
      setStatus();
      return true;
    }

    setLoadingAction("load");
    setStatus();
    try {
      const detail = await getTemplate(selection.name, {
        builtin: selection.kind === "builtin",
      });
      if (version !== loadVersion) return false;
      applyLoadedDetail(selection, detail);
      session.adoptSource(selection.kind);
      return true;
    } catch (error) {
      if (version === loadVersion) {
        setStatus(errorMessage(error), "error");
      }
      return false;
    } finally {
      if (version === loadVersion) setLoadingAction();
    }
  }

  const canEdit = session.canEdit;

  function startEditing(): void {
    if (
      session.startEditing(() => ({
        name: get(selectionStateStore).name,
        content: get(draft.tomlTextStateStore),
        vars_schema: structuredClone(
          get(draft.inspectionStateStore).varsSchema,
        ),
      }))
    )
      setStatus();
  }

  function cancelEditing(): void {
    if (
      session.cancelEditing((snapshot) => {
        clearInspectionTimer();
        applyLoadedDetail(get(selectionStateStore), snapshot);
      })
    )
      setStatus();
  }

  function copyToManual(): boolean {
    return session.copyToManual(() => {
      selectionStateStore.set(defaultSelection());
      draft.markUnsaved();
      setStatus();
    });
  }

  function setModel(model: InteractiveTemplateModel): void {
    if (!canEdit()) return;
    draft.setModel(model);
    setStatus();
    scheduleInspection();
  }

  function setTomlText(tomlText = ""): boolean {
    if (!canEdit()) return false;
    const valid = draft.setTomlText(tomlText);
    setStatus();
    clearInspectionTimer();
    if (valid) scheduleInspection();
    else onInspection(null);
    return valid;
  }

  function contentForName(name: string): string {
    return interactiveTemplateModelToToml({
      ...get(draft.modelStateStore),
      name,
    });
  }

  function applySavedTemplate(name: string, content: string): void {
    const vars_schema = get(draft.inspectionStateStore).varsSchema;
    draft.setTomlText(content);
    draft.applyInspection(draft.beginInspection(), { vars_schema });
    draft.markClean();
    selectionStateStore.set({ kind: "custom", name, value: name });
    session.adoptSource("custom");
  }

  async function save(): Promise<boolean> {
    const selection = get(selectionStateStore);
    const actions = get(actionStateStore);
    if (!actions.canSave) return false;
    const name = normalizedName(selection.name);
    if (selection.kind !== "custom") {
      session.openNameDialog();
      return false;
    }
    return persistTemplate(name, false);
  }

  async function persistTemplate(
    name: string,
    creating: boolean,
  ): Promise<boolean> {
    const content = contentForName(name);
    setLoadingAction(creating ? "saveAs" : "save");
    setStatus();
    try {
      await (creating
        ? createTemplate(name, content)
        : updateTemplate(name, content));
      await refreshTemplates();
      applySavedTemplate(name, content);
      setStatus(`${t("interactiveTemplateSaved")}: ${name}`, "success");
      return true;
    } catch (error) {
      setStatus(errorMessage(error), "error");
      return false;
    } finally {
      setLoadingAction();
    }
  }

  async function saveAs(name = ""): Promise<boolean> {
    const actions = get(actionStateStore);
    const targetName = normalizedName(name);
    if (!actions.canSaveAs || !targetName) {
      setStatus(t("interactiveTemplateSaveNameRequired"), "error");
      return false;
    }
    return persistTemplate(targetName, true);
  }

  function executeSource() {
    if (!get(actionStateStore).canRun) {
      throw new Error(t("interactiveDraftInvalid"));
    }
    return {
      content: get(draft.tomlTextStateStore),
      kind: "temporary" as const,
    };
  }

  function submitNameDialog(): Promise<boolean> {
    return session.submitNameDialog(
      saveAs,
      () => get(operationStateStore).statusMessage,
    );
  }

  return {
    actionStateStore,
    startEditing,
    cancelEditing,
    copyToManual,
    closeNameDialog: session.closeNameDialog,
    draft,
    executeSource,
    inspectCurrent,
    nameDialogStateStore,
    operationStateStore,
    save,
    saveAs,
    selectionStateStore,
    selectTemplate,
    setModel,
    setNameDialogValue: session.changeNameDialogValue,
    setTomlText,
    submitNameDialog,
  };
}
