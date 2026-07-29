<script>
  import * as Card from "$lib/components/ui/card";
  import { Badge } from "$lib/components/ui/badge";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Separator } from "$lib/components/ui/separator";
  import { Switch } from "$lib/components/ui/switch";
  import * as ToggleGroup from "$lib/components/ui/toggle-group";
  import DownloadIcon from "@lucide/svelte/icons/download";
  import FileDownIcon from "@lucide/svelte/icons/file-down";
  import ConnectionPickerField from "../components/connections/ConnectionPickerField.svelte";
  import ExecutionResultMeta from "../components/fragments/ExecutionResultMeta.svelte";
  import ExecutionResultsPanel from "../components/fragments/ExecutionResultsPanel.svelte";
  import LoadingButton from "../components/fragments/LoadingButton.svelte";
  import OutputBlock from "../components/fragments/OutputBlock.svelte";
  import SessionRetryFields from "../components/fragments/SessionRetryFields.svelte";
  import StatusCard from "../components/fragments/StatusCard.svelte";
  import TabList from "../components/fragments/TabList.svelte";
  import ValueLabelSelectField from "../components/fragments/ValueLabelSelectField.svelte";
  import WorkspaceActionHeader from "../components/fragments/WorkspaceActionHeader.svelte";
  import DashboardTabPanel from "../components/layout/DashboardTabPanel.svelte";
  import { currentLanguageState, t } from "../lib/i18n.js";
  import {
    configFetchTargetPickerFields,
    connectionTargetState,
  } from "../modules/connections/connections.js";
  import {
    CONFIG_FETCH_CONTENT_VIEW,
    CONFIG_FETCH_TARGET_MODE,
    configFetchContent,
    configFetchFormState,
    configFetchKindAvailable,
    configFetchKindCatalogState,
    configFetchResultCounts,
    configFetchResultRows,
    configFetchResultState,
    configFetchTimestamp,
    downloadConfigFetchResult,
    executeConfigFetch,
    normalizeConfigFetchTargetMode,
    refreshConfigFetchKindOptions,
    setConfigFetchField,
    setConfigFetchRetry,
  } from "../modules/operations/configFetch.js";
  import { sessionRetryValidation } from "../modules/operations/sessionRetry.js";

  let { active } = $props();
  let currentLanguage = $derived($currentLanguageState);
  let form = $derived($configFetchFormState);
  let kindCatalog = $derived($configFetchKindCatalogState);
  let connectionTarget = $derived($connectionTargetState);
  let result = $derived($configFetchResultState);
  let activeTarget = $state("");
  let contentView = $state(CONFIG_FETCH_CONTENT_VIEW.raw);
  let targetModeValue = $state(CONFIG_FETCH_TARGET_MODE.current);
  let resultRows = $derived(
    result.kind === "result" ? configFetchResultRows(result.resultPayload) : [],
  );
  let resultCounts = $derived(
    result.kind === "result"
      ? configFetchResultCounts(result.resultPayload)
      : { failed: 0, succeeded: 0, total: 0 },
  );
  let activeResult = $derived(
    resultRows.find((row) => row.target === activeTarget) ||
      resultRows[0] ||
      null,
  );
  let running = $derived(result.kind === "running");
  let kindAvailable = $derived(
    configFetchKindAvailable(kindCatalog, form.kind),
  );
  let retryValid = $derived(sessionRetryValidation(form.retry).valid);
  let currentTargetDetails = $derived(connectionTarget?.details || null);
  let currentTargetName = $derived(
    currentTargetDetails?.name ||
      currentTargetDetails?.label ||
      currentTargetDetails?.host ||
      "",
  );
  let currentTargetProfile = $derived(
    currentTargetDetails?.profile ||
      currentTargetDetails?.device_profile ||
      "autodetect",
  );
  let pageLabels = $derived.by(() => {
    currentLanguage;
    return {
      title: t("configFetchTitle"),
      hint: t("configFetchHint"),
      targetMode: t("configFetchTargetModeLabel"),
      options: t("configFetchOptionsLabel"),
      currentTarget: t("configFetchTargetCurrent"),
      batchTargets: t("configFetchTargetBatch"),
      currentTargetLabel: t("configFetchCurrentTargetLabel"),
      currentTargetEmpty: t("configFetchCurrentTargetEmpty"),
      kind: t("configFetchKindLabel"),
      kindPlaceholder: t("configFetchKindPlaceholder"),
      kindLoading: t("configFetchKindLoading"),
      kindEmpty: t("configFetchKindEmpty"),
      kindLoadFailed: t("configFetchKindLoadFailed"),
      normalized: t("configFetchNormalizedLabel"),
      normalizedHint: t("configFetchNormalizedHint"),
      maxParallel: t("batchExecMaxParallelLabel"),
      footerHint: t("configFetchFooterHint"),
      runButton: t("configFetchRunBtn"),
      resultsTitle: t("configFetchResultsTitle"),
      resultsHint: t("configFetchResultsHint"),
      total: t("configFetchTotalLabel"),
      succeeded: t("configFetchSucceededLabel"),
      failed: t("configFetchFailedLabel"),
      devicesAria: t("configFetchDevicesAria"),
      host: t("fieldHost"),
      profile: t("showResultProfile"),
      command: t("showResultCommand"),
      fetchedAt: t("configFetchFetchedAtLabel"),
      rawHash: t("configFetchRawHashLabel"),
      normalizedHash: t("configFetchNormalizedHashLabel"),
      rawTab: t("configFetchRawTab"),
      normalizedTab: t("configFetchNormalizedTab"),
      download: t("configFetchDownloadBtn"),
      resultEmpty: t("configFetchResultEmpty"),
      pickerFields: configFetchTargetPickerFields.map((field) => ({
        ...field,
        labelText: t(field.labelKey),
        pickerPlaceholder: t(field.placeholderKey),
      })),
    };
  });
  let resultItems = $derived(
    resultRows.map((row, index) => ({
      key: row.target || String(index),
      title: row.target || "-",
      subtitle: [row.host, row.profile].filter(Boolean).join(" · "),
      statusLabel: row.error ? pageLabels.failed : pageLabels.succeeded,
      statusTone: row.error ? "error" : "success",
    })),
  );
  let contentTabs = $derived(
    activeResult && typeof activeResult.normalized_content === "string"
      ? [
          {
            value: CONFIG_FETCH_CONTENT_VIEW.raw,
            label: pageLabels.rawTab,
          },
          {
            value: CONFIG_FETCH_CONTENT_VIEW.normalized,
            label: pageLabels.normalizedTab,
          },
        ]
      : [
          {
            value: CONFIG_FETCH_CONTENT_VIEW.raw,
            label: pageLabels.rawTab,
          },
        ],
  );
  let statusMessage = $derived.by(() => {
    currentLanguage;
    if (result.kind === "error") return result.message;
    if (result.kind === "running") return t("configFetchRunning");
    return "";
  });
  let statusTone = $derived(
    result.kind === "error"
      ? "error"
      : result.kind === "running"
        ? "running"
        : resultCounts.failed === 0
          ? "success"
          : resultCounts.succeeded > 0
            ? "warning"
            : "error",
  );
  let activeMetaFields = $derived(
    activeResult
      ? [
          { label: pageLabels.host, value: activeResult.host },
          { label: pageLabels.profile, value: activeResult.profile },
          { label: pageLabels.kind, value: activeResult.kind },
          {
            label: pageLabels.fetchedAt,
            value: configFetchTimestamp(activeResult.fetched_at),
          },
          {
            label: pageLabels.command,
            value: activeResult.command,
            mono: true,
          },
          { label: pageLabels.rawHash, value: activeResult.sha256, mono: true },
          {
            label: pageLabels.normalizedHash,
            value: activeResult.normalized_sha256,
            mono: true,
          },
        ]
      : [],
  );
  let lastKindCatalogTarget = "";

  $effect(() => {
    targetModeValue = normalizeConfigFetchTargetMode(form.targetMode);
  });

  $effect(() => {
    if (!active) return;
    const targetMode = normalizeConfigFetchTargetMode(form.targetMode);
    const details = connectionTarget?.details || {};
    const targetSignature = [
      connectionTarget?.kind || "none",
      details.name || "",
      details.host || "",
      details.profile || details.device_profile || "",
    ].join("|");
    const catalogTarget =
      targetMode === CONFIG_FETCH_TARGET_MODE.current
        ? `${targetMode}|${targetSignature}`
        : targetMode;
    if (catalogTarget === lastKindCatalogTarget) return;
    lastKindCatalogTarget = catalogTarget;
    void refreshConfigFetchKindOptions(targetMode);
  });

  $effect(() => {
    if (!resultRows.length) {
      activeTarget = "";
      contentView = CONFIG_FETCH_CONTENT_VIEW.raw;
      return;
    }
    if (!resultRows.some((row) => row.target === activeTarget)) {
      activeTarget = resultRows[0].target;
      contentView = CONFIG_FETCH_CONTENT_VIEW.raw;
    }
  });

  $effect(() => {
    if (
      contentView === CONFIG_FETCH_CONTENT_VIEW.normalized &&
      typeof activeResult?.normalized_content !== "string"
    ) {
      contentView = CONFIG_FETCH_CONTENT_VIEW.raw;
    }
  });

  function selectTarget(target) {
    activeTarget = target;
    contentView = CONFIG_FETCH_CONTENT_VIEW.raw;
  }

  function selectTargetMode(targetMode) {
    const nextTargetMode = normalizeConfigFetchTargetMode(targetMode, "");
    if (!nextTargetMode) {
      targetModeValue = normalizeConfigFetchTargetMode(form.targetMode);
      return;
    }
    targetModeValue = nextTargetMode;
    setConfigFetchField("targetMode", nextTargetMode);
  }
</script>

<DashboardTabPanel {active}>
  <div class="grid min-w-0 gap-4">
    <Card.Root class="gap-0 overflow-hidden border-border/80 py-0 shadow-sm">
      <WorkspaceActionHeader
        title={pageLabels.title}
        description={pageLabels.hint}
        icon={FileDownIcon}
      />

      <Card.Content class="flex flex-col gap-4 p-4 sm:p-5">
        <div
          class="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(20rem,3fr)]"
        >
          <section
            class="flex min-w-0 flex-col gap-4 rounded-lg border border-border bg-muted/20 p-4"
            aria-labelledby="config-fetch-target-heading"
          >
            <div class="flex flex-wrap items-center justify-between gap-3">
              <h3
                id="config-fetch-target-heading"
                class="text-sm font-semibold text-foreground"
              >
                {pageLabels.targetMode}
              </h3>
              <ToggleGroup.Root
                type="single"
                variant="outline"
                size="sm"
                bind:value={targetModeValue}
                class="grid w-full grid-cols-2 sm:w-auto"
                onValueChange={selectTargetMode}
                aria-label={pageLabels.targetMode}
              >
                <ToggleGroup.Item value={CONFIG_FETCH_TARGET_MODE.current}>
                  {pageLabels.currentTarget}
                </ToggleGroup.Item>
                <ToggleGroup.Item value={CONFIG_FETCH_TARGET_MODE.batch}>
                  {pageLabels.batchTargets}
                </ToggleGroup.Item>
              </ToggleGroup.Root>
            </div>

            {#if form.targetMode === CONFIG_FETCH_TARGET_MODE.batch}
              <div
                class="grid min-w-0 gap-4 md:grid-cols-2"
                role="group"
                aria-label={pageLabels.batchTargets}
              >
                {#each pageLabels.pickerFields as targetField (targetField.key)}
                  <div class="min-w-0 md:last:col-span-2">
                    <ConnectionPickerField
                      keyName={targetField.keyName}
                      labelText={targetField.labelText}
                      pickerPlaceholder={targetField.pickerPlaceholder}
                    />
                  </div>
                {/each}
              </div>
            {:else}
              <div
                class="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-background px-4 py-3"
              >
                <div class="grid min-w-0 gap-1">
                  <span class="text-xs font-medium text-muted-foreground">
                    {pageLabels.currentTargetLabel}
                  </span>
                  <span
                    class="truncate text-base font-semibold text-foreground"
                  >
                    {currentTargetName || pageLabels.currentTargetEmpty}
                  </span>
                  {#if currentTargetDetails?.host && currentTargetDetails.host !== currentTargetName}
                    <span
                      class="truncate font-mono text-xs text-muted-foreground"
                    >
                      {currentTargetDetails.host}
                    </span>
                  {/if}
                </div>
                {#if currentTargetName}
                  <Badge variant="outline">{currentTargetProfile}</Badge>
                {/if}
              </div>
            {/if}
          </section>

          <section
            class="flex min-w-0 flex-col gap-4 rounded-lg border border-border bg-muted/20 p-4"
            aria-labelledby="config-fetch-options-heading"
          >
            <h3
              id="config-fetch-options-heading"
              class="text-sm font-semibold text-foreground"
            >
              {pageLabels.options}
            </h3>

            <div class="grid content-start gap-1.5">
              <span class="text-sm font-medium text-foreground">
                {pageLabels.kind}
              </span>
              <ValueLabelSelectField
                value={form.kind}
                optionRows={kindCatalog.options}
                title={pageLabels.kindPlaceholder}
                aria-label={pageLabels.kind}
                disabled={kindCatalog.kind === "loading" ||
                  kindCatalog.options.length === 0}
                onValueChange={(kind) => setConfigFetchField("kind", kind)}
              />
              {#if kindCatalog.kind === "loading"}
                <p class="text-xs text-muted-foreground">
                  {pageLabels.kindLoading}
                </p>
              {:else if kindCatalog.kind === "error"}
                <p class="text-xs text-destructive">
                  {pageLabels.kindLoadFailed}: {kindCatalog.message}
                </p>
              {:else if kindCatalog.kind === "ready" && !kindCatalog.options.length}
                <p class="text-xs text-muted-foreground">
                  {pageLabels.kindEmpty}
                </p>
              {/if}
            </div>

            {#if form.targetMode === CONFIG_FETCH_TARGET_MODE.batch}
              <label
                class="grid content-start gap-1.5 text-sm font-medium text-foreground"
              >
                {pageLabels.maxParallel}
                <Input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="4"
                  value={form.maxParallel}
                  oninput={(event) =>
                    setConfigFetchField(
                      "maxParallel",
                      event.currentTarget.value,
                    )}
                />
              </label>
            {/if}

            <div
              class="flex min-h-16 items-center justify-between gap-3 rounded-md border border-border bg-background px-4 py-3"
            >
              <div class="min-w-0">
                <label
                  class="text-sm font-medium text-foreground"
                  for="config-fetch-normalized"
                >
                  {pageLabels.normalized}
                </label>
                <p class="text-xs text-muted-foreground">
                  {pageLabels.normalizedHint}
                </p>
              </div>
              <Switch
                id="config-fetch-normalized"
                checked={form.includeNormalized}
                onCheckedChange={(checked) =>
                  setConfigFetchField("includeNormalized", checked)}
              />
            </div>

            <SessionRetryFields
              idPrefix="config-fetch-session-retry"
              value={form.retry}
              onChange={setConfigFetchRetry}
            />
          </section>
        </div>

        <Separator />

        <div class="flex flex-wrap items-center justify-between gap-3">
          <p class="max-w-3xl text-xs text-muted-foreground">
            {pageLabels.footerHint}
          </p>
          <LoadingButton
            size="lg"
            loading={running}
            disabled={!kindAvailable || !retryValid}
            onclick={executeConfigFetch}
          >
            <FileDownIcon data-icon="inline-start" />
            <span>{pageLabels.runButton}</span>
          </LoadingButton>
        </div>
      </Card.Content>
    </Card.Root>

    {#if result.kind !== "empty"}
      <ExecutionResultsPanel
        title={pageLabels.resultsTitle}
        description={pageLabels.resultsHint}
        icon={FileDownIcon}
        items={resultItems}
        activeKey={activeResult?.target || ""}
        navigationAriaLabel={pageLabels.devicesAria}
        onSelect={selectTarget}
        {statusMessage}
        {statusTone}
        totalCount={result.kind === "result" ? resultCounts.total : null}
        succeededCount={result.kind === "result"
          ? resultCounts.succeeded
          : null}
        failedCount={result.kind === "result" ? resultCounts.failed : null}
        totalLabel={pageLabels.total}
        succeededLabel={pageLabels.succeeded}
        failedLabel={pageLabels.failed}
        emptyMessage={pageLabels.resultEmpty}
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
              <div class="flex flex-wrap items-center justify-between gap-3">
                <h3 class="text-sm font-semibold text-foreground">
                  {activeResult.target}
                </h3>
                <div class="flex flex-wrap items-center gap-2">
                  <TabList
                    tabItems={contentTabs}
                    activeValue={contentView}
                    aria-label={pageLabels.resultsTitle}
                    onSelect={(view) => (contentView = view)}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    class="min-h-10"
                    onclick={() =>
                      downloadConfigFetchResult(activeResult, contentView)}
                  >
                    <DownloadIcon data-icon="inline-start" aria-hidden="true" />
                    {pageLabels.download}
                  </Button>
                </div>
              </div>
              <OutputBlock
                title={`${activeResult.target} · ${contentView === CONFIG_FETCH_CONTENT_VIEW.normalized ? pageLabels.normalizedTab : pageLabels.rawTab}`}
                >{configFetchContent(activeResult, contentView)}</OutputBlock
              >
            {/if}
          {/if}
        {/snippet}
      </ExecutionResultsPanel>
    {/if}
  </div>
</DashboardTabPanel>
