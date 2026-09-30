<script lang="ts">
  import FlowInsertNode from "$components/fragments/FlowInsertNode.svelte";
  import type { ComponentProps } from "svelte";
  import ReadonlyFields from "$components/fragments/ReadonlyFields.svelte";
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
  import ArrowRightIcon from "@lucide/svelte/icons/arrow-right";
  import BracesIcon from "@lucide/svelte/icons/braces";
  import CopyIcon from "@lucide/svelte/icons/copy";
  import EyeIcon from "@lucide/svelte/icons/eye";
  import GripVerticalIcon from "@lucide/svelte/icons/grip-vertical";
  import PanelRightCloseIcon from "@lucide/svelte/icons/panel-right-close";
  import SlidersHorizontalIcon from "@lucide/svelte/icons/sliders-horizontal";
  import LayersIcon from "@lucide/svelte/icons/layers";
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import {
    Background,
    BackgroundVariant,
    Controls,
    MarkerType,
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
  import { txBlockTimelineDisplay } from "$domains/transactions/index.js";
  import { createTransactionBlockTemplateRegistry } from "$domains/transactions/index.js";
  import { browserConfirm } from "$lib/browser.js";
  import { readonlyFieldsContextKey } from "$lib/svelte.js";
  import { createTxWorkflowVisualEditorWorkspace } from "$domains/transactions/index.js";
  import TxWorkflowBlockEditor from "$domains/transactions/presentation/components/workflow/TxWorkflowBlockEditor.svelte";
  import TxWorkflowFlowNode from "$domains/transactions/presentation/components/workflow/TxWorkflowFlowNode.svelte";
  import TxWorkflowFlowViewportController from "$domains/transactions/presentation/components/workflow/TxWorkflowFlowViewportController.svelte";

  import type {
    TxWorkflowBlockRow,
    TxWorkflowFlowNodeData,
    TxWorkflowFormModel,
  } from "$domains/transactions/index.js";

  type TxWorkflowEditorView = "json" | "readonly";
  type TxWorkflowBlockNode = Node<TxWorkflowFlowNodeData, "workflowNode">;
  type TxWorkflowAppendNode = Node<
    ComponentProps<typeof FlowInsertNode>["data"] & { kind: "append" },
    "workflowAppend"
  >;
  type TxWorkflowGraphNode = TxWorkflowBlockNode | TxWorkflowAppendNode;
  const appendNodeId = "workflow-append";
  type TxWorkflowGraphEdge = Edge<Record<string, never>, "smoothstep">;
  type TxWorkflowSelection =
    { blockIndex: number; kind: "block" } | { blockIndex: null; kind: "none" };

  interface Props {
    readonly?: boolean;
    embedded?: boolean;
    model: TxWorkflowFormModel;
    onChange?: ((model: TxWorkflowFormModel) => void) | null;
    onOpenView?: (view: TxWorkflowEditorView) => void;
    settingsOnly?: boolean;
  }

  let {
    readonly = false,
    model,
    onChange,
    onOpenView,
    embedded = false,
    settingsOnly = false,
  }: Props = $props();

  const inheritedReadonly = getContext<(() => boolean) | undefined>(
    readonlyFieldsContextKey,
  );
  const blockTemplates = createTransactionBlockTemplateRegistry({
    getModel: () => model,
    onChange: (next) => onChange?.(next),
    canModify: () => !readonly && !inheritedReadonly?.(),
    templateOptions: {
      confirmReplace: () =>
        browserConfirm(t("orchestrationDiscardChangesConfirm")),
    },
  });
  $effect(() => {
    blockTemplates.sync(model);
  });
  onDestroy(blockTemplates.destroy);

  const txWorkflowVisualEditorWorkspace =
    createTxWorkflowVisualEditorWorkspace();
  const nodeTypes = {
    workflowNode: TxWorkflowFlowNode,
    workflowAppend: FlowInsertNode,
  };
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
  let selectedTarget = $state<TxWorkflowSelection>({
    kind: "block",
    blockIndex: 0,
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
  let inspectorWidth = $state(560);
  let compactViewport = $state(
    typeof window !== "undefined" &&
      window.matchMedia("(max-width: 1023px)").matches,
  );
  let compactCanvas = $derived(compactViewport);
  let canvasHost = $state<HTMLElement | null>(null);
  let inspectorResizeCleanup = $state<(() => void) | null>(null);
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
      : appendNodeId,
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
  let graphNodes = $derived.by<TxWorkflowGraphNode[]>(() => {
    currentLanguage;
    const blockNodes = blockRows.map((blockRow): TxWorkflowBlockNode => {
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
          readonly,
          kind: "block",
          blockIndex: blockRow.blockIndex,
          titleText,
          metaText,
          sequenceText: String(blockRow.blockIndex + 1),
          isTemplate: blockRow.showTemplateRef,
          hasTarget: blockRow.blockIndex > 0,
          hasSource: true,
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
    const lastBlock = blockNodes.at(-1);
    return [
      ...blockNodes,
      {
        id: appendNodeId,
        type: "workflowAppend",
        position: lastBlock
          ? compactCanvas
            ? { x: lastBlock.position.x + 138, y: lastBlock.position.y + 250 }
            : { x: lastBlock.position.x + 368, y: lastBlock.position.y + 58 }
          : compactCanvas
            ? { x: 138, y: 340 }
            : { x: 238, y: 300 },
        width: 44,
        height: 44,
        data: {
          kind: "append",
          afterNodeId: lastBlock?.id,
          readonly,
          hasSource: false,
          hasTarget: !!lastBlock,
          vertical: compactCanvas,
          labelText: t("txWorkflowFormAddBlock"),
          onInsert: addBlock,
        },
        draggable: false,
        deletable: false,
        connectable: false,
        selectable: false,
        focusable: false,
      },
    ];
  });
  let graphEdges = $derived.by<TxWorkflowGraphEdge[]>(() => {
    return blockRows.map((blockRow, index) => ({
      id: `workflow-edge-${index + 1}`,
      source: `workflow-block-${blockRow.blockIndex}`,
      target:
        index === blockRows.length - 1
          ? appendNodeId
          : `workflow-block-${blockRows[index + 1].blockIndex}`,
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

  function blockName(blockRow: TxWorkflowBlockRow): string {
    if (blockRow.showTemplateRef) {
      return (
        blockRow.block?.templateRef?.name ||
        blockRow.block?.templateRef?.txBlockTemplateName ||
        t("txWorkflowTemplateSourceName")
      );
    }
    return blockRow.block?.inlineBlock?.name || blockRow.titleText;
  }

  function blockMeta(blockRow: TxWorkflowBlockRow): string {
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

  function openInspector(): void {
    inspectorCollapsed = false;
  }

  function selectBlock(blockIndex: number): void {
    selectedTarget = { kind: "block", blockIndex };
    openInspector();
  }

  function selectGraphNode({ node }: { node: TxWorkflowGraphNode }): void {
    if (node?.data?.kind === "block") {
      selectBlock(node.data.blockIndex);
    }
  }

  function addBlock(): void {
    if (readonly) return;
    const nextIndex = blockRows.length;
    workflowActionHandlers.appendBlock();
    selectBlock(nextIndex);
  }

  function duplicateBlock(blockIndex: number): void {
    workflowActionHandlers.duplicateBlock(blockIndex);
    selectBlock(blockIndex + 1);
  }

  function moveBlock(blockIndex: number, targetIndex: number): void {
    workflowActionHandlers.moveBlock(blockIndex, targetIndex);
    selectBlock(targetIndex);
  }

  function removeBlock(blockIndex: number): void {
    workflowActionHandlers.removeBlock(blockIndex);
    if (blockRows.length <= 1) {
      selectedTarget = { kind: "none", blockIndex: null };
      return;
    }
    selectBlock(Math.max(0, blockIndex - 1));
  }

  function inspectorWidthLimit(nextWidth: number): number {
    const hostWidth = canvasHost?.clientWidth || 1024;
    const maxWidth = Math.max(380, Math.min(860, hostWidth - 360));
    return Math.min(Math.max(nextWidth, 380), maxWidth);
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
    const startWidth = inspectorWidth;
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
    inspectorWidth = inspectorWidthLimit(inspectorWidth + delta);
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
        if (!readonly) onChange?.(nextModel);
      },
    });
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
  {@const Icon = isSettings ? SlidersHorizontalIcon : LayersIcon}
  {@const label = isSettings
    ? t(collapsed ? "txWorkflowSettingsExpand" : "txWorkflowSettingsCollapse")
    : t(
        collapsed ? "txWorkflowInspectorExpand" : "txWorkflowInspectorCollapse",
      )}
  <Button
    bind:ref={panelToggles[kind]}
    variant="ghost"
    type="button"
    aria-label={label}
    aria-expanded={!collapsed}
    aria-controls={`${panelId}-${kind}`}
    title={label}
    class={classNames(
      "pointer-events-auto group h-11 min-w-0 shrink gap-2 rounded-xl border px-2.5 shadow-sm backdrop-blur-xl transition-all duration-200 motion-reduce:transition-none sm:gap-3 sm:pr-3",
      collapsed
        ? "border-border/80 bg-background/95 hover:border-primary/30 hover:bg-background"
        : "border-primary/25 bg-background text-primary ring-2 ring-primary/5 hover:bg-background aria-expanded:bg-background aria-expanded:text-primary",
    )}
    onclick={() => {
      if (isSettings) settingsCollapsed ? expandSettings() : collapseSettings();
      else inspectorCollapsed ? openInspector() : collapseInspector();
    }}
  >
    <span
      class={classNames(
        "flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors motion-reduce:transition-none",
        collapsed
          ? "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
          : "bg-primary/10 text-primary",
      )}
    >
      <Icon class="size-3.5" />
    </span>
    <span class="truncate text-xs font-medium"
      >{t(
        isSettings ? "txWorkflowSettingsTitle" : "txWorkflowInspectorTitle",
      )}</span
    >
    <ChevronDownIcon
      class={classNames(
        "size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none",
        !collapsed && "rotate-180 text-primary",
      )}
    />
  </Button>
{/snippet}

{#snippet addBlockAction()}
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
{/snippet}

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
          {@render addBlockAction()}
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
                    disabled={readonly || blockRow.blockIndex === 0}
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
                    disabled={readonly ||
                      blockRow.blockIndex === blockRows.length - 1}
                    onclick={() =>
                      moveBlock(blockRow.blockIndex, blockRow.blockIndex + 1)}
                  >
                    <ArrowRightIcon />
                  </Button>
                  <Button
                    disabled={readonly}
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
                    disabled={readonly}
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
            <TxWorkflowBlockEditor
              blockRow={selectedBlockRow}
              {editorDisplay}
              blockActionHandlers={workflowActionHandlers.blockBindings(
                selectedBlockRow.blockIndex,
              )}
              showRemoveAction={false}
              templateWorkspace={blockTemplates.getWorkspace(
                selectedBlockRow.block,
              )}
            />
          </ReadonlyFields>
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
            endNodeId={selectedTarget.blockIndex === blockRows.length - 1
              ? appendNodeId
              : ""}
            inspectorOpen={!inspectorCollapsed}
            {inspectorWidth}
          />

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
        class="flex shrink-0 flex-wrap items-center justify-center gap-2 border-t border-border bg-background/95 p-2 backdrop-blur"
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
          class="canvas-window pointer-events-auto overflow-hidden rounded-2xl border border-border/80 bg-background/95 shadow-lg backdrop-blur-xl"
          transition:fly={{
            y: -8,
            duration: reducedMotion.current ? 0 : 180,
            easing: cubicOut,
          }}
        >
          <div
            class="flex items-center justify-between gap-3 border-b border-border/60 bg-muted/20 px-4 py-3"
          >
            <p class="text-xs leading-relaxed text-muted-foreground">
              {t("txWorkflowCanvasSettingsHint")}
            </p>
            <Badge variant="secondary" class="shrink-0 font-normal tabular-nums"
              >{canvasBlockCountText}</Badge
            >
          </div>
          <ReadonlyFields disabled={readonly} class="min-w-0 p-4">
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
        class="canvas-window tx-workflow-inspector relative mt-3 min-w-0 rounded-2xl border border-border/80 bg-background/95 shadow-xl backdrop-blur-xl lg:absolute lg:bottom-[4.75rem] lg:right-3 lg:z-20 lg:mt-0 lg:flex lg:flex-col"
        style={`--inspector-width: ${inspectorWidth}px; --inspector-top: ${toolbarHeight + 24}px`}
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
          class="rounded-t-2xl border-b border-border/60 bg-muted/20 p-3 sm:p-4"
        >
          <div
            class="flex min-w-0 flex-wrap items-center justify-between gap-3"
          >
            <div class="flex min-w-0 flex-1 items-center gap-3">
              <span
                class="flex size-9 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 font-mono text-xs font-medium tabular-nums text-primary"
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
          {#if selectedBlockRow}
            <div
              class="mt-3 flex items-center gap-1 border-t border-border/60 pt-2"
            >
              <Button
                variant="ghost"
                size="icon-sm"
                type="button"
                title={t("txWorkflowMoveBlockLeft")}
                aria-label={t("txWorkflowMoveBlockLeft")}
                disabled={readonly || selectedBlockRow.blockIndex === 0}
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
                disabled={readonly ||
                  selectedBlockRow.blockIndex === blockRows.length - 1}
                onclick={() =>
                  moveBlock(
                    selectedBlockRow.blockIndex,
                    selectedBlockRow.blockIndex + 1,
                  )}
              >
                <ArrowRightIcon />
              </Button>
              <Button
                disabled={readonly}
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
                disabled={readonly}
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
            </div>
          {/if}
        </header>

        <div
          class="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-b-2xl p-3 sm:p-4"
        >
          {#key currentLanguage}
            {#if selectedBlockRow}
              <ReadonlyFields disabled={readonly} scopeOnly class="min-w-0">
                <TxWorkflowBlockEditor
                  blockRow={selectedBlockRow}
                  {editorDisplay}
                  blockActionHandlers={workflowActionHandlers.blockBindings(
                    selectedBlockRow.blockIndex,
                  )}
                  showRemoveAction={false}
                  templateWorkspace={blockTemplates.getWorkspace(
                    selectedBlockRow.block,
                  )}
                />
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

  .canvas-window {
    box-shadow:
      0 8px 32px -12px color-mix(in oklch, var(--foreground) 16%, transparent),
      0 2px 6px -2px color-mix(in oklch, var(--foreground) 6%, transparent);
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
