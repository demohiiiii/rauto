import { t } from "../../../lib/i18n.js";
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
} from "../model/types.js";
import { txWorkflowVisualEditorBindings } from "./transactionWorkflowEditorState.js";
import { createTransactionBlockTemplateRegistry } from "./transactionBlockTemplateAuthoring.js";

export function createTransactionWorkflowCanvasWorkspace({
  getModel,
  onChange,
  getSelectedId,
  onSelect,
  canModify,
  templateOptions,
}: {
  getModel: () => TxWorkflowFormModel;
  onChange: (model: TxWorkflowFormModel) => void;
  getSelectedId: () => string | null;
  onSelect: (editorId: string | null) => void;
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
