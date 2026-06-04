<script>
  import { standardDeliveryBehavior } from "../actions/standardDeliveryBehavior.js";
  import CommandFlowFields from "./standard/CommandFlowFields.svelte";
  import DirectExecuteFields from "./standard/DirectExecuteFields.svelte";
  import ShowExecuteFields from "./standard/ShowExecuteFields.svelte";
  import StandardModeTabs from "./standard/StandardModeTabs.svelte";
  import TemplateExecuteFields from "./standard/TemplateExecuteFields.svelte";
  import { dashboardView } from "../state/dashboardView.js";

  let { active = false } = $props();
</script>

<div
  id="panel-standard"
  class="tab-panel"
  role="tabpanel"
  hidden={!active}
  use:standardDeliveryBehavior
>
  <h2 id="standard-title" class="text-xl font-semibold">Standard Delivery</h2>
  <div class="mt-3 grid gap-3">
    <div class="group-card">
      <div class="field-tools">
        <span id="standard-op-card-title">Execute</span>
      </div>
      <div id="ops-main-body" class="group-body">
        <StandardModeTabs />

        <div id="op-exec-fields" class="grid gap-3">
          <DirectExecuteFields
            active={$dashboardView.currentExecMode === "direct"}
          />
          <ShowExecuteFields
            active={$dashboardView.currentExecMode === "show"}
          />
          <TemplateExecuteFields
            active={$dashboardView.currentExecMode === "template"}
          />
          <CommandFlowFields
            active={$dashboardView.currentExecMode === "flow"}
          />
        </div>
      </div>
    </div>
  </div>
</div>
