import {
  flowWorkflowBlockHeight,
  flowWorkflowGroupLayout,
} from "../../../components/fragments/flowWorkflowLayout.js";
import type {
  FlowWorkflowBlockNodeData,
  FlowWorkflowGroupNodeData,
} from "../../../components/fragments/flowWorkflowTypes.js";
import { t } from "../../../lib/i18n.js";
import type { TxWorkflowFormModel } from "../model/types.js";
import { txBlockTimelineDisplay } from "./transactionBlockDisplayState.js";

export type TxWorkflowCanvasGroupData = FlowWorkflowGroupNodeData & {
  kind: "workflow";
};
export type TxWorkflowCanvasBlockData = FlowWorkflowBlockNodeData & {
  kind: "block";
  blockIndex: number;
};

export const TX_WORKFLOW_GROUP_ID = "workflow-root";
export const TX_WORKFLOW_CANVAS_DESKTOP_ZOOM = 0.9;

export function txWorkflowInspectorWidth(
  canvasWidth: number,
  preferredWidth: number,
  workflowWidth: number,
): number {
  const reservedWidth = workflowWidth * TX_WORKFLOW_CANVAS_DESKTOP_ZOOM + 48;
  const maxWidth = Math.max(380, Math.min(1040, canvasWidth - reservedWidth));
  return Math.min(Math.max(preferredWidth, 380), maxWidth);
}

export function txWorkflowFlowGraph(model: TxWorkflowFormModel) {
  const blocks = model.blocks.map((block, blockIndex) => {
    const isTemplate = block.sourceKind === "template_ref";
    const timeline = txBlockTimelineDisplay(
      isTemplate ? {} : block.inlineBlock,
    );
    const data: TxWorkflowCanvasBlockData = {
      kind: "block",
      blockIndex,
      title: isTemplate
        ? block.templateRef.name ||
          block.templateRef.txBlockTemplateName ||
          t("txWorkflowTemplateSourceName")
        : block.inlineBlock.name ||
          `${t("txWorkflowFormBlock")} ${blockIndex + 1}`,
      sourceKind: isTemplate ? "template" : "manual",
      sequenceText: String(blockIndex + 1),
      commandRows: timeline.stepRows,
      wholeResourceRollback: timeline.wholeResourceRollback,
      metaText: isTemplate
        ? t("txWorkflowBlockSourceTemplate")
        : `${timeline.stepRows.length} ${t("txBlockSummarySteps")} · ${block.inlineBlock.rollbackPolicy.kind}`,
      emptyCommandText: t(
        isTemplate
          ? "txWorkflowNodeTemplateCommands"
          : "txWorkflowNodeNoCommands",
      ),
      hasTarget: blockIndex > 0,
      hasSource: blockIndex < model.blocks.length - 1,
    };
    return { id: `workflow-block-${blockIndex}`, data };
  });
  const layout = flowWorkflowGroupLayout(
    blocks.map((block) => flowWorkflowBlockHeight(block.data)),
    { width: 380 },
  );
  const groupData: TxWorkflowCanvasGroupData = {
    kind: "workflow",
    title: model.name || t("txStageWorkflow"),
    workflowName: model.name ? t("txStageWorkflow") : undefined,
    sourceKind: "manual",
    sourceLabelText: t("commandSourceManual"),
    strategyText: t("txWorkflowCanvasExecutionOrder"),
    blockCountText: t("txWorkflowCanvasBlockCount").replace(
      "{count}",
      String(blocks.length),
    ),
    previewStatus: "ready",
    emptyWorkflow: blocks.length === 0,
    emptyWorkflowText: t("txWorkflowInspectorNoSelectionHint"),
    canAddBlock: true,
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
