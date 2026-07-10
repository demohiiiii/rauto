<script>
  import { Button } from "$lib/components/ui/button/index.js";
  import { stringListEditorBindings } from "../../lib/events.js";
  import PlainInputField from "./PlainInputField.svelte";

  let {
    addButtonLabel,
    itemRows,
    labelText,
    onAdd,
    onRemove,
    onValueChange,
    placeholderText = "",
    removeButtonLabel,
  } = $props();
  let listBindings = $derived(
    stringListEditorBindings({ onRemove, onValueChange }),
  );
</script>

<label class="flex flex-col gap-2">
  <span class="text-sm font-medium text-foreground">{labelText}</span>
  <div class="grid gap-2">
    <Button
      class="w-fit"
      variant="outline"
      size="sm"
      type="button"
      onclick={onAdd}
    >
      {addButtonLabel}
    </Button>
    {#each itemRows as itemRow (itemRow.itemIndex)}
      <div class="grid gap-2 md:grid-cols-[1fr_auto]">
        <PlainInputField
          {placeholderText}
          value={itemRow.text}
          onInput={listBindings.itemValueHandler(itemRow.itemIndex)}
        />
        <Button
          variant="destructive"
          size="sm"
          type="button"
          onclick={listBindings.removeHandler(itemRow.itemIndex)}
        >
          {removeButtonLabel}
        </Button>
      </div>
    {/each}
  </div>
</label>
