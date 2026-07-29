<script>
  import TerminalIcon from "@lucide/svelte/icons/terminal";
  import { onDestroy, tick } from "svelte";
  import {
    CommandEditor,
    CommandFlowSurface,
    CommandTemplateSourceField,
  } from "../../components/command-flow/index.js";
  import JsonObjectFieldsEditor from "../../components/fragments/JsonObjectFieldsEditor.svelte";
  import ExecutionResultMeta from "../../components/fragments/ExecutionResultMeta.svelte";
  import ExecutionResultsPanel from "../../components/fragments/ExecutionResultsPanel.svelte";
  import LoadingButton from "../../components/fragments/LoadingButton.svelte";
  import OutputBlock from "../../components/fragments/OutputBlock.svelte";
  import ParsedOutputBlock from "../../components/fragments/ParsedOutputBlock.svelte";
  import SessionRetryFields from "../../components/fragments/SessionRetryFields.svelte";
  import StatusCard from "../../components/fragments/StatusCard.svelte";
  import TextfsmControls from "../../components/fragments/TextfsmControls.svelte";
  import ValueTextSelectField from "../../components/fragments/ValueTextSelectField.svelte";
  import { t } from "../../lib/i18n.js";
  import { selectOptionsWithCurrent } from "../../lib/ui.js";
  import { createStandardCommandExecutionWorkspace } from "../../modules/standard/standardCommandExecutionWorkspace.js";
  import {
    exportParsedOutputItemExcel,
    parsedOutputBlockDisplayFromItem,
  } from "../../modules/operations/results.js";
  import { sessionRetryValidation } from "../../modules/operations/sessionRetry.js";

  let { active } = $props();
  let panelElement;
  let initialized = false;
  let activeResultKey = $state("");
  const workspace = createStandardCommandExecutionWorkspace();
  const { stateStore } = workspace;
  let commandState = $derived($stateStore);
  let modeOptionRows = $derived(
    selectOptionsWithCurrent(commandState.modeOptions, commandState.mode).map(
      (mode) => ({ labelText: mode, valueText: mode }),
    ),
  );
  let executedItems = $derived(
    commandState.executionResult?.kind === "result" &&
      Array.isArray(commandState.executionResult.resultPayload?.executed)
      ? commandState.executionResult.resultPayload.executed
      : [],
  );
  let retryValid = $derived(sessionRetryValidation(commandState.retry).valid);
  let resultItems = $derived(
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
  let resultStatusTone = $derived(
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

  async function handleSourceChange(value) {
    const replaced = await workspace.selectSource(value);
    if (!replaced) {
      await tick();
      panelElement?.querySelector("textarea")?.focus();
    }
  }

  onDestroy(workspace.destroy);
</script>

<div
  bind:this={panelElement}
  data-command-execution-workbench
  class="grid min-w-0 overflow-hidden"
  hidden={!active}
>
  <CommandFlowSurface
    variant="workbench-header"
    icon={TerminalIcon}
    title={t("commandSourceLabel")}
    description={t("commandSourceHint")}
  >
    <CommandTemplateSourceField
      value={commandState.sourceSelection}
      optionValues={commandState.sourceOptions}
      showLabel={false}
      onValueChange={handleSourceChange}
    />
  </CommandFlowSurface>

  <CommandFlowSurface
    variant="workbench-section"
    indexText="01"
    title={t("commandExecuteTitle")}
    description={commandState.dirty ? t("commandDraftDirty") : ""}
  >
    <CommandEditor
      command={commandState.content}
      commandLabel={t("commandExecuteTitle")}
      multilineMode={commandState.multilineMode}
      placeholderText={t("commandPlaceholder")}
      onCommandChange={workspace.changeContent}
      onMultilineModeChange={workspace.changeMultilineMode}
    >
      {#if commandState.varsSchema.length > 0}
        <div
          class="grid min-w-0 gap-2 rounded-xl border border-border bg-muted/30 p-4"
        >
          <div>
            <h4 class="text-sm font-semibold text-foreground">
              {t("commandVarsTitle")}
            </h4>
            <p class="mt-0.5 text-xs text-muted-foreground">
              {t("commandVarsHint")}
            </p>
          </div>
          <JsonObjectFieldsEditor
            title={t("commandVarsTitle")}
            source={commandState.vars}
            typeRows={["string", "number", "boolean", "null", "json"]}
            onChange={workspace.changeVars}
          />
        </div>
      {/if}

      <ValueTextSelectField
        title={t("modePlaceholder")}
        aria-label={t("modePlaceholder")}
        value={commandState.mode}
        optionRows={modeOptionRows}
        onValueChange={workspace.changeMode}
      />

      <TextfsmControls
        excelNamePlaceholderKey="batchShowExcelNamePlaceholder"
        hintKey="textfsmParseHint"
        includeTemplateInput={true}
        onEnabledChange={(enabled) => workspace.changeTextfsm({ enabled })}
        onPlatformChange={(platform) => workspace.changeTextfsm({ platform })}
        onStrictErrorsChange={(strictErrors) =>
          workspace.changeTextfsm({ strictErrors })}
        onTemplateChange={(template) => workspace.changeTextfsm({ template })}
        textfsmFields={commandState.textfsm}
      />

      <SessionRetryFields
        idPrefix="command-session-retry"
        value={commandState.retry}
        onChange={workspace.changeRetry}
      />

      {#if commandState.status.message}
        <StatusCard
          message={commandState.status.message}
          tone={commandState.status.tone}
        />
      {/if}

      <div class="flex flex-wrap justify-end gap-2">
        <LoadingButton
          variant="outline"
          size="sm"
          loading={commandState.loadingActions.includes("preview")}
          onclick={workspace.preview}
        >
          {t("commandPreviewButton")}
        </LoadingButton>
        <LoadingButton
          variant="default"
          size="sm"
          loading={commandState.loadingActions.includes("execute")}
          disabled={!retryValid}
          onclick={workspace.execute}
        >
          {t("execBtn")}
        </LoadingButton>
      </div>
    </CommandEditor>
  </CommandFlowSurface>

  {#if commandState.preview.kind !== "empty"}
    <CommandFlowSurface
      variant="workbench-section"
      indexText="02"
      title={t("commandPreviewTitle")}
    >
      {#if commandState.preview.kind === "error"}
        <StatusCard message={commandState.preview.message} tone="error" />
      {:else if commandState.preview.text}
        <OutputBlock>{commandState.preview.text}</OutputBlock>
      {/if}
    </CommandFlowSurface>
  {/if}

  {#if commandState.executionResult.kind !== "empty"}
    <div class="border-t-4 border-muted p-4 sm:p-5">
      <ExecutionResultsPanel
        title={t("flowResultsTitle")}
        description={t("flowResultsHint")}
        icon={TerminalIcon}
        items={resultItems}
        activeKey={activeResultItem?.key || ""}
        navigationAriaLabel={t("flowResultsTitle")}
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
