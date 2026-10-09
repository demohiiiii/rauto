import type { FlowWorkflowBlockNodeData } from "./flowWorkflowTypes.js";

export const FLOW_WORKFLOW_HEADER_HEIGHT = 116;
export const FLOW_WORKFLOW_FIT_OPTIONS = {
  padding: { top: "96px", right: "32px", bottom: "48px", left: "32px" },
  maxZoom: 0.85,
} as const;
const BLOCK_SIDE = 16;
const BLOCK_TOP_GAP = 20;
const BLOCK_GAP = 12;
const GROUP_BOTTOM = 18;
const ADD_BLOCK_HEIGHT = 44;
const EMPTY_BODY_HEIGHT = 72;

export function flowWorkflowBlockHeight(
  block: Pick<
    FlowWorkflowBlockNodeData,
    "commandRows" | "metaText" | "wholeResourceRollback"
  >,
): number {
  const rollbackCount = block.commandRows.filter(
    (row) => row.rollbackSummaryText,
  ).length;
  return (
    82 +
    Math.max(0, block.commandRows.length - 1) * 28 +
    rollbackCount * 28 +
    (block.metaText ? 24 : 0) +
    (block.wholeResourceRollback ? 64 : 0)
  );
}

export function flowWorkflowGroupLayout(
  blockHeights: readonly number[],
  { width = 340, canAddBlock = true } = {},
) {
  let nextY = FLOW_WORKFLOW_HEADER_HEIGHT + BLOCK_TOP_GAP;
  const blocks = blockHeights.map((height) => {
    const block = {
      width: width - BLOCK_SIDE * 2,
      height,
      position: { x: BLOCK_SIDE, y: nextY },
    };
    nextY += height + BLOCK_GAP;
    return block;
  });
  const bodyBottom = blocks.length
    ? nextY - BLOCK_GAP
    : FLOW_WORKFLOW_HEADER_HEIGHT + BLOCK_TOP_GAP + EMPTY_BODY_HEIGHT;
  return {
    width,
    height: bodyBottom + GROUP_BOTTOM + (canAddBlock ? ADD_BLOCK_HEIGHT : 0),
    blocks,
  };
}
