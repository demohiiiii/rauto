<div class="grid gap-2 md:grid-cols-2">
  <input
    id="textfsm-template"
    class="input"
    placeholder="textfsm template file path (optional)"
  />
  <input
    id="textfsm-platform"
    class="input"
    placeholder="textfsm platform, e.g. cisco_ios"
  />
</div>
<label
  class="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"
>
  <input id="parse-textfsm" type="checkbox" class="toggle toggle-sm" />
  <span>Enable TextFSM parsing</span>
</label>
<div class="text-xs text-slate-500">
  Leave it off to skip parsing. Use a template file for manual parsing, or
  enable it with platform to let NTC templates auto-select the parser.
</div>
