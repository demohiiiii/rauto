import type {
  TxBlockFormModel,
  TxStepControlModel,
  TxStepFormModel,
  TxStepPath,
} from "./types.js";

export function txStepControlBranches(
  control: TxStepControlModel,
): TxStepFormModel[][] {
  return control.kind === "loop"
    ? [control.blocks]
    : [...control.branches.map((branch) => branch.blocks), control.otherwise];
}

export function txStepScope(
  model: TxBlockFormModel,
  path: TxStepPath,
): TxBlockFormModel | null {
  if (path.length % 2 !== 0) return null;
  let steps = model.steps;
  for (let index = 0; index < path.length; index += 2) {
    const control = steps[path[index]]?.control;
    const children = control
      ? txStepControlBranches(control)[path[index + 1]]
      : null;
    if (!children) return null;
    steps = children;
  }
  return path.length
    ? {
        ...model,
        steps,
        rollbackPolicy: {
          kind: model.rollbackPolicy.kind === "per_step" ? "per_step" : "none",
        },
      }
    : model;
}

export function txStepAtPath(
  model: TxBlockFormModel,
  path: TxStepPath,
): TxStepFormModel | null {
  if (!path.length || path.length % 2 !== 1) return null;
  return txStepScope(model, path.slice(0, -1))?.steps[path.at(-1)!] ?? null;
}

export function txStepReplaceScope(
  model: TxBlockFormModel,
  path: TxStepPath,
  steps: TxStepFormModel[],
): TxBlockFormModel {
  if (!path.length) return { ...model, steps };
  if (!txStepScope(model, path)) return model;
  const [index, branch, ...rest] = path;
  const step = model.steps[index];
  const control = step.control!;
  const children = txStepControlBranches(control)[branch];
  const next = txStepReplaceScope(
    { ...model, steps: children },
    rest,
    steps,
  ).steps;
  const nextControl: TxStepControlModel =
    control.kind === "loop"
      ? { ...control, blocks: next }
      : branch === control.branches.length
        ? { ...control, otherwise: next }
        : {
            ...control,
            branches: control.branches.map((entry, i) =>
              i === branch ? { ...entry, blocks: next } : entry,
            ),
          };
  return {
    ...model,
    steps: model.steps.map((entry, i) =>
      i === index ? { ...step, control: nextControl } : entry,
    ),
  };
}
