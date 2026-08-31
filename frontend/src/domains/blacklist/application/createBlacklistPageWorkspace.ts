import { derived, get, writable } from "svelte/store";
import { currentLanguageState, tr } from "../../../lib/i18n.js";
import { blacklistApi } from "../infrastructure/blacklistApi.js";
import { blacklistRuntime } from "../infrastructure/blacklistRuntime.js";
import {
  newBlacklistState,
  normalizeBlacklistPatterns,
  setBlacklistCommandInput,
  setBlacklistPatternInput,
  setBlacklistStatus,
} from "../model/blacklist.js";
import type {
  BlacklistApi,
  BlacklistPageWorkspace,
  BlacklistRuntime,
  BlacklistState,
  BlacklistWorkspaceOptions,
} from "../model/types.js";
import { blacklistPagePresentation } from "../presentation/blacklistPresentation.js";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createBlacklistPageWorkspace(
  options: BlacklistWorkspaceOptions = {},
): BlacklistPageWorkspace {
  const api = Object.assign({}, blacklistApi, options.api) as BlacklistApi;
  const runtime = Object.assign(
    {},
    blacklistRuntime,
    options.runtime,
  ) as BlacklistRuntime;
  const blacklistStateStore = writable<BlacklistState>(newBlacklistState());
  const blacklistDisplayStateStore = derived(
    [blacklistStateStore, currentLanguageState],
    ([$state]) => blacklistPagePresentation($state),
  );
  let didInitialLoad = false;

  function updateState(mutation: (state: BlacklistState) => void): void {
    const state = get(blacklistStateStore);
    mutation(state);
    blacklistStateStore.set(state);
  }

  async function runMutation(
    mutation: (state: BlacklistState) => unknown | Promise<unknown>,
  ): Promise<unknown> {
    const state = get(blacklistStateStore);
    const result = mutation(state);
    blacklistStateStore.set(state);
    try {
      return await result;
    } finally {
      blacklistStateStore.set(state);
    }
  }

  async function loadPatterns(state: BlacklistState): Promise<void> {
    try {
      state.listError = "";
      state.patterns = normalizeBlacklistPatterns(await api.listPatterns());
    } catch (error) {
      state.listError = errorMessage(error);
      state.patterns = [];
      setBlacklistStatus(state, state.listError, "error");
    }
  }

  async function addPattern(state: BlacklistState): Promise<void> {
    const pattern = state.patternInput.trim();
    if (!pattern) {
      setBlacklistStatus(
        state,
        tr("blacklistPatternRequired", "blacklist pattern is required"),
        "error",
      );
      return;
    }
    setBlacklistStatus(state, tr("running", "running"), "running");
    try {
      const payload = await api.addPattern(pattern);
      state.patternInput = "";
      setBlacklistStatus(
        state,
        `${payload.added ? tr("blacklistAdded", "blacklist pattern added") : tr("blacklistExists", "pattern already exists")}: ${payload.pattern || pattern}`,
        payload.added ? "success" : "info",
      );
      await loadPatterns(state);
    } catch (error) {
      setBlacklistStatus(state, errorMessage(error), "error");
    }
  }

  async function deletePattern(
    state: BlacklistState,
    pattern: string,
  ): Promise<void> {
    if (
      !pattern ||
      !runtime.confirmDelete(
        tr("blacklistDeleteConfirm", "Delete this blacklist pattern?"),
      )
    ) {
      return;
    }
    setBlacklistStatus(state, tr("running", "running"), "running");
    try {
      const payload = await api.deletePattern(pattern);
      setBlacklistStatus(
        state,
        `${tr("blacklistDeleted", "blacklist pattern deleted")}: ${payload.pattern || pattern}`,
        "success",
      );
      if (state.checkResult?.pattern === pattern) state.checkResult = null;
      await loadPatterns(state);
    } catch (error) {
      setBlacklistStatus(state, errorMessage(error), "error");
    }
  }

  async function checkCommand(state: BlacklistState): Promise<void> {
    const command = state.commandInput.trim();
    if (!command) {
      state.checkError = tr("commandRequired", "command is required");
      state.checkResult = null;
      return;
    }
    state.checkError = tr("running", "running");
    state.checkResult = null;
    try {
      state.checkError = "";
      state.checkResult = await api.checkCommand(command);
    } catch (error) {
      state.checkError = errorMessage(error);
      state.checkResult = null;
    }
  }

  function refreshPatterns(): Promise<unknown> {
    return runMutation(loadPatterns);
  }

  return {
    blacklistDisplayStateStore,
    blacklistStateStore,
    addPattern: () => runMutation(addPattern),
    checkCommand: () => runMutation(checkCommand),
    deletePattern: (pattern = "") =>
      runMutation((state) => deletePattern(state, pattern)),
    refreshPatterns,
    setPageContext({ active = false } = {}) {
      if (!active || didInitialLoad) return undefined;
      didInitialLoad = true;
      return refreshPatterns();
    },
    updateCommandInput(commandInput = "") {
      updateState((state) => setBlacklistCommandInput(state, commandInput));
    },
    updatePatternInput(patternInput = "") {
      updateState((state) => setBlacklistPatternInput(state, patternInput));
    },
  };
}
