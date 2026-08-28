<script>
  import ArrowDownIcon from "@lucide/svelte/icons/arrow-down";
  import ArrowUpIcon from "@lucide/svelte/icons/arrow-up";
  import DownloadIcon from "@lucide/svelte/icons/download";
  import FileClockIcon from "@lucide/svelte/icons/file-clock";
  import HistoryIcon from "@lucide/svelte/icons/history";
  import RefreshCwIcon from "@lucide/svelte/icons/refresh-cw";
  import ServerIcon from "@lucide/svelte/icons/server";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import XIcon from "@lucide/svelte/icons/x";
  import { Badge } from "$lib/components/ui/badge";
  import { Button } from "$lib/components/ui/button";
  import * as Card from "$lib/components/ui/card";
  import * as Dialog from "$lib/components/ui/dialog";
  import * as ToggleGroup from "$lib/components/ui/toggle-group";
  import DashboardTabPanel from "../components/layout/DashboardTabPanel.svelte";
  import DateTimePickerField from "./config-history/DateTimePickerField.svelte";
  import OutputBlock from "../components/fragments/OutputBlock.svelte";
  import PlainInputField from "../components/fragments/PlainInputField.svelte";
  import PlainSelectField from "../components/fragments/PlainSelectField.svelte";
  import StatusCard from "../components/fragments/StatusCard.svelte";
  import WorkspaceActionHeader from "../components/fragments/WorkspaceActionHeader.svelte";
  import { tr } from "../lib/i18n.js";
  import { cn } from "$lib/utils.js";
  import { createConfigHistoryWorkspace } from "../modules/operations/configHistory.js";
  import { onDestroy } from "svelte";

  let { active } = $props();
  const workspace = createConfigHistoryWorkspace();
  const { displayStateStore } = workspace;
  let display = $derived($displayStateStore);
  onDestroy(workspace.destroy);

  $effect(() => {
    workspace.setPageContext({ active });
  });

  function confirmDelete() {
    if (
      window.confirm(
        tr("configHistoryDeleteConfirm", "Delete this configuration snapshot?"),
      )
    ) {
      void workspace.removeSelected();
    }
  }

  function handleDetailDialogOpenChange(open) {
    if (!open) workspace.closeDetail();
  }
</script>

<DashboardTabPanel {active}>
  <div
    class="grid items-start gap-3 xl:grid-cols-[minmax(14rem,0.55fr)_minmax(0,1.45fr)]"
  >
    <Card.Root
      class="min-w-0 gap-0 overflow-hidden border-border/80 py-0 shadow-sm"
    >
      <WorkspaceActionHeader
        title={tr("configHistoryDevices", "Devices")}
        icon={ServerIcon}
      >
        {#snippet actions()}
          <Button
            variant="ghost"
            size="icon-sm"
            type="button"
            title={tr("refresh", "Refresh")}
            aria-label={tr("refresh", "Refresh")}
            onclick={workspace.refresh}
          >
            <RefreshCwIcon />
          </Button>
        {/snippet}
      </WorkspaceActionHeader>

      <Card.Content class="grid gap-3 p-3 sm:p-4">
        {#if display.deviceStatus}
          <StatusCard
            message={display.deviceStatus.message}
            tone={display.deviceStatus.tone}
          />
        {:else if display.deviceRows.length}
          <div class="grid max-h-[44rem] gap-2 overflow-y-auto pr-1">
            {#each display.deviceRows as device (device.name)}
              <button
                type="button"
                class={cn(
                  "grid min-w-0 gap-2 rounded-md border p-3 text-left",
                  device.active
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40 hover:bg-muted/40",
                )}
                onclick={() => workspace.selectDevice(device.name)}
              >
                <span class="flex min-w-0 items-start justify-between gap-2">
                  <span class="min-w-0 truncate text-sm font-semibold">
                    {device.name}
                  </span>
                  {#if device.preferred}
                    <Badge variant="secondary">
                      {tr("configHistoryCurrentDevice", "Current")}
                    </Badge>
                  {/if}
                </span>
                <span class="truncate text-xs text-muted-foreground">
                  {device.host || "-"} · {device.device_profile || "autodetect"}
                </span>
              </button>
            {/each}
          </div>
        {:else}
          <StatusCard
            message={tr("configHistoryNoDevices", "No saved devices")}
          />
        {/if}
      </Card.Content>
    </Card.Root>

    <Card.Root
      class="min-w-0 gap-0 overflow-hidden border-border/80 py-0 shadow-sm"
    >
      <WorkspaceActionHeader
        title={tr("configHistoryTitle", "Configuration history")}
        description={display.selectedDevice?.name || ""}
        icon={HistoryIcon}
      />

      <Card.Content class="grid gap-4 p-4 sm:p-5">
        {#if !display.hasSelectedDevice}
          <StatusCard
            message={tr(
              "configHistorySelectDevice",
              "Select a device to view its configuration history",
            )}
          />
        {:else}
          <div class="grid min-w-0 gap-3">
            <div class="grid min-w-0 gap-2 sm:grid-cols-2">
              <PlainSelectField
                value={display.kind}
                optionRows={display.kindOptions}
                aria-label={tr("configHistoryKind", "Configuration type")}
                onValueChange={workspace.setKind}
              />
              <PlainInputField
                value={display.search}
                placeholderText={tr("configHistorySearch", "Search history")}
                aria-label={tr("configHistorySearch", "Search history")}
                onValueInput={workspace.setSearch}
              />
            </div>

            <div
              class="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-end gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]"
            >
              <div
                class="col-span-2 grid min-w-0 gap-1.5 text-xs font-medium sm:col-span-1"
              >
                <span>{tr("configHistoryFromTime", "Start time")}</span>
                <DateTimePickerField
                  value={display.fetchedFrom}
                  defaultTime="00:00:00"
                  aria-label={tr("configHistoryFromTime", "Start time")}
                  onValueChange={workspace.setFetchedFrom}
                />
              </div>
              <div
                class="col-span-2 grid min-w-0 gap-1.5 text-xs font-medium sm:col-span-1"
              >
                <span>{tr("configHistoryToTime", "End time")}</span>
                <DateTimePickerField
                  value={display.fetchedTo}
                  defaultTime="23:59:59"
                  aria-label={tr("configHistoryToTime", "End time")}
                  onValueChange={workspace.setFetchedTo}
                />
              </div>
              <div class="grid min-w-0 gap-1.5 text-xs font-medium">
                <span>{tr("configHistorySort", "Time order")}</span>
                <ToggleGroup.Root
                  type="single"
                  variant="outline"
                  size="sm"
                  value={display.sortOrder}
                  onValueChange={workspace.setSortOrder}
                  aria-label={tr("configHistorySort", "Time order")}
                >
                  <ToggleGroup.Item
                    value="desc"
                    aria-label={tr("configHistoryNewestFirst", "Newest first")}
                    title={tr("configHistoryNewestFirst", "Newest first")}
                  >
                    <ArrowDownIcon />
                    <span>{tr("configHistoryNewest", "Newest")}</span>
                  </ToggleGroup.Item>
                  <ToggleGroup.Item
                    value="asc"
                    aria-label={tr("configHistoryOldestFirst", "Oldest first")}
                    title={tr("configHistoryOldestFirst", "Oldest first")}
                  >
                    <ArrowUpIcon />
                    <span>{tr("configHistoryOldest", "Oldest")}</span>
                  </ToggleGroup.Item>
                </ToggleGroup.Root>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                type="button"
                class="mb-0.5 justify-self-end sm:justify-self-start"
                disabled={!display.fetchedFrom && !display.fetchedTo}
                title={tr("configHistoryClearTime", "Clear time range")}
                aria-label={tr("configHistoryClearTime", "Clear time range")}
                onclick={workspace.clearTimeRange}
              >
                <XIcon />
              </Button>
            </div>
          </div>

          {#if display.listStatus}
            <StatusCard
              message={display.listStatus.message}
              tone={display.listStatus.tone}
            />
          {:else if display.snapshotRows.length}
            <div class="grid max-h-[44rem] gap-2 overflow-y-auto pr-1">
              {#each display.snapshotRows as snapshot (snapshot.id)}
                <button
                  type="button"
                  class={cn(
                    "grid min-w-0 gap-2 rounded-md border p-3 text-left",
                    snapshot.active
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40 hover:bg-muted/40",
                  )}
                  onclick={workspace.selectSnapshot(snapshot.id)}
                >
                  <span class="flex min-w-0 items-start justify-between gap-2">
                    <span class="truncate text-sm font-semibold">
                      {snapshot.fetchedAtText}
                    </span>
                    <Badge variant={snapshot.change.variant}>
                      {snapshot.change.label}
                    </Badge>
                  </span>
                  <span class="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{snapshot.kind}</Badge>
                    <span class="ml-auto text-xs text-muted-foreground">
                      {snapshot.sizeText}
                    </span>
                  </span>
                </button>
              {/each}
            </div>
          {:else}
            <StatusCard
              message={tr("configHistoryEmpty", "No configuration history")}
            />
          {/if}
        {/if}
      </Card.Content>
    </Card.Root>
  </div>
</DashboardTabPanel>

<Dialog.Root
  open={display.detailOpen}
  onOpenChange={handleDetailDialogOpenChange}
>
  <Dialog.Content
    class="!grid max-h-[92vh] w-[calc(100vw-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:!max-w-4xl"
  >
    <Dialog.Header class="border-b px-5 py-4 pr-14">
      <div class="flex min-w-0 items-start gap-3">
        <span
          class="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"
          aria-hidden="true"
        >
          <FileClockIcon class="size-5" />
        </span>
        <div class="min-w-0">
          <Dialog.Title>
            {tr("configHistoryDetail", "Configuration snapshot")}
          </Dialog.Title>
          <Dialog.Description class="truncate">
            {display.detailDisplay.hasDetail
              ? `${display.detailDisplay.connection_name} · ${display.detailDisplay.fetchedAtText}`
              : display.selectedDevice?.name || tr("loading", "Loading...")}
          </Dialog.Description>
        </div>
      </div>
    </Dialog.Header>

    <div class="min-h-0 overflow-y-auto p-5">
      {#if display.detailStatus}
        <StatusCard
          message={display.detailStatus.message}
          tone={display.detailStatus.tone}
        />
      {/if}

      {#if display.detailDisplay.hasDetail}
        <div class="grid min-w-0 gap-4">
          <div class="flex min-w-0 flex-wrap items-center gap-2">
            <Badge variant="outline">{display.detailDisplay.kind}</Badge>
            <Badge variant={display.detailDisplay.change.variant}>
              {display.detailDisplay.change.label}
            </Badge>
            <span class="text-xs text-muted-foreground">
              {display.detailDisplay.host} · {display.detailDisplay.profile}
            </span>
          </div>

          <dl class="grid gap-x-5 gap-y-3 border-y py-4 text-sm sm:grid-cols-2">
            <div class="min-w-0">
              <dt class="text-xs text-muted-foreground">
                {tr("configHistoryFetchedAt", "Fetched at")}
              </dt>
              <dd class="truncate font-medium">
                {display.detailDisplay.fetchedAtText}
              </dd>
            </div>
            <div class="min-w-0">
              <dt class="text-xs text-muted-foreground">
                {tr("configHistorySource", "Source")}
              </dt>
              <dd class="truncate font-medium">
                {display.detailDisplay.sourceText}
              </dd>
            </div>
            <div class="min-w-0">
              <dt class="text-xs text-muted-foreground">
                {tr("configHistoryCommand", "Command")}
              </dt>
              <dd class="truncate font-mono text-xs">
                {display.detailDisplay.command}
              </dd>
            </div>
            <div class="min-w-0">
              <dt class="text-xs text-muted-foreground">
                {tr("configHistorySize", "Size")}
              </dt>
              <dd class="font-medium">{display.detailDisplay.sizeText}</dd>
            </div>
            <div class="min-w-0 sm:col-span-2">
              <dt class="text-xs text-muted-foreground">SHA-256</dt>
              <dd class="break-all font-mono text-xs">
                {display.detailDisplay.sha256}
              </dd>
            </div>
          </dl>

          <OutputBlock
            title={display.detailDisplay.command}
            contentClass="min-h-80"
          >
            {display.detailDisplay.content}
          </OutputBlock>
        </div>
      {/if}
    </div>

    <Dialog.Footer class="flex-row justify-between border-t px-5 py-4">
      <div class="flex items-center gap-2">
        {#if display.detailDisplay.hasDetail}
          <Button
            variant="outline"
            size="icon-sm"
            type="button"
            title={tr("configHistoryDownload", "Download")}
            aria-label={tr("configHistoryDownload", "Download")}
            onclick={workspace.downloadSelected}
          >
            <DownloadIcon />
          </Button>
          <Button
            variant="destructive"
            size="icon-sm"
            type="button"
            title={tr("delete", "Delete")}
            aria-label={tr("delete", "Delete")}
            onclick={confirmDelete}
          >
            <Trash2Icon />
          </Button>
        {/if}
      </div>
      <Button variant="outline" type="button" onclick={workspace.closeDetail}>
        {tr("close", "Close")}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
