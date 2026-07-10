<script>
  import * as Card from "$lib/components/ui/card";
  import { callbackHandler } from "../../lib/events.js";
  import LoadingButton from "../../components/fragments/LoadingButton.svelte";
  import PlainSelectField from "../../components/fragments/PlainSelectField.svelte";
  import ReadonlyTextAreaField from "../../components/fragments/ReadonlyTextAreaField.svelte";
  import StatusCard from "../../components/fragments/StatusCard.svelte";
  import { createBuiltinFlowTemplatePanelWorkspace } from "../../modules/templates.js";

  let { onCopy, onLoadBuiltinFlowTemplateDetail, onPickerChange, onSelect } =
    $props();
  function handleCopy(...args) {
    if (typeof onCopy === "function") {
      return onCopy(...args);
    }
  }
  function handleLoadBuiltinFlowTemplateDetail(...args) {
    if (typeof onLoadBuiltinFlowTemplateDetail === "function") {
      return onLoadBuiltinFlowTemplateDetail(...args);
    }
  }
  function forwardPickerChange(...args) {
    if (typeof onPickerChange === "function") {
      return onPickerChange(...args);
    }
  }
  function forwardSelect(...args) {
    if (typeof onSelect === "function") {
      return onSelect(...args);
    }
  }

  const builtinFlowTemplatePanelWorkspace =
    createBuiltinFlowTemplatePanelWorkspace({
      onCopy: handleCopy,
      onLoadBuiltinFlowTemplateDetail: handleLoadBuiltinFlowTemplateDetail,
      onPickerChange: forwardPickerChange,
      onSelect: forwardSelect,
    });
  const { loadingStateStore } = builtinFlowTemplatePanelWorkspace;
  let builtinFlowTemplateLoadingState = $derived($loadingStateStore);
  const {
    contentFieldStateStore,
    headerDisplayStateStore,
    listDisplayStateStore,
    selectFieldStateStore,
  } = builtinFlowTemplatePanelWorkspace;
  let copyLoading = $derived(builtinFlowTemplateLoadingState.copyLoading);
  let detailLoading = $derived(builtinFlowTemplateLoadingState.detailLoading);
  let contentFieldDisplay = $derived($contentFieldStateStore);
  let headerDisplay = $derived($headerDisplayStateStore);
  let listDisplay = $derived($listDisplayStateStore);
  let selectFieldDisplay = $derived($selectFieldStateStore);
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>
      {headerDisplay.title}
    </Card.Title>
  </Card.Header>
  <Card.Content class="grid gap-3">
    <div class="grid gap-2 md:grid-cols-[1fr_auto_auto]">
      <PlainSelectField
        title={selectFieldDisplay.title}
        aria-label={selectFieldDisplay.ariaLabel}
        value={selectFieldDisplay.value}
        optionRows={selectFieldDisplay.optionRows}
        onValueChange={builtinFlowTemplatePanelWorkspace.changePicker}
      />
      <LoadingButton
        variant="outline"
        size="sm"
        loading={detailLoading}
        onclick={builtinFlowTemplatePanelWorkspace.loadDetail}
      >
        <span>{headerDisplay.detailButtonLabel}</span>
      </LoadingButton>
      <LoadingButton
        variant="default"
        size="sm"
        loading={copyLoading}
        onclick={builtinFlowTemplatePanelWorkspace.copyTemplate}
      >
        <span>{headerDisplay.copyButtonLabel}</span>
      </LoadingButton>
    </div>
    <div class="text-xs text-slate-500">
      {headerDisplay.hintText}
    </div>
    <div class="grid gap-2">
      {#if !listDisplay.hasItems}
        <StatusCard
          message={listDisplay.emptyStatus.message}
          tone={listDisplay.emptyStatus.tone}
        />
      {:else}
        {#each listDisplay.flowTemplateRows as flowTemplateRow}
          <button
            type="button"
            class={flowTemplateRow.itemClass}
            onclick={callbackHandler(
              builtinFlowTemplatePanelWorkspace.selectTemplate,
              flowTemplateRow.name,
            )}
          >
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="text-sm font-semibold text-slate-800">
                {flowTemplateRow.nameText}
              </span>
              <span class={flowTemplateRow.badgeClass}>
                {flowTemplateRow.badgeText}
              </span>
            </div>
          </button>
        {/each}
      {/if}
    </div>
    <ReadonlyTextAreaField
      class="min-h-48 font-mono"
      value={contentFieldDisplay.value}
      placeholderText={contentFieldDisplay.placeholderText}
    />
  </Card.Content>
</Card.Root>
