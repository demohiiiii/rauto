<script lang="ts">
  import {
    createSavedConnectionEditModalWorkspace,
    hideSavedConnectionEditorModal,
  } from "$domains/connections/index.js";
  import ConnectionModalShell from "./ConnectionModalShell.svelte";
  import SavedConnectionEditorForm from "./SavedConnectionEditorForm.svelte";

  const savedConnectionEditModalWorkspace =
    createSavedConnectionEditModalWorkspace({
      onClose: hideSavedConnectionEditorModal,
    });
  const { modalDisplayStateStore } = savedConnectionEditModalWorkspace;
  let modalDisplay = $derived($modalDisplayStateStore);
</script>

<ConnectionModalShell
  cardClass="sm:max-w-3xl"
  variant="editor"
  {modalDisplay}
  onClose={hideSavedConnectionEditorModal}
>
  <SavedConnectionEditorForm active={modalDisplay.open} />
</ConnectionModalShell>
