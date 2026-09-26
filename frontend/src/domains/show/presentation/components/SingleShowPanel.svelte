<script lang="ts">
  import ExecutionRunBar from "$components/fragments/ExecutionRunBar.svelte";
  import SessionRetryFields from "$components/fragments/SessionRetryFields.svelte";
  import TextfsmControls from "$components/fragments/TextfsmControls.svelte";
  import { currentLanguageState, t } from "$lib/i18n.js";
  import { createSingleShowPanelWorkspace } from "../../application/createShowWorkspaces.js";
  import ShowObjectSelectionPanel from "./ShowObjectSelectionPanel.svelte";

  let { active }: { active: boolean } = $props();
  const workspace = createSingleShowPanelWorkspace();
  const {
    changeShowObject,
    changeShowObjectMode,
    changeSessionRetry,
    executeSingleShow,
    panelDisplayStateStore,
    selectionDisplayStateStore,
    setPanelContext,
    textfsmActionHandlers,
  } = workspace;
  let singleShowPanelDisplay = $derived($panelDisplayStateStore);
  let selectionDisplay = $derived($selectionDisplayStateStore);
  let showSelectionFields = $derived(singleShowPanelDisplay.selectionFields);
  let showTextfsmFields = $derived(singleShowPanelDisplay.textfsmFields);
  let showRunButtonDisplay = $derived(singleShowPanelDisplay.runButtonDisplay);
  let retryState = $derived(singleShowPanelDisplay.retryState);
  let i18nLabels = $derived.by(() => {
    $currentLanguageState;
    return {
      runTitle: t("showPanelConfigTitle"),
      footerHint: t("showFooterHint"),
    };
  });
  $effect(() =>
    setPanelContext({ active, panelDisplay: singleShowPanelDisplay }),
  );
</script>

<div class="flex min-w-0 flex-col gap-5 p-4 sm:p-5" hidden={!active}>
  <ShowObjectSelectionPanel
    onModeChange={changeShowObjectMode}
    onObjectChange={changeShowObject}
    {selectionDisplay}
    {showSelectionFields}
  />

  {#if active}
    <TextfsmControls
      hintKey="textfsmParseHint"
      includeTemplateInput={false}
      onEnabledChange={textfsmActionHandlers.enabledChange}
      onAutoDownloadExcelChange={textfsmActionHandlers.autoDownloadExcelChange}
      onStrictErrorsChange={textfsmActionHandlers.strictErrorsChange}
      textfsmFields={showTextfsmFields}
    />
  {/if}

  <SessionRetryFields
    idPrefix="single-show-session-retry"
    value={retryState}
    onChange={changeSessionRetry}
  />

  <ExecutionRunBar
    docked={true}
    {active}
    autoDownloadOutput={showTextfsmFields.autoDownloadOutput}
    onAutoDownloadOutputChange={textfsmActionHandlers.autoDownloadOutputChange}
    title={i18nLabels.runTitle}
    hint={i18nLabels.footerHint}
    buttonLabel={showRunButtonDisplay.executeButtonLabel}
    loading={showRunButtonDisplay.executeLoading}
    disabled={!singleShowPanelDisplay.retryValid}
    onRun={executeSingleShow}
  />
</div>
