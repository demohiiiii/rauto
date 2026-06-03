<script>
  import {
    txWorkflowJsonPlaceholder,
    txWorkflowTemplateVarsPlaceholder,
    txWorkflowVarsPlaceholder,
  } from "./placeholders.js";

  let { active = false } = $props();
</script>

<div id="tx-stage-workflow-panel" class="grid gap-2" hidden={!active}>
  <div id="tx-workflow-section" class="grid gap-2">
    <div
      class="tabs tabs-box w-fit"
      role="tablist"
      aria-label="Tx workflow page mode tabs"
    >
      <button id="tx-workflow-view-direct" class="tab tab-active" type="button">
        Direct Execute
      </button>
      <button id="tx-workflow-view-template" class="tab" type="button">
        Template Execute
      </button>
    </div>
    <div id="tx-workflow-view-direct-panel" class="group-card">
      <div class="group-body grid gap-2">
        <div id="tx-workflow-view-direct-hint" class="text-xs text-slate-500">
          Use the workflow editor form below for direct execution.
        </div>
        <div class="inline-flex flex-wrap items-center gap-2">
          <button
            id="tx-workflow-json-new-btn"
            class="btn btn-sm"
            type="button"
          >
            New
          </button>
          <button
            id="tx-workflow-import-file-btn"
            class="btn btn-sm"
            type="button"
          >
            Import JSON File
          </button>
        </div>
        <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
          <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div
              id="tx-workflow-direct-vars-form-title"
              class="text-sm font-semibold text-slate-700"
            >
              Vars Form
            </div>
            <div class="inline-flex flex-wrap items-center gap-2">
              <button
                id="tx-workflow-direct-vars-add-btn"
                class="btn btn-sm"
                type="button"
              >
                Add Var
              </button>
              <button
                id="tx-workflow-direct-vars-sync-btn"
                class="btn btn-sm"
                type="button"
              >
                Sync From JSON
              </button>
              <button
                id="tx-workflow-direct-vars-clear-btn"
                class="btn btn-sm"
                type="button"
              >
                Clear
              </button>
            </div>
          </div>
          <div id="tx-workflow-direct-vars-form" class="grid gap-2"></div>
        </div>
        <textarea
          id="tx-workflow-vars-json"
          class="input min-h-20 font-mono"
          placeholder={txWorkflowVarsPlaceholder}
        ></textarea>
        <div id="tx-workflow-vars-hint" class="text-xs text-slate-500">
          Supports direct refs like edge94.host and fallback lookups by key
          name.
        </div>
        <div
          id="tx-workflow-json-editor"
          class="tx-json-editor tx-json-editor-compact hidden"
          aria-label="Tx Workflow JSON Editor"
        ></div>
        <textarea
          id="tx-workflow-json"
          class="input min-h-40 font-mono tx-json-fallback"
          placeholder={txWorkflowJsonPlaceholder}
        ></textarea>
        <input
          id="tx-workflow-import-file-input"
          type="file"
          accept=".json,application/json"
          hidden
        />
      </div>
    </div>
    <div id="tx-workflow-view-template-panel" class="group-card" hidden>
      <div class="group-body grid gap-2">
        <div class="grid gap-2 md:grid-cols-[1fr_auto_auto_auto]">
          <select
            id="tx-workflow-template-name"
            class="select"
            title="Tx Workflow Template"
            aria-label="Tx Workflow Template"
          ></select>
          <button
            id="tx-workflow-template-run-new-btn"
            class="btn btn-sm"
            type="button"
          >
            New
          </button>
          <button
            id="tx-workflow-template-run-save-btn"
            class="btn btn-success btn-sm"
            type="button"
          >
            Save
          </button>
          <button
            id="tx-workflow-template-run-delete-btn"
            class="btn btn-error btn-sm"
            type="button"
          >
            Delete
          </button>
        </div>
        <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
          <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div
              id="tx-workflow-template-vars-form-title"
              class="text-sm font-semibold text-slate-700"
            >
              Vars Form
            </div>
            <div class="inline-flex flex-wrap items-center gap-2">
              <button
                id="tx-workflow-template-vars-add-btn"
                class="btn btn-sm"
                type="button"
              >
                Add Var
              </button>
              <button
                id="tx-workflow-template-vars-sync-btn"
                class="btn btn-sm"
                type="button"
              >
                Sync From JSON
              </button>
              <button
                id="tx-workflow-template-vars-clear-btn"
                class="btn btn-sm"
                type="button"
              >
                Clear
              </button>
            </div>
          </div>
          <div id="tx-workflow-template-vars-form" class="grid gap-2"></div>
        </div>
        <textarea
          id="tx-workflow-template-vars-json"
          class="input min-h-20 font-mono"
          placeholder={txWorkflowTemplateVarsPlaceholder}
        ></textarea>
        <div id="tx-workflow-template-run-hint" class="text-xs text-slate-500">
          Select a saved workflow template and execute it with runtime vars.
        </div>
      </div>
    </div>
    <div class="grid grid-cols-2 gap-2">
      <button id="tx-workflow-plan-btn" class="btn btn-sm" type="button">
        Preview Workflow
      </button>
      <button
        id="tx-workflow-exec-btn"
        class="btn btn-primary btn-sm"
        type="button"
      >
        Execute Workflow
      </button>
    </div>
    <div class="group-card">
      <div class="field-tools">
        <span id="tx-workflow-visual-title">Workflow Visual Preview</span>
      </div>
      <div id="tx-workflow-plan-visual" class="group-body grid gap-2"></div>
    </div>
    <div id="tx-workflow-plan-out" class="mt-2 grid gap-2"></div>
    <div id="tx-workflow-exec-out" class="mt-2 grid gap-2"></div>
  </div>
</div>
