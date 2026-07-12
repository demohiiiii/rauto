<script>
  import TxBlockTemplateRuntimeFieldsEditor from "./TxBlockTemplateRuntimeFieldsEditor.svelte";
  import TxBlockTemplateRuntimeVarsEditor from "./TxBlockTemplateRuntimeVarsEditor.svelte";

  let {
    operation,
    templateDisplay,
    onChange,
    jsonValueTypeRows,
    validationErrors = [],
    pathPrefix = "",
  } = $props();
</script>

<div class="grid gap-4">
  <TxBlockTemplateRuntimeFieldsEditor
    {operation}
    {onChange}
    {jsonValueTypeRows}
    {validationErrors}
    {pathPrefix}
  />
  <TxBlockTemplateRuntimeVarsEditor
    {operation}
    {templateDisplay}
    {onChange}
    {jsonValueTypeRows}
    {validationErrors}
    {pathPrefix}
  />
</div>
