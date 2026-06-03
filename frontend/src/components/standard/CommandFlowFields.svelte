<script>
  let { active = false } = $props();
</script>

<div id="op-exec-flow-fields" class="grid gap-3" hidden={!active}>
  <select
    id="flow-template-name"
    class="select"
    title="Command Flow Template"
    aria-label="Command Flow Template"
  ></select>
  <div class="grid gap-2">
    <div
      id="flow-vars-fields-title"
      class="text-xs font-semibold text-slate-600"
    >
      Template Variables
    </div>
    <div id="flow-vars-fields" class="grid gap-2"></div>
    <div id="flow-vars-fields-hint" class="text-xs text-slate-500">
      Template-declared vars will appear here when available.
    </div>
  </div>
  <textarea
    id="flow-vars-json"
    class="input min-h-28 font-mono"
    placeholder={'JSON vars, e.g. {"package": "nginx"}'}
  ></textarea>
  <div id="flow-vars-json-hint" class="text-xs text-slate-500">
    Use JSON for advanced overrides or extra vars not declared by the template.
  </div>
  <div class="grid gap-2 md:grid-cols-[1fr_auto]">
    <div id="flow-hint" class="text-xs text-slate-500">
      Use a saved command flow template for wizard-style CLI interactions.
    </div>
    <button id="flow-exec-btn" class="btn btn-primary btn-sm" type="button">
      Run Flow
    </button>
  </div>
  <div id="flow-out" class="grid gap-2"></div>
</div>
