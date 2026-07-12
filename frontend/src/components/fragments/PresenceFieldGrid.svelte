<script>
  import { presenceFieldRowBindings } from "../../lib/events.js";
  import { classNames, presenceFieldControlDisplay } from "../../lib/ui.js";
  import PlainInputField from "./PlainInputField.svelte";
  import PlainSelectField from "./PlainSelectField.svelte";
  import PresenceToggle from "./PresenceToggle.svelte";

  let {
    fieldRows = [],
    hostClass = "grid gap-3 md:grid-cols-2",
    itemClass = "",
    itemClassByFieldKey = {},
    controlClassByFieldKey = {},
    controlTypeFallback = "input",
    inputTypeFallback = "text",
    labelClass = "",
    presenceControlsMode = "inline",
    valueHandlerMode = "value",
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

  function shouldShowPresenceToggle(fieldRow = {}) {
    return typeof showPresenceToggleFallback === "boolean"
      ? showPresenceToggleFallback
      : !!fieldRow.showPresenceToggle;
  }

  function invalidFieldControl(node, invalid) {
    function syncInvalidState(nextInvalid) {
      const control = node.querySelector(
        'input, textarea, button[role="combobox"]',
      );
      if (!control) return;
      if (nextInvalid) {
        control.setAttribute("aria-invalid", "true");
      } else {
        control.removeAttribute("aria-invalid");
      }
    }

    syncInvalidState(invalid);
    return { update: syncInvalidState };
  }
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
      (!fieldRow.enabled &&
        !resolvedShowPresenceToggle &&
        presenceControlsMode !== "hidden") ||
      fieldRow.nullableModeValue === "null"}
    <div
      class={classNames(
        itemClass,
        typeof itemClassByFieldKey === "object" && itemClassByFieldKey !== null
          ? (itemClassByFieldKey[fieldRow.fieldKey] ?? "")
          : "",
      )}
    >
      <label
        class="flex flex-col gap-2"
        data-invalid={fieldRow.errorText ? "true" : undefined}
        aria-invalid={fieldRow.errorText ? "true" : undefined}
      >
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
              onChange={valueHandlerMode === "event"
                ? controlBindings.nullableModeChangeHandler
                : null}
              onValueChange={valueHandlerMode === "event"
                ? null
                : controlBindings.nullableModeChangeHandler}
            />
          </div>
        {/if}
        <div class="contents" use:invalidFieldControl={!!fieldRow.errorText}>
          {#if (fieldRow.controlType || controlTypeFallback) === "select"}
            <PlainSelectField
              class={controlDisplay.selectClassText}
              aria-label={fieldRow.labelText}
              optionRows={fieldRow.optionRows}
              value={fieldRow.valueText}
              disabled={controlDisabled}
              onChange={valueHandlerMode === "event"
                ? controlBindings.valueChangeHandler
                : null}
              onValueChange={valueHandlerMode === "event"
                ? null
                : controlBindings.valueChangeHandler}
            />
          {:else}
            <PlainInputField
              class={controlDisplay.inputClassText}
              aria-label={fieldRow.labelText}
              type={fieldRow.inputType || inputTypeFallback}
              value={fieldRow.valueText}
              placeholderText={fieldRow.placeholderText}
              disabled={controlDisabled}
              onInput={valueHandlerMode === "event"
                ? controlBindings.valueChangeHandler
                : null}
              onValueInput={valueHandlerMode === "event"
                ? null
                : controlBindings.valueChangeHandler}
            />
          {/if}
        </div>
        {#if fieldRow.errorText}
          <p class="text-xs text-destructive" role="alert">
            {fieldRow.errorText}
          </p>
        {/if}
      </label>
    </div>
  {/each}
</div>
