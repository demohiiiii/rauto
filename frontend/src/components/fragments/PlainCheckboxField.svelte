<script>
  import { Checkbox } from "$lib/components/ui/checkbox/index.js";
  import { Switch } from "$lib/components/ui/switch/index.js";
  import { classNames } from "../../lib/ui.js";
  import { plainCheckboxFieldBindings } from "../../lib/events.js";

  const defaultLabelClass = "inline-flex items-center gap-2 text-sm";

  let {
    checked = false,
    labelText = "",
    title = "",
    value = "",
    disabled = false,
    hidden = false,
    "aria-label": ariaLabel = "",
    class: labelClass = "",
    inputClass = "",
    textClass = "",
    afterText = "",
    afterTextClass = "",
    controlKind = "checkbox",
    onChange,
    onCheckedChange,
    onchange = null,
  } = $props();
  let checkboxBindings = $derived(
    plainCheckboxFieldBindings({
      onChange: typeof onchange === "function" ? onchange : onChange,
      onCheckedChange,
    }),
  );
  let labelClassName = $derived(classNames(defaultLabelClass, labelClass));
  let usesSwitchStyle = $derived(
    controlKind === "switch" || /\btoggle\b/.test(inputClass),
  );
  let controlSize = $derived(
    /\btoggle-sm\b/.test(inputClass) ? "sm" : "default",
  );

  function checkedChangeHandler(nextChecked) {
    return checkboxBindings.changeHandler({
      currentTarget: { checked: !!nextChecked },
      target: { checked: !!nextChecked },
    });
  }
</script>

<label class={labelClassName} {hidden}>
  {#if usesSwitchStyle}
    <Switch
      aria-label={ariaLabel || title || labelText}
      title={title || labelText}
      {value}
      {disabled}
      {checked}
      size={controlSize}
      onCheckedChange={checkedChangeHandler}
    />
  {:else}
    <Checkbox
      class={inputClass}
      aria-label={ariaLabel || title || labelText}
      title={title || labelText}
      {value}
      {disabled}
      {checked}
      onCheckedChange={checkedChangeHandler}
    />
  {/if}
  <span class={textClass}>{labelText}</span>
  {#if afterText}
    <span class={afterTextClass}>{afterText}</span>
  {/if}
</label>
