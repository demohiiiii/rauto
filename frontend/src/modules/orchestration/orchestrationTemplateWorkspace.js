import { writable } from "svelte/store";

import {
  createTemplateResource as createTemplateResourceApi,
  deleteTemplateResource as deleteTemplateResourceApi,
  getTemplateResource as getTemplateResourceApi,
  listTemplateResource as listTemplateResourceApi,
  updateTemplateResource as updateTemplateResourceApi,
} from "../../api/client.js";

function errorMessage(error) {
  return error && typeof error === "object" && "message" in error
    ? String(error.message)
    : String(error || "");
}

function templateNames(payload) {
  return (Array.isArray(payload) ? payload : [])
    .map((item) => (typeof item === "string" ? item : String(item?.name || "")))
    .map((name) => name.trim())
    .filter(Boolean)
    .filter((name, index, names) => names.indexOf(name) === index)
    .sort((left, right) => left.localeCompare(right));
}

function nameDialogState(mode = "new") {
  return {
    error: "",
    mode,
    open: false,
    value: "",
  };
}

function initialDisplayState() {
  return {
    dirty: false,
    errorMessage: "",
    initialized: false,
    loadingAction: "",
    nameDialog: nameDialogState(),
    selectedName: "",
    selectionKind: "manual",
    statusKind: "",
    statusName: "",
    templateNames: [],
    templateOptions: [{ label: "", value: "" }],
  };
}

export function createOrchestrationTemplateWorkspace({
  apiBase = "/api/orchestration-templates",
  confirmReplace = () => true,
  createDraft = () => undefined,
  getCurrentJson = () => "",
  replaceJson = () => undefined,
  listTemplateResource = listTemplateResourceApi,
  getTemplateResource = getTemplateResourceApi,
  createTemplateResource = createTemplateResourceApi,
  updateTemplateResource = updateTemplateResourceApi,
  deleteTemplateResource = deleteTemplateResourceApi,
} = {}) {
  const displayStateStore = writable(initialDisplayState());
  let displayState = initialDisplayState();
  let baselineJson = String(getCurrentJson() || "");
  let requestVersion = 0;
  let editRevision = 0;
  let ownedMutationDepth = 0;

  function setDisplay(patch = {}) {
    displayState = { ...displayState, ...patch };
    displayStateStore.set(displayState);
  }

  function setNames(names = []) {
    const normalizedNames = templateNames(names);
    setDisplay({
      templateNames: normalizedNames,
      templateOptions: [
        { label: "", value: "" },
        ...normalizedNames.map((name) => ({ label: name, value: name })),
      ],
    });
  }

  function beginAction(loadingAction, { trackEdits = true } = {}) {
    requestVersion += 1;
    const version = requestVersion;
    const startingEditRevision = editRevision;
    setDisplay({ errorMessage: "", loadingAction });
    return {
      isCurrent() {
        return (
          version === requestVersion &&
          (!trackEdits || startingEditRevision === editRevision)
        );
      },
      version,
    };
  }

  function finishAction(action) {
    if (action.version === requestVersion) {
      setDisplay({ loadingAction: "" });
    }
  }

  async function runAction(loadingAction, operation) {
    const action = beginAction(loadingAction);
    try {
      return await operation(action);
    } catch (error) {
      if (action.isCurrent()) setDisplay({ errorMessage: errorMessage(error) });
      return false;
    } finally {
      finishAction(action);
    }
  }

  async function runOwnedMutation(operation) {
    ownedMutationDepth += 1;
    try {
      return await operation();
    } finally {
      ownedMutationDepth -= 1;
    }
  }

  function captureBaseline({
    selectedName = displayState.selectedName,
    selectionKind = displayState.selectionKind,
    statusKind = "",
    statusName = "",
  } = {}) {
    baselineJson = String(getCurrentJson() || "");
    setDisplay({
      dirty: false,
      selectedName,
      selectionKind,
      statusKind,
      statusName,
    });
  }

  async function refreshTemplateList(action = null) {
    const payload = await listTemplateResource(apiBase);
    if (action && !action.isCurrent()) return false;
    setNames(payload);
    return true;
  }

  async function confirmReplacement(reason = "replace") {
    if (!displayState.dirty) return true;
    return !!(await confirmReplace({
      currentName: displayState.selectedName,
      reason,
    }));
  }

  async function initialize() {
    const action = beginAction("initialize", { trackEdits: false });
    try {
      await refreshTemplateList(action);
      if (!action.isCurrent()) return false;
      baselineJson = String(getCurrentJson() || "");
      setDisplay({ initialized: true });
      return true;
    } catch (error) {
      if (action.isCurrent()) {
        setDisplay({ errorMessage: errorMessage(error), initialized: true });
      }
      return false;
    } finally {
      finishAction(action);
    }
  }

  async function selectTemplate(rawName) {
    const name = String(rawName || "").trim();
    if (
      name === displayState.selectedName &&
      (name || displayState.selectionKind === "manual")
    ) {
      return true;
    }
    if (!(await confirmReplacement("select"))) return false;
    return runAction("select", async (action) => {
      if (!name) {
        const result = await runOwnedMutation(() => createDraft());
        if (result === false || !action.isCurrent()) return false;
        captureBaseline({ selectedName: "", selectionKind: "manual" });
        return true;
      }
      const detail = await getTemplateResource(apiBase, name);
      if (!action.isCurrent()) return false;
      const content = String(detail?.content ?? "");
      await runOwnedMutation(() => replaceJson(content));
      if (!action.isCurrent()) return false;
      captureBaseline({
        selectedName: String(detail?.name || name),
        selectionKind: "existing",
        statusKind: "loaded",
        statusName: String(detail?.name || name),
      });
      return true;
    });
  }

  function openNameDialog(mode) {
    setDisplay({
      nameDialog: {
        error: "",
        mode,
        open: true,
        value: "",
      },
    });
  }

  function openNewDialog() {
    openNameDialog("new");
  }

  function openSaveAsDialog() {
    openNameDialog("save_as");
  }

  function closeNameDialog() {
    setDisplay({
      nameDialog: { ...displayState.nameDialog, error: "", open: false },
    });
  }

  function changeNameDialogValue(value) {
    setDisplay({
      nameDialog: {
        ...displayState.nameDialog,
        error: "",
        value: String(value ?? ""),
      },
    });
  }

  async function createNamedDraft(name) {
    if (!(await confirmReplacement("new"))) return false;
    return runAction("new", async (action) => {
      const result = await runOwnedMutation(() => createDraft());
      if (result === false || !action.isCurrent()) return false;
      captureBaseline({
        selectedName: name,
        selectionKind: "new",
        statusKind: "new",
        statusName: name,
      });
      closeNameDialog();
      return true;
    });
  }

  async function saveAs(name) {
    return runAction("save_as", async (action) => {
      const content = String(getCurrentJson() || "");
      const detail = await createTemplateResource(apiBase, name, content);
      if (!action.isCurrent()) return false;
      await refreshTemplateList(action);
      if (!action.isCurrent()) return false;
      const savedName = String(detail?.name || name);
      captureBaseline({
        selectedName: savedName,
        selectionKind: "existing",
        statusKind: "created",
        statusName: savedName,
      });
      closeNameDialog();
      return true;
    });
  }

  async function submitNameDialog() {
    const name = displayState.nameDialog.value.trim();
    if (!name) {
      setDisplay({
        nameDialog: {
          ...displayState.nameDialog,
          error: "name_required",
        },
      });
      return false;
    }
    return displayState.nameDialog.mode === "new"
      ? createNamedDraft(name)
      : saveAs(name);
  }

  async function saveTemplate() {
    const name = displayState.selectedName.trim();
    if (!name) {
      openSaveAsDialog();
      return false;
    }
    return runAction("save", async (action) => {
      const content = String(getCurrentJson() || "");
      const detail =
        displayState.selectionKind === "new"
          ? await createTemplateResource(apiBase, name, content)
          : await updateTemplateResource(apiBase, name, content);
      if (!action.isCurrent()) return false;
      await refreshTemplateList(action);
      if (!action.isCurrent()) return false;
      const savedName = String(detail?.name || name);
      captureBaseline({
        selectedName: savedName,
        selectionKind: "existing",
        statusKind: displayState.selectionKind === "new" ? "created" : "saved",
        statusName: savedName,
      });
      return true;
    });
  }

  async function deleteTemplate() {
    const name = displayState.selectedName.trim();
    if (!name || displayState.selectionKind !== "existing") return false;
    if (!(await confirmReplace({ currentName: name, reason: "delete" }))) {
      return false;
    }
    const snapshot = String(getCurrentJson() || "");
    return runAction("delete", async (action) => {
      await deleteTemplateResource(apiBase, name);
      if (!action.isCurrent()) return false;
      await refreshTemplateList(action);
      if (!action.isCurrent()) return false;
      await runOwnedMutation(() => replaceJson(snapshot));
      if (!action.isCurrent()) return false;
      captureBaseline({
        selectedName: "",
        selectionKind: "manual",
        statusKind: "deleted",
        statusName: name,
      });
      return true;
    });
  }

  function markEdited() {
    if (ownedMutationDepth > 0) return;
    editRevision += 1;
    setDisplay({ dirty: String(getCurrentJson() || "") !== baselineJson });
  }

  function adoptManualSnapshot({ statusKind = "", statusName = "" } = {}) {
    requestVersion += 1;
    captureBaseline({
      selectedName: "",
      selectionKind: "manual",
      statusKind,
      statusName,
    });
  }

  return {
    adoptManualSnapshot,
    changeNameDialogValue,
    closeNameDialog,
    deleteTemplate,
    displayStateStore,
    initialize,
    markEdited,
    openNewDialog,
    openSaveAsDialog,
    saveTemplate,
    selectTemplate,
    submitNameDialog,
  };
}
