import { derived, get, writable } from "svelte/store";

import type {
  TemplateNameDialogState,
  TemplateSourceKind,
} from "../model/templateAuthoring.js";

export function createTemplateAuthoringSession<TSnapshot>({
  isBusy = () => false,
}: { isBusy?: () => boolean } = {}) {
  const sourceStore = writable<TemplateSourceKind>("manual");
  const editingStateStore = writable(false);
  const nameDialogStateStore = writable<TemplateNameDialogState>({
    open: false,
    value: "",
    error: "",
  });
  const stateStore = derived(
    [sourceStore, editingStateStore, nameDialogStateStore],
    ([source, editing, nameDialog]) => ({
      editing,
      readonly: source === "builtin" || (source === "custom" && !editing),
      builtin: source === "builtin",
      nameDialog,
    }),
  );
  let snapshot: TSnapshot | null = null;
  let revision = 0;
  let restoring = false;
  let destroyed = false;
  let submitting = false;

  function busy(): boolean {
    return destroyed || restoring || isBusy();
  }
  function canEdit(): boolean {
    return !busy() && !get(stateStore).readonly;
  }
  function canEditTemplate(): boolean {
    return !busy() && get(sourceStore) === "custom" && !get(editingStateStore);
  }

  function adoptSource(source: TemplateSourceKind): void {
    if (destroyed) return;
    revision += 1;
    snapshot = null;
    sourceStore.set(source);
    editingStateStore.set(false);
    nameDialogStateStore.set({ open: false, value: "", error: "" });
  }

  function startEditing(capture: () => TSnapshot): boolean {
    if (!canEditTemplate()) return false;
    snapshot = capture();
    editingStateStore.set(true);
    return true;
  }

  function finishEditing(): void {
    snapshot = null;
    editingStateStore.set(false);
  }

  function cancelEditing(restore: (value: TSnapshot) => void): boolean {
    if (busy() || !get(editingStateStore) || snapshot === null) return false;
    restore(snapshot);
    finishEditing();
    return true;
  }

  async function cancelEditingAsync(
    restore: (value: TSnapshot) => Promise<boolean>,
  ): Promise<boolean> {
    if (busy() || !get(editingStateStore) || snapshot === null) return false;
    const version = revision;
    restoring = true;
    try {
      if (!(await restore(snapshot)) || destroyed || version !== revision)
        return false;
      finishEditing();
      return true;
    } finally {
      restoring = false;
    }
  }

  function copyToManual(copy: () => void): boolean {
    if (busy() || !get(stateStore).readonly) return false;
    copy();
    adoptSource("manual");
    return true;
  }

  function openNameDialog(): void {
    if (!canEdit()) return;
    nameDialogStateStore.set({ open: true, value: "", error: "" });
  }

  function closeNameDialog(): void {
    if (busy() || submitting) return;
    nameDialogStateStore.update((state) => ({
      ...state,
      open: false,
      error: "",
    }));
  }

  function changeNameDialogValue(value = ""): void {
    if (busy() || submitting) return;
    nameDialogStateStore.update((state) => ({ ...state, value, error: "" }));
  }

  async function submitNameDialog(
    save: (name: string) => Promise<boolean>,
    failureMessage: () => string,
  ): Promise<boolean> {
    if (submitting || !canEdit() || !get(nameDialogStateStore).open)
      return false;
    const name = get(nameDialogStateStore).value.trim();
    if (!name) {
      nameDialogStateStore.update((state) => ({
        ...state,
        error: "name_required",
      }));
      return false;
    }
    const version = revision;
    submitting = true;
    let success: boolean;
    try {
      success = await save(name);
    } finally {
      submitting = false;
    }
    if (destroyed || version !== revision) return success;
    if (success) closeNameDialog();
    else
      nameDialogStateStore.update((state) => ({
        ...state,
        error: failureMessage(),
      }));
    return success;
  }

  function destroy(): void {
    destroyed = true;
    revision += 1;
    snapshot = null;
  }

  return {
    stateStore,
    editingStateStore,
    nameDialogStateStore,
    adoptSource,
    canEdit,
    canEditTemplate,
    startEditing,
    cancelEditing,
    cancelEditingAsync,
    copyToManual,
    openNameDialog,
    closeNameDialog,
    changeNameDialogValue,
    submitNameDialog,
    destroy,
  };
}
