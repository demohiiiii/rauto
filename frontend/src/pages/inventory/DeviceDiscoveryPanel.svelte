<script>
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
  import {
    cancelDeviceDiscoveryRun,
    createDeviceDiscoveryRun,
    getDeviceDiscoveryRun,
    importDeviceDiscoveryResults,
    listCredentials,
    listDeviceDiscoveryRuns,
    listInventoryGroups,
    listInventoryLabels,
  } from "../../api/client.js";
  import MultiSelectField from "../../components/fragments/MultiSelectField.svelte";
  import StatusCard from "../../components/fragments/StatusCard.svelte";
  import { currentLanguageState, t as translateText } from "../../lib/i18n.js";
  import { notifySavedConnectionsRefreshed } from "../../modules/connections/connectionTargetStoreState.js";
  import {
    defaultDiscoveryConnectionName,
    discoveryResultCanImport,
    discoveryResultKey,
    discoveryResultStatus,
    discoveryRunIsActive,
    filterDiscoveryResults,
    parseDiscoveryPorts,
    retainImportableDiscoveryResultKeys,
  } from "../../modules/inventory/deviceDiscoveryState.js";

  let { active = false } = $props();

  let currentLanguage = $derived($currentLanguageState);

  function t(key) {
    currentLanguage;
    return translateText(key);
  }

  let targetsText = $state("");
  let portsText = $state("22");
  let selectedCredentialIds = $state([]);
  let selectedGroups = $state([]);
  let selectedLabels = $state([]);
  let concurrency = $state(32);
  let tcpTimeoutMs = $state(1000);
  let probeTimeoutSecs = $state(15);
  let credentials = $state([]);
  let groups = $state([]);
  let labels = $state([]);
  let currentDetail = $state(null);
  let selectedResultKeys = $state([]);
  let connectionNames = $state({});
  let initializedResultKeys = new Set();
  let resultFilter = $state("identified");
  let statusFilter = $state("all");
  let resultSearch = $state("");
  let loading = $state(false);
  let importing = $state(false);
  let errorMessage = $state("");
  let statusMessage = $state("");
  let pollTimer = null;
  let initialized = false;

  let currentRun = $derived(currentDetail?.run || null);
  let results = $derived(currentDetail?.results || []);
  let runActive = $derived(discoveryRunIsActive(currentRun || {}));
  let filteredResults = $derived(
    filterDiscoveryResults(results, resultFilter, resultSearch, statusFilter),
  );
  let importableResults = $derived(
    results.filter((result) => discoveryResultCanImport(result)),
  );
  let selectedImportableResults = $derived(
    importableResults.filter((result) =>
      selectedResultKeys.includes(discoveryResultKey(result)),
    ),
  );
  let identifiedResultCount = $derived(
    results.filter((result) => discoveryResultStatus(result) === "identified")
      .length,
  );
  let progressPercent = $derived(
    currentRun?.status === "completed"
      ? 100
      : currentRun?.phase === "ssh_probe" && currentRun?.reachable_count
        ? Math.min(
            100,
            Math.round(
              (Number(currentRun.probed_targets || 0) /
                Number(currentRun.reachable_count)) *
                100,
            ),
          )
        : currentRun?.total_targets
          ? Math.min(
              100,
              Math.round(
                (Number(currentRun.scanned_targets || 0) /
                  Number(currentRun.total_targets)) *
                  100,
              ),
            )
          : 0,
  );
  let credentialOptions = $derived(
    credentials.map((credential) => ({
      label: `${credential.name} · ${credential.username}`,
      value: credential.id,
    })),
  );
  let groupOptions = $derived(
    groups.map((group) => ({ label: group.name, value: group.name })),
  );
  let labelOptions = $derived(
    labels.map((label) => ({ label: label.name, value: label.name })),
  );
  let statusFilterOptions = $derived([
    { value: "all", label: t("deviceDiscoveryStatusAll") },
    { value: "identified", label: t("deviceDiscoveryStatus_identified") },
    { value: "existing", label: t("deviceDiscoveryStatus_existing") },
    { value: "imported", label: t("deviceDiscoveryStatus_imported") },
    { value: "reachable", label: t("deviceDiscoveryStatus_reachable") },
    {
      value: "probe_failed",
      label: t("deviceDiscoveryStatus_probe_failed"),
    },
    { value: "not_ssh", label: t("deviceDiscoveryStatus_not_ssh") },
    { value: "unreachable", label: t("deviceDiscoveryStatus_unreachable") },
    { value: "cancelled", label: t("deviceDiscoveryStatus_cancelled") },
  ]);
  let activeStatusFilterLabel = $derived(
    statusFilterOptions.find((option) => option.value === statusFilter)
      ?.label || t("deviceDiscoveryStatusAll"),
  );
  $effect(() => {
    if (!active) {
      stopPolling();
      return;
    }
    if (!initialized) {
      initialized = true;
      void initialize();
    } else if (runActive) {
      schedulePoll();
    }
    return stopPolling;
  });

  async function initialize() {
    loading = true;
    errorMessage = "";
    try {
      const [credentialRows, groupRows, labelRows, runRows] = await Promise.all(
        [
          listCredentials(),
          listInventoryGroups(),
          listInventoryLabels(),
          listDeviceDiscoveryRuns(),
        ],
      );
      credentials = Array.isArray(credentialRows) ? credentialRows : [];
      groups = Array.isArray(groupRows) ? groupRows : [];
      labels = Array.isArray(labelRows) ? labelRows : [];
      if (!selectedCredentialIds.length && credentials[0]?.id) {
        selectedCredentialIds = [credentials[0].id];
      }
      const latestRun = Array.isArray(runRows) ? runRows[0] : null;
      if (latestRun?.id) await loadRun(latestRun.id);
    } catch (error) {
      errorMessage = error?.message || t("deviceDiscoveryLoadFailed");
    } finally {
      loading = false;
    }
  }

  async function loadLatestRun() {
    const runRows = await listDeviceDiscoveryRuns();
    const latestRun = Array.isArray(runRows) ? runRows[0] : null;
    if (!latestRun?.id) {
      currentDetail = null;
      return;
    }
    if (latestRun.id !== currentRun?.id) {
      initializedResultKeys = new Set();
      selectedResultKeys = [];
      connectionNames = {};
    }
    await loadRun(latestRun.id);
  }

  async function loadRun(runId) {
    if (!runId) return;
    currentDetail = await getDeviceDiscoveryRun(runId);
    initializeResultDrafts();
    if (discoveryRunIsActive(currentDetail?.run || {})) schedulePoll();
  }

  function initializeResultDrafts() {
    const nextNames = { ...connectionNames };
    const nextSelected = new Set(selectedResultKeys);
    for (const result of currentDetail?.results || []) {
      const key = discoveryResultKey(result);
      if (!nextNames[key])
        nextNames[key] = defaultDiscoveryConnectionName(result);
      if (!initializedResultKeys.has(key)) {
        initializedResultKeys.add(key);
        if (
          discoveryResultCanImport(result) &&
          !result.existing_connection_name
        ) {
          nextSelected.add(key);
        }
      }
    }
    connectionNames = nextNames;
    selectedResultKeys = Array.from(nextSelected);
  }

  function schedulePoll() {
    stopPolling();
    pollTimer = setTimeout(async () => {
      const runId = currentRun?.id;
      if (!active || !runId) return;
      try {
        await loadRun(runId);
      } catch (error) {
        errorMessage = error?.message || t("deviceDiscoveryLoadFailed");
      }
    }, 1000);
  }

  function stopPolling() {
    if (pollTimer) clearTimeout(pollTimer);
    pollTimer = null;
  }

  async function startDiscovery() {
    errorMessage = "";
    statusMessage = "";
    let ports;
    try {
      ports = parseDiscoveryPorts(portsText);
    } catch {
      errorMessage = t("deviceDiscoveryPortsInvalid");
      return;
    }
    if (!targetsText.trim()) {
      errorMessage = t("deviceDiscoveryTargetsRequired");
      return;
    }
    if (!selectedCredentialIds.length) {
      errorMessage = t("deviceDiscoveryCredentialRequired");
      return;
    }
    loading = true;
    initializedResultKeys = new Set();
    selectedResultKeys = [];
    connectionNames = {};
    try {
      currentDetail = await createDeviceDiscoveryRun({
        targets: targetsText.split(/\r?\n/),
        ports,
        credential_ids: selectedCredentialIds,
        default_groups: selectedGroups,
        default_labels: selectedLabels,
        concurrency: Number(concurrency),
        tcp_timeout_ms: Number(tcpTimeoutMs),
        probe_timeout_secs: Number(probeTimeoutSecs),
      });
      statusMessage = t("deviceDiscoveryStarted");
      schedulePoll();
    } catch (error) {
      errorMessage = error?.message || t("deviceDiscoveryStartFailed");
    } finally {
      loading = false;
    }
  }

  async function cancelDiscovery() {
    if (!currentRun?.id) return;
    loading = true;
    errorMessage = "";
    try {
      currentDetail = await cancelDeviceDiscoveryRun(currentRun.id);
      statusMessage = t("deviceDiscoveryCancelling");
      schedulePoll();
    } catch (error) {
      errorMessage = error?.message || t("deviceDiscoveryCancelFailed");
    } finally {
      loading = false;
    }
  }

  async function importSelected() {
    if (!currentRun?.id || !selectedImportableResults.length) return;
    importing = true;
    errorMessage = "";
    try {
      const importResult = await importDeviceDiscoveryResults(
        currentRun.id,
        selectedImportableResults.map((result) => {
          const key = discoveryResultKey(result);
          return {
            host: result.host,
            port: result.port,
            connection_name: connectionNames[key],
            credential_id: result.credential_id,
            overwrite: false,
          };
        }),
      );
      statusMessage = t("deviceDiscoveryImportSummary")
        .replace("{created}", importResult.created)
        .replace("{updated}", importResult.updated)
        .replace("{failed}", importResult.failed);
      notifySavedConnectionsRefreshed();
      await loadRun(currentRun.id);
      selectedResultKeys = retainImportableDiscoveryResultKeys(
        selectedResultKeys,
        currentDetail?.results,
      );
    } catch (error) {
      errorMessage = error?.message || t("deviceDiscoveryImportFailed");
    } finally {
      importing = false;
    }
  }

  function toggleResult(result, checked) {
    const key = discoveryResultKey(result);
    const next = new Set(selectedResultKeys);
    if (checked) next.add(key);
    else next.delete(key);
    selectedResultKeys = Array.from(next);
  }

  function toggleAllImportable(checked) {
    selectedResultKeys = checked
      ? importableResults.map(discoveryResultKey)
      : [];
  }

  function updateConnectionName(result, event) {
    const key = discoveryResultKey(result);
    connectionNames = {
      ...connectionNames,
      [key]: event.currentTarget.value,
    };
  }

  function selectResultFilter(filter) {
    resultFilter = filter;
    statusFilter = "all";
  }

  function selectStatusFilter(filter) {
    statusFilter = filter;
    resultFilter = "all";
  }

  function resultBadgeVariant(result) {
    const status = discoveryResultStatus(result);
    if (status === "imported") return "outline";
    if (status === "existing" || status === "reachable") return "secondary";
    if (status === "identified") return "default";
    return "destructive";
  }

  function resultStatusLabel(result) {
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
          bind:value={targetsText}
          placeholder={t("deviceDiscoveryTargetsPlaceholder")}
          disabled={runActive}
        />
      </label>

      <div class="grid min-w-0 content-start gap-4 sm:grid-cols-2">
        <label class="grid gap-1.5">
          <span class="text-sm font-medium">{t("deviceDiscoveryPorts")}</span>
          <Input
            class="font-mono"
            bind:value={portsText}
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
          onValueChange={(value) => (selectedCredentialIds = value)}
        />
        <MultiSelectField
          value={selectedGroups}
          optionRows={groupOptions}
          disabled={runActive}
          labelText={t("deviceDiscoveryDefaultGroups")}
          placeholderText={t("deviceDiscoveryOptional")}
          onValueChange={(value) => (selectedGroups = value)}
        />
        <MultiSelectField
          value={selectedLabels}
          optionRows={labelOptions}
          disabled={runActive}
          labelText={t("deviceDiscoveryDefaultLabels")}
          placeholderText={t("deviceDiscoveryOptional")}
          onValueChange={(value) => (selectedLabels = value)}
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
          bind:value={concurrency}
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
          bind:value={tcpTimeoutMs}
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
          bind:value={probeTimeoutSecs}
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
              onclick={() => selectResultFilter(metric.filter)}
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
            bind:value={resultSearch}
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
                  colspan="9"
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
