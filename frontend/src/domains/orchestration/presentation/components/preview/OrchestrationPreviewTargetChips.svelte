<script lang="ts">
  import type { OrchestrationPreviewChip } from "$domains/orchestration/index.js";

  interface Props {
    chipRows?: OrchestrationPreviewChip[];
    emptyText?: string;
    hasValues?: boolean;
  }

  let { chipRows = [], hasValues = false, emptyText = "" }: Props = $props();
</script>

{#if hasValues}
  {#each chipRows as chipRow}
    <span class={chipRow.chipClass}>{chipRow.chipText}</span>
  {/each}
{:else}
  <span class="text-xs text-slate-500">{emptyText}</span>
{/if}
