<script>
  import { blacklistBehavior } from "../actions/blacklistBehavior.js";

  let { active = false } = $props();
</script>

<div
  id="panel-blacklist"
  class="tab-panel"
  role="tabpanel"
  hidden={!active}
  use:blacklistBehavior
>
  <h2 id="blacklist-title" class="text-xl font-semibold">Command Blacklist</h2>
  <div class="mt-3 grid gap-3 lg:grid-cols-[1.2fr_1fr]">
    <div class="group-card">
      <div class="field-tools">
        <span
          id="blacklist-list-title"
          class="text-sm font-semibold text-slate-700">Blocked Patterns</span
        >
        <button id="blacklist-refresh-btn" class="btn btn-sm" type="button">
          Refresh
        </button>
      </div>
      <div class="group-body grid gap-2">
        <div id="blacklist-file-hint" class="text-xs text-slate-500"></div>
        <div id="blacklist-list" class="grid gap-2"></div>
        <div id="blacklist-out" class="grid gap-2">-</div>
      </div>
    </div>
    <div class="grid gap-3">
      <div class="group-card">
        <div class="field-tools">
          <span
            id="blacklist-add-title"
            class="text-sm font-semibold text-slate-700">Add Pattern</span
          >
        </div>
        <div class="group-body grid gap-2">
          <input
            id="blacklist-pattern"
            class="input"
            placeholder="e.g. reload*"
          />
          <div class="text-xs text-slate-500" id="blacklist-pattern-hint">
            Use * as wildcard. Matching is case-insensitive.
          </div>
          <button id="blacklist-add-btn" class="mini-btn add" type="button">
            Add
          </button>
        </div>
      </div>
      <div class="group-card">
        <div class="field-tools">
          <span
            id="blacklist-check-title"
            class="text-sm font-semibold text-slate-700">Check Command</span
          >
        </div>
        <div class="group-body grid gap-2">
          <input
            id="blacklist-check-command"
            class="input"
            placeholder="e.g. reload in 5"
          />
          <button id="blacklist-check-btn" class="btn btn-sm" type="button">
            Check
          </button>
          <div id="blacklist-check-out" class="grid gap-2">-</div>
        </div>
      </div>
    </div>
  </div>
</div>
