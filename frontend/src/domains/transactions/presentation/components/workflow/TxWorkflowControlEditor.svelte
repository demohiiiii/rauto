<script lang="ts">
  import type {
    TxWorkflowControlModel,
    TxWorkflowFormModel,
  } from "../../../model/types.js";
  import TxControlEditor from "../shared/TxControlEditor.svelte";
  import TxWorkflowVisualEditor from "./TxWorkflowVisualEditor.svelte";
  let {
    control,
    canvasBody = false,
    readonly = false,
    onChange,
  }: {
    control: TxWorkflowControlModel;
    canvasBody?: boolean;
    readonly?: boolean;
    onChange: (control: TxWorkflowControlModel) => void;
  } = $props();
</script>

<TxControlEditor {control} {canvasBody} {readonly} {onChange}>
  {#snippet renderBody(blocks, change)}
    <TxWorkflowVisualEditor
      embedded
      nested
      {readonly}
      model={{
        name: "",
        failFast: true,
        hasFailFast: true,
        extra: {},
        blocks,
      } satisfies TxWorkflowFormModel}
      onChange={(model) => change(model.blocks)}
    />
  {/snippet}
</TxControlEditor>
