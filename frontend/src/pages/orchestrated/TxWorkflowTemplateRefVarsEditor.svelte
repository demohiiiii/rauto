<script>
  import JsonObjectFieldsEditor from "../../components/fragments/JsonObjectFieldsEditor.svelte";
  import PresenceToggle from "../../components/fragments/PresenceToggle.svelte";
  let { jsonValueTypeRows, onVarsChange, onVarsPresenceChange, varsDisplay } =
    $props();
</script>

<div class="grid gap-2">
  <div class="flex flex-wrap items-center gap-3">
    <span class="text-sm font-semibold text-foreground">
      {varsDisplay.labelText}
    </span>
    <PresenceToggle
      checked={varsDisplay.present}
      onChange={onVarsPresenceChange}
    />
  </div>
  {#if varsDisplay.present}
    <JsonObjectFieldsEditor
      title={varsDisplay.labelText}
      source={varsDisplay.source}
      typeRows={jsonValueTypeRows}
      onChange={onVarsChange}
    />
  {/if}
</div>
