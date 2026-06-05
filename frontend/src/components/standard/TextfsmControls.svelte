<script>
  import { i18nEn } from "../../i18n/en.js";
  import { i18nZh } from "../../i18n/zh.js";
  import { dashboardView } from "../../state/dashboardView.js";

  let { defaultEnabled = false } = $props();

  const tr = (key) => {
    const dict = $dashboardView.currentLang === "en" ? i18nEn : i18nZh;
    return dict[key] || i18nEn[key] || key;
  };
</script>

<label
  class="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"
>
  <input
    id="parse-textfsm"
    type="checkbox"
    class="toggle toggle-sm"
    checked={defaultEnabled}
  />
  <span>{tr("textfsmParseToggle")}</span>
</label>
<div id="textfsm-parse-hint" class="text-xs text-slate-500">
  {tr("textfsmParseHint")}
</div>
<div
  id="textfsm-extra-fields"
  class="grid gap-2 md:grid-cols-2"
  hidden={!defaultEnabled}
>
  <input
    id="textfsm-template"
    class="input"
    placeholder={tr("textfsmTemplatePlaceholder")}
  />
  <select
    id="textfsm-platform"
    class="select"
    title="TextFSM platform override"
    aria-label="TextFSM platform override"
  >
    <option value="">{tr("textfsmPlatformPlaceholder")}</option>
  </select>
</div>
