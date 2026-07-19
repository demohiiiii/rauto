import {
  addBlacklistPattern as apiAddBlacklistPattern,
  checkBlacklistCommand as apiCheckBlacklistCommand,
  deleteBlacklistPattern as apiDeleteBlacklistPattern,
  listBlacklistPatterns,
} from "../../api/client.js";
import {
  confirmUserChoice,
  displayText,
  statusPresentation,
} from "../../lib/ui.js";
import { currentLanguageState, tr } from "../../lib/i18n.js";
import { derived, get as getStore, writable } from "svelte/store";

function createBlacklistState() {
  return {
    checkError: "",
    checkResult: null,
    commandInput: "",
    listError: "",
    patternInput: "",
    patterns: [],
    status: { message: "-", tone: "info" },
  };
}

function normalizeBlacklistPatterns(patternsPayload) {
  return (Array.isArray(patternsPayload) ? patternsPayload : [])
    .map((blacklistPattern) =>
      String(blacklistPattern?.pattern ?? blacklistPattern ?? ""),
    )
    .filter(Boolean);
}

function blacklistPatternRow(blacklistPattern = "") {
  const patternText = displayText(blacklistPattern);
  return {
    deleteValue: patternText,
    patternClass: "break-all text-sm font-semibold text-slate-800",
    patternText,
    rowClass: "rounded-xl border border-slate-200 bg-white px-3 py-2",
  };
}

function blacklistInputField(value, placeholderKey) {
  const placeholder = tr(placeholderKey);
  return {
    ariaLabelText: placeholder,
    placeholder,
    value: displayText(value),
  };
}

function blacklistCheckPresentation(check, checkError = "", commandInput = "") {
  const hasCheckResult = Boolean(check);
  const errorMessage = String(checkError || "");
  return {
    checkBlocked: check?.blocked === true,
    checkButtonLabel: tr("blacklistCheckBtn"),
    checkError: errorMessage,
    errorStatus: { tone: "error" },
    checkedCommand: String(check?.command || "-"),
    checkedCommandLabel: tr("blacklistCheckedCommand", "Command"),
    commandField: blacklistInputField(
      commandInput,
      "blacklistCheckPlaceholder",
    ),
    hasCheckResult,
    matchedPattern: String(check?.pattern || "-"),
    matchedPatternLabel: tr("blacklistMatchedPattern", "Matched Pattern"),
    placeholder: tr("blacklistCheckPlaceholder"),
    resultAllowedLabel: tr("blacklistAllowed", "command is allowed"),
    resultBlockedLabel: tr("blacklistMatched", "command is blocked"),
    showAllowed: !errorMessage && hasCheckResult && check?.blocked !== true,
    showBlocked: !errorMessage && check?.blocked === true,
    showError: !!errorMessage,
    showPlaceholder: !errorMessage && !hasCheckResult,
    title: tr("blacklistCheckTitle"),
  };
}

function blacklistStatusPresentation(blacklist = {}) {
  const status = blacklist.status || {};
  return statusPresentation(status.message || "-", status.tone || "info", {
    suppressPassiveLoaded: false,
  });
}

function blacklistPageDisplay(blacklist = {}) {
  return {
    checkDisplay: blacklistCheckPresentation(
      blacklist.checkResult,
      blacklist.checkError,
      blacklist.commandInput,
    ),
    patternDisplay: blacklistPatternListPresentation(blacklist),
    statusDisplay: blacklistStatusPresentation(blacklist),
  };
}

function blacklistPatternListPresentation(blacklist = {}) {
  const errorMessage = String(blacklist.listError || "");
  const blacklistPatternRows = normalizeBlacklistPatterns(
    blacklist.patterns,
  ).map(blacklistPatternRow);
  return {
    addButtonLabel: tr("blacklistAddBtn"),
    addTitle: tr("blacklistAddTitle"),
    blacklistPatternRows,
    deleteButtonLabel: tr("blacklistDeleteBtn", "Delete"),
    emptyMessage: tr("blacklistListEmpty", "no blocked patterns"),
    errorMessage,
    errorStatus: { tone: "error" },
    fileHint: tr("blacklistFileHint"),
    hasError: Boolean(errorMessage),
    isEmpty: !errorMessage && blacklistPatternRows.length === 0,
    patternField: blacklistInputField(
      blacklist.patternInput,
      "blacklistPatternPlaceholder",
    ),
    patternHint: tr("blacklistPatternHint"),
    refreshButtonLabel: tr("blacklistRefreshBtn"),
    title: tr("blacklistListTitle"),
  };
}

function setBlacklistStatus(blacklist = {}, message, tone = "info") {
  blacklist.status = { message: message || "-", tone };
}

function updateBlacklistState(blacklistStateStore, blacklistMutation) {
  const blacklistState = getStore(blacklistStateStore);
  blacklistMutation(blacklistState);
  blacklistStateStore.set(blacklistState);
}

async function runBlacklistMutation(blacklistStateStore, blacklistMutation) {
  const blacklistState = getStore(blacklistStateStore);
  const blacklistMutationPromise = blacklistMutation(blacklistState);
  blacklistStateStore.set(blacklistState);
  await blacklistMutationPromise;
  blacklistStateStore.set(blacklistState);
}

function setBlacklistCommandInput(blacklist = {}, commandInput = "") {
  blacklist.commandInput = commandInput;
}
function setBlacklistPatternInput(blacklist = {}, patternInput = "") {
  blacklist.patternInput = patternInput;
}

async function loadBlacklistPatterns(blacklist = {}) {
  try {
    blacklist.listError = "";
    blacklist.patterns = normalizeBlacklistPatterns(
      await listBlacklistPatterns(),
    );
  } catch (error) {
    blacklist.listError = error.message;
    blacklist.patterns = [];
    setBlacklistStatus(blacklist, error.message, "error");
  }
}

async function addBlacklistPattern(blacklist = {}) {
  const pattern = String(blacklist.patternInput || "").trim();
  if (!pattern) {
    setBlacklistStatus(
      blacklist,
      tr("blacklistPatternRequired", "blacklist pattern is required"),
      "error",
    );
    return;
  }
  setBlacklistStatus(blacklist, tr("running", "running"), "running");
  try {
    const addPatternPayload = await apiAddBlacklistPattern(pattern);
    blacklist.patternInput = "";
    setBlacklistStatus(
      blacklist,
      `${addPatternPayload.added ? tr("blacklistAdded", "blacklist pattern added") : tr("blacklistExists", "pattern already exists")}: ${
        addPatternPayload.pattern || pattern
      }`,
      addPatternPayload.added ? "success" : "info",
    );
    await loadBlacklistPatterns(blacklist);
  } catch (error) {
    setBlacklistStatus(blacklist, error.message, "error");
  }
}

async function deleteBlacklistPattern(
  blacklist = {},
  pattern = "",
  { confirmDelete = confirmUserChoice } = {},
) {
  if (
    !pattern ||
    !confirmDelete(
      tr("blacklistDeleteConfirm", "Delete this blacklist pattern?"),
    )
  ) {
    return;
  }
  setBlacklistStatus(blacklist, tr("running", "running"), "running");
  try {
    const deletePatternPayload = await apiDeleteBlacklistPattern(pattern);
    setBlacklistStatus(
      blacklist,
      `${tr("blacklistDeleted", "blacklist pattern deleted")}: ${deletePatternPayload.pattern || pattern}`,
      "success",
    );
    if (blacklist.checkResult?.pattern === pattern) {
      blacklist.checkResult = null;
    }
    await loadBlacklistPatterns(blacklist);
  } catch (error) {
    setBlacklistStatus(blacklist, error.message, "error");
  }
}

async function checkBlacklistCommand(blacklist = {}) {
  const command = String(blacklist.commandInput || "").trim();
  if (!command) {
    blacklist.checkError = tr("commandRequired", "command is required");
    blacklist.checkResult = null;
    return;
  }
  blacklist.checkError = tr("running", "running");
  blacklist.checkResult = null;
  try {
    blacklist.checkError = "";
    blacklist.checkResult = await apiCheckBlacklistCommand(command);
  } catch (error) {
    blacklist.checkError = error.message;
    blacklist.checkResult = null;
  }
}

export function createBlacklistPageWorkspace() {
  const blacklistStateStore = writable(createBlacklistState());
  const blacklistDisplayStateStore = derived(
    [blacklistStateStore, currentLanguageState],
    ([$blacklistStateStore, _currentLanguageState]) =>
      blacklistPageDisplay($blacklistStateStore),
  );
  let didInitialLoad = false;

  function addPattern() {
    return runBlacklistMutation(blacklistStateStore, addBlacklistPattern);
  }

  function checkCommand() {
    return runBlacklistMutation(blacklistStateStore, checkBlacklistCommand);
  }

  function deletePattern(pattern = "") {
    return runBlacklistMutation(blacklistStateStore, (blacklistState) =>
      deleteBlacklistPattern(blacklistState, pattern),
    );
  }

  function refreshPatterns() {
    return runBlacklistMutation(blacklistStateStore, loadBlacklistPatterns);
  }

  function updateCommandInput(commandInput = "") {
    updateBlacklistState(blacklistStateStore, (blacklistState) =>
      setBlacklistCommandInput(blacklistState, commandInput),
    );
  }

  function updatePatternInput(patternInput = "") {
    updateBlacklistState(blacklistStateStore, (blacklistState) =>
      setBlacklistPatternInput(blacklistState, patternInput),
    );
  }

  return {
    blacklistDisplayStateStore,
    blacklistStateStore,
    addPattern,
    checkCommand,
    deletePattern,
    refreshPatterns,
    setPageContext({ active = false } = {}) {
      if (!active || didInitialLoad) return undefined;
      didInitialLoad = true;
      return this.refreshPatterns();
    },
    updateCommandInput,
    updatePatternInput,
  };
}
