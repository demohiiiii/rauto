<script>
  import { Skeleton } from "$lib/components/ui/skeleton/index.js";
  import DashboardTabPanel from "../components/layout/DashboardTabPanel.svelte";
  import { afterDomUpdate } from "../lib/svelte.js";
  import { createOrchestratedPageWorkspace } from "../modules/orchestration/orchestrationPanelState.js";

  let { active } = $props();
  const stageDefinitions = [
    { id: "block", load: () => import("./orchestrated/TxBlockStage.svelte") },
    {
      id: "workflow",
      load: () => import("./orchestrated/TxWorkflowStage.svelte"),
    },
    {
      id: "orchestrate",
      load: () => import("./orchestrated/OrchestrationStage.svelte"),
    },
  ];

  const {
    activeStageComponentStateStore,
    createTxBlockJsonTemplateDraft,
    createTxWorkflowJsonTemplateDraft,
    destroy: destroyOrchestratedWorkspace,
    executeOrchestration,
    executeTxWorkflow,
    importOrchestrationFile,
    importTxBlockFile,
    importTxWorkflowFile,
    loadTxBlockJsonTemplate,
    loadTxWorkflowJsonTemplate,
    previewTxWorkflow,
    runTxBlockExecute,
    saveTxBlockJsonTemplate,
    saveTxWorkflowJsonTemplate,
    setPageContext,
    stageDisplayStateStore,
    updateOrchestrationEditorInput,
    updateTxBlockEditorInput,
    updateTxWorkflowEditorInput,
  } = createOrchestratedPageWorkspace({
    afterDomUpdate,
    stageDefinitions,
  });
  let txBlockStageProps = $derived({
    active: true,
    newButtonLabelKey: stageDisplay.newButtonLabelKey,
    onCreateJsonTemplateDraft: createTxBlockJsonTemplateDraft,
    onExecute: runTxBlockExecute,
    onEditorInput: updateTxBlockEditorInput,
    onImportFile: importTxBlockFile,
    onLoadJsonTemplate: loadTxBlockJsonTemplate,
    onSaveJsonTemplate: saveTxBlockJsonTemplate,
  });
  let txWorkflowStageProps = $derived({
    active: true,
    jsonNewLoading: false,
    onCreateDirectDraft: null,
    onCreateJsonTemplateDraft: createTxWorkflowJsonTemplateDraft,
    onEditorInput: updateTxWorkflowEditorInput,
    onExecute: executeTxWorkflow,
    onImportFile: importTxWorkflowFile,
    onLoadJsonTemplate: loadTxWorkflowJsonTemplate,
    onPreview: previewTxWorkflow,
    onSaveJsonTemplate: saveTxWorkflowJsonTemplate,
  });
  let orchestrationStageProps = $derived({
    active: true,
    onEditorInput: updateOrchestrationEditorInput,
    onExecute: executeOrchestration,
    onImportFile: importOrchestrationFile,
  });
  let stageDisplay = $derived($stageDisplayStateStore);
  let activeStageComponent = $derived($activeStageComponentStateStore);
  let blockStageActive = $derived(active && stageDisplay.blockActive);
  let workflowStageActive = $derived(active && stageDisplay.workflowActive);
  let orchestrationStageActive = $derived(
    active && stageDisplay.orchestrationActive,
  );

  $effect(() => {
    setPageContext({ active });
  });

  $effect(() => {
    return () => {
      destroyOrchestratedWorkspace();
    };
  });
</script>

{#snippet stageLoadingSkeleton()}
  <div class="grid gap-4" aria-hidden="true">
    <Skeleton class="h-10 w-72" />
    <div class="grid gap-3 md:grid-cols-2">
      <Skeleton class="h-24" />
      <Skeleton class="h-24" />
    </div>
    <Skeleton class="h-80" />
  </div>
{/snippet}

{#snippet renderActiveStage(StageComponent, stageBindings)}
  <StageComponent {...stageBindings} />
{/snippet}

<DashboardTabPanel {active}>
  <div class="grid gap-3">
    {#if blockStageActive}
      {#if activeStageComponent}
        {@render renderActiveStage(activeStageComponent, txBlockStageProps)}
      {:else}
        {@render stageLoadingSkeleton()}
      {/if}
    {:else if workflowStageActive}
      {#if activeStageComponent}
        {@render renderActiveStage(activeStageComponent, txWorkflowStageProps)}
      {:else}
        {@render stageLoadingSkeleton()}
      {/if}
    {:else if orchestrationStageActive}
      {#if activeStageComponent}
        {@render renderActiveStage(
          activeStageComponent,
          orchestrationStageProps,
        )}
      {:else}
        {@render stageLoadingSkeleton()}
      {/if}
    {/if}
  </div>
</DashboardTabPanel>
