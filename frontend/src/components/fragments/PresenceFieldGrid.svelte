<script lang="ts">
  import type { HTMLInputAttributes } from "svelte/elements";
  import { presenceFieldRowBindings } from "../../lib/events.js";
  import { classNames, presenceFieldControlDisplay } from "../../lib/ui.js";
  import ModeExpressionField from "./ModeExpressionField.svelte";
  import PlainInputField from "./PlainInputField.svelte";
  import PlainSelectField from "./PlainSelectField.svelte";
  import PresenceToggle from "./PresenceToggle.svelte";
  import type {
    PresenceFieldPresenceHandler,
    PresenceFieldPresenceHandlerForKey,
    PresenceFieldRow,
    PresenceFieldValueInput,
    PresenceFieldValueHandler,
    PresenceFieldValueHandlerForKey,
  } from "./presenceFieldTypes.js";

  type PresenceControlsMode = "hidden" | "inline";
  type ValueHandlerMode = "event" | "value";
  type FieldHandlerForRow<THandler> = (
    fieldRow: PresenceFieldRow,
  ) => THandler | null | undefined;

  interface Props {
    controlClassByFieldKey?: Record<string, string>;
    controlTypeFallback?: "input" | "mode-expression" | "select";
    fieldRows?: PresenceFieldRow[];
    hostClass?: string;
    inputTypeFallback?: HTMLInputAttributes["type"];
    itemClass?: string;
    itemClassByFieldKey?: Record<string, string>;
    labelClass?: string;
    onNullableModeChange?: PresenceFieldValueHandler | null;
    onNullableModeChangeForKey?: PresenceFieldValueHandlerForKey | null;
    onNullableModeChangeForRow?: FieldHandlerForRow<PresenceFieldValueHandler> | null;
    onPresenceChange?: PresenceFieldPresenceHandler | null;
    onPresenceChangeForKey?: PresenceFieldPresenceHandlerForKey | null;
    onPresenceChangeForRow?: FieldHandlerForRow<PresenceFieldPresenceHandler> | null;
    onValueChange?: PresenceFieldValueHandler | null;
    onValueChangeForKey?: PresenceFieldValueHandlerForKey | null;
    onValueChangeForRow?: FieldHandlerForRow<PresenceFieldValueHandler> | null;
    presenceControlsMode?: PresenceControlsMode;
    showPresenceToggleFallback?: boolean | null;
    valueHandlerMode?: ValueHandlerMode;
  }

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
  }: Props = $props();

  function shouldShowPresenceToggle(fieldRow: PresenceFieldRow): boolean {
    return typeof showPresenceToggleFallback === "boolean"
      ? showPresenceToggleFallback
      : !!fieldRow.showPresenceToggle;
  }

  function invalidFieldControl(node: HTMLElement, invalid: boolean) {
    function syncInvalidState(nextInvalid: boolean): void {
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
    {@const controlBindings = presenceFieldRowBindings<
      PresenceFieldValueInput,
      PresenceFieldValueInput,
      PresenceFieldRow
    >({
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
                : undefined}
              onValueChange={valueHandlerMode === "event"
                ? undefined
                : controlBindings.nullableModeChangeHandler}
            />
          </div>
        {/if}
        <div class="contents" use:invalidFieldControl={!!fieldRow.errorText}>
          {#if (fieldRow.controlType || controlTypeFallback) === "mode-expression"}
            <ModeExpressionField
              class={controlDisplay.inputClassText}
              aria-label={fieldRow.labelText}
              optionValues={fieldRow.optionValues || []}
              value={fieldRow.valueText}
              placeholderText={fieldRow.placeholderText}
              disabled={controlDisabled}
              onChange={valueHandlerMode === "event"
                ? controlBindings.valueChangeHandler
                : undefined}
              onValueChange={valueHandlerMode === "event"
                ? undefined
                : controlBindings.valueChangeHandler}
            />
          {:else if (fieldRow.controlType || controlTypeFallback) === "select"}
            <PlainSelectField
              class={controlDisplay.selectClassText}
              aria-label={fieldRow.labelText}
              optionRows={fieldRow.optionRows}
              value={fieldRow.valueText}
              disabled={controlDisabled}
              onChange={valueHandlerMode === "event"
                ? controlBindings.valueChangeHandler
                : undefined}
              onValueChange={valueHandlerMode === "event"
                ? undefined
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
                : undefined}
              onValueInput={valueHandlerMode === "event"
                ? undefined
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
