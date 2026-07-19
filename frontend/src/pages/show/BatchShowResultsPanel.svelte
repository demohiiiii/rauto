<script>
  import DetailFieldCard from "../../components/fragments/DetailFieldCard.svelte";
  import LoadingButton from "../../components/fragments/LoadingButton.svelte";
  import OutputBlock from "../../components/fragments/OutputBlock.svelte";
  import ParsedOutputBlock from "../../components/fragments/ParsedOutputBlock.svelte";
  import StatusCard from "../../components/fragments/StatusCard.svelte";
  import Table2Icon from "@lucide/svelte/icons/table-2";
  import TerminalIcon from "@lucide/svelte/icons/terminal";
  import {
    createBatchShowResultsPanelWorkspace,
    exportShowParsedOutputItemExcel,
  } from "../../modules/operations/show.js";

  let { batchResultDisplay, batchResultsPresentation } = $props();
  const batchShowResultsPanelWorkspace = createBatchShowResultsPanelWorkspace();
  const {
    exportActionHandlersStateStore,
    exportLoadingStateStore,
    setResultsContext,
  } = batchShowResultsPanelWorkspace;
  let exportActionHandlers = $derived($exportActionHandlersStateStore);
  let exportLoadingState = $derived($exportLoadingStateStore);
  let exportLoading = $derived(exportLoadingState.exportLoading);
  let activeDeviceKey = $state("");
  let activeObjectKey = $state("");
  let resultView = $state("output");
  let deviceRows = $derived(batchResultsPresentation.deviceRows || []);
  let activeDeviceRow = $derived(
    deviceRows.find((deviceRow) => deviceRow.deviceKey === activeDeviceKey) ||
      deviceRows[0] ||
      null,
  );
  let objectRows = $derived(activeDeviceRow?.objectRows || []);
  let activeObjectResultRow = $derived(
    objectRows.find((objectRow) => objectRow.resultKey === activeObjectKey) ||
      objectRows[0] ||
      null,
  );

  $effect(() => {
    setResultsContext({ batchResultsPresentation });
  });

  $effect(() => {
    if (!deviceRows.length) {
      activeDeviceKey = "";
      activeObjectKey = "";
      resultView = "output";
      return;
    }
    if (
      deviceRows.some((deviceRow) => deviceRow.deviceKey === activeDeviceKey)
    ) {
      return;
    }
    activeDeviceKey = deviceRows[0].deviceKey;
    activeObjectKey = "";
    resultView = "output";
  });

  $effect(() => {
    if (!objectRows.length) {
      activeObjectKey = "";
      resultView = "output";
      return;
    }
    if (
      objectRows.some((objectRow) => objectRow.resultKey === activeObjectKey)
    ) {
      return;
    }
    activeObjectKey = objectRows[0].resultKey;
    resultView = "output";
  });

  function selectDevice(deviceKey) {
    activeDeviceKey = deviceKey;
    activeObjectKey = "";
    resultView = "output";
  }

  function selectObject(resultKey) {
    activeObjectKey = resultKey;
    resultView = "output";
  }
</script>

<div class="grid min-w-0 max-w-full gap-4">
  {#if batchResultDisplay.statusMessage && !batchResultDisplay.showResultPanel}
    <StatusCard
      message={batchResultDisplay.statusMessage}
      tone={batchResultDisplay.statusTone}
    />
  {/if}

  {#if batchResultDisplay.showResultPanel}
    <section
      class="min-w-0 overflow-hidden rounded-3xl border border-border bg-card shadow-sm"
    >
      <div
        class="flex items-center justify-between gap-3 border-b border-border px-6 py-4"
      >
        <div class="flex items-center gap-3">
          <span
            class="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15"
            aria-hidden="true"
          >
            <TerminalIcon class="size-4" />
          </span>
          <span>
            <h3 class="text-[15px] font-semibold text-card-foreground">
              查询结果
            </h3>
            <p class="text-xs text-muted-foreground">
              每个目标设备的原始输出与解析结果
            </p>
          </span>
        </div>

        <div class="flex items-center gap-2">
          <span
            class="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground"
          >
            结果数
            <span class="font-semibold text-foreground">
              {batchResultsPresentation.resultCount}
            </span>
          </span>
          {#if batchResultsPresentation.exportAvailable}
            <LoadingButton
              variant="outline"
              size="sm"
              loading={exportLoading}
              onclick={exportActionHandlers.export}
            >
              <span>{batchResultsPresentation.exportButtonLabel}</span>
            </LoadingButton>
          {/if}
        </div>
      </div>

      {#if deviceRows.length > 1}
        <div
          class="flex items-center gap-1 overflow-x-auto border-b border-border px-6 pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="批量查询结果设备"
        >
          {#each deviceRows as deviceRow}
            <button
              type="button"
              class={[
                "-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 font-mono text-sm font-medium transition-colors",
                deviceRow.deviceKey === activeDeviceKey
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              ]}
              aria-pressed={deviceRow.deviceKey === activeDeviceKey}
              onclick={() => selectDevice(deviceRow.deviceKey)}
            >
              {deviceRow.targetText}
              <span
                class={[
                  "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                  deviceRow.deviceKey === activeDeviceKey
                    ? "bg-accent text-accent-foreground"
                    : "bg-secondary text-muted-foreground",
                ]}
              >
                {deviceRow.profileText}
              </span>
            </button>
          {/each}
        </div>
      {/if}

      <div class="flex flex-col gap-4 p-6">
        {#if batchResultDisplay.statusMessage}
          <StatusCard
            message={batchResultDisplay.statusMessage}
            tone={batchResultDisplay.statusTone}
          />
        {/if}

        {#if objectRows.length > 1}
          <div
            class="flex items-center gap-1 overflow-x-auto border-b border-border [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            aria-label="设备查询对象"
          >
            {#each objectRows as objectRow}
              <button
                type="button"
                class={[
                  "-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 font-mono text-sm font-medium transition-colors",
                  objectRow.resultKey === activeObjectKey
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                ]}
                aria-pressed={objectRow.resultKey === activeObjectKey}
                onclick={() => selectObject(objectRow.resultKey)}
              >
                {objectRow.objectText}
                <span
                  class={[
                    "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                    objectRow.resultKey === activeObjectKey
                      ? "bg-accent text-accent-foreground"
                      : "bg-secondary text-muted-foreground",
                  ]}
                >
                  {objectRow.modeText}
                </span>
              </button>
            {/each}
          </div>
        {/if}

        {#if activeObjectResultRow}
          <div
            class="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-border bg-muted/30 px-4 py-3"
          >
            {#each activeObjectResultRow.metaFields as metaField}
              <DetailFieldCard
                detailValue={metaField.value}
                label={metaField.label}
                mono={metaField.mono}
                variant="inline"
                class="text-muted-foreground"
                labelClass="text-muted-foreground/70"
                valueClass={metaField.mono
                  ? "break-all font-mono font-medium text-foreground"
                  : "break-all font-medium text-foreground"}
              />
            {/each}
          </div>

          {#if activeObjectResultRow.error}
            <StatusCard
              message={activeObjectResultRow.error}
              tone="error"
              variant="alert"
              class="py-2 text-xs"
            />
          {/if}

          <div class="flex items-center justify-between gap-3">
            <div class="inline-flex items-center rounded-lg bg-secondary p-0.5">
              <button
                type="button"
                class={[
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all",
                  resultView === "output"
                    ? "bg-card text-card-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                ]}
                onclick={() => (resultView = "output")}
              >
                <TerminalIcon class="size-3.5" />
                命令行输出
              </button>
              <button
                type="button"
                class={[
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all",
                  resultView === "parsed"
                    ? "bg-card text-card-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                ]}
                onclick={() => (resultView = "parsed")}
              >
                <Table2Icon class="size-3.5" />
                TextFSM 解析
              </button>
            </div>
          </div>

          {#if resultView === "output"}
            <OutputBlock title={activeObjectResultRow.outputTitle}>
              {activeObjectResultRow.outputText}
            </OutputBlock>
          {:else}
            <ParsedOutputBlock
              parsedOutputBlock={activeObjectResultRow.parsedOutputBlock}
              onExportExcel={exportShowParsedOutputItemExcel}
            />
          {/if}
        {/if}
      </div>
    </section>
  {/if}
</div>
