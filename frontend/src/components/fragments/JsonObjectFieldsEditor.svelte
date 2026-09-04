<script lang="ts">
  import { jsonObjectFieldsEditorBindings } from "../../lib/events.js";
  import { txObjectFieldRows } from "../../lib/objectFields.js";
  import type {
    JsonObject,
    JsonValue,
    PlainObject,
  } from "../../lib/jsonValue.js";
  import ObjectFieldsEditor from "./ObjectFieldsEditor.svelte";

  interface Props {
    onChange?: ((source: JsonObject) => void) | null;
    source?: PlainObject;
    title?: string;
    typeRows?: string[];
  }

  let { title, source = {}, typeRows = [], onChange }: Props = $props();

  let fieldRows = $derived(txObjectFieldRows(source));
  let editorBindings = $derived(
    jsonObjectFieldsEditorBindings({ onChange: applyChange }),
  );

  function isJsonValue(value: unknown): value is JsonValue {
    if (
      value === null ||
      typeof value === "boolean" ||
      typeof value === "number" ||
      typeof value === "string"
    ) {
      return true;
    }
    if (Array.isArray(value)) return value.every(isJsonValue);
    return (
      !!value &&
      typeof value === "object" &&
      Object.values(value).every(isJsonValue)
    );
  }

  function applyChange(nextSource: PlainObject): void {
    if (isJsonValue(nextSource) && !Array.isArray(nextSource)) {
      onChange?.(nextSource);
    }
  }
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
