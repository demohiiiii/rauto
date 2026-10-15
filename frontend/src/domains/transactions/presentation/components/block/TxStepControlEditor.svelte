<script lang="ts">
  import { txStepControlBranches } from "../../../model/transactionStepTree.js";
  import { getContext } from "svelte";
  import { readonlyFieldsContextKey } from "$lib/svelte.js";
  import type {
    TxStepControlModel,
    TxBlockFormModel,
    TxStepPath,
    TxBlockCommandTarget,
  } from "../../../model/types.js";
  import TxControlEditor from "../shared/TxControlEditor.svelte";
  import TxBlockVisualEditor from "./TxBlockVisualEditor.svelte";
  let {
    control,
    parent,
    canvasBody = false,
    selectedPath = null,
    selectedOperation = "run",
    onChange,
  }: {
    control: TxStepControlModel;
    parent: TxBlockFormModel;
    canvasBody?: boolean;
    selectedPath?: TxStepPath | null;
    selectedOperation?: TxBlockCommandTarget;
    onChange: (control: TxStepControlModel) => void;
  } = $props();
  const inheritedReadonly = getContext<(() => boolean) | undefined>(
    readonlyFieldsContextKey,
  );
</script>

{#snippet body(
  steps: TxBlockFormModel["steps"],
  change: (steps: TxBlockFormModel["steps"]) => void,
  focused = false,
)}
  <TxBlockVisualEditor
    bodyOnly
    canvasBody={focused}
    selectedStepIndex={focused ? (selectedPath?.[1] ?? null) : null}
    selectedStepPath={focused ? selectedPath?.slice(1) : null}
    {selectedOperation}
    model={{
      ...parent,
      steps,
      rollbackPolicy: {
        kind: parent.rollbackPolicy.kind === "per_step" ? "per_step" : "none",
      },
    }}
    onChange={(model) => change(model.steps)}
  />
{/snippet}

{#if selectedPath && selectedPath.length >= 2 && txStepControlBranches(control)[selectedPath[0]]}
  {@render body(
    txStepControlBranches(control)[selectedPath[0]],
    (steps) => {
      if (inheritedReadonly?.()) return;
      if (control.kind === "loop") onChange({ ...control, blocks: steps });
      else if (selectedPath![0] === control.branches.length)
        onChange({ ...control, otherwise: steps });
      else
        onChange({
          ...control,
          branches: control.branches.map((branch, index) =>
            index === selectedPath![0] ? { ...branch, blocks: steps } : branch,
          ),
        });
    },
    true,
  )}
{:else}
  <TxControlEditor
    {control}
    {canvasBody}
    readonly={!!inheritedReadonly?.()}
    {onChange}
  >
    {#snippet renderBody(steps, change)}{@render body(steps, change)}{/snippet}
  </TxControlEditor>
{/if}
