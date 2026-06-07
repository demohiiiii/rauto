<script>
  import { sidebarHistoryBehavior } from "../../actions/sidebarHistoryBehavior.js";
  import { RAUTO_ICON_URL } from "../../assets/publicAssets.js";
  import { dashboardNavigationItems } from "../../config/dashboardNavigation.js";
  import { navigateDashboardRoute } from "../../router/dashboardRouter.js";
  import { dashboardView } from "../../state/dashboardView.js";

  const isNavItemActive = (item) =>
    item.activeWhen === $dashboardView.currentTab &&
    (!item.txStage || item.txStage === $dashboardView.currentTxStage);
  const isNavItemVisible = (item) =>
    item.activeWhen !== "tasks" || $dashboardView.tasksVisible;

  function openConnectionModal() {
    window.onDashboardConnectionModalOpen?.();
  }
</script>

<label for="sidebar-drawer" aria-label="close sidebar" class="drawer-overlay"
></label>
<aside
  class="dashboard-sidebar w-56 min-h-full flex flex-col"
  use:sidebarHistoryBehavior
>
  <section class="dashboard-sidebar-brand">
    <span class="dashboard-brand-mark" aria-hidden="true">
      <img src={RAUTO_ICON_URL} alt="" />
    </span>
    <div>
      <div
        id="dashboard-sidebar-brand-title"
        class="dashboard-sidebar-brand-title"
      >
        rauto
      </div>
    </div>
  </section>

  <section
    class="dashboard-sidebar-connection dashboard-sidebar-connection-top"
  >
    <div class="dashboard-sidebar-label-row">
      <span id="sidebar-connection-title" class="dashboard-sidebar-label"
        >Connection Target</span
      >
      <button
        id="sidebar-connection-help"
        class="dashboard-help-trigger"
        type="button"
        aria-label="Connection Target Help"
        title="Open the workspace to choose a saved connection or apply a temporary target."
      >
        <svg
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
          class="dashboard-help-icon"
        >
          <circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="1.6"
          ></circle>
          <path
            d="M7.9 7.4a2.3 2.3 0 0 1 4.2 1.1c0 1.5-1.7 1.9-2.1 2.8-.1.2-.1.4-.1.7"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
          ></path>
          <circle cx="10" cy="13.95" r="0.8" fill="currentColor"></circle>
        </svg>
      </button>
    </div>
    <div id="sidebar-connection-meta" class="dashboard-sidebar-meta">-</div>
    <div class="dashboard-sidebar-actions">
      <button
        id="sidebar-connection-open-btn"
        class="dashboard-sidebar-action dashboard-sidebar-action-emphasis"
        type="button"
        onclick={openConnectionModal}
      >
        Choose Target
      </button>
      <button
        id="sidebar-connection-history-btn"
        class="dashboard-sidebar-action"
        type="button"
      >
        History
      </button>
    </div>
  </section>

  <nav class="sidebar-nav flex-1 px-2 py-3">
    <ul class="menu w-full gap-1">
      {#each dashboardNavigationItems as item}
        <li hidden={!isNavItemVisible(item)}>
          <button
            id={item.id}
            type="button"
            data-tab={item.dataTab || undefined}
            class:menu-active={isNavItemActive(item)}
            aria-current={isNavItemActive(item) ? "page" : undefined}
            onclick={() => navigateDashboardRoute(item.routeId)}
          >
            {item.label}
          </button>
        </li>
      {/each}
    </ul>
  </nav>
</aside>
