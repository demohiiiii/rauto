<script>
  let { chipRows = [], hasValues = false, emptyText = "" } = $props();
</script>

{#if hasValues}
  {#each chipRows as chipRow}
    <span class={chipRow.chipClass}>{chipRow.chipText}</span>
  {/each}
{:else}
  <span class="text-xs text-slate-500">{emptyText}</span>
{/if}
