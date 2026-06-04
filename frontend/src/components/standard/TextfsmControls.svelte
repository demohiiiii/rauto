<script>
  let { defaultEnabled = false } = $props();
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
  <span>Enable TextFSM parsing</span>
</label>
<div id="textfsm-parse-hint" class="text-xs text-slate-500">
  Leave it off to skip parsing. Use a template file for manual parsing, or
  enable it with platform to let NTC templates auto-select the parser.
</div>
<div
  id="textfsm-extra-fields"
  class="grid gap-2 md:grid-cols-2"
  hidden={!defaultEnabled}
>
  <input
    id="textfsm-template"
    class="input"
    placeholder="textfsm template file path (optional)"
  />
  <select
    id="textfsm-platform"
    class="select"
    title="TextFSM platform override"
    aria-label="TextFSM platform override"
  >
    <option value="">不覆盖平台</option>
  </select>
</div>
