<script lang="ts">
  import { currentLanguageState, t } from "$lib/i18n.js";
  import type {
    OrchestrationExecutionResult,
    OrchestrationExecutionDetailEntry,
  } from "../../../model/types.js";
  import {
    orchestrationExecutionPanelDisplay,
    orchestrationStageExecutionDisplayPresentation,
  } from "../../orchestrationResultDisplayState.js";
  import OrchestrationExecutionPanel from "./OrchestrationExecutionPanel.svelte";
  import { orchestrationDetailDisplay } from "../../orchestrationResultDetailState.js";
  import OrchestrationTargetDetailPanel from "./OrchestrationTargetDetailPanel.svelte";
  import OrchestrationStageDetailPanel from "./OrchestrationStageDetailPanel.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
  let selectedDetail = $state<OrchestrationExecutionDetailEntry | null>(null);
  let detailDisplay = $derived.by(() => {
    $currentLanguageState;
    return selectedDetail
      ? orchestrationDetailDisplay(selectedDetail.detail)
      : null;
  });
  let { result }: { result: OrchestrationExecutionResult | null } = $props();
  let panelDisplay = $derived.by(() => {
    $currentLanguageState;
    return orchestrationExecutionPanelDisplay(
      orchestrationStageExecutionDisplayPresentation({
        executionPayload: result,
      }),
    );
  });
</script>

{#if selectedDetail}
  <div class="grid min-w-0 gap-4">
    <div class="flex flex-wrap items-center gap-3">
      <Button
        variant="outline"
        size="sm"
        onclick={() => (selectedDetail = null)}
        ><ArrowLeftIcon class="size-4" />{t(
          "executionHistoryBackToResult",
        )}</Button
      >
      <h3 class="text-sm font-semibold">{selectedDetail.titleText}</h3>
    </div>
    {#if detailDisplay?.targetBasicFieldRows}
      <OrchestrationTargetDetailPanel {...detailDisplay} />
    {:else if detailDisplay?.stageBasicFieldRows}
      <OrchestrationStageDetailPanel {...detailDisplay} />
    {/if}
  </div>
{:else}
  <OrchestrationExecutionPanel
    {panelDisplay}
    onOpenDetail={(detail) => (selectedDetail = detail)}
  />
{/if}
