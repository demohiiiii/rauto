<script>
  import { Button } from "$lib/components/ui/button/index.js";
  import JsonObjectFieldsEditor from "../../components/fragments/JsonObjectFieldsEditor.svelte";
  import PlainSelectField from "../../components/fragments/PlainSelectField.svelte";
  import PresenceFieldGrid from "../../components/fragments/PresenceFieldGrid.svelte";
  import PresenceToggle from "../../components/fragments/PresenceToggle.svelte";
  import { createOrchestrationTargetInputEditorWorkspace } from "../../modules/orchestrationFormState.js";

  let {
    titleText,
    target,
    connectionOptionRows = [],
    targetDetail,
    targetFieldRows = [],
    varsText,
    targetInputKindRows,
    jsonValueTypeRows,
    onKindChange,
    onConnectionChange,
    onFieldChange,
    onFieldNullableModeChange = null,
    onFieldPresenceChange = null,
    onVarsChange,
    onVarsPresenceChange = null,
    onExtraChange,
    onRemove,
  } = $props();
  const targetInputWorkspace = createOrchestrationTargetInputEditorWorkspace();
  let targetInputDisplayStateStore = $derived(
    targetInputWorkspace.targetInputDisplayStateStore,
  );
  let targetInputActionHandlersStateStore = $derived(
    targetInputWorkspace.targetInputActionHandlersStateStore,
  );
  let targetInputDisplay = $derived($targetInputDisplayStateStore);
  let targetInputActionHandlers = $derived(
    $targetInputActionHandlersStateStore,
  );
  const { setTargetInputContext } = targetInputWorkspace;

  $effect(() => {
    setTargetInputContext({
      titleText,
      target,
      connectionOptionRows,
      targetDetail,
      targetFieldRows,
      varsText,
      targetInputKindRows,
      jsonValueTypeRows,
      onKindChange,
      onConnectionChange,
      onFieldChange,
      onFieldNullableModeChange,
      onFieldPresenceChange,
      onVarsChange,
      onVarsPresenceChange,
      onExtraChange,
    });
  });
</script>

<div class="grid gap-2 rounded-lg border border-border p-3 md:grid-cols-2">
  <div class="flex flex-wrap items-center justify-between gap-3 md:col-span-2">
    <span>{targetInputDisplay.titleText}</span>
    <Button variant="destructive" size="sm" type="button" onclick={onRemove}>
      {targetInputDisplay.removeButtonLabel}
    </Button>
  </div>
  <label class="flex flex-col gap-2">
    <span class="text-sm font-medium text-foreground">
      {targetInputDisplay.kindField.labelText}
    </span>
    <PlainSelectField
      value={targetInputDisplay.kindField.valueText}
      optionRows={targetInputDisplay.kindField.optionRows}
      onValueChange={targetInputActionHandlers.kindChangeHandler()}
    />
  </label>

  {#if targetInputDisplay.showConnectionField}
    <label class="flex flex-col gap-2">
      <span class="text-sm font-medium text-foreground"
        >{targetInputDisplay.connectionField.labelText}</span
      >
      <PlainSelectField
        value={targetInputDisplay.connectionField.valueText}
        optionRows={targetInputDisplay.connectionField.optionRows}
        onValueChange={targetInputActionHandlers.connectionChangeHandler()}
      />
    </label>
  {:else}
    <PresenceFieldGrid
      fieldRows={targetInputDisplay.fieldRows}
      hostClass="contents"
      onValueChangeForKey={targetInputActionHandlers.fieldValueHandler}
      onNullableModeChangeForKey={targetInputActionHandlers.fieldNullableModeHandler}
      onPresenceChangeForKey={targetInputActionHandlers.fieldPresenceHandler}
    />
    <div class="flex flex-col gap-2 md:col-span-2">
      <div class="mb-1 flex items-center justify-between gap-3">
        <span class="text-sm font-medium text-foreground">
          {targetInputDisplay.varsField.labelText}
        </span>
        {#if onVarsPresenceChange}
          <PresenceToggle
            checked={targetInputDisplay.varsField.enabled}
            onCheckedChange={targetInputActionHandlers.varsPresenceHandler()}
          />
        {/if}
      </div>
      {#if !onVarsPresenceChange || targetInputDisplay.varsField.enabled}
        <JsonObjectFieldsEditor
          title={targetInputDisplay.varsField.labelText}
          source={targetInputDisplay.varsField.source}
          typeRows={jsonValueTypeRows}
          onChange={targetInputActionHandlers.varsChange}
        />
      {/if}
    </div>
    <PresenceFieldGrid
      fieldRows={targetInputDisplay.metadataFieldRows}
      hostClass="contents"
      showPresenceToggleFallback={true}
      onValueChangeForKey={targetInputActionHandlers.extraValueHandler}
      onPresenceChangeForKey={targetInputActionHandlers.extraPresenceHandler}
    />
    <JsonObjectFieldsEditor
      title={targetInputDisplay.extraField.titleText}
      source={targetInputDisplay.extraField.source}
      typeRows={targetInputDisplay.extraField.typeRows}
      onChange={targetInputActionHandlers.extraChange}
    />
  {/if}
</div>
