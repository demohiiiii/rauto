<script>
  import InfoIcon from "@lucide/svelte/icons/info";
  import SparklesIcon from "@lucide/svelte/icons/sparkles";
  import { Switch } from "$lib/components/ui/switch/index.js";
  import { createTextfsmControlsWorkspace } from "../../lib/svelte.js";
  import PlainInputField from "./PlainInputField.svelte";
  import PlainSelectField from "./PlainSelectField.svelte";

  let {
    excelNamePlaceholderKey,
    hintKey,
    includeTemplateInput,
    onEnabledChange,
    onExcelNameChange,
    onPlatformChange,
    onStrictErrorsChange,
    onTemplateChange,
    textfsmFields,
  } = $props();
  function handleEnabledChange(value) {
    if (typeof onEnabledChange === "function") {
      return onEnabledChange(value);
    }
    return undefined;
  }

  function handleExcelNameChange(value) {
    if (typeof onExcelNameChange === "function") {
      return onExcelNameChange(value);
    }
    return undefined;
  }

  function handlePlatformChange(value) {
    if (typeof onPlatformChange === "function") {
      return onPlatformChange(value);
    }
    return undefined;
  }

  function handleStrictErrorsChange(value) {
    if (typeof onStrictErrorsChange === "function") {
      return onStrictErrorsChange(value);
    }
    return undefined;
  }

  function handleTemplateChange(value) {
    if (typeof onTemplateChange === "function") {
      return onTemplateChange(value);
    }
    return undefined;
  }

  const textfsmControlsWorkspace = createTextfsmControlsWorkspace({
    onEnabledChange: handleEnabledChange,
    onExcelNameChange: handleExcelNameChange,
    onPlatformChange: handlePlatformChange,
    onStrictErrorsChange: handleStrictErrorsChange,
    onTemplateChange: handleTemplateChange,
  });
  let usesExcelNameStateStore = $derived(
    textfsmControlsWorkspace.usesExcelNameStateStore,
  );
  let controlsDisplayStateStore = $derived(
    textfsmControlsWorkspace.controlsDisplayStateStore,
  );
  const {
    excelNameValueHandler,
    platformValueHandler,
    setDisplayInputs,
    templateValueHandler,
  } = textfsmControlsWorkspace;
  let usesExcelName = $derived($usesExcelNameStateStore);
  let controlsDisplay = $derived($controlsDisplayStateStore);

  $effect(() => {
    setDisplayInputs({
      excelNamePlaceholderKey,
      hintKey,
      includeTemplateInput,
      textfsmFields,
    });
  });
</script>

<section class="rounded-2xl border border-border bg-muted/30 p-4">
  <div class="flex items-center justify-between gap-3">
    <div class="flex items-center gap-2">
      <SparklesIcon class="size-4 text-primary" aria-hidden="true" />
      <span class="text-sm font-semibold text-foreground">
        {controlsDisplay.parseToggleLabel}
      </span>
    </div>
    <Switch
      class="shrink-0"
      aria-label={controlsDisplay.parseToggleLabel}
      checked={textfsmFields.enabled}
      onCheckedChange={handleEnabledChange}
    />
  </div>

  <p
    class="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground"
  >
    <InfoIcon class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
    <span>{controlsDisplay.hintText}</span>
  </p>

  {#if textfsmFields.enabled}
    <div class="mt-4 flex flex-col gap-4">
      <div class="grid gap-4 sm:grid-cols-[1fr_220px]">
        {#if includeTemplateInput}
          <PlainInputField
            class="h-11 rounded-xl"
            aria-label={controlsDisplay.templateField.ariaLabelText}
            placeholderText={controlsDisplay.templateField.placeholder}
            value={textfsmFields.template}
            onValueInput={templateValueHandler}
          />
        {/if}
        <PlainSelectField
          class={includeTemplateInput
            ? "h-11 cursor-pointer rounded-xl"
            : "h-11 cursor-pointer rounded-xl sm:col-span-2"}
          title={controlsDisplay.platformTitle}
          aria-label={controlsDisplay.platformTitle}
          optionRows={controlsDisplay.platformSelectRows}
          value={textfsmFields.platform}
          onValueChange={platformValueHandler}
        />
      </div>

      {#if usesExcelName}
        <PlainInputField
          class="h-11 rounded-xl"
          aria-label={controlsDisplay.excelNameField.ariaLabelText}
          placeholderText={controlsDisplay.excelNameField.placeholder}
          value={textfsmFields.excelName}
          onValueInput={excelNameValueHandler}
        />
      {/if}

      <div
        class="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
      >
        <span class="text-sm font-medium text-foreground">
          {controlsDisplay.strictErrorsLabel}
        </span>
        <Switch
          class="shrink-0"
          aria-label={controlsDisplay.strictErrorsLabel}
          checked={textfsmFields.strictErrors}
          onCheckedChange={handleStrictErrorsChange}
        />
      </div>
    </div>
  {/if}
</section>
