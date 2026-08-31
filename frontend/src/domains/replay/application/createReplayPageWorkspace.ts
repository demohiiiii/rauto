import { derived, get, writable } from "svelte/store";
import { currentLanguageState, tr } from "../../../lib/i18n.js";
import { replayApi } from "../infrastructure/replayApi.js";
import { replayRuntime } from "../infrastructure/replayRuntime.js";
import {
  applyReplayJsonlTransfer,
  applyReplayPreferences,
  applyReplayStatus,
  newReplayState,
  resetReplayFilters,
  setReplayLoadingKeys,
} from "../model/replay.js";
import type {
  ReplayApi,
  ReplayPageWorkspace,
  ReplayRuntime,
  ReplayState,
  ReplaySyncState,
  ReplayWorkspaceOptions,
} from "../model/types.js";
import { replayPagePresentation } from "../presentation/replayPresentation.js";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createReplayPageWorkspace(
  options: ReplayWorkspaceOptions = {},
): ReplayPageWorkspace {
  const api = Object.assign({}, replayApi, options.api) as ReplayApi;
  const runtime = Object.assign(
    {},
    replayRuntime,
    options.runtime,
  ) as ReplayRuntime;
  const modeTabs = options.modeTabs || [];
  const replayStateStore = writable<ReplayState>(newReplayState());
  const replayDisplayStateStore = derived(
    [replayStateStore, currentLanguageState],
    ([$state]) => replayPagePresentation($state, modeTabs),
  );
  const replayResultsDisplayStateStore = derived(
    replayDisplayStateStore,
    ($display) => $display.resultsDisplay,
  );
  const replayEntryOpenIndexHandlerStateStore = derived(
    replayDisplayStateStore,
    ($display) => (entryIndex: number) => {
      const entry = $display.replayEntries[entryIndex];
      if (entry) runtime.openEntry(entry);
    },
  );
  const replaySyncStateStore = derived(
    [runtime.replayJsonlTransferState, runtime.replayStatusTextState],
    ([$transfer, $status]): ReplaySyncState => ({
      status: $status,
      transfer: $transfer,
    }),
  );
  let appliedJsonlTransferVersion = 0;
  let pageActive = false;
  let replayPreferencesApplied = false;
  let loadingKeys: string[] = [];

  function updateState(mutation: (state: ReplayState) => void): void {
    const state = get(replayStateStore);
    mutation(state);
    replayStateStore.set(state);
  }

  async function runMutation(
    mutation: (state: ReplayState) => unknown | Promise<unknown>,
  ): Promise<unknown> {
    const state = get(replayStateStore);
    const result = mutation(state);
    replayStateStore.set(state);
    const resolved = await result;
    replayStateStore.set(state);
    return resolved;
  }

  function applyReplaySyncState(syncState: ReplaySyncState): void {
    if (!pageActive) return;
    updateState((state) => {
      appliedJsonlTransferVersion = applyReplayJsonlTransfer(
        state,
        syncState.transfer,
        appliedJsonlTransferVersion,
      );
      applyReplayStatus(state, syncState.status);
    });
  }

  const unsubscribeReplaySyncState =
    replaySyncStateStore.subscribe(applyReplaySyncState);

  function writeLoadingKeys(nextKeys: string[]): void {
    loadingKeys = nextKeys;
    updateState((state) => setReplayLoadingKeys(state, loadingKeys));
  }

  async function runWithLoadingKey(
    loadingKey: string,
    operation: (state: ReplayState) => Promise<void>,
  ): Promise<unknown> {
    if (loadingKeys.includes(loadingKey)) return;
    writeLoadingKeys([...loadingKeys, loadingKey]);
    try {
      return await runMutation(operation);
    } finally {
      writeLoadingKeys(loadingKeys.filter((key) => key !== loadingKey));
    }
  }

  async function requestReplayList(state: ReplayState): Promise<void> {
    const jsonl = state.jsonl.trim();
    if (!jsonl) {
      throw new Error(tr("replayNoJsonl", "replay JSONL is required"));
    }
    state.lastReplayResult = await api.replaySession({ jsonl, list: true });
  }

  async function requestReplayCommand(state: ReplayState): Promise<void> {
    const jsonl = state.jsonl.trim();
    const command = state.commandInput.trim();
    const mode = state.mode.trim();
    if (!jsonl) {
      throw new Error(tr("replayNoJsonl", "replay JSONL is required"));
    }
    if (!command) {
      throw new Error(tr("replayNoCommand", "replay command is required"));
    }
    state.lastReplayResult = await api.replaySession({
      command,
      jsonl,
      mode: mode || null,
    });
  }

  async function executeReplay(
    state: ReplayState,
    request: (state: ReplayState) => Promise<void>,
  ): Promise<void> {
    state.statusText = tr("running", "running");
    try {
      await request(state);
      state.statusText = "";
    } catch (error) {
      state.statusText = errorMessage(error);
    }
  }

  function savePreferences(state: ReplayState): void {
    runtime.savePreferences(state);
  }

  return {
    destroy: unsubscribeReplaySyncState,
    replayCommand: () =>
      runWithLoadingKey("command", (state) =>
        executeReplay(state, requestReplayCommand),
      ),
    replayDisplayStateStore,
    replayEntryOpenIndexHandlerStateStore,
    replayList: () =>
      runWithLoadingKey("list", (state) =>
        executeReplay(state, requestReplayList),
      ),
    replayResultsDisplayStateStore,
    replayStateStore,
    resetFilters() {
      updateState((state) => {
        resetReplayFilters(state);
        savePreferences(state);
      });
    },
    selectReplayTab(displayMode = "") {
      updateState((state) => {
        state.displayMode = displayMode;
        savePreferences(state);
      });
    },
    setCommandInput(commandInput = "") {
      updateState((state) => {
        state.commandInput = commandInput;
      });
    },
    setEventKind(eventKind = "") {
      updateState((state) => {
        state.eventKind = eventKind;
        savePreferences(state);
      });
    },
    setFailedOnly(failedOnly = false) {
      updateState((state) => {
        state.failedOnly = failedOnly;
        savePreferences(state);
      });
    },
    setJsonl(jsonl = "") {
      updateState((state) => {
        state.jsonl = jsonl;
      });
    },
    setMode(mode = "") {
      updateState((state) => {
        state.mode = mode;
      });
    },
    setPageContext({ active = false } = {}) {
      pageActive = active;
      if (!pageActive) return;
      applyReplaySyncState(get(replaySyncStateStore));
      if (replayPreferencesApplied) return;
      replayPreferencesApplied = true;
      updateState((state) =>
        applyReplayPreferences(state, runtime.loadPreferences()),
      );
    },
    setSearchQuery(searchQuery = "") {
      updateState((state) => {
        state.searchQuery = searchQuery;
        savePreferences(state);
      });
    },
  };
}
