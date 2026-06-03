<script>
  let { active = false } = $props();
</script>

<div id="op-exec-direct-fields" class="grid gap-3" hidden={!active}>
  <input id="command" class="input" placeholder="show version" />
  <select
    id="mode"
    class="select"
    title="Execution Mode"
    aria-label="Execution Mode"
  ></select>
  <button id="exec-btn" class="btn btn-primary btn-sm" type="button">
    Execute
  </button>
  <div id="exec-out" class="mt-2"></div>
</div>
