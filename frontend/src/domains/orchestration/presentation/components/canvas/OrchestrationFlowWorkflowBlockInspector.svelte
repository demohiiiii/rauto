<script lang="ts">
  import { Badge } from "$lib/components/ui/badge/index.js";
  import StatusCard from "$components/fragments/StatusCard.svelte";
  import { currentLanguageState, t } from "$lib/i18n.js";
  import {
    txWorkflowVisualEditorBindings,
    txWorkflowVisualEditorDisplay,
  } from "$domains/transactions/index.js";
  import {
    txWorkflowFormModelFromJson,
    txWorkflowFormModelToJsonText,
  } from "$domains/transactions/index.js";
  import type {
    JsonObject,
    TxWorkflowFormModel,
  } from "$domains/transactions/index.js";
  import type { OrchestrationWorkflowPreview } from "$domains/orchestration/index.js";
  import { plainObject } from "$lib/jsonValue.js";
  import TxWorkflowBlockEditor from "$domains/transactions/presentation/components/workflow/TxWorkflowBlockEditor.svelte";

  interface Props {
    blockIndex?: number;
    onWorkflowChange?: ((workflow: JsonObject) => void) | null;
    renderedWorkflow?: JsonObject;
    sourceKind?: OrchestrationWorkflowPreview["sourceKind"];
    workflow?: JsonObject;
  }

  let {
    blockIndex = 0,
    sourceKind = "manual",
    workflow = {},
    renderedWorkflow = {},
    onWorkflowChange,
  }: Props = $props();

  let currentLanguage = $derived($currentLanguageState);
  let workflowFormModel = $derived(txWorkflowFormModelFromJson(workflow));
  let editorDisplay = $derived.by(() => {
    currentLanguage;
    return txWorkflowVisualEditorDisplay(workflowFormModel);
  });
  let blockRow = $derived(
    editorDisplay.blockRows.find((row) => row.blockIndex === blockIndex) ||
      null,
  );
  let workflowBindings = $derived(
    txWorkflowVisualEditorBindings(workflowFormModel, updateWorkflow),
  );
  let renderedBlock = $derived(
    Array.isArray(renderedWorkflow?.blocks)
      ? renderedWorkflow.blocks[blockIndex] || null
      : null,
  );
  let renderedBlockJson = $derived(
    renderedBlock ? JSON.stringify(renderedBlock, null, 2) : "",
  );

  function updateWorkflow(nextWorkflowFormModel: TxWorkflowFormModel): void {
    if (!onWorkflowChange) return;
    const nextWorkflow: unknown = JSON.parse(
      txWorkflowFormModelToJsonText(nextWorkflowFormModel),
    );
    if (plainObject(nextWorkflow)) onWorkflowChange(nextWorkflow);
  }
</script>

{#if sourceKind === "manual" && blockRow}
  <TxWorkflowBlockEditor
    {blockRow}
    {editorDisplay}
    embedded={true}
    blockActionHandlers={workflowBindings.blockBindings(blockIndex)}
    showRemoveAction={false}
  />
{:else if sourceKind === "template" && renderedBlock}
  <div class="grid min-w-0 gap-3">
    <div
      class="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2"
    >
      <span class="text-xs leading-5 text-muted-foreground">
        {t("orchestrationFlowTemplateBlockReadonlyHint")}
      </span>
      <Badge
        variant="outline"
        class="border-amber-500/40 text-amber-700 dark:text-amber-300"
      >
        {t("orchestrationFlowSourceTemplateRender")}
      </Badge>
    </div>
    <pre
      class="max-h-[42rem] min-w-0 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-muted/25 p-3 font-mono text-xs leading-5 text-foreground"><code
        >{renderedBlockJson}</code
      ></pre>
  </div>
{:else}
  <StatusCard message={t("orchestrationFlowBlockUnavailableHint")} />
{/if}
