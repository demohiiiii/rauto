<script lang="ts">
  import ReadonlyFields from "$components/fragments/ReadonlyFields.svelte";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import Settings2Icon from "@lucide/svelte/icons/settings-2";
  import { Separator } from "$lib/components/ui/separator/index.js";
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
  import TxBlockRootSettingsEditor from "$domains/transactions/presentation/components/block/TxBlockRootSettingsEditor.svelte";

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

<details
  data-tx-block-settings
  class="group/block-settings min-w-0 rounded-xl border border-border bg-card"
>
  <summary
    class="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden"
  >
    <Settings2Icon class="size-4 text-primary" />
    {t("txBlockInspectorRootTitle")}
    <ChevronRightIcon
      class="ml-auto size-4 text-muted-foreground transition-transform group-open/block-settings:rotate-90 motion-reduce:transition-none"
    />
  </summary>
  <div class="grid min-w-0 gap-4 border-t border-border p-3">
    {#if stepsErrorText}
      <p class="text-xs text-destructive" role="alert">{stepsErrorText}</p>
    {/if}
    <ReadonlyFields>
      <TxBlockRootSettingsEditor
        fieldRows={rootPanel.fieldRows}
        onValueChange={editorActionHandlers.rootValueHandler}
        onPresenceChange={editorActionHandlers.rootPresenceHandler}
      />
    </ReadonlyFields>

    <Separator />

    <TxBlockRollbackPolicyEditor
      {editorDisplay}
      jsonValueTypeRows={editorDisplay.jsonValueTypeRows}
      rollbackKindRows={editorDisplay.rollbackKindRows}
      rollbackKindValue={rollbackPanel.rollbackKindValue}
      showWholeResource={rollbackPanel.showWholeResource}
      wholeResourceFieldRows={rollbackPanel.wholeResourceFieldRows}
      wholeResourceExtra={rollbackPanel.wholeResourceExtra}
      wholeResourceRollback={rollbackPanel.wholeResourceRollback}
      onRollbackKindChange={editorActionHandlers.rollbackKindValueHandler()}
      onWholeResourceFieldInput={editorActionHandlers.wholeFieldValueHandler}
      onWholeResourceFieldPresenceChange={editorActionHandlers.wholeFieldPresenceHandler}
      onWholeResourceExtraChange={editorActionHandlers.setWholeResourceExtra}
      onWholeResourceRollbackChange={editorActionHandlers.setWholeResourceRollback}
      {validationErrors}
      pathPrefix={`${pathPrefix ? `${pathPrefix}.` : ""}rollbackPolicy.wholeResource`}
    />
  </div>
</details>
