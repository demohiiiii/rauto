<script lang="ts">
  import { ConnectionPickerField } from "$domains/connections/presentation/components/fields/index.js";
  import DetailFieldCard from "$components/fragments/DetailFieldCard.svelte";
  import ModeExpressionField from "$components/fragments/ModeExpressionField.svelte";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";

  import { currentLanguageState, t } from "$lib/i18n.js";
  import { safeString } from "$lib/ui.js";
  import type {
    ShowCommandPreviewRow,
    ShowObjectSelectionDisplay,
  } from "../../model/types.js";

  interface ShowSelectionFields {
    mode: string;
    modeOptions: string[];
    objectPickerKey: string;
    previewRows: ShowCommandPreviewRow[];
    showResolvedCommandDetails: boolean;
  }

  interface Props {
    onModeChange: (mode: string) => unknown;
    onObjectChange: () => unknown;
    selectionDisplay: ShowObjectSelectionDisplay;
    showSelectionFields: ShowSelectionFields;
  }

  let {
    onModeChange,
    onObjectChange,
    selectionDisplay,
    showSelectionFields,
  }: Props = $props();
  let i18nCurrentLanguage = $derived($currentLanguageState);
  let i18nModeLabel = $derived.by(() => {
    i18nCurrentLanguage;
    return t("showModeFieldLabel");
  });
</script>

{#snippet previewField(label: string, detailValue: unknown, mono = false)}
  <DetailFieldCard
    detailValue={safeString(detailValue)}
    {label}
    {mono}
    variant="inline"
    class="text-muted-foreground"
    labelClass="text-muted-foreground/70"
    valueClass={mono
      ? "break-all font-mono font-medium text-foreground"
      : "break-all font-medium text-foreground"}
  />
{/snippet}

<div class="flex flex-col gap-6">
  <div class="grid items-start gap-4">
    <ConnectionPickerField
      keyName={showSelectionFields.objectPickerKey}
      labelText={selectionDisplay.objectLabel}
      onSelectionChange={onObjectChange}
      pickerPlaceholder={selectionDisplay.objectPlaceholder}
      selectedItemClass="border-primary/25 bg-primary/10 text-primary"
      selectedRemoveButtonClass="text-primary/70 transition hover:bg-primary/15 hover:text-primary"
    />
    <div class="grid min-w-0 gap-1.5">
      <span
        class="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
      >
        {i18nModeLabel}
      </span>
      <ModeExpressionField
        class="w-full"
        title={selectionDisplay.modePlaceholder}
        aria-label={selectionDisplay.modePlaceholder}
        value={showSelectionFields.mode}
        optionValues={showSelectionFields.modeOptions}
        placeholderText={selectionDisplay.modePlaceholder}
        onChange={undefined}
        onInput={undefined}
        onValueChange={onModeChange}
        onValueInput={undefined}
      />
    </div>
  </div>

  {#if showSelectionFields.showResolvedCommandDetails}
    <div class="rounded-2xl border border-border bg-muted/30 p-4">
      <div class="mb-3 text-sm font-medium text-foreground">
        {selectionDisplay.previewTitle}
      </div>
      {#if showSelectionFields.previewRows.length}
        <div class="flex flex-col gap-2">
          {#each showSelectionFields.previewRows as previewRow}
            <details
              class="group rounded-xl border border-border bg-card transition-colors open:border-primary/30 hover:border-primary/30"
            >
              <summary
                class="flex cursor-pointer list-none items-center gap-3 px-3 py-2.5 [&::-webkit-details-marker]:hidden"
              >
                <ChevronRightIcon
                  class="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
                />
                <span
                  class="min-w-0 truncate font-mono text-sm font-semibold text-foreground"
                >
                  {previewRow.objectName}
                </span>
                <Badge variant="outline" class="shrink-0 text-[11px]">
                  {previewRow.fields.mode}
                </Badge>
                <Badge
                  variant="secondary"
                  class="ml-auto max-w-[52%] truncate font-mono"
                >
                  {previewRow.commandText}
                </Badge>
              </summary>
              <div
                class="grid gap-x-6 gap-y-2 border-t border-border px-3 py-3 pl-10 sm:grid-cols-2"
              >
                {@render previewField(
                  selectionDisplay.sourceLabel,
                  previewRow.fields.source,
                )}
                {@render previewField(
                  selectionDisplay.platformLabel,
                  previewRow.fields.platform,
                )}
                {@render previewField(
                  selectionDisplay.modePlaceholder,
                  previewRow.fields.mode,
                )}
                {@render previewField(
                  selectionDisplay.mappingLabel,
                  previewRow.fields.mapping,
                  true,
                )}
                {@render previewField(
                  selectionDisplay.textfsmLabel,
                  previewRow.fields.textfsm,
                  true,
                )}
                <div class="sm:col-span-2">
                  {@render previewField(
                    selectionDisplay.commandLabel,
                    previewRow.fields.command,
                    true,
                  )}
                </div>
              </div>
            </details>
          {/each}
        </div>
      {:else}
        <div class="text-xs text-muted-foreground">
          {selectionDisplay.previewEmptyText}
        </div>
      {/if}
    </div>
  {/if}
</div>
