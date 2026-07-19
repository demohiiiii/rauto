import { derived, get, writable } from "svelte/store";
import { t } from "../../lib/i18n.js";
import { createCommandFlowDraftWorkspace } from "../command/commandFlowDraftState.js";
import {
  commandFlowTemplateModelToToml,
  defaultCommandFlowTemplateModel,
  normalizeLoadedCommandFlowTemplateToml,
} from "../command/commandFlowTemplateModel.js";

function normalizedName(value = "") {
  return String(value || "").trim();
}

function defaultSelection() {
  return { kind: "new", name: "", value: "" };
}

export function createStandardCommandFlowAuthoringState({
  confirmDiscard = () => true,
  createTemplate,
  getTemplate,
  inspectTemplate,
  onInspection = () => {},
  parseBuiltinSelection = () => null,
  refreshTemplates = async () => {},
  updateTemplate,
} = {}) {
  const draft = createCommandFlowDraftWorkspace();
  draft.markClean();
  const selectionStateStore = writable(defaultSelection());
  const operationStateStore = writable({
    loadingAction: "",
    statusMessage: "",
    statusTone: "info",
  });
  const nameDialogStateStore = writable({
    action: "new",
    errorMessage: "",
    open: false,
    value: "",
  });
  let loadVersion = 0;
  let inspectionTimer = null;

  const actionStateStore = derived(
    [
      selectionStateStore,
      operationStateStore,
      draft.modelStateStore,
      draft.errorStateStore,
      draft.inspectionStateStore,
    ],
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

  function setStatus(message = "", tone = "info") {
    operationStateStore.update((state) => ({
      ...state,
      statusMessage: message,
      statusTone: tone,
    }));
  }

  function setLoadingAction(loadingAction = "") {
    operationStateStore.update((state) => ({ ...state, loadingAction }));
  }

  function clearInspectionTimer() {
    if (!inspectionTimer) return;
    clearTimeout(inspectionTimer);
    inspectionTimer = null;
  }

  async function performInspection(version, content) {
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

  function scheduleInspection() {
    clearInspectionTimer();
    const version = draft.beginInspection();
    const content = get(draft.tomlTextStateStore);
    inspectionTimer = setTimeout(() => {
      inspectionTimer = null;
      void performInspection(version, content);
    }, 300);
  }

  async function inspectCurrent() {
    clearInspectionTimer();
    if (get(draft.errorStateStore)) return false;
    const version = draft.beginInspection();
    return performInspection(version, get(draft.tomlTextStateStore));
  }

  function classifySelection(value = "") {
    const normalized = normalizedName(value);
    if (!normalized) return defaultSelection();
    const builtinName = parseBuiltinSelection(normalized);
    return builtinName
      ? { kind: "builtin", name: builtinName, value: normalized }
      : { kind: "custom", name: normalized, value: normalized };
  }

  async function allowReplacement() {
    if (!draft.isDirty()) return true;
    return !!(await confirmDiscard(t("flowDraftDiscardConfirm")));
  }

  function applyNamedModel(name) {
    const model = get(draft.modelStateStore);
    if (model.name === name) return;
    draft.setModel({ ...model, name });
  }

  function applyLoadedDetail(selection, detail = {}) {
    const content = normalizeLoadedCommandFlowTemplateToml(detail?.content);
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

  async function selectTemplate(value = "") {
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
        setStatus(error?.message || String(error), "error");
      }
      return false;
    } finally {
      if (version === loadVersion) setLoadingAction();
    }
  }

  function createNewDraft(name) {
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

  function setModel(model = {}) {
    draft.setModel(model);
    setStatus();
    scheduleInspection();
  }

  function setTomlText(tomlText = "") {
    const valid = draft.setTomlText(tomlText);
    setStatus();
    clearInspectionTimer();
    if (valid) scheduleInspection();
    else onInspection(null);
    return valid;
  }

  function contentForName(name) {
    return commandFlowTemplateModelToToml({
      ...get(draft.modelStateStore),
      name,
    });
  }

  function applySavedTemplate(name, content) {
    draft.setTomlText(content);
    draft.markClean();
    selectionStateStore.set({ kind: "custom", name, value: name });
  }

  async function save() {
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
      setStatus(error?.message || String(error), "error");
      return false;
    } finally {
      setLoadingAction();
    }
  }

  async function saveAs(name) {
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
      setStatus(error?.message || String(error), "error");
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
      kind: "temporary",
    };
  }

  function openNameDialog(action) {
    const selection = get(selectionStateStore);
    nameDialogStateStore.set({
      action,
      errorMessage: "",
      open: true,
      value:
        action === "saveAs" && selection.name ? `${selection.name}-copy` : "",
    });
  }

  function openNewDialog() {
    openNameDialog("new");
  }

  function openSaveAsDialog() {
    openNameDialog("saveAs");
  }

  function closeNameDialog() {
    nameDialogStateStore.update((state) => ({ ...state, open: false }));
  }

  function setNameDialogValue(value = "") {
    nameDialogStateStore.update((state) => ({
      ...state,
      errorMessage: "",
      value: String(value || ""),
    }));
  }

  async function submitNameDialog() {
    const dialog = get(nameDialogStateStore);
    const name = normalizedName(dialog.value);
    if (!name) {
      nameDialogStateStore.update((state) => ({
        ...state,
        errorMessage: t("flowTemplateSaveNameRequired"),
      }));
      return false;
    }
    let success;
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
