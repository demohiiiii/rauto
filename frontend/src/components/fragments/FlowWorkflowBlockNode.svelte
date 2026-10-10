<script lang="ts">
  import ArrowDownIcon from "@lucide/svelte/icons/arrow-down";
  import ArrowUpIcon from "@lucide/svelte/icons/arrow-up";
  import BoxesIcon from "@lucide/svelte/icons/boxes";
  import CopyIcon from "@lucide/svelte/icons/copy";
  import TerminalIcon from "@lucide/svelte/icons/terminal";
  import RepeatIcon from "@lucide/svelte/icons/repeat";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import GitBranchIcon from "@lucide/svelte/icons/git-branch";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import Undo2Icon from "@lucide/svelte/icons/undo-2";
  import { Handle, Position } from "@xyflow/svelte";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { classNames } from "$lib/ui.js";
  import { t } from "$lib/i18n.js";
  import FlowCommandRow from "./FlowCommandRow.svelte";
  import FlowWorkflowBlockNode from "./FlowWorkflowBlockNode.svelte";
  import FlowWorkflowAddActions from "./FlowWorkflowAddActions.svelte";
  import {
    flowWorkflowBlockHeight,
    flowWorkflowCommandBodyHeight,
    flowWorkflowCommandPairHeight,
    flowWorkflowHasRollback,
  } from "./flowWorkflowLayout.js";
  import type {
    FlowWorkflowBlockNodeData,
    FlowWorkflowCommandRow,
  } from "./flowWorkflowTypes.js";

  let {
    data,
    selected = false,
  }: {
    data: FlowWorkflowBlockNodeData;
    selected?: boolean;
  } = $props();

  let hasRollback = $derived(flowWorkflowHasRollback(data));
  let isLoop = $derived(data.structure?.kind === "loop");
  let isChoice = $derived(data.structure?.kind === "choice");
  let isSelected = $derived(selected || !!data.selected);
  let handleColor = $derived(
    isLoop
      ? "var(--color-indigo-500)"
      : isChoice
        ? "var(--color-orange-500)"
        : "var(--chart-2)",
  );

  function runAction(event: MouseEvent, action?: () => void): void {
    event.stopPropagation();
    if (!data.readonly) action?.();
  }

  function selectCard(event: MouseEvent): void {
    if (!data.onSelect) return;
    event.stopPropagation();
    data.onSelect();
  }
</script>

{#snippet runCommand(
  row: FlowWorkflowCommandRow,
  commandIndex: number,
  height?: number,
)}
  <FlowCommandRow
    command={row.summaryText}
    {commandIndex}
    {height}
    kindText={row.kindText}
    label={t("txBlockStepRunCommand")}
  />
{/snippet}

{#snippet emptyCommand()}
  <div class="h-6 text-xs text-muted-foreground">
    {data.emptyCommandText}
  </div>
{/snippet}

{#if data.hasTarget}
  <Handle
    id="block-input"
    type="target"
    position={Position.Top}
    isConnectable={false}
    style={`width:0.45rem;height:0.45rem;border:2px solid var(--background);background:${handleColor};`}
  />
{/if}

<div
  data-testid="flow-workflow-block-node"
  data-flow-block-id={data.id}
  role="group"
  aria-label={data.title}
  class={classNames(
    "flow-block-card pointer-events-auto relative flex h-full w-full min-w-0 flex-col rounded-lg border bg-background px-3 py-2 shadow-sm transition-[border-color,box-shadow] motion-reduce:transition-none",
    isLoop
      ? isSelected
        ? "border-indigo-500 bg-indigo-500/5 shadow-md ring-2 ring-indigo-500/15"
        : "border-indigo-500/40 bg-indigo-500/[0.035] hover:border-indigo-500/65"
      : isChoice
        ? isSelected
          ? "border-orange-500 bg-orange-500/5 shadow-md ring-2 ring-orange-500/15"
          : "border-orange-500/40 bg-orange-500/[0.035] hover:border-orange-500/65"
        : isSelected
          ? "border-chart-2 shadow-md ring-2 ring-chart-2/15"
          : data.sourceKind === "template"
            ? "border-amber-500/35"
            : "border-border hover:border-chart-2/45",
  )}
>
  {#if data.onSelect}
    <button
      type="button"
      class="absolute inset-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={data.title}
      aria-pressed={isSelected}
      onclick={selectCard}
    ></button>
  {/if}
  {#if data.editable}
    <div
      role="group"
      aria-label={data.title}
      class={classNames(
        "flow-block-actions nodrag nopan pointer-events-auto absolute right-1.5 top-1.5 z-20 flex items-center gap-0.5 rounded-md border border-border bg-background/95 p-0.5 shadow-sm backdrop-blur transition-opacity motion-reduce:transition-none",
        isSelected ? "opacity-100" : "opacity-0",
      )}
    >
      <Button
        variant="ghost"
        size="icon-xs"
        type="button"
        title={data.movePreviousLabel}
        aria-label={data.movePreviousLabel}
        disabled={data.readonly || !data.canMovePrevious}
        onclick={(event) => runAction(event, data.onMovePrevious)}
        ><ArrowUpIcon /></Button
      >
      <Button
        variant="ghost"
        size="icon-xs"
        type="button"
        title={data.moveNextLabel}
        aria-label={data.moveNextLabel}
        disabled={data.readonly || !data.canMoveNext}
        onclick={(event) => runAction(event, data.onMoveNext)}
        ><ArrowDownIcon /></Button
      >
      <Button
        variant="ghost"
        size="icon-xs"
        type="button"
        title={data.duplicateLabel}
        aria-label={data.duplicateLabel}
        disabled={data.readonly}
        onclick={(event) => runAction(event, data.onDuplicate)}
        ><CopyIcon /></Button
      >
      <Button
        variant="ghost"
        size="icon-xs"
        type="button"
        title={data.deleteLabel}
        aria-label={data.deleteLabel}
        disabled={data.readonly}
        class="text-destructive hover:text-destructive"
        onclick={(event) => runAction(event, data.onDelete)}
        ><Trash2Icon /></Button
      >
    </div>
  {/if}
  <div
    class={classNames(
      "pointer-events-none relative flex min-w-0 items-center gap-3",
      data.editable && "pr-[7.75rem]",
    )}
  >
    <span
      class={classNames(
        "flex size-8 shrink-0 items-center justify-center rounded-md",
        isLoop
          ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
          : isChoice
            ? "bg-orange-500/10 text-orange-700 dark:text-orange-300"
            : data.sourceKind === "template"
              ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
              : "bg-chart-2/10 text-chart-2",
      )}
    >
      {#if data.structure?.kind === "loop"}<RepeatIcon class="size-4" />
      {:else if data.structure?.kind === "choice"}<GitBranchIcon
          class="size-4"
        />
      {:else}<BoxesIcon class="size-4" />{/if}
    </span>
    <span class="flex min-w-0 flex-1 items-center gap-2">
      <Badge variant="secondary">{data.sequenceText}</Badge>
      <span
        class="truncate text-xs font-semibold text-foreground"
        title={data.title}>{data.title}</span
      >
    </span>
  </div>
  {#if data.metaText}
    <div
      class="pointer-events-none relative mt-1.5 truncate text-[0.6875rem] text-muted-foreground"
      title={data.metaText}
    >
      {data.metaText}
    </div>
  {/if}
  <div class="pointer-events-none relative mt-2 min-w-0">
    {#if data.structure}
      <div class="grid min-w-0 gap-2">
        {#each data.structure.branches as branch (branch.id)}
          <div
            data-testid="flow-workflow-branch"
            data-flow-branch-id={branch.id}
            class={classNames(
              "min-w-0 rounded-md border p-2",
              isLoop
                ? "border-indigo-500/20 bg-indigo-500/5"
                : branch.conditionText !== undefined
                  ? "border-orange-500/25 bg-orange-500/5"
                  : "border-orange-500/15 bg-muted/30",
            )}
          >
            <div
              class={classNames(
                "flex min-w-0 items-center justify-between gap-2 text-[0.625rem] font-medium leading-4",
                isLoop ? "h-4" : "h-6",
                isLoop
                  ? "text-indigo-600 dark:text-indigo-400"
                  : "text-orange-700 dark:text-orange-300",
              )}
            >
              <span class="truncate">{branch.title}</span>
              {#if branch.editable}
                <div
                  class="nodrag nopan pointer-events-auto flex shrink-0 items-center gap-0.5"
                >
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    type="button"
                    aria-label={branch.movePreviousLabel}
                    title={branch.movePreviousLabel}
                    disabled={data.readonly || !branch.canMovePrevious}
                    onclick={(event) => runAction(event, branch.onMovePrevious)}
                    ><ArrowUpIcon /></Button
                  >
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    type="button"
                    aria-label={branch.moveNextLabel}
                    title={branch.moveNextLabel}
                    disabled={data.readonly || !branch.canMoveNext}
                    onclick={(event) => runAction(event, branch.onMoveNext)}
                    ><ArrowDownIcon /></Button
                  >
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    type="button"
                    aria-label={branch.deleteLabel}
                    title={branch.deleteLabel}
                    disabled={data.readonly || !branch.canDelete}
                    class="text-destructive hover:text-destructive"
                    onclick={(event) => runAction(event, branch.onDelete)}
                    ><Trash2Icon /></Button
                  >
                </div>
              {/if}
            </div>
            {#if branch.conditionText !== undefined}
              <Input
                class="nodrag nopan pointer-events-auto mt-2 h-8 border-orange-500/20 bg-background/80 font-mono text-xs focus-visible:border-orange-500/50 focus-visible:ring-orange-500/15"
                aria-label={`${branch.title} · ${branch.conditionLabel}`}
                value={branch.conditionText}
                disabled={data.readonly || !branch.onChangeCondition}
                onpointerdown={(event) => event.stopPropagation()}
                onclick={(event) => event.stopPropagation()}
                onkeydown={(event) => event.stopPropagation()}
                oninput={(event) => {
                  if (!data.readonly)
                    branch.onChangeCondition?.(event.currentTarget.value);
                }}
              />
            {/if}
            <div class="mt-2 grid min-w-0 gap-2">
              {#each branch.entries as entry, entryIndex (entry.id ?? entryIndex)}
                <div
                  class="min-w-0"
                  style:height={`${flowWorkflowBlockHeight(entry)}px`}
                >
                  <FlowWorkflowBlockNode data={entry} />
                </div>
              {:else}<div
                  class="h-5 truncate text-[0.6875rem] text-muted-foreground"
                >
                  {branch.emptyText}
                </div>{/each}
            </div>
            {#if branch.canAddBlock && branch.addBlockLabel}
              <div class="pointer-events-auto mt-2">
                <FlowWorkflowAddActions
                  data={{
                    ...branch,
                    addBlockLabel: branch.addBlockLabel,
                    readonly: data.readonly,
                  }}
                />
              </div>
            {/if}
          </div>
        {/each}
      </div>
      {#if data.structure.canAddBranch}
        <Button
          variant="outline"
          size="sm"
          type="button"
          class="nodrag nopan pointer-events-auto mt-2 w-full border-dashed border-orange-500/30 text-orange-700 hover:bg-orange-500/10 dark:text-orange-300"
          disabled={data.readonly}
          onclick={(event) => runAction(event, data.structure?.onAddBranch)}
          ><PlusIcon data-icon="inline-start" />{data.structure
            .addBranchLabel}</Button
        >
      {/if}
    {:else}
      {#if hasRollback}
        <div
          class="mb-2 grid h-4 min-w-0 grid-cols-2 gap-2 text-[0.625rem] font-medium"
        >
          <span class="flex min-w-0 items-center gap-1 text-primary">
            <TerminalIcon class="size-3 shrink-0" aria-hidden="true" />
            <span class="truncate">{t("txBlockStepRunCommand")}</span>
          </span>
          <span
            class="flex min-w-0 items-center gap-1 text-amber-700 dark:text-amber-300"
          >
            <Undo2Icon class="size-3 shrink-0" aria-hidden="true" />
            <span class="truncate"
              >{t(
                data.wholeResourceRollback
                  ? "txBlockFormWholeRollback"
                  : "txBlockStepRollbackCommand",
              )}</span
            >
          </span>
        </div>
      {/if}
      {#if data.wholeResourceRollback}
        <div class="grid min-w-0 grid-cols-2 items-start gap-2">
          <div class="grid min-w-0 gap-1">
            {#each data.commandRows as row, commandIndex}
              {@render runCommand(row, commandIndex)}
            {:else}
              {@render emptyCommand()}
            {/each}
          </div>
          <FlowCommandRow
            command={data.wholeResourceRollback.summaryText}
            commandIndex={0}
            height={flowWorkflowCommandBodyHeight(data)}
            kindText={data.wholeResourceRollback.kindText}
            label={t("txBlockStepRollbackCommand")}
            rollback
          />
        </div>
      {:else}
        <div class="grid min-w-0 gap-1">
          {#each data.commandRows as row, commandIndex}
            {@const height = flowWorkflowCommandPairHeight(row)}
            <div
              class={hasRollback ? "grid min-w-0 grid-cols-2 gap-2" : "min-w-0"}
            >
              {@render runCommand(row, commandIndex, height)}
              {#if hasRollback}
                {#if row.rollbackSummaryText}
                  <FlowCommandRow
                    command={row.rollbackSummaryText}
                    {commandIndex}
                    {height}
                    kindText={row.rollbackKindText}
                    label={t("txBlockStepRollbackCommand")}
                    rollback
                  />
                {:else}
                  <div
                    class="flex min-w-0 items-center justify-center rounded border border-dashed border-border bg-muted/20 px-2 text-[0.625rem] text-muted-foreground"
                    style:height={`${height}px`}
                    title={t("txWorkflowVisualNoRollback")}
                  >
                    <span class="truncate"
                      >{t("txWorkflowVisualNoRollback")}</span
                    >
                  </div>
                {/if}
              {/if}
            </div>
          {:else}
            {@render emptyCommand()}
          {/each}
        </div>
      {/if}
    {/if}
  </div>
</div>

{#if data.hasSource}
  <Handle
    id="block-output"
    type="source"
    position={Position.Bottom}
    isConnectable={false}
    style={`width:0.45rem;height:0.45rem;border:2px solid var(--background);background:${handleColor};`}
  />
{/if}

<style>
  .flow-block-card:hover > .flow-block-actions,
  .flow-block-card:focus-within > .flow-block-actions {
    opacity: 1;
  }
</style>
