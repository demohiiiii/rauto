<script>
  import {
    createSavedConnectionEditModalWorkspace,
    hideSavedConnectionEditorModal,
  } from "../../modules/connections.js";
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
