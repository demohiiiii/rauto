<script lang="ts">
  import * as Card from "$lib/components/ui/card";
  import {
    type BackupArchiveRow,
    createBackupPageWorkspace,
  } from "../../index.js";
  import DashboardTabPanel from "$components/layout/DashboardTabPanel.svelte";
  import LoadingButton from "$components/fragments/LoadingButton.svelte";
  import StatusCard from "$components/fragments/StatusCard.svelte";
  import WorkspaceActionHeader from "$components/fragments/WorkspaceActionHeader.svelte";
  import ArchiveIcon from "@lucide/svelte/icons/archive";
  import ArchiveRestoreIcon from "@lucide/svelte/icons/archive-restore";
  import DownloadIcon from "@lucide/svelte/icons/download";
  import FileArchiveIcon from "@lucide/svelte/icons/file-archive";
  import GitMergeIcon from "@lucide/svelte/icons/git-merge";

  let { active }: { active: boolean } = $props();
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

{#snippet backupActionButton(
  label: string,
  loading: boolean,
  onClick: () => void | Promise<void>,
  variant: "default" | "outline" = "outline",
)}
  <LoadingButton {variant} {loading} onclick={onClick}>
    <span>{label}</span>
  </LoadingButton>
{/snippet}

{#snippet backupArchiveEntry(
  backupRow: BackupArchiveRow,
  backupRowIndex: number,
)}
  <article
    class={`grid min-w-0 gap-3 px-3 py-3 transition-colors lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center ${backupRow.rowClass}`}
  >
    <button
      class="grid min-w-0 gap-3 rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:grid-cols-[minmax(0,1fr)_minmax(13rem,0.65fr)] sm:items-center"
      type="button"
      aria-pressed={backupRow.selected}
      onclick={backupPageWorkspace.selectBackupRow(backupRowIndex)}
    >
      <span class="flex min-w-0 items-center gap-3">
        <span
          class="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
        >
          <FileArchiveIcon class="size-4" aria-hidden="true" />
        </span>
        <span class="min-w-0">
          <span class="block truncate text-sm font-semibold text-foreground">
            {backupRow.name}
          </span>
          {#if backupRow.showPath}
            <span
              class="mt-0.5 block truncate font-mono text-[11px] text-muted-foreground"
            >
              {backupRow.path}
            </span>
          {/if}
        </span>
      </span>
      <span class="grid grid-cols-2 gap-3">
        <span class="min-w-0">
          <span
            class="block text-[10px] font-semibold uppercase text-muted-foreground"
          >
            {backupDisplay.archiveDisplay.metaSizeLabel}
          </span>
          <span class="mt-0.5 block truncate text-xs font-medium">
            {backupRow.sizeText}
          </span>
        </span>
        <span class="min-w-0">
          <span
            class="block text-[10px] font-semibold uppercase text-muted-foreground"
          >
            {backupDisplay.archiveDisplay.metaTimeLabel}
          </span>
          <span class="mt-0.5 block truncate text-xs font-medium">
            {backupRow.timeText}
          </span>
        </span>
      </span>
    </button>
    <span class="flex flex-wrap items-center gap-1.5 lg:justify-end">
      <LoadingButton
        variant="outline"
        size="xs"
        loading={backupRow.downloadLoading}
        onclick={backupPageWorkspace.downloadBackupRow(backupRowIndex)}
      >
        <DownloadIcon data-icon="inline-start" aria-hidden="true" />
        <span>{backupDisplay.archiveDisplay.downloadButtonLabel}</span>
      </LoadingButton>
      <LoadingButton
        variant="outline"
        size="xs"
        loading={backupRow.mergeLoading}
        onclick={backupPageWorkspace.restoreBackupRowMerge(backupRowIndex)}
      >
        <GitMergeIcon data-icon="inline-start" aria-hidden="true" />
        <span>{backupDisplay.archiveDisplay.restoreMergeButtonLabel}</span>
      </LoadingButton>
      <LoadingButton
        variant="destructive"
        size="xs"
        loading={backupRow.replaceLoading}
        onclick={backupPageWorkspace.restoreBackupRowReplace(backupRowIndex)}
      >
        <ArchiveRestoreIcon data-icon="inline-start" aria-hidden="true" />
        <span>{backupDisplay.archiveDisplay.restoreReplaceButtonLabel}</span>
      </LoadingButton>
    </span>
  </article>
{/snippet}

{#snippet backupArchiveCard()}
  <Card.Root class="gap-0 overflow-hidden border-border/80 py-0 shadow-sm">
    <WorkspaceActionHeader
      title={backupDisplay.archiveDisplay.listTitle}
      icon={ArchiveIcon}
    />
    <Card.Content class="p-3 sm:p-4">
      <div class="overflow-hidden rounded-lg border border-border">
        {#if backupDisplay.archiveDisplay.hasBackupRows}
          <div class="divide-y divide-border">
            {#each backupDisplay.archiveDisplay.backupRows as backupRow, backupRowIndex}
              {@render backupArchiveEntry(backupRow, backupRowIndex)}
            {/each}
          </div>
        {:else}
          <div class="p-3">
            <StatusCard message={backupDisplay.archiveDisplay.emptyMessage} />
          </div>
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
    <Card.Content class="grid gap-2 p-4 sm:p-5">
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
