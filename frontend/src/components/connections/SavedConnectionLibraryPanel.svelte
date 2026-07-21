<script>
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { cn } from "$lib/utils.js";
  import FilePickerButton from "../fragments/FilePickerButton.svelte";
  import LoadingButton from "../fragments/LoadingButton.svelte";
  import StatusCard from "../fragments/StatusCard.svelte";
  import { createSavedConnectionLibraryWorkspace } from "../../modules/connections/connections.js";
  import CheckIcon from "@lucide/svelte/icons/check";
  import DownloadIcon from "@lucide/svelte/icons/download";
  import PencilIcon from "@lucide/svelte/icons/pencil";
  import SearchIcon from "@lucide/svelte/icons/search";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import UploadIcon from "@lucide/svelte/icons/upload";

  let { active, onUse } = $props();
  const savedConnectionLibraryWorkspace = createSavedConnectionLibraryWorkspace(
    {},
  );
  const {
    deleteSavedConnection,
    downloadTemplate,
    editSavedConnection,
    importConnections,
    libraryDisplayStateStore,
    loadingStateStore,
    selectedSavedConnectionHandler,
    setPanelContext,
    useSavedConnectionAction,
  } = savedConnectionLibraryWorkspace;

  let searchQuery = $state("");
  let libraryDisplay = $derived($libraryDisplayStateStore);
  let loadingState = $derived($loadingStateStore);
  let savedConnectionCount = $derived(libraryDisplay.connectionRows.length);
  let normalizedSearchQuery = $derived(searchQuery.trim().toLowerCase());
  let filteredConnectionRows = $derived(
    libraryDisplay.connectionRows.filter(
      (connectionRow) =>
        !normalizedSearchQuery ||
        connectionRow.searchText.includes(normalizedSearchQuery),
    ),
  );
  let selectedConnectionRow = $derived(
    libraryDisplay.selectedConnectionRow ||
      filteredConnectionRows[0] ||
      libraryDisplay.connectionRows[0] ||
      null,
  );

  $effect(() => {
    setPanelContext({ active, onUse });
    const firstConnectionRow = libraryDisplay.connectionRows[0];
    if (active && !libraryDisplay.select.selected && firstConnectionRow?.name) {
      selectedSavedConnectionHandler(firstConnectionRow.name);
    }
  });

  function handleSearchInput(event) {
    searchQuery = event.currentTarget.value;
  }
</script>

<div
  class="grid min-h-0 flex-1 gap-0 overflow-hidden lg:grid-cols-[22rem_minmax(0,1fr)]"
  hidden={!active}
>
  <aside
    class="flex min-h-0 flex-col border-b border-border bg-muted/20 lg:border-r lg:border-b-0"
  >
    <div class="shrink-0 border-b border-border p-4">
      <div class="relative">
        <SearchIcon
          class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          class="h-12 rounded-xl pl-10"
          value={searchQuery}
          aria-label="搜索名称 / 主机 / profile"
          placeholder="搜索名称 / 主机 / profile"
          oninput={handleSearchInput}
        />
      </div>
      <div class="mt-3 grid grid-cols-2 gap-2">
        <LoadingButton
          class="w-full rounded-xl"
          variant="outline"
          size="sm"
          loading={loadingState.templateLoading}
          onclick={downloadTemplate}
        >
          <DownloadIcon data-icon="inline-start" aria-hidden="true" />
          <span>{libraryDisplay.buttons.template.label}</span>
        </LoadingButton>
        <FilePickerButton
          class="w-full rounded-xl"
          variant="outline"
          size="sm"
          accept={libraryDisplay.importAccept}
          onFile={importConnections}
        >
          <UploadIcon data-icon="inline-start" aria-hidden="true" />
          {libraryDisplay.importLabel}
        </FilePickerButton>
      </div>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto p-2">
      {#if filteredConnectionRows.length}
        <ul class="flex flex-col gap-2">
          {#each filteredConnectionRows as connectionRow (connectionRow.name)}
            {@const selected =
              selectedConnectionRow?.name === connectionRow.name}
            <li>
              <button
                type="button"
                class={cn(
                  "w-full rounded-2xl border p-3 text-left transition-all",
                  selected
                    ? "border-primary/40 bg-primary/5 shadow-sm"
                    : "border-transparent hover:border-border hover:bg-background",
                )}
                onclick={() =>
                  selectedSavedConnectionHandler(connectionRow.name)}
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <p
                      class={cn(
                        "truncate text-sm font-bold",
                        selected ? "text-primary" : "text-card-foreground",
                      )}
                    >
                      {connectionRow.name}
                    </p>
                    <p
                      class="mt-1 truncate font-mono text-xs text-muted-foreground"
                    >
                      {connectionRow.summary}
                    </p>
                  </div>
                  <span
                    class={cn(
                      "mt-1 size-2.5 shrink-0 rounded-full",
                      connectionRow.enabled
                        ? "bg-primary"
                        : "bg-muted-foreground/50",
                    )}
                    aria-label={connectionRow.statusLabel}
                  ></span>
                </div>
                <div class="mt-3 flex flex-wrap items-center gap-1.5">
                  <span
                    class="rounded-md bg-secondary px-2 py-0.5 font-mono text-[11px] font-medium text-secondary-foreground"
                  >
                    {connectionRow.profile}
                  </span>
                  <Badge variant="secondary" class="rounded-md">
                    {connectionRow.tag}
                  </Badge>
                </div>
              </button>
            </li>
          {/each}
        </ul>
      {:else}
        <div
          class="flex min-h-40 items-center justify-center rounded-2xl border border-dashed border-border bg-background/50 p-6 text-center text-sm text-muted-foreground"
        >
          未匹配到连接
        </div>
      {/if}
    </div>
  </aside>

  <section class="flex min-h-0 flex-1 flex-col bg-background">
    <div class="min-h-0 flex-1 overflow-y-auto px-7 py-8">
      <div class="mx-auto flex max-w-6xl flex-col gap-5">
        <div
          class="connection-summary-card rounded-3xl border border-border bg-card p-5 shadow-xs"
        >
          <div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h3 class="truncate text-2xl font-bold tracking-tight">
                  {selectedConnectionRow?.name ||
                    libraryDisplay.select.placeholder}
                </h3>
                {#if selectedConnectionRow}
                  <Badge variant="secondary" class="gap-1 rounded-full">
                    <span
                      class={cn(
                        "size-1.5 rounded-full",
                        selectedConnectionRow.enabled
                          ? "bg-primary"
                          : "bg-muted-foreground/50",
                      )}
                      aria-hidden="true"
                    ></span>
                    {selectedConnectionRow.statusLabel}
                  </Badge>
                {/if}
              </div>
              <p class="mt-2 truncate font-mono text-sm text-muted-foreground">
                {#if selectedConnectionRow}
                  {selectedConnectionRow.summary}
                {:else}
                  已保存连接会复用凭据、profile、标签和分组信息。
                {/if}
              </p>
              {#if selectedConnectionRow}
                <div class="mt-4 flex flex-wrap items-center gap-2">
                  <span
                    class="rounded-lg bg-secondary px-2.5 py-1 font-mono text-xs font-medium text-secondary-foreground"
                  >
                    {selectedConnectionRow.profile}
                  </span>
                  <Badge variant="secondary" class="rounded-lg">
                    {selectedConnectionRow.tag}
                  </Badge>
                  {#if selectedConnectionRow.deviceModel}
                    <Badge variant="outline" class="rounded-lg font-mono">
                      {selectedConnectionRow.deviceModel}
                    </Badge>
                  {/if}
                  {#if selectedConnectionRow.softwareVersion}
                    <Badge variant="outline" class="rounded-lg font-mono">
                      {selectedConnectionRow.softwareVersion}
                    </Badge>
                  {/if}
                </div>
              {/if}
            </div>

            <div
              class="flex flex-wrap items-center justify-start gap-2 lg:flex-col lg:items-end"
            >
              <div class="flex flex-wrap items-center gap-2">
                <LoadingButton
                  class="rounded-xl"
                  variant="outline"
                  size="sm"
                  loading={loadingState.editLoading}
                  onclick={editSavedConnection}
                >
                  <PencilIcon data-icon="inline-start" aria-hidden="true" />
                  <span>{libraryDisplay.buttons.edit.label}</span>
                </LoadingButton>
                <LoadingButton
                  variant="ghost"
                  size="sm"
                  class="text-destructive hover:text-destructive"
                  loading={loadingState.deleteLoading}
                  onclick={deleteSavedConnection}
                >
                  <Trash2Icon data-icon="inline-start" aria-hidden="true" />
                  <span>{libraryDisplay.buttons.delete.label}</span>
                </LoadingButton>
              </div>
            </div>
          </div>
        </div>

        <div
          class="connection-stat-grid grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
        >
          <div class="rounded-2xl border border-border bg-card p-4 shadow-xs">
            <p
              class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
            >
              平台
            </p>
            <p class="mt-2 truncate font-mono text-lg font-bold">
              {selectedConnectionRow?.profile || "-"}
            </p>
          </div>
          <div class="rounded-2xl border border-border bg-card p-4 shadow-xs">
            <p
              class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
            >
              型号
            </p>
            <p class="mt-2 truncate font-mono text-lg font-bold">
              {selectedConnectionRow?.deviceModel || "-"}
            </p>
          </div>
          <div class="rounded-2xl border border-border bg-card p-4 shadow-xs">
            <p
              class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
            >
              软件版本
            </p>
            <p class="mt-2 truncate font-mono text-lg font-bold">
              {selectedConnectionRow?.softwareVersion || "-"}
            </p>
          </div>
          <div class="rounded-2xl border border-border bg-card p-4 shadow-xs">
            <p
              class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
            >
              端口
            </p>
            <p class="mt-2 font-mono text-lg font-bold">
              {selectedConnectionRow?.port || "-"}
            </p>
          </div>
          <div class="rounded-2xl border border-border bg-card p-4 shadow-xs">
            <p
              class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
            >
              标签
            </p>
            <p class="mt-2 truncate text-lg font-bold">
              {selectedConnectionRow?.tag || "-"}
            </p>
          </div>
          <div class="rounded-2xl border border-border bg-card p-4 shadow-xs">
            <p
              class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
            >
              状态
            </p>
            <p class="mt-2 text-lg font-bold">
              {selectedConnectionRow?.statusLabel || "-"}
            </p>
          </div>
        </div>

        {#if libraryDisplay.showStatus}
          <StatusCard
            message={libraryDisplay.status.text}
            tone={libraryDisplay.status.tone}
          />
        {/if}
      </div>
    </div>

    <div
      class="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/20 px-7 py-4"
    >
      <p class="text-xs text-muted-foreground">
        使用后将写入到左侧连接目标，可随时切换。
      </p>
      <div class="flex flex-wrap items-center gap-4">
        <span class="text-xs text-muted-foreground">
          共 {savedConnectionCount} 个可用连接
        </span>
        <LoadingButton
          class="rounded-xl px-4"
          loading={loadingState.useLoading}
          onclick={useSavedConnectionAction}
        >
          <CheckIcon data-icon="inline-start" aria-hidden="true" />
          应用选中连接
        </LoadingButton>
      </div>
    </div>
  </section>
</div>
