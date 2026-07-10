<script>
  import TxBlockTemplateRuntimeFieldsEditor from "./TxBlockTemplateRuntimeFieldsEditor.svelte";
  import TxBlockTemplateRuntimeVarsEditor from "./TxBlockTemplateRuntimeVarsEditor.svelte";

  let { operation, templateDisplay, onChange, jsonValueTypeRows } = $props();
</script>

<div class="grid gap-4">
  <TxBlockTemplateRuntimeFieldsEditor
    {operation}
    {onChange}
    {jsonValueTypeRows}
  />
  <TxBlockTemplateRuntimeVarsEditor
    {operation}
    {templateDisplay}
    {onChange}
    {jsonValueTypeRows}
  />
</div>
