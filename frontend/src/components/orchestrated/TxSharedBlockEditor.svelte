<script>
  import {
    txBlockJsonPlaceholder,
    txBlockTemplateVarsPlaceholder,
    txBlockVarsPlaceholder,
  } from "./placeholders.js";
</script>

<div id="tx-shared-editor-section" class="grid gap-2" hidden>
  <div
    class="tabs tabs-box w-fit"
    role="tablist"
    aria-label="Tx block page mode tabs"
  >
    <button id="tx-block-view-direct" class="tab tab-active" type="button">
      Direct Execute
    </button>
    <button id="tx-block-view-template" class="tab" type="button">
      Template Execute
    </button>
  </div>
  <div id="tx-block-view-direct-panel" class="group-card">
    <div class="group-body grid gap-2">
      <div id="tx-block-view-direct-hint" class="text-xs text-slate-500">
        Edit and execute a raw tx block JSON document, aligned with CLI input.
      </div>
      <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
        <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div
            id="tx-block-direct-vars-form-title"
            class="text-sm font-semibold text-slate-700"
          >
            Vars Form
          </div>
          <div class="inline-flex flex-wrap items-center gap-2">
            <button
              id="tx-block-direct-vars-add-btn"
              class="btn btn-sm"
              type="button"
            >
              Add Var
            </button>
            <button
              id="tx-block-direct-vars-sync-btn"
              class="btn btn-sm"
              type="button"
            >
              Sync From JSON
            </button>
            <button
              id="tx-block-direct-vars-clear-btn"
              class="btn btn-sm"
              type="button"
            >
              Clear
            </button>
          </div>
        </div>
        <div id="tx-block-direct-vars-form" class="grid gap-2"></div>
      </div>
      <textarea
        id="tx-block-direct-vars"
        class="input min-h-20 font-mono"
        placeholder={txBlockVarsPlaceholder}
      ></textarea>
      <div id="tx-block-direct-vars-hint" class="text-xs text-slate-500">
        Optional runtime vars for direct tx block rendering. Supports connection
        aliases and current connection fallbacks.
      </div>
    </div>
  </div>
  <div id="tx-block-view-template-panel" class="group-card" hidden>
    <div class="group-body grid gap-2">
      <div class="grid gap-2 md:grid-cols-[1fr_auto_auto_auto]">
        <select
          id="tx-block-template-name"
          class="select"
          title="Tx Block Template"
          aria-label="Tx Block Template"
        ></select>
        <button
          id="tx-block-template-run-new-btn"
          class="btn btn-sm"
          type="button"
        >
          New
        </button>
        <button
          id="tx-block-template-run-save-btn"
          class="btn btn-success btn-sm"
          type="button"
        >
          Save
        </button>
        <button
          id="tx-block-template-run-delete-btn"
          class="btn btn-error btn-sm"
          type="button"
        >
          Delete
        </button>
      </div>
      <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
        <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div
            id="tx-block-template-vars-form-title"
            class="text-sm font-semibold text-slate-700"
          >
            Vars Form
          </div>
          <div class="inline-flex flex-wrap items-center gap-2">
            <button
              id="tx-block-template-vars-add-btn"
              class="btn btn-sm"
              type="button"
            >
              Add Var
            </button>
            <button
              id="tx-block-template-vars-sync-btn"
              class="btn btn-sm"
              type="button"
            >
              Sync From JSON
            </button>
            <button
              id="tx-block-template-vars-clear-btn"
              class="btn btn-sm"
              type="button"
            >
              Clear
            </button>
          </div>
        </div>
        <div id="tx-block-template-vars-form" class="grid gap-2"></div>
      </div>
      <textarea
        id="tx-block-template-vars"
        class="input min-h-20 font-mono"
        placeholder={txBlockTemplateVarsPlaceholder}
      ></textarea>
      <div id="tx-block-template-run-hint" class="text-xs text-slate-500">
        Load a saved tx block JSON template, edit its JSON body below, and
        execute it with runtime vars.
      </div>
    </div>
  </div>
  <div id="tx-shared-editor-card" class="group-card">
    <div class="field-tools">
      <span id="tx-block-editor-title">Tx Block JSON</span>
      <button id="tx-block-editor-new-btn" class="btn btn-sm" type="button">
        New
      </button>
    </div>
    <div class="group-body grid gap-2">
      <div id="tx-block-json-hint" class="text-xs text-slate-500">
        Use the same raw tx block JSON shape as CLI. Templates also render to
        this exact JSON structure before execution.
      </div>
      <div
        id="tx-block-json-editor"
        class="tx-json-editor hidden"
        aria-label="Tx Block JSON Editor"
      ></div>
      <textarea
        id="tx-block-json"
        class="input min-h-80 font-mono tx-json-fallback"
        placeholder={txBlockJsonPlaceholder}
      ></textarea>
    </div>
  </div>
</div>
