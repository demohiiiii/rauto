<script>
  import * as Card from "$lib/components/ui/card";
  import { t } from "../../lib/i18n.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { createOrchestrationInventoryGroupEditorWorkspace } from "../../modules/orchestrationInventoryState.js";
  import OrchestrationInventoryGroupSettingsEditor from "./OrchestrationInventoryGroupSettingsEditor.svelte";
  import OrchestrationInventoryGroupTargetsSection from "./OrchestrationInventoryGroupTargetsSection.svelte";

  let { model, groupRow, inventoryDisplay, onChange, onErrorChange } = $props();
  const inventoryGroupEditorWorkspace =
    createOrchestrationInventoryGroupEditorWorkspace();
  const { removeInventoryGroup, setInventoryGroupContext } =
    inventoryGroupEditorWorkspace;

  $effect(() => {
    setInventoryGroupContext({
      groupIndex: groupRow.groupIndex,
      model,
      onChange,
    });
  });
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>{groupRow.titleText}</Card.Title>
    <Card.Action>
      <Button
        variant="ghost"
        size="sm"
        type="button"
        onclick={removeInventoryGroup}
      >
        {t("deleteBtn")}
      </Button>
    </Card.Action>
  </Card.Header>
  <Card.Content class="grid gap-3">
    <OrchestrationInventoryGroupSettingsEditor
      {model}
      {groupRow}
      {inventoryDisplay}
      {onChange}
      {onErrorChange}
    />
    <div class="md:col-span-2">
      <OrchestrationInventoryGroupTargetsSection
        {model}
        {groupRow}
        {inventoryDisplay}
        {onChange}
        {onErrorChange}
      />
    </div>
  </Card.Content>
</Card.Root>
