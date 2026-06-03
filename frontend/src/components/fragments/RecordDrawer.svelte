<script>
  import { recordDrawerBehavior } from "../../actions/recordDrawerBehavior.js";
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
<aside
  id="record-drawer"
  role="dialog"
  aria-modal="true"
  aria-labelledby="recording-title"
  use:recordDrawerBehavior
>
  <div class="record-drawer-head">
    <div class="grid gap-1">
      <span id="recording-title" class="text-sm font-semibold text-slate-700"
        >Session Recording</span
      >
      <span class="text-xs text-slate-500" id="recording-subtitle">
        Every execution is recorded. Choose audit-only or full detail.
      </span>
    </div>
    <button id="record-drawer-close" class="btn btn-sm" type="button">
      Close
    </button>
  </div>
  <div class="record-drawer-body grid gap-3">
    <div class="record-drawer-section">
      <div class="record-toolbar">
        <div class="record-toolbar-left">
          <select
            id="record-level"
            class="select md:w-55"
            title="Record Level"
            aria-label="Record Level"
          >
            <option value="key-events-only" selected>
              key-events-only (command + output)
            </option>
            <option value="full">full (prompt + state changes)</option>
          </select>
        </div>
        <div class="record-toolbar-left">
          <span
            id="record-view-label"
            class="text-sm font-semibold text-slate-600">Display</span
          >
          <div class="tabs tabs-box w-fit">
            <button id="record-view-list" class="tab tab-active" type="button">
              List
            </button>
            <button id="record-view-raw" class="tab" type="button">
              Raw
            </button>
          </div>
        </div>
      </div>
    </div>
    <div class="record-drawer-section record-filters">
      <div class="record-filters-row">
        <label class="check-label">
          <input id="record-failed-only" type="checkbox" class="check-input" />
          <span id="record-failed-only-label">Failed only</span>
        </label>
        <select
          id="record-event-kind"
          class="select w-55"
          title="Record Event Kind"
          aria-label="Record Event Kind"
        >
          <option value="all">All events</option>
          <option value="command_output">command_output</option>
          <option value="connection_established">connection_established</option>
          <option value="connection_closed">connection_closed</option>
          <option value="prompt_changed">prompt_changed</option>
          <option value="state_changed">state_changed</option>
          <option value="raw_chunk">raw_chunk</option>
        </select>
      </div>
      <div class="record-filters-row">
        <input
          id="record-search"
          class="input w-65"
          placeholder="search command/content"
        />
        <button id="record-clear-filters" class="btn btn-sm" type="button">
          Clear
        </button>
      </div>
    </div>
    <div class="record-drawer-section">
      <div id="record-list-out" class="grid gap-3"></div>
      <textarea
        id="record-jsonl"
        class="input min-h-28 font-mono"
        placeholder="recording JSONL output"
        hidden
      ></textarea>
    </div>
    <div class="record-drawer-section">
      <div class="inline-flex flex-wrap items-center gap-2">
        <button id="record-copy-btn" class="btn btn-sm" type="button">
          Copy Recording
        </button>
        <button id="record-use-replay-btn" class="btn btn-sm" type="button">
          Use In Replay
        </button>
      </div>
    </div>
  </div>
</aside>
