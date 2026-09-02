<script lang="ts">
  import { Input } from "$lib/components/ui/input";
  import { Textarea } from "$lib/components/ui/textarea";
  import GitBranchIcon from "@lucide/svelte/icons/git-branch";
  import ConnectionPickerField from "$components/connections/ConnectionPickerField.svelte";
  import ExecutionResultMeta from "$components/fragments/ExecutionResultMeta.svelte";
  import ExecutionResultsPanel from "$components/fragments/ExecutionResultsPanel.svelte";
  import LoadingButton from "$components/fragments/LoadingButton.svelte";
  import OutputBlock from "$components/fragments/OutputBlock.svelte";
  import ParsedOutputBlock from "$components/fragments/ParsedOutputBlock.svelte";
  import SessionRetryFields from "$components/fragments/SessionRetryFields.svelte";
  import StatusCard from "$components/fragments/StatusCard.svelte";
  import ValueTextSelectField from "$components/fragments/ValueTextSelectField.svelte";
  import { currentLanguageState, t } from "$lib/i18n.js";
  import { batchFlowTargetPickerFields } from "$domains/connections/index.js";
  import { parsedOutputBlockDisplayFromItem } from "$domains/execution/index.js";
  import {
    batchFlowFormState,
    batchFlowResultState,
    batchFlowTemplateOptionsState,
    executeBatchFlow,
    loadBatchFlowTemplateOptions,
    setBatchFlowField,
    setBatchFlowRetry,
  } from "../../../application/standardBatchExecutionState.js";
  import { sessionRetryValidation } from "$domains/execution/index.js";

  let { active }: { active: boolean } = $props();
  let activeResultKey = $state("");
  let initialized = false;
  let i18nCurrentLanguage = $derived($currentLanguageState);
  let i18nLabels = $derived.by(() => {
    i18nCurrentLanguage;
    return {
      title: t("batchFlowTitle"),
      template: t("batchFlowTemplateLabel"),
      templatePlaceholder: t("batchFlowTemplatePlaceholder"),
      vars: t("batchFlowVarsLabel"),
      varsPlaceholder: t("batchFlowVarsPlaceholder"),
      footerHint: t("batchFlowFooterHint"),
      maxParallel: t("batchExecMaxParallelLabel"),
      runBtn: t("batchFlowRunBtn"),
      resultSuccess: t("flowResultSuccess"),
      resultFailed: t("flowResultFailed"),
      resultsTitle: t("flowResultsTitle"),
      resultsHint: t("flowResultsHint"),
      total: t("showResultCount"),
      devicesAria: t("batchShowResultDevicesAria"),
      host: t("fieldHost"),
      profile: t("showResultProfile"),
      pickerFields: batchFlowTargetPickerFields.map((field) => ({
        ...field,
        labelText: t(field.labelKey),
        pickerPlaceholder: t(field.placeholderKey),
      })),
    };
  });
  let form = $derived($batchFlowFormState);
  let result = $derived($batchFlowResultState);
  let templateOptions = $derived($batchFlowTemplateOptionsState);
  let running = $derived(result.kind === "running");
  let retryValid = $derived(sessionRetryValidation(form.retry).valid);
  let resultRows = $derived(
    result.kind === "result" && Array.isArray(result.resultPayload?.results)
      ? result.resultPayload.results
      : [],
  );
  let resultItems = $derived(
    resultRows.map((row, index) => {
      const failed = Boolean(row.error) || row.success === false;
      return {
        key: `${row.target || "result"}:${index}`,
        row,
        title: row.target || "-",
        subtitle: [row.host, row.profile].filter(Boolean).join(" · "),
        statusLabel: failed
          ? i18nLabels.resultFailed
          : i18nLabels.resultSuccess,
        statusTone: failed ? ("error" as const) : ("success" as const),
      };
    }),
  );
  let activeResultItem = $derived(
    resultItems.find((item) => item.key === activeResultKey) ||
      resultItems[0] ||
      null,
  );
  let activeResult = $derived(activeResultItem?.row || null);
  let failedCount = $derived(
    resultRows.filter((row) => row.error || row.success === false).length,
  );
  let succeededCount = $derived(resultRows.length - failedCount);
  let statusMessage = $derived(
    result.kind === "error"
      ? result.message
      : result.kind === "running"
        ? t("running")
        : "",
  );
  let statusTone: "error" | "running" = $derived(
    result.kind === "error" ? "error" : "running",
  );
  let activeMetaFields = $derived(
    activeResult
      ? [
          { label: i18nLabels.host, value: activeResult.host },
          { label: i18nLabels.profile, value: activeResult.profile },
          { label: i18nLabels.template, value: form.template, mono: true },
        ]
      : [],
  );

  $effect(() => {
    if (!active || initialized) return;
    initialized = true;
    void loadBatchFlowTemplateOptions();
  });

  $effect(() => {
    if (!resultItems.length) {
      activeResultKey = "";
      return;
    }
    if (!resultItems.some((item) => item.key === activeResultKey)) {
      activeResultKey = resultItems[0].key;
    }
  });
</script>

<div hidden={!active} class="grid gap-5 p-4 sm:p-5">
  <div class="grid gap-4 md:grid-cols-2">
    <label class="grid gap-1 text-sm font-medium text-foreground">
      {i18nLabels.template}
      <ValueTextSelectField
        value={form.template}
        optionRows={templateOptions}
        placeholderText={i18nLabels.templatePlaceholder}
        aria-label={i18nLabels.template}
        onValueChange={(value) => setBatchFlowField("template", value)}
      />
    </label>
    <label class="grid gap-1 text-sm font-medium text-foreground">
      {i18nLabels.vars}
      <Textarea
        rows={3}
        class="font-mono text-xs"
        placeholder={i18nLabels.varsPlaceholder}
        value={form.varsJson}
        oninput={(event) =>
          setBatchFlowField("varsJson", event.currentTarget.value)}
      />
    </label>
  </div>

  <div class="rounded-2xl border border-border bg-muted/30 p-4">
    <div
      class="grid gap-4 md:grid-cols-2"
      role="group"
      aria-label={i18nLabels.title}
    >
      {#each i18nLabels.pickerFields as targetField (targetField.key)}
        <ConnectionPickerField
          keyName={targetField.keyName}
          labelText={targetField.labelText}
          pickerPlaceholder={targetField.pickerPlaceholder}
        />
      {/each}
    </div>
  </div>

  <SessionRetryFields
    idPrefix="batch-flow-session-retry"
    value={form.retry}
    onChange={setBatchFlowRetry}
  />

  <div
    class="flex items-center justify-between gap-3 rounded-2xl border border-border bg-muted/30 px-4 py-3"
  >
    <p class="text-xs text-muted-foreground">
      {i18nLabels.footerHint}
    </p>
    <div class="flex items-center gap-3">
      <label
        class="flex items-center gap-2 text-xs whitespace-nowrap text-muted-foreground"
        for="batch-flow-max-parallel"
      >
        {i18nLabels.maxParallel}
        <Input
          id="batch-flow-max-parallel"
          type="number"
          min="1"
          step="1"
          placeholder="4"
          class="h-8 w-20"
          value={form.maxParallel}
          oninput={(event) =>
            setBatchFlowField("maxParallel", event.currentTarget.value)}
        />
      </label>
      <LoadingButton
        size="lg"
        loading={running}
        disabled={!retryValid}
        onclick={executeBatchFlow}
      >
        <span>{i18nLabels.runBtn}</span>
      </LoadingButton>
    </div>
  </div>
  {#if result.kind !== "empty"}
    <ExecutionResultsPanel
      title={i18nLabels.resultsTitle}
      description={i18nLabels.resultsHint}
      icon={GitBranchIcon}
      items={resultItems}
      activeKey={activeResultItem?.key || ""}
      navigationAriaLabel={i18nLabels.devicesAria}
      onSelect={(key) => (activeResultKey = key)}
      {statusMessage}
      {statusTone}
      totalCount={result.kind === "result" ? resultRows.length : null}
      succeededCount={result.kind === "result" ? succeededCount : null}
      failedCount={result.kind === "result" ? failedCount : null}
      totalLabel={i18nLabels.total}
      succeededLabel={i18nLabels.resultSuccess}
      failedLabel={i18nLabels.resultFailed}
    >
      {#snippet detail()}
        {#if activeResult}
          <ExecutionResultMeta fields={activeMetaFields} />
          {#if activeResult.error}
            <StatusCard
              message={activeResult.error}
              tone="error"
              variant="alert"
            />
          {:else}
            {#each activeResult.outputs ?? [] as output, stepIndex (stepIndex)}
              <OutputBlock
                title={`${stepIndex + 1}. ${output.command}`}
                tone={output.success === false ? "error" : "default"}
                errorLabel={i18nLabels.resultFailed}
              >
                {output.output ?? ""}
              </OutputBlock>
              {#if output.parsed_output || output.parse_error}
                <ParsedOutputBlock
                  parsedOutputBlock={parsedOutputBlockDisplayFromItem(output)}
                  onExportExcel={() => {}}
                />
              {/if}
            {/each}
          {/if}
        {/if}
      {/snippet}
    </ExecutionResultsPanel>
  {/if}
</div>
