<script>
  import TerminalIcon from "@lucide/svelte/icons/terminal";
  import { onDestroy, tick } from "svelte";
  import {
    CommandEditor,
    CommandFlowSurface,
    CommandTemplateSourceField,
  } from "../../components/command-flow/index.js";
  import JsonObjectFieldsEditor from "../../components/fragments/JsonObjectFieldsEditor.svelte";
  import LoadingButton from "../../components/fragments/LoadingButton.svelte";
  import OutputBlock from "../../components/fragments/OutputBlock.svelte";
  import ParsedOutputBlock from "../../components/fragments/ParsedOutputBlock.svelte";
  import StatusCard from "../../components/fragments/StatusCard.svelte";
  import TextfsmControls from "../../components/fragments/TextfsmControls.svelte";
  import ValueTextSelectField from "../../components/fragments/ValueTextSelectField.svelte";
  import { t } from "../../lib/i18n.js";
  import { selectOptionsWithCurrent } from "../../lib/ui.js";
  import { createStandardCommandExecutionWorkspace } from "../../modules/standardCommandExecutionWorkspace.js";
  import { exportStandardParsedOutputItemExcel } from "../../modules/standard.js";
  import { parsedOutputBlockDisplayFromItem } from "../../modules/results.js";

  let { active } = $props();
  let panelElement;
  let initialized = false;
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

  $effect(() => {
    if (!active || initialized) return;
    initialized = true;
    void workspace.initialize();
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
    <CommandFlowSurface
      variant="workbench-section"
      indexText={commandState.preview.kind === "empty" ? "02" : "03"}
      title={t("flowResultsTitle")}
    >
      {#if commandState.executionResult.kind === "running"}
        <StatusCard message={t("running")} tone="running" />
      {:else if commandState.executionResult.kind === "error"}
        <StatusCard
          message={commandState.executionResult.message}
          tone="error"
        />
      {:else if executedItems.length === 0}
        <StatusCard message={t("templateExecNoItems")} tone="info" />
      {:else}
        <div class="grid min-w-0 gap-3">
          {#each executedItems as item, index}
            {@const parsedOutputBlock = parsedOutputBlockDisplayFromItem(
              item,
              item,
            )}
            <article
              class="grid min-w-0 gap-2 rounded-xl border border-border bg-card p-4"
            >
              <div
                class="flex min-w-0 flex-wrap items-center justify-between gap-2"
              >
                <span
                  class="min-w-0 break-all font-mono text-sm font-semibold text-foreground"
                >
                  {index + 1}. {item.command}
                </span>
                <span
                  class={item.success
                    ? "text-xs font-semibold text-emerald-700"
                    : "text-xs font-semibold text-rose-700"}
                >
                  {item.success
                    ? t("orchestrationStatusSuccess", "Success")
                    : t("orchestrationStatusFailed", "Failed")}
                </span>
              </div>
              {#if item.output || item.error}
                <OutputBlock>{item.output || item.error}</OutputBlock>
              {/if}
              {#if parsedOutputBlock}
                <ParsedOutputBlock
                  {parsedOutputBlock}
                  onExportExcel={exportStandardParsedOutputItemExcel}
                />
              {/if}
            </article>
          {/each}
        </div>
      {/if}
    </CommandFlowSurface>
  {/if}
</div>
