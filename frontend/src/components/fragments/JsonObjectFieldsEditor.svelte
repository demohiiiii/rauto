<script>
  import { jsonObjectFieldsEditorBindings } from "../../lib/events.js";
  import { txObjectFieldRows } from "../../lib/objectFields.js";
  import ObjectFieldsEditor from "./ObjectFieldsEditor.svelte";

  let { title, source = {}, typeRows = [], onChange } = $props();

  let fieldRows = $derived(txObjectFieldRows(source));
  let editorBindings = $derived(jsonObjectFieldsEditorBindings({ onChange }));
</script>

<ObjectFieldsEditor
  {title}
  {fieldRows}
  {typeRows}
  onAdd={editorBindings.addFieldAction(source)}
  onRename={editorBindings.renameFieldAction(source)}
  onTypeChange={editorBindings.typeChangeAction(source)}
  onValueChange={editorBindings.valueChangeAction(source)}
  onRemove={editorBindings.removeFieldAction(source)}
/>
