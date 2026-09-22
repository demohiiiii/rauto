<script
  lang="ts"
  generics="TStepRow extends { stepIndex: number; titleText: string }"
>
  import type { Snippet } from "svelte";
  import ArrowDownIcon from "@lucide/svelte/icons/arrow-down";
  import ArrowUpIcon from "@lucide/svelte/icons/arrow-up";
  import CopyIcon from "@lucide/svelte/icons/copy";
  import ListTreeIcon from "@lucide/svelte/icons/list-tree";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import { Button } from "$lib/components/ui/button/index.js";
  import { interactiveAccentColor } from "$domains/command/index.js";
  import CommandSurface from "./CommandSurface.svelte";

  type AddStepPlacement = "footer" | "header";
  type SurfaceVariant = "section" | "workbench-header" | "workbench-section";
  type RenderStepRow = TStepRow & { accentIndex: number };

  interface Props {
    studio?: boolean;
    addLabel?: string;
    addStepPlacement?: AddStepPlacement;
    description?: string;
    duplicateLabel?: string;
    emptyText?: string;
    indexText?: string;
    moveDownLabel?: string;
    moveUpLabel?: string;
    onAddStep: () => void;
    onDuplicateStep?: (stepIndex: number) => void;
    onMoveStep?: (fromIndex: number, toIndex: number) => void;
    onRemoveStep: (stepIndex: number) => void;
    removeLabel?: string;
    renderStep: Snippet<[RenderStepRow]>;
    stepRows?: TStepRow[];
    surfaceVariant?: SurfaceVariant;
    title?: string;
  }

  let {
    studio = false,
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
  }: Props = $props();
</script>

{#snippet addStepAction()}
  <Button
    type="button"
    size="sm"
    variant={studio ? "outline" : "default"}
    class={studio
      ? "h-11 w-full border-dashed border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
      : undefined}
    onclick={onAddStep}
  >
    <PlusIcon data-icon="inline-start" />
    {addLabel}
  </Button>
{/snippet}

<CommandSurface
  icon={ListTreeIcon}
  {indexText}
  {title}
  {description}
  variant={surfaceVariant}
  actions={addStepPlacement === "header" ? addStepAction : undefined}
>
  {#if stepRows.length === 0}
    <div
      class="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-6 text-center text-sm text-muted-foreground"
    >
      {emptyText}
    </div>
  {:else}
    <div
      class={studio
        ? "interactive-timeline grid min-w-0 gap-5"
        : "grid min-w-0 gap-3"}
    >
      {#each stepRows as stepRow, stepPosition (stepRow.stepIndex)}
        {@const accentColor = interactiveAccentColor(stepPosition)}
        <section
          data-interactive-step
          data-position={String(stepPosition + 1).padStart(2, "0")}
          class:studio-step={studio}
          style:--interactive-accent={accentColor}
          class="interactive-step-card grid min-w-0 gap-3 rounded-lg border border-border p-3"
        >
          <div
            class="flex min-w-0 flex-wrap items-center justify-between gap-2"
          >
            <span
              class="interactive-step-label rounded-md px-2 py-1 text-xs font-semibold"
            >
              {stepRow.titleText}
            </span>
            <div
              class={studio
                ? "flex flex-wrap items-center justify-end gap-0.5"
                : "flex flex-wrap items-center justify-end gap-2"}
            >
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
                class={studio
                  ? "min-h-11 min-w-11 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  : "min-h-11 min-w-11"}
                variant={studio ? "ghost" : "destructive"}
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
    <div
      class="flex min-w-0 flex-wrap items-center justify-end gap-2 pt-1"
      class:studio-add={studio}
    >
      {@render addStepAction()}
    </div>
  {/if}
</CommandSurface>

<style>
  .interactive-timeline {
    position: relative;
    padding-left: 2.25rem;
  }
  .interactive-timeline::before {
    content: "";
    position: absolute;
    left: 0.75rem;
    top: 1.5rem;
    bottom: 1.5rem;
    width: 1px;
    background: linear-gradient(var(--primary), var(--border));
    opacity: 0.4;
  }
  .interactive-step-card.studio-step {
    position: relative;
    border: 1px solid var(--border);
    border-radius: 0.875rem;
    padding: 0.875rem;
    background: var(--card);
    box-shadow: 0 2px 6px rgb(0 0 0 / 0.025);
    transition:
      border-color 180ms,
      box-shadow 180ms;
  }
  .studio-step:focus-within {
    border-color: color-mix(in oklab, var(--primary) 45%, var(--border));
    box-shadow: 0 0 0 3px color-mix(in oklab, var(--primary) 5%, transparent);
  }
  .studio-step::before {
    content: attr(data-position);
    position: absolute;
    top: 1.125rem;
    left: -2.25rem;
    display: grid;
    place-items: center;
    width: 1.5rem;
    height: 1.5rem;
    border: 1px solid color-mix(in oklab, var(--primary) 25%, var(--border));
    border-radius: 0.5rem;
    background: var(--card);
    color: var(--primary);
    font:
      600 10px ui-monospace,
      monospace;
  }
  .studio-step .interactive-step-label {
    color: var(--foreground);
    background: transparent;
    box-shadow: none;
    padding-left: 0;
  }
  .studio-add {
    padding-left: 2.25rem;
  }
  @media (max-width: 639px) {
    .interactive-timeline,
    .studio-add {
      padding-left: 0;
    }
    .interactive-timeline::before,
    .studio-step::before {
      display: none;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .interactive-step-card.studio-step {
      transition: none;
    }
  }
  .interactive-step-card {
    border-left-width: 4px;
    border-left-color: var(--interactive-accent);
    background: color-mix(in oklab, var(--interactive-accent) 3%, var(--card));
  }

  .interactive-step-label {
    color: color-mix(
      in oklab,
      var(--interactive-accent) 76%,
      var(--foreground)
    );
    background: color-mix(in oklab, var(--interactive-accent) 12%, transparent);
    box-shadow: inset 0 0 0 1px
      color-mix(in oklab, var(--interactive-accent) 24%, transparent);
  }
</style>
