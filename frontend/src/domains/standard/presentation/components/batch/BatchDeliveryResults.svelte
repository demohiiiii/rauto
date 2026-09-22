<script lang="ts">
  import { untrack } from "svelte";
  import TerminalIcon from "@lucide/svelte/icons/terminal";
  import ExecutionResultMeta from "$components/fragments/ExecutionResultMeta.svelte";
  import ExecutionResultsPanel from "$components/fragments/ExecutionResultsPanel.svelte";
  import LoadingButton from "$components/fragments/LoadingButton.svelte";
  import OutputBlock from "$components/fragments/OutputBlock.svelte";
  import ParsedOutputBlock from "$components/fragments/ParsedOutputBlock.svelte";
  import StatusCard from "$components/fragments/StatusCard.svelte";
  import TabList from "$components/fragments/TabList.svelte";
  import {
    exportParsedOutputItemExcel,
    parsedOutputBlockDisplayFromItem,
  } from "$domains/execution/index.js";
  import { t } from "$lib/i18n.js";
  import type { BatchDeliveryWorkspace } from "../../../application/createBatchDeliveryWorkspace.js";

  let { workspace }: { workspace: BatchDeliveryWorkspace } = $props();
  const { resultStore, downloadErrorStore } = untrack(() => workspace);
  let selectedDevice = $state("");
  let selectedCommand = $state("0");
  let rows = $derived(
    $resultStore.kind === "result" ? $resultStore.resultPayload : [],
  );
  let items = $derived(
    rows.map((row) => ({
      key: row.target,
      row,
      title: row.target,
      subtitle: [row.host, row.profile].filter(Boolean).join(" · "),
      statusLabel: t(
        row.error || row.success === false
          ? "interactiveResultFailed"
          : "interactiveResultSuccess",
      ),
      statusTone:
        row.error || row.success === false
          ? ("error" as const)
          : ("success" as const),
    })),
  );
  let activeItem = $derived(
    items.find((item) => item.key === selectedDevice) || items[0],
  );
  let activeRow = $derived(activeItem?.row);
  let output = $derived(
    activeRow?.outputs[Number(selectedCommand)] || activeRow?.outputs[0],
  );
  let parsed = $derived(
    output
      ? parsedOutputBlockDisplayFromItem(output, {
          ...output,
          device: activeRow?.target,
        })
      : null,
  );
  let failed = $derived(
    rows.filter((row) => row.error || row.success === false).length,
  );
  let canExport = $derived(
    rows.some((row) =>
      row.outputs.some((output) => output.parsed_output != null),
    ),
  );
</script>

{#if $resultStore.kind !== "empty"}
  <div class="border-t-4 border-muted p-4 sm:p-5">
    <ExecutionResultsPanel
      title={t("interactiveResultsTitle")}
      description={t("interactiveResultsHint")}
      icon={TerminalIcon}
      {items}
      activeKey={activeItem?.key || ""}
      navigationAriaLabel={t("batchShowResultDevicesAria")}
      onSelect={(key) => {
        selectedDevice = key;
        selectedCommand = "0";
      }}
      statusMessage={$resultStore.kind === "error"
        ? $resultStore.message
        : $resultStore.kind === "running"
          ? t("running")
          : ""}
      statusTone={$resultStore.kind === "error" ? "error" : "running"}
      totalCount={$resultStore.kind === "result" ? rows.length : null}
      succeededCount={$resultStore.kind === "result"
        ? rows.length - failed
        : null}
      failedCount={$resultStore.kind === "result" ? failed : null}
      totalLabel={t("showResultCount")}
      succeededLabel={t("interactiveResultSuccess")}
      failedLabel={t("interactiveResultFailed")}
    >
      {#snippet actions()}
        {#if rows.length}
          <LoadingButton
            variant="outline"
            size="sm"
            onclick={workspace.downloadOutput}
            >{t("downloadCommandOutput")}</LoadingButton
          >
          {#if canExport}
            <LoadingButton
              variant="outline"
              size="sm"
              onclick={workspace.exportExcel}
              >{t("textfsmExportAllExcel")}</LoadingButton
            >
          {/if}
        {/if}
      {/snippet}
      {#snippet detail()}
        {#if activeRow}
          <ExecutionResultMeta
            fields={[
              { label: t("fieldHost"), value: activeRow.host },
              { label: t("showResultProfile"), value: activeRow.profile },
            ]}
          />
          {#if activeRow.error}<StatusCard
              message={activeRow.error}
              tone="error"
              variant="alert"
            />{/if}
          {#if activeRow.outputs.length}
            <div class="min-w-0 overflow-x-auto">
              <TabList
                tabItems={activeRow.outputs.map((row, index) => ({
                  value: String(index),
                  label: row.command,
                }))}
                activeValue={String(
                  Math.max(0, activeRow.outputs.indexOf(output!)),
                )}
                aria-label={t("fieldCommand")}
                onSelect={(value) => (selectedCommand = value)}
              />
            </div>
          {/if}
          {#if output}
            {#if output.error}<StatusCard
                message={output.error}
                tone="error"
                variant="alert"
              />{/if}
            <OutputBlock
              title={output.command}
              tone={output.success ? "success" : "error"}
              errorLabel={t("interactiveResultFailed")}
            >
              {output.success
                ? output.output || output.all || output.error
                : output.all || output.output || output.error}
            </OutputBlock>
            {#if parsed}<ParsedOutputBlock
                parsedOutputBlock={parsed}
                onExportExcel={exportParsedOutputItemExcel}
              />{/if}
          {/if}
        {/if}
      {/snippet}
    </ExecutionResultsPanel>
    {#if $downloadErrorStore}<StatusCard
        message={$downloadErrorStore}
        tone="error"
      />{/if}
  </div>
{/if}
