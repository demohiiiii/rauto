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
  <div class="grid items-start gap-2">
    <div class="connection-field">
      <span id="show-object-label" class="connection-field-label"
        >Show object</span
      >
      <div class="dropdown dropdown-bottom w-full">
        <div class="connection-tags-input">
          <div
            id="show-object-selected"
            class="flex flex-wrap items-center gap-2"
          ></div>
          <input
            id="show-object-picker"
            class="min-w-32 flex-1 border-0 bg-transparent px-0 py-1 text-sm text-slate-900 outline-none placeholder:text-slate-400"
            placeholder="select show object"
          />
        </div>
        <div
          id="show-object-menu"
          class="dropdown-content menu z-[120] mt-1 hidden max-h-56 w-full overflow-x-hidden overflow-y-auto rounded-box border border-base-300 bg-base-100 p-2 shadow-lg"
        ></div>
      </div>
      <select
        id="show-object"
        class="hidden"
        multiple
        title="Show object"
        aria-label="Show object"
      ></select>
    </div>
    <select
      id="show-mode"
      class="select w-full"
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
  <div id="show-out" class="grid min-w-0 max-w-full gap-2"></div>
</div>
