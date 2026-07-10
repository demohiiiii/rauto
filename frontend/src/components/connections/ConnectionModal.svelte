<script>
  import LoadingButton from "../fragments/LoadingButton.svelte";
  import ConnectionModalShell from "./ConnectionModalShell.svelte";
  import SavedConnectionLibraryPanel from "./SavedConnectionLibraryPanel.svelte";
  import TemporaryConnectionPanel from "./TemporaryConnectionPanel.svelte";
  import { currentLanguageState } from "../../lib/i18n.js";
  import { tabListPresentation } from "../../lib/ui.js";
  import { cn } from "$lib/utils.js";
  import PlugIcon from "@lucide/svelte/icons/plug";
  import { connectionModalModeTabs } from "../../config/dashboardModes.js";
  import {
    closeConnectionModal,
    createConnectionModalWorkspace,
    setConnectionModalMode,
  } from "../../modules/connections.js";

  const connectionModalWorkspace = createConnectionModalWorkspace({
    onClose: closeConnectionModal,
  });
  const { connectionTestStateStore, modalDisplayStateStore, testConnection } =
    connectionModalWorkspace;
  let connectionTestState = $derived($connectionTestStateStore);
  let modalDisplay = $derived($modalDisplayStateStore);
  let currentLanguage = $derived($currentLanguageState);
  let connectionModeDisplay = $derived.by(() => {
    currentLanguage;
    return tabListPresentation({
      activeValue: modalDisplay.activeMode,
      ariaLabel: modalDisplay.title,
      tabItems: connectionModalModeTabs,
    });
  });
</script>

{#snippet connectionModalControls()}
  <LoadingButton
    class="h-10 rounded-xl px-3 shadow-xs"
    variant="outline"
    size="sm"
    loading={connectionTestState.loading}
    onclick={testConnection}
  >
    <PlugIcon data-icon="inline-start" aria-hidden="true" />
    <span>{modalDisplay.testButtonLabel}</span>
  </LoadingButton>
{/snippet}

{#snippet connectionModeControls()}
  <div class="border-b border-border bg-muted/30 px-7 py-3">
    <div
      class="inline-flex rounded-full border border-border bg-background p-1 shadow-sm"
      aria-label={connectionModeDisplay.ariaLabelText}
      role="tablist"
    >
      {#each connectionModeDisplay.tabRows as tabRow (tabRow.valueText)}
        <button
          type="button"
          role="tab"
          aria-selected={tabRow.ariaSelectedText}
          class={cn(
            "rounded-full px-4 py-1.5 text-sm font-medium transition-all",
            tabRow.active
              ? "bg-primary text-primary-foreground shadow"
              : "text-muted-foreground hover:text-foreground",
          )}
          onclick={() => setConnectionModalMode(tabRow.valueText)}
        >
          {tabRow.labelText}
        </button>
      {/each}
    </div>
  </div>
{/snippet}

<ConnectionModalShell
  headerControls={connectionModalControls}
  modeControls={connectionModeControls}
  {modalDisplay}
  onClose={closeConnectionModal}
>
  {#if modalDisplay.showSaved}
    <SavedConnectionLibraryPanel active={true} onUse={closeConnectionModal} />
  {:else if modalDisplay.showTemporary}
    <TemporaryConnectionPanel
      active={true}
      connectionTestStatus={connectionTestState.status}
      onCancel={closeConnectionModal}
    />
  {/if}
</ConnectionModalShell>
