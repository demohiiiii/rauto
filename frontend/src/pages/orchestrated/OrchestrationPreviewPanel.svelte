<script>
  import * as Card from "$lib/components/ui/card";
  import OrchestrationPreviewStageOutline from "./OrchestrationPreviewStageOutline.svelte";
  import OrchestrationPreviewStageSection from "./OrchestrationPreviewStageSection.svelte";
  import StatusCard from "../../components/fragments/StatusCard.svelte";
  import SummaryMetricCard from "../../components/fragments/SummaryMetricCard.svelte";
  import { createOrchestrationPreviewPanelWorkspace } from "../../modules/orchestrationResultState.js";

  let { inventory, message, previewMode, plan, text, tone } = $props();
  const orchestrationPreviewPanelWorkspace =
    createOrchestrationPreviewPanelWorkspace();
  const {
    previewModeDisplayStateStore,
    previewPresentationStateStore,
    setPreviewInputs,
  } = orchestrationPreviewPanelWorkspace;
  let previewModeDisplay = $derived($previewModeDisplayStateStore);
  let previewPresentation = $derived($previewPresentationStateStore);

  $effect(() => {
    setPreviewInputs({ inventory, plan, previewMode });
  });
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>{previewPresentation.titleText}</Card.Title>
  </Card.Header>
  <Card.Content class="grid gap-2">
    {#if previewModeDisplay.showText}
      {text}
    {:else if previewModeDisplay.showStatus}
      <StatusCard {message} {tone} />
    {:else}
      {#if !previewPresentation.hasPlan}
        <StatusCard message={previewPresentation.emptyMessage} />
      {:else}
        <div class="grid gap-3">
          <div class="grid gap-2 md:grid-cols-5">
            {#each previewPresentation.summaryCards as previewSummaryCard}
              <SummaryMetricCard
                label={previewSummaryCard.label}
                metricValue={previewSummaryCard.summaryValue}
                size="lg"
              />
            {/each}
          </div>
          {#if previewPresentation.hasStageRows}
            <OrchestrationPreviewStageOutline
              titleText={previewPresentation.stageOutlineTitle}
              jobChipRow={previewPresentation.stageOutlineJobChip}
              stageRows={previewPresentation.stageRows}
            />
            {#each previewPresentation.stageRows as previewStageRow}
              <OrchestrationPreviewStageSection {previewStageRow} />
            {/each}
          {:else}
            <StatusCard message={previewPresentation.emptyMessage} />
          {/if}
        </div>
      {/if}
    {/if}
  </Card.Content>
</Card.Root>
