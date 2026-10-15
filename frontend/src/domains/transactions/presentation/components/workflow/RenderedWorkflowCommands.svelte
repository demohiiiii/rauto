<script lang="ts">
  import { currentLanguageState, t } from "$lib/i18n.js";
  import type { RenderedWorkflow } from "../../../model/renderedWorkflow.js";
  import RenderedOperationCard from "./RenderedOperationCard.svelte";
  let { workflow }: { workflow: RenderedWorkflow } = $props();
  function label(key: string): string {
    $currentLanguageState;
    return t(key);
  }
</script>

<div class="grid min-w-0 gap-5" data-rendered-workflow>
  {#each workflow.blocks as block, blockIndex}
    <section class="grid min-w-0 gap-3">
      <div class="flex min-w-0 items-center gap-2.5">
        <span
          class="flex size-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-mono text-[11px] text-primary"
          >{String(blockIndex + 1).padStart(2, "0")}</span
        >
        <h3 class="min-w-0 break-all text-sm font-medium">{block.name}</h3>
      </div>
      {#each block.steps as step, stepIndex}
        <div
          class="grid min-w-0 gap-2 rounded-2xl border border-border/70 bg-card p-3"
        >
          <div class="font-mono text-[10px] text-muted-foreground">
            {blockIndex + 1}.{stepIndex + 1}
          </div>
          <div
            class={`grid min-w-0 gap-3 ${block.rollback_policy === "per_step" && step.rollback ? "lg:grid-cols-2" : ""}`}
          >
            <RenderedOperationCard operation={step.run} />
            {#if block.rollback_policy === "per_step" && step.rollback}
              <div class="grid min-w-0 content-start gap-2">
                <RenderedOperationCard operation={step.rollback} rollback />
                {#if step.rollback_on_failure}<span
                    class="px-1 text-[11px] text-muted-foreground"
                    >{label("txBlockFormRollbackOnFailure")}</span
                  >{/if}
              </div>
            {/if}
          </div>
        </div>
      {/each}
      {#if typeof block.rollback_policy === "object"}
        <div
          class="grid min-w-0 gap-2 rounded-2xl border border-amber-500/20 p-3"
        >
          <div class="text-xs text-muted-foreground">
            {label("renderedCommandsWholeRollback")} · {block.rollback_policy
              .whole_resource.trigger_step_index + 1}
          </div>
          <RenderedOperationCard
            operation={block.rollback_policy.whole_resource.rollback}
            rollback
          />
        </div>
      {/if}
    </section>
  {/each}
  {#if workflow.blocks.length === 0}<p
      class="py-8 text-center text-sm text-muted-foreground"
    >
      {label("renderedCommandsEmpty")}
    </p>{/if}
</div>
