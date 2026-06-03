export function sidebarHistoryBehavior(node) {
  const button = node.querySelector("#sidebar-connection-history-btn");
  const openHistory = () => {
    window.openHistoryDrawer?.();
    window.loadConnectionHistory?.();
  };

  button?.addEventListener("click", openHistory);

  return {
    destroy() {
      button?.removeEventListener("click", openHistory);
    },
  };
}
