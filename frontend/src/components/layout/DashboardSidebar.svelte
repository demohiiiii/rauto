<script>
  import SearchIcon from "@lucide/svelte/icons/search";
  import SendIcon from "@lucide/svelte/icons/send";
  import BoxesIcon from "@lucide/svelte/icons/boxes";
  import WorkflowIcon from "@lucide/svelte/icons/workflow";
  import NetworkIcon from "@lucide/svelte/icons/network";
  import HistoryIcon from "@lucide/svelte/icons/history";
  import UserCogIcon from "@lucide/svelte/icons/user-cog";
  import FileCode2Icon from "@lucide/svelte/icons/file-code-2";
  import ListTreeIcon from "@lucide/svelte/icons/list-tree";
  import UploadIcon from "@lucide/svelte/icons/upload";
  import ShieldBanIcon from "@lucide/svelte/icons/shield-ban";
  import DatabaseBackupIcon from "@lucide/svelte/icons/database-backup";
  import HelpCircleIcon from "@lucide/svelte/icons/help-circle";
  import BookmarkIcon from "@lucide/svelte/icons/bookmark";
  import ChevronsUpDownIcon from "@lucide/svelte/icons/chevrons-up-down";
  import { Button } from "$lib/components/ui/button/index.js";
  import { cn } from "$lib/utils.js";
  import { createDashboardSidebarWorkspace } from "../../modules/dashboardShell.js";

  const rautoIconUrl = `${import.meta.env.BASE_URL}rauto-icon.svg`;
  let { onClose } = $props();
  const dashboardSidebarWorkspace = createDashboardSidebarWorkspace();
  const {
    navigationItemsStateStore,
    navigateRoute,
    openConnectionEditor,
    sidebarConnectionDisplayStateStore,
  } = dashboardSidebarWorkspace;
  let sidebarConnection = $derived($sidebarConnectionDisplayStateStore);
  let navigationItems = $derived($navigationItemsStateStore);
  const navGroups = [
    { key: "operations", label: "操作" },
    { key: "management", label: "管理" },
  ];
  const navIconComponents = {
    show: SearchIcon,
    standard: SendIcon,
    "tx-block": BoxesIcon,
    "tx-workflow": WorkflowIcon,
    orchestrate: NetworkIcon,
    replay: HistoryIcon,
    prompts: UserCogIcon,
    templates: FileCode2Icon,
    inventory: ListTreeIcon,
    transfer: UploadIcon,
    blacklist: ShieldBanIcon,
    backup: DatabaseBackupIcon,
    tasks: HistoryIcon,
  };
  let groupedNavigationItems = $derived(
    navGroups
      .map((group) => ({
        ...group,
        items: navigationItems.filter(
          (navigationItem) =>
            navigationItem.visible &&
            (navigationItem.group || "operations") === group.key,
        ),
      }))
      .filter((group) => group.items.length),
  );

  function handleClose() {
    if (typeof onClose === "function") {
      onClose();
    }
  }

  function openConnectionEditorAction() {
    openConnectionEditor();
    handleClose();
  }

  function navigateRouteAction(routeId) {
    return () => {
      navigateRoute(routeId);
      handleClose();
    };
  }
</script>

<aside
  class="flex h-dvh min-h-full w-72 shrink-0 flex-col gap-4 overflow-hidden border-r border-sidebar-border bg-sidebar p-4 text-sidebar-foreground"
>
  <section class="flex items-center gap-2.5 px-2 py-1">
    <span
      class="flex size-9 items-center justify-center overflow-hidden rounded-xl bg-primary text-primary-foreground shadow-sm"
      aria-hidden="true"
    >
      <img
        class="size-full object-cover"
        src={rautoIconUrl}
        alt=""
        loading="eager"
      />
    </span>
    <div class="leading-tight">
      <div class="text-base font-bold tracking-tight text-sidebar-foreground">
        RAUTO
      </div>
      <div class="text-[11px] font-medium text-muted-foreground">
        网络自动化控制台
      </div>
    </div>
  </section>

  <section class="rounded-2xl border border-sidebar-border bg-card p-4">
    <div class="mb-3 flex items-center justify-between gap-3">
      <div class="flex min-w-0 items-center gap-1.5">
        <span class="text-xs font-semibold text-muted-foreground">
          {sidebarConnection.title}
        </span>
        <HelpCircleIcon
          class="size-3.5 text-muted-foreground/70"
          aria-hidden="true"
        />
      </div>
      {#if sidebarConnection.hasCard}
        <span
          class="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-accent-foreground"
        >
          <span class="size-1.5 rounded-full bg-primary" aria-hidden="true"
          ></span>
          {sidebarConnection.statusLabel}
        </span>
      {/if}
    </div>

    {#if sidebarConnection.showError}
      <span class="text-sm font-medium text-destructive">
        {sidebarConnection.errorMessage}
      </span>
    {:else if sidebarConnection.hasCard}
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <p
            class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {sidebarConnection.contextLabel}
          </p>
          <p
            class="truncate font-mono text-sm font-semibold text-card-foreground"
          >
            {sidebarConnection.summary}
          </p>
          {#if sidebarConnection.profile}
            <span
              class="mt-1.5 inline-flex rounded-md bg-secondary px-1.5 py-0.5 font-mono text-[10px] font-medium text-secondary-foreground"
            >
              {sidebarConnection.profile}
            </span>
          {/if}
        </div>
        <span
          class="rounded-lg p-1.5 text-muted-foreground"
          title={sidebarConnection.badgeLabel}
          aria-label={sidebarConnection.badgeLabel}
        >
          {#if sidebarConnection.showTemporaryIcon}
            <NetworkIcon class="size-4" aria-hidden="true" />
          {:else if sidebarConnection.showSavedIcon}
            <BookmarkIcon class="size-4" aria-hidden="true" />
          {/if}
        </span>
      </div>
    {:else}
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <p
            class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {sidebarConnection.emptyContextText}
          </p>
          <p class="text-sm font-semibold leading-snug text-card-foreground">
            {sidebarConnection.emptyNameText}
          </p>
        </div>
      </div>
    {/if}

    <div class="mt-4">
      <Button
        class="w-full justify-between"
        size="lg"
        type="button"
        onclick={openConnectionEditorAction}
      >
        {sidebarConnection.openButtonLabel}
        <ChevronsUpDownIcon class="size-4 opacity-80" aria-hidden="true" />
      </Button>
    </div>
  </section>

  <nav class="flex-1 overflow-y-auto">
    {#each groupedNavigationItems as navGroup}
      <section class="mb-4">
        <div
          class="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70"
        >
          {navGroup.label}
        </div>
        <ul class="flex flex-col gap-0.5">
          {#each navGroup.items as navItemState}
            {@const IconComponent =
              navIconComponents[navItemState.routeId] || SearchIcon}
            <li>
              <button
                class={cn(
                  "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                  navItemState.active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-sidebar-foreground",
                )}
                type="button"
                aria-current={navItemState.active ? "page" : undefined}
                onclick={navigateRouteAction(navItemState.routeId)}
              >
                <IconComponent
                  class={cn(
                    "size-4",
                    navItemState.active && "text-sidebar-primary-foreground",
                  )}
                  aria-hidden="true"
                />
                <span>{navItemState.labelText}</span>
              </button>
            </li>
          {/each}
        </ul>
      </section>
    {/each}
  </nav>
</aside>
