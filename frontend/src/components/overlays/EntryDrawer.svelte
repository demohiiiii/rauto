<script>
  import DashboardDrawerShell from "./DashboardDrawerShell.svelte";
  import {
    closeEntryDrawer,
    createEntryDrawerWorkspace,
  } from "../../modules/overlays.js";
  import DetailFieldCard from "../fragments/DetailFieldCard.svelte";
  import EventFlowCell from "../fragments/EventFlowCell.svelte";

  const entryDrawerWorkspace = createEntryDrawerWorkspace({
    onClose: closeEntryDrawer,
  });
  const { entryDisplayStateStore } = entryDrawerWorkspace;
  let entryDisplay = $derived($entryDisplayStateStore);
  let drawerShellDisplay = $derived({
    ariaLabelText: entryDisplay.titleText,
    closeLabel: entryDisplay.closeLabel,
    open: entryDisplay.open,
    title: entryDisplay.titleText,
  });
</script>

{#snippet basicDetailsSection()}
  <section class="rounded-xl border border-slate-200 bg-slate-50 p-3">
    <div class="mb-2 text-xs font-semibold text-slate-600">
      {entryDisplay.contentLabels.basicSectionTitle}
    </div>
    <div class="grid gap-2 md:grid-cols-2">
      <DetailFieldCard
        label={entryDisplay.contentLabels.kindLabel}
        detailValue={entryDisplay.kind}
      />
      <DetailFieldCard
        badgeClass={entryDisplay.successBadgeClass}
        label={entryDisplay.contentLabels.successLabel}
        detailValue={entryDisplay.successText}
      />
      <DetailFieldCard
        label={entryDisplay.contentLabels.commandLabel}
        detailValue={entryDisplay.command}
        mono
      />
      <DetailFieldCard
        label={entryDisplay.contentLabels.modeLabel}
        detailValue={entryDisplay.mode}
        mono
      />
      <DetailFieldCard
        label={entryDisplay.contentLabels.promptLabel}
        detailValue={entryDisplay.prompt}
        mono
      />
      <DetailFieldCard
        label={entryDisplay.contentLabels.fsmPromptLabel}
        detailValue={entryDisplay.fsmPrompt}
        mono
      />
      <DetailFieldCard
        label={entryDisplay.contentLabels.timestampLabel}
        detailValue={entryDisplay.timestamp}
      />
      <DetailFieldCard
        label={entryDisplay.contentLabels.deviceLabel}
        detailValue={entryDisplay.device}
        mono
      />
      <DetailFieldCard
        label={entryDisplay.contentLabels.recordLevelLabel}
        detailValue={entryDisplay.recordLevel}
        mono
      />
    </div>
  </section>
{/snippet}

<DashboardDrawerShell
  class="w-[min(92vw,44rem)] max-w-[44rem] sm:max-w-[44rem]"
  {drawerShellDisplay}
  onClose={closeEntryDrawer}
>
  <div class="overflow-auto p-4">
    {#if entryDisplay.open}
      {@render basicDetailsSection()}
      <section class="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div class="mb-2 text-xs font-semibold text-slate-600">
          {entryDisplay.contentLabels.flowSectionTitle}
        </div>
        <div class="grid gap-2 lg:grid-cols-2">
          <div>
            <div class="mb-1 text-[11px] font-semibold text-slate-500">
              {entryDisplay.contentLabels.promptFlowLabel}
            </div>
            <EventFlowCell flow={entryDisplay.promptFlow} />
          </div>
          <div>
            <div class="mb-1 text-[11px] font-semibold text-slate-500">
              {entryDisplay.contentLabels.fsmFlowLabel}
            </div>
            <EventFlowCell flow={entryDisplay.fsmPromptFlow} />
          </div>
        </div>
      </section>
      {#if entryDisplay.isCommandOutput}
        <section class="mt-3 rounded-xl border border-slate-200 bg-white p-3">
          <div class="mb-2 text-xs font-semibold text-slate-600">
            {entryDisplay.contentLabels.outputSectionTitle}
          </div>
          <div class="grid gap-2 md:grid-cols-2">
            <DetailFieldCard
              label={entryDisplay.contentLabels.errorLabel}
              detailValue={entryDisplay.error}
              mono
            />
          </div>
          <pre
            class="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-all rounded-md bg-slate-900 p-2 text-xs text-slate-100">{entryDisplay.outputText}</pre>
        </section>
      {:else if entryDisplay.hasRawSection}
        <section class="mt-3 rounded-xl border border-slate-200 bg-white p-3">
          <div class="mb-2 text-xs font-semibold text-slate-600">
            {entryDisplay.contentLabels.rawSectionTitle}
          </div>
          <pre
            class="max-h-56 overflow-auto whitespace-pre-wrap break-all rounded-md bg-slate-900 p-2 text-xs text-slate-100">{entryDisplay.rawText}</pre>
        </section>
      {/if}
    {/if}
  </div>
</DashboardDrawerShell>
