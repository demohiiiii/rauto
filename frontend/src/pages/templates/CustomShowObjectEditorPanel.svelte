<script>
  import LoadingButton from "../../components/fragments/LoadingButton.svelte";
  import PlainCheckboxField from "../../components/fragments/PlainCheckboxField.svelte";
  import PlainInputField from "../../components/fragments/PlainInputField.svelte";
  import PlainSelectField from "../../components/fragments/PlainSelectField.svelte";

  let {
    basicFieldsDisplay,
    buttonDisplay,
    commandSectionDisplay,
    deleteLoading,
    onCommandChange,
    onDeleteAction,
    onEnabledChange,
    onMappingChange,
    onModeChange,
    onObjectChange,
    onProfileChange,
    onSaveAction,
    onTemplateChange,
    onUseMappingChange,
    saveLoading,
  } = $props();
</script>

<div class="grid gap-3">
  <div class="grid gap-3 lg:grid-cols-2">
    <PlainSelectField
      title={basicFieldsDisplay.profileField.placeholder}
      aria-label={basicFieldsDisplay.profileField.placeholder}
      value={basicFieldsDisplay.profileField.currentValue}
      optionRows={basicFieldsDisplay.profileField.options}
      onValueChange={onProfileChange}
    />
    <PlainInputField
      placeholderText={basicFieldsDisplay.objectField.placeholder}
      aria-label={basicFieldsDisplay.objectField.placeholder}
      value={basicFieldsDisplay.objectField.currentValue}
      onValueInput={onObjectChange}
    />
    <PlainSelectField
      title={basicFieldsDisplay.modeField.placeholder}
      aria-label={basicFieldsDisplay.modeField.placeholder}
      value={basicFieldsDisplay.modeField.currentValue}
      optionRows={basicFieldsDisplay.modeField.options}
      onValueChange={onModeChange}
    />
    <PlainCheckboxField
      checked={commandSectionDisplay.useMappingField.checked}
      labelText={commandSectionDisplay.useMappingField.labelText}
      title={commandSectionDisplay.useMappingField.title}
      class="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 lg:col-span-2"
      controlKind="switch"
      onCheckedChange={onUseMappingChange}
    />

    {#if !commandSectionDisplay.useMappingField.checked}
      <PlainInputField
        class="font-mono"
        placeholderText={commandSectionDisplay.manualCommandField.placeholder}
        aria-label={commandSectionDisplay.manualCommandField.placeholder}
        value={commandSectionDisplay.manualCommandField.currentValue}
        onValueInput={onCommandChange}
      />
      <PlainSelectField
        title={commandSectionDisplay.templateField.placeholder}
        aria-label={commandSectionDisplay.templateField.placeholder}
        value={commandSectionDisplay.templateField.currentValue}
        optionRows={commandSectionDisplay.templateField.options}
        onValueChange={onTemplateChange}
      />
    {/if}

    {#if commandSectionDisplay.useMappingField.checked}
      <PlainSelectField
        class="lg:col-span-2"
        title={commandSectionDisplay.mappingField.placeholder}
        aria-label={commandSectionDisplay.mappingField.placeholder}
        value={commandSectionDisplay.mappingField.currentValue}
        optionRows={commandSectionDisplay.mappingField.options}
        onValueChange={onMappingChange}
      />
    {/if}
    <PlainCheckboxField
      checked={basicFieldsDisplay.enabledField.checked}
      labelText={basicFieldsDisplay.enabledField.labelText}
      title={basicFieldsDisplay.enabledField.title}
      class="flex items-center gap-2 text-sm text-slate-600"
      onCheckedChange={onEnabledChange}
    />
  </div>

  <div class="grid gap-2 sm:grid-cols-2">
    <LoadingButton
      variant="default"
      size="sm"
      loading={saveLoading}
      onclick={onSaveAction}
    >
      <span>{buttonDisplay.saveButtonLabel}</span>
    </LoadingButton>
    <LoadingButton
      variant="destructive"
      size="sm"
      loading={deleteLoading}
      onclick={onDeleteAction}
    >
      <span>{buttonDisplay.deleteButtonLabel}</span>
    </LoadingButton>
  </div>
</div>
