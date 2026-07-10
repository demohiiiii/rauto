<script>
  import * as Card from "$lib/components/ui/card";
  import LoadingButton from "../../components/fragments/LoadingButton.svelte";
  import StatusCard from "../../components/fragments/StatusCard.svelte";
  import { createTxBlockRunPanelWorkspace } from "../../modules/transactionExecutionDisplays.js";
  import TxBlockPreviewPanel from "./TxBlockPreviewPanel.svelte";

  let {
    onDirectExecute,
    onDirectPlan,
    onTemplateExecute,
    onTemplatePlan,
    panelDisplay,
  } = $props();
  const txBlockRunPanelWorkspace = createTxBlockRunPanelWorkspace();
  const {
    execStatusDisplayStateStore,
    loadingDisplayStateStore,
    modeDisplayStateStore,
    planStatusDisplayStateStore,
    previewDisplayStateStore,
    previewModeDisplayStateStore,
    setPanelDisplay,
  } = txBlockRunPanelWorkspace;

  $effect(() => {
    setPanelDisplay(panelDisplay);
  });
</script>

{#if $modeDisplayStateStore.isDirect}
  <Card.Root>
    <Card.Header class="sr-only">
      <Card.Title>
        {$previewModeDisplayStateStore.planButtonLabel} /
        {$previewModeDisplayStateStore.executeButtonLabel}
      </Card.Title>
    </Card.Header>
    <Card.Content class="grid gap-2">
      <div class="grid gap-2 md:grid-cols-2">
        <LoadingButton
          variant="outline"
          size="sm"
          loading={$loadingDisplayStateStore.directPlan}
          onclick={onDirectPlan}
        >
          <span>{$previewModeDisplayStateStore.planButtonLabel}</span>
        </LoadingButton>
        <LoadingButton
          variant="default"
          size="sm"
          loading={$loadingDisplayStateStore.directExecute}
          onclick={onDirectExecute}
        >
          <span>{$previewModeDisplayStateStore.executeButtonLabel}</span>
        </LoadingButton>
      </div>
    </Card.Content>
  </Card.Root>
{:else if $modeDisplayStateStore.isTemplate}
  <Card.Root>
    <Card.Header class="sr-only">
      <Card.Title>
        {$previewModeDisplayStateStore.planButtonLabel} /
        {$previewModeDisplayStateStore.executeButtonLabel}
      </Card.Title>
    </Card.Header>
    <Card.Content class="grid gap-2">
      <div class="grid gap-2 md:grid-cols-2">
        <LoadingButton
          variant="outline"
          size="sm"
          loading={$loadingDisplayStateStore.templatePlan}
          onclick={onTemplatePlan}
        >
          <span>{$previewModeDisplayStateStore.planButtonLabel}</span>
        </LoadingButton>
        <LoadingButton
          variant="default"
          size="sm"
          loading={$loadingDisplayStateStore.templateExecute}
          onclick={onTemplateExecute}
        >
          <span>{$previewModeDisplayStateStore.executeButtonLabel}</span>
        </LoadingButton>
      </div>
    </Card.Content>
  </Card.Root>
{/if}
<Card.Root>
  <Card.Header>
    <Card.Title>{$previewModeDisplayStateStore.visualTitle}</Card.Title>
  </Card.Header>
  <Card.Content class="grid gap-2">
    {#if $previewModeDisplayStateStore.showText}
      {$previewDisplayStateStore.text}
    {:else if $previewModeDisplayStateStore.showStatus}
      <StatusCard
        message={$previewDisplayStateStore.message}
        tone={$previewDisplayStateStore.tone}
      />
    {:else if $previewModeDisplayStateStore.showEmptyPreview}
      <StatusCard message={$previewModeDisplayStateStore.emptyPreviewMessage} />
    {:else}
      <TxBlockPreviewPanel
        previewPresentation={$previewDisplayStateStore.previewPresentation}
        showResult={true}
        showSummary={true}
      />
    {/if}
  </Card.Content>
</Card.Root>
{#if $planStatusDisplayStateStore.modeDisplay && $planStatusDisplayStateStore.modeDisplay.showStatus}
  <div class="mt-2 grid gap-2">
    <StatusCard
      message={$planStatusDisplayStateStore.message}
      tone={$planStatusDisplayStateStore.tone}
    />
  </div>
{/if}
{#if $execStatusDisplayStateStore.modeDisplay && $execStatusDisplayStateStore.modeDisplay.showStatus}
  <div class="mt-2 grid gap-2">
    <StatusCard
      message={$execStatusDisplayStateStore.message}
      tone={$execStatusDisplayStateStore.tone}
    />
  </div>
{/if}
