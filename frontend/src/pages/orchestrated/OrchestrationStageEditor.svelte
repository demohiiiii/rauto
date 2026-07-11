<script>
  import * as Card from "$lib/components/ui/card";
  import JsonObjectFieldsEditor from "../../components/fragments/JsonObjectFieldsEditor.svelte";
  import PresenceFieldGrid from "../../components/fragments/PresenceFieldGrid.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import { t } from "../../lib/i18n.js";
  import { createOrchestrationStageEditorWorkspace } from "../../modules/orchestrationStageEditorsState.js";
  import OrchestrationJobEditor from "./OrchestrationJobEditor.svelte";

  let { model, stageRow, visualDisplay, onChange, onErrorChange, onRemove } =
    $props();
  const orchestrationStageEditorWorkspace =
    createOrchestrationStageEditorWorkspace();
  const {
    settingsPanelDisplayStateStore,
    stageEditorCallbacksStateStore,
    stageRowStateStore,
    setStageContext,
  } = orchestrationStageEditorWorkspace;
  let settingsPanelDisplay = $derived($settingsPanelDisplayStateStore);
  let stageEditorCallbacks = $derived($stageEditorCallbacksStateStore);
  let syncedStageRow = $derived($stageRowStateStore);

  $effect(() => {
    setStageContext({ model, onChange, stageRow, visualDisplay });
  });
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>{syncedStageRow.titleText}</Card.Title>
    <Card.Action>
      <Button variant="ghost" size="sm" type="button" onclick={onRemove}>
        {t("deleteBtn")}
      </Button>
    </Card.Action>
  </Card.Header>
  <Card.Content class="grid gap-3">
    <div class="grid gap-3 md:grid-cols-2">
      <PresenceFieldGrid
        fieldRows={settingsPanelDisplay.fieldRows}
        hostClass="contents"
        onValueChangeForKey={stageEditorCallbacks.fieldValueHandler}
        onPresenceChangeForKey={stageEditorCallbacks.fieldPresenceHandler}
      />
      <PresenceFieldGrid
        fieldRows={settingsPanelDisplay.metadataFieldRows}
        hostClass="contents"
        onValueChangeForKey={stageEditorCallbacks.metadataValueHandler}
        onPresenceChangeForKey={stageEditorCallbacks.metadataPresenceHandler}
      />
    </div>
    <JsonObjectFieldsEditor
      title={settingsPanelDisplay.extraField.titleText}
      source={settingsPanelDisplay.extraField.source}
      typeRows={settingsPanelDisplay.extraField.typeRows}
      onChange={stageEditorCallbacks.setExtra}
    />

    <div class="grid gap-3">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <span>{t("orchestrationFormJob")}</span>
        <Button size="sm" type="button" onclick={stageEditorCallbacks.addJob}>
          {t("orchestrationFormAddJob")}
        </Button>
      </div>
      {#each syncedStageRow.jobRows as jobRow (jobRow.jobIndex)}
        <OrchestrationJobEditor
          {model}
          stageIndex={syncedStageRow.stageIndex}
          {jobRow}
          {visualDisplay}
          {onChange}
          {onErrorChange}
          onRemove={stageEditorCallbacks.removeJobHandler(jobRow.jobIndex)}
        />
      {/each}
    </div>
  </Card.Content>
</Card.Root>
