<script lang="ts">
  import { Checkbox } from "$lib/components/ui/checkbox/index.js";
  import { Switch } from "$lib/components/ui/switch/index.js";
  import { plainCheckboxFieldBindings } from "../../lib/events.js";
  import { t } from "../../lib/i18n.js";

  interface CheckedChangeEvent {
    currentTarget: { checked: boolean };
    target: { checked: boolean };
  }

  interface Props {
    checked?: boolean;
    control?: "checkbox" | "switch";
    labelText?: string;
    onChange?: ((event: CheckedChangeEvent) => void) | null;
    onCheckedChange?: ((checked: boolean) => void) | null;
    showLabel?: boolean;
    title?: string;
    toggleAriaLabel?: string;
  }

  let {
    checked = false,
    control = "switch",
    labelText = "",
    onChange = null,
    onCheckedChange = null,
    showLabel = false,
    title = "",
    toggleAriaLabel = "",
  }: Props = $props();
  let checkboxBindings = $derived(
    plainCheckboxFieldBindings({ onChange, onCheckedChange }),
  );
  let resolvedLabelText = $derived(labelText || t("txBlockFormIncludeInJson"));
  let resolvedAriaLabel = $derived(toggleAriaLabel || resolvedLabelText);
  let resolvedTitle = $derived(title || resolvedLabelText);

  function checkedChangeHandler(nextChecked: boolean): void {
    checkboxBindings.changeHandler({
      currentTarget: { checked: !!nextChecked },
      target: { checked: !!nextChecked },
    });
  }
</script>

<label
  class="inline-flex cursor-pointer items-center justify-start gap-2 p-0"
  title={resolvedTitle}
>
  {#if control === "checkbox"}
    <Checkbox
      aria-label={resolvedAriaLabel}
      {checked}
      onCheckedChange={checkedChangeHandler}
    />
  {:else}
    <Switch
      aria-label={resolvedAriaLabel}
      {checked}
      onCheckedChange={checkedChangeHandler}
    />
  {/if}
  {#if showLabel}
    <span class="text-sm font-medium text-foreground">
      {resolvedLabelText}
    </span>
  {/if}
</label>
