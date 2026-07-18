<script>
  import BracesIcon from "@lucide/svelte/icons/braces";
  import EyeIcon from "@lucide/svelte/icons/eye";
  import GripVerticalIcon from "@lucide/svelte/icons/grip-vertical";
  import PanelRightOpenIcon from "@lucide/svelte/icons/panel-right-open";
  import PanelTopCloseIcon from "@lucide/svelte/icons/panel-top-close";
  import PanelTopOpenIcon from "@lucide/svelte/icons/panel-top-open";
  import PlayIcon from "@lucide/svelte/icons/play";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import {
    Background,
    BackgroundVariant,
    Controls,
    MarkerType,
    Panel,
    SvelteFlow,
  } from "@xyflow/svelte";
  import "@xyflow/svelte/dist/style.css";
  import { onDestroy, onMount } from "svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import LoadingButton from "../../components/fragments/LoadingButton.svelte";
  import { previewTxWorkflowTemplate } from "../../api/client.js";
  import { currentLanguageState, t } from "../../lib/i18n.js";
  import { classNames } from "../../lib/ui.js";
  import {
    orchestrationFlowGraph,
    orchestrationNormalizeFlowSelection,
  } from "../../modules/orchestrationFlowCanvasState.js";
  import {
    orchestrationInlineWorkflowPreview,
    createOrchestrationWorkflowPreviewWorkspace,
  } from "../../modules/orchestrationWorkflowPreviewState.js";
  import { orchestrationUpdateInlineWorkflow } from "../../modules/orchestrationTxWorkflowActions.js";
  import {
    orchestrationAddJob,
    orchestrationDuplicateJob,
    orchestrationDuplicateStage,
    orchestrationInsertStage,
    orchestrationMoveJob,
    orchestrationMoveStage,
    orchestrationRemoveJob,
    orchestrationRemoveStage,
  } from "../../modules/orchestrationStageMutations.js";
  import { TX_VARS } from "../../modules/transactionPanelState.js";
  import {
    txWorkflowAddBlock,
    txWorkflowDuplicateBlock,
    txWorkflowMoveBlock,
    txWorkflowRemoveBlock,
  } from "../../modules/transactionWorkflowEditorState.js";
  import {
    txWorkflowFormModelFromJson,
    txWorkflowFormModelToJsonText,
  } from "../../modules/transactionWorkflowFormModels.js";
  import OrchestrationFlowInspector from "./OrchestrationFlowInspector.svelte";
  import OrchestrationFlowJobNode from "./OrchestrationFlowJobNode.svelte";
  import OrchestrationFlowStageInsertNode from "./OrchestrationFlowStageInsertNode.svelte";
  import OrchestrationFlowStageNode from "./OrchestrationFlowStageNode.svelte";
  import OrchestrationFlowViewportController from "./OrchestrationFlowViewportController.svelte";
  import OrchestrationFlowWorkflowBlockNode from "./OrchestrationFlowWorkflowBlockNode.svelte";
  import OrchestrationPlanSettingsEditor from "./OrchestrationPlanSettingsEditor.svelte";
  import TxDirectVarsPanel from "./TxDirectVarsPanel.svelte";

  let {
    active,
    model,
    visualDisplay,
    onChange,
    onErrorChange,
    onOpenView,
    onExecute,
    runButtonDisplay = {},
  } = $props();

  const nodeTypes = {
    stage: OrchestrationFlowStageNode,
    stageInsert: OrchestrationFlowStageInsertNode,
    job: OrchestrationFlowJobNode,
    workflowBlock: OrchestrationFlowWorkflowBlockNode,
  };
  const directVarsKey = TX_VARS.orchestrationDirect;
  const workflowPreviewWorkspace = createOrchestrationWorkflowPreviewWorkspace({
    previewTemplate: (name, vars) => previewTxWorkflowTemplate(name, vars),
  });
  let currentLanguage = $derived($currentLanguageState);
  let selection = $state(null);
  let planCollapsed = $state(true);
  let inspectorCollapsed = $state(true);
  let inspectorWidth = $state(520);
  let compactCanvas = $state(
    typeof window !== "undefined" &&
      window.matchMedia("(max-width: 1023px)").matches,
  );
  let canvasHost = $state(null);
  let inspectorResizeCleanup = null;
  let stages = $derived(Array.isArray(model?.stages) ? model.stages : []);
  let workflowPreviews = $state({});
  let previewRequestRevision = 0;
  let baseGraph = $derived(orchestrationFlowGraph(model, workflowPreviews));
  let graphLayoutRevision = $derived(
    baseGraph.nodes
      .map((node) => `${node.id}:${node.width || 0}:${node.height || 0}`)
      .join("|"),
  );
  let focusStageNodeId = $derived(
    selection ? `stage-${selection.stageIndex}` : "",
  );
  let stageCountText = $derived.by(() => {
    currentLanguage;
    return t("orchestrationFlowStageCount").replace(
      "{count}",
      String(stages.length),
    );
  });
  let topWindowOpen = $derived(!planCollapsed);
  $effect(() => {
    const revision = ++previewRequestRevision;
    const templateJobs = stages.flatMap((stage, stageIndex) =>
      (stage.jobs || []).flatMap((job, jobIndex) => {
        const workflow = job?.action?.txWorkflow || {};
        const name = String(workflow.workflowTemplateName || "").trim();
        return name
          ? [
              {
                key: `${stageIndex}:${jobIndex}`,
                name,
                vars: workflow.workflowVars || {},
              },
            ]
          : [];
      }),
    );
    workflowPreviews = Object.fromEntries(
      templateJobs.map(({ key, name }) => [
        key,
        {
          sourceKind: "template",
          sourceName: name,
          previewStatus: "loading",
          workflowName: "Template preview",
          blockCount: 0,
          rows: [],
          overflowCount: 0,
          unresolvedCount: 0,
          errorMessage: "",
        },
      ]),
    );
    Promise.all(
      templateJobs.map(async ({ key, name, vars }) => [
        key,
        await workflowPreviewWorkspace.previewTemplate(name, vars),
      ]),
    ).then((entries) => {
      if (revision === previewRequestRevision) {
        workflowPreviews = Object.fromEntries(entries);
      }
    });
  });
  let graphNodes = $derived.by(() => {
    currentLanguage;
    const compactStagePositions = new Map();
    let compactStageY = 96;
    if (compactCanvas) {
      const compactStageNodes = baseGraph.nodes.filter(
        (node) => node.data.kind === "stage",
      );
      if (compactStageNodes.length === 0) {
        compactStagePositions.set("stage-insert-0", { x: 138, y: 180 });
      }
      for (const stageNode of compactStageNodes) {
        compactStagePositions.set(stageNode.id, { x: 0, y: compactStageY });
        compactStageY += (stageNode.height || 220) + 28;
        compactStagePositions.set(
          `stage-insert-${stageNode.data.stageIndex + 1}`,
          { x: 138, y: compactStageY },
        );
        compactStageY += 100;
      }
    }
    return baseGraph.nodes.map((node) => {
      if (node.data.kind === "stage") {
        const stageIndex = node.data.stageIndex;
        const jobCount = stages[stageIndex]?.jobs?.length || 0;
        return {
          ...node,
          position: compactStagePositions.get(node.id) || node.position,
          selected:
            selection?.kind === "stage" && selection.stageIndex === stageIndex,
          data: {
            ...node.data,
            vertical: compactCanvas,
            sequenceText: t("orchestrationFlowStageSequence").replace(
              "{index}",
              String(stageIndex + 1),
            ),
            strategyText: t(
              node.data.strategy === "parallel"
                ? "orchestrationStrategyParallel"
                : "orchestrationStrategySerial",
            ),
            jobCountText: t("orchestrationFlowJobCount").replace(
              "{count}",
              String(jobCount),
            ),
            canMovePrevious: stageIndex > 0,
            canMoveNext: stageIndex < stages.length - 1,
            movePreviousLabel: t("orchestrationFlowMoveStageLeft"),
            moveNextLabel: t("orchestrationFlowMoveStageRight"),
            addJobLabel: t("orchestrationFormAddJob"),
            emptyHintText: t("orchestrationFlowEmptyStageHint"),
            duplicateLabel: t("orchestrationFlowDuplicateStage"),
            deleteLabel: t("orchestrationFlowDeleteStage"),
            onMovePrevious: () => moveStage(stageIndex, stageIndex - 1),
            onMoveNext: () => moveStage(stageIndex, stageIndex + 1),
            onAddJob: () => addJob(stageIndex),
            onDuplicate: () => duplicateStage(stageIndex),
            onDelete: () => removeStage(stageIndex),
          },
        };
      }
      if (node.data.kind === "stage-insert") {
        return {
          ...node,
          position: compactStagePositions.get(node.id) || node.position,
          data: {
            ...node.data,
            vertical: compactCanvas,
            labelText: t("orchestrationFlowInsertStage"),
            onInsertStage: () => insertStage(node.data.insertIndex),
          },
        };
      }
      if (node.data.kind === "workflow-block") {
        const { stageIndex, jobIndex, blockIndex } = node.data;
        const blockCount = node.parentId
          ? baseGraph.nodes.filter(
              (candidate) =>
                candidate.data.kind === "workflow-block" &&
                candidate.parentId === node.parentId,
            ).length
          : 0;
        const editable = node.data.sourceKind === "manual";
        return {
          ...node,
          selected:
            selection?.kind === "workflow-block" &&
            selection.stageIndex === node.data.stageIndex &&
            selection.jobIndex === node.data.jobIndex &&
            selection.blockIndex === node.data.blockIndex,
          data: {
            ...node.data,
            sequenceText: String(blockIndex + 1),
            editable,
            canMovePrevious: editable && blockIndex > 0,
            canMoveNext: editable && blockIndex < blockCount - 1,
            movePreviousLabel: t("orchestrationFlowMoveBlockUp"),
            moveNextLabel: t("orchestrationFlowMoveBlockDown"),
            duplicateLabel: t("txWorkflowDuplicateBlock"),
            deleteLabel: t("txWorkflowDeleteBlock"),
            onMovePrevious: () =>
              moveWorkflowBlock(
                stageIndex,
                jobIndex,
                blockIndex,
                blockIndex - 1,
              ),
            onMoveNext: () =>
              moveWorkflowBlock(
                stageIndex,
                jobIndex,
                blockIndex,
                blockIndex + 1,
              ),
            onDuplicate: () =>
              duplicateWorkflowBlock(stageIndex, jobIndex, blockIndex),
            onDelete: () =>
              removeWorkflowBlock(stageIndex, jobIndex, blockIndex),
          },
        };
      }
      const { stageIndex, jobIndex } = node.data;
      const jobs = stages[stageIndex]?.jobs || [];
      return {
        ...node,
        selected:
          (selection?.kind === "job" || selection?.kind === "workflow-block") &&
          selection.stageIndex === stageIndex &&
          selection.jobIndex === jobIndex,
        data: {
          ...node.data,
          sequenceText: String(jobIndex + 1),
          sourceLabelText: t(
            node.data.sourceKind === "template"
              ? "orchestrationFlowSourceTemplateRender"
              : "orchestrationFlowSourceManual",
          ),
          unresolvedText: t("orchestrationFlowUnresolvedValues").replace(
            "{count}",
            String(node.data.unresolvedCount || 0),
          ),
          overflowText: t("orchestrationFlowPreviewOverflow").replace(
            "{count}",
            String(node.data.overflowCount || 0),
          ),
          previewErrorText: node.data.previewError
            ? t("orchestrationFlowPreviewError")
            : "",
          previewLoadingText: t("orchestrationFlowPreviewLoading"),
          strategyText: t(
            node.data.strategy === "parallel"
              ? "orchestrationStrategyParallel"
              : "orchestrationStrategySerial",
          ),
          targetCountText: t("orchestrationFlowTargetCount").replace(
            "{count}",
            String(node.data.targetCount),
          ),
          blockCountText: t("txWorkflowCanvasBlockCount").replace(
            "{count}",
            String(node.data.blockCount),
          ),
          emptyWorkflowText: t("txWorkflowNodeNoCommands"),
          addBlockLabel: t("txWorkflowFormAddBlock"),
          canMovePrevious: jobIndex > 0,
          canMoveNext: jobIndex < jobs.length - 1,
          movePreviousLabel: t("orchestrationFlowMoveJobUp"),
          moveNextLabel: t("orchestrationFlowMoveJobDown"),
          duplicateLabel: t("orchestrationFlowDuplicateJob"),
          deleteLabel: t("orchestrationFlowDeleteJob"),
          onMovePrevious: () => moveJob(stageIndex, jobIndex, jobIndex - 1),
          onMoveNext: () => moveJob(stageIndex, jobIndex, jobIndex + 1),
          onDuplicate: () => duplicateJob(stageIndex, jobIndex),
          onDelete: () => removeJob(stageIndex, jobIndex),
          onAddBlock: () => addWorkflowBlock(stageIndex, jobIndex),
        },
      };
    });
  });
  let graphEdges = $derived(
    baseGraph.edges.map((edge) => ({
      ...edge,
      selectable: false,
      focusable: false,
      markerEnd:
        edge.kind === "stage-sequence" || edge.kind === "workflow-block"
          ? {
              type: MarkerType.ArrowClosed,
              color:
                edge.kind === "workflow-block"
                  ? "var(--chart-2)"
                  : "var(--primary)",
              width: 14,
              height: 14,
            }
          : undefined,
      style:
        edge.kind === "stage-sequence" || edge.kind === "stage-insert-link"
          ? "stroke:var(--primary);stroke-width:1.5;"
          : edge.kind === "workflow-block"
            ? "stroke:var(--chart-2);stroke-width:1.35;"
            : "stroke:var(--muted-foreground);stroke-width:1.15;stroke-dasharray:4 4;",
    })),
  );
  let selectedStageJobs = $derived(
    selection ? stages[selection.stageIndex]?.jobs || [] : [],
  );
  let selectedJob = $derived(
    selection?.kind === "job" || selection?.kind === "workflow-block"
      ? selectedStageJobs[selection.jobIndex] || null
      : null,
  );
  let selectedWorkflow = $derived(
    selectedJob?.action?.txWorkflow?.workflow || {},
  );
  let selectedWorkflowBlocks = $derived(
    Array.isArray(selectedWorkflow?.blocks) ? selectedWorkflow.blocks : [],
  );
  let selectedWorkflowPreview = $derived.by(() => {
    if (!selection || !selectedJob) return null;
    const templateName = String(
      selectedJob.action?.txWorkflow?.workflowTemplateName || "",
    ).trim();
    return templateName
      ? workflowPreviews[`${selection.stageIndex}:${selection.jobIndex}`] ||
          null
      : orchestrationInlineWorkflowPreview(selectedWorkflow);
  });
  let canMutateSelection = $derived(
    selection?.kind !== "workflow-block" ||
      selectedWorkflowPreview?.sourceKind === "manual",
  );
  let canMovePrevious = $derived(
    selection?.kind === "stage"
      ? selection.stageIndex > 0
      : selection?.kind === "job"
        ? selection.jobIndex > 0
        : selection?.kind === "workflow-block" && canMutateSelection
          ? selection.blockIndex > 0
          : false,
  );
  let canMoveNext = $derived(
    selection?.kind === "stage"
      ? selection.stageIndex < stages.length - 1
      : selection?.kind === "job"
        ? selection.jobIndex < selectedStageJobs.length - 1
        : selection?.kind === "workflow-block" && canMutateSelection
          ? selection.blockIndex < selectedWorkflowBlocks.length - 1
          : false,
  );

  function applyModel(nextModel) {
    if (typeof onChange === "function") onChange(nextModel);
  }

  function selectGraphNode({ node }) {
    if (node?.data?.kind === "stage") {
      selection = { kind: "stage", stageIndex: node.data.stageIndex };
      inspectorCollapsed = false;
    } else if (node?.data?.kind === "job") {
      selection = {
        kind: "job",
        stageIndex: node.data.stageIndex,
        jobIndex: node.data.jobIndex,
      };
      inspectorCollapsed = false;
    } else if (node?.data?.kind === "workflow-block") {
      selection = {
        kind: "workflow-block",
        stageIndex: node.data.stageIndex,
        jobIndex: node.data.jobIndex,
        blockIndex: node.data.blockIndex,
      };
      inspectorCollapsed = false;
    }
  }

  function insertStage(stageIndex) {
    applyModel(orchestrationInsertStage(model, stageIndex));
    selection = { kind: "stage", stageIndex };
    inspectorCollapsed = false;
  }

  function addStage() {
    insertStage(stages.length);
  }

  function duplicateStage(stageIndex) {
    applyModel(orchestrationDuplicateStage(model, stageIndex));
    selection = { kind: "stage", stageIndex: stageIndex + 1 };
  }

  function moveStage(stageIndex, targetIndex) {
    applyModel(orchestrationMoveStage(model, stageIndex, targetIndex));
    selection = { kind: "stage", stageIndex: targetIndex };
  }

  function removeStage(stageIndex) {
    applyModel(orchestrationRemoveStage(model, stageIndex));
    selection =
      stages.length > 1
        ? { kind: "stage", stageIndex: Math.max(0, stageIndex - 1) }
        : null;
  }

  function addJob(stageIndex) {
    const nextIndex = stages[stageIndex]?.jobs?.length || 0;
    applyModel(orchestrationAddJob(model, stageIndex));
    selection = { kind: "job", stageIndex, jobIndex: nextIndex };
    inspectorCollapsed = false;
  }

  function duplicateJob(stageIndex, jobIndex) {
    applyModel(orchestrationDuplicateJob(model, stageIndex, jobIndex));
    selection = { kind: "job", stageIndex, jobIndex: jobIndex + 1 };
  }

  function moveJob(stageIndex, jobIndex, targetIndex) {
    applyModel(orchestrationMoveJob(model, stageIndex, jobIndex, targetIndex));
    selection = { kind: "job", stageIndex, jobIndex: targetIndex };
  }

  function removeJob(stageIndex, jobIndex) {
    applyModel(orchestrationRemoveJob(model, stageIndex, jobIndex));
    const jobCount = stages[stageIndex]?.jobs?.length || 0;
    selection =
      jobCount > 1
        ? {
            kind: "job",
            stageIndex,
            jobIndex: Math.max(0, jobIndex - 1),
          }
        : { kind: "stage", stageIndex };
  }

  function mutateInlineWorkflow(stageIndex, jobIndex, updater) {
    const workflow =
      stages[stageIndex]?.jobs?.[jobIndex]?.action?.txWorkflow?.workflow || {};
    const formModel = txWorkflowFormModelFromJson(workflow);
    const nextFormModel = updater(formModel);
    const nextWorkflow = JSON.parse(
      txWorkflowFormModelToJsonText(nextFormModel),
    );
    applyModel(
      orchestrationUpdateInlineWorkflow(
        model,
        stageIndex,
        jobIndex,
        nextWorkflow,
      ),
    );
  }

  function addWorkflowBlock(stageIndex, jobIndex) {
    const blockIndex =
      stages[stageIndex]?.jobs?.[jobIndex]?.action?.txWorkflow?.workflow?.blocks
        ?.length || 0;
    mutateInlineWorkflow(stageIndex, jobIndex, txWorkflowAddBlock);
    selection = { kind: "workflow-block", stageIndex, jobIndex, blockIndex };
    inspectorCollapsed = false;
  }

  function duplicateWorkflowBlock(stageIndex, jobIndex, blockIndex) {
    mutateInlineWorkflow(stageIndex, jobIndex, (workflow) =>
      txWorkflowDuplicateBlock(workflow, blockIndex),
    );
    selection = {
      kind: "workflow-block",
      stageIndex,
      jobIndex,
      blockIndex: blockIndex + 1,
    };
    inspectorCollapsed = false;
  }

  function moveWorkflowBlock(stageIndex, jobIndex, blockIndex, targetIndex) {
    mutateInlineWorkflow(stageIndex, jobIndex, (workflow) =>
      txWorkflowMoveBlock(workflow, blockIndex, targetIndex),
    );
    selection = {
      kind: "workflow-block",
      stageIndex,
      jobIndex,
      blockIndex: targetIndex,
    };
    inspectorCollapsed = false;
  }

  function removeWorkflowBlock(stageIndex, jobIndex, blockIndex) {
    const blockCount =
      stages[stageIndex]?.jobs?.[jobIndex]?.action?.txWorkflow?.workflow?.blocks
        ?.length || 0;
    mutateInlineWorkflow(stageIndex, jobIndex, (workflow) =>
      txWorkflowRemoveBlock(workflow, blockIndex),
    );
    selection =
      blockCount > 1
        ? {
            kind: "workflow-block",
            stageIndex,
            jobIndex,
            blockIndex: Math.max(0, blockIndex - 1),
          }
        : {
            kind: "job",
            stageIndex,
            jobIndex,
          };
  }

  function moveSelectionPrevious() {
    if (selection?.kind === "stage") {
      moveStage(selection.stageIndex, selection.stageIndex - 1);
    } else if (selection?.kind === "job") {
      moveJob(selection.stageIndex, selection.jobIndex, selection.jobIndex - 1);
    } else if (selection?.kind === "workflow-block") {
      moveWorkflowBlock(
        selection.stageIndex,
        selection.jobIndex,
        selection.blockIndex,
        selection.blockIndex - 1,
      );
    }
  }

  function moveSelectionNext() {
    if (selection?.kind === "stage") {
      moveStage(selection.stageIndex, selection.stageIndex + 1);
    } else if (selection?.kind === "job") {
      moveJob(selection.stageIndex, selection.jobIndex, selection.jobIndex + 1);
    } else if (selection?.kind === "workflow-block") {
      moveWorkflowBlock(
        selection.stageIndex,
        selection.jobIndex,
        selection.blockIndex,
        selection.blockIndex + 1,
      );
    }
  }

  function duplicateSelection() {
    if (selection?.kind === "stage") duplicateStage(selection.stageIndex);
    else if (selection?.kind === "job") {
      duplicateJob(selection.stageIndex, selection.jobIndex);
    } else if (selection?.kind === "workflow-block") {
      duplicateWorkflowBlock(
        selection.stageIndex,
        selection.jobIndex,
        selection.blockIndex,
      );
    }
  }

  function deleteSelection() {
    if (selection?.kind === "stage") removeStage(selection.stageIndex);
    else if (selection?.kind === "job") {
      removeJob(selection.stageIndex, selection.jobIndex);
    } else if (selection?.kind === "workflow-block") {
      removeWorkflowBlock(
        selection.stageIndex,
        selection.jobIndex,
        selection.blockIndex,
      );
    }
  }

  function openCanvasView(view) {
    if (typeof onOpenView === "function") onOpenView(view);
  }

  function collapseCanvasWindows() {
    planCollapsed = true;
    inspectorCollapsed = true;
  }

  function stopPanelPointerEvent(event) {
    event.stopPropagation();
  }

  function expandPlanWindow(event) {
    event.stopPropagation();
    planCollapsed = false;
  }

  function collapsePlanWindow(event) {
    event.stopPropagation();
    planCollapsed = true;
  }

  function inspectorWidthLimit(nextWidth) {
    const hostWidth = canvasHost?.clientWidth || 1024;
    return Math.min(Math.max(nextWidth, 380), Math.max(420, hostWidth - 360));
  }

  function clearInspectorResize() {
    inspectorResizeCleanup?.();
    inspectorResizeCleanup = null;
  }

  function startInspectorResize(event) {
    if (window.innerWidth < 1024) return;
    event.preventDefault();
    clearInspectorResize();
    const startX = event.clientX;
    const startWidth = inspectorWidth;
    const resize = (moveEvent) => {
      inspectorWidth = inspectorWidthLimit(
        startWidth + startX - moveEvent.clientX,
      );
    };
    const stop = () => clearInspectorResize();
    window.addEventListener("pointermove", resize);
    window.addEventListener("pointerup", stop, { once: true });
    inspectorResizeCleanup = () => {
      window.removeEventListener("pointermove", resize);
      window.removeEventListener("pointerup", stop);
    };
  }

  function resizeInspectorWithKeyboard(event) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    inspectorWidth = inspectorWidthLimit(
      inspectorWidth + (event.key === "ArrowLeft" ? 32 : -32),
    );
  }

  $effect(() => {
    if (!selection) return;
    const normalized = orchestrationNormalizeFlowSelection(
      model,
      selection,
      workflowPreviews,
    );
    if (normalized) {
      selection = normalized;
    } else {
      selection = null;
      inspectorCollapsed = true;
    }
  });

  onDestroy(clearInspectorResize);

  onMount(() => {
    const compactQuery = window.matchMedia("(max-width: 1023px)");
    const applyCompactCanvas = () => {
      compactCanvas = compactQuery.matches;
    };
    applyCompactCanvas();
    compactQuery.addEventListener("change", applyCompactCanvas);
    return () => compactQuery.removeEventListener("change", applyCompactCanvas);
  });
</script>

<div
  bind:this={canvasHost}
  data-testid="orchestration-flow-canvas"
  class="relative min-w-0"
>
  <div
    class="flex h-[42rem] min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-muted/15 lg:h-[calc(100dvh-14rem)] lg:min-h-[44rem] lg:max-h-[58rem]"
  >
    <div class="min-h-0 flex-1">
      <SvelteFlow
        id="orchestration-flow-editor"
        nodes={graphNodes}
        edges={graphEdges}
        {nodeTypes}
        fitView
        fitViewOptions={{
          padding: compactCanvas ? 0.24 : 0.1,
          maxZoom: 0.85,
        }}
        minZoom={0.25}
        maxZoom={1.35}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        deleteKey={null}
        selectionKey={null}
        multiSelectionKey={null}
        zoomOnScroll={false}
        zoomOnDoubleClick={false}
        onnodeclick={selectGraphNode}
        onpaneclick={collapseCanvasWindows}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          id="orchestration-flow-grid"
          variant={BackgroundVariant.Dots}
          patternColor="var(--border)"
          gap={20}
          size={1.25}
        />

        <OrchestrationFlowViewportController
          compact={compactCanvas}
          focusNodeId={focusStageNodeId}
          layoutRevision={graphLayoutRevision}
          inspectorOpen={!inspectorCollapsed}
          {inspectorWidth}
          {topWindowOpen}
        />

        <Panel
          position="top-left"
          class="nopan nowheel m-3 w-[calc(100%-1.5rem)]"
        >
          <div
            class="pointer-events-none flex min-w-0 flex-wrap items-start gap-3"
          >
            <div
              class={classNames(
                "nopan nowheel pointer-events-auto",
                planCollapsed
                  ? "w-auto"
                  : "w-full min-w-0 lg:w-[30rem] lg:flex-none",
              )}
            >
              {#if planCollapsed}
                <Button
                  class="nopan nowheel shadow-lg"
                  variant="secondary"
                  size="sm"
                  type="button"
                  onpointerdown={stopPanelPointerEvent}
                  onclick={expandPlanWindow}
                >
                  <PanelTopOpenIcon data-icon="inline-start" />
                  {t("orchestrationFlowPlanWindow")}
                </Button>
              {:else}
                <div
                  class="nopan nowheel grid max-h-[22rem] gap-3 overflow-y-auto rounded-xl border border-border bg-background/95 p-3 shadow-lg backdrop-blur"
                >
                  <div class="flex items-start justify-between gap-2">
                    <div>
                      <div class="text-sm font-semibold text-foreground">
                        {t("orchestrationFlowPlanWindow")}
                      </div>
                      <div class="text-xs text-muted-foreground">
                        {t("orchestrationFlowPlanWindowHint")}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      type="button"
                      onpointerdown={stopPanelPointerEvent}
                      onclick={collapsePlanWindow}><PanelTopCloseIcon /></Button
                    >
                  </div>
                  <TxDirectVarsPanel
                    {active}
                    hidden-textarea={true}
                    hintKey="orchestrationVarsHint"
                    placeholderKey="orchestrationVarsPlaceholder"
                    prefix="orchestration-direct"
                    varsKey={directVarsKey}
                  />
                  <OrchestrationPlanSettingsEditor
                    {model}
                    {visualDisplay}
                    {onChange}
                  />
                </div>
              {/if}
            </div>
          </div>
        </Panel>

        <Controls
          position="bottom-left"
          orientation="horizontal"
          showLock={false}
          aria-label={t("orchestrationFlowCanvasControls")}
          buttonBgColor="var(--card)"
          buttonBgColorHover="var(--accent)"
          buttonColor="var(--foreground)"
          buttonColorHover="var(--accent-foreground)"
          buttonBorderColor="var(--border)"
        />

        <Panel position="top-center" class="nopan nowheel m-3 hidden sm:block">
          <div
            class="rounded-xl border border-border bg-background/90 px-3 py-2 shadow-sm backdrop-blur"
          >
            <div class="text-xs font-semibold text-foreground">
              {stageCountText}
            </div>
            <div class="mt-0.5 text-[0.6875rem] text-muted-foreground">
              {t("orchestrationFlowExecutionOrder")}
            </div>
          </div>
        </Panel>
      </SvelteFlow>
    </div>
    <div
      role="group"
      aria-label={t("orchestrationFlowToolbar")}
      class="flex shrink-0 items-center justify-center gap-2 border-t border-border bg-background/95 p-2 backdrop-blur"
    >
      <Button
        variant="outline"
        size="sm"
        type="button"
        title={t("orchestrationFormAddStage")}
        aria-label={t("orchestrationFormAddStage")}
        onclick={addStage}
      >
        <PlusIcon data-icon="inline-start" />
        <span class="hidden sm:inline">{t("orchestrationFormAddStage")}</span>
      </Button>
      <Button
        variant="outline"
        size="sm"
        type="button"
        title={t("txBlockEditorJsonTab")}
        aria-label={t("txBlockEditorJsonTab")}
        onclick={() => openCanvasView("json")}
        ><BracesIcon data-icon="inline-start" /><span class="hidden sm:inline"
          >{t("txBlockEditorJsonTab")}</span
        ></Button
      >
      <Button
        variant="outline"
        size="sm"
        type="button"
        title={t("txBlockEditorReadonlyTab")}
        aria-label={t("txBlockEditorReadonlyTab")}
        onclick={() => openCanvasView("readonly")}
        ><EyeIcon data-icon="inline-start" /><span class="hidden sm:inline"
          >{t("txBlockEditorReadonlyTab")}</span
        ></Button
      >
      <LoadingButton
        variant="default"
        size="sm"
        loading={runButtonDisplay.executeLoading}
        title={t("orchestrationExecBtn")}
        aria-label={t("orchestrationExecBtn")}
        onclick={onExecute}
        ><PlayIcon data-icon="inline-start" /><span class="hidden sm:inline"
          >{t("orchestrationExecBtn")}</span
        ></LoadingButton
      >
    </div>
  </div>

  {#if inspectorCollapsed}
    <Button
      class={classNames(
        "absolute right-4 top-4 z-20 shadow-lg",
        topWindowOpen ? "lg:top-[23.5rem]" : "",
      )}
      variant="secondary"
      size="sm"
      type="button"
      onclick={() => (inspectorCollapsed = false)}
      ><PanelRightOpenIcon data-icon="inline-start" />{t(
        "txWorkflowInspectorExpand",
      )}</Button
    >
  {:else if selection}
    <aside
      class={classNames(
        "orchestration-flow-inspector mt-3 min-w-0 overflow-hidden rounded-2xl border border-border bg-background/95 shadow-2xl backdrop-blur lg:absolute lg:bottom-[4.75rem] lg:right-4 lg:top-4 lg:z-20 lg:mt-0 lg:flex lg:flex-col",
        topWindowOpen ? "lg:top-[23.5rem]" : "",
      )}
      style={`--inspector-width:${inspectorWidth}px`}
    >
      <button
        type="button"
        class="absolute -left-3 bottom-0 top-0 hidden w-6 touch-none cursor-col-resize items-center justify-center text-muted-foreground hover:text-primary lg:flex"
        aria-label={t("txWorkflowInspectorResize")}
        onpointerdown={startInspectorResize}
        onkeydown={resizeInspectorWithKeyboard}><GripVerticalIcon /></button
      >
      <OrchestrationFlowInspector
        {model}
        {selection}
        {visualDisplay}
        {onChange}
        {onErrorChange}
        {canMovePrevious}
        {canMoveNext}
        {canMutateSelection}
        workflowPreview={selectedWorkflowPreview}
        onCollapse={() => (inspectorCollapsed = true)}
        onMovePrevious={moveSelectionPrevious}
        onMoveNext={moveSelectionNext}
        onDuplicate={duplicateSelection}
        onDelete={deleteSelection}
      />
    </aside>
  {/if}
</div>

<style>
  .orchestration-flow-inspector {
    width: 100%;
  }

  @media (min-width: 64rem) {
    .orchestration-flow-inspector {
      width: min(var(--inspector-width), calc(100% - 2rem));
    }
  }
</style>
