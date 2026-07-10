import { replaySession } from "../api/client.js";
import { storageGet, storageSet } from "../lib/browser.js";
import { displayModePresentation, displayText, pillClass } from "../lib/ui.js";
import { currentLanguageState, tr } from "../lib/i18n.js";
import { derived, get as getStore, writable } from "svelte/store";
export {
  openEntryDrawer as openReplayEntryDrawer,
  replayJsonlTransferState,
  replayStatusTextState,
} from "./overlays.js";
import {
  eventEntriesPresentation as replayEntriesPresentation,
  openEntryDrawer,
  replayJsonlTransferState,
  replayStatusTextState,
} from "./overlays.js";
export { replayEntriesPresentation };

const REPLAY_STORAGE = Object.freeze({
  displayMode: "rauto_replay_view_mode",
  eventKind: "rauto_replay_event_kind",
  failedOnly: "rauto_replay_failed_only",
  searchQuery: "rauto_replay_search_query",
});

const REPLAY_STATE_DEFAULTS = Object.freeze({
  commandInput: "",
  displayMode: "list",
  eventKind: "all",
  failedOnly: false,
  jsonl: "",
  lastReplayResult: null,
  listLoading: false,
  mode: "",
  runLoading: false,
  searchQuery: "",
  statusText: "",
});

const createReplayState = () => ({ ...REPLAY_STATE_DEFAULTS });

function updateReplayState(replayStateStore, replayMutation) {
  const replayState = getStore(replayStateStore);
  replayMutation(replayState);
  replayStateStore.set(replayState);
}

async function runReplayMutation(replayStateStore, replayMutation) {
  const replayState = getStore(replayStateStore);
  const replayMutationPromise = replayMutation(replayState);
  replayStateStore.set(replayState);
  await replayMutationPromise;
  replayStateStore.set(replayState);
}

// prettier-ignore
const REPLAY_STAT_CARD_DEFS = Object.freeze([["statTotal", "total"], ["statCommandEvents", "commandEvents"], ["statFailedEvents", "failedEvents"], ["statKinds", "kinds"]]);
// prettier-ignore
const REPLAY_EVENT_KIND_VALUES = Object.freeze(["command_output", "connection_established", "connection_closed", "prompt_changed", "state_changed", "raw_chunk"]);

function replayOption(optionValue, optionLabel) {
  return { label: optionLabel, value: optionValue };
}

function replayInputField(value, placeholderKey, placeholderFallback = "") {
  const placeholder = tr(placeholderKey, placeholderFallback || placeholderKey);
  return {
    ariaLabelText: placeholder,
    placeholder,
    value: displayText(value),
  };
}

function replayEventKindOptions() {
  return [
    replayOption("all", tr("eventTypeAll", "All events")),
    ...REPLAY_EVENT_KIND_VALUES.map((replayEventKind) =>
      replayOption(replayEventKind, replayEventKind),
    ),
  ];
}

function replayRawText(replayPayload) {
  return replayPayload
    ? JSON.stringify(replayPayload, null, 2)
    : tr("replayListEmptyResult", "no replay result");
}

function replayEntriesFromResult(replayPayload) {
  return Array.isArray(replayPayload?.entries) ? replayPayload.entries : [];
}

function replayEntryIsFailedCommandEvent(replayEntry) {
  const replayEvent = (replayEntry && replayEntry.event) || {};
  return replayEvent.kind === "command_output" && replayEvent.success === false;
}

function replayEntryMatchesSearch(replayEntry, query) {
  const q = String(query || "")
    .trim()
    .toLowerCase();
  if (!q) return true;
  const replayEvent = (replayEntry && replayEntry.event) || {};
  const searchableReplayFields = [
    replayEvent.kind,
    replayEvent.command,
    replayEvent.mode,
    replayEvent.content,
    replayEvent.all,
    replayEvent.prompt_before,
    replayEvent.prompt_after,
    replayEvent.fsm_prompt_before,
    replayEvent.fsm_prompt_after,
    replayEvent.device_addr,
    replayEvent.reason,
  ];
  const haystack = searchableReplayFields
    .filter((replayFieldValue) => replayFieldValue != null)
    .map((replayFieldValue) => String(replayFieldValue).toLowerCase())
    .join("\n");
  return haystack.includes(q);
}

function replayFilteredEntries(replay = {}) {
  return replayEntriesFromResult(replay.lastReplayResult).filter(
    (replayEntry) => {
      const replayEvent = (replayEntry && replayEntry.event) || {};
      const kindOk =
        !replay.eventKind || replay.eventKind === "all"
          ? true
          : replayEvent.kind === replay.eventKind;
      const failedOk = replay.failedOnly
        ? replayEntryIsFailedCommandEvent(replayEntry)
        : true;
      const queryOk = replayEntryMatchesSearch(replayEntry, replay.searchQuery);
      return kindOk && failedOk && queryOk;
    },
  );
}

function replayResultPresentation(replayPayload) {
  const context = replayPayload?.context || null;
  const output = replayPayload?.output || null;
  return {
    hasReplayContext: Boolean(context),
    hasReplayOutput: Boolean(output),
    hasReplayResult: Boolean(replayPayload),
    outputContent: displayText(output?.content),
    outputPrompt: displayText(output?.prompt),
    outputSuccess: output?.success === true,
    replayContextDevice: displayText(context?.device_addr),
    replayContextFsmPrompt: displayText(context?.fsm_prompt),
    replayContextPrompt: displayText(context?.prompt),
  };
}

function replayStatCardsPresentation(stats = {}) {
  return REPLAY_STAT_CARD_DEFS.map(([labelKey, statKey]) => ({
    label: tr(labelKey),
    statValue: displayText(stats?.[statKey]),
  }));
}

function replayRunControlsPresentation(replay = {}, { modeTabs = [] } = {}) {
  const displayMode = replay.displayMode === "raw" ? "raw" : "list";
  return {
    commandField: replayInputField(
      replay.commandInput,
      "replayCommandPlaceholder",
    ),
    clearFiltersLabel: tr("clearFilters"),
    displayMode,
    displayModeLabel: tr("replayDisplayModeLabel"),
    eventKind: displayText(replay.eventKind) || "all",
    eventKindLabel: tr("eventTypeLabel"),
    eventKindOptionRows: replayEventKindOptions(),
    failedOnly: Boolean(replay.failedOnly),
    failedOnlyLabel: tr("failedOnly"),
    jsonlField: replayInputField(replay.jsonl, "replayJsonlPlaceholder"),
    listButtonLabel: tr("replayListBtn"),
    listLoading: Boolean(replay.listLoading),
    modeField: replayInputField(replay.mode, "replayModePlaceholder"),
    panelTitle: tr("replayTitle"),
    replayModeTabs: Array.isArray(modeTabs) ? modeTabs : [],
    runButtonLabel: tr("replayRunBtn"),
    runLoading: Boolean(replay.runLoading),
    searchField: replayInputField(replay.searchQuery, "searchPlaceholder"),
  };
}

function replayRunResultsPresentation({
  emptyReplayText = "",
  modeDisplay = {},
  replayEntriesDisplay = {},
  rawReplayText = "",
  replayResult = {},
  replayState = {},
  replayStatCards = [],
} = {}) {
  const statusText = displayText(replayState.statusText);
  const outputSuccess = replayResult.outputSuccess === true;
  return {
    contextTitle: tr("replayContextTitle"),
    emptyReplayText,
    hasReplayContext: replayResult.hasReplayContext,
    hasReplayEntries: replayEntriesDisplay.hasEntries,
    hasReplayOutput: replayResult.hasReplayOutput,
    hasReplayResult: replayResult.hasReplayResult,
    emptyResultText: tr("replayListEmptyResult"),
    outputTitle: tr("replayOutputTitle"),
    outputContent: replayResult.outputContent,
    outputPromptText: `${tr("detailLabelPrompt")}=${replayResult.outputPrompt}`,
    outputStatusClass: outputSuccess
      ? pillClass("bg-emerald-100 text-emerald-700")
      : pillClass("bg-rose-100 text-rose-700"),
    outputStatusLabel: outputSuccess ? tr("tableSuccess") : tr("tableFailure"),
    rawResultText: statusText || displayText(rawReplayText),
    replayContextRows: [
      {
        detailValue: replayResult.replayContextDevice,
        key: "device",
        labelText: tr("detailLabelDevice"),
      },
      {
        detailValue: replayResult.replayContextPrompt,
        key: "prompt",
        labelText: tr("detailLabelPrompt"),
      },
      {
        detailValue: replayResult.replayContextFsmPrompt,
        key: "fsm-prompt",
        labelText: tr("detailLabelFsmPrompt"),
      },
    ],
    replayEntryRows: replayEntriesDisplay.entryRows,
    replayTableHeaderCells: replayEntriesDisplay.tableHeaderCells,
    replayStatCards,
    showListMode: modeDisplay.showList,
    showRawMode: modeDisplay.showRaw,
    statusText,
  };
}

function replayPageDisplay(replay = {}, { modeTabs = [] } = {}) {
  const replayEntries = replayFilteredEntries(replay);
  const replayEntriesDisplay = replayEntriesPresentation(replayEntries);
  const replayStatCards = replayStatCardsPresentation(
    replayEntriesDisplay.stats,
  );
  const modeDisplay = displayModePresentation(replay.displayMode);
  const replayResult = replayResultPresentation(replay.lastReplayResult);
  const rawReplayText = replayRawText(replay.lastReplayResult);
  const emptyReplayText = replayEmptyText(replay);
  return {
    controlsDisplay: replayRunControlsPresentation(replay, { modeTabs }),
    replayEntries,
    resultsDisplay: replayRunResultsPresentation({
      emptyReplayText,
      modeDisplay,
      replayEntriesDisplay,
      rawReplayText,
      replayResult,
      replayState: replay,
      replayStatCards,
    }),
  };
}

function replayEntryOpenHandler(replayEntries = []) {
  return (entryIndex) => {
    const replayEntry = Array.isArray(replayEntries)
      ? replayEntries[entryIndex]
      : null;
    if (replayEntry) {
      openEntryDrawer(replayEntry);
    }
  };
}

function replayEmptyText({ eventKind = "all", failedOnly = false }) {
  if (failedOnly) {
    return tr("noFailedEntries", "no failed command events");
  }
  if (eventKind !== "all") {
    return tr("noMatchedEntries", "no matched events");
  }
  return tr("replayListEmptyResult", "no replay result");
}

function loadReplayPreferences() {
  return {
    displayMode:
      storageGet(REPLAY_STORAGE.displayMode, "list") === "raw" ? "raw" : "list",
    eventKind: storageGet(REPLAY_STORAGE.eventKind, "all"),
    failedOnly: storageGet(REPLAY_STORAGE.failedOnly) === "true",
    searchQuery: storageGet(REPLAY_STORAGE.searchQuery),
  };
}

function saveReplayPreferences(replay = {}) {
  storageSet(
    REPLAY_STORAGE.displayMode,
    replay.displayMode === "raw" ? "raw" : "list",
  );
  storageSet(REPLAY_STORAGE.failedOnly, String(!!replay.failedOnly));
  storageSet(REPLAY_STORAGE.eventKind, replay.eventKind || "all");
  storageSet(REPLAY_STORAGE.searchQuery, replay.searchQuery || "");
}

function applyReplayPreferences(replay = {}) {
  const preferences = loadReplayPreferences();
  replay.displayMode = preferences.displayMode;
  replay.eventKind = preferences.eventKind;
  replay.failedOnly = preferences.failedOnly;
  replay.searchQuery = preferences.searchQuery;
}

const setReplayStatus = (replay = {}, text = "") =>
  (replay.statusText = text || "");

function setReplayLoadingKeys(replay = {}, keys = []) {
  replay.listLoading = keys.includes("list");
  replay.runLoading = keys.includes("command");
}

function setReplayCommandInput(replay = {}, commandInput = "") {
  replay.commandInput = commandInput;
}

function setReplayDisplayMode(replay = {}, displayMode = "") {
  replay.displayMode = displayMode;
  saveReplayPreferences(replay);
}

function setReplayEventKind(replay = {}, replayEventKind = "") {
  replay.eventKind = replayEventKind;
  saveReplayPreferences(replay);
}

function setReplayFailedOnly(replay = {}, failedOnly = false) {
  replay.failedOnly = !!failedOnly;
  saveReplayPreferences(replay);
}

function setReplayJsonl(replay = {}, jsonl = "") {
  replay.jsonl = jsonl;
}

function setReplayMode(replay = {}, replayMode = "") {
  replay.mode = replayMode;
}

function setReplaySearchQuery(replay = {}, searchQuery = "") {
  replay.searchQuery = searchQuery;
  saveReplayPreferences(replay);
}

function resetReplayFilters(replay = {}) {
  replay.eventKind = "all";
  replay.failedOnly = false;
  replay.searchQuery = "";
  saveReplayPreferences(replay);
}

async function requestReplayList(replay = {}) {
  const payloadJsonl = String(replay.jsonl || "").trim();
  if (!payloadJsonl) {
    throw new Error(tr("replayNoJsonl", "replay JSONL is required"));
  }
  return replaySession({ jsonl: payloadJsonl, list: true });
}

async function requestReplayCommand(replay = {}) {
  const payloadJsonl = String(replay.jsonl || "").trim();
  const command = String(replay.commandInput || "").trim();
  const replayMode = String(replay.mode || "").trim();
  if (!payloadJsonl) {
    throw new Error(tr("replayNoJsonl", "replay JSONL is required"));
  }
  if (!command) {
    throw new Error(tr("replayNoCommand", "replay command is required"));
  }
  return replaySession({
    command,
    jsonl: payloadJsonl,
    mode: replayMode || null,
  });
}

async function executeReplayList(replay = {}) {
  setReplayStatus(replay, tr("running", "running"));
  try {
    replay.lastReplayResult = await requestReplayList(replay);
    setReplayStatus(replay);
  } catch (error) {
    setReplayStatus(replay, error.message);
  }
}

async function executeReplayCommand(replay = {}) {
  setReplayStatus(replay, tr("running", "running"));
  try {
    replay.lastReplayResult = await requestReplayCommand(replay);
    setReplayStatus(replay);
  } catch (error) {
    setReplayStatus(replay, error.message);
  }
}

function applyReplayJsonlTransferState(
  replay = {},
  transfer = {},
  appliedVersion = 0,
) {
  if (!transfer.version || transfer.version === appliedVersion) {
    return appliedVersion;
  }
  setReplayJsonl(replay, transfer.jsonl || "");
  replay.lastReplayResult = null;
  return transfer.version;
}

function applyReplayStatusTextState(replay = {}, nextStatus) {
  if (nextStatus !== undefined) {
    setReplayStatus(replay, nextStatus?.text || "");
  }
}

export function createReplayPageWorkspace({ modeTabs = [] } = {}) {
  const replayStateStore = writable(createReplayState());
  const replayDisplayStateStore = derived(
    [replayStateStore, currentLanguageState],
    ([$replayStateStore, _currentLanguageState]) =>
      replayPageDisplay($replayStateStore, { modeTabs }),
  );
  const replayResultsDisplayStateStore = derived(
    replayDisplayStateStore,
    ($replayDisplayStateStore) => $replayDisplayStateStore.resultsDisplay,
  );
  const replayEntryOpenIndexHandlerStateStore = derived(
    replayDisplayStateStore,
    ($replayDisplayStateStore) =>
      replayEntryOpenHandler($replayDisplayStateStore.replayEntries),
  );
  const replaySyncStateStore = derived(
    [replayJsonlTransferState, replayStatusTextState],
    ([$replayJsonlTransferState, $replayStatusTextState]) => ({
      transfer: $replayJsonlTransferState,
      status: $replayStatusTextState,
    }),
  );
  let appliedJsonlTransferVersion = 0;
  let replayPreferencesApplied = false;
  let loadingKeys = [];

  function setPageContext({ active = false } = {}) {
    if (!active) return;
    const { status, transfer } = getStore(replaySyncStateStore);
    const replayState = getStore(replayStateStore);
    const nextAppliedJsonlTransferVersion = applyReplayJsonlTransferState(
      replayState,
      transfer,
      appliedJsonlTransferVersion,
    );
    if (nextAppliedJsonlTransferVersion !== appliedJsonlTransferVersion) {
      appliedJsonlTransferVersion = nextAppliedJsonlTransferVersion;
      replayStateStore.set(replayState);
    }
    updateReplayState(replayStateStore, (nextReplayState) => {
      applyReplayStatusTextState(nextReplayState, status);
    });
    if (replayPreferencesApplied) return;
    replayPreferencesApplied = true;
    updateReplayState(replayStateStore, applyReplayPreferences);
  }

  function writeLoadingKeys(nextKeys = []) {
    loadingKeys = Array.isArray(nextKeys) ? nextKeys : [];
    updateReplayState(replayStateStore, (replayState) => {
      setReplayLoadingKeys(replayState, loadingKeys);
    });
  }

  function loadingKeyActive(loadingKey) {
    return loadingKeys.includes(loadingKey);
  }

  async function runWithLoadingKey(loadingKey, replayOperation) {
    if (loadingKeyActive(loadingKey)) return;
    writeLoadingKeys([...loadingKeys, loadingKey]);
    try {
      await runReplayMutation(replayStateStore, replayOperation);
    } finally {
      writeLoadingKeys(
        loadingKeys.filter(
          (activeLoadingKey) => activeLoadingKey !== loadingKey,
        ),
      );
    }
  }

  function setCommandInput(commandInput = "") {
    updateReplayState(replayStateStore, (replayState) => {
      setReplayCommandInput(replayState, commandInput);
    });
  }

  function setEventKind(replayEventKind = "") {
    updateReplayState(replayStateStore, (replayState) => {
      setReplayEventKind(replayState, replayEventKind);
    });
  }

  function setFailedOnly(failedOnly = false) {
    updateReplayState(replayStateStore, (replayState) => {
      setReplayFailedOnly(replayState, failedOnly);
    });
  }

  function setJsonl(jsonl = "") {
    updateReplayState(replayStateStore, (replayState) => {
      setReplayJsonl(replayState, jsonl);
    });
  }

  function setMode(replayMode = "") {
    updateReplayState(replayStateStore, (replayState) => {
      setReplayMode(replayState, replayMode);
    });
  }

  function setSearchQuery(searchQuery = "") {
    updateReplayState(replayStateStore, (replayState) => {
      setReplaySearchQuery(replayState, searchQuery);
    });
  }

  function selectReplayTab(displayMode = "") {
    updateReplayState(replayStateStore, (replayState) => {
      setReplayDisplayMode(replayState, displayMode);
    });
  }

  function replayList() {
    return runWithLoadingKey("list", executeReplayList);
  }

  function replayCommand() {
    return runWithLoadingKey("command", executeReplayCommand);
  }

  function resetFilters() {
    updateReplayState(replayStateStore, resetReplayFilters);
  }

  return {
    replayDisplayStateStore,
    replayCommand,
    replayEntryOpenIndexHandlerStateStore,
    replayList,
    replayResultsDisplayStateStore,
    replayStateStore,
    resetFilters,
    selectReplayTab,
    setCommandInput,
    setEventKind,
    setFailedOnly,
    setJsonl,
    setMode,
    setPageContext,
    setSearchQuery,
  };
}
