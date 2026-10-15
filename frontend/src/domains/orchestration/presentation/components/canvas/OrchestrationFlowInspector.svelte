<script lang="ts">
  import { readable } from "svelte/store";
  import ReadonlyFields from "$components/fragments/ReadonlyFields.svelte";
  import ArrowDownIcon from "@lucide/svelte/icons/arrow-down";
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
  import ArrowRightIcon from "@lucide/svelte/icons/arrow-right";
  import ArrowUpIcon from "@lucide/svelte/icons/arrow-up";
  import CopyIcon from "@lucide/svelte/icons/copy";
  import PanelRightCloseIcon from "@lucide/svelte/icons/panel-right-close";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import { Button } from "$lib/components/ui/button/index.js";
  import { t } from "$lib/i18n.js";
  import TxWorkflowNodeEditor from "$domains/transactions/presentation/components/workflow/TxWorkflowNodeEditor.svelte";
  import {
    txWorkflowFindBlock,
    txBlockCommandTitle,
    txWorkflowNodeTitle,
  } from "$domains/transactions/index.js";
  import type {
    TxWorkflowFormModel,
    TransactionWorkflowCanvasWorkspace,
    TransactionBlockCanvasState,
  } from "$domains/transactions/index.js";
  import OrchestrationJobEditor from "$domains/orchestration/presentation/components/editor/OrchestrationJobEditor.svelte";
  import OrchestrationStageSettingsEditor from "$domains/orchestration/presentation/components/editor/OrchestrationStageSettingsEditor.svelte";

  import type {
    OrchestrationErrorChangeHandler,
    OrchestrationFlowSelection,
    OrchestrationPlanChangeHandler,
    OrchestrationPlanFormModel,
    OrchestrationVisualEditorDisplay,
    OrchestrationWorkflowPreview,
  } from "$domains/orchestration/index.js";

  interface Props {
    readonly?: boolean;
    canMoveNext?: boolean;
    canMovePrevious?: boolean;
    canMutateSelection?: boolean;
    model: OrchestrationPlanFormModel;
    onChange?: OrchestrationPlanChangeHandler | null;
    onCollapse?: () => void;
    onDelete?: () => void;
    onDuplicate?: () => void;
    onErrorChange?: OrchestrationErrorChangeHandler | null;
    onMoveNext?: () => void;
    onMovePrevious?: () => void;
    selection: OrchestrationFlowSelection;
    visualDisplay: OrchestrationVisualEditorDisplay;
    workflowPreview?: OrchestrationWorkflowPreview | null;
    workflowModel?: TxWorkflowFormModel | null;
    workflowWorkspace?: TransactionWorkflowCanvasWorkspace | null;
    onWorkflowModelChange?: (model: TxWorkflowFormModel) => void;
  }

  let {
    readonly = false,
    model,
    selection,
    visualDisplay,
    onChange,
    onErrorChange,
    onCollapse,
    onMovePrevious,
    onMoveNext,
    onDuplicate,
    onDelete,
    canMovePrevious = false,
    canMoveNext = false,
    canMutateSelection = true,
    workflowPreview = null,
    workflowModel = null,
    workflowWorkspace = null,
    onWorkflowModelChange = () => {},
  }: Props = $props();

  const emptySelectionStore = readable(null);
  const emptyBlockStatesStore = readable<
    Record<string, TransactionBlockCanvasState>
  >({});
  let commandSelectionStore = $derived(
    workflowWorkspace?.commandSelectionStateStore ?? emptySelectionStore,
  );
  let blockStatesStore = $derived(
    workflowWorkspace?.templates.canvasStateStore ?? emptyBlockStatesStore,
  );
  let stageRow = $derived(
    selection?.kind === "stage" ||
      selection?.kind === "job" ||
      selection?.kind === "workflow-block"
      ? visualDisplay.stageRows[selection.stageIndex] || null
      : null,
  );
  let jobRow = $derived(
    selection?.kind === "job" || selection?.kind === "workflow-block"
      ? stageRow?.jobRows?.[selection.jobIndex] || null
      : null,
  );
  let currentStage = $derived(model.stages[selection.stageIndex] || null);
  let selectedJobIndex = $derived(
    selection.kind === "stage" ? null : selection.jobIndex,
  );
  let selectedBlockIndex = $derived(
    selection.kind === "workflow-block" ? selection.blockIndex : null,
  );
  let currentJob = $derived(
    selectedJobIndex === null
      ? null
      : currentStage?.jobs[selectedJobIndex] || null,
  );
  let currentStageRow = $derived(
    stageRow && currentStage ? { ...stageRow, stage: currentStage } : stageRow,
  );
  let currentJobRow = $derived(
    jobRow && currentJob ? { ...jobRow, job: currentJob } : jobRow,
  );
  let selectedBlock = $derived(
    workflowModel && selection.kind === "workflow-block"
      ? selection.editorId
        ? txWorkflowFindBlock(workflowModel, selection.editorId)?.block
        : workflowModel.blocks[selection.blockIndex]
      : null,
  );
  let blockTitleText = $derived(
    selectedBlock
      ? txWorkflowNodeTitle(selectedBlock)
      : t("txWorkflowFormBlock"),
  );
  let titleText = $derived.by(() => {
    if (selection.kind === "workflow-block") {
      if (selection.operation === "whole_resource_rollback")
        return t("txBlockFormWholeRollback");
      if (selection.stepIndex !== undefined) {
        const states = $blockStatesStore;
        const selected = $commandSelectionStore;
        const block = selectedBlock
          ? (states[selectedBlock.editorId]?.formModel ??
            selectedBlock.inlineBlock)
          : null;
        return txBlockCommandTitle(
          block,
          selected &&
            selected.editorId === selectedBlock?.editorId &&
            selected.path[0] === selection.stepIndex
            ? selected.path
            : [selection.stepIndex],
          selection.operation,
        );
      }
      return blockTitleText;
    }
    return selection.kind === "job"
      ? currentJob?.name || jobRow?.titleText || t("orchestrationFormJob")
      : currentStage?.name ||
          stageRow?.titleText ||
          t("orchestrationFormStage");
  });
  let stagePositionText = $derived(
    t("orchestrationFlowStageSequence").replace(
      "{index}",
      String((selection?.stageIndex ?? 0) + 1),
    ),
  );
  let jobPositionText = $derived(
    t("orchestrationFlowJobSequence").replace(
      "{index}",
      String((selectedJobIndex ?? 0) + 1),
    ),
  );
  let blockPositionText = $derived(
    t("orchestrationFlowBlockSequence").replace(
      "{index}",
      String((selectedBlockIndex ?? 0) + 1),
    ),
  );
  let breadcrumbText = $derived(
    selection?.kind === "workflow-block"
      ? t("orchestrationFlowBlockInspectorBreadcrumb")
          .replace("{stage}", stagePositionText)
          .replace("{job}", jobPositionText)
          .replace("{block}", blockPositionText)
      : selection?.kind === "job"
        ? t("orchestrationFlowInspectorBreadcrumb")
            .replace("{stage}", stagePositionText)
            .replace("{job}", jobPositionText)
        : stagePositionText,
  );
</script>

<header class="border-b border-border bg-muted/20 p-3 sm:p-4">
  <div class="flex min-w-0 items-start justify-between gap-3">
    <div class="min-w-0">
      <div
        class="mb-1 text-[0.625rem] font-bold uppercase tracking-[0.16em] text-primary"
      >
        {breadcrumbText}
      </div>
      <div class="truncate text-sm font-semibold text-foreground">
        {titleText}
      </div>
      <div class="mt-0.5 text-xs text-muted-foreground">
        {selection?.kind === "workflow-block"
          ? t(
              workflowPreview?.sourceKind === "template"
                ? "orchestrationFlowTemplateBlockReadonlyHint"
                : "orchestrationFlowBlockSettingsHint",
            )
          : selection?.kind === "job"
            ? t("orchestrationJobSettingsHint")
            : t("orchestrationStageSettingsHint")}
      </div>
    </div>
    <div class="flex shrink-0 items-center gap-1">
      {#if canMutateSelection && !readonly}
        <Button
          variant="ghost"
          size="icon-sm"
          type="button"
          disabled={!canMovePrevious}
          title={t("orchestrationFlowMovePrevious")}
          aria-label={t("orchestrationFlowMovePrevious")}
          onclick={onMovePrevious}
        >
          {#if selection?.kind === "job"}<ArrowUpIcon />{:else}<ArrowLeftIcon
            />{/if}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          type="button"
          disabled={!canMoveNext}
          title={t("orchestrationFlowMoveNext")}
          aria-label={t("orchestrationFlowMoveNext")}
          onclick={onMoveNext}
        >
          {#if selection?.kind === "job"}<ArrowDownIcon />{:else}<ArrowRightIcon
            />{/if}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          type="button"
          title={t("orchestrationFlowDuplicate")}
          aria-label={t("orchestrationFlowDuplicate")}
          onclick={onDuplicate}><CopyIcon /></Button
        >
        <Button
          class="text-destructive hover:text-destructive"
          variant="ghost"
          size="icon-sm"
          type="button"
          title={t("deleteBtn")}
          aria-label={t("deleteBtn")}
          onclick={onDelete}><Trash2Icon /></Button
        >
      {/if}
      <Button
        variant="ghost"
        size="icon-sm"
        type="button"
        title={t("txWorkflowInspectorCollapse")}
        aria-label={t("txWorkflowInspectorCollapse")}
        onclick={onCollapse}><PanelRightCloseIcon /></Button
      >
    </div>
  </div>
</header>

<ReadonlyFields
  scopeOnly={selection?.kind === "workflow-block"}
  disabled={readonly}
  class="min-w-0 min-h-0 flex-1 overflow-y-auto p-3 sm:p-4"
>
  {#if selection?.kind === "stage" && currentStageRow}
    <OrchestrationStageSettingsEditor
      {model}
      stageRow={currentStageRow}
      {visualDisplay}
      {onChange}
    />
  {:else if selection?.kind === "job" && currentJobRow}
    <OrchestrationJobEditor
      {model}
      stageIndex={selection.stageIndex}
      jobRow={currentJobRow}
      {visualDisplay}
      {onChange}
      {onErrorChange}
      framed={false}
      showHeader={false}
    />
  {:else if selection?.kind === "workflow-block" && currentJobRow}
    {#if selectedBlock && workflowModel && workflowWorkspace}
      {#key selectedBlock.editorId}
        <TxWorkflowNodeEditor
          model={workflowModel}
          editorId={selectedBlock.editorId}
          workspace={workflowWorkspace}
          selectedStepIndex={selection.stepIndex ?? null}
          selectedOperation={selection.operation ?? "run"}
          readonly={readonly || workflowPreview?.sourceKind === "template"}
          onChange={onWorkflowModelChange}
        />
      {/key}
    {/if}
  {/if}
</ReadonlyFields>
