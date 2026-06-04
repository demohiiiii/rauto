<script>
  import TextfsmControls from "./TextfsmControls.svelte";

  let { active = false } = $props();
</script>

<div id="op-exec-direct-fields" class="grid gap-3" hidden={!active}>
  <div class="grid items-center gap-2 md:grid-cols-2">
    <input id="command" class="input" placeholder="show version" />
    <select
      id="mode"
      class="select"
      title="Execution Mode"
      aria-label="Execution Mode"
    ></select>
  </div>
  {#if active}
    <TextfsmControls />
  {/if}
  <div class="flex justify-end">
    <button id="exec-btn" class="btn btn-primary btn-sm" type="button">
      Execute
    </button>
  </div>
  <div id="exec-out" class="mt-2"></div>
</div>
