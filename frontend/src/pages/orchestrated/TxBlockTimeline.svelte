<script>
  import ArrowDownIcon from "@lucide/svelte/icons/arrow-down";
  import ArrowUpIcon from "@lucide/svelte/icons/arrow-up";
  import CopyIcon from "@lucide/svelte/icons/copy";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import Settings2Icon from "@lucide/svelte/icons/settings-2";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import { Button } from "$lib/components/ui/button/index.js";
  import { tick } from "svelte";
  import { t } from "../../lib/i18n.js";
  import { classNames } from "../../lib/ui.js";

  let {
    display,
    selectRoot,
    selectStep,
    addStep,
    duplicateSelectedStep,
    moveSelectedStep,
    removeSelectedStep,
  } = $props();

  let confirmationStepIndex = $state(null);
  let confirmButton = $state(null);
  let deleteButton = $state(null);
  let timelineHost = $state(null);
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

  async function confirmDelete(stepIndex) {
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
      const selectedTarget = timelineHost.querySelector(
        '[aria-pressed="true"]',
      );
      if (selectedTarget?.isConnected) selectedTarget.focus();
    });
  }

  async function cancelDelete() {
    confirmationStepIndex = null;
    await tick();
    requestAnimationFrame(() => deleteButton?.focus());
  }
</script>

<section
  class="min-w-0"
  aria-label={t("txBlockTimelineTitle")}
  bind:this={timelineHost}
>
  <div class="mb-3 flex items-center justify-between gap-3">
    <div class="min-w-0">
      <h2 class="text-sm font-semibold text-foreground">
        {t("txBlockTimelineTitle")}
      </h2>
      <p class="mt-0.5 text-xs text-muted-foreground">
        {t("txBlockTimelineHint")}
      </p>
    </div>
    <Button
      variant="outline"
      size="icon-sm"
      type="button"
      class="min-h-11 min-w-11"
      title={t("txBlockTimelineAddStep")}
      aria-label={t("txBlockTimelineAddStep")}
      onclick={addStep}
    >
      <PlusIcon />
    </Button>
  </div>

  <div class="relative grid min-w-0 gap-2 pl-5">
    <span
      class="pointer-events-none absolute bottom-5 left-[0.4375rem] top-5 w-px bg-border"
      aria-hidden="true"
    ></span>

    <div class="relative min-w-0">
      <span
        class={classNames(
          "absolute -left-[1.125rem] top-4 size-2.5 rounded-full border-2 border-background",
          display.rootSelected ? "bg-primary" : "bg-muted-foreground/40",
        )}
        aria-hidden="true"
      ></span>
      <button
        type="button"
        class={classNames(
          "w-full rounded-xl border p-3 text-left transition-colors",
          display.rootSelected
            ? "border-primary/40 bg-primary/5 text-primary"
            : "border-transparent text-foreground hover:border-border hover:bg-muted/40",
        )}
        title={t("txBlockTimelineSelectRoot")}
        aria-pressed={display.rootSelected}
        onclick={selectRoot}
      >
        <span class="flex min-w-0 items-center gap-2">
          <Settings2Icon class="size-4 shrink-0" />
          <span class="min-w-0">
            <span class="block truncate text-sm font-semibold">
              {t("txBlockTimelineRoot")}
            </span>
            <span class="mt-0.5 block truncate text-xs text-muted-foreground">
              {t("txBlockTimelineRootHint")}
            </span>
          </span>
        </span>
      </button>
    </div>

    {#each display.stepRows as stepRow (stepRow.stepIndex)}
      {@const isConfirmingDelete = confirmationStepIndex === stepRow.stepIndex}
      <div class="relative min-w-0">
        <span
          class={classNames(
            "absolute -left-[1.125rem] top-4 size-2.5 rounded-full border-2 border-background",
            stepRow.selected ? "bg-primary" : "bg-muted-foreground/40",
          )}
          aria-hidden="true"
        ></span>
        <button
          type="button"
          class={classNames(
            "w-full rounded-xl border p-3 text-left transition-colors",
            stepRow.selected
              ? "border-primary/40 bg-primary/5 text-primary"
              : "border-transparent text-foreground hover:border-border hover:bg-muted/40",
          )}
          title={t("txBlockTimelineSelectStep")}
          aria-pressed={stepRow.selected}
          onclick={() => selectStep(stepRow.stepIndex)}
        >
          <span class="flex min-w-0 items-start justify-between gap-2">
            <span class="min-w-0">
              <span class="block truncate text-sm font-semibold">
                {stepRow.titleText}
              </span>
              <span class="mt-0.5 block truncate text-xs text-muted-foreground">
                {stepRow.summaryText}
              </span>
            </span>
            <span class="shrink-0 text-xs font-medium text-muted-foreground">
              {stepRow.kindText}
            </span>
          </span>
          <span class="mt-2 block text-xs text-muted-foreground">
            {stepRow.rollbackConfigured
              ? t("txBlockTimelineRollbackConfigured")
              : t("txBlockTimelineNoRollback")}
          </span>
        </button>

        {#if stepRow.selected}
          <div
            class="mt-1 flex min-h-11 min-w-0 flex-wrap items-center justify-end gap-2"
          >
            {#if isConfirmingDelete}
              <span
                class="mr-auto min-w-0 flex-1 basis-full text-xs leading-relaxed text-destructive sm:basis-auto"
                role="status"
                aria-live="polite"
              >
                {t("txBlockTimelineDeletePrompt")}
              </span>
              <Button
                variant="ghost"
                size="xs"
                type="button"
                class="min-h-11 min-w-11"
                onclick={cancelDelete}
              >
                {t("txBlockTimelineCancelDelete")}
              </Button>
              <Button
                variant="destructive"
                size="xs"
                type="button"
                class="min-h-11 min-w-11"
                bind:ref={confirmButton}
                onclick={() => confirmDelete(stepRow.stepIndex)}
              >
                {t("txBlockTimelineConfirmDelete")}
              </Button>
            {:else}
              <Button
                variant="ghost"
                size="icon-sm"
                type="button"
                class="min-h-11 min-w-11"
                title={t("txBlockTimelineMoveUp")}
                aria-label={t("txBlockTimelineMoveUp")}
                disabled={!stepRow.canMoveUp}
                onclick={() => moveSelectedStep(-1)}
              >
                <ArrowUpIcon />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                type="button"
                class="min-h-11 min-w-11"
                title={t("txBlockTimelineMoveDown")}
                aria-label={t("txBlockTimelineMoveDown")}
                disabled={!stepRow.canMoveDown}
                onclick={() => moveSelectedStep(1)}
              >
                <ArrowDownIcon />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                type="button"
                class="min-h-11 min-w-11"
                title={t("txBlockTimelineDuplicateStep")}
                aria-label={t("txBlockTimelineDuplicateStep")}
                onclick={duplicateSelectedStep}
              >
                <CopyIcon />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                type="button"
                class="min-h-11 min-w-11"
                bind:ref={deleteButton}
                title={t("txBlockTimelineDeleteStep")}
                aria-label={t("txBlockTimelineDeleteStep")}
                onclick={() => confirmDelete(stepRow.stepIndex)}
              >
                <Trash2Icon />
              </Button>
            {/if}
          </div>
        {/if}
      </div>
    {/each}
  </div>

  {#if display.stepRows.length === 0}
    <p class="mt-3 px-5 text-xs text-muted-foreground">
      {t("txBlockTimelineEmpty")}
    </p>
  {/if}
</section>
