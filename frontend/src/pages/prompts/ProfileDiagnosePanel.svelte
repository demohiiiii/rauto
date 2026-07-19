<script>
  import * as Card from "$lib/components/ui/card";
  import LoadingButton from "../../components/fragments/LoadingButton.svelte";
  import StringSelectField from "../../components/fragments/StringSelectField.svelte";
  import SummaryMetricCard from "../../components/fragments/SummaryMetricCard.svelte";
  import StatusCard from "../../components/fragments/StatusCard.svelte";
  import { createProfileDiagnosePanelWorkspace } from "../../modules/profiles/profiles.js";

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
</script>

{#snippet diagnoseResults()}
  <Card.Root class="mt-3">
    <Card.Header>
      <Card.Title>{diagnoseDisplay.resultTitle}</Card.Title>
      <Card.Action>
        <span class={diagnoseDisplay.badgeClass}>
          {diagnoseDisplay.badgeText}
        </span>
      </Card.Action>
    </Card.Header>
    <Card.Content class="grid gap-3">
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
              class="rounded-xl border border-slate-200 bg-white px-3 py-3"
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
    </Card.Content>
  </Card.Root>
{/snippet}

<div class="mt-4">
  <Card.Root>
    <Card.Header>
      <Card.Title>{panelDisplay.title}</Card.Title>
    </Card.Header>
    <Card.Content class="grid gap-2 md:w-190">
      <StringSelectField
        value={panelDisplay.selectedProfile}
        title={panelDisplay.selectPlaceholder}
        aria-label={panelDisplay.selectPlaceholder}
        optionValues={panelDisplay.profileNames}
        placeholderText={panelDisplay.selectPlaceholder}
        onValueChange={profileChangeHandler()}
      />
      <div class="md:w-64">
        <LoadingButton
          variant="outline"
          size="sm"
          loading={diagnoseLoading}
          onclick={runProfileDiagnose}
        >
          <span>{panelDisplay.buttonLabel}</span>
        </LoadingButton>
      </div>
    </Card.Content>
  </Card.Root>
  {@render diagnoseResults()}
</div>
