<script lang="ts">
  import { Badge } from "$lib/components/ui/badge/index.js";
  import RadarIcon from "@lucide/svelte/icons/radar";

  interface Props {
    detectedModel?: string;
    detectedModelLabel?: string;
    detectedProfile?: string;
    detectedProfileLabel?: string;
    detectedVersion?: string;
    detectedVersionLabel?: string;
    warning?: string;
  }

  let {
    detectedModel = "",
    detectedModelLabel = "",
    detectedProfile = "",
    detectedProfileLabel = "",
    detectedVersion = "",
    detectedVersionLabel = "",
    warning = "",
  }: Props = $props();
</script>

<div class="min-w-0" aria-live="polite">
  {#if detectedProfile || detectedModel || detectedVersion}
    <div class="flex min-h-8 min-w-0 flex-wrap items-center gap-2 text-sm">
      <RadarIcon class="size-4 shrink-0 text-primary" aria-hidden="true" />
      {#if detectedProfile}
        <span class="shrink-0 text-muted-foreground">
          {detectedProfileLabel}
        </span>
        <Badge variant="secondary" class="max-w-full font-mono">
          <span class="truncate">{detectedProfile}</span>
        </Badge>
      {/if}
      {#if detectedModel}
        <span class="shrink-0 text-muted-foreground">
          {detectedModelLabel}
        </span>
        <Badge variant="outline" class="max-w-full font-mono">
          <span class="truncate">{detectedModel}</span>
        </Badge>
      {/if}
      {#if detectedVersion}
        <span class="shrink-0 text-muted-foreground">
          {detectedVersionLabel}
        </span>
        <Badge variant="outline" class="max-w-full font-mono">
          <span class="truncate">{detectedVersion}</span>
        </Badge>
      {/if}
    </div>
  {/if}
  {#if warning}
    <p class="mt-1 text-xs leading-5 text-muted-foreground">{warning}</p>
  {/if}
</div>
