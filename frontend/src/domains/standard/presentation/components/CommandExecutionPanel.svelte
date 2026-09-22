<script lang="ts">
  import { MANUAL_COMMAND_SOURCE } from "$domains/command/index.js";
  import { createBatchDeliveryWorkspace } from "../../application/createBatchDeliveryWorkspace.js";
  import BatchDeliveryTargets from "./batch/BatchDeliveryTargets.svelte";
  import BatchDeliveryResults from "./batch/BatchDeliveryResults.svelte";
  import TerminalIcon from "@lucide/svelte/icons/terminal";
  import { onDestroy, tick, untrack } from "svelte";
  import CommandEditor from "$domains/command/presentation/components/CommandEditor.svelte";
  import CommandSurface from "$domains/command/presentation/components/CommandSurface.svelte";
  import CommandTemplateSourceField from "$domains/command/presentation/components/CommandTemplateSourceField.svelte";
  import JsonObjectFieldsEditor from "$components/fragments/JsonObjectFieldsEditor.svelte";
  import ExecutionResultMeta from "$components/fragments/ExecutionResultMeta.svelte";
  import ExecutionResultsPanel from "$components/fragments/ExecutionResultsPanel.svelte";
  import ExecutionRunBar from "$components/fragments/ExecutionRunBar.svelte";
  import LoadingButton from "$components/fragments/LoadingButton.svelte";
  import ModeExpressionField from "$components/fragments/ModeExpressionField.svelte";
  import OutputBlock from "$components/fragments/OutputBlock.svelte";
  import ParsedOutputBlock from "$components/fragments/ParsedOutputBlock.svelte";
  import SessionRetryFields from "$components/fragments/SessionRetryFields.svelte";
  import StatusCard from "$components/fragments/StatusCard.svelte";
  import TextfsmControls from "$components/fragments/TextfsmControls.svelte";
  import { t } from "$lib/i18n.js";
  import { createStandardCommandExecutionWorkspace } from "../../application/createStandardCommandExecutionWorkspace.js";
  import type { StandardCommandResult } from "../../model/types.js";
  import {
    exportParsedOutputItemExcel,
    parsedOutputBlockDisplayFromItem,
    sessionRetryValidation,
  } from "$domains/execution/index.js";

  type ResultTone = "error" | "success";

  interface CommandResultItem {
    key: string;
    row: StandardCommandResult;
    statusLabel: string;
    statusTone: ResultTone;
    subtitle: string;
    title: string;
  }

  let { active, batch = false }: { active: boolean; batch?: boolean } =
    $props();
  const batchWorkspace = untrack(() =>
    batch ? createBatchDeliveryWorkspace("command") : undefined,
  );
  let panelElement: HTMLElement;
  let initialized = false;
  let activeResultKey = $state("");
  const workspace = createStandardCommandExecutionWorkspace({
    batch: batchWorkspace,
  });
  const { stateStore } = workspace;
  let commandState = $derived($stateStore);
  let executedItems = $derived(
    commandState.executionResult?.kind === "result" &&
      Array.isArray(commandState.executionResult.resultPayload?.executed)
      ? commandState.executionResult.resultPayload.executed
      : [],
  );
  let templateSelected = $derived(
    commandState.sourceSelection !== MANUAL_COMMAND_SOURCE,
  );
  let displayedCommand = $derived(
    templateSelected
      ? commandState.preview.kind === "result"
        ? commandState.preview.text
        : ""
      : commandState.content,
  );
  let retryValid = $derived(sessionRetryValidation(commandState.retry).valid);
  let resultItems: CommandResultItem[] = $derived(
    executedItems.map((item, index) => ({
      key: `${item.command || "command"}:${index}`,
      row: item,
      title: item.command || "-",
      subtitle: `${t("txBlockResultExitCode")}: ${item.exit_code ?? "-"}`,
      statusLabel: item.success
        ? t("orchestrationStatusSuccess", "Success")
        : t("orchestrationStatusFailed", "Failed"),
      statusTone: item.success ? "success" : "error",
    })),
  );
  let activeResultItem = $derived(
    resultItems.find((item) => item.key === activeResultKey) ||
      resultItems[0] ||
      null,
  );
  let activeResult = $derived(activeResultItem?.row || null);
  let failedCount = $derived(
    executedItems.filter((item) => !item.success).length,
  );
  let resultStatusMessage = $derived(
    commandState.executionResult.kind === "running"
      ? t("running")
      : commandState.executionResult.kind === "error"
        ? commandState.executionResult.message
        : commandState.executionResult.kind === "result" &&
            executedItems.length === 0
          ? t("templateExecNoItems")
          : "",
  );
  let resultStatusTone: "error" | "running" = $derived(
    commandState.executionResult.kind === "error" ? "error" : "running",
  );
  let activeMetaFields = $derived(
    activeResult
      ? [
          {
            label: t("fieldCommand"),
            value: activeResult.command,
            mono: true,
          },
          {
            label: t("txBlockResultExitCode"),
            value: activeResult.exit_code ?? "-",
          },
        ]
      : [],
  );

  $effect(() => {
    if (!active || initialized) return;
    initialized = true;
    void workspace.initialize();
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

  async function handleSourceChange(value: string) {
    const replaced = await workspace.selectSource(value);
    if (!replaced) {
      await tick();
      panelElement?.querySelector("textarea")?.focus();
    }
  }

  function changeAutoDownloadOutput(autoDownloadOutput: boolean) {
    workspace.changeTextfsm({ autoDownloadOutput });
  }

  function changeAutoDownloadExcel(autoDownloadExcel: boolean) {
    workspace.changeTextfsm({ autoDownloadExcel });
  }

  function changeTextfsmEnabled(enabled: boolean) {
    workspace.changeTextfsm({ enabled });
  }

  function changeTextfsmStrictErrors(strictErrors: boolean) {
    workspace.changeTextfsm({ strictErrors });
  }

  function changeTextfsmTemplate(template: string) {
    workspace.changeTextfsm({ template });
  }

  onDestroy(workspace.destroy);
</script>

<div
  bind:this={panelElement}
  data-command-execution-workbench
  class="grid min-w-0 gap-5 p-4 sm:p-5"
  hidden={!active}
>
  {#if batchWorkspace}<BatchDeliveryTargets workspace={batchWorkspace} />{/if}
  <div class="grid min-w-0 gap-2">
    <CommandTemplateSourceField
      hintText={t("commandTemplateSourceHint")}
      value={commandState.sourceSelection}
      optionValues={commandState.sourceOptions}
      onValueChange={handleSourceChange}
    />
  </div>

  {#if commandState.dirty}
    <p class="text-xs text-muted-foreground">{t("commandDraftDirty")}</p>
  {/if}

  {#if commandState.varsSchema.length > 0}
    <div
      class="grid min-w-0 gap-2 rounded-xl border border-border bg-muted/30 p-4"
    >
      <h4 class="text-sm font-semibold text-foreground">
        {t("commandVarsTitle")}
      </h4>
      <JsonObjectFieldsEditor
        layout="inline"
        allowAdd={false}
        allowRemove={false}
        source={commandState.vars}
        typeRows={["string", "number", "boolean", "null", "json"]}
        onChange={workspace.changeVars}
      />
    </div>
  {/if}

  <div class="grid min-w-0 gap-3">
    <CommandEditor
      command={displayedCommand}
      commandLabel={templateSelected
        ? t("commandRenderedTitle")
        : t("fieldCommand")}
      readonly={templateSelected}
      multilineMode={commandState.multilineMode}
      placeholderText={templateSelected
        ? t(
            commandState.preview.kind === "running" ||
              commandState.loadingActions.includes("template")
              ? "commandTemplateRendering"
              : "commandTemplateReadonly",
          )
        : t("commandPlaceholder")}
      onCommandChange={workspace.changeContent}
      onMultilineModeChange={workspace.changeMultilineMode}
    >
      {#snippet modeField()}
        <ModeExpressionField
          title={t("modePlaceholder")}
          aria-label={t("modePlaceholder")}
          value={commandState.mode}
          optionValues={commandState.modeOptions}
          placeholderText={t("modePlaceholder")}
          onValueChange={workspace.changeMode}
        />
      {/snippet}

      {#if templateSelected && commandState.preview.kind === "error"}
        <StatusCard message={commandState.preview.message} tone="error" />
      {/if}

      <TextfsmControls
        hintKey="textfsmParseHint"
        includeTemplateInput={true}
        onEnabledChange={changeTextfsmEnabled}
        onAutoDownloadExcelChange={changeAutoDownloadExcel}
        onStrictErrorsChange={changeTextfsmStrictErrors}
        onTemplateChange={changeTextfsmTemplate}
        textfsmFields={commandState.textfsm}
      />

      <SessionRetryFields
        idPrefix={batch
          ? "batch-command-session-retry"
          : "command-session-retry"}
        value={commandState.retry}
        onChange={workspace.changeRetry}
      />

      {#if commandState.status.message}
        <StatusCard
          message={commandState.status.message}
          tone={commandState.status.tone}
        />
      {/if}
    </CommandEditor>
  </div>

  {#if !templateSelected && commandState.preview.kind !== "empty"}
    <CommandSurface variant="section" title={t("commandPreviewTitle")}>
      {#if commandState.preview.kind === "error"}
        <StatusCard message={commandState.preview.message} tone="error" />
      {:else if commandState.preview.text}
        <OutputBlock>{commandState.preview.text}</OutputBlock>
      {/if}
    </CommandSurface>
  {/if}

  <ExecutionRunBar
    autoDownloadOutput={commandState.textfsm.autoDownloadOutput}
    onAutoDownloadOutputChange={changeAutoDownloadOutput}
    title={t("commandDeliveryTitle")}
    hint={t(batch ? "batchExecFooterHint" : "commandDeliveryHint")}
    buttonLabel={t("execBtn")}
    loading={commandState.loadingActions.includes("execute")}
    disabled={!retryValid ||
      commandState.loadingActions.includes("template") ||
      (templateSelected && commandState.preview.kind !== "result")}
    onRun={workspace.execute}
  >
    {#snippet actions()}
      <LoadingButton
        variant="outline"
        size="lg"
        class="flex-1 sm:flex-none"
        loading={commandState.loadingActions.includes("preview")}
        onclick={workspace.preview}
      >
        {t("commandPreviewButton")}
      </LoadingButton>
    {/snippet}
  </ExecutionRunBar>

  {#if batchWorkspace}
    <BatchDeliveryResults workspace={batchWorkspace} />
  {/if}
  {#if commandState.executionResult.kind !== "empty"}
    <div class="border-t-4 border-muted p-4 sm:p-5">
      <ExecutionResultsPanel
        title={t("interactiveResultsTitle")}
        description={t("interactiveResultsHint")}
        icon={TerminalIcon}
        items={resultItems}
        activeKey={activeResultItem?.key || ""}
        navigationAriaLabel={t("interactiveResultsTitle")}
        onSelect={(key) => (activeResultKey = key)}
        statusMessage={resultStatusMessage}
        statusTone={resultStatusTone}
        totalCount={commandState.executionResult.kind === "result"
          ? executedItems.length
          : null}
        succeededCount={commandState.executionResult.kind === "result"
          ? executedItems.length - failedCount
          : null}
        failedCount={commandState.executionResult.kind === "result"
          ? failedCount
          : null}
        totalLabel={t("showResultCount")}
        succeededLabel={t("orchestrationStatusSuccess", "Success")}
        failedLabel={t("orchestrationStatusFailed", "Failed")}
      >
        {#snippet actions()}
          {#if executedItems.length}
            <LoadingButton
              variant="outline"
              size="sm"
              onclick={workspace.downloadOutput}
              >{t("downloadCommandOutput")}</LoadingButton
            >
          {/if}
        {/snippet}
        {#snippet detail()}
          {#if activeResult}
            {@const parsedOutputBlock = parsedOutputBlockDisplayFromItem(
              activeResult,
              activeResult,
            )}
            <ExecutionResultMeta fields={activeMetaFields} />
            {#if !activeResult.success && activeResult.error}
              <StatusCard
                message={activeResult.error}
                tone="error"
                variant="alert"
              />
            {/if}
            {#if activeResult.output || activeResult.all || activeResult.error}
              <OutputBlock
                title={activeResult.command}
                tone={activeResultItem?.statusTone}
                errorLabel={t("orchestrationStatusFailed", "Failed")}
              >
                {activeResult.success
                  ? activeResult.output ||
                    activeResult.all ||
                    activeResult.error
                  : activeResult.all ||
                    activeResult.output ||
                    activeResult.error}
              </OutputBlock>
            {/if}
            {#if parsedOutputBlock}
              <ParsedOutputBlock
                {parsedOutputBlock}
                onExportExcel={exportParsedOutputItemExcel}
              />
            {/if}
          {/if}
        {/snippet}
      </ExecutionResultsPanel>
    </div>
  {/if}
</div>
