<script lang="ts">
  import type { ComponentProps } from "svelte";
  import ArrowRightLeftIcon from "@lucide/svelte/icons/arrow-right-left";
  import CircleAlertIcon from "@lucide/svelte/icons/circle-alert";
  import CrosshairIcon from "@lucide/svelte/icons/crosshair";
  import EthernetPortIcon from "@lucide/svelte/icons/ethernet-port";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Tooltip from "$lib/components/ui/tooltip/index.js";
  import { cn } from "$lib/utils.js";
  import type { sidebarConnectionPresentation } from "../connectionTargetDisplayState.js";
  import ConnectionSessionIndicator from "./ConnectionSessionIndicator.svelte";

  interface Props {
    display: ReturnType<typeof sidebarConnectionPresentation>;
    onSelect: () => void;
  }

  let { display, onSelect }: Props = $props();
</script>

<Tooltip.Provider delayDuration={100} skipDelayDuration={0}>
  <Tooltip.Root>
    <Tooltip.Trigger>
      {#snippet child({ props }: { props: ComponentProps<typeof Button> })}
        <Button
          {...props}
          data-connection-target-trigger
          class={cn(
            "group/target h-10 w-full min-w-0 justify-start gap-2.5 rounded-lg border-0 bg-transparent px-1.5 text-left shadow-none transition-colors duration-[160ms] ease-out hover:bg-muted/60 motion-reduce:transition-none max-sm:size-8 max-sm:justify-center max-sm:p-0",
            display.showError && "text-destructive",
          )}
          variant="ghost"
          type="button"
          aria-label={display.connectionSummaryLabel}
          aria-haspopup="dialog"
          onclick={onSelect}
        >
          <span
            class={cn(
              "relative flex size-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset transition-[background-color,color,box-shadow] duration-[160ms] ease-out motion-reduce:transition-none",
              display.showError
                ? "bg-destructive/10 text-destructive ring-destructive/20"
                : display.hasCard
                  ? "bg-primary/8 text-primary ring-primary/15 group-hover/target:bg-primary/15 group-hover/target:ring-primary/30 group-focus-visible/target:ring-primary/30"
                  : "bg-muted/60 text-muted-foreground ring-border group-hover/target:text-primary group-hover/target:ring-primary/25",
            )}
          >
            {#if display.showError}
              <CircleAlertIcon class="size-4" aria-hidden="true" />
            {:else if display.hasCard}
              <EthernetPortIcon class="size-4" aria-hidden="true" />
            {:else}
              <CrosshairIcon class="size-4" aria-hidden="true" />
            {/if}
            {#if display.hasCard}
              <span class="absolute -right-0.5 -bottom-0.5"
                ><ConnectionSessionIndicator compact /></span
              >
            {/if}
          </span>
          <span class="min-w-0 flex-1 max-sm:hidden">
            {#key display.connectionSummaryLabel + display.errorMessage}
              <span class="target-copy flex min-w-0 flex-col gap-0.5">
                {#if display.showError}
                  <span class="truncate text-xs font-medium text-destructive">
                    {display.errorMessage}
                  </span>
                {:else if display.hasCard}
                  <span
                    class="truncate text-[13px] font-semibold leading-4 text-foreground transition-colors duration-[160ms] ease-out group-hover/target:text-primary motion-reduce:transition-none"
                  >
                    {display.contextLabel}
                  </span>
                  <span class="flex min-w-0 items-center gap-1.5">
                    <span
                      class="min-w-0 truncate font-mono text-[10px] leading-3 text-muted-foreground"
                    >
                      {display.endpointLabel}
                    </span>
                    <span
                      class="h-2.5 w-px shrink-0 bg-border"
                      aria-hidden="true"
                    ></span>
                    <span
                      class="max-w-24 truncate font-mono text-[10px] leading-3 text-muted-foreground/80"
                    >
                      {display.profileLabel}
                    </span>
                  </span>
                {:else}
                  <span
                    class="truncate text-xs font-medium text-muted-foreground transition-colors duration-[160ms] ease-out group-hover/target:text-foreground motion-reduce:transition-none"
                  >
                    {display.actionLabel}
                  </span>
                {/if}
              </span>
            {/key}
          </span>
          <span
            class="flex size-6 shrink-0 translate-x-0.5 items-center justify-center rounded-md bg-primary/10 text-primary opacity-0 transition-[opacity,translate] duration-[160ms] ease-out group-hover/target:translate-x-0 group-hover/target:opacity-100 group-focus-visible/target:translate-x-0 group-focus-visible/target:opacity-100 motion-reduce:transition-none max-sm:hidden"
            aria-hidden="true"
          >
            <ArrowRightLeftIcon class="size-3.5" />
          </span>
        </Button>
      {/snippet}
    </Tooltip.Trigger>
    <Tooltip.Content side="bottom" sideOffset={8}>
      {#if display.showError}
        {display.errorMessage}
      {:else if display.hasCard}
        <span class="flex flex-col items-start gap-1">
          <span class="font-semibold">{display.contextLabel}</span>
          <span class="font-mono text-[11px] opacity-80">
            {display.endpointLabel} · {display.profileLabel}
          </span>
          <span
            class="mt-1 inline-flex items-center gap-1.5 border-t border-background/20 pt-1.5 text-[10px] opacity-80"
          >
            <ArrowRightLeftIcon class="size-3" aria-hidden="true" />
            {display.actionLabel}
          </span>
        </span>
      {:else}
        {display.actionLabel}
      {/if}
    </Tooltip.Content>
  </Tooltip.Root>
</Tooltip.Provider>

<style>
  .target-copy {
    animation: target-enter 180ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  @keyframes target-enter {
    from {
      opacity: 0;
      transform: translateY(3px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .target-copy {
      animation: none;
    }
  }
</style>
