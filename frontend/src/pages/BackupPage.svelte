<script>
  import { backupBehavior } from "../actions/backupBehavior.js";

  let { active = false } = $props();
</script>

<div
  id="panel-backup"
  class="tab-panel"
  role="tabpanel"
  hidden={!active}
  use:backupBehavior
>
  <h2 id="backup-title" class="text-xl font-semibold">Backup &amp; Restore</h2>
  <div class="mt-4 grid gap-3">
    <div class="group-card">
      <div class="field-tools">
        <span
          id="backup-create-title"
          class="text-sm font-semibold text-slate-700">Create Backup</span
        >
      </div>
      <div class="group-body grid gap-2 md:w-225">
        <input
          id="backup-output-path"
          class="input"
          placeholder="optional output path (.tar.gz)"
        />
        <div class="inline-flex flex-wrap items-center gap-2">
          <button id="backup-create-btn" class="mini-btn add" type="button">
            Create
          </button>
          <button id="backup-refresh-btn" class="btn btn-sm" type="button">
            Refresh
          </button>
        </div>
      </div>
    </div>
    <div class="group-card">
      <div class="field-tools">
        <span
          id="backup-list-title"
          class="text-sm font-semibold text-slate-700">Backup Archives</span
        >
      </div>
      <div class="group-body grid gap-2 md:w-225">
        <input
          id="backup-restore-archive"
          class="input"
          list="backup-archive-options"
          placeholder="select or input archive path"
        />
        <datalist id="backup-archive-options"></datalist>
        <div id="backup-selected-meta" class="text-xs text-slate-500">-</div>
        <div class="inline-flex flex-wrap items-center gap-2">
          <button id="backup-download-btn" class="btn btn-sm" type="button">
            Download
          </button>
          <button
            id="backup-restore-merge-btn"
            class="btn btn-sm"
            type="button"
          >
            Restore (Merge)
          </button>
          <button
            id="backup-restore-replace-btn"
            class="btn btn-sm btn-error"
            type="button"
          >
            Restore (Replace)
          </button>
        </div>
        <div id="backup-list" class="mt-2 grid gap-2"></div>
      </div>
    </div>
    <div id="backup-out" class="grid gap-2">-</div>
  </div>
</div>
