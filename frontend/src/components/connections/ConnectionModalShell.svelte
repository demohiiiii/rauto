<script>
  import { Button } from "$lib/components/ui/button/index.js";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import { cn } from "$lib/utils.js";
  import CircleIcon from "@lucide/svelte/icons/circle";
  import PencilIcon from "@lucide/svelte/icons/pencil";
  import PlugIcon from "@lucide/svelte/icons/plug";
  import XIcon from "@lucide/svelte/icons/x";

  let {
    cardClass,
    children,
    headerControls,
    modalDisplay,
    modeControls,
    onClose,
    variant = "workbench",
  } = $props();

  let dialogOpen = $state(false);
  let lastDisplayOpen = $state(false);
  let isEditor = $derived(variant === "editor");

  function closeModal() {
    if (typeof onClose === "function") {
      onClose();
    }
  }

  function keepOpenForToastInteraction(event) {
    const target = event.target;
    if (
      target instanceof Element &&
      target.closest("[data-sonner-toaster], [data-sonner-toast]")
    ) {
      event.preventDefault();
    }
  }

  $effect(() => {
    const nextOpen = Boolean(modalDisplay?.open);
    if (nextOpen === lastDisplayOpen) return;
    lastDisplayOpen = nextOpen;
    dialogOpen = nextOpen;
  });

  $effect(() => {
    if (dialogOpen === lastDisplayOpen) return;
    lastDisplayOpen = dialogOpen;
    if (!dialogOpen) {
      closeModal();
    }
  });
</script>

<Dialog.Root bind:open={dialogOpen}>
  <Dialog.Content
    class={cn(
      "flex max-h-[92vh] w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden rounded-3xl border-border bg-card p-0 shadow-2xl sm:max-w-6xl",
      cardClass,
    )}
    aria-label={modalDisplay?.ariaLabelText || modalDisplay?.title}
    onInteractOutside={keepOpenForToastInteraction}
    showCloseButton={false}
  >
    <Dialog.Header
      class={cn(
        "flex-row flex-wrap items-start justify-between gap-4 border-b border-border bg-gradient-to-br px-7 py-5",
        isEditor
          ? "from-accent/40 via-card to-card"
          : "from-primary/10 via-accent/30 to-card",
      )}
    >
      <div class="flex min-w-0 items-start gap-3.5">
        <div
          class={cn(
            "flex shrink-0 items-center justify-center rounded-2xl",
            isEditor
              ? "size-11 bg-primary/15 text-primary ring-1 ring-inset ring-primary/20"
              : "size-12 bg-primary text-primary-foreground shadow-lg shadow-primary/25",
          )}
        >
          {#if isEditor}
            <PencilIcon aria-hidden="true" />
          {:else}
            <PlugIcon aria-hidden="true" />
          {/if}
        </div>
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <Dialog.Title class="text-lg font-bold tracking-tight">
              {modalDisplay?.title}
            </Dialog.Title>
            {#if !isEditor}
              <Badge variant="secondary" class="gap-1 rounded-full">
                <CircleIcon
                  class="size-1.5 fill-current text-primary"
                  aria-hidden="true"
                />
                就绪
              </Badge>
            {/if}
          </div>
          {#if modalDisplay?.subtitle}
            <Dialog.Description class="mt-1 text-sm">
              {modalDisplay.subtitle}
            </Dialog.Description>
          {/if}
        </div>
      </div>
      <div class="inline-flex items-center gap-2">
        {#if typeof headerControls === "function"}
          {@render headerControls()}
        {/if}
        <Button
          variant="ghost"
          size="icon"
          type="button"
          aria-label={modalDisplay?.closeText}
          onclick={closeModal}
        >
          <XIcon aria-hidden="true" />
        </Button>
      </div>
    </Dialog.Header>
    {#if typeof modeControls === "function"}
      {@render modeControls()}
    {/if}
    <div class="flex min-h-0 flex-1 overflow-hidden">
      {@render children()}
    </div>
  </Dialog.Content>
</Dialog.Root>
