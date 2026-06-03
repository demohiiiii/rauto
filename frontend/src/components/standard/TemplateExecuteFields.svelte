<script>
  let { active = false } = $props();
</script>

<div id="op-exec-template-fields" class="grid gap-3" hidden={!active}>
  <select id="template" class="select" title="Template" aria-label="Template"
  ></select>
  <div class="group-card">
    <div class="field-tools">
      <span id="template-selected-content-title">Selected Template Content</span
      >
    </div>
    <div id="template-selected-content-body" class="group-body">
      <textarea
        id="template-selected-content"
        class="input min-h-40 font-mono"
        placeholder="template content preview"
        readonly
      ></textarea>
    </div>
  </div>
  <textarea
    id="vars"
    class="input min-h-28 font-mono"
    placeholder={'JSON vars, e.g. {"vlan_id": 10}'}
  ></textarea>
  <select
    id="template-mode"
    class="select"
    title="Template Mode"
    aria-label="Template Mode"
  ></select>
  <div class="grid grid-cols-2 gap-2">
    <button id="render-btn" class="btn btn-sm" type="button">
      Preview Render
    </button>
    <button id="template-exec-btn" class="btn btn-primary btn-sm" type="button">
      Run Template
    </button>
  </div>
  <pre id="render-out" class="output mt-2"></pre>
  <div class="group-card">
    <div class="field-tools">
      <span id="template-exec-visual-title">Template Execution</span>
    </div>
    <div id="template-exec-visual" class="group-body"></div>
  </div>
</div>
