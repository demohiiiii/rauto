<script>
  import { replayBehavior } from "../actions/replayBehavior.js";

  let { active = false } = $props();
</script>

<div
  id="panel-replay"
  class="tab-panel"
  role="tabpanel"
  hidden={!active}
  use:replayBehavior
>
  <h2 id="replay-page-title" class="text-xl font-semibold">Session Replay</h2>
  <div class="mt-3 group-card">
    <div class="field-tools">
      <span id="replay-title">Session Replay</span>
    </div>
    <div class="group-body grid gap-2">
      <textarea
        id="replay-jsonl"
        class="input min-h-28 font-mono"
        placeholder="paste recording JSONL"
      ></textarea>
      <div class="grid gap-2 md:grid-cols-2">
        <input
          id="replay-command"
          class="input"
          placeholder="command to replay, e.g. show version"
        />
        <input
          id="replay-mode"
          class="input"
          placeholder="mode for replay (optional)"
        />
      </div>
      <div class="inline-flex flex-wrap items-center gap-2">
        <button
          id="replay-list-btn"
          class="btn btn-primary btn-sm"
          type="button"
        >
          List Records
        </button>
        <button
          id="replay-run-btn"
          class="btn btn-primary btn-sm"
          type="button"
        >
          Replay Command
        </button>
      </div>
      <div class="inline-flex items-center gap-2">
        <span
          id="replay-view-label"
          class="text-sm font-semibold text-slate-600">Display</span
        >
        <div class="tabs tabs-box w-fit">
          <button id="replay-view-list" class="tab tab-active" type="button">
            List
          </button>
          <button id="replay-view-raw" class="tab" type="button"> Raw </button>
        </div>
        <label class="check-label">
          <input id="replay-failed-only" type="checkbox" class="check-input" />
          <span id="replay-failed-only-label">Failed only</span>
        </label>
        <select
          id="replay-event-kind"
          class="select w-55"
          title="Event Kind"
          aria-label="Event Kind"
        >
          <option value="all">All events</option>
          <option value="command_output">command_output</option>
          <option value="connection_established">connection_established</option>
          <option value="connection_closed">connection_closed</option>
          <option value="prompt_changed">prompt_changed</option>
          <option value="state_changed">state_changed</option>
          <option value="raw_chunk">raw_chunk</option>
        </select>
        <input
          id="replay-search"
          class="input w-65"
          placeholder="search command/content"
        />
        <button id="replay-clear-filters" class="btn btn-sm" type="button">
          Clear
        </button>
      </div>
      <div id="replay-list-out" class="grid gap-3"></div>
      <pre id="replay-out" class="output" hidden></pre>
    </div>
  </div>
</div>
