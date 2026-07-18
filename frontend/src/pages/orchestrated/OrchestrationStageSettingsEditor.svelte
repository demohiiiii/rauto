<script>
  import Layers3Icon from "@lucide/svelte/icons/layers-3";
  import PresenceFieldGrid from "../../components/fragments/PresenceFieldGrid.svelte";
  import { t } from "../../lib/i18n.js";
  import { createOrchestrationStageEditorWorkspace } from "../../modules/orchestrationStageEditorsState.js";

  let { model, stageRow, visualDisplay, onChange } = $props();
  const workspace = createOrchestrationStageEditorWorkspace();
  const {
    settingsPanelDisplayStateStore,
    stageEditorCallbacksStateStore,
    setStageContext,
  } = workspace;
  let settingsPanelDisplay = $derived($settingsPanelDisplayStateStore);
  let stageEditorCallbacks = $derived($stageEditorCallbacksStateStore);

  $effect(() => {
    setStageContext({ model, onChange, stageRow, visualDisplay });
  });
</script>

<section class="overflow-hidden rounded-xl border border-border bg-card">
  <header class="flex items-start gap-3 border-b border-border bg-muted/20 p-3">
    <span
      class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15"
    >
      <Layers3Icon class="size-4" />
    </span>
    <div class="min-w-0">
      <h3 class="text-sm font-semibold text-foreground">
        {t("orchestrationStageSettingsTitle")}
      </h3>
      <p class="mt-0.5 text-xs leading-5 text-muted-foreground">
        {t("orchestrationStageSettingsHint")}
      </p>
    </div>
  </header>
  <div class="grid gap-3 p-3 md:grid-cols-2">
    <PresenceFieldGrid
      fieldRows={settingsPanelDisplay.fieldRows}
      hostClass="contents"
      presenceControlsMode="hidden"
      onValueChangeForKey={stageEditorCallbacks.fieldValueHandler}
    />
  </div>
</section>
