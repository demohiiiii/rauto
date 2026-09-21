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
    allowAdd?: boolean;
    allowRemove?: boolean;
    layout?: "collapsible" | "inline";
    onChange?: ((source: JsonObject) => void) | null;
    source?: PlainObject;
    title?: string;
    typeRows?: string[];
  }

  let {
    allowAdd = true,
    allowRemove = true,
    title,
    layout = "collapsible",
    source = {},
    typeRows = [],
    onChange,
  }: Props = $props();

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
  {layout}
  {title}
  {fieldRows}
  {typeRows}
  onAdd={allowAdd ? editorBindings.addFieldAction(source) : null}
  onRename={editorBindings.renameFieldAction(source)}
  onTypeChange={editorBindings.typeChangeAction(source)}
  onValueChange={editorBindings.valueChangeAction(source)}
  onRemove={allowRemove ? editorBindings.removeFieldAction(source) : null}
/>
