<script>
  import { Button } from "$lib/components/ui/button/index.js";
  import PlainCheckboxField from "../../components/fragments/PlainCheckboxField.svelte";
  import PlainInputField from "../../components/fragments/PlainInputField.svelte";
  import PlainTextAreaField from "../../components/fragments/PlainTextAreaField.svelte";
  import LoadingButton from "../../components/fragments/LoadingButton.svelte";
  import TabList from "../../components/fragments/TabList.svelte";
  import ValueLabelSelectField from "../../components/fragments/ValueLabelSelectField.svelte";

  let {
    controlsDisplay,
    onList,
    onCommandInput,
    onEventKindChange,
    onFailedOnlyChange,
    onJsonlInput,
    onModeSelect,
    onModeInput,
    onResetFilters,
    onRun,
    onSearchInput,
  } = $props();
</script>

<div class="grid gap-2">
  <PlainTextAreaField
    value={controlsDisplay.jsonlField.value}
    class="min-h-28 font-mono"
    aria-label={controlsDisplay.jsonlField.ariaLabelText}
    placeholderText={controlsDisplay.jsonlField.placeholder}
    onValueInput={onJsonlInput}
  />

  <div class="grid gap-2 md:grid-cols-2">
    <PlainInputField
      value={controlsDisplay.commandField.value}
      aria-label={controlsDisplay.commandField.ariaLabelText}
      placeholderText={controlsDisplay.commandField.placeholder}
      onValueInput={onCommandInput}
    />
    <PlainInputField
      value={controlsDisplay.modeField.value}
      aria-label={controlsDisplay.modeField.ariaLabelText}
      placeholderText={controlsDisplay.modeField.placeholder}
      onValueInput={onModeInput}
    />
  </div>

  <div class="inline-flex flex-wrap items-center gap-2">
    <LoadingButton
      variant="default"
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

  <div class="inline-flex items-center gap-2">
    <span class="text-sm font-semibold text-slate-600">
      {controlsDisplay.displayModeLabel}
    </span>
    <TabList
      tabItems={controlsDisplay.replayModeTabs}
      activeValue={controlsDisplay.displayMode}
      aria-label={controlsDisplay.displayModeLabel}
      onSelect={onModeSelect}
    />
    <PlainCheckboxField
      checked={controlsDisplay.failedOnly}
      labelText={controlsDisplay.failedOnlyLabel}
      title={controlsDisplay.failedOnlyLabel}
      onCheckedChange={onFailedOnlyChange}
    />
    <ValueLabelSelectField
      value={controlsDisplay.eventKind}
      class="w-55"
      title={controlsDisplay.eventKindLabel}
      aria-label={controlsDisplay.eventKindLabel}
      optionRows={controlsDisplay.eventKindOptionRows}
      onValueChange={onEventKindChange}
    />
    <PlainInputField
      value={controlsDisplay.searchField.value}
      class="w-65"
      aria-label={controlsDisplay.searchField.ariaLabelText}
      placeholderText={controlsDisplay.searchField.placeholder}
      onValueInput={onSearchInput}
    />
    <Button variant="outline" size="sm" type="button" onclick={onResetFilters}>
      {controlsDisplay.clearFiltersLabel}
    </Button>
  </div>
</div>
