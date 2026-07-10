<script>
  import LoadingButton from "../../components/fragments/LoadingButton.svelte";
  import OutputBlock from "../../components/fragments/OutputBlock.svelte";
  import ParsedOutputBlock from "../../components/fragments/ParsedOutputBlock.svelte";
  import PlainInputField from "../../components/fragments/PlainInputField.svelte";
  import StatusCard from "../../components/fragments/StatusCard.svelte";
  import TextfsmControls from "../../components/fragments/TextfsmControls.svelte";
  import ValueTextSelectField from "../../components/fragments/ValueTextSelectField.svelte";
  import {
    createDirectExecutionPanelWorkspace,
    exportStandardParsedOutputItemExcel,
  } from "../../modules/standard.js";

  let { active } = $props();
  const directExecutionWorkspace = createDirectExecutionPanelWorkspace();
  const {
    changeDirectCommand,
    changeDirectMode,
    changeDirectTextfsmEnabled,
    changeDirectTextfsmPlatform,
    changeDirectTextfsmStrictErrors,
    changeDirectTextfsmTemplate,
    directPanelDisplayStateStore,
    executeDirectExecution,
    setPanelContext,
  } = directExecutionWorkspace;

  let directPanelDisplay = $derived($directPanelDisplayStateStore);
  let directResultDisplay = $derived(directPanelDisplay.directResultDisplay);
  let executeLoading = $derived(directPanelDisplay.executeLoading);
  let directTextfsmFields = $derived(directPanelDisplay.textfsmFields);
  let runDisplay = $derived(directPanelDisplay.runDisplay);

  $effect(() => {
    setPanelContext({ active, directPanelDisplay });
  });
</script>

<div class="grid gap-3" hidden={!active}>
  <div class="grid gap-3">
    <div class="grid items-center gap-2 md:grid-cols-2">
      <PlainInputField
        aria-label={runDisplay.commandField.ariaLabelText}
        value={runDisplay.commandField.value}
        placeholderText={runDisplay.commandField.placeholder}
        onValueInput={changeDirectCommand}
      />
      <ValueTextSelectField
        title={runDisplay.modeField.placeholder}
        aria-label={runDisplay.modeField.ariaLabelText}
        value={runDisplay.modeField.value}
        optionRows={runDisplay.modeOptionRows}
        onValueChange={changeDirectMode}
      />
    </div>
    {#if active}
      <TextfsmControls
        excelNamePlaceholderKey="batchShowExcelNamePlaceholder"
        hintKey="textfsmParseHint"
        includeTemplateInput={true}
        onEnabledChange={changeDirectTextfsmEnabled}
        onPlatformChange={changeDirectTextfsmPlatform}
        onStrictErrorsChange={changeDirectTextfsmStrictErrors}
        onTemplateChange={changeDirectTextfsmTemplate}
        textfsmFields={directTextfsmFields}
      />
    {/if}
    <div class="flex justify-end">
      <LoadingButton
        variant="default"
        size="sm"
        loading={executeLoading}
        onclick={executeDirectExecution}
      >
        <span>{runDisplay.executeButtonLabel}</span>
      </LoadingButton>
    </div>
  </div>
  <div class="mt-2">
    {#if directResultDisplay.statusMessage}
      <StatusCard
        message={directResultDisplay.statusMessage}
        tone={directResultDisplay.statusTone}
      />
    {/if}
    {#if directResultDisplay.output}
      <OutputBlock>{directResultDisplay.output}</OutputBlock>
    {/if}
    {#if directResultDisplay.parsedOutputBlock}
      <ParsedOutputBlock
        parsedOutputBlock={directResultDisplay.parsedOutputBlock}
        onExportExcel={exportStandardParsedOutputItemExcel}
      />
    {/if}
  </div>
</div>
