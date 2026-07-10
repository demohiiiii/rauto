<script>
  import StatusCard from "../../components/fragments/StatusCard.svelte";
  import DetailFieldCard from "../../components/fragments/DetailFieldCard.svelte";
  import OrchestrationJsonSection from "./OrchestrationJsonSection.svelte";

  let {
    error,
    hasPayloadSections,
    orchestrationBasicSectionTitle,
    orchestrationErrorSectionTitle,
    orchestrationRawSectionTitle,
    payloadSections,
    targetBasicFieldRows,
    targetJsonValue,
    targetNoPayloadMessage,
    targetPayloadSectionTitle,
  } = $props();
</script>

<div class="grid gap-3">
  <section class="rounded-xl border border-slate-200 bg-slate-50 p-3">
    <div class="mb-2 text-xs font-semibold text-slate-600">
      {orchestrationBasicSectionTitle}
    </div>
    <div class="grid gap-2 md:grid-cols-2">
      {#each targetBasicFieldRows as targetBasicFieldRow}
        <DetailFieldCard
          badgeClass={targetBasicFieldRow.badgeClass}
          label={targetBasicFieldRow.labelText}
          mono={targetBasicFieldRow.mono}
          detailValue={targetBasicFieldRow.detailValue}
        />
      {/each}
    </div>
  </section>
  {#if error}
    <section class="rounded-xl border border-rose-200 bg-rose-50 p-3">
      <div class="mb-2 text-xs font-semibold text-rose-700">
        {orchestrationErrorSectionTitle}
      </div>
      <pre
        class="whitespace-pre-wrap break-all text-xs text-rose-800">{error}</pre>
    </section>
  {/if}
  {#if hasPayloadSections}
    <section class="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div class="mb-2 text-xs font-semibold text-slate-600">
        {targetPayloadSectionTitle}
      </div>
      <div class="grid gap-3">
        {#each payloadSections as payloadSection}
          <OrchestrationJsonSection
            jsonValue={payloadSection.jsonValue}
            title={payloadSection.titleText}
          />
        {/each}
      </div>
    </section>
  {:else}
    <StatusCard message={targetNoPayloadMessage} />
  {/if}
  <OrchestrationJsonSection
    jsonValue={targetJsonValue}
    title={orchestrationRawSectionTitle}
  />
</div>
