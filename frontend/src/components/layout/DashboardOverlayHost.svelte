<script>
  import { Toaster } from "$lib/components/ui/sonner/index.js";
  import {
    closeDashboardOverlayOnEscape,
    createDashboardOverlayHostWorkspace,
  } from "../../modules/dashboardShell.js";
  const dashboardOverlayHostWorkspace = createDashboardOverlayHostWorkspace();
  const {
    applyHostDisplay,
    hostDisplayStateStore,
    overlayComponentsStateStore,
  } = dashboardOverlayHostWorkspace;
  let overlayComponents = $derived($overlayComponentsStateStore);
  let ConnectionModalComponent = $derived(overlayComponents.connectionModal);
  let DetailModalComponent = $derived(overlayComponents.detailModal);
  let EntryDrawerComponent = $derived(overlayComponents.entryDrawer);
  let HistoryDrawerComponent = $derived(overlayComponents.historyDrawer);
  let RecordDrawerComponent = $derived(overlayComponents.recordDrawer);
  let SavedConnectionEditModalComponent = $derived(
    overlayComponents.savedConnectionEditModal,
  );
  let hostDisplay = $derived($hostDisplayStateStore);

  $effect(() => {
    return applyHostDisplay(hostDisplay);
  });
</script>

<svelte:document onkeydown={closeDashboardOverlayOnEscape} />

{#if RecordDrawerComponent}
  <RecordDrawerComponent />
{/if}
{#if DetailModalComponent}
  <DetailModalComponent />
{/if}
{#if ConnectionModalComponent}
  <ConnectionModalComponent />
{/if}
{#if SavedConnectionEditModalComponent}
  <SavedConnectionEditModalComponent />
{/if}
{#if EntryDrawerComponent}
  <EntryDrawerComponent />
{/if}
{#if HistoryDrawerComponent}
  <HistoryDrawerComponent />
{/if}
<Toaster position="top-right" richColors closeButton expand visibleToasts={5} />
