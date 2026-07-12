<script>
  import { Toaster as Sonner } from "svelte-sonner";
  import { Portal } from "bits-ui";
  import { mode } from "mode-watcher";
  import Loader2Icon from "@lucide/svelte/icons/loader-2";
  import CircleCheckIcon from "@lucide/svelte/icons/circle-check";
  import OctagonXIcon from "@lucide/svelte/icons/octagon-x";
  import InfoIcon from "@lucide/svelte/icons/info";
  import TriangleAlertIcon from "@lucide/svelte/icons/triangle-alert";

  let { ...restProps } = $props();
</script>

<Portal>
  <div class="pointer-events-none fixed inset-0 z-[100]">
    <Sonner
      theme={mode.current}
      class="toaster group"
      style="z-index: 100; pointer-events: auto; --normal-bg: var(--color-popover); --normal-text: var(--color-popover-foreground); --normal-border: var(--color-border);"
      {...restProps}
    >
      {#snippet loadingIcon()}
        <Loader2Icon class="size-4 animate-spin" />
      {/snippet}
      {#snippet successIcon()}
        <CircleCheckIcon class="size-4" />
      {/snippet}
      {#snippet errorIcon()}
        <OctagonXIcon class="size-4" />
      {/snippet}
      {#snippet infoIcon()}
        <InfoIcon class="size-4" />
      {/snippet}
      {#snippet warningIcon()}
        <TriangleAlertIcon class="size-4" />
      {/snippet}
    </Sonner>
  </div>
</Portal>
