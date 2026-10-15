<script lang="ts">
  import FlowWorkflowGroupNode from "$components/fragments/FlowWorkflowGroupNode.svelte";
  import FlowWorkflowBlockNode from "$components/fragments/FlowWorkflowBlockNode.svelte";
  import { FLOW_WORKFLOW_FIT_OPTIONS } from "$components/fragments/flowWorkflowLayout.js";
  import ReadonlyFields from "$components/fragments/ReadonlyFields.svelte";
  import ArrowUpIcon from "@lucide/svelte/icons/arrow-up";
  import ArrowDownIcon from "@lucide/svelte/icons/arrow-down";
  import BracesIcon from "@lucide/svelte/icons/braces";
  import CopyIcon from "@lucide/svelte/icons/copy";
  import EyeIcon from "@lucide/svelte/icons/eye";
  import GripVerticalIcon from "@lucide/svelte/icons/grip-vertical";
  import PanelRightCloseIcon from "@lucide/svelte/icons/panel-right-close";
  import PanelRightOpenIcon from "@lucide/svelte/icons/panel-right-open";
  import PanelTopCloseIcon from "@lucide/svelte/icons/panel-top-close";
  import PanelTopOpenIcon from "@lucide/svelte/icons/panel-top-open";
  import LayersIcon from "@lucide/svelte/icons/layers";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import {
    Background,
    BackgroundVariant,
    Controls,
    MarkerType,
    Panel,
    SvelteFlow,
  } from "@xyflow/svelte";
  import type { Edge, Node } from "@xyflow/svelte";
  import "@xyflow/svelte/dist/style.css";
  import { getContext, onDestroy, onMount } from "svelte";
  import { MediaQuery } from "svelte/reactivity";
  import { fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import PresenceFieldGrid from "$components/fragments/PresenceFieldGrid.svelte";
  import StatusCard from "$components/fragments/StatusCard.svelte";
  import { currentLanguageState, t } from "$lib/i18n.js";
  import { classNames } from "$lib/ui.js";
  import {
    txWorkflowFlowGraph,
    txWorkflowInspectorWidth,
    txWorkflowNormalizeCommandSelection,
    TX_WORKFLOW_GROUP_ID,
    txWorkflowNodeTitle,
    txWorkflowFindBlock,
    txWorkflowBranchModel,
    txWorkflowVisualEditorDisplay,
  } from "$domains/transactions/index.js";
  import { createTransactionWorkflowCanvasWorkspace } from "$domains/transactions/index.js";
  import { browserConfirm } from "$lib/browser.js";
  import { readonlyFieldsContextKey } from "$lib/svelte.js";
  import { createTxWorkflowVisualEditorWorkspace } from "$domains/transactions/index.js";
  import TxWorkflowNodeEditor from "./TxWorkflowNodeEditor.svelte";
  import TxWorkflowFlowViewportController from "$domains/transactions/presentation/components/workflow/TxWorkflowFlowViewportController.svelte";

  import type {
    TxWorkflowBlockRow,
    TxWorkflowCanvasBlockData,
    TxWorkflowCanvasGroupData,
    TxWorkflowFormModel,
    TxBlockCommandTarget,
  } from "$domains/transactions/index.js";

  type TxWorkflowEditorView = "json" | "readonly";
  type TxWorkflowBlockNode = Node<TxWorkflowCanvasBlockData, "workflowNode">;
  type TxWorkflowGroupNode = Node<TxWorkflowCanvasGroupData, "workflowGroup">;
  type TxWorkflowGraphNode = TxWorkflowBlockNode | TxWorkflowGroupNode;
  type TxWorkflowGraphEdge = Edge<Record<string, never>, "smoothstep">;
  type TxWorkflowSelection =
    | {
        editorId: string;
        kind: "block";
        stepIndex?: number;
        operation?: TxBlockCommandTarget;
      }
    | { editorId: null; kind: "none" };

  interface Props {
    readonly?: boolean;
    sourceKind?: "manual" | "template";
    sourceName?: string;
    embedded?: boolean;
    model: TxWorkflowFormModel;
    onChange?: ((model: TxWorkflowFormModel) => void) | null;
    onOpenView?: (view: TxWorkflowEditorView) => void;
    settingsOnly?: boolean;
    nested?: boolean;
  }

  let {
    readonly = false,
    sourceKind = "manual",
    sourceName = "",
    model,
    onChange,
    onOpenView,
    embedded = false,
    settingsOnly = false,
    nested = false,
  }: Props = $props();

  const inheritedReadonly = getContext<(() => boolean) | undefined>(
    readonlyFieldsContextKey,
  );
  let locked = $derived(readonly || !!inheritedReadonly?.());
  const canvasWorkspace = createTransactionWorkflowCanvasWorkspace({
    getModel: () => model,
    onChange: (next) => onChange?.(next),
    getSelectedId: () => selectedTarget.editorId,
    getSelectedStepIndex: () =>
      selectedTarget.kind === "block"
        ? (selectedTarget.stepIndex ?? null)
        : null,
    getSelectedOperation: () =>
      selectedTarget.kind === "block"
        ? (selectedTarget.operation ?? "run")
        : "run",
    onSelectStep: (editorId, stepIndex, operation = "run") => {
      selectedTarget = { kind: "block", editorId, stepIndex, operation };
      openInspector();
    },
    onSelectWholeRollback: (editorId) => {
      selectedTarget = {
        kind: "block",
        editorId,
        operation: "whole_resource_rollback",
      };
      openInspector();
    },
    onSelect: (editorId) => {
      if (editorId) selectBlockId(editorId);
      else selectedTarget = { kind: "none", editorId: null };
    },
    canModify: () => !readonly && !inheritedReadonly?.(),
    templateOptions: {
      confirmReplace: () =>
        browserConfirm(t("orchestrationDiscardChangesConfirm")),
    },
  });
  const { addNode, moveBlock, duplicateBlock, removeBlock } = canvasWorkspace;
  const blockCanvasStateStore = canvasWorkspace.templates.canvasStateStore;
  $effect(() => canvasWorkspace.sync());
  onDestroy(canvasWorkspace.destroy);

  const txWorkflowVisualEditorWorkspace =
    createTxWorkflowVisualEditorWorkspace();
  const nodeTypes = {
    workflowNode: FlowWorkflowBlockNode,
    workflowGroup: FlowWorkflowGroupNode,
  };
  const {
    blockRowsStateStore,
    setVisualEditorContext,
    workflowActionHandlersStateStore,
    workflowRootFieldRowsStateStore,
  } = txWorkflowVisualEditorWorkspace;

  let blockRows = $derived($blockRowsStateStore);
  let workflowActionHandlers = $derived($workflowActionHandlersStateStore);
  let workflowRootFieldRows = $derived($workflowRootFieldRowsStateStore);
  let currentLanguage = $derived($currentLanguageState);
  let selectedTarget = $state<TxWorkflowSelection>({
    kind: "none",
    editorId: null,
  });
  const panelId = $props.id();
  const reducedMotion = new MediaQuery("(prefers-reduced-motion: reduce)");
  let settingsCollapsed = $state(true);
  let inspectorCollapsed = $state(true);
  let toolbarHeight = $state(44);
  let panelToggles = $state<
    Record<
      "settings" | "inspector",
      HTMLButtonElement | HTMLAnchorElement | null
    >
  >({ settings: null, inspector: null });
  let inspectorWidth = $state(860);
  let compactViewport = $state(
    typeof window !== "undefined" &&
      window.matchMedia("(max-width: 1023px)").matches,
  );
  let compactCanvas = $derived(compactViewport);
  let canvasWidth = $state(0);
  let effectiveInspectorWidth = $derived(inspectorWidthLimit(inspectorWidth));
  let inspectorResizeCleanup = $state<(() => void) | null>(null);
  let selectedBlockLocation = $derived(
    selectedTarget.kind === "block"
      ? txWorkflowFindBlock(model, selectedTarget.editorId)
      : null,
  );
  let selectedScopeModel = $derived(
    selectedBlockLocation
      ? txWorkflowBranchModel(
          model,
          selectedBlockLocation.parentId,
          selectedBlockLocation.branch,
        )
      : null,
  );
  let selectedBlockRow = $derived(
    selectedScopeModel && selectedBlockLocation
      ? (txWorkflowVisualEditorDisplay(selectedScopeModel).blockRows[
          selectedBlockLocation.blockIndex
        ] ?? null)
      : null,
  );
  let selectedNodeId = $derived.by(() => {
    let location = selectedBlockLocation;
    while (location?.parentId)
      location = txWorkflowFindBlock(model, location.parentId);
    return location
      ? `workflow-block-${location.blockIndex}`
      : TX_WORKFLOW_GROUP_ID;
  });
  let canvasBlockCountText = $derived.by(() => {
    currentLanguage;
    return t("txWorkflowCanvasNodeCount").replace(
      "{count}",
      String(blockRows.length),
    );
  });
  let inspectorTitle = $derived.by(() => {
    currentLanguage;
    if (
      selectedTarget.kind === "block" &&
      selectedTarget.operation === "whole_resource_rollback"
    )
      return t("txBlockFormWholeRollback");
    if (
      selectedTarget.kind === "block" &&
      selectedTarget.operation === "rollback"
    )
      return t("txBlockStepRollbackCommand");
    if (
      selectedTarget.kind === "block" &&
      selectedTarget.stepIndex !== undefined
    ) {
      const operation = (
        $blockCanvasStateStore[selectedTarget.editorId]?.formModel ??
        selectedBlockRow?.block.inlineBlock
      )?.steps[selectedTarget.stepIndex]?.run;
      return operation?.kind === "flow" ||
        operation?.commandEditorKind === "interactive" ||
        !!operation?.command.interaction?.prompts.length
        ? t("txBlockOperationKindInteractive")
        : t("txBlockFormCommand");
    }
    return selectedBlockRow
      ? blockName(selectedBlockRow)
      : t("txWorkflowInspectorNoSelection");
  });
  let inspectorHint = $derived.by(() => {
    currentLanguage;
    if (
      selectedTarget.kind === "block" &&
      selectedTarget.stepIndex !== undefined
    )
      return `${t("txWorkflowFormBlock")} · ${t(selectedTarget.operation === "rollback" ? "txWorkflowRollbackCommandPosition" : "txWorkflowCommandPosition").replace("{index}", String(selectedTarget.stepIndex + 1))}`;
    return selectedBlockRow
      ? blockMeta(selectedBlockRow)
      : t("txWorkflowInspectorNoSelectionHint");
  });
  let baseGraph = $derived.by(() => {
    currentLanguage;
    return txWorkflowFlowGraph(model, { blockStates: $blockCanvasStateStore });
  });
  let graphLayoutRevision = $derived(
    [baseGraph.group, ...baseGraph.blocks]
      .map((node) => `${node.id}:${node.width}:${node.height}`)
      .join("|"),
  );
  let graphNodes = $derived.by<TxWorkflowGraphNode[]>(() => [
    {
      ...baseGraph.group,
      data: {
        ...baseGraph.group.data,
        sourceKind,
        sourceName,
        sourceLabelText: t(
          sourceKind === "template"
            ? "commandSourceTemplate"
            : "commandSourceManual",
        ),
        readonly: locked,
        ...canvasWorkspace.addActions(),
      },
      selected: selectedTarget.kind === "none",
      draggable: false,
      deletable: false,
      connectable: false,
      focusable: true,
      ariaLabel: baseGraph.group.data.title,
    },
    ...baseGraph.blocks.map((block): TxWorkflowBlockNode => ({
      ...block,
      data: canvasWorkspace.decorateBlock(block.data),
      selected:
        selectedTarget.kind === "block" &&
        selectedTarget.editorId === block.data.id,
      draggable: false,
      deletable: false,
      connectable: false,
      focusable: true,
      ariaRole: "button",
      ariaLabel: `${block.data.blockIndex + 1}. ${block.data.title}. ${block.data.metaText}`,
    })),
  ]);
  let graphEdges = $derived.by<TxWorkflowGraphEdge[]>(() =>
    baseGraph.edges.map((edge) => ({
      ...edge,
      selectable: false,
      focusable: false,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: "var(--chart-2)",
        width: 14,
        height: 14,
      },
      style: "stroke:var(--chart-2);stroke-width:1.35;",
    })),
  );

  function blockName(blockRow: TxWorkflowBlockRow): string {
    return txWorkflowNodeTitle(blockRow.block);
  }

  function blockMeta(blockRow: TxWorkflowBlockRow): string {
    if (blockRow.block.control)
      return blockRow.block.control.kind === "loop"
        ? blockRow.block.control.iterations
        : t("txWorkflowChoiceBranchCount").replace(
            "{count}",
            String(blockRow.block.control.branches.length),
          );
    if (blockRow.showTemplateRef) {
      return [
        t("txWorkflowBlockSourceTemplate"),
        blockRow.block.templateRef.txBlockTemplateName,
      ]
        .filter(Boolean)
        .join(" · ");
    }
    const inlineBlock = blockRow.block?.inlineBlock || {};
    const stepCount = Array.isArray(inlineBlock.steps)
      ? inlineBlock.steps.length
      : 0;
    const rollbackKind = inlineBlock.rollbackPolicy?.kind || "none";
    return `${t("txWorkflowNodeCommandCount").replace("{count}", String(stepCount))} · ${rollbackKind}`;
  }

  function openInspector(): void {
    inspectorCollapsed = false;
  }

  function selectBlock(blockIndex: number): void {
    const block = model.blocks[blockIndex];
    if (block) selectBlockId(block.editorId);
  }

  function selectBlockId(editorId: string): void {
    selectedTarget = { kind: "block", editorId };
    openInspector();
  }

  function selectGraphNode({ node }: { node: TxWorkflowGraphNode }): void {
    if (node?.data?.kind === "block") {
      selectBlock(node.data.blockIndex);
    } else if (node.data.kind === "workflow") {
      expandSettings();
    }
  }

  function addBlock(): void {
    addNode("block");
  }

  function inspectorWidthLimit(nextWidth: number): number {
    return txWorkflowInspectorWidth(
      canvasWidth || 1024,
      nextWidth,
      baseGraph.group.width,
    );
  }

  function clearInspectorResize(): void {
    inspectorResizeCleanup?.();
    inspectorResizeCleanup = null;
  }

  function startInspectorResize(event: PointerEvent): void {
    if (window.innerWidth < 1024) return;
    event.preventDefault();
    clearInspectorResize();
    const startX = event.clientX;
    const startWidth = effectiveInspectorWidth;
    const resize = (moveEvent: PointerEvent): void => {
      inspectorWidth = inspectorWidthLimit(
        startWidth + startX - moveEvent.clientX,
      );
    };
    const stop = (): void => clearInspectorResize();
    window.addEventListener("pointermove", resize);
    window.addEventListener("pointerup", stop, { once: true });
    inspectorResizeCleanup = () => {
      window.removeEventListener("pointermove", resize);
      window.removeEventListener("pointerup", stop);
    };
  }

  function resizeInspectorWithKeyboard(event: KeyboardEvent): void {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const delta = event.key === "ArrowLeft" ? 32 : -32;
    inspectorWidth = inspectorWidthLimit(effectiveInspectorWidth + delta);
  }

  function collapseInspector(): void {
    clearInspectorResize();
    inspectorCollapsed = true;
  }

  function collapseSettings(): void {
    settingsCollapsed = true;
  }

  function expandSettings(): void {
    settingsCollapsed = false;
  }

  function collapseCanvasWindows(): void {
    collapseSettings();
    collapseInspector();
  }

  function openCanvasView(nextView: TxWorkflowEditorView): void {
    onOpenView?.(nextView);
  }

  $effect(() => {
    setVisualEditorContext({
      model,
      onChange: (nextModel) => {
        if (!locked) onChange?.(nextModel);
      },
    });
  });

  $effect(() => {
    const hasSelectedBlock =
      selectedTarget.kind === "block" &&
      !!txWorkflowFindBlock(model, selectedTarget.editorId);
    if (hasSelectedBlock) {
      if (selectedTarget.kind === "block") {
        const block = txWorkflowFindBlock(
          model,
          selectedTarget.editorId,
        )?.block;
        const form =
          $blockCanvasStateStore[selectedTarget.editorId]?.formModel ??
          (block?.sourceKind === "inline" ? block.inlineBlock : null);
        const next = txWorkflowNormalizeCommandSelection(form, selectedTarget);
        if (
          next.stepIndex !== selectedTarget.stepIndex ||
          next.operation !== selectedTarget.operation
        )
          selectedTarget = {
            kind: "block",
            editorId: selectedTarget.editorId,
            ...next,
          };
      }
      return;
    }
    if (blockRows.length) {
      selectedTarget = { kind: "block", editorId: model.blocks[0].editorId };
    } else if (selectedTarget.kind !== "none") {
      selectedTarget = { kind: "none", editorId: null };
    }
  });

  onDestroy(clearInspectorResize);

  onMount(() => {
    const compactQuery = window.matchMedia("(max-width: 1023px)");
    const applyCompactCanvas = (): void => {
      compactViewport = compactQuery.matches;
    };
    applyCompactCanvas();
    compactQuery.addEventListener("change", applyCompactCanvas);
    return () => compactQuery.removeEventListener("change", applyCompactCanvas);
  });
</script>

{#snippet panelToggle(kind: "settings" | "inspector")}
  {@const isSettings = kind === "settings"}
  {@const collapsed = isSettings ? settingsCollapsed : inspectorCollapsed}
  {@const Icon = isSettings
    ? collapsed
      ? PanelTopOpenIcon
      : PanelTopCloseIcon
    : collapsed
      ? PanelRightOpenIcon
      : PanelRightCloseIcon}
  {@const label = isSettings
    ? t(collapsed ? "txWorkflowSettingsExpand" : "txWorkflowSettingsCollapse")
    : t(
        collapsed ? "txWorkflowInspectorExpand" : "txWorkflowInspectorCollapse",
      )}
  <Button
    bind:ref={panelToggles[kind]}
    variant="secondary"
    size="sm"
    type="button"
    aria-label={label}
    aria-expanded={!collapsed}
    aria-controls={`${panelId}-${kind}`}
    title={label}
    class="pointer-events-auto min-w-0 shadow-lg"
    onclick={() => {
      if (isSettings) settingsCollapsed ? expandSettings() : collapseSettings();
      else inspectorCollapsed ? openInspector() : collapseInspector();
    }}
  >
    <Icon data-icon="inline-start" />
    <span class="truncate"
      >{t(
        isSettings ? "txWorkflowSettingsTitle" : "txWorkflowInspectorTitle",
      )}</span
    >
  </Button>
{/snippet}

{#snippet addBlockAction()}
  <div class="flex flex-wrap items-center gap-1">
    <Button
      disabled={readonly}
      variant="outline"
      size="sm"
      type="button"
      onclick={addBlock}
    >
      <PlusIcon data-icon="inline-start" />
      {t("txWorkflowFormAddBlock")}
    </Button>
    {#each ["loop", "choice"] as kind}
      <Button
        disabled={readonly}
        variant="outline"
        size="sm"
        type="button"
        onclick={() => addNode(kind === "loop" ? "loop" : "choice")}
      >
        <PlusIcon data-icon="inline-start" />{t(
          kind === "loop" ? "txWorkflowLoop" : "txWorkflowChoice",
        )}
      </Button>
    {/each}
  </div>
{/snippet}

{#snippet nodeEditor(blockRow: TxWorkflowBlockRow)}
  {#key blockRow.block.editorId}
    <TxWorkflowNodeEditor
      {model}
      editorId={blockRow.block.editorId}
      workspace={canvasWorkspace}
      canvasBody={!embedded}
      selectedStepIndex={selectedTarget.kind === "block" &&
      selectedTarget.editorId === blockRow.block.editorId
        ? (selectedTarget.stepIndex ?? null)
        : null}
      selectedOperation={selectedTarget.kind === "block" &&
      selectedTarget.editorId === blockRow.block.editorId
        ? (selectedTarget.operation ?? "run")
        : "run"}
      readonly={locked}
      onChange={(next) => onChange?.(next)}
    />
  {/key}
{/snippet}

{#if embedded}
  <div data-testid="tx-workflow-embedded-editor" class="grid min-w-0 gap-4">
    {#if !nested}
      <section
        class="min-w-0 overflow-hidden rounded-lg border border-border bg-background"
      >
        <header
          class="flex min-w-0 flex-wrap items-start justify-between gap-3 border-b border-border bg-muted/20 p-3"
        >
          <div class="min-w-0">
            <h4 class="text-sm font-semibold text-foreground">
              {t("txWorkflowSettingsTitle")}
            </h4>
            <p class="mt-0.5 text-xs leading-5 text-muted-foreground">
              {t("txWorkflowCanvasSettingsHint")}
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{canvasBlockCountText}</Badge>
            {#if settingsOnly}
              {@render addBlockAction()}
            {/if}
          </div>
        </header>
        <div class="p-3">
          <ReadonlyFields disabled={readonly} class="min-w-0">
            <PresenceFieldGrid
              fieldRows={workflowRootFieldRows}
              valueHandlerMode="event"
              hostClass="grid min-w-0 gap-3"
              presenceControlsMode="hidden"
              onValueChangeForKey={workflowActionHandlers.valueHandler}
              onPresenceChangeForKey={workflowActionHandlers.presenceToggle}
            />
          </ReadonlyFields>
        </div>
      </section>
    {/if}

    {#if !settingsOnly}
      <section
        class="min-w-0 overflow-hidden rounded-lg border border-border bg-background"
      >
        <header
          class="flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/20 p-3"
        >
          <div class="min-w-0">
            <h4 class="text-sm font-semibold text-foreground">
              {t("txWorkflowNodes")}
            </h4>
            <p class="mt-0.5 text-xs text-muted-foreground">
              {canvasBlockCountText}
            </p>
          </div>
          {@render addBlockAction()}
        </header>

        {#if blockRows.length}
          <div class="max-h-72 divide-y divide-border overflow-y-auto">
            {#each blockRows as blockRow}
              <div
                class={classNames(
                  "flex min-w-0 items-center gap-2 p-2 transition-colors",
                  selectedTarget.kind === "block" &&
                    selectedTarget.editorId === blockRow.block.editorId
                    ? "bg-primary/5"
                    : "hover:bg-muted/30",
                )}
              >
                <button
                  type="button"
                  class="flex min-w-0 flex-1 items-center gap-3 rounded-md px-2 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-pressed={selectedTarget.kind === "block" &&
                    selectedTarget.editorId === blockRow.block.editorId}
                  onclick={() => selectBlock(blockRow.blockIndex)}
                >
                  <Badge variant="secondary">
                    {blockRow.blockIndex + 1}
                  </Badge>
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-sm font-medium">
                      {blockName(blockRow)}
                    </span>
                    <span
                      class="mt-0.5 block truncate text-xs text-muted-foreground"
                    >
                      {blockMeta(blockRow)}
                    </span>
                  </span>
                </button>
                <div class="flex shrink-0 items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    type="button"
                    title={t("txWorkflowMoveBlockUp")}
                    aria-label={t("txWorkflowMoveBlockUp")}
                    disabled={readonly || blockRow.blockIndex === 0}
                    onclick={() =>
                      moveBlock(
                        blockRow.block.editorId,
                        blockRow.blockIndex - 1,
                      )}
                  >
                    <ArrowUpIcon />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    type="button"
                    title={t("txWorkflowMoveBlockDown")}
                    aria-label={t("txWorkflowMoveBlockDown")}
                    disabled={readonly ||
                      blockRow.blockIndex === blockRows.length - 1}
                    onclick={() =>
                      moveBlock(
                        blockRow.block.editorId,
                        blockRow.blockIndex + 1,
                      )}
                  >
                    <ArrowDownIcon />
                  </Button>
                  <Button
                    disabled={readonly}
                    variant="ghost"
                    size="icon-sm"
                    type="button"
                    title={t("txWorkflowDuplicateBlock")}
                    aria-label={t("txWorkflowDuplicateBlock")}
                    onclick={() => duplicateBlock(blockRow.block.editorId)}
                  >
                    <CopyIcon />
                  </Button>
                  <Button
                    disabled={readonly}
                    class="text-destructive hover:text-destructive"
                    variant="ghost"
                    size="icon-sm"
                    type="button"
                    title={t("txWorkflowDeleteBlock")}
                    aria-label={t("txWorkflowDeleteBlock")}
                    onclick={() => removeBlock(blockRow.block.editorId)}
                  >
                    <Trash2Icon />
                  </Button>
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <div class="grid gap-3 p-3">
            <StatusCard message={t("txWorkflowInspectorNoSelectionHint")} />
            <Button
              disabled={readonly}
              variant="outline"
              type="button"
              onclick={addBlock}
            >
              <PlusIcon data-icon="inline-start" />
              {t("txWorkflowFormAddBlock")}
            </Button>
          </div>
        {/if}
      </section>

      {#key currentLanguage}
        {#if selectedBlockRow}
          <ReadonlyFields disabled={readonly} scopeOnly class="min-w-0">
            {@render nodeEditor(selectedBlockRow)}
          </ReadonlyFields>
        {/if}
      {/key}
    {/if}
  </div>
{:else}
  <div
    bind:clientWidth={canvasWidth}
    data-testid="tx-workflow-editor-layout"
    class="relative min-w-0"
  >
    <div
      class="tx-workflow-canvas flex h-[min(72dvh,52rem)] min-h-[36rem] min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-muted/15 lg:h-[calc(100dvh-12.5rem)] lg:min-h-[42rem] lg:max-h-none"
    >
      <div class="tx-workflow-flow min-h-0 flex-1">
        <SvelteFlow
          id="tx-workflow-editor"
          nodes={graphNodes}
          edges={graphEdges}
          {nodeTypes}
          fitView
          fitViewOptions={{
            ...FLOW_WORKFLOW_FIT_OPTIONS,
            nodes: graphNodes.map((node) => ({ id: node.id })),
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
            id="tx-workflow-grid"
            variant={BackgroundVariant.Dots}
            patternColor="var(--border)"
            gap={20}
            size={1.25}
          />

          <TxWorkflowFlowViewportController
            compact={compactCanvas}
            focusNodeId={selectedNodeId}
            focusBlockId={selectedTarget.editorId}
            layoutRevision={graphLayoutRevision}
            inspectorOpen={!inspectorCollapsed}
            inspectorWidth={effectiveInspectorWidth}
          />

          <Controls
            position="bottom-left"
            orientation="horizontal"
            fitViewOptions={FLOW_WORKFLOW_FIT_OPTIONS}
            showLock={false}
            aria-label={t("txWorkflowCanvasControls")}
            buttonBgColor="var(--card)"
            buttonBgColorHover="var(--accent)"
            buttonColor="var(--foreground)"
            buttonColorHover="var(--accent-foreground)"
            buttonBorderColor="var(--border)"
          />
          <Panel
            position="top-center"
            class="nopan nowheel m-3 hidden sm:block"
          >
            <div
              class="rounded-xl border border-border bg-background/90 px-3 py-2 shadow-sm backdrop-blur"
            >
              <div class="text-xs font-semibold text-foreground">
                {canvasBlockCountText}
              </div>
              <div class="mt-0.5 text-[0.6875rem] text-muted-foreground">
                {t("txWorkflowCanvasExecutionOrder")}
              </div>
            </div>
          </Panel>
        </SvelteFlow>
      </div>
      <div
        role="group"
        aria-label={t("txWorkflowCanvasViewToolbar")}
        class="flex shrink-0 flex-wrap items-center justify-center gap-2 border-t border-border bg-background/95 p-2 backdrop-blur"
      >
        <Button
          variant="outline"
          size="sm"
          type="button"
          title={t("txBlockEditorJsonTab")}
          aria-label={t("txBlockEditorJsonTab")}
          onclick={() => openCanvasView("json")}
        >
          <BracesIcon data-icon="inline-start" />
          <span class="hidden sm:inline">{t("txBlockEditorJsonTab")}</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          type="button"
          title={t("txBlockEditorReadonlyTab")}
          aria-label={t("txBlockEditorReadonlyTab")}
          onclick={() => openCanvasView("readonly")}
        >
          <EyeIcon data-icon="inline-start" />
          <span class="hidden sm:inline">{t("txBlockEditorReadonlyTab")}</span>
        </Button>
      </div>
    </div>

    <div
      bind:offsetHeight={toolbarHeight}
      class="pointer-events-none absolute inset-x-3 top-3 z-20 grid gap-3"
    >
      <div class="flex min-w-0 items-center justify-between gap-2">
        {@render panelToggle("settings")}
        {@render panelToggle("inspector")}
      </div>
      {#if !settingsCollapsed}
        <section
          id={`${panelId}-settings`}
          aria-label={t("txWorkflowSettingsTitle")}
          class="canvas-window pointer-events-auto w-full min-w-0 overflow-hidden rounded-xl border border-border bg-background/95 shadow-lg backdrop-blur lg:w-[30rem]"
          transition:fly={{
            y: -8,
            duration: reducedMotion.current ? 0 : 180,
            easing: cubicOut,
          }}
        >
          <div
            class="flex items-center justify-between gap-3 border-b border-border bg-muted/20 px-3 py-3"
          >
            <p class="text-xs leading-relaxed text-muted-foreground">
              {t("txWorkflowCanvasSettingsHint")}
            </p>
            <Badge variant="secondary" class="shrink-0 font-normal tabular-nums"
              >{canvasBlockCountText}</Badge
            >
          </div>
          <ReadonlyFields disabled={readonly} class="min-w-0 p-3">
            <PresenceFieldGrid
              fieldRows={workflowRootFieldRows}
              valueHandlerMode="event"
              hostClass="grid gap-3 sm:grid-cols-[minmax(14rem,1fr)_minmax(10rem,12rem)]"
              presenceControlsMode="hidden"
              onValueChangeForKey={workflowActionHandlers.valueHandler}
              onPresenceChangeForKey={workflowActionHandlers.presenceToggle}
            />
          </ReadonlyFields>
        </section>
      {/if}
    </div>

    {#if !inspectorCollapsed}
      <aside
        id={`${panelId}-inspector`}
        class="canvas-window tx-workflow-inspector relative mt-3 min-w-0 rounded-2xl border border-border bg-background/95 shadow-2xl backdrop-blur lg:absolute lg:bottom-[4.75rem] lg:right-3 lg:z-20 lg:mt-0 lg:flex lg:flex-col"
        style={`--inspector-width: ${effectiveInspectorWidth}px; --inspector-top: ${toolbarHeight + 24}px`}
        aria-label={inspectorTitle}
        transition:fly={{
          x: compactCanvas ? 0 : 12,
          y: compactCanvas ? 8 : 0,
          duration: reducedMotion.current ? 0 : 200,
          easing: cubicOut,
        }}
      >
        <button
          type="button"
          class="group absolute -left-3 bottom-0 top-0 hidden w-6 touch-none cursor-col-resize items-center justify-center text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none lg:flex"
          aria-label={t("txWorkflowInspectorResize")}
          title={t("txWorkflowInspectorResize")}
          onpointerdown={startInspectorResize}
          onkeydown={resizeInspectorWithKeyboard}
        >
          <span
            class="flex h-10 w-3 items-center justify-center rounded-full border border-border bg-background shadow-sm transition-colors group-hover:border-primary/40 group-focus-visible:ring-2 group-focus-visible:ring-ring motion-reduce:transition-none"
          >
            <GripVerticalIcon class="size-3" />
          </span>
        </button>

        <header
          class="rounded-t-2xl border-b border-border bg-muted/20 p-3 sm:p-4"
        >
          <div
            class="flex min-w-0 flex-wrap items-center justify-between gap-3"
          >
            <div class="flex min-w-0 flex-1 items-center gap-3">
              <span
                class="flex size-8 shrink-0 items-center justify-center rounded-md bg-chart-2/10 font-mono text-xs font-medium tabular-nums text-chart-2"
              >
                {#if selectedBlockRow}
                  {String(selectedBlockRow.blockIndex + 1).padStart(2, "0")}
                {:else}
                  <LayersIcon class="size-4" />
                {/if}
              </span>
              <div class="min-w-0">
                <div class="truncate text-sm font-semibold text-foreground">
                  {inspectorTitle}
                </div>
                {#if selectedBlockRow}
                  <div class="mt-0.5 truncate text-xs text-muted-foreground">
                    {inspectorHint}
                  </div>
                {/if}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              type="button"
              title={t("txWorkflowInspectorCollapse")}
              aria-label={t("txWorkflowInspectorCollapse")}
              onclick={() => {
                collapseInspector();
                panelToggles.inspector?.focus();
              }}
            >
              <PanelRightCloseIcon />
            </Button>
          </div>
          {#if selectedBlockRow && (selectedTarget.kind !== "block" || (selectedTarget.stepIndex === undefined && !selectedTarget.operation))}
            <div
              class="mt-3 flex items-center gap-1 border-t border-border/60 pt-2"
            >
              <Button
                variant="ghost"
                size="icon-sm"
                type="button"
                title={t("txWorkflowMoveBlockUp")}
                aria-label={t("txWorkflowMoveBlockUp")}
                disabled={readonly || selectedBlockRow.blockIndex === 0}
                onclick={() =>
                  moveBlock(
                    selectedBlockRow.block.editorId,
                    selectedBlockRow.blockIndex - 1,
                  )}
              >
                <ArrowUpIcon />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                type="button"
                title={t("txWorkflowMoveBlockDown")}
                aria-label={t("txWorkflowMoveBlockDown")}
                disabled={readonly ||
                  selectedBlockRow.blockIndex ===
                    (selectedScopeModel?.blocks.length ?? 0) - 1}
                onclick={() =>
                  moveBlock(
                    selectedBlockRow.block.editorId,
                    selectedBlockRow.blockIndex + 1,
                  )}
              >
                <ArrowDownIcon />
              </Button>
              <Button
                disabled={readonly}
                variant="ghost"
                size="icon-sm"
                type="button"
                title={t("txWorkflowDuplicateBlock")}
                aria-label={t("txWorkflowDuplicateBlock")}
                onclick={() => duplicateBlock(selectedBlockRow.block.editorId)}
              >
                <CopyIcon />
              </Button>
              <Button
                disabled={readonly}
                variant="ghost"
                size="icon-sm"
                type="button"
                class="text-destructive hover:text-destructive"
                title={t("txWorkflowDeleteBlock")}
                aria-label={t("txWorkflowDeleteBlock")}
                onclick={() => removeBlock(selectedBlockRow.block.editorId)}
              >
                <Trash2Icon />
              </Button>
            </div>
          {/if}
        </header>

        <div
          class="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-b-2xl p-3 sm:p-4"
        >
          {#key currentLanguage}
            {#if selectedBlockRow}
              <ReadonlyFields disabled={readonly} scopeOnly class="min-w-0">
                {@render nodeEditor(selectedBlockRow)}
              </ReadonlyFields>
            {:else}
              <div
                class="flex min-h-48 flex-col items-center justify-center gap-4 px-4 py-8 text-center"
              >
                <div
                  class="flex size-12 items-center justify-center rounded-2xl border border-dashed border-primary/25 bg-primary/5 text-primary/70"
                >
                  <LayersIcon class="size-5" />
                </div>
                <p
                  class="max-w-60 text-xs leading-relaxed text-muted-foreground"
                >
                  {t("txWorkflowInspectorNoSelectionHint")}
                </p>
              </div>
            {/if}
          {/key}
        </div>
      </aside>
    {/if}
  </div>
{/if}

<style>
  .tx-workflow-inspector {
    width: 100%;
  }

  @media (min-width: 64rem) {
    .tx-workflow-inspector {
      top: var(--inspector-top);
      width: min(var(--inspector-width), calc(100% - 1.5rem));
      transition: top 180ms ease;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .tx-workflow-inspector {
      transition: none;
    }
  }
</style>
