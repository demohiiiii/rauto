<script>
  import TextfsmControls from "./TextfsmControls.svelte";

  let { active = false } = $props();
</script>

<div
  id="op-show"
  class="grid gap-3"
  hidden={!active}
  style:display={active ? "" : "none"}
>
  <div class="grid items-center gap-2 md:grid-cols-2">
    <select
      id="show-object"
      class="select"
      title="Show object"
      aria-label="Show object"
    ></select>
    <select
      id="show-mode"
      class="select"
      title="Show Mode"
      aria-label="Show Mode"
    ></select>
  </div>
  {#if active}
    <TextfsmControls defaultEnabled={true} />
  {/if}
  <div
    id="show-command-preview"
    class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-600"
  >
    -
  </div>
  <div class="flex justify-end">
    <button id="show-exec-btn" class="btn btn-primary btn-sm" type="button">
      Execute Show
    </button>
  </div>
  <div id="show-out" class="grid gap-2"></div>
</div>
