<script lang="ts">
  import ReadonlyFields from "$components/fragments/ReadonlyFields.svelte";
  import TerminalIcon from "@lucide/svelte/icons/terminal";
  import Undo2Icon from "@lucide/svelte/icons/undo-2";
  import PlainCheckboxField from "$components/fragments/PlainCheckboxField.svelte";
  import { t } from "$lib/i18n.js";
  import TxBlockOperationEditor from "$domains/transactions/presentation/components/block/TxBlockOperationEditor.svelte";
  import type {
    txBlockVisualEditorDisplay,
    TxBlockStepChangeHandler,
    TxMetadataFieldDefinition,
    TxOperationModel,
    TxStepFormModel,
    TxValidationError,
  } from "$domains/transactions/index.js";

  interface Props {
    editorDisplay: ReturnType<typeof txBlockVisualEditorDisplay>;
    onRollbackChange?: (operation: TxOperationModel | null) => void;
    onRollbackEnabledChange?: (enabled: boolean) => void;
    onRunChange?: (operation: TxOperationModel) => void;
    onStepChange?: TxBlockStepChangeHandler;
    pathPrefix?: string;
    perStepRollbackEnabled?: boolean;
    rollbackCommandMetadataFieldDefs?: readonly TxMetadataFieldDefinition[];
    runCommandMetadataFieldDefs?: readonly TxMetadataFieldDefinition[];
    step: TxStepFormModel;
    validationErrors?: readonly TxValidationError[];
  }

  let {
    step,
    editorDisplay,
    runCommandMetadataFieldDefs = [],
    rollbackCommandMetadataFieldDefs = [],
    perStepRollbackEnabled = false,
    onRunChange,
    onRollbackChange,
    onRollbackEnabledChange,
    onStepChange,
    validationErrors = [],
    pathPrefix = "",
  }: Props = $props();

  let rollbackEnabled = $derived(!!step.rollback);
</script>

{#snippet operationHeader(rollback: boolean)}
  <header
    class="mb-4 flex min-h-11 items-center justify-between gap-3 border-b border-border/70 pb-3"
  >
    <h3
      class="flex min-w-0 items-center gap-2.5 text-sm font-semibold text-foreground"
    >
      <span
        class={rollback
          ? "flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground"
          : "flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"}
      >
        {#if rollback}<Undo2Icon class="size-4" aria-hidden="true" />
        {:else}<TerminalIcon class="size-4" aria-hidden="true" />{/if}
      </span>
      {t(rollback ? "txBlockStepRollbackCommand" : "txBlockStepRunCommand")}
    </h3>
    {#if rollback}
      <ReadonlyFields>
        <PlainCheckboxField
          controlKind="switch"
          checked={rollbackEnabled}
          aria-label={t("txBlockFormEnableStepRollback")}
          title={t("txBlockFormEnableStepRollback")}
          onCheckedChange={onRollbackEnabledChange}
        />
      </ReadonlyFields>
    {/if}
  </header>
{/snippet}

<div class="tx-step-editor min-w-0">
  <div
    class="step-operations grid min-w-0 overflow-hidden rounded-lg border border-border/80 bg-background"
    data-per-step-rollback={perStepRollbackEnabled}
  >
    <section class="min-w-0 p-4" aria-label={t("txBlockStepRunCommand")}>
      {@render operationHeader(false)}
      <TxBlockOperationEditor
        operation={step.run}
        title={t("txBlockStepRunCommand")}
        showTitle={false}
        {editorDisplay}
        commandMetadataFieldDefs={runCommandMetadataFieldDefs}
        onChange={onRunChange}
        {validationErrors}
        pathPrefix={`${pathPrefix}.run`}
      />
    </section>
    {#if perStepRollbackEnabled}
      <section
        class="rollback-pane flex min-w-0 flex-col border-t border-border/80 bg-muted/15 p-4"
        aria-label={t("txBlockStepRollbackCommand")}
      >
        {@render operationHeader(true)}
        {#if rollbackEnabled && step.rollback}
          <TxBlockOperationEditor
            operation={step.rollback}
            title={t("txBlockStepRollbackCommand")}
            showTitle={false}
            {editorDisplay}
            commandMetadataFieldDefs={rollbackCommandMetadataFieldDefs}
            onChange={onRollbackChange}
            {validationErrors}
            pathPrefix={`${pathPrefix}.rollback`}
          />
          <ReadonlyFields class="mt-4 border-t border-border/70 pt-3">
            <PlainCheckboxField
              class="w-full flex-row-reverse justify-between gap-3"
              controlKind="switch"
              checked={step.rollbackOnFailure}
              labelText={t("txBlockFormRollbackOnFailure")}
              textClass="min-w-0 text-xs text-muted-foreground"
              onCheckedChange={(rollbackOnFailure) =>
                onStepChange?.({
                  rollbackOnFailure,
                  hasRollbackOnFailure: true,
                })}
            />
          </ReadonlyFields>
        {:else}
          <div
            class="flex min-h-64 flex-1 flex-col items-center justify-center gap-3 text-muted-foreground"
          >
            <span
              class="flex size-11 items-center justify-center rounded-lg border border-dashed border-border bg-background/70"
            >
              <Undo2Icon class="size-5" aria-hidden="true" />
            </span>
            <p class="text-xs">{t("txBlockStepRollbackDisabled")}</p>
          </div>
        {/if}
      </section>
    {/if}
  </div>
</div>

<style>
  .tx-step-editor {
    container-type: inline-size;
  }

  @container (min-width: 42rem) {
    .step-operations[data-per-step-rollback="true"] {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .rollback-pane {
      border-top: 0;
      border-left: 1px solid var(--border);
    }
  }
</style>
