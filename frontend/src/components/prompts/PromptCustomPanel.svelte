<script>
  let { active = false } = $props();
</script>

<div id="prompt-edit-panel" class="mt-4" hidden={!active}>
  <h3 id="custom-title" class="mb-2 text-sm font-semibold text-slate-700">
    Custom Profiles
  </h3>
  <div class="grid gap-2 md:w-160">
    <div class="grid gap-2 md:grid-cols-[1fr_auto_auto_auto]">
      <select
        id="custom-profile-picker"
        class="select"
        title="Custom Profile"
        aria-label="Custom Profile"
      ></select>
      <button id="profile-new-btn" class="btn btn-sm" type="button">
        New
      </button>
      <button
        id="profile-save-btn"
        class="btn btn-success btn-sm"
        type="button"
      >
        Save
      </button>
      <button
        id="profile-delete-btn"
        class="btn btn-error btn-sm"
        type="button"
      >
        Delete
      </button>
    </div>
  </div>

  <div class="mt-3 grid gap-2">
    <div class="group-card">
      <div class="mb-2 flex items-center justify-between">
        <span
          id="label-command-execution"
          class="text-sm font-semibold text-slate-700">command_execution</span
        >
      </div>
      <div class="group-body grid gap-2">
        <select
          id="profile-command-execution-mode"
          class="select"
          title="Profile Command Execution Mode"
          aria-label="Profile Command Execution Mode"
        ></select>
        <input
          id="profile-command-execution-marker"
          class="input"
          placeholder="exit status marker"
        />
      </div>
    </div>

    <div class="group-card">
      <div class="mb-2 flex items-center justify-between gap-3">
        <label class="check-label">
          <input
            id="profile-detect-enabled"
            type="checkbox"
            class="check-input"
          />
          <span
            id="label-detect-profile"
            class="text-sm font-semibold text-slate-700">detect_profile</span
          >
        </label>
      </div>
      <div id="profile-detect-hint" class="mb-2 text-xs text-slate-500">
        Optional autodetect scoring rules for this custom profile.
      </div>
      <div id="profile-detect-body" class="group-body grid gap-3" hidden>
        <div class="grid gap-2">
          <div class="flex items-center justify-between">
            <span
              id="label-detect-initial-rules"
              class="text-xs font-semibold text-slate-600">initial_rules</span
            >
            <button
              id="add-detect-initial-rule-btn"
              type="button"
              class="mini-btn add"
            >
              + Add
            </button>
          </div>
          <div id="detect-initial-rules-list" class="grid gap-2"></div>
        </div>
        <div class="grid gap-2">
          <div class="flex items-center justify-between">
            <span
              id="label-detect-probes"
              class="text-xs font-semibold text-slate-600">probes</span
            >
            <button
              id="add-detect-probe-btn"
              type="button"
              class="mini-btn add"
            >
              + Add
            </button>
          </div>
          <div id="detect-probes-list" class="grid gap-2"></div>
        </div>
      </div>
    </div>

    <div class="group-card">
      <div class="mb-2 flex items-center justify-between">
        <span
          id="label-more-patterns"
          class="text-sm font-semibold text-slate-700">more_patterns</span
        >
        <button id="add-more-pattern-btn" type="button" class="mini-btn add">
          + Add
        </button>
      </div>
      <div id="profile-more-list" class="group-body grid gap-2"></div>
    </div>

    <div class="group-card">
      <div class="mb-2 flex items-center justify-between">
        <span
          id="label-error-patterns"
          class="text-sm font-semibold text-slate-700">error_patterns</span
        >
        <button id="add-error-pattern-btn" type="button" class="mini-btn add">
          + Add
        </button>
      </div>
      <div id="profile-error-list" class="group-body grid gap-2"></div>
    </div>

    <div class="group-card">
      <div class="mb-2 flex items-center justify-between">
        <span
          id="label-ignore-errors"
          class="text-sm font-semibold text-slate-700">ignore_errors</span
        >
        <button id="add-ignore-error-btn" type="button" class="mini-btn add">
          + Add
        </button>
      </div>
      <div id="profile-ignore-list" class="group-body grid gap-2"></div>
    </div>

    <div class="group-card">
      <div class="mb-2 flex items-center justify-between">
        <span
          id="label-prompt-prefix"
          class="text-sm font-semibold text-slate-700">prompt_prefix</span
        >
        <button id="add-prompt-prefix-btn" type="button" class="mini-btn add">
          + Add
        </button>
      </div>
      <div id="profile-prompt-prefix-list" class="group-body grid gap-2"></div>
    </div>

    <div class="group-card">
      <div class="mb-2 flex items-center justify-between">
        <span id="label-prompts" class="text-sm font-semibold text-slate-700"
          >prompts</span
        >
        <button id="add-prompt-row-btn" type="button" class="mini-btn add">
          + Add
        </button>
      </div>
      <div id="prompts-list" class="group-body grid gap-2"></div>
    </div>

    <div class="group-card">
      <div class="mb-2 flex items-center justify-between">
        <span
          id="label-sys-prompts"
          class="text-sm font-semibold text-slate-700">sys_prompts</span
        >
        <button id="add-sys-prompt-row-btn" type="button" class="mini-btn add">
          + Add
        </button>
      </div>
      <div id="sys-prompts-list" class="group-body grid gap-2"></div>
    </div>

    <div class="group-card">
      <div class="mb-2 flex items-center justify-between">
        <span
          id="label-interactions"
          class="text-sm font-semibold text-slate-700">interactions</span
        >
        <button id="add-interaction-row-btn" type="button" class="mini-btn add">
          + Add
        </button>
      </div>
      <div id="interactions-list" class="group-body grid gap-2"></div>
    </div>

    <div class="group-card">
      <div class="mb-2 flex items-center justify-between">
        <span
          id="label-transitions"
          class="text-sm font-semibold text-slate-700">transitions</span
        >
        <button id="add-transition-row-btn" type="button" class="mini-btn add">
          + Add
        </button>
      </div>
      <div id="transitions-list" class="group-body grid gap-2"></div>
    </div>

    <div class="group-card">
      <div class="mb-2 flex items-center justify-between">
        <span id="label-hooks" class="text-sm font-semibold text-slate-700"
          >hooks</span
        >
      </div>
      <div class="group-body grid gap-3">
        <div id="profile-hooks-hint" class="text-xs text-slate-500">
          Declarative lifecycle hooks. Operation is rneter SessionOperation
          JSON.
        </div>
        <div class="grid gap-2">
          <div class="flex items-center justify-between">
            <span
              id="label-hook-after-connect"
              class="text-xs font-semibold text-slate-600">after_connect</span
            >
            <button
              id="add-after-connect-hook-btn"
              type="button"
              class="mini-btn add"
              aria-label="Add after_connect hook"
            >
              + Add
            </button>
          </div>
          <div
            id="hooks-after-connect-list"
            class="grid gap-2"
            role="group"
            aria-label="after_connect hooks"
          ></div>
        </div>
        <div class="grid gap-2">
          <div class="flex items-center justify-between">
            <span
              id="label-hook-before-disconnect"
              class="text-xs font-semibold text-slate-600"
              >before_disconnect</span
            >
            <button
              id="add-before-disconnect-hook-btn"
              type="button"
              class="mini-btn add"
              aria-label="Add before_disconnect hook"
            >
              + Add
            </button>
          </div>
          <div
            id="hooks-before-disconnect-list"
            class="grid gap-2"
            role="group"
            aria-label="before_disconnect hooks"
          ></div>
        </div>
        <div class="grid gap-2">
          <div class="flex items-center justify-between">
            <span
              id="label-hook-after-enter-state"
              class="text-xs font-semibold text-slate-600"
              >after_enter_state</span
            >
            <button
              id="add-after-enter-state-hook-btn"
              type="button"
              class="mini-btn add"
              aria-label="Add after_enter_state hook"
            >
              + Add
            </button>
          </div>
          <div
            id="hooks-after-enter-state-list"
            class="grid gap-2"
            role="group"
            aria-label="after_enter_state hooks"
          ></div>
        </div>
        <div class="grid gap-2">
          <div class="flex items-center justify-between">
            <span
              id="label-hook-before-exit-state"
              class="text-xs font-semibold text-slate-600"
              >before_exit_state</span
            >
            <button
              id="add-before-exit-state-hook-btn"
              type="button"
              class="mini-btn add"
              aria-label="Add before_exit_state hook"
            >
              + Add
            </button>
          </div>
          <div
            id="hooks-before-exit-state-list"
            class="grid gap-2"
            role="group"
            aria-label="before_exit_state hooks"
          ></div>
        </div>
      </div>
    </div>

    <div id="profile-out" class="mt-3 grid gap-2"></div>
  </div>
</div>
