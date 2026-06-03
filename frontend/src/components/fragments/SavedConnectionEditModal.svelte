<div
  id="saved-conn-edit-modal"
  class="fixed inset-0 hidden items-center justify-center overflow-y-auto bg-slate-950/55 px-4 py-6 md:py-10"
  style="z-index: 60"
  role="dialog"
  aria-modal="true"
  aria-labelledby="saved-conn-edit-title"
>
  <div class="dashboard-modal-card md:w-225">
    <div class="dashboard-modal-head">
      <div class="grid gap-1">
        <h3
          id="saved-conn-edit-title"
          class="text-base font-semibold text-slate-900"
        >
          Edit Saved Connection
        </h3>
        <p id="saved-conn-edit-hint" class="text-sm text-slate-500">
          Edit and save the selected connection profile.
        </p>
      </div>
      <button id="saved-conn-edit-close-btn" class="btn btn-sm" type="button">
        Close
      </button>
    </div>
    <div class="dashboard-modal-body">
      <div class="group-card dashboard-connection-editor-card">
        <div class="group-body connection-form-stack">
          <div class="connection-name-row">
            <div class="connection-field">
              <span
                id="saved-conn-edit-name-label"
                class="connection-field-label">Name</span
              >
              <input id="saved-conn-edit-name" class="input" readonly />
            </div>
            <label class="connection-toggle-label connection-toggle-card">
              <span id="saved-conn-edit-enabled-label">enabled</span>
              <input
                id="saved-conn-edit-enabled"
                type="checkbox"
                class="toggle toggle-sm"
                checked
              />
            </label>
          </div>
          <div class="dashboard-connection-form-grid">
            <input id="saved-conn-edit-host" class="input" placeholder="host" />
            <input
              id="saved-conn-edit-port"
              class="input"
              placeholder="port (default 22)"
            />
            <input
              id="saved-conn-edit-username"
              class="input"
              placeholder="username"
            />
            <input
              id="saved-conn-edit-password"
              class="input"
              placeholder="password"
              type="password"
            />
            <input
              id="saved-conn-edit-enable-password"
              class="input"
              placeholder="enable password (optional)"
              type="password"
            />
            <select
              id="saved-conn-edit-ssh-security"
              class="select"
              title="SSH Security Level"
              aria-label="SSH Security Level"
            >
              <option id="saved-conn-edit-ssh-security-option-default" value="">
                ssh security (default legacy-compatible)
              </option>
              <option
                id="saved-conn-edit-ssh-security-option-secure"
                value="secure"
              >
                secure
              </option>
              <option
                id="saved-conn-edit-ssh-security-option-balanced"
                value="balanced"
              >
                balanced
              </option>
              <option
                id="saved-conn-edit-ssh-security-option-legacy"
                value="legacy-compatible"
              >
                legacy-compatible
              </option>
            </select>
            <select
              id="saved-conn-edit-linux-shell-flavor"
              class="select"
              title="Linux Shell Flavor"
              aria-label="Linux Shell Flavor"
            >
              <option id="saved-conn-edit-linux-shell-option-default" value="">
                linux shell (default posix/bash)
              </option>
              <option
                id="saved-conn-edit-linux-shell-option-posix"
                value="posix"
              >
                posix/bash
              </option>
              <option id="saved-conn-edit-linux-shell-option-fish" value="fish">
                fish
              </option>
            </select>
            <select
              id="saved-conn-edit-device-profile"
              class="select"
              title="Device Profile"
              aria-label="Device Profile"
            ></select>
          </div>
          <div class="connection-extra-grid">
            <div class="connection-tags-grid">
              <div class="connection-field">
                <span
                  id="saved-conn-edit-labels-label"
                  class="connection-field-label">Labels</span
                >
                <div class="dropdown dropdown-bottom w-full">
                  <div class="connection-tags-input">
                    <div
                      id="saved-conn-edit-labels-selected"
                      class="flex flex-wrap items-center gap-2"
                    ></div>
                    <input
                      id="saved-conn-edit-labels-picker"
                      class="min-w-32 flex-1 border-0 bg-transparent px-0 py-1 text-sm text-slate-900 outline-none placeholder:text-slate-400"
                      placeholder="edge, core, dc-a"
                    />
                  </div>
                  <div
                    id="saved-conn-edit-labels-menu"
                    class="dropdown-content menu z-[120] mt-1 hidden max-h-56 w-full overflow-auto rounded-box border border-base-300 bg-base-100 p-2 shadow-lg"
                  ></div>
                </div>
                <input id="saved-conn-edit-labels" type="hidden" />
              </div>
              <div class="connection-field">
                <span
                  id="saved-conn-edit-groups-label"
                  class="connection-field-label">Groups</span
                >
                <div class="dropdown dropdown-bottom w-full">
                  <div class="connection-tags-input">
                    <div
                      id="saved-conn-edit-groups-selected"
                      class="flex flex-wrap items-center gap-2"
                    ></div>
                    <input
                      id="saved-conn-edit-groups-picker"
                      class="min-w-32 flex-1 border-0 bg-transparent px-0 py-1 text-sm text-slate-900 outline-none placeholder:text-slate-400"
                      placeholder="select inventory groups"
                    />
                  </div>
                  <div
                    id="saved-conn-edit-groups-menu"
                    class="dropdown-content menu z-[120] mt-1 hidden max-h-56 w-full overflow-auto rounded-box border border-base-300 bg-base-100 p-2 shadow-lg"
                  ></div>
                </div>
                <select
                  id="saved-conn-edit-groups"
                  class="hidden"
                  multiple
                  title="Inventory Groups"
                  aria-label="Inventory Groups"
                ></select>
              </div>
            </div>
            <div class="connection-field">
              <div class="connection-vars-head">
                <span
                  id="saved-conn-edit-vars-label"
                  class="connection-field-label">Vars</span
                >
                <button
                  id="saved-conn-edit-vars-add-btn"
                  class="btn btn-sm"
                  type="button"
                >
                  Add
                </button>
              </div>
              <div
                id="saved-conn-edit-vars-form"
                class="connection-vars-form"
              ></div>
              <input id="saved-conn-edit-vars" type="hidden" />
            </div>
          </div>
          <div class="inline-flex flex-wrap items-center gap-2">
            <button
              id="saved-conn-edit-detect-profile-btn"
              class="btn btn-sm"
              type="button"
            >
              Detect Profile
            </button>
            <button
              id="saved-conn-edit-apply-detected-profile-btn"
              class="btn btn-primary btn-sm"
              type="button"
              hidden
            >
              Replace With Detected Profile
            </button>
            <button
              id="saved-conn-edit-save-btn"
              class="btn btn-success btn-sm"
              type="button"
            >
              Save
            </button>
            <button
              id="saved-conn-edit-cancel-btn"
              class="btn btn-sm"
              type="button"
            >
              Cancel
            </button>
          </div>
          <div id="saved-conn-edit-out" class="grid gap-2"></div>
        </div>
      </div>
    </div>
  </div>
</div>
