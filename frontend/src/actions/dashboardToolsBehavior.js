function normalizeRecordLevel(value) {
  return String(value || "").trim() === "full" ? "full" : "key-events-only";
}

function applyRecordLevel(level) {
  const normalized = normalizeRecordLevel(level);
  const drawerSelect = document.getElementById("record-level");
  if (drawerSelect) drawerSelect.value = normalized;
  if (typeof window.syncRecordLevelToggleView === "function") {
    window.syncRecordLevelToggleView(normalized, { updateSelect: false });
  }
  window.updateRecordLevelTooltip?.();
}

export function dashboardToolsBehavior(node) {
  const recordFab = node.querySelector("#record-fab");
  const recordLevelToggle = node.querySelector("#record-level-toggle-btn");
  const historyTopbar = node.querySelector("#history-topbar-btn");

  const openRecord = () => window.openRecordDrawer?.();
  const toggleRecordLevel = () => {
    const current = normalizeRecordLevel(
      document.getElementById("record-level")?.value ||
        recordLevelToggle?.dataset.level,
    );
    applyRecordLevel(current === "full" ? "key-events-only" : "full");
  };
  const openHistory = () => {
    window.openHistoryDrawer?.();
    window.loadConnectionHistory?.();
  };

  recordFab?.addEventListener("click", openRecord);
  recordLevelToggle?.addEventListener("click", toggleRecordLevel);
  historyTopbar?.addEventListener("click", openHistory);

  return {
    destroy() {
      recordFab?.removeEventListener("click", openRecord);
      recordLevelToggle?.removeEventListener("click", toggleRecordLevel);
      historyTopbar?.removeEventListener("click", openHistory);
    },
  };
}
