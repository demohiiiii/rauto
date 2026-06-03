<script>
  import { tasksBehavior } from "../actions/tasksBehavior.js";

  let { active = false } = $props();
</script>

<div
  id="panel-tasks"
  class="tab-panel"
  role="tabpanel"
  hidden={!active}
  use:tasksBehavior
>
  <h2 id="tasks-title" class="text-xl font-semibold">Task Center</h2>
  <div class="mt-4 grid gap-3 xl:grid-cols-[1.15fr_0.85fr]">
    <div class="grid gap-3">
      <div class="group-card">
        <div class="field-tools">
          <span
            id="tasks-filters-title"
            class="text-sm font-semibold text-slate-700">Filters</span
          >
        </div>
        <div
          class="group-body grid gap-2 md:grid-cols-[120px_1fr_1fr_1fr_1fr_1fr_1fr_auto_auto]"
        >
          <select
            id="tasks-limit"
            class="select"
            title="Task Limit"
            aria-label="Task Limit"
          >
            <option value="20">20</option>
            <option value="50" selected>50</option>
            <option value="100">100</option>
            <option value="200">200</option>
          </select>
          <input
            id="tasks-search"
            class="input"
            type="text"
            placeholder="search task/target/summary"
          />
          <select
            id="tasks-operation"
            class="select"
            title="Task Operation"
            aria-label="Task Operation"
          ></select>
          <select
            id="tasks-status"
            class="select"
            title="Task Status"
            aria-label="Task Status"
          ></select>
          <select
            id="tasks-outcome"
            class="select"
            title="Task Outcome"
            aria-label="Task Outcome"
          ></select>
          <select
            id="tasks-time-range"
            class="select"
            title="Task Time Range"
            aria-label="Task Time Range"
          ></select>
          <select
            id="tasks-recording"
            class="select"
            title="Task Recording"
            aria-label="Task Recording"
          ></select>
          <select
            id="tasks-error"
            class="select"
            title="Task Error"
            aria-label="Task Error"
          ></select>
          <button id="tasks-refresh-btn" class="btn btn-sm" type="button">
            Refresh
          </button>
          <button id="tasks-clear-btn" class="btn btn-sm" type="button">
            Clear
          </button>
        </div>
      </div>
      <div class="group-card">
        <div class="field-tools">
          <span
            id="tasks-list-title"
            class="text-sm font-semibold text-slate-700">Tasks</span
          >
          <span id="tasks-list-meta" class="text-xs text-slate-500">-</span>
        </div>
        <div class="group-body grid gap-2">
          <div id="tasks-out" class="grid gap-2"></div>
          <div id="tasks-list" class="grid gap-2"></div>
          <div id="tasks-empty-state" class="text-xs text-slate-500">
            no tasks yet
          </div>
        </div>
      </div>
    </div>
    <div class="group-card">
      <div class="field-tools">
        <span
          id="tasks-detail-title"
          class="text-sm font-semibold text-slate-700">Task Detail</span
        >
      </div>
      <div class="group-body grid gap-2">
        <div id="tasks-detail-empty" class="text-xs text-slate-500">
          select a task to inspect details
        </div>
        <div id="tasks-detail" class="grid gap-2"></div>
      </div>
    </div>
  </div>
</div>
