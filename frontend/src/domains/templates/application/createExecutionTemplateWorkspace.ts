import type { TemplateNameDialogState } from "../model/templateAuthoring.js";
import { createTemplateAuthoringSession } from "./createTemplateAuthoringSession.js";
import { writable } from "svelte/store";
import { templatesApi } from "../infrastructure/templatesApi.js";

export type ExecutionTemplateSelectionKind = "existing" | "manual";
export type ExecutionTemplateReplacementReason = "select";
type MaybePromise<T> = Promise<T> | T;

export interface ExecutionTemplateDisplayState {
  dirty: boolean;
  editing: boolean;
  readonly: boolean;
  errorMessage: string;
  initialized: boolean;
  loadingAction: string;
  nameDialog: TemplateNameDialogState;
  selectedName: string;
  selectionKind: ExecutionTemplateSelectionKind;
  statusKind: string;
  statusName: string;
  templateNames: string[];
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
  initialSelectedName?: string;
  confirmReplace?: (input: {
    currentName: string;
    reason: ExecutionTemplateReplacementReason;
  }) => MaybePromise<boolean>;
  createDraft?: () => MaybePromise<boolean | void>;
  getCurrentJson?: () => string;
  replaceJson?: (content: string) => MaybePromise<void>;
  validateContent?: (content: string) => void;
}

interface BaselineOptions {
  selectedName?: string;
  selectionKind?: ExecutionTemplateSelectionKind;
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

function nameDialogState(): TemplateNameDialogState {
  return {
    error: "",
    open: false,
    value: "",
  };
}

function initialDisplayState(): ExecutionTemplateDisplayState {
  return {
    dirty: false,
    editing: false,
    readonly: false,
    errorMessage: "",
    initialized: false,
    loadingAction: "",
    nameDialog: nameDialogState(),
    selectedName: "",
    selectionKind: "manual",
    statusKind: "",
    statusName: "",
    templateNames: [],
  };
}

export function createExecutionTemplateWorkspace({
  apiBase = "/api/templates",
  initialSelectedName = "",
  confirmReplace = () => true,
  createDraft = () => undefined,
  getCurrentJson = () => "",
  replaceJson = () => undefined,
  validateContent = () => undefined,
  listTemplateResource = templatesApi.listTemplateResource,
  getTemplateResource = templatesApi.getTemplateResource,
  createTemplateResource = templatesApi.createTemplateResource,
  updateTemplateResource = templatesApi.updateTemplateResource,
}: TemplateWorkspaceOptions = {}) {
  const displayStateStore = writable<ExecutionTemplateDisplayState>(
    initialDisplayState(),
  );
  let displayState = initialDisplayState();
  let baselineJson = getCurrentJson();
  let requestVersion = 0;
  let editRevision = 0;
  let ownedMutationDepth = 0;
  let destroyed = false;
  const session = createTemplateAuthoringSession<string>({
    isBusy: () => !!displayState.loadingAction,
  });
  const unsubscribeSession = session.stateStore.subscribe(
    ({ editing, readonly, nameDialog }) =>
      setDisplay({ editing, readonly, nameDialog }),
  );

  if (initialSelectedName) {
    captureBaseline({
      selectedName: initialSelectedName,
      selectionKind: "existing",
    });
  }

  function setDisplay(
    patch: Partial<ExecutionTemplateDisplayState> = {},
  ): void {
    if (destroyed) return;
    displayState = { ...displayState, ...patch };
    displayStateStore.set(displayState);
  }

  function setNames(names: readonly TemplateListItem[] = []): void {
    const normalizedNames = templateNames(names);
    setDisplay({
      templateNames: normalizedNames,
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
          !destroyed &&
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
    if (destroyed) return false;
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
    session.adoptSource(selectionKind === "existing" ? "custom" : "manual");
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
    reason: ExecutionTemplateReplacementReason = "select",
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
      if (
        initialSelectedName &&
        displayState.selectedName === initialSelectedName &&
        !displayState.initialized
      ) {
        const detail = await getTemplateResource(apiBase, initialSelectedName);
        if (!action.isCurrent()) return false;
        validateContent(detail.content);
        await runOwnedMutation(() => replaceJson(detail.content));
        if (!action.isCurrent()) return false;
        captureBaseline({
          selectedName: detail.name || initialSelectedName,
          selectionKind: "existing",
        });
      }
      baselineJson = getCurrentJson();
      setDisplay({ initialized: true });
      return true;
    } catch (error) {
      if (action.isCurrent()) {
        setDisplay({
          errorMessage: errorMessage(error),
          initialized: !initialSelectedName,
        });
      }
      return false;
    } finally {
      finishAction(action);
    }
  }

  async function selectTemplate(rawName: string): Promise<boolean> {
    if (destroyed || displayState.loadingAction.startsWith("save"))
      return false;
    const name = rawName.trim();
    if (
      name === displayState.selectedName &&
      (name || displayState.selectionKind === "manual")
    ) {
      return true;
    }
    const selectionVersion = ++requestVersion;
    if (
      !(await confirmReplacement("select")) ||
      destroyed ||
      selectionVersion !== requestVersion
    )
      return false;
    return runAction("select", async (action) => {
      if (!name) {
        const result = await runOwnedMutation(() => createDraft());
        if (result === false || !action.isCurrent()) return false;
        captureBaseline({ selectedName: "", selectionKind: "manual" });
        return true;
      }
      const detail = await getTemplateResource(apiBase, name);
      if (!action.isCurrent()) return false;
      validateContent(detail.content);
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

  async function persistTemplate(
    name: string,
    creating: boolean,
  ): Promise<boolean> {
    return runAction(creating ? "save_as" : "save", async (action) => {
      const content = getCurrentJson();
      validateContent(content);
      const detail = await (creating
        ? createTemplateResource(apiBase, name, content)
        : updateTemplateResource(apiBase, name, content));
      if (!action.isCurrent()) return false;
      const savedName = detail.name || name;
      setNames([
        ...displayState.templateNames.map((name) => ({ name })),
        { name: savedName },
      ]);
      captureBaseline({
        selectedName: savedName,
        selectionKind: "existing",
        statusKind: creating ? "created" : "saved",
        statusName: savedName,
      });
      return true;
    });
  }

  function submitNameDialog(): Promise<boolean> {
    return session.submitNameDialog(
      (name) => persistTemplate(name, true),
      () => displayState.errorMessage,
    );
  }

  async function saveTemplate(): Promise<boolean> {
    if (!canEdit()) return false;
    const name = displayState.selectedName.trim();
    if (!name) {
      session.openNameDialog();
      return false;
    }
    return persistTemplate(name, false);
  }

  function markEdited(): void {
    if (ownedMutationDepth > 0 || displayState.readonly) return;
    editRevision += 1;
    setDisplay({ dirty: getCurrentJson() !== baselineJson });
  }

  async function importContent(
    readContent: () => Promise<string>,
  ): Promise<boolean> {
    if (!canEdit()) return false;
    const version = requestVersion;
    if (
      !(await confirmReplacement()) ||
      destroyed ||
      version !== requestVersion
    )
      return false;
    return runAction("import", async (action) => {
      const content = await readContent();
      if (!action.isCurrent()) return false;
      validateContent(content);
      await runOwnedMutation(() => replaceJson(content));
      if (!action.isCurrent()) return false;
      captureBaseline({
        selectedName: "",
        selectionKind: "manual",
        statusKind: "imported",
      });
      return true;
    });
  }

  function startEditing(): void {
    if (session.startEditing(() => baselineJson))
      setDisplay({ statusKind: "", errorMessage: "" });
  }

  function cancelEditing(): Promise<boolean> {
    return session.cancelEditingAsync((snapshot) =>
      runAction("cancel", async (action) => {
        await runOwnedMutation(() => replaceJson(snapshot));
        if (!action.isCurrent()) return false;
        setDisplay({ dirty: false, statusKind: "", errorMessage: "" });
        return true;
      }),
    );
  }

  function copyToManual(): void {
    session.copyToManual(() => {
      requestVersion += 1;
      setDisplay({
        selectedName: "",
        selectionKind: "manual",
        dirty: true,
        statusKind: "",
        errorMessage: "",
      });
    });
  }

  function canEdit(): boolean {
    return session.canEdit();
  }

  function destroy(): void {
    destroyed = true;
    requestVersion += 1;
    unsubscribeSession();
    session.destroy();
  }

  return {
    destroy,
    importContent,
    startEditing,
    cancelEditing,
    copyToManual,
    canEdit,
    changeNameDialogValue: session.changeNameDialogValue,
    closeNameDialog: session.closeNameDialog,
    displayStateStore,
    initialize,
    markEdited,
    saveTemplate,
    selectTemplate,
    submitNameDialog,
  };
}
