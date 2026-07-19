<script>
  import ArrowDownIcon from "@lucide/svelte/icons/arrow-down";
  import ArrowUpIcon from "@lucide/svelte/icons/arrow-up";
  import CopyIcon from "@lucide/svelte/icons/copy";
  import ListTreeIcon from "@lucide/svelte/icons/list-tree";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import { Button } from "$lib/components/ui/button/index.js";
  import { commandFlowAccentColor } from "../../modules/command/commandFlowAccentState.js";
  import CommandFlowSurface from "./CommandFlowSurface.svelte";

  let {
    addLabel = "",
    addStepPlacement = "header",
    description = "",
    duplicateLabel = "",
    emptyText = "",
    indexText = "",
    moveDownLabel = "",
    moveUpLabel = "",
    onAddStep,
    onDuplicateStep,
    onMoveStep,
    onRemoveStep,
    removeLabel = "",
    renderStep,
    stepRows = [],
    surfaceVariant = "section",
    title = "",
  } = $props();
</script>

{#snippet addStepAction()}
  <Button type="button" size="sm" onclick={onAddStep}>
    <PlusIcon data-icon="inline-start" />
    {addLabel}
  </Button>
{/snippet}

<CommandFlowSurface
  icon={ListTreeIcon}
  {indexText}
  {title}
  {description}
  variant={surfaceVariant}
  actions={addStepPlacement === "header" ? addStepAction : null}
>
  {#if stepRows.length === 0}
    <div
      class="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-6 text-center text-sm text-muted-foreground"
    >
      {emptyText}
    </div>
  {:else}
    <div class="grid min-w-0 gap-3">
      {#each stepRows as stepRow, stepPosition (stepRow.stepIndex)}
        {@const accentColor = commandFlowAccentColor(stepPosition)}
        <section
          data-command-flow-step
          style:--command-flow-accent={accentColor}
          class="command-flow-step-card grid min-w-0 gap-3 rounded-lg border border-border p-3"
        >
          <div
            class="flex min-w-0 flex-wrap items-center justify-between gap-2"
          >
            <span
              class="command-flow-step-label rounded-md px-2 py-1 text-xs font-semibold"
            >
              {stepRow.titleText}
            </span>
            <div class="flex flex-wrap items-center justify-end gap-2">
              {#if onMoveStep}
                <Button
                  class="min-h-11 min-w-11"
                  variant="ghost"
                  size="icon-sm"
                  type="button"
                  aria-label={moveUpLabel}
                  title={moveUpLabel}
                  disabled={stepPosition === 0}
                  onclick={() =>
                    onMoveStep(stepRow.stepIndex, stepPosition - 1)}
                >
                  <ArrowUpIcon />
                </Button>
                <Button
                  class="min-h-11 min-w-11"
                  variant="ghost"
                  size="icon-sm"
                  type="button"
                  aria-label={moveDownLabel}
                  title={moveDownLabel}
                  disabled={stepPosition === stepRows.length - 1}
                  onclick={() =>
                    onMoveStep(stepRow.stepIndex, stepPosition + 1)}
                >
                  <ArrowDownIcon />
                </Button>
              {/if}
              {#if onDuplicateStep}
                <Button
                  class="min-h-11 min-w-11"
                  variant="ghost"
                  size="icon-sm"
                  type="button"
                  aria-label={duplicateLabel}
                  title={duplicateLabel}
                  onclick={() => onDuplicateStep(stepRow.stepIndex)}
                >
                  <CopyIcon />
                </Button>
              {/if}
              <Button
                class="min-h-11 min-w-11"
                variant="destructive"
                size="icon-sm"
                type="button"
                aria-label={removeLabel}
                title={removeLabel}
                onclick={() => onRemoveStep(stepRow.stepIndex)}
              >
                <Trash2Icon />
              </Button>
            </div>
          </div>
          {@render renderStep({ ...stepRow, accentIndex: stepPosition })}
        </section>
      {/each}
    </div>
  {/if}

  {#if addStepPlacement === "footer"}
    <div class="flex min-w-0 flex-wrap items-center justify-end gap-2 pt-1">
      {@render addStepAction()}
    </div>
  {/if}
</CommandFlowSurface>

<style>
  .command-flow-step-card {
    border-left-width: 4px;
    border-left-color: var(--command-flow-accent);
    background: color-mix(in oklab, var(--command-flow-accent) 3%, var(--card));
  }

  .command-flow-step-label {
    color: color-mix(
      in oklab,
      var(--command-flow-accent) 76%,
      var(--foreground)
    );
    background: color-mix(
      in oklab,
      var(--command-flow-accent) 12%,
      transparent
    );
    box-shadow: inset 0 0 0 1px
      color-mix(in oklab, var(--command-flow-accent) 24%, transparent);
  }
</style>
