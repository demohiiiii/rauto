<script>
  let { active = false } = $props();
</script>

<div id="tx-stage-block-panel" class="grid gap-3" hidden={!active}>
  <div id="tx-shared-editor-block-host" class="grid gap-2"></div>
  <div id="tx-block-run-direct-panel" class="group-card">
    <div class="group-body grid gap-2">
      <div class="grid grid-cols-2 gap-2">
        <button id="tx-plan-btn" class="btn btn-sm" type="button">
          Preview Tx Plan
        </button>
        <button id="tx-exec-btn" class="btn btn-primary btn-sm" type="button">
          Execute Tx Block
        </button>
      </div>
    </div>
  </div>
  <div id="tx-block-run-template-panel" class="group-card" hidden>
    <div class="group-body grid gap-2">
      <div class="grid gap-2 md:grid-cols-2">
        <button id="tx-template-plan-btn" class="btn btn-sm" type="button">
          Preview Tx Plan
        </button>
        <button
          id="tx-template-exec-btn"
          class="btn btn-primary btn-sm"
          type="button"
        >
          Execute Tx Block
        </button>
      </div>
    </div>
  </div>
  <div class="group-card">
    <div class="field-tools">
      <span id="tx-block-visual-title">Tx Block Visual Preview</span>
    </div>
    <div id="tx-block-visual" class="group-body grid gap-2"></div>
  </div>
  <div id="tx-plan-out" class="mt-2 grid gap-2"></div>
  <div id="tx-exec-out" class="mt-2 grid gap-2"></div>
</div>
