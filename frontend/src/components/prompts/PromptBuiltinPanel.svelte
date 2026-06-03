<script>
  let { active = false } = $props();
</script>

<div id="prompt-view-panel" class="mt-4" hidden={!active}>
  <h3 id="builtin-title" class="mb-2 text-sm font-semibold text-slate-700">
    Built-in Profiles
  </h3>
  <div class="grid gap-2 md:w-160 md:grid-cols-[1fr_auto]">
    <select
      id="builtin-profile-select"
      class="select"
      title="Built-in Profile"
      aria-label="Built-in Profile"
    ></select>
    <button id="builtin-copy-btn" class="btn btn-primary btn-sm" type="button">
      Copy To Custom
    </button>
  </div>
  <pre id="builtin-list" class="output mt-2"></pre>
  <div class="mt-2 grid gap-2">
    <input id="builtin-detail-name" class="input" placeholder="name" readonly />
    <input
      id="builtin-detail-aliases"
      class="input"
      placeholder="aliases"
      readonly
    />
    <input
      id="builtin-detail-summary"
      class="input"
      placeholder="summary"
      readonly
    />
    <input
      id="builtin-detail-source"
      class="input"
      placeholder="source"
      readonly
    />
    <textarea
      id="builtin-detail-notes"
      class="input min-h-24 font-mono"
      placeholder="notes"
      readonly
    ></textarea>

    <div class="group-card">
      <div class="mb-2 flex items-center justify-between">
        <span
          id="builtin-command-execution-title"
          class="text-sm font-semibold text-slate-700"
        >
          command_execution
        </span>
      </div>
      <div class="group-body grid gap-2">
        <select
          id="builtin-command-execution-mode"
          class="select"
          disabled
          title="Command Execution Mode"
          aria-label="Command Execution Mode"
        ></select>
        <input
          id="builtin-command-execution-marker"
          class="input"
          placeholder="exit status marker"
          readonly
        />
      </div>
    </div>

    <div class="group-card">
      <div class="mb-2 flex items-center justify-between">
        <span
          id="label-builtin-detect-profile"
          class="text-sm font-semibold text-slate-700">detect_profile</span
        >
      </div>
      <div id="builtin-detect-profile-list" class="group-body grid gap-3"></div>
    </div>

    <div class="group-card">
      <div class="mb-2 flex items-center justify-between">
        <span
          class="text-sm font-semibold text-slate-700"
          data-i18n="labelMorePatterns">more_patterns</span
        >
      </div>
      <div id="builtin-more-list" class="group-body grid gap-2"></div>
    </div>

    <div class="group-card">
      <div class="mb-2 flex items-center justify-between">
        <span
          class="text-sm font-semibold text-slate-700"
          data-i18n="labelErrorPatterns">error_patterns</span
        >
      </div>
      <div id="builtin-error-list" class="group-body grid gap-2"></div>
    </div>

    <div class="group-card">
      <div class="mb-2 flex items-center justify-between">
        <span
          class="text-sm font-semibold text-slate-700"
          data-i18n="labelIgnoreErrors">ignore_errors</span
        >
      </div>
      <div id="builtin-ignore-list" class="group-body grid gap-2"></div>
    </div>

    <div class="group-card">
      <div class="mb-2 flex items-center justify-between">
        <span
          class="text-sm font-semibold text-slate-700"
          data-i18n="labelPrompts">prompts</span
        >
      </div>
      <div id="builtin-prompts-list" class="group-body grid gap-2"></div>
    </div>

    <div class="group-card">
      <div class="mb-2 flex items-center justify-between">
        <span
          class="text-sm font-semibold text-slate-700"
          data-i18n="labelSysPrompts">sys_prompts</span
        >
      </div>
      <div id="builtin-sys-prompts-list" class="group-body grid gap-2"></div>
    </div>

    <div class="group-card">
      <div class="mb-2 flex items-center justify-between">
        <span
          id="label-builtin-prompt-prefix"
          class="text-sm font-semibold text-slate-700">prompt_prefix</span
        >
      </div>
      <div id="builtin-prompt-prefix-list" class="group-body grid gap-2"></div>
    </div>

    <div class="group-card">
      <div class="mb-2 flex items-center justify-between">
        <span
          class="text-sm font-semibold text-slate-700"
          data-i18n="labelInteractions">interactions</span
        >
      </div>
      <div id="builtin-interactions-list" class="group-body grid gap-2"></div>
    </div>

    <div class="group-card">
      <div class="mb-2 flex items-center justify-between">
        <span
          class="text-sm font-semibold text-slate-700"
          data-i18n="labelTransitions">transitions</span
        >
      </div>
      <div id="builtin-transitions-list" class="group-body grid gap-2"></div>
    </div>

    <div class="group-card">
      <div class="mb-2 flex items-center justify-between">
        <span
          id="label-builtin-hooks"
          class="text-sm font-semibold text-slate-700">hooks</span
        >
      </div>
      <div
        id="builtin-hooks-list"
        class="group-body grid gap-2"
        role="group"
        aria-label="Built-in profile hooks"
      ></div>
    </div>
  </div>
  <div id="builtin-detail-status" class="mt-3 grid gap-2"></div>
</div>
