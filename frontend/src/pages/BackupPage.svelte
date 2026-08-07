<script>
  import * as Card from "$lib/components/ui/card";
  import { createBackupPageWorkspace } from "../modules/operations/backup.js";
  import DashboardTabPanel from "../components/layout/DashboardTabPanel.svelte";
  import LoadingButton from "../components/fragments/LoadingButton.svelte";
  import StatusCard from "../components/fragments/StatusCard.svelte";
  import WorkspaceActionHeader from "../components/fragments/WorkspaceActionHeader.svelte";
  import ArchiveIcon from "@lucide/svelte/icons/archive";
  import ArchiveRestoreIcon from "@lucide/svelte/icons/archive-restore";

  let { active } = $props();
  const backupPageWorkspace = createBackupPageWorkspace();
  const { backupDisplayStateStore } = backupPageWorkspace;
  let backupDisplay = $derived($backupDisplayStateStore);

  $effect(() => {
    void backupPageWorkspace.setPageContext({ active });
  });

  $effect(() => {
    if (active) return;
    backupPageWorkspace.destroy();
  });
</script>

{#snippet backupActionButton(label, loading, onClick, variant = "outline")}
  <LoadingButton {variant} {loading} onclick={onClick}>
    <span>{label}</span>
  </LoadingButton>
{/snippet}

{#snippet backupArchiveEntry(backupRow, backupRowIndex)}
  <div class={backupRow.rowClass}>
    <div class="flex flex-wrap items-center justify-between gap-2">
      <button
        class="min-w-0 flex-1 text-left"
        type="button"
        onclick={backupPageWorkspace.selectBackupRow(backupRowIndex)}
      >
        <span class="flex items-center justify-between gap-2">
          <span class="truncate text-sm font-semibold text-slate-800">
            {backupRow.name}
          </span>
          <span class="shrink-0 text-xs text-slate-500">
            {backupRow.sizeText}
          </span>
        </span>
        <span class="mt-1 block break-all text-xs text-slate-500">
          {backupRow.path}
        </span>
        <span class="mt-1 block text-xs text-slate-400">
          {backupDisplay.archiveDisplay.metaTimeLabel}: {backupRow.timeText}
        </span>
      </button>
      <span class="inline-flex items-center gap-2">
        {@render backupActionButton(
          backupDisplay.archiveDisplay.downloadButtonLabel,
          backupRow.downloadLoading,
          backupPageWorkspace.downloadBackupRow(backupRowIndex),
        )}
        {@render backupActionButton(
          backupDisplay.archiveDisplay.restoreMergeButtonLabel,
          backupRow.mergeLoading,
          backupPageWorkspace.restoreBackupRowMerge(backupRowIndex),
        )}
        {@render backupActionButton(
          backupDisplay.archiveDisplay.restoreReplaceButtonLabel,
          backupRow.replaceLoading,
          backupPageWorkspace.restoreBackupRowReplace(backupRowIndex),
          "destructive",
        )}
      </span>
    </div>
  </div>
{/snippet}

{#snippet backupArchiveCard()}
  <Card.Root class="gap-0 overflow-hidden border-border/80 py-0 shadow-sm">
    <WorkspaceActionHeader
      title={backupDisplay.archiveDisplay.listTitle}
      icon={ArchiveIcon}
    />
    <Card.Content class="grid gap-2 p-4 sm:p-5 md:w-225">
      <div class="mt-2 grid gap-2">
        {#if backupDisplay.archiveDisplay.hasBackupRows}
          {#each backupDisplay.archiveDisplay.backupRows as backupRow, backupRowIndex}
            {@render backupArchiveEntry(backupRow, backupRowIndex)}
          {/each}
        {:else}
          <StatusCard message={backupDisplay.archiveDisplay.emptyMessage} />
        {/if}
      </div>
    </Card.Content>
  </Card.Root>
{/snippet}

{#snippet backupCreateCard()}
  <Card.Root class="gap-0 overflow-hidden border-border/80 py-0 shadow-sm">
    <WorkspaceActionHeader
      title={backupDisplay.createDisplay.title}
      icon={ArchiveRestoreIcon}
    />
    <Card.Content class="grid gap-2 p-4 sm:p-5 md:w-225">
      <div class="inline-flex flex-wrap items-center gap-2">
        {@render backupActionButton(
          backupDisplay.createDisplay.createButtonLabel,
          backupDisplay.createDisplay.createLoading,
          backupPageWorkspace.createBackup,
          "default",
        )}
        {@render backupActionButton(
          backupDisplay.createDisplay.refreshButtonLabel,
          backupDisplay.createDisplay.refreshLoading,
          backupPageWorkspace.refreshBackups,
          "outline",
        )}
      </div>
      <StatusCard
        message={backupDisplay.createDisplay.status.text}
        tone={backupDisplay.createDisplay.status.tone}
      />
    </Card.Content>
  </Card.Root>
{/snippet}

<DashboardTabPanel {active}>
  <div class="grid gap-3">
    {@render backupCreateCard()}
    {@render backupArchiveCard()}
  </div>
</DashboardTabPanel>
