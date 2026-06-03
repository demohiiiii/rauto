<script>
  import { uploadBehavior } from "../actions/uploadBehavior.js";

  let { active = false } = $props();
</script>

<div
  id="panel-transfer"
  class="tab-panel"
  role="tabpanel"
  hidden={!active}
  use:uploadBehavior
>
  <h2 id="transfer-title" class="text-xl font-semibold">SFTP Upload</h2>
  <div class="mt-4 grid gap-3">
    <div class="group-card">
      <div class="field-tools">
        <span id="upload-title" class="text-sm font-semibold text-slate-700"
          >SFTP Upload</span
        >
      </div>
      <div class="group-body grid gap-2">
        <div class="grid gap-2 md:grid-cols-2">
          <input
            id="upload-local-path"
            class="input"
            placeholder="local file path on the machine running rauto"
          />
          <input
            id="upload-remote-path"
            class="input"
            placeholder="remote destination path"
          />
        </div>
        <div class="grid gap-2 md:grid-cols-2">
          <input
            id="upload-timeout-secs"
            class="input"
            placeholder="timeout secs (default 300)"
          />
          <input
            id="upload-buffer-size"
            class="input"
            placeholder="buffer size bytes (optional)"
          />
        </div>
        <label class="check-label">
          <input
            id="upload-show-progress"
            type="checkbox"
            class="check-input"
          />
          <span id="upload-show-progress-label">show progress</span>
        </label>
        <div class="grid gap-2 md:grid-cols-[1fr_auto]">
          <div class="text-xs text-slate-500" id="upload-hint">
            The local file path is resolved on the host running rauto.
          </div>
          <button
            id="upload-exec-btn"
            class="btn btn-primary btn-sm"
            type="button"
          >
            Run Upload
          </button>
        </div>
        <div id="upload-out" class="grid gap-2"></div>
      </div>
    </div>
  </div>
</div>
