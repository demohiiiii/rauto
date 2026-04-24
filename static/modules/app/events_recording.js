/**
 * app_events_recording.js - recording/history/task/replay event bindings
 */

function bindRecordingHistoryTaskEvents() {
  byId("record-fab").onclick = () => {
    openRecordDrawer();
  };
  const normalizeRecordLevelValue = (value) =>
    String(value || "").trim() === "full" ? "full" : "key-events-only";
  const applyRecordLevel = (level) => {
    const normalized = normalizeRecordLevelValue(level);
    const drawerSelect = byId("record-level");
    if (drawerSelect) {
      drawerSelect.value = normalized;
    }
    if (typeof syncRecordLevelToggleView === "function") {
      syncRecordLevelToggleView(normalized, { updateSelect: false });
    }
    if (typeof updateRecordLevelTooltip === "function") {
      updateRecordLevelTooltip();
    }
  };
  byId("record-level-toggle-btn").onclick = () => {
    const current = normalizeRecordLevelValue(
      byId("record-level")?.value || byId("record-level-toggle-btn")?.dataset.level
    );
    applyRecordLevel(current === "full" ? "key-events-only" : "full");
  };
  byId("record-level").onchange = () => {
    applyRecordLevel(byId("record-level")?.value);
  };
  byId("history-topbar-btn").onclick = () => {
    openHistoryDrawer();
    loadConnectionHistory();
  };
  byId("sidebar-connection-history-btn").onclick = () => {
    openHistoryDrawer();
    loadConnectionHistory();
  };
  byId("record-drawer-close").onclick = () => {
    closeRecordDrawer();
  };
  byId("record-drawer-backdrop").onclick = () => {
    closeRecordDrawer();
  };
  byId("history-drawer-close").onclick = () => {
    closeHistoryDrawer();
  };
  byId("history-drawer-backdrop").onclick = () => {
    closeHistoryDrawer();
  };
  byId("tasks-refresh-btn").onclick = () =>
    withButtonLoading("tasks-refresh-btn", async () => {
      await loadTasks();
    });
  byId("tasks-clear-btn").onclick = () => {
    byId("tasks-search").value = "";
    byId("tasks-operation").value = "";
    byId("tasks-status").value = "";
    byId("tasks-outcome").value = "all";
    byId("tasks-time-range").value = "all";
    byId("tasks-recording").value = "all";
    byId("tasks-error").value = "all";
    byId("tasks-limit").value = "50";
    taskSearchQuery = "";
    taskOutcomeFilter = "all";
    taskTimeRangeFilter = "all";
    taskRecordingFilter = "all";
    taskErrorFilter = "all";
    loadTasks();
  };
  byId("tasks-search").oninput = () => {
    taskSearchQuery = byId("tasks-search").value || "";
    renderTaskList();
  };
  byId("tasks-operation").onchange = () => {
    loadTasks();
  };
  byId("tasks-status").onchange = () => {
    loadTasks();
  };
  byId("tasks-outcome").onchange = () => {
    taskOutcomeFilter = byId("tasks-outcome").value || "all";
    renderTaskList();
  };
  byId("tasks-time-range").onchange = () => {
    taskTimeRangeFilter = byId("tasks-time-range").value || "all";
    renderTaskList();
  };
  byId("tasks-recording").onchange = () => {
    taskRecordingFilter = byId("tasks-recording").value || "all";
    renderTaskList();
  };
  byId("tasks-error").onchange = () => {
    taskErrorFilter = byId("tasks-error").value || "all";
    renderTaskList();
  };
  byId("tasks-limit").onchange = () => {
    loadTasks();
  };

  byId("history-drawer-refresh-btn").onclick = () =>
    withButtonLoading("history-drawer-refresh-btn", async () => {
      await loadConnectionHistory();
    });
  byId("history-filter-query").oninput = () => {
    historyFilterQuery = byId("history-filter-query").value || "";
    saveHistoryFilterPrefs();
    renderHistoryDrawer();
  };
  byId("history-filter-operation").onchange = () => {
    historyFilterOperation = byId("history-filter-operation").value || "all";
    saveHistoryFilterPrefs();
    renderHistoryDrawer();
  };
  byId("history-filter-limit").onchange = () => {
    const raw = Number(byId("history-filter-limit").value || 30);
    historyFilterLimit = Number.isFinite(raw) ? raw : 30;
    saveHistoryFilterPrefs();
    loadConnectionHistory();
  };
  byId("history-filter-clear-btn").onclick = () => {
    historyFilterQuery = "";
    historyFilterOperation = "all";
    byId("history-filter-query").value = "";
    byId("history-filter-operation").value = "all";
    saveHistoryFilterPrefs();
    renderHistoryDrawer();
  };

  byId("record-view-list").onclick = () => {
    recordViewMode = "list";
    saveFilterPrefs();
    renderRecordingView();
  };
  byId("record-view-raw").onclick = () => {
    recordViewMode = "raw";
    saveFilterPrefs();
    renderRecordingView();
  };
  byId("record-jsonl").oninput = () => {
    if (recordViewMode === "list") {
      renderRecordingView();
    }
  };
  byId("record-failed-only").onchange = () => {
    recordFailedOnly = byId("record-failed-only").checked;
    saveFilterPrefs();
    renderRecordingView();
  };
  byId("record-event-kind").onchange = () => {
    recordEventKind = byId("record-event-kind").value || "all";
    saveFilterPrefs();
    renderRecordingView();
  };
  byId("record-search").oninput = () => {
    recordSearchQuery = byId("record-search").value || "";
    saveFilterPrefs();
    renderRecordingView();
  };
  byId("record-clear-filters").onclick = () => {
    resetRecordFilters();
  };
  byId("record-copy-btn").onclick = async () => {
    const text = byId("record-jsonl").value || "";
    if (!text.trim()) {
      showReplayStatus(t("replayNoJsonl"));
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      showReplayStatus(t("recordingCopied"));
    } catch (_) {
      showReplayStatus(t("requestFailed"));
    }
  };
  byId("record-use-replay-btn").onclick = () => {
    byId("replay-jsonl").value = byId("record-jsonl").value || "";
    lastReplayResult = null;
    renderReplayView();
    showReplayStatus(t("recordingSetToReplay"));
  };
  byId("replay-view-list").onclick = () => {
    replayViewMode = "list";
    saveFilterPrefs();
    renderReplayView();
  };
  byId("replay-view-raw").onclick = () => {
    replayViewMode = "raw";
    saveFilterPrefs();
    renderReplayView();
  };
  byId("replay-failed-only").onchange = () => {
    replayFailedOnly = byId("replay-failed-only").checked;
    saveFilterPrefs();
    renderReplayView();
  };
  byId("replay-event-kind").onchange = () => {
    replayEventKind = byId("replay-event-kind").value || "all";
    saveFilterPrefs();
    renderReplayView();
  };
  byId("replay-search").oninput = () => {
    replaySearchQuery = byId("replay-search").value || "";
    saveFilterPrefs();
    renderReplayView();
  };
  byId("replay-clear-filters").onclick = () => {
    resetReplayFilters();
  };
  byId("replay-list-btn").onclick = () =>
    withButtonLoading("replay-list-btn", async () => {
      await replayList();
    });
  byId("replay-run-btn").onclick = () =>
    withButtonLoading("replay-run-btn", async () => {
      await replayCommand();
    });
}
