import { t } from "../../../lib/i18n.js";
import { get } from "svelte/store";
import type {
  FlowWorkflowBlockNodeData,
  FlowWorkflowAddActions,
} from "../../../components/fragments/flowWorkflowTypes.js";
import {
  txWorkflowFindBlock,
  txWorkflowBranchModel,
  txWorkflowReplaceBranch,
  txWorkflowReplaceBlock,
  txWorkflowAddChoiceBranch,
  txWorkflowChangeChoiceBranch,
  txWorkflowMoveChoiceBranch,
  txWorkflowRemoveChoiceBranch,
} from "../model/transactionWorkflowTree.js";
import type { TxWorkflowBranch } from "../model/transactionWorkflowTree.js";
import type {
  TxWorkflowChoiceModel,
  TxWorkflowFormModel,
  TxBlockFormModel,
  TxBlockCommandTarget,
} from "../model/types.js";
import {
  txBlockAddStep,
  txBlockDuplicateStep,
  txBlockMoveStep,
  txBlockRemoveStep,
  txBlockStepSplitStatus,
  txBlockSplitStep,
} from "../model/transactionBlockMutations.js";
import { txWorkflowVisualEditorBindings } from "./transactionWorkflowEditorState.js";
import { createTransactionBlockTemplateRegistry } from "./transactionBlockTemplateAuthoring.js";

export function createTransactionWorkflowCanvasWorkspace({
  getModel,
  onChange,
  getSelectedId,
  getSelectedStepIndex = () => null,
  getSelectedOperation = () => "run",
  onSelect,
  onSelectStep,
  onSelectWholeRollback,
  canModify,
  templateOptions,
}: {
  getModel: () => TxWorkflowFormModel;
  onChange: (model: TxWorkflowFormModel) => void;
  getSelectedId: () => string | null;
  getSelectedStepIndex?: () => number | null;
  getSelectedOperation?: () => TxBlockCommandTarget;
  onSelect: (editorId: string | null) => void;
  onSelectStep?: (
    editorId: string,
    stepIndex: number,
    operation?: "run" | "rollback",
  ) => void;
  onSelectWholeRollback?: (editorId: string) => void;
  canModify: () => boolean;
  templateOptions?: Parameters<
    typeof createTransactionBlockTemplateRegistry
  >[0]["templateOptions"];
}) {
  const templates = createTransactionBlockTemplateRegistry({
    getModel,
    onChange,
    canModify,
    templateOptions,
  });

  function changeBranch(
    parentId: string | null,
    branch: TxWorkflowBranch,
    selectIndex: number,
    action: (
      bindings: ReturnType<typeof txWorkflowVisualEditorBindings>,
    ) => void,
  ): void {
    if (!canModify()) return;
    const model = getModel();
    const scope = txWorkflowBranchModel(model, parentId, branch);
    if (!scope) return;
    action(
      txWorkflowVisualEditorBindings(scope, (next) => {
        if (!canModify()) return;
        onChange(txWorkflowReplaceBranch(getModel(), parentId, branch, next));
        onSelect(next.blocks[selectIndex]?.editorId ?? parentId);
      }),
    );
  }
  function addNode(
    kind: "block" | "loop" | "choice",
    parentId: string | null = null,
    branch: TxWorkflowBranch = "blocks",
  ): void {
    const scope = txWorkflowBranchModel(getModel(), parentId, branch);
    if (scope)
      changeBranch(parentId, branch, scope.blocks.length, (bindings) =>
        bindings.appendBlock(kind),
      );
  }
  function moveBlock(editorId: string, targetIndex: number): void {
    const location = txWorkflowFindBlock(getModel(), editorId);
    if (location)
      changeBranch(
        location.parentId,
        location.branch,
        targetIndex,
        (bindings) => bindings.moveBlock(location.blockIndex, targetIndex),
      );
  }
  function duplicateBlock(editorId: string): void {
    const location = txWorkflowFindBlock(getModel(), editorId);
    if (location)
      changeBranch(
        location.parentId,
        location.branch,
        location.blockIndex + 1,
        (bindings) => bindings.duplicateBlock(location.blockIndex),
      );
  }
  function removeBlock(editorId: string): void {
    const location = txWorkflowFindBlock(getModel(), editorId);
    if (location)
      changeBranch(
        location.parentId,
        location.branch,
        Math.max(0, location.blockIndex - 1),
        (bindings) => bindings.removeBlock(location.blockIndex),
      );
  }
  function changeCommands(
    editorId: string,
    change: (model: TxBlockFormModel) => TxBlockFormModel,
    selectIndex: number | undefined,
    sourceIndex?: number,
  ): void {
    if (!canModify()) return;
    const block = txWorkflowFindBlock(getModel(), editorId)?.block;
    if (!block || block.control) return;
    const template = templates.getWorkspace(block);
    const display = get(template.displayStateStore);
    const form = get(template.formStateStore).formModel;
    if (
      !get(template.contentReadyStateStore) ||
      display.readonly ||
      display.loadingAction ||
      !form
    )
      return;
    if (
      sourceIndex !== undefined &&
      (!Number.isInteger(sourceIndex) ||
        sourceIndex < 0 ||
        sourceIndex >= form.steps.length)
    )
      return;
    const next = change(form);
    if (next === form) return;
    template.changeFormModel(next);
    if (next.steps.length && onSelectStep)
      onSelectStep(
        editorId,
        Math.min(selectIndex ?? next.steps.length - 1, next.steps.length - 1),
      );
    else onSelect(editorId);
  }
  function addCommand(editorId: string): void {
    changeCommands(editorId, txBlockAddStep, undefined);
  }
  function moveCommand(
    editorId: string,
    stepIndex: number,
    delta: -1 | 1,
  ): void {
    const block = txWorkflowFindBlock(getModel(), editorId)?.block;
    if (!block) return;
    const state = get(templates.canvasStateStore)[editorId];
    const count = (state?.formModel ?? block.inlineBlock).steps.length;
    const target = stepIndex + delta;
    if (target < 0 || target >= count) return;
    changeCommands(
      editorId,
      (model) => txBlockMoveStep(model, stepIndex, target),
      target,
      stepIndex,
    );
  }
  function duplicateCommand(editorId: string, stepIndex: number): void {
    changeCommands(
      editorId,
      (model) => txBlockDuplicateStep(model, stepIndex),
      stepIndex + 1,
      stepIndex,
    );
  }
  function removeCommand(editorId: string, stepIndex: number): void {
    changeCommands(
      editorId,
      (model) => txBlockRemoveStep(model, stepIndex),
      stepIndex,
      stepIndex,
    );
  }
  function splitCommand(editorId: string, stepIndex: number): void {
    changeCommands(
      editorId,
      (model) => txBlockSplitStep(model, stepIndex),
      stepIndex,
      stepIndex,
    );
  }
  function changeChoice(
    editorId: string,
    change: (choice: TxWorkflowChoiceModel) => TxWorkflowChoiceModel,
  ): void {
    if (!canModify()) return;
    const model = getModel();
    const block = txWorkflowFindBlock(model, editorId)?.block;
    if (block?.control?.kind !== "choice") return;
    const control = change(block.control);
    if (control !== block.control)
      onChange(txWorkflowReplaceBlock(model, editorId, { ...block, control }));
  }
  function choiceBranchActions(editorId: string, branchId: string) {
    const control = txWorkflowFindBlock(getModel(), editorId)?.block.control;
    if (control?.kind !== "choice") return {};
    const index = control.branches.findIndex(
      (branch) => branch.editorId === branchId,
    );
    if (index < 0) return {};
    return {
      editable: canModify(),
      canMovePrevious: index > 0,
      canMoveNext: index < control.branches.length - 1,
      canDelete: control.branches.length > 1,
      movePreviousLabel: t("txWorkflowChoiceMoveUp"),
      moveNextLabel: t("txWorkflowChoiceMoveDown"),
      deleteLabel: t("txWorkflowChoiceRemoveBranch"),
      onMovePrevious: () =>
        changeChoice(editorId, (choice) =>
          txWorkflowMoveChoiceBranch(choice, branchId, -1),
        ),
      onMoveNext: () =>
        changeChoice(editorId, (choice) =>
          txWorkflowMoveChoiceBranch(choice, branchId, 1),
        ),
      onDelete: () =>
        changeChoice(editorId, (choice) =>
          txWorkflowRemoveChoiceBranch(choice, branchId),
        ),
      onChangeCondition: (condition: string) =>
        changeChoice(editorId, (choice) =>
          txWorkflowChangeChoiceBranch(choice, branchId, { condition }),
        ),
    };
  }
  function addActions(
    parentId: string | null = null,
    branch: TxWorkflowBranch = "blocks",
  ): FlowWorkflowAddActions {
    return {
      readonly: !canModify(),
      canAddBlock: true,
      addBlockLabel: t("txWorkflowFormAddBlock"),
      onAddBlock: () => addNode("block", parentId, branch),
      addControlActions: [
        {
          label: t("txWorkflowLoop"),
          onAdd: () => addNode("loop", parentId, branch),
        },
        {
          label: t("txWorkflowChoice"),
          onAdd: () => addNode("choice", parentId, branch),
        },
      ],
    };
  }
  function decorateBlock<T extends FlowWorkflowBlockNodeData>(data: T): T {
    const id = data.id;
    const location = id ? txWorkflowFindBlock(getModel(), id) : null;
    if (!id || !location) return data;
    const blockModel =
      get(templates.canvasStateStore)[id]?.formModel ??
      (location.block.sourceKind === "inline"
        ? location.block.inlineBlock
        : null);
    return {
      ...data,
      readonly: !canModify(),
      editable: canModify(),
      selected: getSelectedId() === id,
      onSelect: () => onSelect(id),
      canMovePrevious: location.blockIndex > 0,
      canMoveNext: location.blockIndex < location.blocks.length - 1,
      movePreviousLabel: t("txWorkflowMoveBlockUp"),
      moveNextLabel: t("txWorkflowMoveBlockDown"),
      duplicateLabel: t("txWorkflowDuplicateBlock"),
      deleteLabel: t("txWorkflowDeleteBlock"),
      onMovePrevious: () => moveBlock(id, location.blockIndex - 1),
      onMoveNext: () => moveBlock(id, location.blockIndex + 1),
      onDuplicate: () => duplicateBlock(id),
      onDelete: () => removeBlock(id),
      addCommandLabel: t("txWorkflowAddCommand"),
      onAddCommand: () => addCommand(id),
      wholeResourceRollback: data.wholeResourceRollback
        ? {
            ...data.wholeResourceRollback,
            selected:
              getSelectedId() === id &&
              getSelectedOperation() === "whole_resource_rollback",
            onSelect: onSelectWholeRollback
              ? () => onSelectWholeRollback(id)
              : undefined,
          }
        : null,
      commandRows: data.commandRows.map((row, stepIndex) => {
        const splitStatus = txBlockStepSplitStatus(
          blockModel?.steps[stepIndex],
        );
        return {
          ...row,
          editable: canModify() && data.canAddCommand,
          selected:
            getSelectedId() === id &&
            getSelectedStepIndex() === stepIndex &&
            getSelectedOperation() === "run",
          rollbackSelected:
            getSelectedId() === id &&
            getSelectedStepIndex() === stepIndex &&
            getSelectedOperation() === "rollback",
          onSelect: onSelectStep
            ? () => onSelectStep(id, stepIndex)
            : undefined,
          onSelectRollback: onSelectStep
            ? () => onSelectStep(id, stepIndex, "rollback")
            : undefined,
          canMovePrevious: stepIndex > 0,
          canMoveNext: stepIndex < data.commandRows.length - 1,
          movePreviousLabel: t("txWorkflowMoveCommandUp"),
          moveNextLabel: t("txWorkflowMoveCommandDown"),
          duplicateLabel: t("txWorkflowDuplicateCommand"),
          deleteLabel: t("txWorkflowDeleteCommand"),
          canSplit: splitStatus !== "unavailable",
          splitDisabled: splitStatus !== "ready",
          splitLabel: t("txWorkflowSplitCommand"),
          splitHint: t(
            splitStatus === "rollback_exceeds_run"
              ? "txWorkflowSplitRollbackExceedsRun"
              : splitStatus === "interactive_rollback"
                ? "txWorkflowSplitInteractiveRollback"
                : "txWorkflowSplitCommandHint",
          ),
          onMovePrevious: () => moveCommand(id, stepIndex, -1),
          onMoveNext: () => moveCommand(id, stepIndex, 1),
          onDuplicate: () => duplicateCommand(id, stepIndex),
          onDelete: () => removeCommand(id, stepIndex),
          onSplit: () => splitCommand(id, stepIndex),
        };
      }),
      ...(data.structure
        ? {
            structure: {
              ...data.structure,
              onAddBranch: () => changeChoice(id, txWorkflowAddChoiceBranch),
              branches: data.structure.branches.map((branch) => ({
                ...branch,
                entries: branch.entries.map((entry) => decorateBlock(entry)),
                ...addActions(
                  id,
                  data.structure?.kind === "loop"
                    ? "blocks"
                    : branch.id === "otherwise"
                      ? "otherwise"
                      : { choiceBranchId: branch.id },
                ),
                ...choiceBranchActions(id, branch.id),
              })),
            },
          }
        : {}),
    };
  }
  return {
    model: getModel,
    addNode,
    moveBlock,
    duplicateBlock,
    removeBlock,
    addCommand,
    moveCommand,
    duplicateCommand,
    removeCommand,
    splitCommand,
    addActions,
    decorateBlock,
    templates,
    sync: () => templates.sync(getModel()),
    destroy: templates.destroy,
  };
}

export type TransactionWorkflowCanvasWorkspace = ReturnType<
  typeof createTransactionWorkflowCanvasWorkspace
>;
