<script lang="ts">
  import JsonObjectFieldsEditor from "$components/fragments/JsonObjectFieldsEditor.svelte";
  import PresenceToggle from "$components/fragments/PresenceToggle.svelte";
  import type {
    JsonObject,
    TxWorkflowTemplateRefVarsDisplay,
  } from "$domains/transactions/index.js";

  interface CheckedChangeEvent {
    currentTarget: { checked: boolean };
    target: { checked: boolean };
  }

  interface Props {
    jsonValueTypeRows?: readonly string[];
    onVarsChange?: ((value: JsonObject) => void) | null;
    onVarsPresenceChange?: ((event: CheckedChangeEvent) => void) | null;
    varsDisplay: TxWorkflowTemplateRefVarsDisplay;
  }

  let {
    jsonValueTypeRows = [],
    onVarsChange = null,
    onVarsPresenceChange = null,
    varsDisplay,
  }: Props = $props();
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
      typeRows={[...jsonValueTypeRows]}
      onChange={onVarsChange}
    />
  {/if}
</div>
