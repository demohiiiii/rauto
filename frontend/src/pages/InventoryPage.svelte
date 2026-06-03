<script>
  import { inventoryBehavior } from "../actions/inventoryBehavior.js";
  import {
    dashboardView,
    setDashboardInventorySection,
  } from "../state/dashboardView.js";

  const inventorySections = [
    ["groups", "inventory-tab-groups", "Groups"],
    ["labels", "inventory-tab-labels", "Labels"],
  ];
  const groupVarsPlaceholder = '{"region":"sh"}';

  let { active = false } = $props();

  function openInventorySection(section) {
    setDashboardInventorySection(section);
    window.currentInventorySection = section;
    window.onDashboardInventorySectionChange?.(section);
  }
</script>

<div
  id="panel-inventory"
  class="tab-panel"
  role="tabpanel"
  hidden={!active}
  use:inventoryBehavior
>
  <h2 id="inventory-title" class="text-xl font-semibold">Inventory</h2>
  <!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
  <nav
    class="mt-3 tabs tabs-box w-fit"
    aria-label="Inventory Tabs"
    role="tablist"
    aria-orientation="horizontal"
  >
    {#each inventorySections as [section, id, label]}
      <button
        {id}
        class="tab"
        class:tab-active={$dashboardView.currentInventorySection === section}
        type="button"
        role="tab"
        aria-selected={(
          $dashboardView.currentInventorySection === section
        ).toString()}
        onclick={() => openInventorySection(section)}
      >
        {label}
      </button>
    {/each}
  </nav>
  <div
    id="inventory-groups-section"
    class="mt-4 grid gap-3 xl:grid-cols-[0.9fr_1.1fr]"
    hidden={$dashboardView.currentInventorySection !== "groups"}
  >
    <div class="group-card">
      <div class="field-tools">
        <span
          id="inventory-groups-title"
          class="text-sm font-semibold text-slate-700">Groups</span
        >
      </div>
      <div class="group-body grid gap-3">
        <select
          id="inventory-group-picker"
          class="select"
          title="Inventory Group"
          aria-label="Inventory Group"
        ></select>
        <div id="inventory-group-list" class="grid gap-2"></div>
      </div>
    </div>
    <div class="group-card">
      <div class="field-tools">
        <span
          id="inventory-group-editor-title"
          class="text-sm font-semibold text-slate-700">Group Editor</span
        >
        <div class="inline-flex flex-wrap items-center gap-2">
          <button id="inventory-group-new-btn" class="btn btn-sm" type="button">
            New
          </button>
          <button
            id="inventory-group-save-btn"
            class="btn btn-success btn-sm"
            type="button"
          >
            Save
          </button>
          <button
            id="inventory-group-delete-btn"
            class="btn btn-error btn-sm"
            type="button"
          >
            Delete
          </button>
        </div>
      </div>
      <div class="group-body grid gap-3">
        <div class="grid gap-2 md:grid-cols-2">
          <div class="grid gap-1">
            <span
              id="inventory-group-name-label"
              class="text-xs font-semibold text-slate-500">Name</span
            >
            <div
              id="inventory-group-name-value"
              class="input flex items-center bg-slate-50 text-slate-700"
            >
              —
            </div>
          </div>
          <div class="grid gap-1">
            <span
              id="inventory-group-description-label"
              class="text-xs font-semibold text-slate-500">Description</span
            >
            <input
              id="inventory-group-description"
              class="input"
              placeholder="group description"
            />
          </div>
        </div>
        <div class="grid gap-1">
          <span
            id="inventory-group-hosts-label"
            class="text-xs font-semibold text-slate-500">Saved Connections</span
          >
          <div class="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto]">
            <input
              id="inventory-group-hosts-filter"
              class="input"
              placeholder="filter saved connections"
            />
            <button
              id="inventory-group-hosts-select-all-btn"
              class="btn btn-sm btn-ghost"
              type="button"
            >
              All
            </button>
            <button
              id="inventory-group-hosts-clear-btn"
              class="btn btn-sm btn-ghost"
              type="button"
            >
              Clear
            </button>
          </div>
          <div
            id="inventory-group-hosts"
            class="rounded-box border border-base-300 bg-base-100 min-h-40 max-h-72 overflow-auto p-2"
          ></div>
          <div
            id="inventory-group-hosts-empty"
            class="text-xs text-slate-500"
            hidden
          >
            no saved connections
          </div>
        </div>
        <div class="grid gap-1">
          <span
            id="inventory-group-vars-label"
            class="text-xs font-semibold text-slate-500">Vars</span
          >
          <textarea
            id="inventory-group-vars"
            class="input min-h-48 font-mono"
            placeholder={groupVarsPlaceholder}
          ></textarea>
        </div>
        <div id="inventory-group-out" class="grid gap-2"></div>
      </div>
    </div>
  </div>

  <div
    id="inventory-labels-section"
    class="mt-4 grid gap-3 xl:grid-cols-[0.9fr_1.1fr]"
    hidden={$dashboardView.currentInventorySection !== "labels"}
  >
    <div class="group-card">
      <div class="field-tools">
        <span
          id="inventory-labels-title"
          class="text-sm font-semibold text-slate-700">Labels</span
        >
      </div>
      <div class="group-body grid gap-3">
        <select
          id="inventory-label-picker"
          class="select"
          title="Inventory Label"
          aria-label="Inventory Label"
        ></select>
        <div id="inventory-label-list" class="grid gap-2"></div>
      </div>
    </div>
    <div class="group-card">
      <div class="field-tools">
        <span
          id="inventory-label-editor-title"
          class="text-sm font-semibold text-slate-700">Label Editor</span
        >
        <div class="inline-flex flex-wrap items-center gap-2">
          <button id="inventory-label-new-btn" class="btn btn-sm" type="button">
            New
          </button>
          <button
            id="inventory-label-save-btn"
            class="btn btn-success btn-sm"
            type="button"
          >
            Save
          </button>
          <button
            id="inventory-label-delete-btn"
            class="btn btn-error btn-sm"
            type="button"
          >
            Delete
          </button>
        </div>
      </div>
      <div class="group-body grid gap-3">
        <div class="grid gap-1">
          <span
            id="inventory-label-name-label"
            class="text-xs font-semibold text-slate-500">Name</span
          >
          <div
            id="inventory-label-name-value"
            class="input flex items-center bg-slate-50 text-slate-700"
          >
            —
          </div>
        </div>
        <div class="grid gap-1">
          <span
            id="inventory-label-hosts-label"
            class="text-xs font-semibold text-slate-500">Saved Connections</span
          >
          <div class="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto]">
            <input
              id="inventory-label-hosts-filter"
              class="input"
              placeholder="filter saved connections"
            />
            <button
              id="inventory-label-hosts-select-all-btn"
              class="btn btn-sm btn-ghost"
              type="button"
            >
              All
            </button>
            <button
              id="inventory-label-hosts-clear-btn"
              class="btn btn-sm btn-ghost"
              type="button"
            >
              Clear
            </button>
          </div>
          <div
            id="inventory-label-hosts"
            class="rounded-box border border-base-300 bg-base-100 min-h-40 max-h-72 overflow-auto p-2"
          ></div>
          <div
            id="inventory-label-hosts-empty"
            class="text-xs text-slate-500"
            hidden
          >
            no saved connections
          </div>
        </div>
        <div id="inventory-label-out" class="grid gap-2"></div>
      </div>
    </div>
  </div>
</div>
