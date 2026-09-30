<script lang="ts">
  import { getContext, onDestroy } from "svelte";
  import { MediaQuery } from "svelte/reactivity";
  import { readonlyFieldsContextKey } from "$lib/svelte.js";
  import ArrowRightIcon from "@lucide/svelte/icons/arrow-right";
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
  import CopyIcon from "@lucide/svelte/icons/copy";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import { Button } from "$lib/components/ui/button/index.js";
  import { tick } from "svelte";
  import { t } from "$lib/i18n.js";
  import type { txBlockTimelineDisplay } from "$domains/transactions/index.js";

  type TimelineDisplay = ReturnType<typeof txBlockTimelineDisplay>;
  type TimelineStepRow = TimelineDisplay["stepRows"][number] & {
    selected: boolean;
  };

  interface Props {
    addStep: () => boolean;
    display: Omit<TimelineDisplay, "stepRows"> & {
      stepRows: TimelineStepRow[];
    };
    duplicateSelectedStep: () => boolean;
    moveSelectedStep: (delta: number) => boolean;
    removeSelectedStep: () => boolean;
    selectStep: (stepIndex: number) => boolean;
  }

  let {
    display,
    selectStep,
    addStep,
    duplicateSelectedStep,
    moveSelectedStep,
    removeSelectedStep,
  }: Props = $props();

  const reducedMotion = new MediaQuery("(prefers-reduced-motion: reduce)");
  const stepAnimations = new Map<HTMLButtonElement, Animation>();
  let pendingMove = false;
  let destroyed = false;

  function animateStep(node: HTMLButtonElement, from: number): void {
    stepAnimations.get(node)?.cancel();
    const animation = node.animate(
      [
        { transform: `translateX(${from - node.offsetLeft}px)` },
        { transform: "translateX(0)" },
      ],
      { duration: 280, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
    );
    stepAnimations.set(node, animation);
    animation.onfinish = () => {
      if (stepAnimations.get(node) === animation) stepAnimations.delete(node);
    };
  }

  async function moveStep(delta: -1 | 1): Promise<void> {
    if (readonly || pendingMove || selectedStepIndex === null || !stepRail)
      return;
    const fromIndex = selectedStepIndex;
    const toIndex = fromIndex + delta;
    const nodes = stepRail.querySelectorAll<HTMLButtonElement>(
      "[data-timeline-step]",
    );
    const fromNode = nodes[fromIndex];
    const toNode = nodes[toIndex];
    if (!fromNode || !toNode) return;
    // Measure in rail coordinates so scrolling and interrupted animations stay aligned.
    const railLeft = stepRail.getBoundingClientRect().left;
    const fromLeft =
      fromNode.getBoundingClientRect().left - railLeft + stepRail.scrollLeft;
    const toLeft =
      toNode.getBoundingClientRect().left - railLeft + stepRail.scrollLeft;
    pendingMove = true;
    try {
      if (!moveSelectedStep(delta)) return;
      await tick();
      if (destroyed || !stepRail?.isConnected) return;
      if (reducedMotion.current) {
        for (const animation of stepAnimations.values()) animation.cancel();
        stepAnimations.clear();
        return;
      }
      const nextNodes = stepRail.querySelectorAll<HTMLButtonElement>(
        "[data-timeline-step]",
      );
      if (nextNodes[toIndex] && nextNodes[fromIndex]) {
        animateStep(nextNodes[toIndex], fromLeft);
        animateStep(nextNodes[fromIndex], toLeft);
      }
    } finally {
      pendingMove = false;
    }
  }

  onDestroy(() => {
    destroyed = true;
    for (const animation of stepAnimations.values()) animation.cancel();
    stepAnimations.clear();
  });

  let confirmationStepIndex = $state<number | null>(null);
  let confirmButton = $state<HTMLButtonElement | null>(null);
  let deleteButton = $state<HTMLButtonElement | null>(null);
  let timelineHost = $state<HTMLElement | null>(null);
  let stepRail = $state<HTMLDivElement | null>(null);
  let selectedStepRow = $derived(display.stepRows.find((row) => row.selected));
  $effect(() => {
    selectedStepIndex;
    void tick().then(() => {
      if (!stepRail?.isConnected) return;
      const selected = stepRail.querySelector<HTMLElement>(
        '[aria-pressed="true"]',
      );
      if (!selected) return;
      const start = selected.offsetLeft;
      const end = start + selected.offsetWidth;
      if (start < stepRail.scrollLeft) stepRail.scrollTo({ left: start });
      else if (end > stepRail.scrollLeft + stepRail.clientWidth)
        stepRail.scrollTo({ left: end - stepRail.clientWidth });
    });
  });
  let selectedStepIndex = $derived(
    display.stepRows.find((stepRow) => stepRow.selected)?.stepIndex ?? null,
  );

  $effect(() => {
    if (
      confirmationStepIndex !== null &&
      confirmationStepIndex !== selectedStepIndex
    ) {
      confirmationStepIndex = null;
    }
  });

  async function confirmDelete(stepIndex: number): Promise<void> {
    if (confirmationStepIndex !== stepIndex) {
      confirmationStepIndex = stepIndex;
      await tick();
      requestAnimationFrame(() => {
        if (confirmationStepIndex === stepIndex) confirmButton?.focus();
      });
      return;
    }
    const removed = removeSelectedStep();
    confirmationStepIndex = null;
    if (!removed) return;

    await tick();
    requestAnimationFrame(() => {
      if (!timelineHost?.isConnected) return;
      const activeElement = timelineHost.ownerDocument.activeElement;
      if (
        activeElement?.isConnected &&
        activeElement !== timelineHost.ownerDocument.body
      ) {
        return;
      }
      const selectedTarget = timelineHost.querySelector<HTMLButtonElement>(
        '[aria-pressed="true"]',
      );
      if (selectedTarget?.isConnected) selectedTarget.focus();
    });
  }

  async function cancelDelete(): Promise<void> {
    confirmationStepIndex = null;
    await tick();
    requestAnimationFrame(() => deleteButton?.focus());
  }
  const inheritedReadonly = getContext<(() => boolean) | undefined>(
    readonlyFieldsContextKey,
  );
  let readonly = $derived(!!inheritedReadonly?.());
</script>

<section
  class="min-w-0"
  aria-label={t("txBlockTimelineTitle")}
  bind:this={timelineHost}
>
  <div class="mb-2 flex items-center justify-between gap-3">
    <div class="flex items-center gap-2">
      <h2 class="text-xs font-semibold text-muted-foreground">
        {t("txBlockTimelineTitle")}
      </h2>
      <span
        class="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground"
        >{display.stepRows.length}</span
      >
    </div>
    <Button
      disabled={readonly}
      variant="ghost"
      size="icon-sm"
      type="button"
      title={t("txBlockTimelineAddStep")}
      aria-label={t("txBlockTimelineAddStep")}
      onclick={addStep}
    >
      <PlusIcon />
    </Button>
  </div>
  <div class="step-rail" bind:this={stepRail}>
    {#each display.stepRows as stepRow (stepRow.stepIndex)}
      <button
        type="button"
        class="step-stop"
        class:selected={stepRow.selected}
        data-timeline-step={stepRow.stepIndex}
        title={t("txBlockTimelineSelectStep")}
        aria-pressed={stepRow.selected}
        onclick={() => selectStep(stepRow.stepIndex)}
      >
        <span class="step-caption" title={stepRow.titleText}>
          <span class="truncate font-mono">{stepRow.titleText}</span>
        </span>
        <span class="step-summary">{stepRow.kindText}</span>
      </button>
    {/each}
  </div>
  {#if selectedStepRow}
    <div
      class="mt-2 flex min-w-0 flex-wrap items-center justify-end gap-1 rounded-lg bg-muted/30 px-2 py-1"
    >
      <span class="mr-auto min-w-0 text-[11px] text-muted-foreground"
        >{selectedStepRow.rollbackConfigured
          ? t("txBlockTimelineRollbackConfigured")
          : t("txBlockTimelineNoRollback")}</span
      >
      {#if confirmationStepIndex === selectedStepRow.stepIndex}
        <span
          class="mr-auto min-w-0 basis-full text-xs leading-relaxed text-destructive"
          role="status"
          aria-live="polite"
        >
          {t("txBlockTimelineDeletePrompt")}
        </span>
        <Button
          disabled={readonly}
          variant="ghost"
          size="xs"
          type="button"
          onclick={cancelDelete}
        >
          {t("txBlockTimelineCancelDelete")}
        </Button>
        <Button
          disabled={readonly}
          variant="destructive"
          size="xs"
          type="button"
          bind:ref={confirmButton}
          onclick={() => confirmDelete(selectedStepRow.stepIndex)}
        >
          {t("txBlockTimelineConfirmDelete")}
        </Button>
      {:else}
        <Button
          variant="ghost"
          size="icon-sm"
          type="button"
          title={t("txBlockTimelineMoveLeft")}
          aria-label={t("txBlockTimelineMoveLeft")}
          disabled={readonly || !selectedStepRow.canMoveUp}
          onclick={() => moveStep(-1)}
        >
          <ArrowLeftIcon />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          type="button"
          title={t("txBlockTimelineMoveRight")}
          aria-label={t("txBlockTimelineMoveRight")}
          disabled={readonly || !selectedStepRow.canMoveDown}
          onclick={() => moveStep(1)}
        >
          <ArrowRightIcon />
        </Button>
        <Button
          disabled={readonly}
          variant="ghost"
          size="icon-sm"
          type="button"
          title={t("txBlockTimelineDuplicateStep")}
          aria-label={t("txBlockTimelineDuplicateStep")}
          onclick={duplicateSelectedStep}
        >
          <CopyIcon />
        </Button>
        <Button
          disabled={readonly}
          variant="ghost"
          size="icon-sm"
          type="button"
          bind:ref={deleteButton}
          title={t("txBlockTimelineDeleteStep")}
          aria-label={t("txBlockTimelineDeleteStep")}
          onclick={() => confirmDelete(selectedStepRow.stepIndex)}
        >
          <Trash2Icon />
        </Button>
      {/if}
    </div>
  {/if}
  {#if display.stepRows.length === 0}
    <p class="mt-2 text-xs text-muted-foreground">
      {t("txBlockTimelineEmpty")}
    </p>
  {/if}
</section>

<style>
  .step-rail {
    position: relative;
    display: flex;
    min-width: 0;
    gap: 0.5rem;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    padding: 0.125rem 0.125rem 0.5rem;
    scrollbar-width: thin;
    scrollbar-color: var(--border) transparent;
    scroll-behavior: smooth;
  }
  .step-stop {
    flex: 0 0 10rem;
    min-width: 0;
    padding: 0.625rem 0.75rem;
    text-align: left;
    border: 1px solid var(--border);
    border-radius: 0.75rem;
    background: var(--background);
    color: var(--foreground);
    transition:
      background 160ms,
      border-color 160ms;
  }
  .step-stop:hover {
    background: var(--muted);
  }
  .step-stop.selected {
    position: relative;
    z-index: 1;
    border-color: color-mix(in oklab, var(--primary) 40%, var(--border));
    background: color-mix(in oklab, var(--primary) 8%, var(--background));
    color: var(--primary);
  }
  .step-stop:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: -2px;
  }
  .step-caption {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    min-width: 0;
    font-size: 0.75rem;
    font-weight: 600;
  }
  .step-summary {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-top: 0.375rem;
    color: var(--muted-foreground);
    font-size: 0.6875rem;
  }
  @media (prefers-reduced-motion: reduce) {
    .step-rail {
      scroll-behavior: auto;
    }
    .step-stop {
      transition: none;
    }
  }
</style>
