<script>
  import { entryDrawerBehavior } from "../../actions/entryDrawerBehavior.js";
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
<aside
  id="entry-drawer"
  role="dialog"
  aria-modal="true"
  aria-labelledby="entry-drawer-title"
  use:entryDrawerBehavior
>
  <div
    class="flex items-center justify-between border-b border-slate-200 px-4 py-3"
  >
    <h3 id="entry-drawer-title" class="text-base font-semibold text-slate-800">
      Event Details
    </h3>
    <button id="entry-drawer-close" class="btn btn-sm" type="button">
      Close
    </button>
  </div>
  <div id="entry-drawer-body" class="overflow-auto p-4"></div>
</aside>
