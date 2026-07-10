<script>
  import CollapsibleGroup from "../../components/fragments/CollapsibleGroup.svelte";
  import ReadonlyTextAreaField from "../../components/fragments/ReadonlyTextAreaField.svelte";

  let { templateInputDisplay } = $props();
</script>

<CollapsibleGroup persistenceKey="template-selected-content-body">
  {#snippet header()}
    <span>{templateInputDisplay.selectedContentTitle}</span>
  {/snippet}

  <ReadonlyTextAreaField
    class="min-h-40 font-mono"
    aria-label={templateInputDisplay.selectedContentField.ariaLabelText}
    placeholderText={templateInputDisplay.selectedContentField.placeholder}
    value={templateInputDisplay.selectedContentText}
  />
</CollapsibleGroup>
