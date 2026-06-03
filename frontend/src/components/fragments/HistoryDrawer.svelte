<script>
  import { historyBehavior } from "../../actions/historyBehavior.js";
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
<aside
  id="history-drawer"
  role="dialog"
  aria-modal="true"
  aria-labelledby="history-drawer-title"
  use:historyBehavior
>
  <div class="record-drawer-head">
    <div class="grid gap-1">
      <span
        id="history-drawer-title"
        class="text-sm font-semibold text-slate-700">Connection History</span
      >
      <span class="text-xs text-slate-500" id="history-drawer-subtitle"
        >View saved connection history</span
      >
    </div>
    <button id="history-drawer-close" class="btn btn-sm" type="button">
      Close
    </button>
  </div>
  <div class="record-drawer-body grid gap-3">
    <div class="record-drawer-section">
      <div class="record-toolbar">
        <div class="record-toolbar-left">
          <span
            id="history-drawer-conn-label"
            class="text-sm font-semibold text-slate-600">Connection</span
          >
          <span
            id="history-drawer-conn-name"
            class="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-700"
          >
            -
          </span>
        </div>
        <div class="record-toolbar-left">
          <button
            id="history-drawer-refresh-btn"
            class="btn btn-sm"
            type="button"
          >
            Refresh
          </button>
        </div>
      </div>
    </div>
    <div class="record-drawer-section record-filters">
      <div class="record-filters-row">
        <input
          id="history-filter-query"
          class="input w-65"
          placeholder="search command/target"
        />
        <select
          id="history-filter-operation"
          class="select w-50"
          title="History Filter Operation"
          aria-label="History Filter Operation"
        >
          <option value="all">All operations</option>
          <option value="exec">exec</option>
          <option value="template_execute">template_execute</option>
          <option value="tx_block">tx_block</option>
          <option value="tx_workflow">tx_workflow</option>
        </select>
        <select
          id="history-filter-limit"
          class="select w-35"
          title="History Filter Limit"
          aria-label="History Filter Limit"
        >
          <option value="10">10</option>
          <option value="20">20</option>
          <option value="30" selected>30</option>
          <option value="50">50</option>
        </select>
        <button id="history-filter-clear-btn" class="mini-btn" type="button">
          Clear
        </button>
      </div>
    </div>
    <div class="record-drawer-section">
      <div id="history-drawer-out" class="grid gap-2"></div>
    </div>
  </div>
</aside>
