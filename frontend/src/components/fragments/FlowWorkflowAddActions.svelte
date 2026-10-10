<script lang="ts">
  import PlusIcon from "@lucide/svelte/icons/plus";
  import { Button } from "$lib/components/ui/button/index.js";
  import type { FlowWorkflowAddActions } from "./flowWorkflowTypes.js";

  let { data }: { data: FlowWorkflowAddActions } = $props();

  function runAction(event: MouseEvent, action?: () => void): void {
    event.stopPropagation();
    if (!data.readonly) action?.();
  }
</script>

<div
  data-testid="flow-workflow-add-actions"
  class="nodrag nopan flex min-w-0 gap-1"
>
  <Button
    disabled={data.readonly}
    class={data.addControlActions?.length ? "min-w-0 flex-1" : "w-full"}
    variant="outline"
    size="sm"
    type="button"
    onclick={(event) => runAction(event, data.onAddBlock)}
  >
    <PlusIcon data-icon="inline-start" />
    <span class="truncate">{data.addBlockLabel}</span>
  </Button>
  {#each data.addControlActions ?? [] as action}
    <Button
      disabled={data.readonly}
      variant="outline"
      size="sm"
      type="button"
      onclick={(event) => runAction(event, action.onAdd)}
    >
      <PlusIcon data-icon="inline-start" />{action.label}
    </Button>
  {/each}
</div>
