<script>
  import { i18nEn } from "../../i18n/en.js";
  import { i18nZh } from "../../i18n/zh.js";
  import { dashboardView } from "../../state/dashboardView.js";

  let { active = false } = $props();

  const tr = (key) => {
    const dict = $dashboardView.currentLang === "en" ? i18nEn : i18nZh;
    return dict[key] || i18nEn[key] || key;
  };
</script>

<div
  id="op-show-batch"
  class="grid gap-3"
  hidden={!active}
  style:display={active ? "" : "none"}
>
  <div class="grid items-start gap-2">
    <div class="connection-field">
      <span id="batch-show-object-label" class="connection-field-label"
        >Show object</span
      >
      <div class="dropdown dropdown-bottom w-full">
        <div class="connection-tags-input">
          <div
            id="batch-show-object-selected"
            class="flex flex-wrap items-center gap-2"
          ></div>
          <input
            id="batch-show-object-picker"
            class="min-w-32 flex-1 border-0 bg-transparent px-0 py-1 text-sm text-slate-900 outline-none placeholder:text-slate-400"
            placeholder="select show object"
          />
        </div>
        <div
          id="batch-show-object-menu"
          class="dropdown-content menu z-[120] mt-1 hidden max-h-56 w-full overflow-x-hidden overflow-y-auto rounded-box border border-base-300 bg-base-100 p-2 shadow-lg"
        ></div>
      </div>
      <select
        id="batch-show-object"
        class="hidden"
        multiple
        title="Show object"
        aria-label="Show object"
      ></select>
    </div>
    <select
      id="batch-show-mode"
      class="select w-full"
      title="Show Mode"
      aria-label="Show Mode"
    ></select>
  </div>

  <div class="connection-tags-grid">
    <div class="connection-field">
      <span id="batch-show-targets-label" class="connection-field-label"
        >设备</span
      >
      <div class="dropdown dropdown-bottom w-full">
        <div class="connection-tags-input">
          <div
            id="batch-show-targets-selected"
            class="flex flex-wrap items-center gap-2"
          ></div>
          <input
            id="batch-show-targets-picker"
            class="min-w-32 flex-1 border-0 bg-transparent px-0 py-1 text-sm text-slate-900 outline-none placeholder:text-slate-400"
            placeholder="select saved connections"
          />
        </div>
        <div
          id="batch-show-targets-menu"
          class="dropdown-content menu z-[120] mt-1 hidden max-h-56 w-full overflow-auto rounded-box border border-base-300 bg-base-100 p-2 shadow-lg"
        ></div>
      </div>
      <input id="batch-show-targets" type="hidden" />
    </div>

    <div class="connection-field">
      <span id="batch-show-groups-label" class="connection-field-label"
        >设备组</span
      >
      <div class="dropdown dropdown-bottom w-full">
        <div class="connection-tags-input">
          <div
            id="batch-show-groups-selected"
            class="flex flex-wrap items-center gap-2"
          ></div>
          <input
            id="batch-show-groups-picker"
            class="min-w-32 flex-1 border-0 bg-transparent px-0 py-1 text-sm text-slate-900 outline-none placeholder:text-slate-400"
            placeholder="select inventory groups"
          />
        </div>
        <div
          id="batch-show-groups-menu"
          class="dropdown-content menu z-[120] mt-1 hidden max-h-56 w-full overflow-auto rounded-box border border-base-300 bg-base-100 p-2 shadow-lg"
        ></div>
      </div>
      <select
        id="batch-show-groups"
        class="hidden"
        multiple
        title="Inventory Groups"
        aria-label="Inventory Groups"
      ></select>
    </div>

    <div class="connection-field">
      <span id="batch-show-labels-label" class="connection-field-label"
        >标签</span
      >
      <div class="dropdown dropdown-bottom w-full">
        <div class="connection-tags-input">
          <div
            id="batch-show-labels-selected"
            class="flex flex-wrap items-center gap-2"
          ></div>
          <input
            id="batch-show-labels-picker"
            class="min-w-32 flex-1 border-0 bg-transparent px-0 py-1 text-sm text-slate-900 outline-none placeholder:text-slate-400"
            placeholder="select labels/tags"
          />
        </div>
        <div
          id="batch-show-labels-menu"
          class="dropdown-content menu z-[120] mt-1 hidden max-h-56 w-full overflow-auto rounded-box border border-base-300 bg-base-100 p-2 shadow-lg"
        ></div>
      </div>
      <input id="batch-show-labels" type="hidden" />
    </div>
  </div>

  <label
    class="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"
  >
    <input
      id="batch-parse-textfsm"
      type="checkbox"
      class="toggle toggle-sm"
      checked
    />
    <span id="batch-textfsm-parse-label">{tr("textfsmParseToggle")}</span>
  </label>
  <div id="batch-textfsm-parse-hint" class="text-xs text-slate-500">
    {tr("batchTextfsmParseHint")}
  </div>
  <div id="batch-textfsm-extra-fields" class="grid gap-2 md:grid-cols-2">
    <select
      id="batch-textfsm-platform"
      class="select"
      title={tr("textfsmPlatformOverride")}
      aria-label={tr("textfsmPlatformOverride")}
    >
      <option value="">{tr("textfsmPlatformPlaceholder")}</option>
    </select>
    <input
      id="batch-textfsm-excel-name"
      class="input"
      placeholder={tr("batchShowExcelNamePlaceholder")}
    />
    <label
      class="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 md:col-span-2"
    >
      <input
        id="batch-textfsm-strict-errors"
        type="checkbox"
        class="toggle toggle-sm"
      />
      <span id="batch-textfsm-strict-errors-label"
        >{tr("textfsmStrictErrorsToggle")}</span
      >
    </label>
  </div>

  <div
    id="batch-show-command-preview"
    class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-600"
  >
    -
  </div>
  <div class="flex justify-end">
    <button
      id="batch-show-exec-btn"
      class="btn btn-primary btn-sm"
      type="button"
    >
      {tr("batchShowExecuteBtn")}
    </button>
  </div>
  <div id="batch-show-out" class="grid min-w-0 max-w-full gap-2"></div>
</div>
