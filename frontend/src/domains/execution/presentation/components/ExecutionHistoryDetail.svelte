<script lang="ts">
  import TerminalIcon from "@lucide/svelte/icons/terminal";
  import ExecutionResultsPanel from "$components/fragments/ExecutionResultsPanel.svelte";
  import ExecutionResultMeta from "$components/fragments/ExecutionResultMeta.svelte";
  import OutputBlock from "$components/fragments/OutputBlock.svelte";
  import ParsedOutputBlock from "$components/fragments/ParsedOutputBlock.svelte";
  import StatusCard from "$components/fragments/StatusCard.svelte";
  import TabList from "$components/fragments/TabList.svelte";
  import LoadingButton from "$components/fragments/LoadingButton.svelte";
  import { t, currentLanguageState } from "$lib/i18n.js";
  import type { ExecutionHistoryEntry } from "../../model/executionHistory.js";
  import {
    executionResultFailed,
    executionResultOutputText,
  } from "../../model/executionResult.js";
  import { executionHistoryExportSheets } from "../../model/executionHistoryExport.js";
  import { downloadHistoryConfig } from "../../application/downloadHistoryConfig.js";
  import { parsedOutputBlockDisplayFromItem } from "../executionResultPresentation.js";
  import { downloadCommandOutput } from "../../application/downloadCommandOutput.js";
  import {
    exportParsedOutputItemExcel,
    exportParsedOutputSheetsExcel,
  } from "../../application/exportParsedOutput.js";

  let { entry }: { entry: ExecutionHistoryEntry } = $props();
  let device = $state("");
  let commandIndex = $state("0");
  let view = $state("output");
  let exporting = $state(false);
  let deviceRows = $derived.by(() => {
    $currentLanguageState;
    return [...new Set(entry.outputs.map((row) => row.device))].map((name) => {
      const outputs = entry.outputs.filter((row) => row.device === name);
      const failed = outputs.some(executionResultFailed);
      return {
        key: name,
        title: name || "-",
        subtitle: [outputs[0]?.host, outputs[0]?.profile]
          .filter(Boolean)
          .join(" · "),
        statusLabel: t(
          failed ? "orchestrationStatusFailed" : "orchestrationStatusSuccess",
        ),
        statusTone: failed ? ("error" as const) : ("success" as const),
      };
    });
  });
  let selectedDevice = $derived(
    deviceRows.find((row) => row.key === device) ?? deviceRows[0],
  );
  let commands = $derived(
    entry.outputs.filter((row) => row.device === selectedDevice?.key),
  );
  let output = $derived(commands[Number(commandIndex)] ?? commands[0]);
  let hasParsed = $derived(
    entry.textfsmEnabled !== false &&
      (output?.parsed_output != null || !!output?.parse_error),
  );
  let sheets = $derived(executionHistoryExportSheets(entry));
  $effect(() => {
    entry.id;
    device = "";
    commandIndex = "0";
    view = "output";
  });
  async function exportAll() {
    exporting = true;
    try {
      await exportParsedOutputSheetsExcel(sheets, {
        filename: "execution-history.xlsx",
      });
    } finally {
      exporting = false;
    }
  }
</script>

<ExecutionResultsPanel
  title={t("executionHistoryTitle")}
  icon={TerminalIcon}
  items={deviceRows}
  alwaysShowNavigation={entry.scope === "batch"}
  activeKey={selectedDevice?.key ?? ""}
  navigationAriaLabel={t("batchShowResultDevicesAria")}
  onSelect={(key) => {
    device = key;
    commandIndex = "0";
    view = "output";
  }}
  statusMessage={entry.message ||
    (entry.status === "running"
      ? t("running")
      : entry.status === "interrupted"
        ? t("executionHistoryInterrupted")
        : "")}
  statusTone={entry.status === "running" ? "running" : "error"}
  emptyMessage={t("templateExecNoItems")}
>
  {#snippet actions()}
    {#if entry.outputs.length}
      <LoadingButton
        variant="outline"
        size="sm"
        onclick={() =>
          downloadCommandOutput(entry.outputs, "execution-history-output")}
        >{t("downloadCommandOutput")}</LoadingButton
      >
    {/if}
    {#if entry.textfsmEnabled !== false && sheets.length}
      <LoadingButton
        variant="outline"
        size="sm"
        loading={exporting}
        onclick={exportAll}>{t("textfsmExportAllExcel")}</LoadingButton
      >
    {/if}
  {/snippet}
  {#snippet detail()}
    {#if output}
      <div class="min-w-0 overflow-x-auto">
        <TabList
          tabItems={commands.map((row, index) => ({
            value: String(index),
            label: row.object || row.command || "-",
          }))}
          activeValue={String(Math.max(0, commands.indexOf(output)))}
          aria-label={t("fieldCommand")}
          onSelect={(value) => {
            commandIndex = value;
            view = "output";
          }}
        />
      </div>
      <ExecutionResultMeta
        fields={[
          { label: t("fieldHost"), value: output.host || output.device },
          { label: t("fieldCommand"), value: output.command, mono: true },
          ...(output.mode
            ? [{ label: t("modePlaceholder"), value: output.mode }]
            : []),
          ...(output.exit_code != null
            ? [
                {
                  label: t("txBlockResultExitCode"),
                  value: String(output.exit_code),
                },
              ]
            : []),
          ...(output.sha256
            ? [
                {
                  label: t("configFetchRawHashLabel"),
                  value: output.sha256,
                  mono: true,
                },
              ]
            : []),
          ...(output.normalized_sha256
            ? [
                {
                  label: t("configFetchNormalizedHashLabel"),
                  value: output.normalized_sha256,
                  mono: true,
                },
              ]
            : []),
        ]}
      />
      {#if output.error}<StatusCard message={output.error} tone="error" />{/if}
      {#if hasParsed || output.normalized_content != null}
        <TabList
          tabItems={[
            { value: "output", label: t("showRawOutputTab") },
            ...(hasParsed
              ? [{ value: "parsed", label: t("showParsedOutputTab") }]
              : []),
            ...(output.normalized_content != null
              ? [{ value: "normalized", label: t("configFetchNormalizedTab") }]
              : []),
          ]}
          activeValue={view}
          aria-label={t("executionHistoryTitle")}
          onSelect={(value) => (view = value)}
        />
      {/if}
      {#if view === "parsed"}
        <ParsedOutputBlock
          parsedOutputBlock={parsedOutputBlockDisplayFromItem(output)}
          onExportExcel={exportParsedOutputItemExcel}
        />
      {:else}
        <OutputBlock
          title={output.command}
          tone={executionResultFailed(output) ? "error" : "default"}
          errorLabel={t("orchestrationStatusFailed")}
        >
          {view === "normalized"
            ? output.normalized_content
            : executionResultOutputText(output, "output", {
                preferTranscript: executionResultFailed(output),
              })}
        </OutputBlock>
        {#if entry.feature === "config-fetch" && !executionResultFailed(output) && (view === "normalized" ? typeof output.normalized_content === "string" : typeof output.output === "string")}
          <LoadingButton
            variant="outline"
            size="sm"
            onclick={() =>
              downloadHistoryConfig(
                entry,
                output,
                view === "normalized" ? "normalized" : "raw",
              )}>{t("configFetchDownloadBtn")}</LoadingButton
          >
        {/if}
      {/if}
    {/if}
  {/snippet}
</ExecutionResultsPanel>
