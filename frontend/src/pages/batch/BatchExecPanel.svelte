<script>
  import { Input } from "$lib/components/ui/input";
  import TerminalIcon from "@lucide/svelte/icons/terminal";
  import ConnectionPickerField from "../../components/connections/ConnectionPickerField.svelte";
  import ExecutionResultMeta from "../../components/fragments/ExecutionResultMeta.svelte";
  import ExecutionResultsPanel from "../../components/fragments/ExecutionResultsPanel.svelte";
  import LoadingButton from "../../components/fragments/LoadingButton.svelte";
  import ModeExpressionField from "../../components/fragments/ModeExpressionField.svelte";
  import OutputBlock from "../../components/fragments/OutputBlock.svelte";
  import ParsedOutputBlock from "../../components/fragments/ParsedOutputBlock.svelte";
  import SessionRetryFields from "../../components/fragments/SessionRetryFields.svelte";
  import StatusCard from "../../components/fragments/StatusCard.svelte";
  import { currentLanguageState, t } from "../../lib/i18n.js";
  import { batchExecTargetPickerFields } from "../../modules/connections/connections.js";
  import {
    MODE_SELECT,
    modeSelection,
  } from "../../modules/profiles/profiles.js";
  import {
    executionResultFailed,
    parsedOutputBlockDisplayFromItem,
  } from "../../modules/operations/results.js";
  import {
    batchExecFormState,
    batchExecResultState,
    executeBatchExecCommand,
    setBatchExecField,
    setBatchExecRetry,
  } from "$domains/standard/index.js";
  import { sessionRetryValidation } from "../../modules/operations/sessionRetry.js";

  let { active } = $props();
  let activeResultKey = $state("");
  const batchExecModeStateStore = modeSelection(MODE_SELECT.batchExec).state;
  let i18nCurrentLanguage = $derived($currentLanguageState);
  let i18nLabels = $derived.by(() => {
    i18nCurrentLanguage;
    return {
      title: t("batchExecTitle"),
      command: t("fieldCommand"),
      commandPlaceholder: t("batchExecCommandPlaceholder"),
      mode: t("historyColMode"),
      modePlaceholder: t("modePlaceholder"),
      footerHint: t("batchExecFooterHint"),
      maxParallel: t("batchExecMaxParallelLabel"),
      runBtn: t("batchExecRunBtn"),
      exitCode: t("txBlockResultExitCode"),
      resultsTitle: t("flowResultsTitle"),
      resultsHint: t("flowResultsHint"),
      total: t("showResultCount"),
      succeeded: t("orchestrationStatusSuccess", "Success"),
      failed: t("orchestrationStatusFailed", "Failed"),
      devicesAria: t("batchShowResultDevicesAria"),
      host: t("fieldHost"),
      profile: t("showResultProfile"),
      pickerFields: batchExecTargetPickerFields.map((field) => ({
        ...field,
        labelText: t(field.labelKey),
        pickerPlaceholder: t(field.placeholderKey),
      })),
    };
  });
  let form = $derived($batchExecFormState);
  let modeState = $derived($batchExecModeStateStore);
  let result = $derived($batchExecResultState);
  let running = $derived(result.kind === "running");
  let retryValid = $derived(sessionRetryValidation(form.retry).valid);
  let resultRows = $derived(
    result.kind === "result" && Array.isArray(result.resultPayload?.results)
      ? result.resultPayload.results
      : [],
  );
  let resultItems = $derived(
    resultRows.map((row, index) => {
      const failed = executionResultFailed(row);
      return {
        key: `${row.target || "result"}:${index}`,
        row,
        title: row.target || "-",
        subtitle: [row.host, row.profile].filter(Boolean).join(" · "),
        statusLabel: failed ? i18nLabels.failed : i18nLabels.succeeded,
        statusTone: failed ? "error" : "success",
      };
    }),
  );
  let activeResultItem = $derived(
    resultItems.find((item) => item.key === activeResultKey) ||
      resultItems[0] ||
      null,
  );
  let activeResult = $derived(activeResultItem?.row || null);
  let failedCount = $derived(resultRows.filter(executionResultFailed).length);
  let succeededCount = $derived(resultRows.length - failedCount);
  let statusMessage = $derived(
    result.kind === "error"
      ? result.message
      : result.kind === "running"
        ? t("running")
        : "",
  );
  let statusTone = $derived(result.kind === "error" ? "error" : "running");
  let activeMetaFields = $derived(
    activeResult
      ? [
          { label: i18nLabels.host, value: activeResult.host },
          { label: i18nLabels.profile, value: activeResult.profile },
          { label: i18nLabels.mode, value: activeResult.mode },
          {
            label: i18nLabels.exitCode,
            value: activeResult.exit_code ?? "-",
          },
        ]
      : [],
  );

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
  <div class="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
    <label class="grid min-w-0 gap-1 text-sm font-medium text-foreground">
      {i18nLabels.command}
      <Input
        placeholder={i18nLabels.commandPlaceholder}
        value={form.command}
        oninput={(event) =>
          setBatchExecField("command", event.currentTarget.value)}
      />
    </label>
    <label class="grid min-w-0 gap-1 text-sm font-medium text-foreground">
      {i18nLabels.mode}
      <ModeExpressionField
        placeholderText={i18nLabels.modePlaceholder}
        optionValues={modeState.modes}
        aria-label={i18nLabels.mode}
        value={form.mode}
        onValueChange={(mode) => setBatchExecField("mode", mode)}
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
    idPrefix="batch-exec-session-retry"
    value={form.retry}
    onChange={setBatchExecRetry}
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
        for="batch-exec-max-parallel"
      >
        {i18nLabels.maxParallel}
        <Input
          id="batch-exec-max-parallel"
          type="number"
          min="1"
          step="1"
          placeholder="4"
          class="h-8 w-20"
          value={form.maxParallel}
          oninput={(event) =>
            setBatchExecField("maxParallel", event.currentTarget.value)}
        />
      </label>
      <LoadingButton
        size="lg"
        loading={running}
        disabled={!retryValid}
        onclick={executeBatchExecCommand}
      >
        <span>{i18nLabels.runBtn}</span>
      </LoadingButton>
    </div>
  </div>
  {#if result.kind !== "empty"}
    <ExecutionResultsPanel
      title={i18nLabels.resultsTitle}
      description={i18nLabels.resultsHint}
      icon={TerminalIcon}
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
      succeededLabel={i18nLabels.succeeded}
      failedLabel={i18nLabels.failed}
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
            <OutputBlock
              title={activeResult.target}
              tone={activeResultItem?.statusTone}
              errorLabel={i18nLabels.failed}
            >
              {activeResult.output ?? ""}
            </OutputBlock>
            {#if activeResult.parsed_output || activeResult.parse_error}
              <ParsedOutputBlock
                parsedOutputBlock={parsedOutputBlockDisplayFromItem(
                  activeResult,
                )}
              />
            {/if}
          {/if}
        {/if}
      {/snippet}
    </ExecutionResultsPanel>
  {/if}
</div>
