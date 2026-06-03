<script>
  import { jsonTemplatesBehavior } from "../actions/jsonTemplatesBehavior.js";
  import { txExecutionBehavior } from "../actions/txExecutionBehavior.js";
  import OrchestrationStage from "../components/orchestrated/OrchestrationStage.svelte";
  import TxBlockStage from "../components/orchestrated/TxBlockStage.svelte";
  import TxSharedBlockEditor from "../components/orchestrated/TxSharedBlockEditor.svelte";
  import TxWorkflowStage from "../components/orchestrated/TxWorkflowStage.svelte";
  import { dashboardView } from "../state/dashboardView.js";
  import { installTxJsonEditors } from "../services/txJsonEditors.js";
  import { installTxRuntimeBridge } from "../services/txRuntimeBridge.js";
  import { installTxSharedRuntime } from "../services/txSharedRuntime.js";

  installTxSharedRuntime();
  installTxJsonEditors();
  installTxRuntimeBridge();

  let { active = false } = $props();
</script>

<div
  id="panel-orchestrated"
  class="tab-panel"
  role="tabpanel"
  hidden={!active}
  use:jsonTemplatesBehavior
  use:txExecutionBehavior
>
  <h2 id="orchestrated-title" class="text-xl font-semibold">Tx Block</h2>
  <div id="op-tx-fields" class="mt-3 grid gap-3">
    <TxBlockStage active={$dashboardView.currentTxStage === "block"} />
    <TxWorkflowStage active={$dashboardView.currentTxStage === "workflow"} />
    <TxSharedBlockEditor />
    <OrchestrationStage
      active={$dashboardView.currentTxStage === "orchestrate"}
    />
  </div>
</div>
