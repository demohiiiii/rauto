import type {
  FlowWorkflowBlockNodeData,
  FlowWorkflowCommandRow,
} from "./flowWorkflowTypes.js";

export const FLOW_WORKFLOW_HEADER_HEIGHT = 116;
export const FLOW_WORKFLOW_ROLLBACK_WIDTH = 600;
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
const COMMAND_ROW_HEIGHT = 24;
const COMMAND_ROW_GAP = 4;
const NESTED_BLOCK_GAP = 8;
const NESTED_BLOCK_INSET = 44;
const STRUCTURE_BRANCH_HEADER_HEIGHT = 42;
export const FLOW_COMMAND_LINE_HEIGHT = 16;

export function flowCommandLines(command: string): string[] {
  return command.split(/\r\n|\r|\n/);
}

export function flowCommandRowHeight(command: string): number {
  return (
    COMMAND_ROW_HEIGHT +
    (flowCommandLines(command).length - 1) * FLOW_COMMAND_LINE_HEIGHT
  );
}

type FlowWorkflowCommands = Pick<
  FlowWorkflowBlockNodeData,
  "commandRows" | "wholeResourceRollback" | "perStepRollbackEnabled"
>;

export function flowWorkflowHasRollback(block: FlowWorkflowCommands): boolean {
  return (
    !!block.wholeResourceRollback ||
    !!block.perStepRollbackEnabled ||
    block.commandRows.some((row) => !!row.rollbackSummaryText)
  );
}

export function flowWorkflowCommandPairHeight(
  row: FlowWorkflowCommandRow,
): number {
  return Math.max(
    flowCommandRowHeight(row.summaryText),
    row.rollbackSummaryText ? flowCommandRowHeight(row.rollbackSummaryText) : 0,
  );
}

export function flowWorkflowCommandBodyHeight(
  block: FlowWorkflowCommands,
): number {
  const commandRowsHeight = block.commandRows.reduce(
    (height, row) =>
      height +
      (block.wholeResourceRollback
        ? flowCommandRowHeight(row.summaryText)
        : flowWorkflowCommandPairHeight(row)) +
      COMMAND_ROW_GAP,
    0,
  );
  return Math.max(
    COMMAND_ROW_HEIGHT,
    commandRowsHeight - COMMAND_ROW_GAP,
    block.wholeResourceRollback
      ? flowCommandRowHeight(block.wholeResourceRollback.summaryText)
      : 0,
  );
}

export function flowWorkflowBlockHeight(
  block: Pick<
    FlowWorkflowBlockNodeData,
    | "commandRows"
    | "metaText"
    | "wholeResourceRollback"
    | "structure"
    | "canAddCommand"
    | "perStepRollbackEnabled"
  >,
): number {
  if (block.structure) {
    const bodyHeight = block.structure.branches.reduce(
      (height, branch) =>
        height +
        STRUCTURE_BRANCH_HEADER_HEIGHT +
        (block.structure?.kind === "choice" ? 8 : 0) +
        (branch.conditionText !== undefined ? 40 : 0) +
        Math.max(
          COMMAND_ROW_HEIGHT,
          branch.entries.reduce(
            (sum, entry) => sum + flowWorkflowBlockHeight(entry),
            Math.max(0, branch.entries.length - 1) * NESTED_BLOCK_GAP,
          ),
        ) +
        (branch.canAddBlock ? ADD_BLOCK_HEIGHT : 0),
      Math.max(0, block.structure.branches.length - 1) * NESTED_BLOCK_GAP,
    );
    return (
      58 +
      (block.metaText ? 24 : 0) +
      (block.structure.canAddBranch ? ADD_BLOCK_HEIGHT : 0) +
      bodyHeight
    );
  }
  return (
    58 +
    flowWorkflowCommandBodyHeight(block) +
    (block.canAddCommand ? ADD_BLOCK_HEIGHT : 0) +
    (block.metaText ? 24 : 0) +
    (flowWorkflowHasRollback(block) ? 24 : 0)
  );
}

export function flowWorkflowBlockWidth(
  block: FlowWorkflowBlockNodeData,
): number {
  const controlWidth = FLOW_WORKFLOW_ROLLBACK_WIDTH - BLOCK_SIDE * 2;
  if (block.structure) {
    return Math.max(
      controlWidth,
      ...block.structure.branches.flatMap((branch) =>
        branch.entries.map(
          (entry) => flowWorkflowBlockWidth(entry) + NESTED_BLOCK_INSET,
        ),
      ),
    );
  }
  return block.structure || flowWorkflowHasRollback(block)
    ? controlWidth
    : 380 - BLOCK_SIDE * 2;
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
