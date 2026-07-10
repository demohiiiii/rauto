<script>
  let { flow } = $props();
</script>

<div
  class="min-w-[180px] rounded-lg border border-slate-200 bg-slate-50 px-2 py-2"
>
  <div class={flow.beforeCardClass}>
    <div class="text-[10px] font-semibold uppercase tracking-wide opacity-70">
      {flow.beforeLabel}
    </div>
    <div class="mt-0.5 font-mono text-xs break-all">
      {flow.before}
    </div>
  </div>
  <div class="my-1 flex items-center gap-1 px-1">
    <span class={flow.markerDotClass}></span>
    <span class={flow.markerLineClass}></span>
    <span class={flow.markerDotClass}></span>
  </div>
  <div class={flow.afterCardClass}>
    <div class="text-[10px] font-semibold uppercase tracking-wide opacity-70">
      {flow.afterLabel}
    </div>
    <div class="mt-0.5 font-mono text-xs break-all">
      {flow.after}
    </div>
  </div>
</div>
