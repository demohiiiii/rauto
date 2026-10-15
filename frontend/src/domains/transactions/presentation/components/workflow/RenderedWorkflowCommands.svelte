<script lang="ts">
  import TerminalIcon from "@lucide/svelte/icons/terminal";
  import Undo2Icon from "@lucide/svelte/icons/undo-2";
  import { currentLanguageState, t } from "$lib/i18n.js";
  import type {
    RenderedOperation,
    RenderedWorkflow,
  } from "../../../model/renderedWorkflow.js";
  import RenderedOperationCard from "./RenderedOperationCard.svelte";
  let { workflow }: { workflow: RenderedWorkflow } = $props();
  function label(key: string): string {
    $currentLanguageState;
    return t(key);
  }
</script>

{#snippet runOperation(operation: RenderedOperation, index: number)}
  <div class="flex min-w-0 items-start gap-2.5 px-3 py-2.5">
    <span
      class="w-4 shrink-0 pt-px text-right font-mono text-[10px] leading-4 text-muted-foreground/70"
      >{String(index + 1).padStart(2, "0")}</span
    >
    <RenderedOperationCard {operation} />
  </div>
{/snippet}

<div class="grid min-w-0 gap-4" data-rendered-workflow>
  {#each workflow.blocks as block, blockIndex}
    {@const hasRollback = block.rollback_policy !== "none"}
    <section
      class="min-w-0 overflow-hidden rounded-xl border border-border/80 bg-background shadow-xs"
      data-rendered-block
    >
      <div
        class="flex min-w-0 items-center gap-2.5 border-b border-border/70 bg-muted/25 px-3 py-2.5"
      >
        <span
          class="flex size-6 shrink-0 items-center justify-center rounded-md border border-primary/15 bg-primary/5 font-mono text-[10px] font-medium text-primary"
          >{String(blockIndex + 1).padStart(2, "0")}</span
        >
        <h3 class="min-w-0 break-all text-xs font-semibold">{block.name}</h3>
      </div>
      <div class="min-w-0">
        <div
          class={`grid border-b border-border/60 ${hasRollback ? "grid-cols-2" : "grid-cols-1"}`}
        >
          <div
            class="flex items-center gap-2 bg-primary/5 px-3 py-2 text-[11px] font-medium text-primary"
          >
            <TerminalIcon class="size-3.5" />
            {label("renderedCommandsRun")}
          </div>
          {#if hasRollback}
            <div
              class="flex items-center gap-2 border-l border-border/60 bg-amber-500/5 px-3 py-2 text-[11px] font-medium text-amber-700 dark:text-amber-400"
            >
              <Undo2Icon class="size-3.5" />
              {label("renderedCommandsRollback")}
            </div>
          {/if}
        </div>
        {#if typeof block.rollback_policy === "object"}
          <div class="grid grid-cols-2">
            <div class="min-w-0 divide-y divide-border/60">
              {#each block.steps as step, stepIndex}
                {@render runOperation(step.run, stepIndex)}
              {/each}
            </div>
            <div
              class="min-w-0 space-y-2 border-l border-border/60 bg-amber-500/[0.025] px-3 py-2.5"
            >
              <div
                class="text-[10px] leading-4 text-amber-700 dark:text-amber-400"
              >
                {label("renderedCommandsWholeRollback")}
                {block.rollback_policy.whole_resource.trigger_step_index + 1}
              </div>
              <RenderedOperationCard
                operation={block.rollback_policy.whole_resource.rollback}
                rollback
              />
            </div>
          </div>
        {:else}
          <div class="divide-y divide-border/60">
            {#each block.steps as step, stepIndex}
              <div
                class={`grid min-w-0 ${hasRollback ? "grid-cols-2" : "grid-cols-1"}`}
                data-rendered-step
              >
                {@render runOperation(step.run, stepIndex)}
                {#if hasRollback}
                  <div
                    class="min-w-0 border-l border-border/60 bg-amber-500/[0.025] px-3 py-2.5"
                  >
                    {#if step.rollback}
                      <RenderedOperationCard
                        operation={step.rollback}
                        rollback
                        rollbackOnFailure={step.rollback_on_failure}
                      />
                    {:else}
                      <span
                        class="text-xs leading-5 text-muted-foreground/50"
                        aria-label={label("txWorkflowVisualNoRollback")}>—</span
                      >
                    {/if}
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </section>
  {/each}
  {#if workflow.blocks.length === 0}<p
      class="py-8 text-center text-sm text-muted-foreground"
    >
      {label("renderedCommandsEmpty")}
    </p>{/if}
</div>
