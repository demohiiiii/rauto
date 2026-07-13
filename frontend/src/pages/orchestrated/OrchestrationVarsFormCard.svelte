<script>
  import { Button } from "$lib/components/ui/button/index.js";
  import PlainInputField from "../../components/fragments/PlainInputField.svelte";
  import TextAreaField from "../../components/fragments/TextAreaField.svelte";
  import TypeValueSelectField from "../../components/fragments/TypeValueSelectField.svelte";
  import { createTxVarsAssistantCardWorkspace } from "../../modules/transactionPanelState.js";

  let { active, prefix } = $props();
  const txVarsAssistantCardWorkspace = createTxVarsAssistantCardWorkspace({
    getPrefix: () => prefix,
  });
  const {
    assistantActionsStateStore,
    assistantDisplayStateStore,
    setAssistantCardContext,
  } = txVarsAssistantCardWorkspace;
  let assistantActions = $derived($assistantActionsStateStore);
  let assistantDisplay = $derived($assistantDisplayStateStore);

  $effect(() => {
    setAssistantCardContext({ active, prefix });
  });
</script>

<div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
  <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
    <div class="text-sm font-semibold text-slate-700">
      {assistantDisplay.title}
    </div>
    <div class="inline-flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        type="button"
        onclick={assistantActions.addEntry}
      >
        {assistantDisplay.addButtonLabel}
      </Button>
      <Button
        variant="outline"
        size="sm"
        type="button"
        onclick={assistantActions.clearEntries}
      >
        {assistantDisplay.clearButtonLabel}
      </Button>
    </div>
  </div>
  <div class="grid gap-2">
    {#if !assistantDisplay.hasAssistantEntries}
      <div
        class="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-500"
      >
        {assistantDisplay.hintText}
      </div>
    {:else}
      {#each assistantDisplay.assistantEntryInputRows as assistantEntryInput (assistantEntryInput.entryId)}
        <div class="rounded-xl border border-slate-200 bg-white px-3 py-3">
          <div
            class="grid gap-2 md:grid-cols-[1fr_140px_1fr_auto] md:items-start"
          >
            <PlainInputField
              value={assistantEntryInput.keyValue}
              aria-label={assistantEntryInput.keyPlaceholder}
              placeholderText={assistantEntryInput.keyPlaceholder}
              onValueInput={assistantActions.updateEntryKey(
                assistantEntryInput.entryId,
              )}
            />
            <TypeValueSelectField
              aria-label={assistantDisplay.title}
              value={assistantEntryInput.typeValue}
              optionRows={assistantEntryInput.typeOptionRows}
              onChange={assistantActions.updateEntryType(
                assistantEntryInput.entryId,
              )}
            />
            {#if assistantEntryInput.controlKind === "json-editor"}
              <TextAreaField
                editorKind="json"
                class="min-h-20"
                showLabel={false}
                aria-label={assistantDisplay.title}
                value={assistantEntryInput.valueText}
                onChange={assistantActions.updateEntryJsonValue(
                  assistantEntryInput.entryId,
                )}
              />
            {:else}
              <PlainInputField
                value={assistantEntryInput.valueText}
                aria-label={assistantDisplay.title}
                placeholderText={assistantEntryInput.placeholder}
                onValueInput={assistantActions.updateEntryValue(
                  assistantEntryInput.entryId,
                )}
              />
            {/if}
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onclick={assistantActions.removeEntryAction(
                assistantEntryInput.entryId,
              )}
            >
              {assistantEntryInput.removeButtonLabel}
            </Button>
          </div>
        </div>
      {/each}
    {/if}
  </div>
</div>
