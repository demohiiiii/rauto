import type {
  TxWorkflowBlockFormModel,
  TxWorkflowFormModel,
  TxWorkflowChoiceModel,
  TxWorkflowChoiceBranchModel,
} from "./types.js";
import { createTxWorkflowBlockEditorId } from "./transactionBlockFormModels.js";

export type TxWorkflowBranch =
  "blocks" | "otherwise" | { choiceBranchId: string };

export interface TxWorkflowBlockLocation {
  block: TxWorkflowBlockFormModel;
  blockIndex: number;
  blocks: TxWorkflowBlockFormModel[];
  parentId: string | null;
  branch: TxWorkflowBranch;
}

function childBranches(block: TxWorkflowBlockFormModel) {
  const control = block.control;
  if (!control) return [];
  return control.kind === "loop"
    ? [{ branch: "blocks" as const, blocks: control.blocks }]
    : [
        ...control.branches.map((branch) => ({
          branch: { choiceBranchId: branch.editorId },
          blocks: branch.blocks,
        })),
        { branch: "otherwise" as const, blocks: control.otherwise },
      ];
}

export function txWorkflowFindBlock(
  model: TxWorkflowFormModel,
  editorId: string,
): TxWorkflowBlockLocation | null {
  function find(
    blocks: TxWorkflowBlockFormModel[],
    parentId: string | null,
    branch: TxWorkflowBranch,
  ): TxWorkflowBlockLocation | null {
    for (const [blockIndex, block] of blocks.entries()) {
      if (block.editorId === editorId)
        return { block, blockIndex, blocks, parentId, branch };
      for (const child of childBranches(block)) {
        const match = find(child.blocks, block.editorId, child.branch);
        if (match) return match;
      }
    }
    return null;
  }
  return find(model.blocks, null, "blocks");
}

export function txWorkflowReplaceBlock(
  model: TxWorkflowFormModel,
  editorId: string,
  nextBlock: TxWorkflowBlockFormModel,
): TxWorkflowFormModel {
  function replace(
    blocks: TxWorkflowBlockFormModel[],
  ): TxWorkflowBlockFormModel[] {
    let changed = false;
    const next = blocks.map((block) => {
      if (block.editorId === editorId) {
        changed = true;
        return nextBlock;
      }
      const control = block.control;
      if (control?.kind === "loop") {
        const children = replace(control.blocks);
        if (children !== control.blocks) {
          changed = true;
          return { ...block, control: { ...control, blocks: children } };
        }
      } else if (control?.kind === "choice") {
        let branchesChanged = false;
        const branches = control.branches.map((branch) => {
          const blocks = replace(branch.blocks);
          if (blocks === branch.blocks) return branch;
          branchesChanged = true;
          return { ...branch, blocks };
        });
        const otherwise = replace(control.otherwise);
        if (branchesChanged || otherwise !== control.otherwise) {
          changed = true;
          return {
            ...block,
            control: {
              ...control,
              branches: branchesChanged ? branches : control.branches,
              otherwise,
            },
          };
        }
      }
      return block;
    });
    return changed ? next : blocks;
  }
  const blocks = replace(model.blocks);
  return blocks === model.blocks ? model : { ...model, blocks };
}

export function txWorkflowBranchModel(
  model: TxWorkflowFormModel,
  parentId: string | null,
  branch: TxWorkflowBranch,
): TxWorkflowFormModel | null {
  if (parentId === null) return branch === "blocks" ? model : null;
  const parent = txWorkflowFindBlock(model, parentId)?.block;
  const blocks =
    parent &&
    childBranches(parent).find((child) =>
      typeof branch === "string"
        ? child.branch === branch
        : typeof child.branch !== "string" &&
          child.branch.choiceBranchId === branch.choiceBranchId,
    )?.blocks;
  return blocks
    ? { name: "", failFast: true, hasFailFast: true, extra: {}, blocks }
    : null;
}

export function txWorkflowReplaceBranch(
  model: TxWorkflowFormModel,
  parentId: string | null,
  branch: TxWorkflowBranch,
  next: TxWorkflowFormModel,
): TxWorkflowFormModel {
  if (parentId === null) return branch === "blocks" ? next : model;
  const parent = txWorkflowFindBlock(model, parentId)?.block;
  const control = parent?.control;
  if (!parent || !control || !txWorkflowBranchModel(model, parentId, branch))
    return model;
  if (typeof branch === "object") {
    if (control.kind !== "choice") return model;
    return txWorkflowReplaceBlock(model, parentId, {
      ...parent,
      control: txWorkflowChangeChoiceBranch(control, branch.choiceBranchId, {
        blocks: next.blocks,
      }),
    });
  }
  if (branch === "blocks" && control.kind === "loop")
    return txWorkflowReplaceBlock(model, parentId, {
      ...parent,
      control: { ...control, blocks: next.blocks },
    });
  if (branch === "otherwise" && control.kind === "choice")
    return txWorkflowReplaceBlock(model, parentId, {
      ...parent,
      control: { ...control, otherwise: next.blocks },
    });
  return model;
}

export function txWorkflowChangeChoiceBranch(
  control: TxWorkflowChoiceModel,
  editorId: string,
  change: Partial<Pick<TxWorkflowChoiceBranchModel, "condition" | "blocks">>,
): TxWorkflowChoiceModel {
  if (!control.branches.some((branch) => branch.editorId === editorId))
    return control;
  return {
    ...control,
    branches: control.branches.map((branch) =>
      branch.editorId === editorId ? { ...branch, ...change } : branch,
    ),
  };
}

export function txWorkflowAddChoiceBranch(
  control: TxWorkflowChoiceModel,
): TxWorkflowChoiceModel {
  return {
    ...control,
    branches: [
      ...control.branches,
      {
        editorId: createTxWorkflowBlockEditorId(),
        condition: "",
        blocks: [],
      },
    ],
  };
}

export function txWorkflowMoveChoiceBranch(
  control: TxWorkflowChoiceModel,
  editorId: string,
  offset: -1 | 1,
): TxWorkflowChoiceModel {
  const index = control.branches.findIndex(
    (branch) => branch.editorId === editorId,
  );
  const target = index + offset;
  if (index < 0 || target < 0 || target >= control.branches.length)
    return control;
  const branches = [...control.branches];
  [branches[index], branches[target]] = [branches[target], branches[index]];
  return { ...control, branches };
}

export function txWorkflowRemoveChoiceBranch(
  control: TxWorkflowChoiceModel,
  editorId: string,
): TxWorkflowChoiceModel {
  if (
    control.branches.length <= 1 ||
    !control.branches.some((branch) => branch.editorId === editorId)
  )
    return control;
  return {
    ...control,
    branches: control.branches.filter((branch) => branch.editorId !== editorId),
  };
}
