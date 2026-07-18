<script>
  import PlusIcon from "@lucide/svelte/icons/plus";
  import { Handle, Position } from "@xyflow/svelte";
  import { Button } from "$lib/components/ui/button/index.js";

  let { data } = $props();

  function insertStage(event) {
    event.stopPropagation();
    if (typeof data.onInsertStage === "function") data.onInsertStage();
  }
</script>

{#if data.hasTarget}
  <Handle
    type="target"
    position={data.vertical ? Position.Top : Position.Left}
    isConnectable={false}
    style="width:0.5rem;height:0.5rem;border:2px solid var(--background);background:var(--primary);"
  />
{/if}

<Button
  class="size-11 rounded-full border-primary/35 bg-background text-primary shadow-md hover:border-primary hover:bg-primary hover:text-primary-foreground"
  variant="outline"
  size="icon"
  type="button"
  title={data.labelText}
  aria-label={data.labelText}
  onclick={insertStage}
>
  <PlusIcon class="size-4" />
</Button>

{#if data.hasSource}
  <Handle
    type="source"
    position={data.vertical ? Position.Bottom : Position.Right}
    isConnectable={false}
    style="width:0.5rem;height:0.5rem;border:2px solid var(--background);background:var(--primary);"
  />
{/if}
