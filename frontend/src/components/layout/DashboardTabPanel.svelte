<script>
  import { createDashboardTabPanelWorkspace } from "../../modules/dashboardShell.js";

  let { active, children, title, titleFallback, titleKey } = $props();
  const dashboardTabPanelWorkspace = createDashboardTabPanelWorkspace();
  const { panelDisplayStateStore, setPanelContext } =
    dashboardTabPanelWorkspace;
  let panelDisplay = $derived($panelDisplayStateStore);

  $effect(() => {
    setPanelContext({ title, titleFallback, titleKey });
  });
</script>

<div class="tab-panel" role="tabpanel" hidden={!active}>
  <div class="dashboard-page-heading">
    <div class="dashboard-page-breadcrumb">
      <span>控制台</span>
      <span aria-hidden="true">/</span>
      <span>{panelDisplay.panelTitle}</span>
    </div>
    <h2>{panelDisplay.panelTitle}</h2>
  </div>
  {@render children()}
</div>
