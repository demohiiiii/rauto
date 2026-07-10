<script>
  import HistoryDrawerContent from "./HistoryDrawerContent.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Sheet from "$lib/components/ui/sheet/index.js";
  import HistoryIcon from "@lucide/svelte/icons/history";
  import XIcon from "@lucide/svelte/icons/x";
  import { createHistoryDrawerWorkspace } from "../../modules/connections.js";
  import { closeHistoryDrawer } from "../../modules/overlays.js";

  const historyDrawerWorkspace = createHistoryDrawerWorkspace();
  const {
    changeLimit,
    changeOperation,
    changeQuery,
    clearFilters,
    deleteHistoryItem,
    historyDisplayStateStore,
    openHistoryItem,
    refreshHistory,
  } = historyDrawerWorkspace;
  let historyDisplay = $derived($historyDisplayStateStore);
  let shellDisplay = $derived(historyDisplay.shellDisplay);
  let sheetOpen = $state(false);
  let lastDisplayOpen = $state(false);
  let mounted = $state(false);

  $effect(() => {
    const nextOpen = !!shellDisplay.open;
    if (!mounted) {
      mounted = true;
      sheetOpen = nextOpen;
      lastDisplayOpen = nextOpen;
      return;
    }
    if (nextOpen === lastDisplayOpen) return;
    lastDisplayOpen = nextOpen;
    sheetOpen = nextOpen;
  });

  $effect(() => {
    if (!mounted || sheetOpen === lastDisplayOpen) return;
    lastDisplayOpen = sheetOpen;
    if (!sheetOpen) {
      closeHistoryDrawer();
    }
  });
</script>

<Sheet.Root bind:open={sheetOpen}>
  <Sheet.Content
    side="right"
    class="w-full gap-0 overflow-hidden p-0 data-[side=right]:w-[min(100vw,64rem)] data-[side=right]:sm:max-w-3xl data-[side=right]:xl:max-w-4xl"
    aria-label={shellDisplay.ariaLabelText}
    showCloseButton={false}
  >
    <Sheet.Header
      class="flex-row items-start justify-between gap-4 border-b border-border px-6 py-5"
    >
      <div class="flex min-w-0 items-start gap-3 text-left">
        <span
          class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
        >
          <HistoryIcon class="size-5" />
        </span>
        <div class="min-w-0">
          <Sheet.Title
            id="history-drawer-title"
            class="text-lg font-semibold tracking-tight"
          >
            {shellDisplay.title}
          </Sheet.Title>
          {#if shellDisplay.subtitle}
            <Sheet.Description class="text-sm">
              {shellDisplay.subtitle}
            </Sheet.Description>
          {/if}
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        type="button"
        aria-label={shellDisplay.closeLabel}
        onclick={closeHistoryDrawer}
      >
        <XIcon />
      </Button>
    </Sheet.Header>
    <HistoryDrawerContent
      {historyDisplay}
      onDeleteItem={deleteHistoryItem}
      onLimitChange={changeLimit}
      onOpenItem={openHistoryItem}
      onOperationChange={changeOperation}
      onQueryInput={changeQuery}
      onClearFilters={clearFilters}
      onRefresh={refreshHistory}
    />
  </Sheet.Content>
</Sheet.Root>
