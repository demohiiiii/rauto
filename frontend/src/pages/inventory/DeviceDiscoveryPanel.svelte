<script lang="ts">
  import { Badge } from "$lib/components/ui/badge";
  import { Button } from "$lib/components/ui/button";
  import { Checkbox } from "$lib/components/ui/checkbox";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
  import { Input } from "$lib/components/ui/input";
  import * as Table from "$lib/components/ui/table";
  import { Textarea } from "$lib/components/ui/textarea";
  import {
    DatabaseZapIcon,
    ListFilterIcon,
    PlayIcon,
    RefreshCwIcon,
    SearchIcon,
    SquareIcon,
  } from "@lucide/svelte";
  import { onDestroy } from "svelte";
  import MultiSelectField from "../../components/fragments/MultiSelectField.svelte";
  import StatusCard from "../../components/fragments/StatusCard.svelte";
  import { currentLanguageState, t as translateText } from "../../lib/i18n.js";
  import {
    createDeviceDiscoveryWorkspace,
    type DiscoveryResult,
    type DiscoveryResultFilter,
    discoveryResultBadgeVariant as resultBadgeVariant,
    discoveryResultCanImport,
    discoveryResultKey,
    discoveryResultStatus,
  } from "$domains/device-discovery/index.js";

  let { active = false }: { active?: boolean } = $props();

  let currentLanguage = $derived($currentLanguageState);

  function t(key: string): string {
    currentLanguage;
    return translateText(key);
  }

  const workspace = createDeviceDiscoveryWorkspace();
  const { displayStateStore } = workspace;
  let display = $derived($displayStateStore);
  let targetsText = $derived(display.targetsText);
  let portsText = $derived(display.portsText);
  let selectedCredentialIds = $derived(display.selectedCredentialIds);
  let selectedGroups = $derived(display.selectedGroups);
  let selectedLabels = $derived(display.selectedLabels);
  let concurrency = $derived(display.concurrency);
  let tcpTimeoutMs = $derived(display.tcpTimeoutMs);
  let probeTimeoutSecs = $derived(display.probeTimeoutSecs);
  let currentRun = $derived(display.currentRun);
  let selectedResultKeys = $derived(display.selectedResultKeys);
  let connectionNames = $derived(display.connectionNames);
  let resultFilter = $derived(display.resultFilter);
  let statusFilter = $derived(display.statusFilter);
  let resultSearch = $derived(display.resultSearch);
  let loading = $derived(display.loading);
  let importing = $derived(display.importing);
  let errorMessage = $derived(display.errorMessage);
  let statusMessage = $derived(display.statusMessage);
  let runActive = $derived(display.runActive);
  let filteredResults = $derived(display.filteredResults);
  let importableResults = $derived(display.importableResults);
  let selectedImportableResults = $derived(display.selectedImportableResults);
  let identifiedResultCount = $derived(display.identifiedResultCount);
  let progressPercent = $derived(display.progressPercent);
  let credentialOptions = $derived(display.credentialOptions);
  let groupOptions = $derived(display.groupOptions);
  let labelOptions = $derived(display.labelOptions);
  let statusFilterOptions = $derived(display.statusFilterOptions);
  let activeStatusFilterLabel = $derived(display.activeStatusFilterLabel);

  $effect(() => {
    void workspace.setPageContext({ active });
  });

  onDestroy(workspace.destroy);

  function startDiscovery(): Promise<void> {
    return workspace.startDiscovery();
  }

  function cancelDiscovery(): Promise<void> {
    return workspace.cancelDiscovery();
  }

  function loadLatestRun(): Promise<void> {
    return workspace.loadLatestRun();
  }

  function importSelected(): Promise<void> {
    return workspace.importSelected();
  }

  function toggleResult(result: DiscoveryResult, checked: boolean): void {
    workspace.toggleResult(result, checked);
  }

  function toggleAllImportable(checked: boolean): void {
    workspace.toggleAllImportable(checked);
  }

  function updateConnectionName(result: DiscoveryResult, event: Event): void {
    workspace.updateConnectionName(
      result,
      (event.currentTarget as HTMLInputElement).value,
    );
  }

  function selectResultFilter(filter: DiscoveryResultFilter): void {
    workspace.selectResultFilter(filter);
  }

  function selectStatusFilter(filter: string): void {
    workspace.selectStatusFilter(filter);
  }

  function resultStatusLabel(result: DiscoveryResult): string {
    return t(`deviceDiscoveryStatus_${discoveryResultStatus(result)}`);
  }
</script>

<section class="min-w-0" hidden={!active}>
  <div
    class="flex min-w-0 flex-wrap items-start justify-between gap-4 border-b border-border pb-4"
  >
    <div class="min-w-0">
      <h2 class="text-base font-semibold">{t("deviceDiscoveryTitle")}</h2>
      <p class="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
        {t("deviceDiscoveryDescription")}
      </p>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      {#if runActive}
        <Button
          variant="destructive"
          disabled={loading || currentRun?.status === "cancelling"}
          onclick={cancelDiscovery}
        >
          <SquareIcon data-icon="inline-start" aria-hidden="true" />
          {t("deviceDiscoveryCancel")}
        </Button>
      {:else}
        <Button disabled={loading} onclick={startDiscovery}>
          <PlayIcon data-icon="inline-start" aria-hidden="true" />
          {t("deviceDiscoveryStart")}
        </Button>
      {/if}
    </div>
  </div>

  <div class="grid gap-5 py-5">
    <div
      class="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,1fr)]"
    >
      <label class="grid min-w-0 gap-1.5">
        <span class="text-sm font-medium">{t("deviceDiscoveryTargets")}</span>
        <Textarea
          class="min-h-32 resize-y font-mono"
          value={targetsText}
          oninput={(event) =>
            workspace.setFormField("targetsText", event.currentTarget.value)}
          placeholder={t("deviceDiscoveryTargetsPlaceholder")}
          disabled={runActive}
        />
      </label>

      <div class="grid min-w-0 content-start gap-4 sm:grid-cols-2">
        <label class="grid gap-1.5">
          <span class="text-sm font-medium">{t("deviceDiscoveryPorts")}</span>
          <Input
            class="font-mono"
            value={portsText}
            oninput={(event) =>
              workspace.setFormField("portsText", event.currentTarget.value)}
            disabled={runActive}
            placeholder="22, 2222"
          />
        </label>
        <MultiSelectField
          value={selectedCredentialIds}
          optionRows={credentialOptions}
          maxSelected={3}
          disabled={runActive}
          labelText={t("deviceDiscoveryCredentials")}
          placeholderText={t("deviceDiscoveryCredentialsPlaceholder")}
          onValueChange={(value) =>
            workspace.setFormField("selectedCredentialIds", value)}
        />
        <MultiSelectField
          value={selectedGroups}
          optionRows={groupOptions}
          disabled={runActive}
          labelText={t("deviceDiscoveryDefaultGroups")}
          placeholderText={t("deviceDiscoveryOptional")}
          onValueChange={(value) =>
            workspace.setFormField("selectedGroups", value)}
        />
        <MultiSelectField
          value={selectedLabels}
          optionRows={labelOptions}
          disabled={runActive}
          labelText={t("deviceDiscoveryDefaultLabels")}
          placeholderText={t("deviceDiscoveryOptional")}
          onValueChange={(value) =>
            workspace.setFormField("selectedLabels", value)}
        />
      </div>
    </div>

    <div
      class="grid gap-4 border-y border-border bg-muted/15 py-4 sm:grid-cols-3"
    >
      <label class="grid gap-1.5">
        <span class="text-xs font-medium text-muted-foreground">
          {t("deviceDiscoveryConcurrency")}
        </span>
        <Input
          type="number"
          min="1"
          max="256"
          value={concurrency}
          oninput={(event) =>
            workspace.setFormField(
              "concurrency",
              Number(event.currentTarget.value),
            )}
          disabled={runActive}
        />
      </label>
      <label class="grid gap-1.5">
        <span class="text-xs font-medium text-muted-foreground">
          {t("deviceDiscoveryTcpTimeout")}
        </span>
        <Input
          type="number"
          min="1"
          max="30000"
          value={tcpTimeoutMs}
          oninput={(event) =>
            workspace.setFormField(
              "tcpTimeoutMs",
              Number(event.currentTarget.value),
            )}
          disabled={runActive}
        />
      </label>
      <label class="grid gap-1.5">
        <span class="text-xs font-medium text-muted-foreground">
          {t("deviceDiscoveryProbeTimeout")}
        </span>
        <Input
          type="number"
          min="1"
          max="120"
          value={probeTimeoutSecs}
          oninput={(event) =>
            workspace.setFormField(
              "probeTimeoutSecs",
              Number(event.currentTarget.value),
            )}
          disabled={runActive}
        />
      </label>
    </div>

    {#if errorMessage}
      <StatusCard message={errorMessage} tone="error" />
    {:else if statusMessage}
      <StatusCard message={statusMessage} tone="success" />
    {/if}

    {#if currentRun}
      <div class="grid gap-3">
        <div class="flex flex-wrap items-center gap-2">
          <Badge variant={runActive ? "secondary" : "outline"}>
            {t(`deviceDiscoveryRunStatus_${currentRun.status}`)}
          </Badge>
          <span class="text-sm text-muted-foreground">
            {t(`deviceDiscoveryPhase_${currentRun.phase}`)}
          </span>
        </div>

        <div class="h-2 overflow-hidden rounded-sm bg-muted">
          <div
            class="h-full bg-primary transition-[width] duration-300"
            style={`width: ${progressPercent}%`}
          ></div>
        </div>
        <div
          class="grid divide-y border-y border-border sm:grid-cols-4 sm:divide-x sm:divide-y-0"
        >
          {#each [{ label: t("deviceDiscoveryScanned"), value: currentRun.scanned_targets, filter: "all" }, { label: t("deviceDiscoveryReachable"), value: currentRun.reachable_count, filter: "reachable" }, { label: t("deviceDiscoveryIdentified"), value: identifiedResultCount, filter: "identified" }, { label: t("deviceDiscoveryFailed"), value: currentRun.failed_count, filter: "failed" }] as metric}
            <button
              type="button"
              class={`relative px-4 py-3 text-left transition-colors hover:bg-muted/60 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset ${resultFilter === metric.filter ? "bg-primary/10 text-primary after:absolute after:inset-x-0 after:top-0 after:h-0.5 after:bg-primary" : ""}`}
              aria-pressed={resultFilter === metric.filter}
              onclick={() =>
                selectResultFilter(metric.filter as DiscoveryResultFilter)}
            >
              <div
                class={`text-xs ${resultFilter === metric.filter ? "text-primary" : "text-muted-foreground"}`}
              >
                {metric.label}
              </div>
              <div class="mt-1 font-mono text-lg font-semibold tabular-nums">
                {metric.value || 0}
              </div>
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <div class="grid gap-3">
      <div class="flex min-w-0 flex-wrap items-end justify-between gap-3">
        <div class="relative w-full min-w-0 lg:w-auto lg:flex-1">
          <SearchIcon
            class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            class="pl-9"
            value={resultSearch}
            oninput={(event) =>
              workspace.setResultSearch(event.currentTarget.value)}
            placeholder={t("deviceDiscoverySearch")}
          />
        </div>
        <div
          class="flex w-full flex-wrap items-center justify-end gap-2 lg:w-auto"
        >
          <Button
            variant="outline"
            disabled={!currentRun?.id || loading}
            onclick={loadLatestRun}
            title={t("refreshBtn")}
          >
            <RefreshCwIcon data-icon="inline-start" aria-hidden="true" />
            {t("refreshBtn")}
          </Button>
          <Button
            disabled={!selectedImportableResults.length || importing}
            onclick={importSelected}
          >
            <DatabaseZapIcon data-icon="inline-start" aria-hidden="true" />
            {t("deviceDiscoveryImportSelected")} ({selectedImportableResults.length})
          </Button>
        </div>
      </div>

      <div class="max-w-full overflow-x-auto rounded-md border border-border">
        <Table.Root class="min-w-[72rem]">
          <Table.Header>
            <Table.Row>
              <Table.Head class="w-10">
                <Checkbox
                  checked={importableResults.length > 0 &&
                    selectedImportableResults.length ===
                      importableResults.length}
                  aria-label={t("deviceDiscoverySelectAll")}
                  onCheckedChange={toggleAllImportable}
                />
              </Table.Head>
              <Table.Head>{t("inventoryFieldHost")}</Table.Head>
              <Table.Head>{t("fieldPort")}</Table.Head>
              <Table.Head>
                <div class="flex items-center gap-1">
                  <span>{t("fieldStatus")}</span>
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger>
                      {#snippet child({ props })}
                        <Button
                          {...props}
                          type="button"
                          variant={statusFilter === "all"
                            ? "ghost"
                            : "secondary"}
                          size="icon-xs"
                          aria-label={`${t("deviceDiscoveryStatusFilter")}: ${activeStatusFilterLabel}`}
                          title={`${t("deviceDiscoveryStatusFilter")}: ${activeStatusFilterLabel}`}
                        >
                          <ListFilterIcon aria-hidden="true" />
                        </Button>
                      {/snippet}
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Content class="w-44" align="start">
                      <DropdownMenu.Label>
                        {t("deviceDiscoveryStatusFilter")}
                      </DropdownMenu.Label>
                      <DropdownMenu.RadioGroup
                        value={statusFilter}
                        onValueChange={selectStatusFilter}
                      >
                        {#each statusFilterOptions as option (option.value)}
                          <DropdownMenu.RadioItem value={option.value}>
                            {option.label}
                          </DropdownMenu.RadioItem>
                        {/each}
                      </DropdownMenu.RadioGroup>
                    </DropdownMenu.Content>
                  </DropdownMenu.Root>
                </div>
              </Table.Head>
              <Table.Head>{t("showResultPlatform")}</Table.Head>
              <Table.Head>{t("savedConnAutodetectModel")}</Table.Head>
              <Table.Head>{t("savedConnAutodetectVersion")}</Table.Head>
              <Table.Head>{t("credentialName")}</Table.Head>
              <Table.Head class="min-w-56">
                {t("deviceDiscoveryConnectionName")}
              </Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {#if filteredResults.length}
              {#each filteredResults as result (discoveryResultKey(result))}
                {@const key = discoveryResultKey(result)}
                <Table.Row>
                  <Table.Cell>
                    <Checkbox
                      checked={selectedResultKeys.includes(key)}
                      disabled={!discoveryResultCanImport(result)}
                      aria-label={`${result.host}:${result.port}`}
                      onCheckedChange={(checked) =>
                        toggleResult(result, checked)}
                    />
                  </Table.Cell>
                  <Table.Cell class="font-mono">{result.host}</Table.Cell>
                  <Table.Cell class="font-mono">{result.port}</Table.Cell>
                  <Table.Cell>
                    <Badge variant={resultBadgeVariant(result)}>
                      {resultStatusLabel(result)}
                    </Badge>
                    {#if result.error}
                      <div
                        class="mt-1 max-w-64 text-xs text-muted-foreground"
                        title={result.error}
                      >
                        {result.error}
                      </div>
                    {/if}
                  </Table.Cell>
                  <Table.Cell>{result.device_profile || "-"}</Table.Cell>
                  <Table.Cell>{result.device_model || "-"}</Table.Cell>
                  <Table.Cell>{result.software_version || "-"}</Table.Cell>
                  <Table.Cell>{result.credential_id || "-"}</Table.Cell>
                  <Table.Cell>
                    {#if discoveryResultCanImport(result)}
                      <Input
                        value={connectionNames[key] || ""}
                        aria-label={t("deviceDiscoveryConnectionName")}
                        oninput={(event) => updateConnectionName(result, event)}
                      />
                    {:else}
                      {result.imported_connection_name ||
                        result.existing_connection_name ||
                        "-"}
                    {/if}
                  </Table.Cell>
                </Table.Row>
              {/each}
            {:else}
              <Table.Row>
                <Table.Cell
                  colspan={9}
                  class="h-32 text-center text-muted-foreground"
                >
                  {t("deviceDiscoveryResultsEmpty")}
                </Table.Cell>
              </Table.Row>
            {/if}
          </Table.Body>
        </Table.Root>
      </div>
    </div>
  </div>
</section>
