const STORAGE = {
  recordViewMode: "rauto_record_view_mode",
  recordFailedOnly: "rauto_record_failed_only",
  recordEventKind: "rauto_record_event_kind",
  recordSearchQuery: "rauto_record_search_query",
};

function tr(key, fallback = key) {
  return typeof window.t === "function" ? window.t(key) : fallback;
}

function syncRecordState(state) {
  if (typeof window.setRecordingRuntimeState === "function") {
    window.setRecordingRuntimeState(state);
  }
}

function saveRecordPrefs(state) {
  localStorage.setItem(STORAGE.recordViewMode, state.viewMode);
  localStorage.setItem(STORAGE.recordFailedOnly, String(state.failedOnly));
  localStorage.setItem(STORAGE.recordEventKind, state.eventKind);
  localStorage.setItem(STORAGE.recordSearchQuery, state.searchQuery);
  syncRecordState(state);
}

function currentState(node) {
  return {
    viewMode: localStorage.getItem(STORAGE.recordViewMode) || "list",
    failedOnly: localStorage.getItem(STORAGE.recordFailedOnly) === "true",
    eventKind: localStorage.getItem(STORAGE.recordEventKind) || "all",
    searchQuery: localStorage.getItem(STORAGE.recordSearchQuery) || "",
    node,
  };
}

export function recordDrawerBehavior(node) {
  const state = currentState(node);
  const closeBtn = node.querySelector("#record-drawer-close");
  const backdrop = document.getElementById("record-drawer-backdrop");
  const recordLevel = node.querySelector("#record-level");
  const viewList = node.querySelector("#record-view-list");
  const viewRaw = node.querySelector("#record-view-raw");
  const failedOnly = node.querySelector("#record-failed-only");
  const eventKind = node.querySelector("#record-event-kind");
  const search = node.querySelector("#record-search");
  const clear = node.querySelector("#record-clear-filters");
  const copy = node.querySelector("#record-copy-btn");
  const useReplay = node.querySelector("#record-use-replay-btn");
  const jsonl = node.querySelector("#record-jsonl");

  function render() {
    syncRecordState(state);
    window.renderRecordingView?.();
  }

  function closeRecordDrawer() {
    backdrop?.classList.remove("open");
    node.classList.remove("open");
    document.body.classList.remove("overflow-hidden");
  }

  function applyInputs() {
    failedOnly.checked = state.failedOnly;
    eventKind.value = state.eventKind;
    search.value = state.searchQuery;
  }

  function onRecordLevelChange() {
    const normalized =
      String(recordLevel?.value || "").trim() === "full"
        ? "full"
        : "key-events-only";
    if (typeof window.syncRecordLevelToggleView === "function") {
      window.syncRecordLevelToggleView(normalized, { updateSelect: false });
    }
    window.updateRecordLevelTooltip?.();
  }

  const setView = (viewMode) => {
    state.viewMode = viewMode;
    saveRecordPrefs(state);
    render();
  };
  const resetRecordFilters = () => {
    state.failedOnly = false;
    state.eventKind = "all";
    state.searchQuery = "";
    applyInputs();
    saveRecordPrefs(state);
    render();
  };
  const copyRecording = async () => {
    const text = jsonl?.value || "";
    if (!text.trim()) {
      window.showReplayStatus?.(
        tr("replayNoJsonl", "recording JSONL is required"),
      );
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      window.showReplayStatus?.(tr("recordingCopied", "recording copied"));
    } catch (_) {
      window.showReplayStatus?.(tr("requestFailed", "request failed"));
    }
  };
  const useInReplay = () => {
    window.setReplayJsonlFromRecording?.(jsonl?.value || "");
  };

  viewList?.addEventListener("click", () => setView("list"));
  viewRaw?.addEventListener("click", () => setView("raw"));
  jsonl?.addEventListener("input", () => {
    if (state.viewMode === "list") render();
  });
  failedOnly?.addEventListener("change", () => {
    state.failedOnly = failedOnly.checked;
    saveRecordPrefs(state);
    render();
  });
  eventKind?.addEventListener("change", () => {
    state.eventKind = eventKind.value || "all";
    saveRecordPrefs(state);
    render();
  });
  search?.addEventListener("input", () => {
    state.searchQuery = search.value || "";
    saveRecordPrefs(state);
    render();
  });
  clear?.addEventListener("click", resetRecordFilters);
  copy?.addEventListener("click", copyRecording);
  useReplay?.addEventListener("click", useInReplay);
  closeBtn?.addEventListener("click", closeRecordDrawer);
  backdrop?.addEventListener("click", closeRecordDrawer);
  recordLevel?.addEventListener("change", onRecordLevelChange);

  window.resetRecordFilters = resetRecordFilters;
  window.closeRecordDrawer = closeRecordDrawer;

  syncRecordState(state);
  applyInputs();

  return {
    destroy() {
      clear?.removeEventListener("click", resetRecordFilters);
      copy?.removeEventListener("click", copyRecording);
      useReplay?.removeEventListener("click", useInReplay);
      closeBtn?.removeEventListener("click", closeRecordDrawer);
      backdrop?.removeEventListener("click", closeRecordDrawer);
      recordLevel?.removeEventListener("change", onRecordLevelChange);
    },
  };
}
