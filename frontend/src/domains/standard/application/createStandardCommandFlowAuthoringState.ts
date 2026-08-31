import { derived, get, writable } from "svelte/store";
import {
  commandFlowTemplateModelToToml,
  createCommandFlowDraftWorkspace,
  defaultCommandFlowTemplateModel,
  normalizeLoadedCommandFlowTemplateToml,
} from "$domains/command/index.js";
import type { CommandFlowTemplateModel } from "$domains/command/index.js";
import { t } from "../../../lib/i18n.js";
import type {
  StandardCommandFlowAuthoringState,
  StandardCommandStatusTone,
  StandardFlowAuthoringOptions,
  StandardFlowNameDialogAction,
  StandardFlowSelection,
  StandardFlowTemplateDetail,
} from "../model/types.js";

function normalizedName(value: unknown = ""): string {
  return String(value || "").trim();
}

function errorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message ?? "");
  }
  return String(error ?? "");
}

function templateContent(detail: StandardFlowTemplateDetail): string {
  return typeof detail.content === "string" ? detail.content : "";
}

function defaultSelection(): StandardFlowSelection {
  return { kind: "new", name: "", value: "" };
}

export function createStandardCommandFlowAuthoringState({
  confirmDiscard = () => true,
  createTemplate = async () => undefined,
  getTemplate = async () => ({}),
  inspectTemplate = async () => ({}),
  onInspection = () => {},
  parseBuiltinSelection = () => null,
  refreshTemplates = async () => undefined,
  updateTemplate = async () => undefined,
}: StandardFlowAuthoringOptions = {}): StandardCommandFlowAuthoringState {
  const draft = createCommandFlowDraftWorkspace();
  draft.markClean();
  const selectionStateStore =
    writable<StandardFlowSelection>(defaultSelection());
  const operationStateStore = writable({
    loadingAction: "",
    statusMessage: "",
    statusTone: "info" as StandardCommandStatusTone,
  });
  const nameDialogStateStore = writable({
    action: "new" as StandardFlowNameDialogAction,
    errorMessage: "",
    open: false,
    value: "",
  });
  let loadVersion = 0;
  let inspectionTimer: ReturnType<typeof setTimeout> | null = null;

  const actionStateStore = derived(
    [
      selectionStateStore,
      operationStateStore,
      draft.modelStateStore,
      draft.errorStateStore,
      draft.inspectionStateStore,
    ] as const,
    ([selection, operation, _model, parseError, inspection]) => {
      const valid =
        !parseError && !inspection.errorMessage && !inspection.loading;
      const hasSelectedName = !!normalizedName(selection.name);
      const canUseCurrentDraft = selection.kind !== "new" || hasSelectedName;
      return {
        canRun: valid && canUseCurrentDraft,
        canSave:
          valid &&
          hasSelectedName &&
          (selection.kind === "custom" || selection.kind === "new"),
        canSaveAs: valid && canUseCurrentDraft,
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

  function classifySelection(value: unknown = ""): StandardFlowSelection {
    const normalized = normalizedName(value);
    if (!normalized) return defaultSelection();
    const builtinName = parseBuiltinSelection(normalized);
    return builtinName
      ? { kind: "builtin", name: builtinName, value: normalized }
      : { kind: "custom", name: normalized, value: normalized };
  }

  async function allowReplacement(): Promise<boolean> {
    if (!draft.isDirty()) return true;
    return !!(await confirmDiscard(t("flowDraftDiscardConfirm")));
  }

  function applyNamedModel(name: string): void {
    const model = get(draft.modelStateStore);
    if (model.name === name) return;
    draft.setModel({ ...model, name });
  }

  function applyLoadedDetail(
    selection: StandardFlowSelection,
    detail: StandardFlowTemplateDetail = {},
  ): void {
    const content = normalizeLoadedCommandFlowTemplateToml(
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

  async function selectTemplate(value: unknown = ""): Promise<boolean> {
    if (!(await allowReplacement())) return false;
    const selection = classifySelection(value);
    const version = ++loadVersion;
    clearInspectionTimer();
    if (selection.kind === "new") {
      draft.setModel(defaultCommandFlowTemplateModel());
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

  function createNewDraft(name: unknown = ""): boolean {
    const templateName = normalizedName(name);
    if (!templateName) return false;
    loadVersion += 1;
    clearInspectionTimer();
    draft.setModel({
      ...defaultCommandFlowTemplateModel(),
      name: templateName,
    });
    draft.markUnsaved();
    selectionStateStore.set({ kind: "new", name: templateName, value: "" });
    onInspection(null);
    setStatus();
    return true;
  }

  function setModel(model: CommandFlowTemplateModel): void {
    draft.setModel(model);
    setStatus();
    scheduleInspection();
  }

  function setTomlText(tomlText = ""): boolean {
    const valid = draft.setTomlText(tomlText);
    setStatus();
    clearInspectionTimer();
    if (valid) scheduleInspection();
    else onInspection(null);
    return valid;
  }

  function contentForName(name: string): string {
    return commandFlowTemplateModelToToml({
      ...get(draft.modelStateStore),
      name,
    });
  }

  function applySavedTemplate(name: string, content: string): void {
    draft.setTomlText(content);
    draft.markClean();
    selectionStateStore.set({ kind: "custom", name, value: name });
  }

  async function save(): Promise<boolean> {
    const selection = get(selectionStateStore);
    const actions = get(actionStateStore);
    if (selection.kind === "builtin") {
      setStatus(t("flowBuiltinSaveDisabled"), "error");
      return false;
    }
    const name = normalizedName(selection.name);
    if (!actions.canSave || !name) {
      setStatus(t("flowTemplateSaveNameRequired"), "error");
      return false;
    }
    const content = contentForName(name);
    setLoadingAction("save");
    setStatus();
    try {
      if (selection.kind === "custom") {
        await updateTemplate(name, content);
      } else {
        await createTemplate(name, content);
      }
      await refreshTemplates();
      applySavedTemplate(name, content);
      setStatus(`${t("flowTemplateSaved")}: ${name}`, "success");
      return true;
    } catch (error) {
      setStatus(errorMessage(error), "error");
      return false;
    } finally {
      setLoadingAction();
    }
  }

  async function saveAs(name: unknown = ""): Promise<boolean> {
    const actions = get(actionStateStore);
    const targetName = normalizedName(name);
    if (!actions.canSaveAs || !targetName) {
      setStatus(t("flowTemplateSaveNameRequired"), "error");
      return false;
    }
    const content = contentForName(targetName);
    setLoadingAction("saveAs");
    setStatus();
    try {
      await createTemplate(targetName, content);
      await refreshTemplates();
      applySavedTemplate(targetName, content);
      setStatus(`${t("flowTemplateSaved")}: ${targetName}`, "success");
      return true;
    } catch (error) {
      setStatus(errorMessage(error), "error");
      return false;
    } finally {
      setLoadingAction();
    }
  }

  function executeSource() {
    if (!get(actionStateStore).canRun) {
      throw new Error(t("flowDraftInvalid"));
    }
    return {
      content: get(draft.tomlTextStateStore),
      kind: "temporary" as const,
    };
  }

  function openNameDialog(action: StandardFlowNameDialogAction): void {
    const selection = get(selectionStateStore);
    nameDialogStateStore.set({
      action,
      errorMessage: "",
      open: true,
      value:
        action === "saveAs" && selection.name ? `${selection.name}-copy` : "",
    });
  }

  function openNewDialog(): void {
    openNameDialog("new");
  }

  function openSaveAsDialog(): void {
    openNameDialog("saveAs");
  }

  function closeNameDialog(): void {
    nameDialogStateStore.update((state) => ({ ...state, open: false }));
  }

  function setNameDialogValue(value: unknown = ""): void {
    nameDialogStateStore.update((state) => ({
      ...state,
      errorMessage: "",
      value: String(value || ""),
    }));
  }

  async function submitNameDialog(): Promise<boolean> {
    const dialog = get(nameDialogStateStore);
    const name = normalizedName(dialog.value);
    if (!name) {
      nameDialogStateStore.update((state) => ({
        ...state,
        errorMessage: t("flowTemplateSaveNameRequired"),
      }));
      return false;
    }
    let success: boolean;
    if (dialog.action === "new") {
      if (!(await allowReplacement())) return false;
      success = createNewDraft(name);
    } else {
      success = await saveAs(name);
    }
    if (success) closeNameDialog();
    return success;
  }

  return {
    actionStateStore,
    closeNameDialog,
    createNewDraft,
    draft,
    executeSource,
    inspectCurrent,
    nameDialogStateStore,
    openNewDialog,
    openSaveAsDialog,
    operationStateStore,
    save,
    saveAs,
    selectionStateStore,
    selectTemplate,
    setModel,
    setNameDialogValue,
    setTomlText,
    submitNameDialog,
  };
}
