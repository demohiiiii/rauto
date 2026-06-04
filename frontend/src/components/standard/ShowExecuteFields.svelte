<script>
  let { active = false } = $props();
</script>

<div
  id="op-show"
  class="grid gap-3"
  hidden={!active}
  style:display={active ? "" : "none"}
>
  <div
    class="grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(180px,0.35fr)_auto_auto]"
  >
    <select
      id="show-object"
      class="select"
      title="Show object"
      aria-label="Show object"
    ></select>
    <input id="show-mode" class="input" placeholder="mode (optional)" />
    <button id="show-refresh-btn" class="btn btn-sm" type="button">
      Refresh Objects
    </button>
    <button id="show-exec-btn" class="btn btn-primary btn-sm" type="button">
      Execute Show
    </button>
  </div>
  <div
    id="show-command-preview"
    class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-600"
  >
    -
  </div>
  <div id="show-out" class="grid gap-2"></div>
</div>
