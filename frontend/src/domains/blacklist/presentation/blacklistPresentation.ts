import { tr } from "../../../lib/i18n.js";
import { displayText, statusPresentation } from "../../../lib/ui.js";
import { normalizeBlacklistPatterns } from "../model/blacklist.js";
import type {
  BlacklistCheckDisplay,
  BlacklistCheckResult,
  BlacklistInputField,
  BlacklistPageDisplay,
  BlacklistPatternListDisplay,
  BlacklistPatternRow,
  BlacklistState,
  BlacklistStatusDisplay,
} from "../model/types.js";

function blacklistPatternRow(pattern = ""): BlacklistPatternRow {
  const patternText = displayText(pattern);
  return {
    deleteValue: patternText,
    patternClass: "break-all text-sm font-semibold text-slate-800",
    patternText,
    rowClass: "rounded-xl border border-slate-200 bg-white px-3 py-2",
  };
}

function blacklistInputField(
  value: string,
  placeholderKey: string,
): BlacklistInputField {
  const placeholder = tr(placeholderKey);
  return {
    ariaLabelText: placeholder,
    placeholder,
    value: displayText(value),
  };
}

export function blacklistCheckPresentation(
  check: BlacklistCheckResult | null,
  checkError = "",
  commandInput = "",
): BlacklistCheckDisplay {
  const hasCheckResult = Boolean(check);
  const errorMessage = String(checkError || "");
  return {
    checkBlocked: check?.blocked === true,
    checkButtonLabel: tr("blacklistCheckBtn"),
    checkError: errorMessage,
    checkedCommand: String(check?.command || "-"),
    checkedCommandLabel: tr("blacklistCheckedCommand", "Command"),
    commandField: blacklistInputField(
      commandInput,
      "blacklistCheckPlaceholder",
    ),
    errorStatus: { tone: "error" },
    hasCheckResult,
    matchedPattern: String(check?.pattern || "-"),
    matchedPatternLabel: tr("blacklistMatchedPattern", "Matched Pattern"),
    placeholder: tr("blacklistCheckPlaceholder"),
    resultAllowedLabel: tr("blacklistAllowed", "command is allowed"),
    resultBlockedLabel: tr("blacklistMatched", "command is blocked"),
    showAllowed: !errorMessage && hasCheckResult && check?.blocked !== true,
    showBlocked: !errorMessage && check?.blocked === true,
    showError: Boolean(errorMessage),
    showPlaceholder: !errorMessage && !hasCheckResult,
    title: tr("blacklistCheckTitle"),
  };
}

export function blacklistPatternListPresentation(
  state: BlacklistState,
): BlacklistPatternListDisplay {
  const errorMessage = String(state.listError || "");
  const blacklistPatternRows = normalizeBlacklistPatterns(state.patterns).map(
    blacklistPatternRow,
  );
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
      state.patternInput,
      "blacklistPatternPlaceholder",
    ),
    patternHint: tr("blacklistPatternHint"),
    refreshButtonLabel: tr("blacklistRefreshBtn"),
    title: tr("blacklistListTitle"),
  };
}

export function blacklistStatusPresentation(
  state: BlacklistState,
): BlacklistStatusDisplay {
  return statusPresentation(state.status.message, state.status.tone, {
    suppressPassiveLoaded: false,
  }) as BlacklistStatusDisplay;
}

export function blacklistPagePresentation(
  state: BlacklistState,
): BlacklistPageDisplay {
  return {
    checkDisplay: blacklistCheckPresentation(
      state.checkResult,
      state.checkError,
      state.commandInput,
    ),
    patternDisplay: blacklistPatternListPresentation(state),
    statusDisplay: blacklistStatusPresentation(state),
  };
}
