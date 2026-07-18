<script>
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
  import ArrowRightIcon from "@lucide/svelte/icons/arrow-right";
  import BracesIcon from "@lucide/svelte/icons/braces";
  import CopyIcon from "@lucide/svelte/icons/copy";
  import EyeIcon from "@lucide/svelte/icons/eye";
  import GripVerticalIcon from "@lucide/svelte/icons/grip-vertical";
  import PanelRightCloseIcon from "@lucide/svelte/icons/panel-right-close";
  import PanelRightOpenIcon from "@lucide/svelte/icons/panel-right-open";
  import PanelTopCloseIcon from "@lucide/svelte/icons/panel-top-close";
  import PanelTopOpenIcon from "@lucide/svelte/icons/panel-top-open";
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
  import "@xyflow/svelte/dist/style.css";
  import { onDestroy, onMount } from "svelte";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import PresenceFieldGrid from "../../components/fragments/PresenceFieldGrid.svelte";
  import StatusCard from "../../components/fragments/StatusCard.svelte";
  import { currentLanguageState, t } from "../../lib/i18n.js";
  import { classNames } from "../../lib/ui.js";
  import { txBlockTimelineDisplay } from "../../modules/transactionBlockDisplayState.js";
  import { createTxWorkflowVisualEditorWorkspace } from "../../modules/transactionWorkflowEditors.js";
  import TxWorkflowBlockEditor from "./TxWorkflowBlockEditor.svelte";
  import TxWorkflowFlowNode from "./TxWorkflowFlowNode.svelte";
  import TxWorkflowFlowViewportController from "./TxWorkflowFlowViewportController.svelte";

  let {
    model,
    onChange,
    onOpenView,
    embedded = false,
    settingsOnly = false,
  } = $props();

  const txWorkflowVisualEditorWorkspace =
    createTxWorkflowVisualEditorWorkspace();
  const nodeTypes = { workflowNode: TxWorkflowFlowNode };
  const {
    blockRowsStateStore,
    editorDisplayStateStore,
    setVisualEditorContext,
    workflowActionHandlersStateStore,
    workflowRootFieldRowsStateStore,
  } = txWorkflowVisualEditorWorkspace;

  let blockRows = $derived($blockRowsStateStore);
  let workflowActionHandlers = $derived($workflowActionHandlersStateStore);
  let editorDisplay = $derived($editorDisplayStateStore);
  let workflowRootFieldRows = $derived($workflowRootFieldRowsStateStore);
  let currentLanguage = $derived($currentLanguageState);
  let selectedTarget = $state({ kind: "block", blockIndex: 0 });
  let settingsCollapsed = $state(false);
  let inspectorCollapsed = $state(false);
  let inspectorWidth = $state(560);
  let compactViewport = $state(
    typeof window !== "undefined" &&
      window.matchMedia("(max-width: 1023px)").matches,
  );
  let compactCanvas = $derived(compactViewport);
  let canvasHost = $state(null);
  let inspectorResizeCleanup = null;
  let selectedBlockRow = $derived(
    selectedTarget.kind === "block"
      ? blockRows.find(
          (blockRow) => blockRow.blockIndex === selectedTarget.blockIndex,
        ) || null
      : null,
  );
  let selectedNodeId = $derived(
    selectedTarget.kind === "block"
      ? `workflow-block-${selectedTarget.blockIndex}`
      : "",
  );
  let canvasBlockCountText = $derived.by(() => {
    currentLanguage;
    return t("txWorkflowCanvasBlockCount").replace(
      "{count}",
      String(blockRows.length),
    );
  });
  let inspectorTitle = $derived.by(() => {
    currentLanguage;
    return selectedBlockRow
      ? blockName(selectedBlockRow)
      : t("txWorkflowInspectorNoSelection");
  });
  let inspectorHint = $derived.by(() => {
    currentLanguage;
    return selectedBlockRow
      ? blockMeta(selectedBlockRow)
      : t("txWorkflowInspectorNoSelectionHint");
  });
  let graphNodes = $derived.by(() => {
    currentLanguage;
    const blockNodes = blockRows.map((blockRow) => {
      const titleText = blockName(blockRow);
      const metaText = blockMeta(blockRow);
      const timelineRows = blockRow.showInlineBlock
        ? txBlockTimelineDisplay(blockRow.block?.inlineBlock).stepRows
        : [];
      const remainingCount = Math.max(0, timelineRows.length - 4);
      return {
        id: `workflow-block-${blockRow.blockIndex}`,
        type: "workflowNode",
        position: compactCanvas
          ? { x: 0, y: 340 + blockRow.blockIndex * 250 }
          : { x: 100 + blockRow.blockIndex * 390, y: 300 },
        data: {
          kind: "block",
          blockIndex: blockRow.blockIndex,
          titleText,
          metaText,
          sequenceText: String(blockRow.blockIndex + 1),
          isTemplate: blockRow.showTemplateRef,
          hasTarget: blockRow.blockIndex > 0,
          hasSource: blockRow.blockIndex < blockRows.length - 1,
          vertical: compactCanvas,
          commandRows: timelineRows.slice(0, 4),
          emptyCommandText: blockRow.showTemplateRef
            ? t("txWorkflowNodeTemplateCommands")
            : t("txWorkflowNodeNoCommands"),
          remainingCommandText:
            remainingCount > 0
              ? t("txWorkflowNodeMoreCommands").replace(
                  "{count}",
                  String(remainingCount),
                )
              : "",
          canMoveLeft: blockRow.blockIndex > 0,
          canMoveRight: blockRow.blockIndex < blockRows.length - 1,
          moveLeftLabel: t("txWorkflowMoveBlockLeft"),
          moveRightLabel: t("txWorkflowMoveBlockRight"),
          duplicateLabel: t("txWorkflowDuplicateBlock"),
          deleteLabel: t("txWorkflowDeleteBlock"),
          onMoveLeft: () =>
            moveBlock(blockRow.blockIndex, blockRow.blockIndex - 1),
          onMoveRight: () =>
            moveBlock(blockRow.blockIndex, blockRow.blockIndex + 1),
          onDuplicate: () => duplicateBlock(blockRow.blockIndex),
          onDelete: () => removeBlock(blockRow.blockIndex),
        },
        selected:
          selectedTarget.kind === "block" &&
          selectedTarget.blockIndex === blockRow.blockIndex,
        draggable: false,
        deletable: false,
        connectable: false,
        focusable: true,
        ariaRole: "button",
        ariaLabel: `${blockRow.blockIndex + 1}. ${titleText}. ${metaText}`,
      };
    });
    return blockNodes;
  });
  let graphEdges = $derived.by(() => {
    if (blockRows.length < 2) return [];
    return blockRows.slice(1).map((blockRow) => ({
      id: `workflow-edge-${blockRow.blockIndex}`,
      source: `workflow-block-${blockRow.blockIndex - 1}`,
      target: `workflow-block-${blockRow.blockIndex}`,
      type: "smoothstep",
      selectable: false,
      focusable: false,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: "var(--primary)",
        width: 14,
        height: 14,
      },
      style: "stroke: var(--primary); stroke-width: 1.5;",
    }));
  });

  function blockName(blockRow) {
    if (blockRow.showTemplateRef) {
      return (
        blockRow.block?.templateRef?.name ||
        blockRow.block?.templateRef?.txBlockTemplateName ||
        t("txWorkflowTemplateSourceName")
      );
    }
    return blockRow.block?.inlineBlock?.name || blockRow.titleText;
  }

  function blockMeta(blockRow) {
    if (blockRow.showTemplateRef) {
      return t("txWorkflowBlockSourceTemplate");
    }
    const inlineBlock = blockRow.block?.inlineBlock || {};
    const stepCount = Array.isArray(inlineBlock.steps)
      ? inlineBlock.steps.length
      : 0;
    const rollbackKind = inlineBlock.rollbackPolicy?.kind || "none";
    return `${stepCount} ${t("txBlockSummarySteps")} · ${rollbackKind}`;
  }

  function openInspector() {
    inspectorCollapsed = false;
  }

  function selectBlock(blockIndex) {
    selectedTarget = { kind: "block", blockIndex };
    openInspector();
  }

  function selectGraphNode({ node }) {
    if (node?.data?.kind === "block") {
      selectBlock(node.data.blockIndex);
    }
  }

  function addBlock() {
    const nextIndex = blockRows.length;
    workflowActionHandlers.appendBlock();
    selectBlock(nextIndex);
  }

  function duplicateBlock(blockIndex) {
    workflowActionHandlers.duplicateBlock(blockIndex);
    selectBlock(blockIndex + 1);
  }

  function moveBlock(blockIndex, targetIndex) {
    workflowActionHandlers.moveBlock(blockIndex, targetIndex);
    selectBlock(targetIndex);
  }

  function removeBlock(blockIndex) {
    workflowActionHandlers.removeBlock(blockIndex);
    if (blockRows.length <= 1) {
      selectedTarget = { kind: "none", blockIndex: null };
      return;
    }
    selectBlock(Math.max(0, blockIndex - 1));
  }

  function inspectorWidthLimit(nextWidth) {
    const hostWidth = canvasHost?.clientWidth || 1024;
    const maxWidth = Math.max(380, Math.min(860, hostWidth - 360));
    return Math.min(Math.max(nextWidth, 380), maxWidth);
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
    const delta = event.key === "ArrowLeft" ? 32 : -32;
    inspectorWidth = inspectorWidthLimit(inspectorWidth + delta);
  }

  function collapseInspector() {
    clearInspectorResize();
    inspectorCollapsed = true;
  }

  function collapseSettings() {
    settingsCollapsed = true;
  }

  function expandSettings() {
    settingsCollapsed = false;
  }

  function collapseCanvasWindows() {
    collapseSettings();
    collapseInspector();
  }

  function openCanvasView(nextView) {
    if (typeof onOpenView === "function") {
      onOpenView(nextView);
    }
  }

  $effect(() => {
    setVisualEditorContext({ model, onChange });
  });

  $effect(() => {
    const hasSelectedBlock =
      selectedTarget.kind === "block" &&
      blockRows.some(
        (blockRow) => blockRow.blockIndex === selectedTarget.blockIndex,
      );
    if (hasSelectedBlock) return;
    if (blockRows.length) {
      selectedTarget = { kind: "block", blockIndex: 0 };
    } else if (selectedTarget.kind !== "none") {
      selectedTarget = { kind: "none", blockIndex: null };
    }
  });

  onDestroy(clearInspectorResize);

  onMount(() => {
    const compactQuery = window.matchMedia("(max-width: 1023px)");
    const applyCompactCanvas = () => {
      compactViewport = compactQuery.matches;
    };
    applyCompactCanvas();
    compactQuery.addEventListener("change", applyCompactCanvas);
    return () => compactQuery.removeEventListener("change", applyCompactCanvas);
  });
</script>

{#if embedded}
  <div data-testid="tx-workflow-embedded-editor" class="grid min-w-0 gap-4">
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
            <Button
              variant="outline"
              size="sm"
              type="button"
              onclick={addBlock}
            >
              <PlusIcon data-icon="inline-start" />
              {t("txWorkflowFormAddBlock")}
            </Button>
          {/if}
        </div>
      </header>
      <div class="p-3">
        <PresenceFieldGrid
          fieldRows={workflowRootFieldRows}
          valueHandlerMode="event"
          hostClass="grid min-w-0 gap-3"
          presenceControlsMode="hidden"
          onValueChangeForKey={workflowActionHandlers.valueHandler}
          onPresenceChangeForKey={workflowActionHandlers.presenceToggle}
        />
      </div>
    </section>

    {#if !settingsOnly}
      <section
        class="min-w-0 overflow-hidden rounded-lg border border-border bg-background"
      >
        <header
          class="flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/20 p-3"
        >
          <div class="min-w-0">
            <h4 class="text-sm font-semibold text-foreground">
              {t("txWorkflowFormBlocks")}
            </h4>
            <p class="mt-0.5 text-xs text-muted-foreground">
              {canvasBlockCountText}
            </p>
          </div>
          <Button variant="outline" size="sm" type="button" onclick={addBlock}>
            <PlusIcon data-icon="inline-start" />
            {t("txWorkflowFormAddBlock")}
          </Button>
        </header>

        {#if blockRows.length}
          <div class="max-h-72 divide-y divide-border overflow-y-auto">
            {#each blockRows as blockRow}
              <div
                class={classNames(
                  "flex min-w-0 items-center gap-2 p-2 transition-colors",
                  selectedTarget.kind === "block" &&
                    selectedTarget.blockIndex === blockRow.blockIndex
                    ? "bg-primary/5"
                    : "hover:bg-muted/30",
                )}
              >
                <button
                  type="button"
                  class="flex min-w-0 flex-1 items-center gap-3 rounded-md px-2 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-pressed={selectedTarget.kind === "block" &&
                    selectedTarget.blockIndex === blockRow.blockIndex}
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
                    title={t("txWorkflowMoveBlockLeft")}
                    aria-label={t("txWorkflowMoveBlockLeft")}
                    disabled={blockRow.blockIndex === 0}
                    onclick={() =>
                      moveBlock(blockRow.blockIndex, blockRow.blockIndex - 1)}
                  >
                    <ArrowLeftIcon />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    type="button"
                    title={t("txWorkflowMoveBlockRight")}
                    aria-label={t("txWorkflowMoveBlockRight")}
                    disabled={blockRow.blockIndex === blockRows.length - 1}
                    onclick={() =>
                      moveBlock(blockRow.blockIndex, blockRow.blockIndex + 1)}
                  >
                    <ArrowRightIcon />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    type="button"
                    title={t("txWorkflowDuplicateBlock")}
                    aria-label={t("txWorkflowDuplicateBlock")}
                    onclick={() => duplicateBlock(blockRow.blockIndex)}
                  >
                    <CopyIcon />
                  </Button>
                  <Button
                    class="text-destructive hover:text-destructive"
                    variant="ghost"
                    size="icon-sm"
                    type="button"
                    title={t("txWorkflowDeleteBlock")}
                    aria-label={t("txWorkflowDeleteBlock")}
                    onclick={() => removeBlock(blockRow.blockIndex)}
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
            <Button variant="outline" type="button" onclick={addBlock}>
              <PlusIcon data-icon="inline-start" />
              {t("txWorkflowFormAddBlock")}
            </Button>
          </div>
        {/if}
      </section>

      {#key currentLanguage}
        {#if selectedBlockRow}
          <TxWorkflowBlockEditor
            blockRow={selectedBlockRow}
            {editorDisplay}
            embedded={true}
            blockActionHandlers={workflowActionHandlers.blockBindings(
              selectedBlockRow.blockIndex,
            )}
            showRemoveAction={false}
          />
        {/if}
      {/key}
    {/if}
  </div>
{:else}
  <div
    bind:this={canvasHost}
    data-testid="tx-workflow-editor-layout"
    class="relative min-w-0"
  >
    <div
      class="flex h-[42rem] min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-muted/15 lg:h-[calc(100dvh-14rem)] lg:min-h-[44rem] lg:max-h-[58rem]"
    >
      <div class="tx-workflow-flow min-h-0 flex-1">
        <SvelteFlow
          id="tx-workflow-editor"
          nodes={graphNodes}
          edges={graphEdges}
          {nodeTypes}
          fitView
          fitViewOptions={{
            padding: 0.12,
            maxZoom: 0.9,
            nodes: graphNodes.slice(0, 2).map((node) => ({ id: node.id })),
          }}
          minZoom={0.35}
          maxZoom={1.5}
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
            inspectorOpen={!inspectorCollapsed}
            {inspectorWidth}
          />

          <Panel
            position="top-left"
            class={settingsCollapsed ? "m-3" : "m-3 w-[calc(100%-1.5rem)]"}
          >
            {#if settingsCollapsed}
              <Button
                class="pointer-events-auto shadow-lg"
                variant="secondary"
                size="sm"
                type="button"
                aria-label={t("txWorkflowSettingsExpand")}
                title={t("txWorkflowSettingsExpand")}
                onclick={expandSettings}
              >
                <PanelTopOpenIcon data-icon="inline-start" />
                {t("txWorkflowSettingsTitle")}
              </Button>
            {:else}
              <div
                class="pointer-events-auto grid min-w-0 gap-3 rounded-xl border border-border bg-background/95 p-3 shadow-lg backdrop-blur"
              >
                <div
                  class="flex min-w-0 flex-wrap items-center justify-between gap-2"
                >
                  <div class="min-w-0">
                    <div class="truncate text-sm font-semibold text-foreground">
                      {t("txWorkflowSettingsTitle")}
                    </div>
                    <div class="text-xs text-muted-foreground">
                      {t("txWorkflowCanvasSettingsHint")}
                    </div>
                  </div>
                  <div class="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{canvasBlockCountText}</Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      onclick={addBlock}
                    >
                      <PlusIcon data-icon="inline-start" />
                      {t("txWorkflowFormAddBlock")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      type="button"
                      title={t("txWorkflowSettingsCollapse")}
                      aria-label={t("txWorkflowSettingsCollapse")}
                      onclick={collapseSettings}
                    >
                      <PanelTopCloseIcon />
                    </Button>
                  </div>
                </div>
                <PresenceFieldGrid
                  fieldRows={workflowRootFieldRows}
                  valueHandlerMode="event"
                  hostClass="grid gap-3 sm:grid-cols-[minmax(14rem,1fr)_minmax(10rem,12rem)]"
                  presenceControlsMode="hidden"
                  onValueChangeForKey={workflowActionHandlers.valueHandler}
                  onPresenceChangeForKey={workflowActionHandlers.presenceToggle}
                />
              </div>
            {/if}
          </Panel>

          <Controls
            position="bottom-left"
            orientation="horizontal"
            showLock={false}
            aria-label={t("txWorkflowCanvasControls")}
            buttonBgColor="var(--card)"
            buttonBgColorHover="var(--accent)"
            buttonColor="var(--foreground)"
            buttonColorHover="var(--accent-foreground)"
            buttonBorderColor="var(--border)"
          />
        </SvelteFlow>
      </div>
      <div
        role="group"
        aria-label={t("txWorkflowCanvasViewToolbar")}
        class="flex shrink-0 items-center justify-center gap-2 border-t border-border bg-background/95 p-2 backdrop-blur"
      >
        <Button
          variant="outline"
          size="sm"
          type="button"
          onclick={() => openCanvasView("json")}
        >
          <BracesIcon data-icon="inline-start" />
          {t("txBlockEditorJsonTab")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          type="button"
          onclick={() => openCanvasView("readonly")}
        >
          <EyeIcon data-icon="inline-start" />
          {t("txBlockEditorReadonlyTab")}
        </Button>
      </div>
    </div>

    {#if inspectorCollapsed}
      <Button
        class={classNames(
          "absolute right-4 z-20 shadow-lg",
          settingsCollapsed ? "top-4" : "top-[10.5rem]",
        )}
        variant="secondary"
        size="sm"
        type="button"
        aria-label={t("txWorkflowInspectorExpand")}
        title={t("txWorkflowInspectorExpand")}
        onclick={openInspector}
      >
        <PanelRightOpenIcon data-icon="inline-start" />
        {t("txWorkflowInspectorExpand")}
      </Button>
    {:else}
      <aside
        class={classNames(
          "tx-workflow-inspector mt-3 min-w-0 overflow-hidden rounded-2xl border border-border bg-background/95 shadow-2xl backdrop-blur lg:absolute lg:bottom-[4.75rem] lg:right-4 lg:z-20 lg:mt-0 lg:flex lg:flex-col",
          settingsCollapsed ? "lg:top-4" : "lg:top-[10.5rem]",
        )}
        style={`--inspector-width: ${inspectorWidth}px`}
        aria-label={inspectorTitle}
      >
        <button
          type="button"
          class="absolute -left-3 bottom-0 top-0 hidden w-6 touch-none cursor-col-resize items-center justify-center text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:flex"
          aria-label={t("txWorkflowInspectorResize")}
          title={t("txWorkflowInspectorResize")}
          onpointerdown={startInspectorResize}
          onkeydown={resizeInspectorWithKeyboard}
        >
          <GripVerticalIcon />
        </button>

        <header class="border-b border-border bg-muted/20 p-3 sm:p-4">
          <div class="flex min-w-0 items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="truncate text-sm font-semibold text-foreground">
                {inspectorTitle}
              </div>
              <div class="mt-0.5 truncate text-xs text-muted-foreground">
                {inspectorHint}
              </div>
            </div>
            <div class="flex shrink-0 items-center gap-1">
              {#if selectedBlockRow}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  type="button"
                  title={t("txWorkflowMoveBlockLeft")}
                  aria-label={t("txWorkflowMoveBlockLeft")}
                  disabled={selectedBlockRow.blockIndex === 0}
                  onclick={() =>
                    moveBlock(
                      selectedBlockRow.blockIndex,
                      selectedBlockRow.blockIndex - 1,
                    )}
                >
                  <ArrowLeftIcon />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  type="button"
                  title={t("txWorkflowMoveBlockRight")}
                  aria-label={t("txWorkflowMoveBlockRight")}
                  disabled={selectedBlockRow.blockIndex ===
                    blockRows.length - 1}
                  onclick={() =>
                    moveBlock(
                      selectedBlockRow.blockIndex,
                      selectedBlockRow.blockIndex + 1,
                    )}
                >
                  <ArrowRightIcon />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  type="button"
                  title={t("txWorkflowDuplicateBlock")}
                  aria-label={t("txWorkflowDuplicateBlock")}
                  onclick={() => duplicateBlock(selectedBlockRow.blockIndex)}
                >
                  <CopyIcon />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  type="button"
                  class="text-destructive hover:text-destructive"
                  title={t("txWorkflowDeleteBlock")}
                  aria-label={t("txWorkflowDeleteBlock")}
                  onclick={() => removeBlock(selectedBlockRow.blockIndex)}
                >
                  <Trash2Icon />
                </Button>
              {/if}
              <Button
                variant="ghost"
                size="icon-sm"
                type="button"
                title={t("txWorkflowInspectorCollapse")}
                aria-label={t("txWorkflowInspectorCollapse")}
                onclick={collapseInspector}
              >
                <PanelRightCloseIcon />
              </Button>
            </div>
          </div>
        </header>

        <div class="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
          {#key currentLanguage}
            {#if selectedBlockRow}
              <TxWorkflowBlockEditor
                blockRow={selectedBlockRow}
                {editorDisplay}
                blockActionHandlers={workflowActionHandlers.blockBindings(
                  selectedBlockRow.blockIndex,
                )}
                showRemoveAction={false}
              />
            {:else}
              <div class="grid gap-3">
                <StatusCard message={t("txWorkflowInspectorNoSelectionHint")} />
                <Button variant="outline" type="button" onclick={addBlock}>
                  <PlusIcon data-icon="inline-start" />
                  {t("txWorkflowFormAddBlock")}
                </Button>
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
      width: min(var(--inspector-width), calc(100% - 2rem));
    }
  }
</style>
