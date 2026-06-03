<script>
  import {
    orchestrationJsonPlaceholder,
    orchestrationTemplateVarsPlaceholder,
    orchestrationVarsPlaceholder,
  } from "./placeholders.js";

  const orchestrationVarsHint =
    "Template strings can use {{ peer_host }} or {{ edge94.host }}.";
  let { active = false } = $props();
</script>

<div id="tx-stage-orchestrate-panel" class="grid gap-2" hidden={!active}>
  <div id="orchestration-section" class="grid gap-2">
    <div
      class="tabs tabs-box w-fit"
      role="tablist"
      aria-label="Orchestration page mode tabs"
    >
      <button
        id="orchestration-view-direct"
        class="tab tab-active"
        type="button"
      >
        Direct Execute
      </button>
      <button id="orchestration-view-template" class="tab" type="button">
        Template Execute
      </button>
    </div>
    <div id="orchestration-view-direct-panel" class="group-card">
      <div class="group-body grid gap-2">
        <div id="orchestration-view-direct-hint" class="text-xs text-slate-500">
          Use the orchestration plan JSON for direct execution.
        </div>
        <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
          <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div
              id="orchestration-direct-vars-form-title"
              class="text-sm font-semibold text-slate-700"
            >
              Vars Form
            </div>
            <div class="inline-flex flex-wrap items-center gap-2">
              <button
                id="orchestration-direct-vars-add-btn"
                class="btn btn-sm"
                type="button"
              >
                Add Var
              </button>
              <button
                id="orchestration-direct-vars-sync-btn"
                class="btn btn-sm"
                type="button"
              >
                Sync From JSON
              </button>
              <button
                id="orchestration-direct-vars-clear-btn"
                class="btn btn-sm"
                type="button"
              >
                Clear
              </button>
            </div>
          </div>
          <div id="orchestration-direct-vars-form" class="grid gap-2"></div>
        </div>
        <textarea
          id="orchestration-vars-json"
          class="input min-h-20 font-mono hidden"
          placeholder={orchestrationVarsPlaceholder}
          aria-hidden="true"
        ></textarea>
        <div
          id="orchestration-vars-hint"
          class="text-xs text-slate-500 hidden"
          aria-hidden="true"
        >
          {orchestrationVarsHint}
        </div>
      </div>
    </div>
    <div id="orchestration-view-template-panel" class="group-card" hidden>
      <div class="group-body grid gap-2">
        <div class="grid gap-2 md:grid-cols-[1fr_auto_auto_auto]">
          <select
            id="orchestration-template-name"
            class="select"
            title="Orchestration Template"
            aria-label="Orchestration Template"
          ></select>
          <button
            id="orchestration-template-run-new-btn"
            class="btn btn-sm"
            type="button"
          >
            New
          </button>
          <button
            id="orchestration-template-run-save-btn"
            class="btn btn-success btn-sm"
            type="button"
          >
            Save
          </button>
          <button
            id="orchestration-template-run-delete-btn"
            class="btn btn-error btn-sm"
            type="button"
          >
            Delete
          </button>
        </div>
        <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
          <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div
              id="orchestration-template-vars-form-title"
              class="text-sm font-semibold text-slate-700"
            >
              Vars Form
            </div>
            <div class="inline-flex flex-wrap items-center gap-2">
              <button
                id="orchestration-template-vars-add-btn"
                class="btn btn-sm"
                type="button"
              >
                Add Var
              </button>
              <button
                id="orchestration-template-vars-sync-btn"
                class="btn btn-sm"
                type="button"
              >
                Sync From JSON
              </button>
              <button
                id="orchestration-template-vars-clear-btn"
                class="btn btn-sm"
                type="button"
              >
                Clear
              </button>
            </div>
          </div>
          <div id="orchestration-template-vars-form" class="grid gap-2"></div>
        </div>
        <textarea
          id="orchestration-template-vars-json"
          class="input min-h-20 font-mono hidden"
          placeholder={orchestrationTemplateVarsPlaceholder}
          aria-hidden="true"
        ></textarea>
        <div
          id="orchestration-template-run-hint"
          class="text-xs text-slate-500"
        >
          Select a saved orchestration template and execute it directly with
          runtime vars.
        </div>
        <div
          id="orchestration-template-edit-hint"
          class="text-xs text-slate-500"
        >
          You can edit the loaded orchestration plan in the JSON editor below
          before preview/execute.
        </div>
      </div>
    </div>
    <div id="orchestration-json-card" class="group-card">
      <div class="field-tools">
        <span id="orchestration-editor-title">Orchestration JSON</span>
        <div class="inline-flex flex-wrap items-center gap-2">
          <button
            id="orchestration-json-new-btn"
            class="btn btn-sm"
            type="button"
          >
            New
          </button>
          <button
            id="orchestration-import-file-btn"
            class="btn btn-sm"
            type="button"
          >
            Import JSON File
          </button>
        </div>
      </div>
      <div class="group-body grid gap-2">
        <div id="orchestration-json-hint" class="text-xs text-slate-500">
          Edit the raw orchestration plan JSON. Template execution also uses
          this same editor for preview and adjustments.
        </div>
        <div
          id="orchestration-json-editor"
          class="tx-json-editor tx-json-editor-compact hidden"
          aria-label="Orchestration JSON Editor"
        ></div>
        <textarea
          id="orchestration-json"
          class="input min-h-40 font-mono tx-json-fallback"
          placeholder={orchestrationJsonPlaceholder}
        ></textarea>
        <input
          id="orchestration-import-file-input"
          type="file"
          accept=".json,application/json"
          hidden
        />
      </div>
    </div>
    <div class="grid grid-cols-2 gap-2">
      <button id="orchestration-plan-btn" class="btn btn-sm" type="button">
        Preview Orchestration
      </button>
      <button
        id="orchestration-exec-btn"
        class="btn btn-primary btn-sm"
        type="button"
      >
        Execute Orchestration
      </button>
    </div>
    <div class="group-card">
      <div class="field-tools">
        <span id="orchestration-visual-title">Orchestration Visual Preview</span
        >
      </div>
      <div id="orchestration-visual" class="group-body grid gap-2"></div>
    </div>
    <div id="orchestration-plan-out" class="mt-2 grid gap-2"></div>
    <div id="orchestration-exec-out" class="mt-2 grid gap-2"></div>
  </div>
</div>
