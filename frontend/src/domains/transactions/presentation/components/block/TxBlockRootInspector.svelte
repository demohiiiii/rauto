<script lang="ts">
  import ReadonlyFields from "$components/fragments/ReadonlyFields.svelte";
  import PresenceFieldGrid from "$components/fragments/PresenceFieldGrid.svelte";
  import StringSelectField from "$components/fragments/StringSelectField.svelte";
  import { t } from "$lib/i18n.js";
  import { txBlockValidationErrorText } from "$domains/transactions/index.js";
  import type {
    txBlockRollbackPolicyPanelDisplay,
    txBlockRootPanelDisplay,
    txBlockVisualEditorBindings,
    txBlockVisualEditorDisplay,
    TxValidationError,
  } from "$domains/transactions/index.js";
  import TxBlockRollbackPolicyEditor from "$domains/transactions/presentation/components/block/TxBlockRollbackPolicyEditor.svelte";

  interface Props {
    editorActionHandlers: ReturnType<typeof txBlockVisualEditorBindings>;
    editorDisplay: ReturnType<typeof txBlockVisualEditorDisplay>;
    pathPrefix?: string;
    rollbackPanel: ReturnType<typeof txBlockRollbackPolicyPanelDisplay>;
    rootPanel: ReturnType<typeof txBlockRootPanelDisplay>;
    validationErrors?: readonly TxValidationError[];
  }

  let {
    editorDisplay,
    editorActionHandlers,
    rootPanel,
    rollbackPanel,
    validationErrors = [],
    pathPrefix = "",
  }: Props = $props();
  let stepsErrorText = $derived(
    txBlockValidationErrorText(
      validationErrors,
      pathPrefix ? `${pathPrefix}.steps` : "steps",
    ),
  );
</script>

<section
  data-tx-block-settings
  aria-label={t("txBlockInspectorRootTitle")}
  class="block-settings grid min-w-0 gap-3"
>
  {#if stepsErrorText}
    <p class="text-xs text-destructive" role="alert">{stepsErrorText}</p>
  {/if}
  <ReadonlyFields class="block-settings-fields grid min-w-0 gap-3">
    <PresenceFieldGrid
      fieldRows={rootPanel.fieldRows}
      valueHandlerMode="event"
      hostClass="contents"
      itemClass="min-w-0"
      presenceControlsMode="hidden"
      onValueChangeForKey={editorActionHandlers.rootValueHandler}
      onPresenceChangeForKey={editorActionHandlers.rootPresenceHandler}
    />
    <label class="flex min-w-0 flex-col gap-2">
      <span class="mb-1 text-sm font-medium text-foreground">
        {t("txBlockFormRollbackPolicy")}
      </span>
      <StringSelectField
        aria-label={t("txBlockFormRollbackPolicy")}
        value={rollbackPanel.rollbackKindValue}
        optionValues={[...editorDisplay.rollbackKindRows]}
        onChange={editorActionHandlers.rollbackKindValueHandler()}
      />
    </label>
  </ReadonlyFields>
  {#if rollbackPanel.showWholeResource}
    <TxBlockRollbackPolicyEditor
      {editorDisplay}
      jsonValueTypeRows={editorDisplay.jsonValueTypeRows}
      wholeResourceFieldRows={rollbackPanel.wholeResourceFieldRows}
      wholeResourceExtra={rollbackPanel.wholeResourceExtra}
      wholeResourceRollback={rollbackPanel.wholeResourceRollback}
      onWholeResourceFieldInput={editorActionHandlers.wholeFieldValueHandler}
      onWholeResourceFieldPresenceChange={editorActionHandlers.wholeFieldPresenceHandler}
      onWholeResourceExtraChange={editorActionHandlers.setWholeResourceExtra}
      onWholeResourceRollbackChange={editorActionHandlers.setWholeResourceRollback}
      {validationErrors}
      pathPrefix={`${pathPrefix ? `${pathPrefix}.` : ""}rollbackPolicy.wholeResource`}
    />
  {/if}
</section>

<style>
  .block-settings {
    container: block-settings / inline-size;
  }

  @container block-settings (min-width: 32rem) {
    :global(.block-settings-fields) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>
