import {
  normalizeShowQuery,
  SHOW_QUERY,
} from "../../../config/dashboardModes.js";
import { derived, writable } from "svelte/store";
import type { Writable } from "svelte/store";
import { currentLanguageState, t } from "../../../lib/i18n.js";
import { createLoadingStateRunner as createLoadingRunner } from "../../../lib/svelte.js";
import { safeString } from "../../../lib/ui.js";
import { MODE_SELECT, modeSelection } from "$domains/profiles/index.js";
import type { ModeSelectState } from "$domains/profiles/index.js";
import { batchShowTargetPickerFields } from "$domains/connections/index.js";
import {
  batchShowObjectAvailabilityState,
  DEFAULT_SHOW_PAGE_QUERY,
  executeBatchShowObject,
  executeShowObject,
  isBatchShowBusy,
  loadBatchShowObjects,
  refreshShowExecutionModeOptions,
  refreshShowObjects,
  setBatchShowFields,
  setBatchShowRetryFields,
  setShowTextfsmFields,
  setSingleShowFields,
  setSingleShowRetryFields,
  showCommandPreviewRowsState,
  showObjectPickerKey,
  updateBatchShowCommandPreview,
  updateShowCommandPreview,
} from "./showExecutionState.js";
import { showConnectionTargetIdentity } from "../model/show.js";
import {
  showObjectSelectionPresentation,
  showPagePresentation,
} from "../presentation/showPresentation.js";
import {
  createSessionRetryState,
  sessionRetryValidation,
} from "$domains/execution/index.js";
import type {
  BatchShowObjectAvailability,
  ShowCommandPreviewRow,
} from "../model/types.js";
import type { ConnectionTargetState } from "$domains/connections/index.js";
import type { SessionRetryState } from "$domains/execution/index.js";

type StatusTone = "error" | "info" | "running" | "success" | "warning";

type AfterDomUpdate = (onReady: () => void) => void;

interface ShowSelectionFields {
  maxParallel?: string;
  mode: string;
  modeOptions: string[];
  objectPickerKey: string;
  previewRows: ShowCommandPreviewRow[];
  showResolvedCommandDetails: boolean;
}

interface ShowTextfsmFields {
  enabled: boolean;
  autoDownloadExcel: boolean;
  autoDownloadOutput: boolean;
  strictErrors: boolean;
}

interface BatchTargetPickerField {
  key: string;
  keyName: string;
  labelKey: string;
  placeholderKey: string;
}

const createRetryState = createSessionRetryState as () => SessionRetryState;
const validateRetryState = sessionRetryValidation as (
  value: SessionRetryState,
) => { valid: boolean };
function showSelectionFieldsForQuery({
  modeState = {},
  previewRows = {},
  query = "",
}: {
  modeState?: Partial<ModeSelectState>;
  previewRows?: Record<string, ShowCommandPreviewRow[]>;
  query?: string;
} = {}): ShowSelectionFields {
  const key = normalizeShowQuery(query);
  return {
    mode: safeString(modeState?.selected),
    modeOptions: Array.isArray(modeState?.modes) ? modeState.modes : [],
    objectPickerKey: safeString(showObjectPickerKey(query)),
    previewRows: Array.isArray(previewRows?.[key]) ? previewRows[key] : [],
    showResolvedCommandDetails: key === SHOW_QUERY.single,
  };
}

function showTextfsmFieldsForState({
  enabled = false,
  autoDownloadExcel = false,
  autoDownloadOutput = false,
  strictErrors = false,
}: {
  enabled?: boolean;
  autoDownloadExcel?: boolean;
  autoDownloadOutput?: boolean;
  strictErrors?: boolean;
} = {}): ShowTextfsmFields {
  return {
    enabled: !!enabled,
    autoDownloadExcel: !!autoDownloadExcel,
    autoDownloadOutput: !!autoDownloadOutput,
    strictErrors: !!strictErrors,
  };
}

function singleShowRunPresentation() {
  return {
    executeButtonLabel: t("showExecuteBtn"),
  };
}

function showRunButtonDisplayPresentation({
  executeButtonLabel = "",
  executeLoading = false,
} = {}) {
  return {
    executeButtonLabel: safeString(executeButtonLabel),
    executeLoading: !!executeLoading,
  };
}

function singleShowPanelPresentation({
  modeState = {},
  previewRows = {},
  textfsmState = {},
  executeLoading = false,
  retryState = createRetryState(),
}: {
  modeState?: Partial<ModeSelectState>;
  previewRows?: Record<string, ShowCommandPreviewRow[]>;
  textfsmState?: Parameters<typeof showTextfsmFieldsForState>[0];
  executeLoading?: boolean;
  retryState?: SessionRetryState;
} = {}) {
  const runDisplay = singleShowRunPresentation();
  return {
    selectionFields: showSelectionFieldsForQuery({
      modeState,
      previewRows,
      query: SHOW_QUERY.single,
    }),
    textfsmFields: showTextfsmFieldsForState(textfsmState),
    retryState,
    retryValid: validateRetryState(retryState).valid,
    runButtonDisplay: showRunButtonDisplayPresentation({
      executeButtonLabel: runDisplay.executeButtonLabel,
      executeLoading,
    }),
    runDisplay,
  };
}

function batchShowInputPresentation(
  fields: readonly BatchTargetPickerField[] = [],
) {
  return {
    executeButtonLabel: t("batchShowExecuteBtn"),
    fields: (Array.isArray(fields) ? fields : []).map((field) => ({
      ...field,
      labelText: t(field.labelKey),
      pickerPlaceholder: t(field.placeholderKey),
    })),
    targetsLabel: t("batchShowTargetsLabel"),
  };
}

export function batchShowObjectAvailabilityPresentation(
  availability: Partial<BatchShowObjectAvailability> = {
    connectionCount: 0,
    missingProfileNames: [],
    objectCount: 0,
    profiles: [],
    status: "waiting",
  },
): {
  canSelect: boolean;
  message: string;
  status: string;
  tone: StatusTone;
} {
  const status = safeString(availability?.status || "waiting");
  const missingProfileNames = Array.isArray(availability?.missingProfileNames)
    ? availability.missingProfileNames
    : [];
  const messages: Record<string, string> = {
    empty: t("batchShowObjectsEmptyIntersection"),
    error:
      safeString(availability?.errorMessage) || t("batchShowObjectsLoadFailed"),
    loading: t("batchShowObjectsLoading"),
    "missing-profile": t("batchShowObjectsMissingProfile").replace(
      "{names}",
      missingProfileNames.join(", ") || "-",
    ),
    "no-targets": t("batchShowObjectsNoTargets"),
    waiting: t("batchShowSelectTargetsFirst"),
  };
  return {
    canSelect: status === "ready",
    message: messages[status] || "",
    status,
    tone:
      status === "loading"
        ? "running"
        : ["error", "missing-profile"].includes(status)
          ? "error"
          : status === "empty" || status === "no-targets"
            ? "warning"
            : "info",
  };
}

function batchShowPanelPresentation({
  executeLoading = false,
  fields = [],
  maxParallel = "",
  modeState = {},
  objectAvailability = {
    connectionCount: 0,
    missingProfileNames: [],
    objectCount: 0,
    profiles: [],
    status: "waiting",
  },
  previewRows = {},
  textfsmState = {},
  retryState = createRetryState(),
}: {
  executeLoading?: boolean;
  fields?: readonly BatchTargetPickerField[];
  maxParallel?: string;
  modeState?: Partial<ModeSelectState>;
  objectAvailability?: BatchShowObjectAvailability;
  previewRows?: Record<string, ShowCommandPreviewRow[]>;
  textfsmState?: Parameters<typeof showTextfsmFieldsForState>[0];
  retryState?: SessionRetryState;
} = {}) {
  const inputDisplay = batchShowInputPresentation(fields);
  return {
    inputDisplay,
    objectAvailability:
      batchShowObjectAvailabilityPresentation(objectAvailability),
    selectionFields: {
      ...showSelectionFieldsForQuery({
        modeState,
        previewRows,
        query: SHOW_QUERY.batch,
      }),
      maxParallel: safeString(maxParallel),
    },
    textfsmFields: showTextfsmFieldsForState(textfsmState),
    retryState,
    retryValid: validateRetryState(retryState).valid,
    runButtonDisplay: showRunButtonDisplayPresentation({
      executeButtonLabel: inputDisplay.executeButtonLabel,
      executeLoading,
    }),
  };
}

function createShowObjectSelectionWorkspace({
  onModeChange,
}: {
  onModeChange?: (mode: string) => void;
} = {}) {
  const selectionFieldsStateStore = writable<ShowSelectionFields>({
    mode: "",
    modeOptions: [],
    objectPickerKey: "",
    previewRows: [],
    showResolvedCommandDetails: false,
  });
  const selectionDisplayStateStore = derived(
    [selectionFieldsStateStore, currentLanguageState],
    ([$selectionFieldsStateStore, _currentLanguageState]) =>
      showObjectSelectionPresentation({
        selectedMode: $selectionFieldsStateStore.mode,
        modeOptions: $selectionFieldsStateStore.modeOptions,
      }),
  );
  return {
    changeMode(nextMode: string) {
      if (onModeChange) {
        onModeChange(nextMode);
      }
    },
    selectionDisplayStateStore,
    setSelectionFields(nextShowSelectionFields: ShowSelectionFields) {
      selectionFieldsStateStore.set(nextShowSelectionFields);
    },
  };
}

function patchStoreField<T extends object, K extends keyof T>(
  stateStore: Writable<T>,
  field: K,
  value: T[K],
): void {
  stateStore.update((state) => ({ ...state, [field]: value }));
}

function runAfterShowPageDomUpdate(
  afterDomUpdate: AfterDomUpdate | undefined,
  onReady: () => void,
): void {
  if (!afterDomUpdate) {
    onReady();
    return;
  }
  afterDomUpdate(onReady);
}

function waitForShowPageDomUpdate(
  afterDomUpdate: AfterDomUpdate | undefined,
): Promise<void> {
  return new Promise<void>((resolve) => {
    runAfterShowPageDomUpdate(afterDomUpdate, resolve);
  });
}

export function createShowPageWorkspace({
  afterDomUpdate,
}: {
  afterDomUpdate?: AfterDomUpdate;
} = {}) {
  const currentQueryState = writable(DEFAULT_SHOW_PAGE_QUERY);
  const pageDisplayStateStore = derived(
    [currentQueryState, currentLanguageState],
    ([$currentQuery, _currentLanguageState]) =>
      showPagePresentation($currentQuery),
  );
  let lastExecutionProfile = "";
  let lastConnectionTargetKey = "";

  async function selectQuery(showQuery: string): Promise<void> {
    currentQueryState.set(normalizeShowQuery(showQuery));
    await waitForShowPageDomUpdate(afterDomUpdate);
    await refreshShowObjects();
  }

  function setRouteContext({
    active = false,
    target = { details: null, kind: "none" },
    profile = "",
  }: {
    active?: boolean;
    target?: ConnectionTargetState;
    profile?: string;
  } = {}): void {
    const nextConnectionTargetKey = showConnectionTargetIdentity(target);
    if (!active) {
      lastConnectionTargetKey = "";
      lastExecutionProfile = "";
      return;
    }
    if (lastConnectionTargetKey !== nextConnectionTargetKey) {
      lastConnectionTargetKey = nextConnectionTargetKey;
      void refreshShowObjects();
    }
    const executionProfile = safeString(profile).trim();
    if (lastExecutionProfile === executionProfile) return;
    lastExecutionProfile = executionProfile;
    void refreshShowExecutionModeOptions();
  }

  function destroy(): void {
    lastConnectionTargetKey = "";
    lastExecutionProfile = "";
  }

  return {
    currentQueryState,
    destroy,
    pageDisplayStateStore,
    selectQuery,
    setRouteContext,
  };
}

export function createSingleShowPanelWorkspace() {
  const showCommandPreviewRowsStateStore = showCommandPreviewRowsState();
  const singleShowLoadingStateStore = writable({
    executeLoading: false,
  });
  const singleShowLoadingState = { keys: [] };
  const singleModePicker = modeSelection(MODE_SELECT.showSingle);
  const singleShowTextStateStore = writable({
    autoDownloadExcel: false,
    autoDownloadOutput: false,
    strictErrors: false,
    textfsmEnabled: true,
  });
  const singleShowRetryStateStore = writable(createRetryState());
  const singleShowLoadingRunner = createLoadingRunner(singleShowLoadingState, {
    setKeys(keys: string[]) {
      singleShowLoadingStateStore.set({
        executeLoading: keys.includes("execute"),
      });
    },
  });
  const selectionPanelWorkspace = createShowObjectSelectionWorkspace({
    onModeChange: (mode: string) => singleModePicker.setValue(mode),
  });
  const panelDisplayStateStore = derived(
    [
      singleModePicker.state,
      showCommandPreviewRowsStateStore,
      singleShowTextStateStore,
      singleShowRetryStateStore,
      singleShowLoadingStateStore,
      currentLanguageState,
    ],
    ([
      $singleModeState,
      $showCommandPreviewRows,
      $singleShowTextState,
      $singleShowRetryState,
      $singleShowLoadingState,
      _currentLanguageState,
    ]) =>
      singleShowPanelPresentation({
        modeState: $singleModeState,
        previewRows: $showCommandPreviewRows,
        textfsmState: {
          enabled: $singleShowTextState.textfsmEnabled,
          autoDownloadExcel: $singleShowTextState.autoDownloadExcel,
          autoDownloadOutput: $singleShowTextState.autoDownloadOutput,
          strictErrors: $singleShowTextState.strictErrors,
        },
        executeLoading: $singleShowLoadingState.executeLoading,
        retryState: $singleShowRetryState,
      }),
  );
  function setPanelContext({
    active = false,
    panelDisplay = null,
  }: {
    active?: boolean;
    panelDisplay?: ReturnType<typeof singleShowPanelPresentation> | null;
  } = {}): void {
    if (!active || !panelDisplay) return;
    selectionPanelWorkspace.setSelectionFields(panelDisplay.selectionFields);
    setSingleShowFields(panelDisplay.selectionFields);
    setShowTextfsmFields(panelDisplay.textfsmFields);
    setSingleShowRetryFields(panelDisplay.retryState);
  }

  function changeSessionRetry(retry: Partial<SessionRetryState> = {}): void {
    const nextRetry = { ...createRetryState(), ...retry };
    singleShowRetryStateStore.set(nextRetry);
    setSingleShowRetryFields(nextRetry);
  }

  async function executeSingleShow(): Promise<void | undefined> {
    return singleShowLoadingRunner.run("execute", executeShowObject);
  }

  const textfsmActionHandlers = {
    autoDownloadExcelChange: (autoDownloadExcel: boolean) =>
      patchStoreField(
        singleShowTextStateStore,
        "autoDownloadExcel",
        !!autoDownloadExcel,
      ),
    autoDownloadOutputChange: (autoDownloadOutput: boolean) =>
      patchStoreField(
        singleShowTextStateStore,
        "autoDownloadOutput",
        !!autoDownloadOutput,
      ),
    enabledChange: (enabled: boolean) =>
      patchStoreField(singleShowTextStateStore, "textfsmEnabled", !!enabled),
    strictErrorsChange: (strictErrors: boolean) =>
      patchStoreField(singleShowTextStateStore, "strictErrors", !!strictErrors),
  };

  return {
    changeShowObject: updateShowCommandPreview,
    changeShowObjectMode: selectionPanelWorkspace.changeMode,
    changeSessionRetry,
    executeSingleShow,
    panelDisplayStateStore,
    selectionDisplayStateStore:
      selectionPanelWorkspace.selectionDisplayStateStore,
    setPanelContext,
    textfsmActionHandlers,
  };
}

export function createBatchShowInputPanelWorkspace() {
  const showCommandPreviewRowsStateStore = showCommandPreviewRowsState();
  const batchShowObjectAvailabilityStateStore =
    batchShowObjectAvailabilityState();
  const batchShowLoadingStateStore = writable({
    executeLoading: false,
  });
  const batchShowLoadingState = { keys: [] };
  const batchModePicker = modeSelection(MODE_SELECT.showBatch);
  const batchShowTextStateStore = writable({
    autoDownloadExcel: false,
    autoDownloadOutput: false,
    maxParallel: "",
    strictErrors: false,
    textfsmEnabled: true,
  });
  const batchShowRetryStateStore = writable(createRetryState());
  const batchShowLoadingRunner = createLoadingRunner(batchShowLoadingState, {
    setKeys(keys: string[]) {
      batchShowLoadingStateStore.set({
        executeLoading: isBatchShowBusy(keys),
      });
    },
  });
  const selectionPanelWorkspace = createShowObjectSelectionWorkspace({
    onModeChange: (mode: string) => batchModePicker.setValue(mode),
  });
  const panelDisplayStateStore = derived(
    [
      batchModePicker.state,
      showCommandPreviewRowsStateStore,
      batchShowTextStateStore,
      batchShowRetryStateStore,
      batchShowLoadingStateStore,
      batchShowObjectAvailabilityStateStore,
      currentLanguageState,
    ],
    ([
      $batchModeState,
      $showCommandPreviewRows,
      $batchShowTextState,
      $batchShowRetryState,
      $batchShowLoadingState,
      $batchShowObjectAvailability,
      _currentLanguageState,
    ]) =>
      batchShowPanelPresentation({
        executeLoading: $batchShowLoadingState.executeLoading,
        fields: batchShowTargetPickerFields,
        maxParallel: $batchShowTextState.maxParallel,
        modeState: $batchModeState,
        objectAvailability: $batchShowObjectAvailability,
        previewRows: $showCommandPreviewRows,
        retryState: $batchShowRetryState,
        textfsmState: {
          enabled: $batchShowTextState.textfsmEnabled,
          autoDownloadExcel: $batchShowTextState.autoDownloadExcel,
          autoDownloadOutput: $batchShowTextState.autoDownloadOutput,
          strictErrors: $batchShowTextState.strictErrors,
        },
      }),
  );

  function setPanelContext({
    active = false,
    panelDisplay = null,
  }: {
    active?: boolean;
    panelDisplay?: ReturnType<typeof batchShowPanelPresentation> | null;
  } = {}): void {
    if (!active || !panelDisplay) return;
    selectionPanelWorkspace.setSelectionFields(panelDisplay.selectionFields);
    setBatchShowFields(
      panelDisplay.selectionFields,
      panelDisplay.textfsmFields,
    );
    setBatchShowRetryFields(panelDisplay.retryState);
  }

  function changeSessionRetry(retry: Partial<SessionRetryState> = {}): void {
    const nextRetry = { ...createRetryState(), ...retry };
    batchShowRetryStateStore.set(nextRetry);
    setBatchShowRetryFields(nextRetry);
  }

  async function executeBatchShowPanel(): Promise<void | undefined> {
    return batchShowLoadingRunner.run("execute", executeBatchShowObject);
  }

  const textfsmActionHandlers = {
    enabledChange: (enabled: boolean) =>
      patchStoreField(batchShowTextStateStore, "textfsmEnabled", !!enabled),
    autoDownloadExcelChange: (autoDownloadExcel: boolean) =>
      patchStoreField(
        batchShowTextStateStore,
        "autoDownloadExcel",
        !!autoDownloadExcel,
      ),
    autoDownloadOutputChange: (autoDownloadOutput: boolean) =>
      patchStoreField(
        batchShowTextStateStore,
        "autoDownloadOutput",
        !!autoDownloadOutput,
      ),
    strictErrorsChange: (strictErrors: boolean) =>
      patchStoreField(batchShowTextStateStore, "strictErrors", !!strictErrors),
  };

  function changeBatchMaxParallel(maxParallel: string): void {
    patchStoreField(
      batchShowTextStateStore,
      "maxParallel",
      safeString(maxParallel).trim(),
    );
  }

  return {
    batchShowLoadingStateStore,
    changeBatchMaxParallel,
    changeBatchTargets: loadBatchShowObjects,
    changeShowObject: updateBatchShowCommandPreview,
    changeShowObjectMode: selectionPanelWorkspace.changeMode,
    changeSessionRetry,
    executeBatchShowPanel,
    panelDisplayStateStore,
    selectionDisplayStateStore:
      selectionPanelWorkspace.selectionDisplayStateStore,
    setPanelContext,
    textfsmActionHandlers,
  };
}
