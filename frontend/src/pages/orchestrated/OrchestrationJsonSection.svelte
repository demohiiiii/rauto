<script>
  import { createOrchestrationJsonSectionWorkspace } from "../../modules/orchestrationResultState.js";

  let { jsonValue, title } = $props();
  const orchestrationJsonSectionWorkspace =
    createOrchestrationJsonSectionWorkspace();
  const { orchestrationJsonSectionDisplayStateStore, setJsonValue } =
    orchestrationJsonSectionWorkspace;
  let orchestrationJsonSectionDisplay = $derived(
    $orchestrationJsonSectionDisplayStateStore,
  );

  $effect(() => {
    setJsonValue(jsonValue);
  });
</script>

{#snippet jsonTreeNode(node)}
  {#if node.showPrimitive}
    <div
      class="grid gap-1 rounded-md border border-slate-200 bg-white px-2 py-1.5"
    >
      <div class="font-mono text-xs text-slate-600">{node.label}</div>
      <div
        class="break-all whitespace-pre-wrap font-mono text-xs text-slate-900"
      >
        {node.valueText}
      </div>
    </div>
  {:else}
    <details
      class="rounded-md border border-slate-200 bg-slate-50"
      open={node.open}
    >
      <summary
        class="cursor-pointer px-2 py-1.5 font-mono text-xs text-slate-700"
      >
        {node.label}
        <span class="text-slate-500">{node.countText}</span>
      </summary>
      <div class="grid gap-2 border-t border-slate-200 px-2 py-2">
        {#if node.hasChildren}
          {#each node.children as child}
            {@render jsonTreeNode(child)}
          {/each}
        {:else}
          <div
            class="rounded-md border border-dashed border-slate-300 bg-slate-50 px-2 py-1 text-xs text-slate-500"
          >
            {node.emptyText}
          </div>
        {/if}
      </div>
    </details>
  {/if}
{/snippet}

<section class="rounded-xl border border-slate-200 bg-white p-3">
  <div class="mb-2 text-xs font-semibold text-slate-600">{title}</div>
  <div
    class="max-h-96 overflow-auto rounded-md border border-slate-200 bg-slate-50 p-2"
  >
    {@render jsonTreeNode(orchestrationJsonSectionDisplay.tree)}
  </div>
  <details class="mt-2">
    <summary
      class="inline-flex h-8 cursor-pointer items-center rounded-md border border-border bg-background px-3 text-xs font-medium shadow-xs hover:bg-muted"
    >
      {orchestrationJsonSectionDisplay.rawToggleLabel}
    </summary>
    <pre
      class="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-md bg-slate-900 p-2 text-xs text-slate-100">{orchestrationJsonSectionDisplay.rawText}</pre>
  </details>
</section>
