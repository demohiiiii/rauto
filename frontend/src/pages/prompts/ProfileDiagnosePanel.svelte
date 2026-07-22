<script>
  import StethoscopeIcon from "@lucide/svelte/icons/stethoscope";
  import LoadingButton from "../../components/fragments/LoadingButton.svelte";
  import StringSelectField from "../../components/fragments/StringSelectField.svelte";
  import SummaryMetricCard from "../../components/fragments/SummaryMetricCard.svelte";
  import StatusCard from "../../components/fragments/StatusCard.svelte";
  import { currentLanguageState, t } from "../../lib/i18n.js";
  import { createProfileDiagnosePanelWorkspace } from "../../modules/profiles/profiles.js";

  let { embedded = false } = $props();
  const profileDiagnosePanelWorkspace = createProfileDiagnosePanelWorkspace();
  const {
    diagnoseDisplayStateStore,
    diagnoseLoadingStateStore,
    panelDisplayStateStore,
    profileChangeHandler,
    runProfileDiagnose,
  } = profileDiagnosePanelWorkspace;
  let diagnoseLoadingState = $derived($diagnoseLoadingStateStore);
  let diagnoseLoading = $derived(diagnoseLoadingState.diagnoseLoading);
  let diagnoseDisplay = $derived($diagnoseDisplayStateStore);
  let panelDisplay = $derived($panelDisplayStateStore);
  let currentLanguage = $derived($currentLanguageState);
  let panelDescription = $derived.by(() => {
    currentLanguage;
    return t("profileDiagnoseDescription");
  });
</script>

{#snippet diagnoseResults()}
  <section class="mt-5 grid gap-4 border-t border-border pt-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h3 class="text-sm font-semibold">{diagnoseDisplay.resultTitle}</h3>
      <span class={diagnoseDisplay.badgeClass}>
        {diagnoseDisplay.badgeText}
      </span>
    </div>
    <div class="grid gap-3">
      <div class="grid gap-2 md:grid-cols-4">
        {#each diagnoseDisplay.metricCards as metricCard}
          <SummaryMetricCard
            label={metricCard.labelText}
            metricValue={metricCard.metricValue}
          />
        {/each}
      </div>
      <div class="grid gap-2 md:grid-cols-2">
        {#each diagnoseDisplay.issueLists as issueList (issueList.field)}
          <div class={issueList.cardClass}>
            <h4 class="text-xs font-semibold text-slate-500">
              {issueList.labelText}
            </h4>
            <ul class="mt-2 grid gap-1 text-xs text-slate-700">
              {#each issueList.issueValues as issueValue}
                <li>{issueValue}</li>
              {/each}
            </ul>
          </div>
        {/each}
      </div>
      <div class="grid gap-2">
        {#if diagnoseDisplay.hasStatus}
          <StatusCard
            message={diagnoseDisplay.statusMessage}
            tone={diagnoseDisplay.statusTone}
          />
        {:else if diagnoseDisplay.showSummary}
          <div class="grid gap-3">
            <div class="grid gap-2 md:grid-cols-3">
              {#each diagnoseDisplay.summaryCards as summaryCard}
                <SummaryMetricCard
                  class={summaryCard.cardClass}
                  label={summaryCard.labelText}
                  labelClass={summaryCard.labelClass}
                  metricValue={summaryCard.summaryValue}
                  metricValueClass={summaryCard.summaryValueClass}
                />
              {/each}
            </div>
            <section
              class="rounded-lg border border-border bg-muted/20 px-3 py-3"
            >
              <div class="text-xs font-semibold text-slate-500">
                {diagnoseDisplay.summaryBreakdownTitle}
              </div>
              <div class="mt-2 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                {#if diagnoseDisplay.hasVisibleBreakdown}
                  {#each diagnoseDisplay.visibleBreakdown as breakdownRow (breakdownRow.field)}
                    <SummaryMetricCard
                      class={breakdownRow.breakdownClass}
                      label={breakdownRow.labelText}
                      labelClass={breakdownRow.breakdownLabelClass}
                      metricValue={breakdownRow.breakdownValue}
                      metricValueClass={breakdownRow.breakdownValueClass}
                    />
                  {/each}
                {:else}
                  <div
                    class="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
                  >
                    {diagnoseDisplay.summaryNoneText}
                  </div>
                {/if}
              </div>
            </section>
          </div>
        {/if}
      </div>
    </div>
  </section>
{/snippet}

<div class="grid gap-5">
  <section
    class={embedded
      ? "grid gap-4"
      : "grid gap-4 rounded-lg border border-border bg-card/50 p-4 sm:p-5"}
  >
    {#if !embedded}
      <div class="flex items-start gap-3">
        <div
          class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
        >
          <StethoscopeIcon class="size-4" aria-hidden="true" />
        </div>
        <div class="min-w-0">
          <h2 class="text-base font-semibold">{panelDisplay.title}</h2>
          <p class="mt-1 text-sm leading-6 text-muted-foreground">
            {panelDescription}
          </p>
        </div>
      </div>
    {/if}
    <div
      class="grid gap-3 md:max-w-2xl md:grid-cols-[minmax(0,1fr)_auto] md:items-end"
    >
      <StringSelectField
        value={panelDisplay.selectedProfile}
        title={panelDisplay.selectPlaceholder}
        aria-label={panelDisplay.selectPlaceholder}
        optionValues={panelDisplay.profileNames}
        placeholderText={panelDisplay.selectPlaceholder}
        onValueChange={profileChangeHandler()}
      />
      <LoadingButton
        class="min-h-10"
        variant="outline"
        loading={diagnoseLoading}
        onclick={runProfileDiagnose}
      >
        <span>{panelDisplay.buttonLabel}</span>
      </LoadingButton>
    </div>
  </section>
  {@render diagnoseResults()}
</div>
