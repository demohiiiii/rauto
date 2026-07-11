<script>
  import PlainCheckboxField from "../../components/fragments/PlainCheckboxField.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import { createOrchestrationInventoryPanelWorkspace } from "../../modules/orchestrationInventoryGroupsState.js";
  import OrchestrationInventoryDefaultsEditor from "./OrchestrationInventoryDefaultsEditor.svelte";
  import OrchestrationInventoryGroupEditor from "./OrchestrationInventoryGroupEditor.svelte";

  let { model, onChange, onErrorChange } = $props();
  const orchestrationInventoryPanelWorkspace =
    createOrchestrationInventoryPanelWorkspace();
  const {
    inventoryDisplayStateStore,
    inventoryPanelDisplayStateStore,
    panelCallbacksStateStore,
    setInventoryEnabledHandlerStateStore,
    setInventoryPanelContext,
  } = orchestrationInventoryPanelWorkspace;
  let inventoryDisplay = $derived($inventoryDisplayStateStore);
  let inventoryPanelDisplay = $derived($inventoryPanelDisplayStateStore);
  let panelCallbacks = $derived($panelCallbacksStateStore);
  let setInventoryEnabledHandler = $derived(
    $setInventoryEnabledHandlerStateStore,
  );

  $effect(() => {
    setInventoryPanelContext({ model, onChange });
  });
</script>

<div class="grid gap-2 rounded-lg border border-border bg-card p-3">
  <div class="flex items-center justify-between gap-2">
    <div class="font-medium">{inventoryPanelDisplay.titleText}</div>
    <PlainCheckboxField
      class="cursor-pointer gap-2 py-0"
      controlKind="switch"
      textClass="text-sm font-medium text-foreground"
      checked={inventoryPanelDisplay.enabled}
      labelText={inventoryPanelDisplay.enableLabelText}
      onCheckedChange={setInventoryEnabledHandler}
    />
  </div>
  {#if inventoryPanelDisplay.showGroupSection}
    <div class="grid gap-4">
      <OrchestrationInventoryDefaultsEditor
        {model}
        {inventoryDisplay}
        {onChange}
        {onErrorChange}
      />

      <div class="grid gap-3">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <span>{inventoryPanelDisplay.groupSectionTitle}</span>
          <Button
            size="sm"
            type="button"
            onclick={panelCallbacks.addInventoryGroup}
          >
            {inventoryPanelDisplay.addGroupButtonLabel}
          </Button>
        </div>
        {#if inventoryPanelDisplay.showGroupEmpty}
          <div class="text-sm text-slate-500">
            {inventoryPanelDisplay.addGroupButtonLabel}
          </div>
        {/if}
        {#each inventoryPanelDisplay.groupRows as groupRow (groupRow.groupIndex)}
          <OrchestrationInventoryGroupEditor
            {model}
            {groupRow}
            {inventoryDisplay}
            {onChange}
            {onErrorChange}
          />
        {/each}
      </div>
    </div>
  {/if}
</div>
