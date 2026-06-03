<script>
  import { templatesBehavior } from "../actions/templatesBehavior.js";
  import {
    dashboardView,
    setDashboardTemplateSection,
  } from "../state/dashboardView.js";

  const templateSections = [
    ["templates", "template-section-btn-library", "Standard Templates"],
    ["flows", "template-section-btn-flows", "Command Flow Templates"],
  ];

  let { active = false } = $props();

  function openTemplateSection(section) {
    setDashboardTemplateSection(section);
    window.currentTemplateSection = section;
    window.onDashboardTemplateSectionChange?.(section);
  }
</script>

<div
  id="panel-templates"
  class="tab-panel"
  role="tabpanel"
  hidden={!active}
  use:templatesBehavior
>
  <h2 id="template-mgr-title" class="text-xl font-semibold">
    Template Manager
  </h2>
  <div
    class="mt-3 tabs tabs-box flex-wrap"
    role="tablist"
    aria-label="Template Sections"
  >
    {#each templateSections as [section, id, label]}
      <button
        {id}
        class="tab"
        class:tab-active={$dashboardView.currentTemplateSection === section}
        type="button"
        role="tab"
        aria-selected={(
          $dashboardView.currentTemplateSection === section
        ).toString()}
        onclick={() => openTemplateSection(section)}
      >
        {label}
      </button>
    {/each}
  </div>
  <div class="mt-4 grid gap-3">
    <div
      id="template-library-section"
      class="grid gap-3"
      hidden={$dashboardView.currentTemplateSection !== "templates"}
    >
      <div class="group-card">
        <div class="field-tools">
          <span
            id="template-list-title"
            class="text-sm font-semibold text-slate-700">Templates</span
          >
        </div>
        <div id="template-picker-body" class="group-body">
          <div class="grid gap-2 md:w-180">
            <div class="grid gap-2 md:grid-cols-[1fr_auto_auto]">
              <select
                id="template-pick-name"
                class="select"
                title="Template"
                aria-label="Template"
              ></select>
              <button
                id="template-save-btn"
                class="btn btn-success btn-sm"
                type="button"
              >
                Save
              </button>
              <button
                id="template-delete-btn"
                class="btn btn-error btn-sm"
                type="button"
              >
                Delete
              </button>
            </div>
          </div>
          <div id="template-list" class="mt-2 grid gap-2"></div>
        </div>
      </div>
      <div class="group-card">
        <div class="field-tools">
          <span
            id="template-editor-title"
            class="text-sm font-semibold text-slate-700">Editor</span
          >
          <button id="template-new-btn" class="btn btn-sm" type="button">
            New
          </button>
        </div>
        <div id="template-editor-body" class="group-body">
          <textarea
            id="template-content"
            class="input min-h-64 font-mono"
            placeholder="Template content"
          ></textarea>
        </div>
      </div>
      <div id="template-out" class="grid gap-2"></div>
    </div>
    <div
      id="template-flows-section"
      class="grid gap-3"
      hidden={$dashboardView.currentTemplateSection !== "flows"}
    >
      <div class="group-card">
        <div class="field-tools">
          <span
            id="flow-template-builtin-title"
            class="text-sm font-semibold text-slate-700"
          >
            Built-in Command Flow Templates
          </span>
        </div>
        <div class="group-body grid gap-3">
          <div class="grid gap-2 md:grid-cols-[1fr_auto_auto]">
            <select
              id="flow-template-builtin-picker"
              class="select"
              title="Built-in Command Flow Template"
              aria-label="Built-in Command Flow Template"
            ></select>
            <button
              id="flow-template-builtin-detail-btn"
              class="btn btn-sm"
              type="button"
            >
              View Detail
            </button>
            <button
              id="flow-template-builtin-copy-btn"
              class="btn btn-primary btn-sm"
              type="button"
            >
              Copy To Custom
            </button>
          </div>
          <div id="flow-template-builtin-hint" class="text-xs text-slate-500">
            Load built-in flow template as TOML, then copy to custom editor for
            reuse.
          </div>
          <div id="flow-template-builtin-list" class="grid gap-2"></div>
          <textarea
            id="flow-template-builtin-content"
            class="input min-h-48 font-mono"
            placeholder="Built-in command flow template TOML"
            readonly
          ></textarea>
        </div>
      </div>
      <div class="group-card">
        <div class="field-tools">
          <span
            id="flow-template-mgr-title"
            class="text-sm font-semibold text-slate-700"
          >
            Command Flow Templates
          </span>
        </div>
        <div class="group-body grid gap-3">
          <div class="grid gap-2 md:grid-cols-[1fr_auto_auto]">
            <select
              id="flow-template-picker"
              class="select"
              title="Command Flow Template"
              aria-label="Command Flow Template"
            ></select>
            <button
              id="flow-template-save-btn"
              class="btn btn-success btn-sm"
              type="button"
            >
              Save Template
            </button>
            <button
              id="flow-template-delete-btn"
              class="btn btn-error btn-sm"
              type="button"
            >
              Delete
            </button>
          </div>
          <div id="flow-template-manage-hint" class="text-xs text-slate-500">
            Choose a saved command flow template, or create a new one.
          </div>
          <div id="flow-template-list" class="grid gap-2"></div>
          <div class="field-tools">
            <span class="text-sm font-semibold text-slate-700"></span>
            <button id="flow-template-new-btn" class="btn btn-sm" type="button">
              New
            </button>
          </div>
          <textarea
            id="flow-template-content"
            class="input min-h-64 font-mono"
            placeholder="Command flow template TOML"
          ></textarea>
          <div id="flow-template-out" class="grid gap-2"></div>
        </div>
      </div>
    </div>
  </div>
</div>
