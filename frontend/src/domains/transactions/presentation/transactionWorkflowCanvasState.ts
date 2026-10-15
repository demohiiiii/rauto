import { txStepAtPath } from "../model/transactionStepTree.js";
import {
  flowWorkflowBlockHeight,
  flowWorkflowBlockWidth,
  flowWorkflowGroupLayout,
} from "../../../components/fragments/flowWorkflowLayout.js";
import type {
  FlowWorkflowBlockNodeData,
  FlowWorkflowCommandRow,
  FlowWorkflowGroupNodeData,
} from "../../../components/fragments/flowWorkflowTypes.js";
import { t } from "../../../lib/i18n.js";
import type {
  TxWorkflowFormModel,
  TxBlockFormModel,
  TxBlockCommandTarget,
  TxWorkflowBlockFormModel,
  TxControlModel,
  TxStepPath,
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

export function txBlockCommandTitle(
  model: TxBlockFormModel | null | undefined,
  path: TxStepPath,
  operation: TxBlockCommandTarget = "run",
): string {
  if (operation === "whole_resource_rollback")
    return t("txBlockFormWholeRollback");
  if (operation === "rollback") return t("txBlockStepRollbackCommand");
  const step = model
    ? (txStepAtPath(model, path) ?? txStepAtPath(model, [path[0]]))
    : null;
  if (step?.control)
    return t(
      step.control.kind === "loop" ? "txWorkflowLoop" : "txWorkflowChoice",
    );
  return step?.run.kind === "flow" ||
    step?.run.commandEditorKind === "interactive" ||
    step?.run.command.interaction?.prompts.length
    ? t("txBlockOperationKindInteractive")
    : t("txBlockFormCommand");
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

function controlStructure<T>(
  control: TxControlModel<T>,
  entries: (items: T[]) => FlowWorkflowBlockNodeData[],
  canAddBlock: boolean,
): NonNullable<FlowWorkflowBlockNodeData["structure"]> {
  return {
    kind: control.kind,
    canAddBranch: control.kind === "choice" && canAddBlock,
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
            blocks: branch.blocks,
            conditionText: branch.condition,
          })),
          {
            id: "otherwise",
            title: t("txWorkflowChoiceElse"),
            blocks: control.otherwise,
            conditionText: undefined,
          },
        ]
    ).map((branch) => ({
      id: branch.id,
      title: branch.title,
      conditionText: branch.conditionText,
      conditionLabel: t("txWorkflowChoiceCondition"),
      entries: entries(branch.blocks),
      emptyText: t("txWorkflowControlEmpty"),
      canAddBlock,
      addBlockLabel: t("txWorkflowFormAddBlock"),
    })),
  };
}

export function txBlockCanvasCommandRows(
  model: TxBlockFormModel,
  canModify = true,
): FlowWorkflowCommandRow[] {
  return txBlockTimelineDisplay(model).stepRows.map((row, index) => {
    const control = model.steps[index].control;
    if (!control) return row;
    return {
      ...row,
      controlNode: {
        title: row.kindText,
        sequenceText: String(index + 1),
        sourceKind: "manual",
        commandRows: [],
        hasSource: false,
        hasTarget: false,
        metaText: row.summaryText,
        structure: {
          ...controlStructure(
            control,
            (steps) => [
              {
                title: t("txBlockStepRunCommand"),
                sequenceText: "",
                sourceKind: "manual",
                commandsOnly: true,
                commandRows: txBlockCanvasCommandRows(
                  {
                    ...model,
                    steps,
                    rollbackPolicy: {
                      kind:
                        model.rollbackPolicy.kind === "per_step"
                          ? "per_step"
                          : "none",
                    },
                  },
                  canModify,
                ),
                perStepRollbackEnabled:
                  model.rollbackPolicy.kind === "per_step",
                canAddCommand: canModify,
                hasSource: false,
                hasTarget: false,
                emptyCommandText: t("txWorkflowNodeNoCommands"),
              },
            ],
            false,
          ),
          canAddBranch: control.kind === "choice" && canModify,
        },
      },
    };
  });
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
    commandRows: blockModel
      ? txBlockCanvasCommandRows(
          blockModel,
          canAddCommands && (state?.editable ?? !isTemplate),
        )
      : [],
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
          structure: controlStructure(
            control,
            (blocks) =>
              blocks.map((entry, index) =>
                workflowBlockData(entry, index, blockStates, canAddCommands),
              ),
            canAddCommands,
          ),
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
