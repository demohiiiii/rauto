<script>
  import { jsonTemplatesBehavior } from "../actions/jsonTemplatesBehavior.js";
  import { txExecutionBehavior } from "../actions/txExecutionBehavior.js";
  import OrchestrationStage from "../components/orchestrated/OrchestrationStage.svelte";
  import TxBlockStage from "../components/orchestrated/TxBlockStage.svelte";
  import TxSharedBlockEditor from "../components/orchestrated/TxSharedBlockEditor.svelte";
  import TxWorkflowStage from "../components/orchestrated/TxWorkflowStage.svelte";
  import { dashboardView } from "../state/dashboardView.js";
  import { installTxRuntimeBridge } from "../services/txRuntimeBridge.js";
  import { installTxSharedRuntime } from "../services/txSharedRuntime.js";

  installTxSharedRuntime();
  installTxRuntimeBridge();

  let { active = false } = $props();
  let txJsonEditorsPromise = null;

  function safeCall(name, ...args) {
    const fn = window[name];
    return typeof fn === "function" ? fn(...args) : undefined;
  }

  function valueById(id) {
    return document.getElementById(id)?.value.trim() || "";
  }

  async function ensureTxJsonEditors() {
    if (txJsonEditorsPromise) {
      return txJsonEditorsPromise;
    }
    txJsonEditorsPromise = import("../services/txJsonEditors.js").then(
      ({ installTxJsonEditors }) => {
        installTxJsonEditors();
        if (!valueById("tx-workflow-json")) {
          safeCall(
            "setTxWorkflowEditorJson",
            safeCall("defaultTxWorkflowTemplatePayload"),
          );
        }
        if (!valueById("tx-block-json")) {
          safeCall(
            "setTxBlockEditorJson",
            safeCall("defaultTxBlockTemplatePayload"),
          );
        }
        if (!valueById("orchestration-json")) {
          safeCall(
            "setOrchestrationEditorJson",
            safeCall("defaultOrchestrationTemplatePayload"),
          );
        }
        safeCall("setupTxWorkflowJsonEditor");
        safeCall("setupTxBlockJsonEditor");
        safeCall("setupOrchestrationJsonEditor");
      },
    );
    return txJsonEditorsPromise;
  }

  $effect(() => {
    if (active) {
      ensureTxJsonEditors();
    }
  });
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
