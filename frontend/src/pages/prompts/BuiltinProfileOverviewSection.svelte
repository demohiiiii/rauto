<script>
  import * as Card from "$lib/components/ui/card";
  import ReadonlyInputField from "../../components/fragments/ReadonlyInputField.svelte";
  import ReadonlyTextAreaField from "../../components/fragments/ReadonlyTextAreaField.svelte";
  import ValueTextSelectField from "../../components/fragments/ValueTextSelectField.svelte";

  let { profileDetail } = $props();
  let detailDisplay = $derived(profileDetail.detailDisplay);
</script>

<div class="grid gap-2">
  <ReadonlyInputField
    value={profileDetail.name}
    placeholderText={detailDisplay.fieldPlaceholders.name}
  />
  <ReadonlyInputField
    value={profileDetail.aliases}
    placeholderText={detailDisplay.fieldPlaceholders.aliases}
  />
  <ReadonlyInputField
    value={profileDetail.summary}
    placeholderText={detailDisplay.fieldPlaceholders.summary}
  />
  <ReadonlyInputField
    value={profileDetail.source}
    placeholderText={detailDisplay.fieldPlaceholders.source}
  />
  <ReadonlyTextAreaField
    class="min-h-24 font-mono"
    value={profileDetail.notes}
    placeholderText={detailDisplay.notesPlaceholder}
  />
  <Card.Root>
    <Card.Header>
      <Card.Title>
        {detailDisplay.commandExecutionTitle}
      </Card.Title>
    </Card.Header>
    <Card.Content class="grid gap-2">
      <ValueTextSelectField
        title={detailDisplay.commandExecutionTitle}
        aria-label={detailDisplay.commandExecutionTitle}
        value={profileDetail.commandExecution.mode}
        optionRows={detailDisplay.commandExecutionModeOptionRows}
        disabled
      />
      <ReadonlyInputField
        value={profileDetail.commandExecution.marker}
        placeholderText={detailDisplay.commandExecutionMarkerPlaceholder}
        hidden={!profileDetail.commandExecution.showShellExitMarker}
      />
    </Card.Content>
  </Card.Root>
</div>
