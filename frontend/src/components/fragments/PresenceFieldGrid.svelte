<script>
  import { presenceFieldRowBindings } from "../../lib/events.js";
  import { classNames, presenceFieldControlDisplay } from "../../lib/ui.js";
  import { t } from "../../lib/i18n.js";
  import PlainInputField from "./PlainInputField.svelte";
  import PlainSelectField from "./PlainSelectField.svelte";
  import PresenceToggle from "./PresenceToggle.svelte";

  let {
    advancedDescription = "",
    advancedTitle = "",
    fieldRows = [],
    hostClass = "grid gap-3 md:grid-cols-2",
    itemClass = "",
    itemClassByFieldKey = {},
    controlClassByFieldKey = {},
    controlTypeFallback = "input",
    inputTypeFallback = "text",
    labelClass = "",
    presenceControlsMode = "inline",
    showPresenceToggleFallback = null,
    onValueChange = null,
    onPresenceChange = null,
    onNullableModeChange = null,
    onValueChangeForKey = null,
    onPresenceChangeForKey = null,
    onNullableModeChangeForKey = null,
    onValueChangeForRow = null,
    onPresenceChangeForRow = null,
    onNullableModeChangeForRow = null,
  } = $props();

  let resolvedAdvancedTitle = $derived(
    advancedTitle || t("txBlockFormAdvancedFields"),
  );
  let resolvedAdvancedDescription = $derived(
    advancedDescription || t("txBlockFormAdvancedFieldsHint"),
  );

  function shouldShowPresenceToggle(fieldRow = {}) {
    return typeof showPresenceToggleFallback === "boolean"
      ? showPresenceToggleFallback
      : !!fieldRow.showPresenceToggle;
  }

  let advancedPresenceRows = $derived(
    fieldRows.filter((fieldRow) => shouldShowPresenceToggle(fieldRow)),
  );
</script>

<div class={hostClass}>
  {#each fieldRows as fieldRow (fieldRow.fieldKey)}
    {@const resolvedControlClass =
      fieldRow.controlClass ||
      (typeof controlClassByFieldKey === "object" &&
      controlClassByFieldKey !== null
        ? (controlClassByFieldKey[fieldRow.fieldKey] ?? "")
        : "")}
    {@const resolvedShowPresenceToggle = shouldShowPresenceToggle(fieldRow)}
    {@const showInlinePresenceToggle =
      resolvedShowPresenceToggle && presenceControlsMode === "inline"}
    {@const controlBindings = presenceFieldRowBindings({
      fieldRow,
      showPresenceToggle: resolvedShowPresenceToggle,
      onValueChange,
      onPresenceChange,
      onNullableModeChange,
      onValueChangeForKey,
      onPresenceChangeForKey,
      onNullableModeChangeForKey,
      onValueChangeForRow,
      onPresenceChangeForRow,
      onNullableModeChangeForRow,
    })}
    {@const controlDisplay = presenceFieldControlDisplay({
      controlClass: resolvedControlClass,
    })}
    {@const controlDisabled =
      (!fieldRow.enabled && !resolvedShowPresenceToggle) ||
      fieldRow.nullableModeValue === "null"}
    <div
      class={classNames(
        itemClass,
        typeof itemClassByFieldKey === "object" && itemClassByFieldKey !== null
          ? (itemClassByFieldKey[fieldRow.fieldKey] ?? "")
          : "",
      )}
    >
      <label class="flex flex-col gap-2">
        <div class="mb-1 flex items-center justify-between gap-3">
          <span
            class={classNames(
              "text-sm font-medium text-foreground",
              labelClass,
            )}
          >
            {fieldRow.labelText}
          </span>
          {#if showInlinePresenceToggle}
            <PresenceToggle
              checked={fieldRow.enabled}
              onCheckedChange={controlBindings.presenceChangeHandler}
              toggleAriaLabel={fieldRow.labelText}
            />
          {/if}
        </div>
        {#if fieldRow.showNullableModeSelect && fieldRow.enabled}
          <div class="mb-2 flex justify-end">
            <PlainSelectField
              class="h-8 w-28 text-xs"
              aria-label={fieldRow.labelText}
              optionRows={fieldRow.nullableModeRows}
              value={fieldRow.nullableModeValue}
              onValueChange={controlBindings.nullableModeChangeHandler}
            />
          </div>
        {/if}
        {#if (fieldRow.controlType || controlTypeFallback) === "select"}
          <PlainSelectField
            class={controlDisplay.selectClassText}
            aria-label={fieldRow.labelText}
            optionRows={fieldRow.optionRows}
            value={fieldRow.valueText}
            disabled={controlDisabled}
            onValueChange={controlBindings.valueChangeHandler}
          />
        {:else}
          <PlainInputField
            class={controlDisplay.inputClassText}
            aria-label={fieldRow.labelText}
            type={fieldRow.inputType || inputTypeFallback}
            value={fieldRow.valueText}
            placeholderText={fieldRow.placeholderText}
            disabled={controlDisabled}
            onValueInput={controlBindings.valueChangeHandler}
          />
        {/if}
      </label>
    </div>
  {/each}
  {#if presenceControlsMode === "advanced" && advancedPresenceRows.length > 0}
    <details
      class="rounded-xl border border-border bg-muted/30 p-3 text-sm md:col-span-full"
    >
      <summary
        class="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-foreground marker:hidden"
      >
        <span>{resolvedAdvancedTitle}</span>
        <span class="text-xs font-normal text-muted-foreground">
          {advancedPresenceRows.length}
        </span>
      </summary>
      <p class="mt-1 text-xs leading-relaxed text-muted-foreground">
        {resolvedAdvancedDescription}
      </p>
      <div class="mt-3 grid gap-2 sm:grid-cols-2">
        {#each advancedPresenceRows as fieldRow (fieldRow.fieldKey)}
          {@const controlBindings = presenceFieldRowBindings({
            fieldRow,
            showPresenceToggle: true,
            onPresenceChange,
            onPresenceChangeForKey,
            onPresenceChangeForRow,
          })}
          <div
            class="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2"
          >
            <div class="min-w-0">
              <div class="truncate text-sm font-medium text-foreground">
                {fieldRow.labelText}
              </div>
              <div class="text-xs text-muted-foreground">
                {fieldRow.enabled
                  ? t("txBlockFormFieldIncluded")
                  : t("txBlockFormFieldDefault")}
              </div>
            </div>
            <PresenceToggle
              checked={fieldRow.enabled}
              onCheckedChange={controlBindings.presenceChangeHandler}
              toggleAriaLabel={fieldRow.labelText}
            />
          </div>
        {/each}
      </div>
    </details>
  {/if}
</div>
