<script lang="ts">
  import { t } from "$lib/i18n.js";
  import {
    txBlockCommandDraft,
    txBlockValidationErrorText,
    type TxCommandModel,
    type TxOperationModel,
    type TxValidationError,
  } from "$domains/transactions/index.js";
  import TxBlockCommandEditor from "./TxBlockCommandEditor.svelte";

  let {
    operation,
    onChange,
    jsonValueTypeRows,
    validationErrors = [],
    pathPrefix = "",
  }: {
    operation: TxOperationModel;
    onChange?: (operation: TxOperationModel) => void;
    jsonValueTypeRows: readonly string[];
    validationErrors?: readonly TxValidationError[];
    pathPrefix?: string;
  } = $props();

  // Keep every command in previously saved operations editable without creating new sequences.
  let commands = $derived(
    operation.flow.steps.length
      ? operation.flow.steps
      : [txBlockCommandDraft()],
  );
  let errorText = $derived(
    txBlockValidationErrorText(validationErrors, `${pathPrefix}.steps`),
  );

  function changeCommand(index: number, patch: Partial<TxCommandModel>): void {
    onChange?.({
      ...operation,
      flow: {
        ...operation.flow,
        steps: commands.map((command, commandIndex) =>
          commandIndex === index ? { ...command, ...patch } : command,
        ),
      },
    });
  }
</script>

<div class="grid min-w-0 gap-4">
  {#if errorText}<p class="text-xs text-destructive" role="alert">
      {errorText}
    </p>{/if}
  {#each commands as command, index (index)}
    {#if commands.length > 1}
      <h4 class="text-sm font-medium">
        {t("txBlockOperationKindInteractive")}
        {index + 1}
      </h4>
    {/if}
    <TxBlockCommandEditor
      {command}
      interactive={true}
      {jsonValueTypeRows}
      {validationErrors}
      pathPrefix={`${pathPrefix}.steps[${index}]`}
      onChange={(patch) => changeCommand(index, patch)}
    />
  {/each}
</div>
