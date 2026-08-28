<script>
  import SearchIcon from "@lucide/svelte/icons/search";
  import FileDownIcon from "@lucide/svelte/icons/file-down";
  import { currentLanguageState, tr } from "../../lib/i18n.js";
  import SendIcon from "@lucide/svelte/icons/send";
  import BoxesIcon from "@lucide/svelte/icons/boxes";
  import LayersIcon from "@lucide/svelte/icons/layers";
  import WorkflowIcon from "@lucide/svelte/icons/workflow";
  import NetworkIcon from "@lucide/svelte/icons/network";
  import HistoryIcon from "@lucide/svelte/icons/history";
  import CalendarClockIcon from "@lucide/svelte/icons/calendar-clock";
  import FileClockIcon from "@lucide/svelte/icons/file-clock";
  import UserCogIcon from "@lucide/svelte/icons/user-cog";
  import FileCode2Icon from "@lucide/svelte/icons/file-code-2";
  import ListTreeIcon from "@lucide/svelte/icons/list-tree";
  import ScanSearchIcon from "@lucide/svelte/icons/scan-search";
  import UploadIcon from "@lucide/svelte/icons/upload";
  import ShieldBanIcon from "@lucide/svelte/icons/shield-ban";
  import DatabaseBackupIcon from "@lucide/svelte/icons/database-backup";
  import HelpCircleIcon from "@lucide/svelte/icons/help-circle";
  import KeyRoundIcon from "@lucide/svelte/icons/key-round";
  import EthernetPortIcon from "@lucide/svelte/icons/ethernet-port";
  import PanelLeftCloseIcon from "@lucide/svelte/icons/panel-left-close";
  import PanelLeftOpenIcon from "@lucide/svelte/icons/panel-left-open";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Tooltip from "$lib/components/ui/tooltip/index.js";
  import { cn } from "$lib/utils.js";
  import { createDashboardSidebarWorkspace } from "../../modules/dashboard/dashboardShell.js";

  const rautoIconUrl = `${import.meta.env.BASE_URL}rauto-icon.svg`;
  let { collapsed = false, onCollapsedChange = undefined, onClose } = $props();
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
    { key: "operations", labelKey: "navGroupOperations", label: "操作" },
    { key: "management", labelKey: "navGroupManagement", label: "管理" },
  ];
  let i18nCurrentLanguage = $derived($currentLanguageState);
  const navIconComponents = {
    show: SearchIcon,
    "config-fetch": FileDownIcon,
    standard: SendIcon,
    batch: LayersIcon,
    "tx-block": BoxesIcon,
    "tx-workflow": WorkflowIcon,
    orchestrate: NetworkIcon,
    replay: HistoryIcon,
    prompts: UserCogIcon,
    templates: FileCode2Icon,
    inventory: ListTreeIcon,
    "device-discovery": ScanSearchIcon,
    credentials: KeyRoundIcon,
    transfer: UploadIcon,
    blacklist: ShieldBanIcon,
    backup: DatabaseBackupIcon,
    tasks: HistoryIcon,
    schedules: CalendarClockIcon,
    "config-history": FileClockIcon,
  };
  let groupedNavigationItems = $derived.by(() => {
    i18nCurrentLanguage;
    return navGroups
      .map((group) => ({
        ...group,
        label: tr(group.labelKey, group.label),
        items: navigationItems.filter(
          (navigationItem) =>
            navigationItem.visible &&
            (navigationItem.group || "operations") === group.key,
        ),
      }))
      .filter((group) => group.items.length);
  });
  let sidebarCollapseLabel = $derived.by(() => {
    i18nCurrentLanguage;
    return tr("sidebarCollapseAria", "收起侧边栏");
  });
  let sidebarExpandLabel = $derived.by(() => {
    i18nCurrentLanguage;
    return tr("sidebarExpandAria", "展开侧边栏");
  });
  let collapsible = $derived(typeof onCollapsedChange === "function");

  function handleClose() {
    if (typeof onClose === "function") {
      onClose();
    }
  }

  function toggleCollapsed() {
    if (collapsible) {
      onCollapsedChange(!collapsed);
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
  class={cn(
    "flex h-dvh min-h-full shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width,padding] duration-200 motion-reduce:transition-none",
    collapsed ? "w-[4.5rem] gap-3 p-3" : "w-44 gap-3 p-3",
  )}
>
  <Tooltip.Provider delayDuration={100} skipDelayDuration={0}>
    {#if collapsed && collapsible}
      <section class="flex items-center justify-center py-0.5">
        <Tooltip.Root>
          <Tooltip.Trigger>
            {#snippet child({ props })}
              <Button
                {...props}
                class="group/logo relative size-9 overflow-hidden rounded-lg p-0"
                variant="ghost"
                size="icon-sm"
                type="button"
                aria-label={sidebarExpandLabel}
                aria-expanded="false"
                onclick={toggleCollapsed}
              >
                <img
                  class="absolute size-8 rounded-lg object-cover transition-opacity duration-150 group-hover/logo:opacity-0 group-focus-visible/logo:opacity-0"
                  src={rautoIconUrl}
                  alt=""
                  loading="eager"
                  aria-hidden="true"
                />
                <PanelLeftOpenIcon
                  class="absolute opacity-0 transition-opacity duration-150 group-hover/logo:opacity-100 group-focus-visible/logo:opacity-100"
                  aria-hidden="true"
                />
              </Button>
            {/snippet}
          </Tooltip.Trigger>
          <Tooltip.Content side="right" sideOffset={8}>
            {sidebarExpandLabel}
          </Tooltip.Content>
        </Tooltip.Root>
      </section>
    {:else}
      <section class="flex items-center gap-2 px-1.5 py-0.5">
        <span
          class="flex size-8 items-center justify-center overflow-hidden rounded-lg bg-primary text-primary-foreground shadow-sm"
          aria-hidden="true"
        >
          <img
            class="size-full object-cover"
            src={rautoIconUrl}
            alt=""
            loading="eager"
          />
        </span>
        <span class="min-w-0 text-sm font-bold text-sidebar-foreground">
          Rauto
        </span>
        {#if collapsible}
          <Tooltip.Root>
            <Tooltip.Trigger>
              {#snippet child({ props })}
                <Button
                  {...props}
                  class="ml-auto shrink-0 border-sidebar-border bg-card shadow-none aria-expanded:bg-card hover:bg-sidebar-border hover:text-foreground hover:aria-expanded:bg-sidebar-border"
                  variant="outline"
                  size="icon-sm"
                  type="button"
                  aria-label={sidebarCollapseLabel}
                  aria-expanded="true"
                  onclick={toggleCollapsed}
                >
                  <PanelLeftCloseIcon aria-hidden="true" />
                </Button>
              {/snippet}
            </Tooltip.Trigger>
            <Tooltip.Content side="right" sideOffset={8}>
              {sidebarCollapseLabel}
            </Tooltip.Content>
          </Tooltip.Root>
        {/if}
      </section>
    {/if}
  </Tooltip.Provider>

  <Tooltip.Provider delayDuration={100} skipDelayDuration={0}>
    {#if collapsed}
      <Tooltip.Root>
        <Tooltip.Trigger>
          {#snippet child({ props })}
            <Button
              {...props}
              class="mx-auto size-10 rounded-lg border-sidebar-border"
              variant="outline"
              size="icon"
              type="button"
              aria-label={sidebarConnection.connectionSummaryLabel}
              onclick={openConnectionEditorAction}
            >
              {#if sidebarConnection.hasCard}
                <EthernetPortIcon aria-hidden="true" />
              {:else}
                <HelpCircleIcon aria-hidden="true" />
              {/if}
            </Button>
          {/snippet}
        </Tooltip.Trigger>
        <Tooltip.Content side="right" sideOffset={8}>
          {#if sidebarConnection.hasCard}
            <span class="flex flex-col items-start gap-0.5">
              <span class="font-semibold">
                {sidebarConnection.contextLabel}
              </span>
              <span class="font-mono text-[11px] opacity-80">
                {sidebarConnection.endpointLabel} · {sidebarConnection.profileLabel}
              </span>
            </span>
          {:else}
            {sidebarConnection.helpLabel}
          {/if}
        </Tooltip.Content>
      </Tooltip.Root>
    {:else}
      <Button
        class="h-auto w-full flex-col items-stretch gap-0 whitespace-normal rounded-lg border-sidebar-border bg-card p-3 text-left shadow-none"
        variant="outline"
        type="button"
        aria-label={sidebarConnection.helpLabel}
        onclick={openConnectionEditorAction}
      >
        {#if sidebarConnection.showError}
          <span class="block text-sm font-medium text-destructive">
            {sidebarConnection.errorMessage}
          </span>
        {:else if sidebarConnection.hasCard}
          <span
            class="block truncate font-mono text-[10px] font-semibold text-muted-foreground"
          >
            {sidebarConnection.endpointLabel}
          </span>
          <span class="mt-1 block min-w-0">
            <span
              class="block truncate text-sm font-semibold text-card-foreground"
            >
              {sidebarConnection.contextLabel}
            </span>
            <span
              class="mt-1 inline-flex max-w-full truncate rounded-md bg-accent px-1.5 py-0.5 text-[9px] font-semibold text-accent-foreground"
            >
              {sidebarConnection.profileLabel}
            </span>
          </span>
        {:else}
          <span class="flex items-start justify-between gap-2">
            <span class="min-w-0">
              <span
                class="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {sidebarConnection.emptyContextText}
              </span>
              <span
                class="block text-sm font-semibold leading-snug text-card-foreground"
              >
                {sidebarConnection.emptyNameText}
              </span>
            </span>
          </span>
        {/if}
      </Button>
    {/if}
  </Tooltip.Provider>

  <Tooltip.Provider delayDuration={100} skipDelayDuration={0}>
    <nav class="flex-1 overflow-y-auto">
      {#each groupedNavigationItems as navGroup}
        <section class={collapsed ? "mb-2" : "mb-3"}>
          {#if !collapsed}
            <div
              class="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70"
            >
              {navGroup.label}
            </div>
          {/if}
          <ul class="flex flex-col gap-0.5">
            {#each navGroup.items as navItemState}
              {@const IconComponent =
                navIconComponents[navItemState.routeId] || SearchIcon}
              <li>
                <Tooltip.Root disabled={!collapsed}>
                  <Tooltip.Trigger
                    class={cn(
                      "flex w-full min-w-0 items-center rounded-lg py-1.5 text-[13px] font-medium transition-colors",
                      collapsed ? "justify-center px-2" : "gap-2 px-2",
                      navItemState.active
                        ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-muted hover:text-sidebar-foreground",
                    )}
                    type="button"
                    aria-label={collapsed ? navItemState.labelText : undefined}
                    aria-current={navItemState.active ? "page" : undefined}
                    onclick={navigateRouteAction(navItemState.routeId)}
                  >
                    <IconComponent
                      class={cn(
                        "size-3.5",
                        navItemState.active &&
                          "text-sidebar-primary-foreground",
                      )}
                      aria-hidden="true"
                    />
                    <span class={collapsed ? "sr-only" : "min-w-0 truncate"}>
                      {navItemState.labelText}
                    </span>
                  </Tooltip.Trigger>
                  {#if collapsed}
                    <Tooltip.Content side="right" sideOffset={8}>
                      {navItemState.labelText}
                    </Tooltip.Content>
                  {/if}
                </Tooltip.Root>
              </li>
            {/each}
          </ul>
        </section>
      {/each}
    </nav>
  </Tooltip.Provider>
</aside>
