<script>
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Sheet from "$lib/components/ui/sheet/index.js";
  import { cn } from "$lib/utils.js";
  import { dashboardDrawerShellDisplay } from "../../lib/ui.js";

  let {
    children,
    class: contentClass = "",
    drawerShellDisplay,
    onClose,
  } = $props();

  let sheetOpen = $state(false);
  let lastDisplayOpen = $state(false);
  let mounted = $state(false);
  let dashboardDrawerDisplay = $derived(
    dashboardDrawerShellDisplay({
      ariaLabel: drawerShellDisplay.ariaLabelText,
      title: drawerShellDisplay.title,
    }),
  );
  let sheetContentClass = $derived(
    cn(
      "w-[min(92vw,56rem)] max-w-[56rem] gap-0 overflow-hidden p-0 sm:max-w-[56rem]",
      contentClass,
    ),
  );

  function closeDrawer() {
    if (typeof onClose === "function") {
      onClose();
    }
  }

  $effect(() => {
    const nextOpen = !!drawerShellDisplay.open;
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
      closeDrawer();
    }
  });
</script>

<Sheet.Root bind:open={sheetOpen}>
  <Sheet.Content
    side="right"
    class={sheetContentClass}
    aria-label={dashboardDrawerDisplay.ariaLabelText}
    showCloseButton={false}
  >
    <Sheet.Header
      class="flex flex-row items-center justify-between gap-4 border-b border-border p-4 pb-3"
    >
      <div class="grid gap-1 text-left">
        <Sheet.Title class="text-sm font-semibold">
          {drawerShellDisplay.title}
        </Sheet.Title>
        {#if drawerShellDisplay.subtitle}
          <Sheet.Description class="text-xs">
            {drawerShellDisplay.subtitle}
          </Sheet.Description>
        {/if}
      </div>
      <Button variant="outline" size="sm" type="button" onclick={closeDrawer}>
        {drawerShellDisplay.closeLabel}
      </Button>
    </Sheet.Header>
    {@render children()}
  </Sheet.Content>
</Sheet.Root>
