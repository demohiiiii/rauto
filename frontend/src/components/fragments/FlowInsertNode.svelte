<script lang="ts">
  import PlusIcon from "@lucide/svelte/icons/plus";
  import { Handle, Position, useSvelteFlow } from "@xyflow/svelte";
  import { Button } from "$lib/components/ui/button/index.js";

  type FlowInsertNodeData = {
    readonly?: boolean;
    afterNodeId?: string;
    hasSource: boolean;
    hasTarget: boolean;
    labelText: string;
    onInsert?: () => void;
    vertical: boolean;
  };

  interface Props {
    id: string;
    data: FlowInsertNodeData;
  }

  let { id, data }: Props = $props();

  function insert(event: MouseEvent): void {
    event.stopPropagation();
    if (!data.readonly) data.onInsert?.();
  }
  const { getNode, updateNode } = useSvelteFlow();

  $effect(() => {
    if (!data.afterNodeId) return;
    const previous = getNode(data.afterNodeId);
    const current = getNode(id);
    if (!previous || !current) return;
    const width = previous.measured?.width ?? previous.width;
    const height = previous.measured?.height ?? previous.height;
    if (!width || !height) return;
    const size = 44;
    const gap = 48;
    const position = data.vertical
      ? {
          x: previous.position.x + (width - size) / 2,
          y: previous.position.y + height + gap,
        }
      : {
          x: previous.position.x + width + gap,
          y: previous.position.y + (height - size) / 2,
        };
    if (current.position.x !== position.x || current.position.y !== position.y)
      updateNode(id, { position });
  });
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
  disabled={data.readonly}
  class="nodrag nopan size-11 rounded-full border-primary/35 bg-background text-primary shadow-md hover:border-primary hover:bg-primary hover:text-primary-foreground"
  variant="outline"
  size="icon"
  type="button"
  title={data.labelText}
  aria-label={data.labelText}
  onclick={insert}
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
