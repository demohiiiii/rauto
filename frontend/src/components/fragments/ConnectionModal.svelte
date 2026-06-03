<script>
  import {
    closeDashboardConnectionModal,
    dashboardView,
    setDashboardConnectionModalMode,
  } from "../../state/dashboardView.js";

  function closeConnectionModal() {
    closeDashboardConnectionModal();
  }

  function setConnectionModalMode(mode) {
    setDashboardConnectionModalMode(mode);
    window.onDashboardConnectionModalModeChange?.(mode);
  }

  function closeOnBackdrop(event) {
    if (event.target === event.currentTarget) {
      closeConnectionModal();
    }
  }

  function closeOnEscape(event) {
    if (event.key === "Escape") {
      closeConnectionModal();
    }
  }
</script>

<div
  id="connection-modal"
  class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4"
  role="dialog"
  aria-modal="true"
  aria-labelledby="connection-title"
  tabindex="-1"
  hidden={!$dashboardView.connectionModalOpen}
  onclick={closeOnBackdrop}
  onkeydown={closeOnEscape}
>
  <div class="dashboard-modal-card">
    <div class="dashboard-modal-head">
      <div class="grid gap-1">
        <h3
          id="connection-title"
          class="text-base font-semibold text-slate-900"
        >
          Connection Workspace
        </h3>
        <p id="connection-workspace-subtitle" class="text-sm text-slate-500">
          Use a saved connection or override the current execution target
          inline.
        </p>
      </div>
      <div class="inline-flex items-center gap-2">
        <button id="connection-test-btn" class="btn btn-sm" type="button">
          Test Connection
        </button>
        <button
          id="connection-modal-close"
          class="btn btn-sm"
          type="button"
          onclick={closeConnectionModal}
        >
          Close
        </button>
      </div>
    </div>
    <div class="dashboard-modal-body">
      <div class="tabs tabs-lift connection-modal-tabs w-fit">
        <button
          id="connection-modal-tab-saved"
          type="button"
          class="tab"
          class:tab-active={$dashboardView.connectionModalMode === "saved"}
          onclick={() => setConnectionModalMode("saved")}
        >
          Saved Library
        </button>
        <button
          id="connection-modal-tab-temporary"
          type="button"
          class="tab"
          class:tab-active={$dashboardView.connectionModalMode === "temporary"}
          onclick={() => setConnectionModalMode("temporary")}
        >
          Temporary / New
        </button>
      </div>

      <div
        class="group-card dashboard-connection-library"
        hidden={$dashboardView.connectionModalMode !== "saved"}
      >
        <div class="field-tools">
          <div class="grid gap-1">
            <span
              id="saved-conn-title"
              class="text-sm font-semibold text-slate-700"
              >Saved Connections</span
            >
            <span id="saved-conn-subtitle" class="text-xs text-slate-500">
              Pick a reusable connection profile or update it in place.
            </span>
          </div>
          <div class="inline-flex flex-wrap items-center gap-2">
            <button
              id="saved-conn-template-btn"
              class="btn btn-sm"
              type="button"
            >
              Download Template
            </button>
            <button id="saved-conn-import-btn" class="btn btn-sm" type="button">
              Import CSV/Excel
            </button>
          </div>
        </div>
        <div id="saved-conn-body" class="group-body">
          <div class="grid gap-3">
            <select
              id="saved-conn-name"
              class="select"
              title="Saved Connection"
              aria-label="Saved Connection"
            ></select>
            <div class="inline-flex flex-wrap items-center gap-2">
              <button id="saved-conn-use-btn" class="btn btn-sm" type="button">
                Use
              </button>
              <button id="saved-conn-edit-btn" class="btn btn-sm" type="button">
                Edit
              </button>
              <button
                id="saved-conn-delete-btn"
                class="btn btn-sm btn-error"
                type="button"
              >
                Delete
              </button>
              <button
                id="saved-conn-history-btn"
                class="btn btn-sm hidden"
                type="button"
              >
                History
              </button>
            </div>
          </div>
          <input
            id="saved-conn-import-file-input"
            type="file"
            accept=".csv,.xlsx,.xls,.xlsm,.xlsb,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            hidden
          />
          <div id="saved-conn-out" class="grid gap-2"></div>
        </div>
      </div>

      <div
        class="group-card dashboard-connection-main"
        hidden={$dashboardView.connectionModalMode !== "temporary"}
      >
        <div class="field-tools">
          <span
            id="connection-quick-title"
            class="text-sm font-semibold text-slate-700">Execution Target</span
          >
          <div class="inline-flex items-center gap-2">
            <span id="connection-help" class="text-xs text-slate-500">
              Leave empty to fallback to CLI defaults used at server startup.
            </span>
            <button
              id="saved-conn-new-btn"
              class="btn btn-sm btn-primary"
              type="button"
            >
              New
            </button>
          </div>
        </div>
        <div class="group-body connection-form-stack">
          <div class="dashboard-connection-form-grid">
            <input id="host" class="input" placeholder="host" />
            <input id="port" class="input" placeholder="port (default 22)" />
            <input id="username" class="input" placeholder="username" />
            <input
              id="password"
              class="input"
              placeholder="password"
              type="password"
            />
            <input
              id="enable_password"
              class="input"
              placeholder="enable password (optional)"
              type="password"
            />
            <select
              id="ssh_security"
              class="select"
              title="SSH Security Level"
              aria-label="SSH Security Level"
            >
              <option id="ssh-security-option-default" value="">
                ssh security (default legacy-compatible)
              </option>
              <option id="ssh-security-option-secure" value="secure">
                secure
              </option>
              <option id="ssh-security-option-balanced" value="balanced">
                balanced
              </option>
              <option id="ssh-security-option-legacy" value="legacy-compatible">
                legacy-compatible
              </option>
            </select>
            <select
              id="linux_shell_flavor"
              class="select"
              title="Linux Shell Flavor"
              aria-label="Linux Shell Flavor"
            >
              <option id="linux-shell-option-default" value="">
                linux shell (default posix/bash)
              </option>
              <option id="linux-shell-option-posix" value="posix">
                posix/bash
              </option>
              <option id="linux-shell-option-fish" value="fish"> fish </option>
            </select>
            <select
              id="device_profile"
              class="select"
              title="Device Profile"
              aria-label="Device Profile"
            ></select>
          </div>
          <div class="connection-extra-grid">
            <div class="connection-options-row">
              <label class="connection-toggle-label">
                <span id="saved-conn-enabled-label">enabled</span>
                <input
                  id="saved-conn-enabled"
                  type="checkbox"
                  class="toggle toggle-sm"
                  checked
                />
              </label>
            </div>
            <div class="connection-tags-grid">
              <div class="connection-field">
                <span
                  id="saved-conn-labels-label"
                  class="connection-field-label">Labels</span
                >
                <div class="dropdown dropdown-bottom w-full">
                  <div class="connection-tags-input">
                    <div
                      id="saved-conn-labels-selected"
                      class="flex flex-wrap items-center gap-2"
                    ></div>
                    <input
                      id="saved-conn-labels-picker"
                      class="min-w-32 flex-1 border-0 bg-transparent px-0 py-1 text-sm text-slate-900 outline-none placeholder:text-slate-400"
                      placeholder="edge, core, dc-a"
                    />
                  </div>
                  <div
                    id="saved-conn-labels-menu"
                    class="dropdown-content menu z-[120] mt-1 hidden max-h-56 w-full overflow-auto rounded-box border border-base-300 bg-base-100 p-2 shadow-lg"
                  ></div>
                </div>
                <input id="saved-conn-labels" type="hidden" />
              </div>
              <div class="connection-field">
                <span
                  id="saved-conn-groups-label"
                  class="connection-field-label">Groups</span
                >
                <div class="dropdown dropdown-bottom w-full">
                  <div class="connection-tags-input">
                    <div
                      id="saved-conn-groups-selected"
                      class="flex flex-wrap items-center gap-2"
                    ></div>
                    <input
                      id="saved-conn-groups-picker"
                      class="min-w-32 flex-1 border-0 bg-transparent px-0 py-1 text-sm text-slate-900 outline-none placeholder:text-slate-400"
                      placeholder="select inventory groups"
                    />
                  </div>
                  <div
                    id="saved-conn-groups-menu"
                    class="dropdown-content menu z-[120] mt-1 hidden max-h-56 w-full overflow-auto rounded-box border border-base-300 bg-base-100 p-2 shadow-lg"
                  ></div>
                </div>
                <select
                  id="saved-conn-groups"
                  class="hidden"
                  multiple
                  title="Inventory Groups"
                  aria-label="Inventory Groups"
                ></select>
              </div>
            </div>
            <div class="connection-field">
              <div class="connection-vars-head">
                <span id="saved-conn-vars-label" class="connection-field-label"
                  >Vars</span
                >
                <button
                  id="saved-conn-vars-add-btn"
                  class="btn btn-sm"
                  type="button"
                >
                  Add
                </button>
              </div>
              <div id="saved-conn-vars-form" class="connection-vars-form"></div>
              <input id="saved-conn-vars" type="hidden" />
            </div>
          </div>
          <div id="connection-temp-hint" class="text-xs text-slate-500">
            Fill host, username, password, and profile here, then apply it as a
            temporary execution target.
          </div>
          <div class="inline-flex flex-wrap items-center gap-2">
            <button
              id="connection-temp-apply-btn"
              class="btn btn-primary btn-sm"
              type="button"
            >
              Apply Temporary
            </button>
          </div>
          <div id="connection-test-out" class="grid gap-2"></div>
        </div>
      </div>
    </div>
  </div>
</div>
