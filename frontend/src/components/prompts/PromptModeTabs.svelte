<script>
  import {
    dashboardView,
    setDashboardPromptMode,
  } from "../../state/dashboardView.js";

  const modes = [
    ["view", "nav-prompt-view", "Built-in"],
    ["edit", "nav-prompt-edit", "Custom"],
    ["diagnose", "nav-prompt-diagnose", "Diagnose"],
  ];

  function setPromptMode(mode) {
    setDashboardPromptMode(mode);
    window.currentPromptMode = mode;
    window.onDashboardPromptModeChange?.(mode);
  }
</script>

<div
  class="mt-3 tabs tabs-box w-fit"
  role="tablist"
  aria-label="Prompt sections"
>
  {#each modes as [mode, id, label]}
    <button
      {id}
      class="tab"
      class:tab-active={$dashboardView.currentPromptMode === mode}
      type="button"
      role="tab"
      aria-selected={($dashboardView.currentPromptMode === mode).toString()}
      onclick={() => setPromptMode(mode)}
    >
      {label}
    </button>
  {/each}
</div>
