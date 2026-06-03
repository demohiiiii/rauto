<script>
  import {
    dashboardView,
    setDashboardExecMode,
  } from "../../state/dashboardView.js";

  const modes = [
    ["direct", "standard-mode-direct", "Direct Execute"],
    ["template", "standard-mode-template", "Template Execute"],
    ["flow", "standard-mode-flow", "Command Flow"],
  ];

  function setExecMode(mode) {
    setDashboardExecMode(mode);
    window.currentExecMode = mode;
    window.onDashboardExecModeChange?.(mode);
  }
</script>

<div
  class="tabs tabs-box w-fit"
  role="tablist"
  aria-label="Standard execution mode tabs"
>
  {#each modes as [mode, id, label]}
    <button
      {id}
      class="tab"
      class:tab-active={$dashboardView.currentExecMode === mode}
      type="button"
      role="tab"
      aria-selected={($dashboardView.currentExecMode === mode).toString()}
      onclick={() => setExecMode(mode)}
    >
      {label}
    </button>
  {/each}
</div>
