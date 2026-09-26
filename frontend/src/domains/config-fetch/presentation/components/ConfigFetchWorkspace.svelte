<script lang="ts">
  import * as Alert from "$lib/components/ui/alert";
  import * as Card from "$lib/components/ui/card";
  import { Badge } from "$lib/components/ui/badge";
  import { Input } from "$lib/components/ui/input";
  import { Switch } from "$lib/components/ui/switch";
  import * as ToggleGroup from "$lib/components/ui/toggle-group";
  import FileDownIcon from "@lucide/svelte/icons/file-down";
  import CircleAlertIcon from "@lucide/svelte/icons/circle-alert";
  import { ConnectionPickerField } from "$domains/connections/presentation/components/fields/index.js";
  import ExecutionDock from "$components/fragments/ExecutionDock.svelte";
  import ExecutionRunBar from "$components/fragments/ExecutionRunBar.svelte";
  import StatusCard from "$components/fragments/StatusCard.svelte";
  import SessionRetryFields from "$components/fragments/SessionRetryFields.svelte";
  import ValueLabelSelectField from "$components/fragments/ValueLabelSelectField.svelte";
  import WorkspaceActionHeader from "$components/fragments/WorkspaceActionHeader.svelte";
  import DashboardTabPanel from "$components/layout/DashboardTabPanel.svelte";
  import { currentLanguageState, t } from "$lib/i18n.js";
  import {
    CONFIG_FETCH_TARGET_MODE,
    type ConfigFetchTargetMode,
    configFetchConnectionTargetState as connectionTargetState,
    configFetchFormState,
    configFetchKindAvailable,
    configFetchKindCatalogState,
    configFetchResultState,
    configFetchTargetPickerFields,
    executeConfigFetch,
    normalizeConfigFetchTargetMode,
    refreshConfigFetchKindOptions,
    setConfigFetchField,
    setConfigFetchRetry,
    validateConfigFetchRetry,
  } from "../../index.js";

  let { active }: { active: boolean } = $props();
  let currentLanguage = $derived($currentLanguageState);
  let form = $derived($configFetchFormState);
  let kindCatalog = $derived($configFetchKindCatalogState);
  let connectionTarget = $derived($connectionTargetState);
  let result = $derived($configFetchResultState);
  let targetModeValue = $state<ConfigFetchTargetMode>(
    CONFIG_FETCH_TARGET_MODE.current,
  );
  let running = $derived(result.kind === "running");
  let kindAvailable = $derived(
    configFetchKindAvailable(kindCatalog, form.kind),
  );
  let retryValid = $derived(validateConfigFetchRetry(form.retry));
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
      commandMissingTitle: t("configFetchCommandMissingTitle"),
      commandMissingHint: t("configFetchCommandMissingHint"),
      kindLoadFailed: t("configFetchKindLoadFailed"),
      normalized: t("configFetchNormalizedLabel"),
      normalizedHint: t("configFetchNormalizedHint"),
      maxParallel: t("batchExecMaxParallelLabel"),
      footerHint: t("configFetchFooterHint"),
      runButton: t("configFetchRunBtn"),
      pickerFields: configFetchTargetPickerFields.map((field) => ({
        ...field,
        labelText: t(field.labelKey),
        pickerPlaceholder: t(field.placeholderKey),
      })),
    };
  });
  let configCommandMissing = $derived(
    kindCatalog.kind === "ready" && kindCatalog.options.length === 0,
  );
  let configCommandMissingHint = $derived(
    pageLabels.commandMissingHint.replace(
      "{profile}",
      kindCatalog.profile || currentTargetProfile,
    ),
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

  function selectTargetMode(targetMode: string) {
    const nextTargetMode = normalizeConfigFetchTargetMode(targetMode, "");
    if (!nextTargetMode) {
      targetModeValue = normalizeConfigFetchTargetMode(form.targetMode);
      return;
    }
    targetModeValue = nextTargetMode as ConfigFetchTargetMode;
    setConfigFetchField("targetMode", nextTargetMode);
  }
</script>

<DashboardTabPanel {active}>
  <ExecutionDock {active} feature="config-fetch">
    <Card.Root class="gap-0 overflow-hidden border-border/80 py-0 shadow-sm">
      <WorkspaceActionHeader
        title={pageLabels.title}
        description={pageLabels.hint}
        icon={FileDownIcon}
      />

      <Card.Content class="flex flex-col gap-4 p-4 sm:p-5">
        <div
          class="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(20rem,3fr)]"
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
                class="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2.5"
              >
                <div class="grid min-w-0 flex-1 gap-1">
                  <span class="text-xs font-medium text-muted-foreground">
                    {pageLabels.currentTargetLabel}
                  </span>
                  <div
                    class="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1"
                  >
                    <span
                      class="truncate text-sm font-semibold text-foreground"
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
              {:else if configCommandMissing}
                <Alert.Root id="config-fetch-command-missing">
                  <CircleAlertIcon aria-hidden="true" />
                  <Alert.Title>{pageLabels.commandMissingTitle}</Alert.Title>
                  <Alert.Description>
                    {configCommandMissingHint}
                  </Alert.Description>
                </Alert.Root>
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
      </Card.Content>
    </Card.Root>

    {#if result.kind === "error"}<StatusCard
        message={result.message}
        tone="error"
      />{/if}
    <ExecutionRunBar
      docked={true}
      {active}
      showAutoDownloadOutput={false}
      title={pageLabels.title}
      hint={pageLabels.footerHint}
      buttonLabel={pageLabels.runButton}
      loading={running}
      disabled={!kindAvailable || !retryValid}
      onRun={executeConfigFetch}
    />
  </ExecutionDock>
</DashboardTabPanel>
