<script>
  import * as Card from "$lib/components/ui/card";
  import LoadingButton from "../../components/fragments/LoadingButton.svelte";
  import StatusCard from "../../components/fragments/StatusCard.svelte";
  import { createTxBlockRunPanelWorkspace } from "../../modules/transactionExecutionDisplays.js";
  import TxBlockResultPanel from "./TxBlockResultPanel.svelte";

  let { onDirectExecute, onTemplateExecute, panelDisplay } = $props();
  const txBlockRunPanelWorkspace = createTxBlockRunPanelWorkspace();
  const {
    execStatusDisplayStateStore,
    loadingDisplayStateStore,
    modeDisplayStateStore,
    previewDisplayStateStore,
    previewModeDisplayStateStore,
    setPanelDisplay,
  } = txBlockRunPanelWorkspace;

  $effect(() => {
    setPanelDisplay(panelDisplay);
  });
  let resultPanel = $derived(
    $previewDisplayStateStore.previewPresentation?.resultPanel || {},
  );
</script>

{#if $modeDisplayStateStore.isDirect}
  <Card.Root>
    <Card.Header class="sr-only">
      <Card.Title>
        {$previewModeDisplayStateStore.executeButtonLabel}
      </Card.Title>
    </Card.Header>
    <Card.Content class="grid gap-2">
      <LoadingButton
        class="w-full"
        variant="default"
        size="sm"
        loading={$loadingDisplayStateStore.directExecute}
        onclick={onDirectExecute}
      >
        <span>{$previewModeDisplayStateStore.executeButtonLabel}</span>
      </LoadingButton>
    </Card.Content>
  </Card.Root>
{:else if $modeDisplayStateStore.isTemplate}
  <Card.Root>
    <Card.Header class="sr-only">
      <Card.Title>
        {$previewModeDisplayStateStore.executeButtonLabel}
      </Card.Title>
    </Card.Header>
    <Card.Content class="grid gap-2">
      <LoadingButton
        class="w-full"
        variant="default"
        size="sm"
        loading={$loadingDisplayStateStore.templateExecute}
        onclick={onTemplateExecute}
      >
        <span>{$previewModeDisplayStateStore.executeButtonLabel}</span>
      </LoadingButton>
    </Card.Content>
  </Card.Root>
{/if}
{#if resultPanel.hasTxResult}
  <TxBlockResultPanel {resultPanel} />
{/if}
{#if $execStatusDisplayStateStore.modeDisplay && $execStatusDisplayStateStore.modeDisplay.showStatus}
  <div class="mt-2 grid gap-2">
    <StatusCard
      message={$execStatusDisplayStateStore.message}
      tone={$execStatusDisplayStateStore.tone}
    />
  </div>
{/if}
