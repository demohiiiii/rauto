<script>
  import { Button } from "$lib/components/ui/button/index.js";
  import { objectFieldsEditorBindings } from "../../lib/events.js";
  import { t } from "../../lib/i18n.js";
  import { objectFieldEditorPresentation } from "../../lib/objectFields.js";
  import { classNames } from "../../lib/ui.js";
  import PlainInputField from "./PlainInputField.svelte";
  import PlainTextAreaField from "./PlainTextAreaField.svelte";
  import StringSelectField from "./StringSelectField.svelte";

  let {
    title,
    fieldRows,
    typeRows,
    onAdd,
    onRename,
    onTypeChange,
    onValueChange,
    onRemove,
  } = $props();
  let fieldBindings = $derived(
    objectFieldsEditorBindings({
      onRemove,
      onRename,
      onTypeChange,
      onValueChange,
    }),
  );
</script>

<details class="rounded-lg border border-border bg-card">
  <summary
    class="cursor-pointer px-4 py-3 text-sm font-semibold text-muted-foreground"
  >
    {title}
    <span class="ml-2 text-xs font-normal text-slate-400">
      {fieldRows.length}
    </span>
  </summary>
  <div class="grid gap-2 px-4 pb-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <span>{t("txBlockFormExtraFields")}</span>
      <Button variant="outline" size="xs" type="button" onclick={onAdd}>
        {t("txBlockFormAddExtraField")}
      </Button>
    </div>
    {#each fieldRows as extraFieldRow (extraFieldRow.keyText)}
      {@const fieldEditorDisplay = objectFieldEditorPresentation(extraFieldRow)}
      <div
        class={classNames(
          "grid gap-2",
          fieldEditorDisplay.editorKind === "input" &&
            "md:grid-cols-[1fr_8rem_1fr_auto]",
        )}
      >
        <PlainInputField
          class="font-mono"
          placeholderText={t("txBlockFormExtraKeyPlaceholder")}
          value={extraFieldRow.keyText}
          onInput={fieldBindings.renameFieldHandler(extraFieldRow.keyText)}
        />
        <StringSelectField
          optionValues={typeRows}
          value={extraFieldRow.typeValue}
          onChange={fieldBindings.fieldTypeHandler(extraFieldRow.keyText)}
        />
        {#if fieldEditorDisplay.editorKind === "textarea"}
          <PlainTextAreaField
            class="min-h-28 font-mono md:col-span-2"
            rows={fieldEditorDisplay.rows}
            value={fieldEditorDisplay.valueText}
            disabled={fieldEditorDisplay.disabled}
            onInput={fieldBindings.fieldValueHandler(extraFieldRow.keyText)}
          />
        {:else}
          <PlainInputField
            class="font-mono"
            value={fieldEditorDisplay.valueText}
            disabled={fieldEditorDisplay.disabled}
            onInput={fieldBindings.fieldValueHandler(extraFieldRow.keyText)}
          />
        {/if}
        <Button
          variant="destructive"
          size="xs"
          type="button"
          onclick={fieldBindings.removeFieldHandler(extraFieldRow.keyText)}
        >
          {t("deleteBtn")}
        </Button>
      </div>
    {/each}
  </div>
</details>
