<script>
  let { active = false } = $props();
</script>

<div id="prompt-diagnose-panel" class="mt-4" hidden={!active}>
  <div class="group-card">
    <div class="field-tools">
      <span id="profile-diagnose-title">State Machine Diagnose</span>
    </div>
    <div class="group-body grid gap-2 md:w-190">
      <select
        id="profile-diagnose-picker"
        class="select"
        title="Profile Diagnose Target"
        aria-label="Profile Diagnose Target"
      ></select>
      <div class="md:w-64">
        <button id="profile-diagnose-btn" class="btn btn-sm" type="button">
          Diagnose
        </button>
      </div>
    </div>
  </div>
  <div class="mt-3 group-card">
    <div class="field-tools">
      <span id="profile-diagnose-result-title">Diagnose Result</span>
      <span id="profile-diagnose-badge" class="diag-badge">-</span>
    </div>
    <div class="group-body grid gap-3">
      <div class="diag-grid">
        <div class="diag-card">
          <div class="k" id="diag-k-total">total_states</div>
          <div class="v" id="diag-total-states">-</div>
        </div>
        <div class="diag-card">
          <div class="k" id="diag-k-graph">graph_states</div>
          <div class="v" id="diag-graph-states">-</div>
        </div>
        <div class="diag-card">
          <div class="k" id="diag-k-entry">entry_states</div>
          <div class="v" id="diag-entry-states">-</div>
        </div>
        <div class="diag-card">
          <div class="k" id="diag-k-issues">issues</div>
          <div class="v" id="diag-issues-count">-</div>
        </div>
      </div>
      <div class="grid gap-2 md:grid-cols-2">
        <div class="diag-list">
          <h4 id="diag-l-unreach">unreachable_states</h4>
          <ul id="diag-unreachable-states"></ul>
        </div>
        <div class="diag-list">
          <h4 id="diag-l-deadend">dead_end_states</h4>
          <ul id="diag-dead-end-states"></ul>
        </div>
        <div class="diag-list">
          <h4 id="diag-l-missing-src">missing_edge_sources</h4>
          <ul id="diag-missing-sources"></ul>
        </div>
        <div class="diag-list">
          <h4 id="diag-l-missing-tgt">missing_edge_targets</h4>
          <ul id="diag-missing-targets"></ul>
        </div>
        <div class="diag-list">
          <h4 id="diag-l-ambiguous">potentially_ambiguous_prompt_states</h4>
          <ul id="diag-ambiguous-states"></ul>
        </div>
      </div>
      <div id="profile-diagnose-out" class="grid gap-2"></div>
    </div>
  </div>
</div>
