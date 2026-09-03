<script lang="ts">
  import type { Component } from "svelte";
  import { Toaster } from "$lib/components/ui/sonner/index.js";
  import {
    closeDashboardOverlayOnEscape,
    createDashboardOverlayHostWorkspace,
  } from "$domains/dashboard/index.js";
  const dashboardOverlayHostWorkspace = createDashboardOverlayHostWorkspace();
  const {
    applyHostDisplay,
    hostDisplayStateStore,
    overlayComponentsStateStore,
  } = dashboardOverlayHostWorkspace;
  let overlayComponents = $derived($overlayComponentsStateStore);
  let ConnectionModalComponent = $derived(
    overlayComponents.connectionModal as Component | null,
  );
  let DetailModalComponent = $derived(
    overlayComponents.detailModal as Component | null,
  );
  let EntryDrawerComponent = $derived(
    overlayComponents.entryDrawer as Component | null,
  );
  let RecordDrawerComponent = $derived(
    overlayComponents.recordDrawer as Component | null,
  );
  let SavedConnectionEditModalComponent = $derived(
    overlayComponents.savedConnectionEditModal as Component | null,
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
<Toaster position="top-right" richColors closeButton expand visibleToasts={5} />
