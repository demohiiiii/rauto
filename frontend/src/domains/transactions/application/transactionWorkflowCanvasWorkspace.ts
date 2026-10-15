import {
  txStepScope,
  txStepReplaceScope,
} from "../model/transactionStepTree.js";
import { t } from "../../../lib/i18n.js";
import { get, writable } from "svelte/store";
import type {
  FlowWorkflowBlockNodeData,
  FlowWorkflowAddActions,
  FlowWorkflowCommandRow,
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
  TxChoiceModel,
  TxStepPath,
  TxStepControlModel,
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

function choiceBranchCanvasActions<T>(
  control: TxChoiceModel<T> | null,
  branchId: string,
  editable: boolean,
  update: (change: (choice: TxChoiceModel<T>) => TxChoiceModel<T>) => void,
) {
  const index =
    control?.branches.findIndex((branch) => branch.editorId === branchId) ?? -1;
  if (!control || index < 0) return {};
  return {
    editable,
    canMovePrevious: index > 0,
    canMoveNext: index < control.branches.length - 1,
    canDelete: control.branches.length > 1,
    movePreviousLabel: t("txWorkflowChoiceMoveUp"),
    moveNextLabel: t("txWorkflowChoiceMoveDown"),
    deleteLabel: t("txWorkflowChoiceRemoveBranch"),
    onMovePrevious: () =>
      update((choice) => txWorkflowMoveChoiceBranch(choice, branchId, -1)),
    onMoveNext: () =>
      update((choice) => txWorkflowMoveChoiceBranch(choice, branchId, 1)),
    onDelete: () =>
      update((choice) => txWorkflowRemoveChoiceBranch(choice, branchId)),
    onChangeCondition: editable
      ? (condition: string) =>
          update((choice) =>
            txWorkflowChangeChoiceBranch(choice, branchId, { condition }),
          )
      : undefined,
  };
}

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

  const commandSelectionStateStore = writable<{
    editorId: string;
    path: TxStepPath;
    operation: "run" | "rollback";
  } | null>(null);
  function selectCommand(
    editorId: string,
    path: TxStepPath,
    operation: "run" | "rollback" = "run",
  ): void {
    commandSelectionStateStore.set({ editorId, path, operation });
    onSelectStep?.(editorId, path[0], operation);
  }
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
    scopePath: TxStepPath = [],
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
    const scope = txStepScope(form, scopePath);
    if (!scope) return;
    if (
      sourceIndex !== undefined &&
      (!Number.isInteger(sourceIndex) ||
        sourceIndex < 0 ||
        sourceIndex >= scope.steps.length)
    )
      return;
    const next = change(scope);
    if (next === scope) return;
    template.changeFormModel(
      scopePath.length ? txStepReplaceScope(form, scopePath, next.steps) : next,
    );
    if (next.steps.length && onSelectStep)
      selectCommand(editorId, [
        ...scopePath,
        Math.min(selectIndex ?? next.steps.length - 1, next.steps.length - 1),
      ]);
    else if (scopePath.length) selectCommand(editorId, scopePath.slice(0, -1));
    else {
      commandSelectionStateStore.set(null);
      onSelect(editorId);
    }
  }
  function addCommand(
    editorId: string,
    kind: "command" | "loop" | "choice" = "command",
    scopePath: TxStepPath = [],
  ): void {
    changeCommands(
      editorId,
      (model) => txBlockAddStep(model, kind),
      undefined,
      undefined,
      scopePath,
    );
  }
  function mutateCommand(
    editorId: string,
    path: TxStepPath,
    action: "previous" | "next" | "duplicate" | "delete" | "split",
  ): void {
    const index = path.at(-1)!;
    const target =
      index +
      (action === "previous"
        ? -1
        : action === "next" || action === "duplicate"
          ? 1
          : 0);
    changeCommands(
      editorId,
      (model) => {
        if (
          (action === "previous" || action === "next") &&
          (target < 0 || target >= model.steps.length)
        )
          return model;
        return action === "previous" || action === "next"
          ? txBlockMoveStep(model, index, target)
          : action === "duplicate"
            ? txBlockDuplicateStep(model, index)
            : action === "delete"
              ? txBlockRemoveStep(model, index)
              : txBlockSplitStep(model, index);
      },
      target,
      index,
      path.slice(0, -1),
    );
  }
  function moveCommand(
    editorId: string,
    stepIndex: number,
    delta: -1 | 1,
  ): void {
    mutateCommand(editorId, [stepIndex], delta === -1 ? "previous" : "next");
  }
  function duplicateCommand(editorId: string, stepIndex: number): void {
    mutateCommand(editorId, [stepIndex], "duplicate");
  }
  function removeCommand(editorId: string, stepIndex: number): void {
    mutateCommand(editorId, [stepIndex], "delete");
  }
  function splitCommand(editorId: string, stepIndex: number): void {
    mutateCommand(editorId, [stepIndex], "split");
  }
  function changeStepControl(
    editorId: string,
    path: TxStepPath,
    change: (control: TxStepControlModel) => TxStepControlModel,
  ): void {
    const index = path.at(-1)!;
    changeCommands(
      editorId,
      (model) => {
        const step = model.steps[index];
        return step?.control
          ? {
              ...model,
              steps: model.steps.map((entry, i) =>
                i === index
                  ? { ...step, control: change(step.control!) }
                  : entry,
              ),
            }
          : model;
      },
      index,
      index,
      path.slice(0, -1),
    );
  }
  function commandAddActions(editorId: string, scopePath: TxStepPath) {
    return {
      addCommandLabel: t("txWorkflowAddCommand"),
      onAddCommand: () => addCommand(editorId, "command", scopePath),
      addCommandControlActions: (["loop", "choice"] as const).map((kind) => ({
        label: t(kind === "loop" ? "txWorkflowLoop" : "txWorkflowChoice"),
        onAdd: () => addCommand(editorId, kind, scopePath),
      })),
    };
  }
  function decorateCommands(
    editorId: string,
    data: FlowWorkflowBlockNodeData,
    blockModel: TxBlockFormModel,
    scopePath: TxStepPath = [],
  ): FlowWorkflowCommandRow[] {
    const scope = txStepScope(blockModel, scopePath);
    return data.commandRows.map((row, stepIndex) => {
      const path = [...scopePath, stepIndex];
      const selection = get(commandSelectionStateStore);
      const activePath =
        selection?.editorId === editorId &&
        selection.path[0] === getSelectedStepIndex()
          ? selection.path
          : [getSelectedStepIndex()];
      const selected =
        getSelectedId() === editorId &&
        path.length === activePath.length &&
        path.every((index, i) => index === activePath[i]);
      const splitStatus = txBlockStepSplitStatus(scope?.steps[stepIndex]);
      const actions = {
        editable: canModify() && data.canAddCommand,
        selected: selected && getSelectedOperation() === "run",
        rollbackSelected: selected && getSelectedOperation() === "rollback",
        onSelect: onSelectStep
          ? () => selectCommand(editorId, path)
          : undefined,
        onSelectRollback: onSelectStep
          ? () => selectCommand(editorId, path, "rollback")
          : undefined,
        canMovePrevious: stepIndex > 0,
        canMoveNext: stepIndex < data.commandRows.length - 1,
        movePreviousLabel: t("txWorkflowMoveCommandUp"),
        moveNextLabel: t("txWorkflowMoveCommandDown"),
        duplicateLabel: t("txWorkflowDuplicateCommand"),
        deleteLabel: t("txWorkflowDeleteCommand"),
        onMovePrevious: () => mutateCommand(editorId, path, "previous"),
        onMoveNext: () => mutateCommand(editorId, path, "next"),
        onDuplicate: () => mutateCommand(editorId, path, "duplicate"),
        onDelete: () => mutateCommand(editorId, path, "delete"),
      };
      const control = scope?.steps[stepIndex]?.control;
      return {
        ...row,
        ...actions,
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
        onSplit: () => mutateCommand(editorId, path, "split"),
        ...(row.controlNode && control
          ? {
              controlNode: {
                ...row.controlNode,
                id: `${editorId}-command-${path.join("-")}`,
                ...actions,
                readonly: !canModify(),
                structure: row.controlNode.structure
                  ? {
                      ...row.controlNode.structure,
                      onAddBranch: () =>
                        changeStepControl(editorId, path, (c) =>
                          c.kind === "choice"
                            ? txWorkflowAddChoiceBranch(c)
                            : c,
                        ),
                      branches: row.controlNode.structure.branches.map(
                        (branch, branchIndex) => ({
                          ...branch,
                          ...choiceBranchCanvasActions(
                            control.kind === "choice" ? control : null,
                            branch.id,
                            !!actions.editable,
                            (change) =>
                              changeStepControl(editorId, path, (c) =>
                                c.kind === "choice" ? change(c) : c,
                              ),
                          ),
                          entries: branch.entries.map((entry) => ({
                            ...entry,
                            readonly: !canModify(),
                            ...commandAddActions(editorId, [
                              ...path,
                              branchIndex,
                            ]),
                            commandRows: decorateCommands(
                              editorId,
                              entry,
                              blockModel,
                              [...path, branchIndex],
                            ),
                          })),
                        }),
                      ),
                    }
                  : undefined,
              },
            }
          : {}),
      };
    });
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
    return choiceBranchCanvasActions(
      control?.kind === "choice" ? control : null,
      branchId,
      canModify(),
      (change) => changeChoice(editorId, change),
    );
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
      ...commandAddActions(id, []),
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
      commandRows: blockModel
        ? decorateCommands(id, data, blockModel)
        : data.commandRows,
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
    commandSelectionStateStore,
    selectCommand,
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
