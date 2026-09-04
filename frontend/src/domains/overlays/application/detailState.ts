import { derived, get, writable } from "svelte/store";
import {
  callbackHandler,
  callIfFunction,
  eventIsSelfTarget,
  eventKeyIs,
} from "../../../lib/events.js";
import {
  classNames,
  displayMode,
  displayString,
  displayText,
  formatTimestamp,
} from "../../../lib/ui.js";
import { currentLanguageState, tr } from "../../../lib/i18n.js";
import {
  overlayDetailRendererDefinitions,
  overlayDetailRuntime,
} from "../infrastructure/overlayDetailRuntime.js";
import type {
  OverlayData,
  OverlayDetailConfig,
  OverlayDetailModalState,
  OverlayDetailRendererDefinitions,
  OverlayEntryDrawerState,
  OverlayEventEntry,
  OverlayOrchestrationDetailDisplay,
} from "../model/types.js";

const detailModalDefaultState: OverlayDetailModalState = {
  content: "",
  detailPayload: null,
  kind: "text",
  open: false,
  title: "",
};

let detailModalResetTimer = 0;
let orchestrationDetailDisplayLoader: Promise<OverlayOrchestrationDetailDisplay> | null =
  null;

function overlayData(value: unknown): OverlayData {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as OverlayData)
    : {};
}

export const detailModal = writable<OverlayDetailModalState>({
  ...detailModalDefaultState,
});
export const entryDrawer = writable<OverlayEntryDrawerState>({
  eventEntry: null,
  open: false,
});

export function openDetailModal(
  content: unknown,
  detailConfig: OverlayDetailConfig = {},
): void {
  if (detailModalResetTimer) {
    overlayDetailRuntime.clearTimeout(detailModalResetTimer);
    detailModalResetTimer = 0;
  }
  detailModal.set({
    content: content ?? "",
    detailPayload: detailConfig.detailPayload ?? null,
    kind: detailConfig.kind || "text",
    open: true,
    title: detailConfig.title || tr("detailModalTitle"),
  });
}

export function closeDetailModal(): void {
  detailModal.update((detailState) => ({
    ...detailState,
    open: false,
  }));
  if (detailModalResetTimer) {
    overlayDetailRuntime.clearTimeout(detailModalResetTimer);
  }
  detailModalResetTimer = overlayDetailRuntime.setTimeout(() => {
    if (!get(detailModal).open) {
      detailModal.set({ ...detailModalDefaultState });
    }
    detailModalResetTimer = 0;
  }, 240);
}

export function openEntryDrawer(eventEntry: OverlayEventEntry | null): void {
  entryDrawer.set({
    eventEntry: eventEntry || null,
    open: Boolean(eventEntry),
  });
}

export function closeEntryDrawer(): void {
  entryDrawer.set({ eventEntry: null, open: false });
}

export function historyEntryOpenHandler(
  eventEntries: readonly OverlayEventEntry[] = [],
  onOpenEntryDrawer: (
    eventEntry: OverlayEventEntry,
  ) => unknown = openEntryDrawer,
) {
  return (entryIndex: unknown): void => {
    const historyEventEntry = Array.isArray(eventEntries)
      ? eventEntries[Number(entryIndex)] || null
      : null;
    if (historyEventEntry) {
      onOpenEntryDrawer(historyEventEntry);
    }
  };
}

function boolBadgeClass(boolValue: unknown): string {
  return boolValue === true
    ? "inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700"
    : boolValue === false
      ? "inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700"
      : "text-slate-500";
}

function boolBadgeText(boolValue: unknown): string {
  return boolValue === true ? "true" : boolValue === false ? "false" : "-";
}

function eventFlowCellDisplay(
  flowCell: {
    after?: string;
    before?: string;
    tone?: "fsm" | "prompt";
  } = {},
) {
  const { after = "", before = "", tone = "prompt" } = flowCell;
  const styles =
    tone === "fsm"
      ? {
          after: "border-emerald-200 bg-emerald-50 text-emerald-800",
          before: "border-cyan-200 bg-cyan-50 text-cyan-800",
          marker: "bg-emerald-400",
        }
      : {
          after: "border-amber-200 bg-amber-50 text-amber-800",
          before: "border-indigo-200 bg-indigo-50 text-indigo-800",
          marker: "bg-amber-400",
        };
  return {
    after,
    afterLabel: tr("flowAfter"),
    afterCardClass: classNames("rounded-md border px-2 py-1", styles.after),
    before,
    beforeLabel: tr("flowBefore"),
    beforeCardClass: classNames("rounded-md border px-2 py-1", styles.before),
    markerDotClass: classNames("h-2 w-2 rounded-full", styles.marker),
    markerLineClass: classNames("h-[2px] flex-1 rounded", styles.marker),
  };
}

function entryDrawerContentLabels() {
  return Object.fromEntries(
    "basicSectionTitle|detailSectionBasic|Basic,kindLabel|detailLabelKind|Kind,successLabel|detailLabelSuccess|Success,commandLabel|detailLabelCommand|Command,modeLabel|detailLabelMode|Mode,promptLabel|detailLabelPrompt|Prompt,fsmPromptLabel|detailLabelFsmPrompt|FSM Prompt,timestampLabel|detailLabelTimestamp|Timestamp,deviceLabel|detailLabelDevice|Device,recordLevelLabel|detailLabelRecordLevel|Record Level,flowSectionTitle|detailSectionFlow|Flow,promptFlowLabel|tablePromptFlow|Prompt Flow,fsmFlowLabel|tableFsmFlow|FSM Flow,outputSectionTitle|detailSectionOutput|Output,errorLabel|detailLabelError|Error,rawSectionTitle|detailSectionRaw|Raw"
      .split(",")
      .map((definition) => {
        const [field, key, fallback] = definition.split("|");
        return [field, tr(key, fallback)];
      }),
  );
}

function entryDrawerPresentation(
  eventEntry: OverlayEventEntry | null = null,
  open = false,
) {
  const eventRecord = eventEntry?.event || {};
  const isCommandOutput = eventRecord.kind === "command_output";
  const contentText = eventRecord.content || eventRecord.all || "";
  return {
    closeLabel: tr("entryDrawerClose", "Close"),
    command: displayString(eventRecord.command, "-"),
    contentLabels: entryDrawerContentLabels(),
    device: displayString(
      eventRecord.device_addr || eventEntry?.device_addr,
      "-",
    ),
    error: displayString(eventRecord.error, "-"),
    fsmPrompt: displayString(eventRecord.fsm_prompt, "-"),
    fsmPromptFlow: eventFlowCellDisplay({
      after: displayText(eventRecord.fsm_prompt_after),
      before: displayText(eventRecord.fsm_prompt_before),
      tone: "fsm",
    }),
    hasRawSection: !isCommandOutput && Boolean(contentText),
    isCommandOutput,
    kind: displayString(eventRecord.kind, "-"),
    mode: isCommandOutput
      ? displayMode(eventRecord.mode)
      : displayString(eventRecord.mode, "-"),
    open: Boolean(open),
    outputText: displayText(contentText || "-"),
    prompt: displayString(eventRecord.prompt, "-"),
    promptFlow: eventFlowCellDisplay({
      after: displayText(eventRecord.prompt_after),
      before: displayText(eventRecord.prompt_before),
      tone: "prompt",
    }),
    rawText: displayText(contentText),
    recordLevel: displayString(
      eventEntry?.record_level || eventRecord.record_level,
      "-",
    ),
    successBadgeClass: boolBadgeClass(eventRecord.success),
    successText: boolBadgeText(eventRecord.success),
    timestamp: formatHistoryTime(
      eventEntry?.ts_ms || eventEntry?.timestamp_ms || eventRecord.ts_ms || 0,
    ),
    titleText: tr("entryDrawerTitle", "Event Details"),
  };
}

function entryDrawerDisplay(
  drawerState: Partial<OverlayEntryDrawerState> = {},
) {
  return entryDrawerPresentation(drawerState.eventEntry, drawerState.open);
}

export function createEntryDrawerWorkspace({
  onClose = closeEntryDrawer,
}: { onClose?: () => unknown } = {}) {
  const entryDisplayStateStore = derived(
    [entryDrawer, currentLanguageState],
    ([$entryDrawer, _currentLanguageState]) => entryDrawerDisplay($entryDrawer),
  );
  const resolvedOnClose =
    typeof onClose === "function" ? onClose : closeEntryDrawer;

  function currentEntryDrawerActionHandlers() {
    return entryDrawerActionHandlers({
      onClose: resolvedOnClose,
    });
  }

  function closeDrawerHandler() {
    return currentEntryDrawerActionHandlers().closeDrawerHandler();
  }

  function closeOnBackdropHandler() {
    return currentEntryDrawerActionHandlers().closeOnBackdropHandler();
  }

  function closeOnEscapeHandler() {
    return currentEntryDrawerActionHandlers().closeOnEscapeHandler();
  }

  return {
    closeDrawerHandler,
    closeOnBackdropHandler,
    closeOnEscapeHandler,
    entryDisplayStateStore,
  };
}

function entryDrawerActionHandlers({
  onClose = closeEntryDrawer,
}: { onClose?: () => unknown } = {}) {
  return {
    closeDrawerHandler() {
      return callbackHandler(onClose);
    },
    closeOnBackdropHandler() {
      return (event: unknown) => {
        if (eventIsSelfTarget(event)) {
          return callIfFunction(onClose);
        }
        return undefined;
      };
    },
    closeOnEscapeHandler() {
      return (event: unknown) => {
        if (eventKeyIs(event, "Escape")) {
          return callIfFunction(onClose);
        }
        return undefined;
      };
    },
  };
}

function isFailedCommandEvent(eventEntry: OverlayEventEntry): boolean {
  const eventRecord = (eventEntry && eventEntry.event) || {};
  return eventRecord.kind === "command_output" && eventRecord.success === false;
}

function matchesSearch(eventEntry: OverlayEventEntry, query: unknown): boolean {
  const normalizedQuery = String(query || "")
    .trim()
    .toLowerCase();
  if (!normalizedQuery) return true;
  const eventRecord = (eventEntry && eventEntry.event) || {};
  const searchableEventFields = [
    eventRecord.kind,
    eventRecord.command,
    eventRecord.mode,
    eventRecord.content,
    eventRecord.all,
    eventRecord.prompt_before,
    eventRecord.prompt_after,
    eventRecord.fsm_prompt_before,
    eventRecord.fsm_prompt_after,
    eventRecord.device_addr,
    eventRecord.reason,
  ];
  const haystack = searchableEventFields
    .filter((eventFieldValue) => eventFieldValue != null)
    .map((eventFieldValue) => String(eventFieldValue).toLowerCase())
    .join("\n");
  return haystack.includes(normalizedQuery);
}

function filterEntries(
  eventEntries: readonly OverlayEventEntry[],
  kindFilter: unknown,
  failedOnly: boolean,
  query: unknown,
): OverlayEventEntry[] {
  return eventEntries.filter((eventEntry) => {
    const eventRecord = (eventEntry && eventEntry.event) || {};
    const kindOk =
      !kindFilter || kindFilter === "all"
        ? true
        : eventRecord.kind === kindFilter;
    const failedOk = failedOnly ? isFailedCommandEvent(eventEntry) : true;
    const queryOk = matchesSearch(eventEntry, query);
    return kindOk && failedOk && queryOk;
  });
}

function eventEntryRows(eventEntries: readonly OverlayEventEntry[] = []) {
  return (Array.isArray(eventEntries) ? eventEntries : []).map(
    (eventEntry, index) => {
      const eventRecord = (eventEntry && eventEntry.event) || {};
      const isCommandOutput = eventRecord.kind === "command_output";
      const failed = isCommandOutput && eventRecord.success === false;
      const success = eventRecord.success === true;
      return {
        commandText: isCommandOutput
          ? displayString(eventRecord.command, "-")
          : "-",
        entryIndex: index,
        fsmPromptFlow: eventFlowCellDisplay({
          after: displayText(eventRecord.fsm_prompt_after),
          before: displayText(eventRecord.fsm_prompt_before),
          tone: "fsm",
        }),
        indexText: String(index + 1),
        kindText: displayString(eventRecord.kind),
        modeText: isCommandOutput ? displayMode(eventRecord.mode) || "-" : "-",
        promptAfter: displayText(eventRecord.prompt_after),
        promptBefore: displayText(eventRecord.prompt_before),
        promptFlow: eventFlowCellDisplay({
          after: displayText(eventRecord.prompt_after),
          before: displayText(eventRecord.prompt_before),
          tone: "prompt",
        }),
        rowClass: failed
          ? "align-top border-l-4 border-rose-400 bg-rose-50/60 hover:bg-rose-50"
          : "align-top hover:bg-slate-50/80",
        showSuccessBadge: isCommandOutput,
        showSuccessEmpty: !isCommandOutput,
        success,
        successBadgeClass: success
          ? "inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700"
          : "inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700",
        successLabelText: success ? tr("tableSuccess") : tr("tableFailure"),
        detailButtonLabel: tr("actionViewDetail"),
      };
    },
  );
}

function eventEntryTableHeaderCells() {
  return "tableIndex|tableEvent|tableCommand|tableMode|tableSuccess|tablePromptFlow|tableFsmFlow|tableAction"
    .split("|")
    .map((labelKey) => ({ labelText: tr(labelKey) }));
}

interface EventStats {
  commandEvents: number;
  failedEvents: number;
  kinds: number;
  total: number;
}

function buildEventStats(
  eventEntries: readonly OverlayEventEntry[],
): EventStats {
  const eventKinds = new Set<unknown>();
  let commandEvents = 0;
  let failedEvents = 0;
  for (const eventEntry of eventEntries) {
    const eventRecord = (eventEntry && eventEntry.event) || {};
    const eventKind = eventRecord.kind || "unknown";
    eventKinds.add(eventKind);
    if (eventKind === "command_output") {
      commandEvents += 1;
      if (eventRecord.success === false) {
        failedEvents += 1;
      }
    }
  }
  return {
    total: eventEntries.length,
    commandEvents,
    failedEvents,
    kinds: eventKinds.size,
  };
}

function eventStatCards(stats: Partial<EventStats> = {}) {
  const statRows: Array<[string, unknown]> = [
    ["statTotal", stats.total],
    ["statCommandEvents", stats.commandEvents],
    ["statFailedEvents", stats.failedEvents],
    ["statKinds", stats.kinds],
  ];
  return statRows.map(([labelKey, statValue]) => ({
    labelText: tr(labelKey),
    statValue: displayText(statValue),
  }));
}

function normalizeEventEntries(eventEntries: unknown): OverlayEventEntry[] {
  return Array.isArray(eventEntries)
    ? eventEntries.filter(
        (entry): entry is OverlayEventEntry =>
          !!entry && typeof entry === "object" && !Array.isArray(entry),
      )
    : [];
}

export function eventEntriesPresentation(eventEntries: unknown = []) {
  const normalizedEventEntries = normalizeEventEntries(eventEntries);
  const stats = buildEventStats(normalizedEventEntries);
  return {
    entryCount: normalizedEventEntries.length,
    entryRows: eventEntryRows(normalizedEventEntries),
    hasEntries: normalizedEventEntries.length > 0,
    statCards: eventStatCards(stats),
    stats,
    tableHeaderCells: eventEntryTableHeaderCells(),
  };
}

export function formatHistoryTime(tsMs: unknown): string {
  return formatTimestamp(tsMs);
}

function historyDetailPresentation(
  meta: OverlayData = {},
  eventEntries: unknown = [],
) {
  const normalizedEventEntries = normalizeEventEntries(eventEntries);
  const stats = buildEventStats(normalizedEventEntries);
  return {
    eventEntries: normalizedEventEntries,
    entryRows: eventEntryRows(normalizedEventEntries),
    hasEntries: normalizedEventEntries.length > 0,
    metaFields: [
      {
        detailValue: formatHistoryTime(meta.ts_ms),
        label: tr("historyColTime"),
      },
      {
        detailValue: displayText(meta.operation),
        label: tr("historyColOperation"),
      },
      {
        detailValue: displayText(meta.command_label),
        label: tr("historyColCommand"),
        mono: true,
      },
      {
        detailValue: displayMode(meta.mode),
        label: tr("historyColMode"),
      },
      {
        detailValue: displayText(meta.device_profile),
        label: tr("historyColProfile"),
      },
      {
        detailValue: `${displayText(meta.host)}:${displayText(meta.port)}`,
        label: tr("detailLabelDevice"),
        mono: true,
      },
      {
        detailValue: displayText(meta.record_level),
        label: tr("recordLevelLabel"),
      },
    ],
    statCards: eventStatCards(stats),
    tableHeaderCells: eventEntryTableHeaderCells(),
  };
}

function connectionImportSummaryRows(report: OverlayData = {}) {
  return [
    {
      label: tr("savedConnImportSummaryTotal"),
      summaryValue: displayText(report?.total_rows),
    },
    {
      label: tr("savedConnImportSummaryImported"),
      summaryValue: displayText(report?.imported),
    },
    {
      label: tr("savedConnImportSummaryCreated"),
      summaryValue: displayText(report?.created),
    },
    {
      label: tr("savedConnImportSummaryUpdated"),
      summaryValue: displayText(report?.updated),
    },
    {
      label: tr("savedConnImportSummaryFailed"),
      summaryValue: displayText(report?.failed),
    },
  ];
}

function connectionImportDetailPresentation(report: OverlayData = {}) {
  const failures = Array.isArray(report.failures) ? report.failures : [];
  return {
    failureRows: failures.map((failure) => {
      const importFailure: OverlayData =
        failure && typeof failure === "object" && !Array.isArray(failure)
          ? (failure as OverlayData)
          : {};
      return {
        hasName: !!importFailure.name,
        message: displayText(importFailure.message),
        name: displayText(importFailure.name),
        sourceRowText: displayText(importFailure.row),
      };
    }),
    hasFailures: failures.length > 0,
    summaryRows: connectionImportSummaryRows(report),
  };
}

interface DetailModalContentDisplayInput extends OverlayData {
  loadingMessage: string;
  showConnectionImportDetail: boolean;
  showHistoryDetail: boolean;
  showOrchestrationDetail: boolean;
  showTextDetail: boolean;
  subtitle: string;
}

function detailModalContentDisplayPresentation(
  contentDisplay: DetailModalContentDisplayInput,
  rendererId = "",
  loadErrors: Record<string, string> = {},
  renderers: Record<string, unknown> = {},
) {
  return {
    detailModalContentDisplay: {
      ...contentDisplay,
      detailRendererLoadError: loadErrors[rendererId] || "",
    },
    OrchestrationDetailComponent: renderers[rendererId],
  };
}

export function detailModalPresentation(
  detail: Partial<OverlayDetailModalState> = {},
) {
  const kind = detail?.kind || "text";
  const detailPayload = detail?.detailPayload || {};
  const showHistoryDetail = kind === "historyDetail";
  const showOrchestrationDetail = kind === "orchestrationDetail";
  const showConnectionImportDetail = kind === "connectionImportDetail";
  const historyEntries =
    showHistoryDetail && Array.isArray(detailPayload?.entries)
      ? detailPayload.entries
      : [];
  const historyMeta = showHistoryDetail ? overlayData(detailPayload.meta) : {};
  const orchestrationDetail = showOrchestrationDetail ? detailPayload : {};
  const orchestrationDetailRendererId =
    orchestrationDetail?.kind === "stage"
      ? "orchestrationStageDetail"
      : "orchestrationTargetDetail";
  const connectionImportDetail = connectionImportDetailPresentation(
    showConnectionImportDetail ? detailPayload : {},
  );
  const historyDetail = historyDetailPresentation(historyMeta, historyEntries);
  const hasStructuredDetail =
    showHistoryDetail || showOrchestrationDetail || showConnectionImportDetail;

  return {
    closeLabel: tr("detailModalClose", "Close"),
    connectionImportDetailDisplay: {
      emptyFailureMessage: "-",
      failureRowLabel: tr("savedConnImportFailureRow"),
      failureRows: connectionImportDetail.failureRows,
      failuresTitle: tr("savedConnImportFailuresTitle"),
      hasFailures: connectionImportDetail.hasFailures,
      summaryRows: connectionImportDetail.summaryRows,
    },
    detailModalContentDisplay: {
      loadingMessage: tr("loading", "Loading..."),
      subtitle: showHistoryDetail
        ? tr("historyDetailSubtitle", "查看本次连接的执行元数据与事件")
        : "",
      showConnectionImportDetail,
      showHistoryDetail,
      showOrchestrationDetail,
      showTextDetail: !hasStructuredDetail,
    },
    historyDetailDisplay: {
      emptyMessage: tr("historyDetailEmpty", "no detail"),
      entryCountText: `${historyDetail.entryRows.length} ${tr("historyListCountSuffix", "records")}`,
      entryRows: historyDetail.entryRows,
      eventsTitle: tr("detailEventsTitle", "事件列表"),
      eventEntries: historyDetail.eventEntries,
      hasEntries: historyDetail.hasEntries,
      metaFields: historyDetail.metaFields,
      metaTitle: tr("historyMetaTitle", "Meta"),
      statCards: historyDetail.statCards,
      tableHeaderCells: historyDetail.tableHeaderCells,
    },
    open: Boolean(detail?.open),
    orchestrationDetail,
    orchestrationDetailRendererId,
    shouldLoadOrchestrationDetail: !!detail?.open && showOrchestrationDetail,
    textDetailDisplay: { detailText: displayText(detail?.content) },
    title: detail?.title || tr("detailModalTitle"),
  };
}

function detailModalRendererErrorMessage() {
  return tr("requestFailed");
}

function loadOrchestrationDetailDisplay() {
  if (!orchestrationDetailDisplayLoader) {
    orchestrationDetailDisplayLoader =
      overlayDetailRuntime.loadOrchestrationDetailDisplay();
  }
  return orchestrationDetailDisplayLoader;
}

async function loadOrchestrationDetailRendererIntoStore(orchestrationDetailRendererStore: {
  set(value: OverlayOrchestrationDetailDisplay): void;
}): Promise<void> {
  const orchestrationDetailRenderer = await loadOrchestrationDetailDisplay();
  orchestrationDetailRendererStore.set(orchestrationDetailRenderer);
}

export function createDetailModalWorkspace({
  detailRendererDefinitions = overlayDetailRendererDefinitions,
  errorMessage = detailModalRendererErrorMessage,
}: {
  detailRendererDefinitions?: OverlayDetailRendererDefinitions;
  errorMessage?: () => string;
} = {}) {
  const detailRendererRegistry = overlayDetailRuntime.createRendererRegistry(
    detailRendererDefinitions,
    errorMessage,
  );
  const orchestrationDetailRendererStore =
    writable<OverlayOrchestrationDetailDisplay>(() => ({}));
  const detailDisplayStateStore = derived(
    [detailModal, currentLanguageState],
    ([$detailModal, _currentLanguageState]) =>
      detailModalPresentation($detailModal),
  );
  const orchestrationDetailDisplayStateStore = derived(
    [
      detailDisplayStateStore,
      currentLanguageState,
      orchestrationDetailRendererStore,
    ],
    ([
      $detailDisplayStateStore,
      _currentLanguageState,
      $orchestrationDetailRendererStore,
    ]) =>
      $orchestrationDetailRendererStore(
        $detailDisplayStateStore.orchestrationDetail,
      ),
  );
  const detailRendererDisplayStateStore = derived(
    [
      detailDisplayStateStore,
      detailRendererRegistry.errors,
      detailRendererRegistry.components,
    ],
    ([
      $detailDisplayStateStore,
      $detailRendererLoadErrors,
      $loadedDetailRenderers,
    ]) =>
      detailModalContentDisplayPresentation(
        $detailDisplayStateStore.detailModalContentDisplay,
        $detailDisplayStateStore.orchestrationDetailRendererId,
        $detailRendererLoadErrors,
        $loadedDetailRenderers,
      ),
  );
  const openHistoryEntryIndexStateStore = derived(
    detailDisplayStateStore,
    ($detailDisplayStateStore) =>
      historyEntryOpenHandler(
        $detailDisplayStateStore.historyDetailDisplay.eventEntries,
      ),
  );
  const detailModalContentPropsStateStore = derived(
    [
      detailDisplayStateStore,
      detailRendererDisplayStateStore,
      orchestrationDetailDisplayStateStore,
      openHistoryEntryIndexStateStore,
    ],
    ([
      $detailDisplayStateStore,
      $detailRendererDisplayStateStore,
      $orchestrationDetailDisplayStateStore,
      $openHistoryEntryIndexStateStore,
    ]) => ({
      contentDisplay: {
        connectionImportDetailDisplay:
          $detailDisplayStateStore.connectionImportDetailDisplay,
        detailModalContentDisplay:
          $detailRendererDisplayStateStore.detailModalContentDisplay,
        historyDetailDisplay: $detailDisplayStateStore.historyDetailDisplay,
        onOpenHistoryEntryIndex: $openHistoryEntryIndexStateStore,
        OrchestrationDetailComponent:
          $detailRendererDisplayStateStore.OrchestrationDetailComponent,
        orchestrationDetailDisplay: $orchestrationDetailDisplayStateStore,
        textDetailDisplay: $detailDisplayStateStore.textDetailDisplay,
      },
    }),
  );

  return {
    detailDisplayStateStore,
    detailModalContentPropsStateStore,
    detailRendererLoadErrorsStore: detailRendererRegistry.errors,
    detailRendererDisplayStateStore,
    loadedDetailRenderersStore: detailRendererRegistry.components,
    openHistoryEntryIndexStateStore,
    orchestrationDetailDisplayStateStore,
    setModalContext({
      detailDisplay,
    }: {
      detailDisplay?: ReturnType<typeof detailModalPresentation>;
    } = {}) {
      if (!detailDisplay) return;
      if (detailDisplay.shouldLoadOrchestrationDetail) {
        detailRendererRegistry.ensure(
          detailDisplay.orchestrationDetailRendererId,
        );
        void loadOrchestrationDetailRendererIntoStore(
          orchestrationDetailRendererStore,
        );
      }
    },
  };
}
