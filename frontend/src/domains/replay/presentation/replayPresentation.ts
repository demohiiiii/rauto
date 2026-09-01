import { tr } from "../../../lib/i18n.js";
import {
  displayModePresentation,
  displayText,
  pillClass,
} from "../../../lib/ui.js";
import { eventEntriesPresentation } from "$domains/overlays/index.js";
import { replayFilteredEntries } from "../model/replay.js";
import type {
  ReplayControlsDisplay,
  ReplayEntry,
  ReplayInputField,
  ReplayModeTab,
  ReplayPageDisplay,
  ReplayResult,
  ReplayResultsDisplay,
  ReplayState,
  ReplayStatCard,
} from "../model/types.js";

interface ReplayEntryStats {
  commandEvents: number;
  failedEvents: number;
  kinds: number;
  total: number;
}

interface ReplayEntriesDisplay {
  entryRows: unknown[];
  hasEntries: boolean;
  stats: ReplayEntryStats;
  tableHeaderCells: unknown[];
}

type ReplayEntriesPresenter = (entries: ReplayEntry[]) => ReplayEntriesDisplay;

const presentReplayEntries = eventEntriesPresentation as ReplayEntriesPresenter;
const REPLAY_STAT_CARD_DEFS = [
  ["statTotal", "total"],
  ["statCommandEvents", "commandEvents"],
  ["statFailedEvents", "failedEvents"],
  ["statKinds", "kinds"],
] as const;
const REPLAY_EVENT_KIND_VALUES = [
  "command_output",
  "connection_established",
  "connection_closed",
  "prompt_changed",
  "state_changed",
  "raw_chunk",
] as const;

function replayInputField(
  value: unknown,
  placeholderKey: string,
  placeholderFallback = "",
): ReplayInputField {
  const placeholder = tr(placeholderKey, placeholderFallback || placeholderKey);
  return {
    ariaLabelText: placeholder,
    placeholder,
    value: displayText(value),
  };
}

function replayEventKindOptions(): { label: string; value: string }[] {
  return [
    { label: tr("eventTypeAll", "All events"), value: "all" },
    ...REPLAY_EVENT_KIND_VALUES.map((value) => ({ label: value, value })),
  ];
}

function replayRawText(payload: ReplayResult | null): string {
  return payload
    ? JSON.stringify(payload, null, 2)
    : tr("replayListEmptyResult", "no replay result");
}

function replayResultPresentation(payload: ReplayResult | null) {
  const context = payload?.context || null;
  const output = payload?.output || null;
  return {
    hasReplayContext: Boolean(context),
    hasReplayOutput: Boolean(output),
    hasReplayResult: Boolean(payload),
    outputContent: displayText(output?.content),
    outputPrompt: displayText(output?.prompt),
    outputSuccess: output?.success === true,
    replayContextDevice: displayText(context?.device_addr),
    replayContextFsmPrompt: displayText(context?.fsm_prompt),
    replayContextPrompt: displayText(context?.prompt),
  };
}

function replayStatCardsPresentation(
  stats: ReplayEntryStats,
): ReplayStatCard[] {
  return REPLAY_STAT_CARD_DEFS.map(([labelKey, statKey]) => ({
    label: tr(labelKey),
    statValue: displayText(stats[statKey]),
  }));
}

function replayEmptyText(state: ReplayState): string {
  if (state.failedOnly) {
    return tr("noFailedEntries", "no failed command events");
  }
  if (state.eventKind !== "all") {
    return tr("noMatchedEntries", "no matched events");
  }
  return tr("replayListEmptyResult", "no replay result");
}

function replayControlsPresentation(
  state: ReplayState,
  modeTabs: readonly ReplayModeTab[],
): ReplayControlsDisplay {
  return {
    clearFiltersLabel: tr("clearFilters"),
    commandField: {
      ...replayInputField(state.commandInput, "replayCommandPlaceholder"),
      labelText: tr("replayCommandLabel"),
    },
    displayMode: state.displayMode === "raw" ? "raw" : "list",
    displayModeLabel: tr("replayDisplayModeLabel"),
    eventKind: displayText(state.eventKind) || "all",
    eventKindLabel: tr("eventTypeLabel"),
    eventKindOptionRows: replayEventKindOptions(),
    failedOnly: state.failedOnly,
    failedOnlyLabel: tr("failedOnly"),
    jsonlField: {
      ...replayInputField(state.jsonl, "replayJsonlPlaceholder"),
      labelText: tr("replayJsonlLabel"),
    },
    listButtonLabel: tr("replayListBtn"),
    listLoading: state.listLoading,
    modeField: {
      ...replayInputField(state.mode, "replayModePlaceholder"),
      labelText: tr("replayModeLabel"),
    },
    panelTitle: tr("replayTitle"),
    replayModeTabs: [...modeTabs],
    runButtonLabel: tr("replayRunBtn"),
    runLoading: state.runLoading,
    searchField: replayInputField(state.searchQuery, "searchPlaceholder"),
  };
}

function replayResultsPresentation(
  state: ReplayState,
  entriesDisplay: ReplayEntriesDisplay,
  replayStatCards: ReplayStatCard[],
): ReplayResultsDisplay {
  const result = replayResultPresentation(state.lastReplayResult);
  const modeDisplay = displayModePresentation(state.displayMode);
  const statusText = displayText(state.statusText);
  return {
    contextTitle: tr("replayContextTitle"),
    emptyReplayText: replayEmptyText(state),
    emptyResultText: tr("replayListEmptyResult"),
    hasReplayContext: result.hasReplayContext,
    hasReplayEntries: entriesDisplay.hasEntries,
    hasReplayOutput: result.hasReplayOutput,
    hasReplayResult: result.hasReplayResult,
    outputContent: result.outputContent,
    outputPromptText: `${tr("detailLabelPrompt")}=${result.outputPrompt}`,
    outputStatusClass: result.outputSuccess
      ? pillClass("bg-primary/10 text-primary")
      : pillClass("bg-destructive/10 text-destructive"),
    outputStatusLabel: result.outputSuccess
      ? tr("tableSuccess")
      : tr("tableFailure"),
    outputTitle: tr("replayOutputTitle"),
    rawResultText: statusText || replayRawText(state.lastReplayResult),
    replayContextRows: [
      {
        detailValue: result.replayContextDevice,
        key: "device",
        labelText: tr("detailLabelDevice"),
      },
      {
        detailValue: result.replayContextPrompt,
        key: "prompt",
        labelText: tr("detailLabelPrompt"),
      },
      {
        detailValue: result.replayContextFsmPrompt,
        key: "fsm-prompt",
        labelText: tr("detailLabelFsmPrompt"),
      },
    ],
    replayEntryRows: entriesDisplay.entryRows,
    replayStatCards,
    replayTableHeaderCells: entriesDisplay.tableHeaderCells,
    showListMode: modeDisplay.showList,
    showRawMode: modeDisplay.showRaw,
    statusText,
  };
}

export function replayPagePresentation(
  state: ReplayState,
  modeTabs: readonly ReplayModeTab[] = [],
): ReplayPageDisplay {
  const replayEntries = replayFilteredEntries(state);
  const entriesDisplay = presentReplayEntries(replayEntries);
  const replayStatCards = replayStatCardsPresentation(entriesDisplay.stats);
  return {
    controlsDisplay: replayControlsPresentation(state, modeTabs),
    replayEntries,
    resultsDisplay: replayResultsPresentation(
      state,
      entriesDisplay,
      replayStatCards,
    ),
  };
}
