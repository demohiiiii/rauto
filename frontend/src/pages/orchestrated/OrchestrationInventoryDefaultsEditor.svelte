<script>
  import JsonObjectFieldsEditor from "../../components/fragments/JsonObjectFieldsEditor.svelte";
  import PresenceFieldGrid from "../../components/fragments/PresenceFieldGrid.svelte";
  import PresenceToggle from "../../components/fragments/PresenceToggle.svelte";
  import { t } from "../../lib/i18n.js";
  import { createOrchestrationInventoryDefaultsEditorWorkspace } from "../../modules/orchestrationInventoryDefaultsState.js";

  let { model, inventoryDisplay, onChange, onErrorChange } = $props();
  const orchestrationInventoryDefaultsEditorWorkspace =
    createOrchestrationInventoryDefaultsEditorWorkspace();
  const {
    defaultsCallbacksStateStore,
    defaultsDisplayStateStore,
    setInventoryDefaultsContext,
  } = orchestrationInventoryDefaultsEditorWorkspace;
  let defaultsCallbacks = $derived($defaultsCallbacksStateStore);
  let defaultsDisplay = $derived($defaultsDisplayStateStore);

  $effect(() => {
    setInventoryDefaultsContext({
      inventoryDisplay,
      model,
      onChange,
      onErrorChange,
    });
  });
</script>

<div class="grid gap-4">
  <div class="grid gap-3 md:grid-cols-2">
    <PresenceFieldGrid
      fieldRows={defaultsDisplay.fieldRows}
      hostClass="contents"
      onValueChangeForKey={defaultsCallbacks.fieldValueHandler}
      onNullableModeChangeForKey={defaultsCallbacks.fieldNullableModeHandler}
      onPresenceChangeForKey={defaultsCallbacks.fieldPresenceHandler}
    />
    <PresenceFieldGrid
      fieldRows={defaultsDisplay.metadataFieldRows}
      hostClass="contents"
      showPresenceToggleFallback={true}
      onValueChangeForKey={defaultsCallbacks.metadataValueHandler}
      onPresenceChangeForKey={defaultsCallbacks.metadataPresenceHandler}
    />
    <div class="flex flex-col gap-2 md:col-span-2">
      <div class="mb-1 flex items-center justify-between gap-3">
        <span class="text-sm font-medium text-foreground">
          {defaultsDisplay.varsField.labelText}
        </span>
        <PresenceToggle
          checked={defaultsDisplay.varsField.enabled}
          onCheckedChange={defaultsCallbacks.varsPresenceHandler()}
        />
      </div>
      {#if defaultsDisplay.varsField.enabled}
        <JsonObjectFieldsEditor
          title={defaultsDisplay.varsField.labelText}
          source={defaultsDisplay.varsField.source}
          typeRows={inventoryDisplay.jsonValueTypeRows}
          onChange={defaultsCallbacks.setDefaultsVars}
        />
      {/if}
    </div>
    <JsonObjectFieldsEditor
      title={defaultsDisplay.extraField.titleText}
      source={defaultsDisplay.extraField.source}
      typeRows={defaultsDisplay.extraField.typeRows}
      onChange={defaultsCallbacks.setDefaultsExtra}
    />
  </div>

  <JsonObjectFieldsEditor
    title={t("orchestrationFormInventoryExtra")}
    source={model.inventory.extra}
    typeRows={inventoryDisplay.jsonValueTypeRows}
    onChange={defaultsCallbacks.setInventoryExtra}
  />
</div>
