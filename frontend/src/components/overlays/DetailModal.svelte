<script>
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import ListChecksIcon from "@lucide/svelte/icons/list-checks";
  import XIcon from "@lucide/svelte/icons/x";
  import DetailModalContent from "./DetailModalContent.svelte";
  import { cn } from "$lib/utils.js";
  import {
    closeDetailModal,
    createDetailModalWorkspace,
  } from "../../modules/overlays/overlays.js";
  const detailModalWorkspace = createDetailModalWorkspace();
  let detailDisplayStateStore = $derived(
    detailModalWorkspace.detailDisplayStateStore,
  );
  let detailModalContentPropsStateStore = $derived(
    detailModalWorkspace.detailModalContentPropsStateStore,
  );
  let detailDisplay = $derived($detailDisplayStateStore);
  let detailModalContentPropsDisplay = $derived(
    $detailModalContentPropsStateStore,
  );
  let isHistoryDetail = $derived(
    detailDisplay.detailModalContentDisplay.showHistoryDetail,
  );
  let dialogOpen = $state(false);
  let lastDisplayOpen = $state(false);

  $effect(() => {
    detailModalWorkspace.setModalContext({ detailDisplay });
  });

  $effect(() => {
    if (detailDisplay.open === lastDisplayOpen) return;
    lastDisplayOpen = detailDisplay.open;
    dialogOpen = detailDisplay.open;
  });

  $effect(() => {
    if (dialogOpen === lastDisplayOpen) return;
    lastDisplayOpen = dialogOpen;
    if (!dialogOpen) {
      closeDetailModal();
    }
  });
</script>

<Dialog.Root bind:open={dialogOpen}>
  <Dialog.Content
    class={cn(
      "max-h-[90vh] gap-0 overflow-hidden border-border bg-card p-0 shadow-2xl",
      isHistoryDetail
        ? "w-[calc(100vw-2rem)] rounded-3xl sm:max-w-5xl"
        : "sm:max-w-5xl",
    )}
    showCloseButton={false}
  >
    <Dialog.Header
      class="flex-row items-center justify-between gap-4 border-b border-border px-6 py-5"
    >
      <div class="flex min-w-0 items-center gap-3 text-left">
        <span
          class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
        >
          <ListChecksIcon class="size-5" />
        </span>
        <div class="min-w-0">
          <Dialog.Title class="text-lg font-semibold tracking-tight">
            {detailDisplay.title}
          </Dialog.Title>
          <Dialog.Description class="text-sm text-muted-foreground">
            {detailDisplay.detailModalContentDisplay.subtitle}
          </Dialog.Description>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        type="button"
        aria-label={detailDisplay.closeLabel}
        onclick={closeDetailModal}
      >
        <XIcon />
      </Button>
    </Dialog.Header>
    <div class="max-h-[76vh] overflow-auto px-5 py-5 sm:px-6 sm:py-6">
      <DetailModalContent {...detailModalContentPropsDisplay} />
    </div>
  </Dialog.Content>
</Dialog.Root>
