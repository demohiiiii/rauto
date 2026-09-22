<script lang="ts">
  import { untrack, type Snippet } from "svelte";
  import TerminalIcon from "@lucide/svelte/icons/terminal";
  import GitBranchIcon from "@lucide/svelte/icons/git-branch";
  import ExecutionScopePanel from "$components/fragments/ExecutionScopePanel.svelte";
  import DashboardTabPanel from "$components/layout/DashboardTabPanel.svelte";
  import type { DeliveryTargetMode } from "$config/dashboardModes.js";
  import { currentLanguageState, t } from "$lib/i18n.js";
  import { currentPathname } from "$lib/browser.js";
  import { executionConnectionProfileState } from "$domains/profiles/index.js";
  import { refreshStandardExecutionModeOptions } from "../../application/standardInteractiveExecutionState.js";

  interface Props {
    active: boolean;
    kind: "command" | "interactive";
    singlePanel: Snippet<[boolean]>;
    batchPanel: Snippet<[boolean]>;
  }

  let { active, kind, singlePanel, batchPanel }: Props = $props();
  let targetMode = $state<DeliveryTargetMode>(
    currentPathname() === "/app/batch" ? "batch" : "single",
  );
  let singleVisited = $state(untrack(() => targetMode === "single"));
  let batchVisited = $state(untrack(() => targetMode === "batch"));
  let labels = $derived.by(() => {
    $currentLanguageState;
    return {
      title: t(
        kind === "command"
          ? "commandDeliveryTitle"
          : "interactiveDeliveryTitle",
      ),
      hint: t(
        kind === "command" ? "commandDeliveryHint" : "interactiveDeliveryHint",
      ),
    };
  });

  function selectTargetMode(value: string) {
    targetMode = value === "batch" ? "batch" : "single";
    if (targetMode === "batch") batchVisited = true;
    else singleVisited = true;
  }

  $effect(() => {
    const profile = $executionConnectionProfileState;
    if (!active) return;
    void profile;
    void refreshStandardExecutionModeOptions();
  });
</script>

<DashboardTabPanel {active}>
  <div class="grid gap-3">
    <ExecutionScopePanel
      title={labels.title}
      description={labels.hint}
      icon={kind === "command" ? TerminalIcon : GitBranchIcon}
      activeValue={targetMode}
      onSelect={selectTargetMode}
    >
      {#if singleVisited}
        <div class="workspace-panel-enter" hidden={targetMode !== "single"}>
          {@render singlePanel(active && targetMode === "single")}
        </div>
      {/if}
      {#if batchVisited}
        <div class="workspace-panel-enter" hidden={targetMode !== "batch"}>
          {@render batchPanel(active && targetMode === "batch")}
        </div>
      {/if}
    </ExecutionScopePanel>
  </div>
</DashboardTabPanel>
