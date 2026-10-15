import {
  flowWorkflowBlockHeight,
  flowWorkflowBlockWidth,
  flowWorkflowGroupLayout,
} from "../../../components/fragments/flowWorkflowLayout.js";
import type {
  FlowWorkflowBlockNodeData,
  FlowWorkflowGroupNodeData,
} from "../../../components/fragments/flowWorkflowTypes.js";
import { t } from "../../../lib/i18n.js";
import type {
  TxWorkflowFormModel,
  TxBlockFormModel,
  TxBlockCommandTarget,
  TxWorkflowBlockFormModel,
} from "../model/types.js";
import { txBlockTimelineDisplay } from "./transactionBlockDisplayState.js";
import type { TransactionBlockCanvasState } from "../application/transactionBlockTemplateAuthoring.js";

export type TxWorkflowCanvasGroupData = FlowWorkflowGroupNodeData & {
  kind: "workflow";
};
export type TxWorkflowCanvasBlockData = FlowWorkflowBlockNodeData & {
  kind: "block";
  blockIndex: number;
};

export const TX_WORKFLOW_GROUP_ID = "workflow-root";
export const TX_WORKFLOW_CANVAS_DESKTOP_ZOOM = 0.9;

export function txWorkflowNormalizeCommandSelection(
  model: TxBlockFormModel | null | undefined,
  selection: { stepIndex?: number; operation?: TxBlockCommandTarget },
): { stepIndex?: number; operation?: TxBlockCommandTarget } {
  if (!model) return {};
  if (selection.operation === "whole_resource_rollback")
    return model.rollbackPolicy.kind === "whole_resource" &&
      model.rollbackPolicy.wholeResource
      ? { operation: "whole_resource_rollback" }
      : {};
  const index = selection.stepIndex;
  if (
    index === undefined ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= model.steps.length
  )
    return {};
  return {
    stepIndex: index,
    ...(selection.operation
      ? {
          operation:
            selection.operation === "rollback" &&
            model.rollbackPolicy.kind !== "per_step"
              ? "run"
              : selection.operation,
        }
      : {}),
  };
}

export function txWorkflowNodeTitle(block: TxWorkflowBlockFormModel): string {
  if (block.control)
    return block.control.kind === "loop"
      ? t("txWorkflowLoop")
      : block.control.name || t("txWorkflowChoice");
  return t("txWorkflowFormBlock");
}

export function txWorkflowInspectorWidth(
  canvasWidth: number,
  preferredWidth: number,
  workflowWidth: number,
): number {
  const reservedWidth = workflowWidth * TX_WORKFLOW_CANVAS_DESKTOP_ZOOM + 48;
  const maxWidth = Math.max(380, Math.min(1040, canvasWidth - reservedWidth));
  return Math.min(Math.max(preferredWidth, 380), maxWidth);
}

function workflowBlockData(
  block: TxWorkflowBlockFormModel,
  blockIndex: number,
  blockStates: Record<string, TransactionBlockCanvasState>,
  canAddCommands: boolean,
): FlowWorkflowBlockNodeData {
  const control = block.control;
  const isTemplate = block.sourceKind === "template_ref";
  const state = blockStates[block.editorId];
  const blockModel =
    state?.formModel ?? (isTemplate ? null : block.inlineBlock);
  const timeline = txBlockTimelineDisplay(blockModel ?? {});
  return {
    id: block.editorId,
    title: txWorkflowNodeTitle(block),
    sourceKind: isTemplate ? "template" : "manual",
    sequenceText: String(blockIndex + 1),
    commandRows: timeline.stepRows,
    perStepRollbackEnabled: blockModel?.rollbackPolicy.kind === "per_step",
    canAddCommand:
      canAddCommands && !control && (state?.editable ?? !isTemplate),
    wholeResourceRollback: timeline.wholeResourceRollback,
    metaText: control
      ? control.kind === "loop"
        ? `${control.itemVariable} ← ${control.iterations}`
        : t("txWorkflowChoiceBranchCount").replace(
            "{count}",
            String(control.branches.length),
          )
      : isTemplate
        ? [
            t("txWorkflowBlockSourceTemplate"),
            block.templateRef.txBlockTemplateName,
          ]
            .filter(Boolean)
            .join(" · ")
        : `${t("txWorkflowNodeCommandCount").replace("{count}", String(timeline.stepRows.length))} · ${blockModel?.rollbackPolicy.kind ?? "none"}`,
    emptyCommandText: t(
      isTemplate
        ? "txWorkflowNodeTemplateCommands"
        : "txWorkflowNodeNoCommands",
    ),
    hasTarget: false,
    hasSource: false,
    ...(control
      ? {
          structure: {
            kind: control.kind,
            canAddBranch: control.kind === "choice",
            addBranchLabel: t("txWorkflowChoiceAddBranch"),
            branches: (control.kind === "loop"
              ? [
                  {
                    id: "blocks",
                    title: t("txWorkflowLoopBody"),
                    blocks: control.blocks,
                    conditionText: undefined,
                  },
                ]
              : [
                  ...control.branches.map((branch, index) => ({
                    id: branch.editorId,
                    title: t("txWorkflowChoiceBranch").replace(
                      "{index}",
                      String(index + 1),
                    ),
                    conditionText: branch.condition,
                    blocks: branch.blocks,
                  })),
                  {
                    id: "otherwise",
                    title: t("txWorkflowChoiceElse"),
                    conditionText: undefined,
                    blocks: control.otherwise,
                  },
                ]
            ).map((branch) => ({
              id: branch.id,
              title: branch.title,
              conditionText: branch.conditionText,
              conditionLabel: t("txWorkflowChoiceCondition"),
              entries: branch.blocks.map((entry, index) =>
                workflowBlockData(entry, index, blockStates, canAddCommands),
              ),
              emptyText: t("txWorkflowControlEmpty"),
              canAddBlock: true,
              addBlockLabel: t("txWorkflowFormAddBlock"),
            })),
          },
        }
      : {}),
  };
}

export function txWorkflowFlowGraph(
  model: TxWorkflowFormModel,
  {
    canAddBlock = true,
    blockStates = {},
  }: {
    canAddBlock?: boolean;
    blockStates?: Record<string, TransactionBlockCanvasState>;
  } = {},
) {
  const blocks = model.blocks.map((block, blockIndex) => {
    const data: TxWorkflowCanvasBlockData = {
      ...workflowBlockData(block, blockIndex, blockStates, canAddBlock),
      kind: "block",
      blockIndex,
      hasTarget: blockIndex > 0,
      hasSource: blockIndex < model.blocks.length - 1,
    };
    return { id: `workflow-block-${blockIndex}`, data };
  });
  const layout = flowWorkflowGroupLayout(
    blocks.map((block) => flowWorkflowBlockHeight(block.data)),
    {
      width: Math.max(
        380,
        ...blocks.map((block) => flowWorkflowBlockWidth(block.data) + 32),
      ),
      canAddBlock,
    },
  );
  const groupData: TxWorkflowCanvasGroupData = {
    kind: "workflow",
    title: model.name || t("txStageWorkflow"),
    workflowName: model.name ? t("txStageWorkflow") : undefined,
    sourceKind: "manual",
    sourceLabelText: t("commandSourceManual"),
    strategyText: t("txWorkflowCanvasExecutionOrder"),
    blockCountText: t("txWorkflowCanvasNodeCount").replace(
      "{count}",
      String(blocks.length),
    ),
    previewStatus: "ready",
    emptyWorkflow: blocks.length === 0,
    emptyWorkflowText: t("txWorkflowInspectorNoSelectionHint"),
    canAddBlock,
    addBlockLabel: t("txWorkflowFormAddBlock"),
  };
  return {
    group: {
      id: TX_WORKFLOW_GROUP_ID,
      type: "workflowGroup" as const,
      position: { x: 100, y: 100 },
      width: layout.width,
      height: layout.height,
      data: groupData,
    },
    blocks: blocks.map((block, blockIndex) => ({
      ...block,
      type: "workflowNode" as const,
      parentId: TX_WORKFLOW_GROUP_ID,
      extent: "parent" as const,
      ...layout.blocks[blockIndex],
    })),
    edges: blocks.slice(0, -1).map((block, index) => ({
      id: `workflow-edge-${index + 1}`,
      source: block.id,
      sourceHandle: "block-output",
      target: blocks[index + 1].id,
      targetHandle: "block-input",
      type: "smoothstep" as const,
    })),
  };
}
