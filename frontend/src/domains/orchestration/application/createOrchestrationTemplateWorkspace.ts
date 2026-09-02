import { writable } from "svelte/store";
import { orchestrationTemplateApi } from "../infrastructure/orchestrationTemplateApi.js";

type NameDialogMode = "new" | "save_as";
type SelectionKind = "existing" | "manual" | "new";
type TemplateReplacementReason = "delete" | "new" | "replace" | "select";
type MaybePromise<T> = Promise<T> | T;

interface TemplateOption {
  label: string;
  value: string;
}

interface NameDialogState {
  error: string;
  mode: NameDialogMode;
  open: boolean;
  value: string;
}

interface TemplateDisplayState {
  dirty: boolean;
  errorMessage: string;
  initialized: boolean;
  loadingAction: string;
  nameDialog: NameDialogState;
  selectedName: string;
  selectionKind: SelectionKind;
  statusKind: string;
  statusName: string;
  templateNames: string[];
  templateOptions: TemplateOption[];
}

interface TemplateAction {
  isCurrent(): boolean;
  version: number;
}

interface TemplateListItem {
  name: string;
}

interface TemplateResourceDetail {
  content: string;
  name: string;
}

interface TemplateApiPorts {
  createTemplateResource(
    basePath: string,
    name: string,
    content: string,
  ): Promise<TemplateResourceDetail>;
  deleteTemplateResource(basePath: string, name: string): Promise<object>;
  getTemplateResource(
    basePath: string,
    name: string,
  ): Promise<TemplateResourceDetail>;
  listTemplateResource(basePath: string): Promise<TemplateListItem[]>;
  updateTemplateResource(
    basePath: string,
    name: string,
    content: string,
  ): Promise<TemplateResourceDetail>;
}

interface TemplateWorkspaceOptions extends Partial<TemplateApiPorts> {
  apiBase?: string;
  confirmReplace?: (input: {
    currentName: string;
    reason: TemplateReplacementReason;
  }) => MaybePromise<boolean>;
  createDraft?: () => MaybePromise<boolean | void>;
  getCurrentJson?: () => string;
  replaceJson?: (content: string) => MaybePromise<void>;
}

interface BaselineOptions {
  selectedName?: string;
  selectionKind?: SelectionKind;
  statusKind?: string;
  statusName?: string;
}

function errorMessage(error: unknown): string {
  return error && typeof error === "object" && "message" in error
    ? String(error.message)
    : String(error || "");
}

function templateNames(payload: readonly TemplateListItem[]): string[] {
  return payload
    .map((item) => item.name.trim())
    .filter(Boolean)
    .filter((name, index, names) => names.indexOf(name) === index)
    .sort((left, right) => left.localeCompare(right));
}

function nameDialogState(mode: NameDialogMode = "new"): NameDialogState {
  return {
    error: "",
    mode,
    open: false,
    value: "",
  };
}

function initialDisplayState(): TemplateDisplayState {
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
  listTemplateResource = orchestrationTemplateApi.listTemplateResource,
  getTemplateResource = orchestrationTemplateApi.getTemplateResource,
  createTemplateResource = orchestrationTemplateApi.createTemplateResource,
  updateTemplateResource = orchestrationTemplateApi.updateTemplateResource,
  deleteTemplateResource = orchestrationTemplateApi.deleteTemplateResource,
}: TemplateWorkspaceOptions = {}) {
  const displayStateStore = writable<TemplateDisplayState>(
    initialDisplayState(),
  );
  let displayState = initialDisplayState();
  let baselineJson = getCurrentJson();
  let requestVersion = 0;
  let editRevision = 0;
  let ownedMutationDepth = 0;

  function setDisplay(patch: Partial<TemplateDisplayState> = {}): void {
    displayState = { ...displayState, ...patch };
    displayStateStore.set(displayState);
  }

  function setNames(names: readonly TemplateListItem[] = []): void {
    const normalizedNames = templateNames(names);
    setDisplay({
      templateNames: normalizedNames,
      templateOptions: [
        { label: "", value: "" },
        ...normalizedNames.map((name) => ({ label: name, value: name })),
      ],
    });
  }

  function beginAction(
    loadingAction: string,
    { trackEdits = true }: { trackEdits?: boolean } = {},
  ): TemplateAction {
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

  function finishAction(action: TemplateAction): void {
    if (action.version === requestVersion) {
      setDisplay({ loadingAction: "" });
    }
  }

  async function runAction(
    loadingAction: string,
    operation: (action: TemplateAction) => Promise<boolean>,
  ): Promise<boolean> {
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

  async function runOwnedMutation<T>(
    operation: () => MaybePromise<T>,
  ): Promise<T> {
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
  }: BaselineOptions = {}): void {
    baselineJson = getCurrentJson();
    setDisplay({
      dirty: false,
      selectedName,
      selectionKind,
      statusKind,
      statusName,
    });
  }

  async function refreshTemplateList(
    action: TemplateAction | null = null,
  ): Promise<boolean> {
    const payload = await listTemplateResource(apiBase);
    if (action && !action.isCurrent()) return false;
    setNames(payload);
    return true;
  }

  async function confirmReplacement(
    reason: TemplateReplacementReason = "replace",
  ): Promise<boolean> {
    if (!displayState.dirty) return true;
    return !!(await confirmReplace({
      currentName: displayState.selectedName,
      reason,
    }));
  }

  async function initialize(): Promise<boolean> {
    const action = beginAction("initialize", { trackEdits: false });
    try {
      await refreshTemplateList(action);
      if (!action.isCurrent()) return false;
      baselineJson = getCurrentJson();
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

  async function selectTemplate(rawName: string): Promise<boolean> {
    const name = rawName.trim();
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
      await runOwnedMutation(() => replaceJson(detail.content));
      if (!action.isCurrent()) return false;
      const selectedName = detail.name || name;
      captureBaseline({
        selectedName,
        selectionKind: "existing",
        statusKind: "loaded",
        statusName: selectedName,
      });
      return true;
    });
  }

  function openNameDialog(mode: NameDialogMode): void {
    setDisplay({
      nameDialog: {
        error: "",
        mode,
        open: true,
        value: "",
      },
    });
  }

  function openNewDialog(): void {
    openNameDialog("new");
  }

  function openSaveAsDialog(): void {
    openNameDialog("save_as");
  }

  function closeNameDialog(): void {
    setDisplay({
      nameDialog: { ...displayState.nameDialog, error: "", open: false },
    });
  }

  function changeNameDialogValue(value: string): void {
    setDisplay({
      nameDialog: {
        ...displayState.nameDialog,
        error: "",
        value,
      },
    });
  }

  async function createNamedDraft(name: string): Promise<boolean> {
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

  async function saveAs(name: string): Promise<boolean> {
    return runAction("save_as", async (action) => {
      const content = getCurrentJson();
      const detail = await createTemplateResource(apiBase, name, content);
      if (!action.isCurrent()) return false;
      await refreshTemplateList(action);
      if (!action.isCurrent()) return false;
      const savedName = detail.name || name;
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

  async function submitNameDialog(): Promise<boolean> {
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

  async function saveTemplate(): Promise<boolean> {
    const name = displayState.selectedName.trim();
    if (!name) {
      openSaveAsDialog();
      return false;
    }
    return runAction("save", async (action) => {
      const content = getCurrentJson();
      const creating = displayState.selectionKind === "new";
      const detail = creating
        ? await createTemplateResource(apiBase, name, content)
        : await updateTemplateResource(apiBase, name, content);
      if (!action.isCurrent()) return false;
      await refreshTemplateList(action);
      if (!action.isCurrent()) return false;
      const savedName = detail.name || name;
      captureBaseline({
        selectedName: savedName,
        selectionKind: "existing",
        statusKind: creating ? "created" : "saved",
        statusName: savedName,
      });
      return true;
    });
  }

  async function deleteTemplate(): Promise<boolean> {
    const name = displayState.selectedName.trim();
    if (!name || displayState.selectionKind !== "existing") return false;
    if (!(await confirmReplace({ currentName: name, reason: "delete" }))) {
      return false;
    }
    const snapshot = getCurrentJson();
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

  function markEdited(): void {
    if (ownedMutationDepth > 0) return;
    editRevision += 1;
    setDisplay({ dirty: getCurrentJson() !== baselineJson });
  }

  function adoptManualSnapshot({
    statusKind = "",
    statusName = "",
  }: Pick<BaselineOptions, "statusKind" | "statusName"> = {}): void {
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
