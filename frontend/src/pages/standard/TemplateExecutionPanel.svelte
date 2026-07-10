<script>
  import JsonObjectFieldsEditor from "../../components/fragments/JsonObjectFieldsEditor.svelte";
  import LoadingButton from "../../components/fragments/LoadingButton.svelte";
  import OutputBlock from "../../components/fragments/OutputBlock.svelte";
  import StatusCard from "../../components/fragments/StatusCard.svelte";
  import StringSelectField from "../../components/fragments/StringSelectField.svelte";
  import TextfsmControls from "../../components/fragments/TextfsmControls.svelte";
  import TemplateExecutionContentPanel from "./TemplateExecutionContentPanel.svelte";
  import ValueTextSelectField from "../../components/fragments/ValueTextSelectField.svelte";
  import { createTemplateExecutionPanelWorkspace } from "../../modules/standard.js";
  import TemplateExecutionResultsPanel from "./TemplateExecutionResultsPanel.svelte";

  let { active } = $props();
  const templateExecutionWorkspace = createTemplateExecutionPanelWorkspace();
  const {
    changeTemplateMode,
    changeTemplateName,
    changeTemplateTextfsmEnabled,
    changeTemplateTextfsmPlatform,
    changeTemplateTextfsmStrictErrors,
    changeTemplateTextfsmTemplate,
    changeTemplateVars,
    runActionHandlers,
    setPanelContext,
    templatePanelDisplayStateStore,
  } = templateExecutionWorkspace;
  let templatePanelDisplay = $derived($templatePanelDisplayStateStore);
  let executeLoading = $derived(templatePanelDisplay.executeLoading);
  let previewLoading = $derived(templatePanelDisplay.previewLoading);
  let runDisplay = $derived(templatePanelDisplay.runDisplay);
  let templateExecutionDisplay = $derived(
    templatePanelDisplay.templateExecutionDisplay,
  );
  let templateInputDisplay = $derived(
    templatePanelDisplay.templateInputDisplay,
  );
  let templatePreviewStatus = $derived(
    templatePanelDisplay.templatePreviewStatus,
  );
  let templateTextfsmFields = $derived(templatePanelDisplay.textfsmFields);

  $effect(() => {
    setPanelContext({ active, templatePanelDisplay });
  });
</script>

<div class="grid gap-3" hidden={!active}>
  <StringSelectField
    title={templateInputDisplay.templateField.placeholder}
    aria-label={templateInputDisplay.templateField.ariaLabelText}
    value={templateInputDisplay.templateField.value}
    optionValues={templateInputDisplay.templateOptionRows}
    placeholderText={templateInputDisplay.templateSelectField.placeholder}
    onValueChange={changeTemplateName}
  />

  <TemplateExecutionContentPanel {templateInputDisplay} />

  <JsonObjectFieldsEditor
    title={templateInputDisplay.varsField.placeholder}
    source={templateInputDisplay.varsField.source}
    typeRows={["string", "number", "boolean", "null", "json"]}
    onChange={changeTemplateVars}
  />

  <ValueTextSelectField
    title={templateInputDisplay.modeField.placeholder}
    aria-label={templateInputDisplay.modeField.ariaLabelText}
    value={templateInputDisplay.modeField.value}
    optionRows={templateInputDisplay.modeOptionRows}
    onValueChange={changeTemplateMode}
  />

  {#if active}
    <TextfsmControls
      excelNamePlaceholderKey="batchShowExcelNamePlaceholder"
      hintKey="textfsmParseHint"
      includeTemplateInput={true}
      onEnabledChange={changeTemplateTextfsmEnabled}
      onPlatformChange={changeTemplateTextfsmPlatform}
      onStrictErrorsChange={changeTemplateTextfsmStrictErrors}
      onTemplateChange={changeTemplateTextfsmTemplate}
      textfsmFields={templateTextfsmFields}
    />
  {/if}

  <div class="grid grid-cols-2 gap-2">
    <LoadingButton
      variant="outline"
      size="sm"
      loading={previewLoading}
      onclick={runActionHandlers.preview}
    >
      <span>{runDisplay.previewButtonLabel}</span>
    </LoadingButton>
    <LoadingButton
      variant="default"
      size="sm"
      loading={executeLoading}
      onclick={runActionHandlers.execute}
    >
      <span>{runDisplay.executeButtonLabel}</span>
    </LoadingButton>
  </div>

  <OutputBlock class="mt-2" tag="div">
    {#if templatePreviewStatus.message}
      <StatusCard
        message={templatePreviewStatus.message}
        tone={templatePreviewStatus.tone}
      />
    {:else if templatePreviewStatus.text}
      {templatePreviewStatus.text}
    {/if}
  </OutputBlock>
  <TemplateExecutionResultsPanel {templateExecutionDisplay} />
</div>
