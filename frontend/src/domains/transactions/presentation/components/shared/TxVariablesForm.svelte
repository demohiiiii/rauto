<script lang="ts">
  import BracesIcon from "@lucide/svelte/icons/braces";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import Maximize2Icon from "@lucide/svelte/icons/maximize-2";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Switch } from "$lib/components/ui/switch/index.js";
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import PlainInputField from "$components/fragments/PlainInputField.svelte";
  import TypeValueSelectField from "$components/fragments/TypeValueSelectField.svelte";
  import TxVariablesJsonEditor from "./TxVariablesJsonEditor.svelte";
  import { currentLanguageState, t } from "$lib/i18n.js";
  import { createTxVarsAssistantCardWorkspace } from "../../../application/transactionVarsAssistant.js";
  import { runtimeVariablesJsonState } from "../../../model/runtimeVariablesJson.js";

  let { active = true, prefix }: { active?: boolean; prefix: string } =
    $props();
  const workspace = createTxVarsAssistantCardWorkspace({
    getPrefix: () => prefix,
  });
  const { assistantActionsStateStore, assistantDisplayStateStore } = workspace;
  let actions = $derived($assistantActionsStateStore);
  let display = $derived($assistantDisplayStateStore);
  let valueDraft = $state<{
    entryId: string;
    originalText: string;
    text: string;
  } | null>(null);
  let editedEntry = $derived(
    display.assistantEntryInputRows.find(
      (row) => row.entryId === valueDraft?.entryId,
    ),
  );
  let valueConflict = $derived(
    !!valueDraft &&
      (!editedEntry ||
        editedEntry.typeValue !== "json" ||
        editedEntry.valueText !== valueDraft.originalText),
  );
  let valueError = $derived.by(() => {
    $currentLanguageState;
    if (!valueDraft) return "";
    if (valueConflict) return t("txVarsValueChanged");
    return runtimeVariablesJsonState(valueDraft.text).error?.message || "";
  });
  $effect(() => workspace.setAssistantCardContext({ active, prefix }));
  $effect(() => {
    if (!active) valueDraft = null;
  });

  function label(key: string): string {
    $currentLanguageState;
    return t(key);
  }
  function editValue(entryId: string, text: string): void {
    valueDraft = { entryId, originalText: text, text: text || "{}" };
  }
  function saveValue(): void {
    if (!valueDraft || valueError) return;
    actions.updateEntryJsonValue(valueDraft.entryId)(valueDraft.text);
    valueDraft = null;
  }
</script>

<div class="vars-form" data-vars-form>
  {#if display.hasAssistantEntries}
    <div
      class="vars-columns text-[10px] font-medium text-muted-foreground"
      aria-hidden="true"
    >
      <span>{label("txVarsNameLabel")}</span>
      <span>{label("txVarsTypeLabel")}</span>
      <span>{label("txVarsValueLabel")}</span>
    </div>
    <div class="divide-y divide-border/60">
      {#each display.assistantEntryInputRows as row (row.entryId)}
        <div
          class="vars-row transition-colors focus-within:bg-primary/[0.025]"
          data-vars-row
        >
          <div class="vars-name min-w-0">
            <PlainInputField
              class="h-8 border-transparent bg-transparent font-mono text-xs shadow-none hover:border-border dark:bg-transparent"
              value={row.keyValue}
              aria-label={label("txVarsNameLabel")}
              placeholderText={row.keyPlaceholder}
              autocomplete="off"
              onValueInput={actions.updateEntryKey(row.entryId)}
            />
          </div>
          <div class="vars-type min-w-0">
            <TypeValueSelectField
              class="h-8 border-transparent bg-muted/40 text-xs shadow-none hover:border-border dark:bg-muted/30"
              aria-label={label("txVarsTypeLabel")}
              value={row.typeValue}
              optionRows={row.typeOptionRows}
              onChange={actions.updateEntryType(row.entryId)}
            />
          </div>
          <div class="vars-value min-w-0">
            {#if row.showJsonEditor}
              <button
                type="button"
                class="group flex h-8 w-full min-w-0 items-center gap-2 rounded-md border border-transparent px-2.5 text-left transition-colors hover:border-primary/20 hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                aria-label={`${label("txVarsEditValue")} ${row.keyValue}`}
                onclick={() => editValue(row.entryId, row.valueText)}
              >
                <BracesIcon class="size-3.5 shrink-0 text-primary" />
                <code class="min-w-0 flex-1 truncate text-xs"
                  >{row.valuePreview}</code
                >
                <Maximize2Icon
                  class="size-3 shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
                />
              </button>
            {:else if row.typeValue === "null"}
              <div
                class="flex h-8 items-center px-2.5 font-mono text-xs text-muted-foreground"
                aria-label={label("txVarsValueLabel")}
              >
                null
              </div>
            {:else if row.typeValue === "boolean" && row.booleanValue !== null}
              <div class="flex h-8 items-center gap-2.5 px-2.5">
                <Switch
                  size="sm"
                  checked={row.booleanValue}
                  aria-label={`${label("txVarsValueLabel")} ${row.keyValue}`}
                  onCheckedChange={(checked) =>
                    actions.updateEntryValue(row.entryId)(String(checked))}
                />
                <span class="font-mono text-xs text-muted-foreground"
                  >{String(row.booleanValue)}</span
                >
              </div>
            {:else}
              <PlainInputField
                class="h-8 border-transparent bg-transparent font-mono text-xs shadow-none hover:border-border dark:bg-transparent"
                value={row.valueText}
                aria-label={label("txVarsValueLabel")}
                placeholderText={row.placeholder ||
                  label("txVarsValuePlaceholder")}
                onValueInput={actions.updateEntryValue(row.entryId)}
              />
            {/if}
          </div>
          <div class="vars-remove">
            <Button
              class="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              variant="ghost"
              size="icon-xs"
              aria-label={`${row.removeButtonLabel} ${row.keyValue}`}
              title={row.removeButtonLabel}
              onclick={actions.removeEntryAction(row.entryId)}
              ><Trash2Icon class="size-3.5" /></Button
            >
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <div class="flex items-center gap-3 px-4 py-5">
      <span
        class="flex size-9 shrink-0 items-center justify-center rounded-xl border border-dashed border-primary/25 bg-primary/5 text-primary"
        ><BracesIcon class="size-4" /></span
      >
      <p class="text-xs leading-5 text-muted-foreground">{display.hintText}</p>
    </div>
  {/if}
  <div
    class="flex items-center justify-between gap-2 border-t border-border/60 bg-muted/10 px-2 py-1.5"
  >
    <Button
      variant="ghost"
      size="sm"
      class="text-xs text-primary hover:bg-primary/5 hover:text-primary"
      onclick={actions.addEntry}
    >
      <PlusIcon class="size-3.5" />{display.addButtonLabel}
    </Button>
    {#if display.hasAssistantEntries}
      <Button
        variant="ghost"
        size="sm"
        class="text-xs text-muted-foreground"
        onclick={actions.clearEntries}>{display.clearButtonLabel}</Button
      >
    {/if}
  </div>
</div>

<Dialog.Root
  open={!!valueDraft}
  onOpenChange={(open) => {
    if (!open) valueDraft = null;
  }}
>
  <Dialog.Content
    class="flex h-[min(76dvh,38rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
  >
    <Dialog.Header class="border-b border-border/70 px-5 py-4 pr-14 text-left">
      <Dialog.Title class="flex items-center gap-2 text-sm"
        ><BracesIcon class="size-4 text-primary" />{label(
          "txVarsEditValue",
        )}</Dialog.Title
      >
      <Dialog.Description class="truncate font-mono text-xs"
        >{editedEntry?.keyValue || label("txVarsNameLabel")}</Dialog.Description
      >
    </Dialog.Header>
    <div class="min-h-0 flex-1 p-3">
      <TxVariablesJsonEditor
        active={active && !!valueDraft}
        fill
        readonly={valueConflict}
        error={valueConflict ? label("txVarsValueChanged") : ""}
        aria-label={label("txVarsValueLabel")}
        value={valueDraft?.text || ""}
        onChange={(text) => {
          if (valueDraft) valueDraft = { ...valueDraft, text };
        }}
      />
    </div>
    <Dialog.Footer class="border-t border-border/70 bg-muted/15 px-4 py-3">
      <Button
        variant="outline"
        size="sm"
        onclick={() => {
          valueDraft = null;
        }}>{label("cancelBtn")}</Button
      >
      <Button size="sm" disabled={!!valueError} onclick={saveValue}
        >{label("txVarsApplyValue")}</Button
      >
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<style>
  .vars-form {
    container-type: inline-size;
    min-width: 0;
  }
  .vars-columns {
    display: none;
  }
  .vars-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 6.25rem 1.75rem;
    align-items: center;
    gap: 0.25rem 0.5rem;
    padding: 0.5rem;
  }
  .vars-name {
    grid-column: 1;
    grid-row: 1;
  }
  .vars-type {
    grid-column: 2;
    grid-row: 1;
  }
  .vars-value {
    grid-column: 1 / 3;
    grid-row: 2;
  }
  .vars-remove {
    grid-column: 3;
    grid-row: 1;
  }
  @container (min-width: 38rem) {
    .vars-columns,
    .vars-row {
      grid-template-columns: minmax(0, 0.85fr) 6.25rem minmax(0, 1.4fr) 1.75rem;
    }
    .vars-columns {
      display: grid;
      gap: 0.5rem;
      border-bottom: 1px solid var(--border);
      padding: 0.5rem;
      background: color-mix(in oklab, var(--muted) 12%, transparent);
    }
    .vars-columns span {
      padding-inline: 0.625rem;
    }
    .vars-name,
    .vars-type,
    .vars-value,
    .vars-remove {
      grid-column: auto;
      grid-row: auto;
    }
  }
</style>
