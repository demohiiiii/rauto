<script>
  import VariableIcon from "@lucide/svelte/icons/variable";
  import PlainInputField from "../fragments/PlainInputField.svelte";
  import StatusCard from "../fragments/StatusCard.svelte";
  import StringSelectField from "../fragments/StringSelectField.svelte";
  import TextAreaField from "../fragments/TextAreaField.svelte";
  import CommandFlowSurface from "./CommandFlowSurface.svelte";

  let {
    actions,
    display,
    indexText = "",
    onFieldValueChange,
    onJsonOverridesChange,
    showJsonOverrides = false,
    surfaceVariant = "section",
  } = $props();

  let fieldRows = $derived(
    Array.isArray(display?.fieldRows) ? display.fieldRows : [],
  );
</script>

<CommandFlowSurface
  icon={VariableIcon}
  {indexText}
  title={display?.titleText || ""}
  description={display?.hintText || ""}
  {actions}
  variant={surfaceVariant}
>
  {#if display?.errorMessage}
    <StatusCard
      message={display.errorMessage}
      tone={display.errorStatus?.tone || "error"}
    />
  {:else if !display?.hasFields}
    <div
      class="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-3 text-sm text-muted-foreground"
    >
      {display?.emptyText || ""}
    </div>
  {:else}
    <div class="grid gap-3 md:grid-cols-2">
      {#each fieldRows as fieldRow (fieldRow.fieldName)}
        <label class="grid min-w-0 gap-2">
          <span class="flex min-w-0 flex-wrap items-center gap-2">
            <span class="text-sm font-medium text-foreground">
              {fieldRow.labelText}
            </span>
            <span class={fieldRow.requirementBadgeClass}>
              {fieldRow.requirementLabelText}
            </span>
            <span class="text-xs text-muted-foreground">
              {fieldRow.typeBadgeText}
            </span>
          </span>
          {#if fieldRow.hasDescription}
            <span class="text-xs leading-relaxed text-muted-foreground">
              {fieldRow.descriptionText}
            </span>
          {/if}
          {#if fieldRow.controlKind === "options-select"}
            <StringSelectField
              aria-label={fieldRow.inputAriaLabel}
              value={fieldRow.value}
              optionValues={fieldRow.optionValues}
              includeEmptyOption={fieldRow.allowsEmpty}
              onChange={onFieldValueChange(fieldRow.fieldName)}
            />
          {:else if fieldRow.controlKind === "boolean-select"}
            <StringSelectField
              aria-label={fieldRow.inputAriaLabel}
              value={fieldRow.value}
              optionValues={fieldRow.booleanValueOptions}
              includeEmptyOption={fieldRow.allowsEmpty}
              onChange={onFieldValueChange(fieldRow.fieldName)}
            />
          {:else if fieldRow.controlKind === "json-editor"}
            <TextAreaField
              editorKind="json"
              class="min-h-28"
              showLabel={false}
              placeholderText={fieldRow.placeholderText}
              aria-label={fieldRow.inputAriaLabel}
              value={fieldRow.value}
              onChange={onFieldValueChange(fieldRow.fieldName)}
            />
          {:else}
            <PlainInputField
              aria-label={fieldRow.inputAriaLabel}
              type={fieldRow.inputType}
              value={fieldRow.value}
              placeholderText={fieldRow.placeholderText}
              oninput={onFieldValueChange(fieldRow.fieldName)}
            />
          {/if}
        </label>
      {/each}
    </div>
  {/if}

  {#if showJsonOverrides}
    <TextAreaField
      editorKind="json"
      class="min-h-28 font-mono"
      labelText={display?.jsonLabelText || display?.jsonPlaceholder || ""}
      placeholderText={display?.jsonPlaceholder || ""}
      aria-label={display?.jsonPlaceholder || ""}
      value={display?.jsonOverridesText || ""}
      hintText={display?.jsonHintText || ""}
      onChange={onJsonOverridesChange}
    />
  {/if}
</CommandFlowSurface>
