<script>
  import CrosshairIcon from "@lucide/svelte/icons/crosshair";
  import GaugeIcon from "@lucide/svelte/icons/gauge";
  import PlayCircleIcon from "@lucide/svelte/icons/play-circle";
  import { createOrchestrationJobEditorWorkspace } from "../../modules/orchestrationStageEditorsState.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { t } from "../../lib/i18n.js";
  import OrchestrationJobActionEditor from "./OrchestrationJobActionEditor.svelte";
  import OrchestrationJobSettingsEditor from "./OrchestrationJobSettingsEditor.svelte";
  import OrchestrationJobTargetsSection from "./OrchestrationJobTargetsSection.svelte";

  let {
    model,
    stageIndex,
    jobRow,
    visualDisplay,
    onChange,
    onErrorChange,
    onRemove,
    framed = true,
    showHeader = true,
  } = $props();
  const orchestrationJobEditorWorkspace =
    createOrchestrationJobEditorWorkspace();
  const { jobEditorDisplayStateStore, jobRowStateStore, setJobRow } =
    orchestrationJobEditorWorkspace;
  let jobEditorDisplay = $derived($jobEditorDisplayStateStore);
  let syncedJobRow = $derived($jobRowStateStore);

  $effect(() => {
    setJobRow(jobRow);
  });
</script>

<div
  class={framed
    ? "grid gap-4 rounded-xl border border-border bg-card p-3"
    : "grid gap-4"}
>
  {#if showHeader}
    <div class="flex flex-wrap items-center justify-between gap-3">
      <span>{jobEditorDisplay.titleText}</span>
      <Button variant="ghost" size="sm" type="button" onclick={onRemove}>
        {jobEditorDisplay.removeButtonLabel}
      </Button>
    </div>
  {/if}
  <section
    class="relative z-30 overflow-hidden rounded-xl border border-border bg-card"
  >
    <header
      class="flex items-start gap-3 border-b border-border bg-muted/20 p-3"
    >
      <span
        class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15"
      >
        <GaugeIcon class="size-4" />
      </span>
      <div class="min-w-0">
        <h3 class="text-sm font-semibold text-foreground">
          {t("orchestrationJobSettingsTitle")}
        </h3>
        <p class="mt-0.5 text-xs leading-5 text-muted-foreground">
          {t("orchestrationJobSettingsHint")}
        </p>
      </div>
    </header>
    <div class="p-3">
      <OrchestrationJobSettingsEditor
        {model}
        {stageIndex}
        jobIndex={syncedJobRow.jobIndex}
        job={syncedJobRow.job}
        {visualDisplay}
        {onChange}
      />
    </div>
  </section>

  <section
    class="relative z-20 overflow-visible rounded-xl border border-border bg-card"
  >
    <header
      class="flex items-start gap-3 rounded-t-xl border-b border-border bg-muted/20 p-3"
    >
      <span
        class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-chart-2/10 text-chart-2 ring-1 ring-chart-2/20"
      >
        <CrosshairIcon class="size-4" />
      </span>
      <div class="min-w-0">
        <h3 class="text-sm font-semibold text-foreground">
          {t("orchestrationJobTargetsTitle")}
        </h3>
        <p class="mt-0.5 text-xs leading-5 text-muted-foreground">
          {t("orchestrationJobTargetsHint")}
        </p>
      </div>
    </header>
    <div class="grid gap-3 p-3">
      <OrchestrationJobTargetsSection
        {model}
        {stageIndex}
        jobRow={syncedJobRow}
        {onChange}
      />
    </div>
  </section>

  <section
    class="relative z-10 overflow-hidden rounded-xl border border-border bg-card"
  >
    <header
      class="flex items-start gap-3 border-b border-border bg-muted/20 p-3"
    >
      <span
        class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-chart-3/10 text-chart-3 ring-1 ring-chart-3/20"
      >
        <PlayCircleIcon class="size-4" />
      </span>
      <div class="min-w-0">
        <h3 class="text-sm font-semibold text-foreground">
          {t("orchestrationJobActionTitle")}
        </h3>
        <p class="mt-0.5 text-xs leading-5 text-muted-foreground">
          {t("orchestrationJobActionHint")}
        </p>
      </div>
    </header>
    <div class="p-3">
      <OrchestrationJobActionEditor
        {model}
        {stageIndex}
        jobIndex={syncedJobRow.jobIndex}
        jobRow={syncedJobRow}
        {visualDisplay}
        {onChange}
        {onErrorChange}
      />
    </div>
  </section>
</div>
