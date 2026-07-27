<script>
  import LoadingButton from "../../components/fragments/LoadingButton.svelte";
  import PlainInputField from "../../components/fragments/PlainInputField.svelte";
  import PlainTextAreaField from "../../components/fragments/PlainTextAreaField.svelte";

  let {
    controlsDisplay,
    onList,
    onCommandInput,
    onJsonlInput,
    onModeInput,
    onRun,
  } = $props();
</script>

<div class="grid gap-4">
  <label class="grid gap-1.5 text-sm font-medium text-foreground">
    {controlsDisplay.jsonlField.labelText}
    <PlainTextAreaField
      value={controlsDisplay.jsonlField.value}
      class="min-h-32 font-mono text-xs"
      aria-label={controlsDisplay.jsonlField.ariaLabelText}
      placeholderText={controlsDisplay.jsonlField.placeholder}
      onValueInput={onJsonlInput}
    />
  </label>

  <div class="grid gap-4 md:grid-cols-2">
    <label class="grid gap-1.5 text-sm font-medium text-foreground">
      {controlsDisplay.commandField.labelText}
      <PlainInputField
        value={controlsDisplay.commandField.value}
        aria-label={controlsDisplay.commandField.ariaLabelText}
        placeholderText={controlsDisplay.commandField.placeholder}
        onValueInput={onCommandInput}
      />
    </label>
    <label class="grid gap-1.5 text-sm font-medium text-foreground">
      {controlsDisplay.modeField.labelText}
      <PlainInputField
        value={controlsDisplay.modeField.value}
        aria-label={controlsDisplay.modeField.ariaLabelText}
        placeholderText={controlsDisplay.modeField.placeholder}
        onValueInput={onModeInput}
      />
    </label>
  </div>

  <div
    class="flex flex-wrap items-center justify-end gap-2 rounded-2xl border border-border bg-muted/30 px-4 py-3"
  >
    <LoadingButton
      variant="outline"
      size="sm"
      loading={controlsDisplay.listLoading}
      onclick={onList}
    >
      <span>{controlsDisplay.listButtonLabel}</span>
    </LoadingButton>
    <LoadingButton
      variant="default"
      size="sm"
      loading={controlsDisplay.runLoading}
      onclick={onRun}
    >
      <span>{controlsDisplay.runButtonLabel}</span>
    </LoadingButton>
  </div>
</div>
