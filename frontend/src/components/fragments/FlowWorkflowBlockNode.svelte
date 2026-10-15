<script lang="ts">
  import ArrowDownIcon from "@lucide/svelte/icons/arrow-down";
  import ArrowUpIcon from "@lucide/svelte/icons/arrow-up";
  import BoxesIcon from "@lucide/svelte/icons/boxes";
  import CopyIcon from "@lucide/svelte/icons/copy";
  import ScissorsIcon from "@lucide/svelte/icons/scissors";
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

  const componentId = $props.id();

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

{#snippet commandCard(
  row: FlowWorkflowCommandRow,
  commandIndex: number,
  height: number,
)}
  <div
    data-flow-command-index={commandIndex}
    data-testid="flow-workflow-command"
    class={classNames(
      "flow-command-card nodrag nopan pointer-events-auto relative min-w-0 rounded transition-[box-shadow] motion-reduce:transition-none",
      row.selected && "ring-2 ring-primary/45 shadow-sm",
    )}
  >
    {#if row.onSelect}
      <button
        type="button"
        class="absolute inset-0 z-10 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`${row.kindText || t("txBlockFormCommand")} ${commandIndex + 1}: ${row.summaryText}`}
        aria-pressed={!!row.selected}
        onclick={(event) => {
          event.stopPropagation();
          row.onSelect?.();
        }}
      ></button>
    {/if}
    <div class="pointer-events-none min-w-0">
      {@render runCommand(row, commandIndex, height)}
    </div>
    {#if row.editable}
      <div
        role="group"
        aria-label={row.kindText || t("txBlockFormCommand")}
        class={classNames(
          "flow-command-actions pointer-events-auto absolute -top-3 right-1 z-20 flex items-center gap-0.5 rounded-md border border-border bg-background p-0.5 shadow-sm transition-opacity motion-reduce:transition-none",
          row.selected ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
      >
        <Button
          variant="ghost"
          size="icon-xs"
          type="button"
          title={row.movePreviousLabel}
          aria-label={row.movePreviousLabel}
          disabled={data.readonly || !row.canMovePrevious}
          onclick={(event) => runAction(event, row.onMovePrevious)}
          ><ArrowUpIcon /></Button
        >
        <Button
          variant="ghost"
          size="icon-xs"
          type="button"
          title={row.moveNextLabel}
          aria-label={row.moveNextLabel}
          disabled={data.readonly || !row.canMoveNext}
          onclick={(event) => runAction(event, row.onMoveNext)}
          ><ArrowDownIcon /></Button
        >
        <Button
          variant="ghost"
          size="icon-xs"
          type="button"
          title={row.duplicateLabel}
          aria-label={row.duplicateLabel}
          disabled={data.readonly}
          onclick={(event) => runAction(event, row.onDuplicate)}
          ><CopyIcon /></Button
        >
        {#if row.canSplit}
          <span class="inline-flex" title={row.splitHint}>
            <Button
              variant="ghost"
              size="icon-xs"
              type="button"
              aria-label={row.splitLabel}
              aria-describedby={`${componentId}-split-hint-${commandIndex}`}
              disabled={data.readonly || row.splitDisabled}
              onclick={(event) => runAction(event, row.onSplit)}
              ><ScissorsIcon /></Button
            >
            <span
              id={`${componentId}-split-hint-${commandIndex}`}
              class="sr-only">{row.splitHint}</span
            >
          </span>
        {/if}
        <Button
          variant="ghost"
          size="icon-xs"
          type="button"
          title={row.deleteLabel}
          aria-label={row.deleteLabel}
          disabled={data.readonly}
          class="text-destructive hover:text-destructive"
          onclick={(event) => runAction(event, row.onDelete)}
          ><Trash2Icon /></Button
        >
      </div>
    {/if}
  </div>
{/snippet}

{#snippet rollbackCard(
  command: string,
  kindText: string | undefined,
  onSelect: (() => void) | undefined,
  selected: boolean | undefined,
  height: number,
  commandIndex: number,
  whole = false,
)}
  <div
    data-testid="flow-workflow-rollback-command"
    data-flow-rollback-index={commandIndex}
    data-flow-whole-rollback={whole}
    class={classNames(
      "nodrag nopan pointer-events-auto relative min-w-0 rounded transition-[box-shadow] motion-reduce:transition-none",
      selected && "ring-2 ring-amber-500/50 shadow-sm",
    )}
  >
    {#if onSelect}
      <button
        type="button"
        class="absolute inset-0 z-10 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
        aria-label={`${t(whole ? "txBlockFormWholeRollback" : "txBlockStepRollbackCommand")} ${commandIndex + 1}: ${command || t("txWorkflowRollbackCommandEmpty")}`}
        aria-pressed={!!selected}
        onclick={(event) => {
          event.stopPropagation();
          onSelect();
        }}
      ></button>
    {/if}
    <div class="pointer-events-none min-w-0">
      <FlowCommandRow
        command={command || t("txWorkflowRollbackCommandEmpty")}
        {commandIndex}
        {height}
        {kindText}
        label={t(
          whole ? "txBlockFormWholeRollback" : "txBlockStepRollbackCommand",
        )}
        rollback
      />
    </div>
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
    data.commandsOnly
      ? "pointer-events-auto relative flex h-full w-full min-w-0 flex-col"
      : "flow-block-card pointer-events-auto relative flex h-full w-full min-w-0 flex-col rounded-lg border bg-background px-3 py-2 shadow-sm transition-[border-color,box-shadow] motion-reduce:transition-none",
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
  {#if !data.commandsOnly}
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
  {/if}
  <div
    class={classNames(
      "pointer-events-none relative min-w-0",
      !data.commandsOnly && "mt-2",
    )}
  >
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
      {#if hasRollback && !data.commandsOnly}
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
              {#if row.controlNode}
                <div style:height={`${flowWorkflowCommandPairHeight(row)}px`}>
                  <FlowWorkflowBlockNode data={row.controlNode} />
                </div>
              {:else}
                {@render commandCard(
                  row,
                  commandIndex,
                  flowWorkflowCommandPairHeight(row),
                )}
              {/if}
            {:else}
              {@render emptyCommand()}
            {/each}
          </div>
          {@render rollbackCard(
            data.wholeResourceRollback.summaryText,
            data.wholeResourceRollback.kindText,
            data.wholeResourceRollback.onSelect,
            data.wholeResourceRollback.selected,
            flowWorkflowCommandBodyHeight(data),
            0,
            true,
          )}
        </div>
      {:else}
        <div class="grid min-w-0 gap-1">
          {#each data.commandRows as row, commandIndex}
            {@const height = flowWorkflowCommandPairHeight(row)}
            {#if row.controlNode}
              <div style:height={`${height}px`}>
                <FlowWorkflowBlockNode data={row.controlNode} />
              </div>
            {:else}
              <div
                class={classNames(
                  "min-w-0",
                  hasRollback && "grid grid-cols-2 gap-2",
                )}
              >
                {@render commandCard(row, commandIndex, height)}
                {#if hasRollback}
                  {@render rollbackCard(
                    row.rollbackSummaryText || "",
                    row.rollbackKindText,
                    row.onSelectRollback,
                    row.rollbackSelected,
                    height,
                    commandIndex,
                  )}
                {/if}
              </div>
            {/if}
          {:else}
            {@render emptyCommand()}
          {/each}
        </div>
      {/if}
      {#if data.canAddCommand}
        <div class="nodrag nopan pointer-events-auto mt-3">
          <FlowWorkflowAddActions
            data={{
              readonly: data.readonly,
              canAddBlock: true,
              addBlockLabel: data.addCommandLabel || t("txWorkflowAddCommand"),
              onAddBlock: data.onAddCommand,
              addControlActions: data.addCommandControlActions,
            }}
          />
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

  .flow-command-card:hover .flow-command-actions,
  .flow-command-card:focus-within .flow-command-actions {
    opacity: 1;
    pointer-events: auto;
  }
</style>
