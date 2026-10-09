<script lang="ts">
  import type { ComponentProps } from "svelte";
  import SearchIcon from "@lucide/svelte/icons/search";
  import FileDownIcon from "@lucide/svelte/icons/file-down";
  import { currentLanguageState, tr } from "$lib/i18n.js";
  import SendIcon from "@lucide/svelte/icons/send";
  import GitBranchIcon from "@lucide/svelte/icons/git-branch";
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
  import KeyRoundIcon from "@lucide/svelte/icons/key-round";
  import PanelLeftCloseIcon from "@lucide/svelte/icons/panel-left-close";
  import PanelLeftOpenIcon from "@lucide/svelte/icons/panel-left-open";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Tooltip from "$lib/components/ui/tooltip/index.js";
  import { cn } from "$lib/utils.js";
  import { createDashboardSidebarWorkspace } from "$domains/dashboard/index.js";

  const rautoIconUrl = `${import.meta.env.BASE_URL}favicon.svg`;
  interface Props {
    collapsed?: boolean;
    onCollapsedChange?: (collapsed: boolean) => void;
    onClose?: () => void;
  }

  let {
    collapsed = false,
    onCollapsedChange = undefined,
    onClose,
  }: Props = $props();
  const dashboardSidebarWorkspace = createDashboardSidebarWorkspace();
  const { navigationItemsStateStore, navigateRoute } =
    dashboardSidebarWorkspace;
  let navigationItems = $derived($navigationItemsStateStore);
  const navGroups = [
    { key: "operations", labelKey: "navGroupOperations", label: "操作" },
    { key: "management", labelKey: "navGroupManagement", label: "管理" },
  ];
  let i18nCurrentLanguage = $derived($currentLanguageState);
  const navIconComponents: Record<string, typeof SearchIcon> = {
    show: SearchIcon,
    "config-fetch": FileDownIcon,
    command: SendIcon,
    interactive: GitBranchIcon,
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
      onCollapsedChange?.(!collapsed);
    }
  }

  function navigateRouteAction(routeId: string) {
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
      <section class="flex h-10 items-center px-1.5 py-0.5">
        <Tooltip.Root>
          <Tooltip.Trigger>
            {#snippet child({
              props,
            }: {
              props: ComponentProps<typeof Button>;
            })}
              <Button
                {...props}
                class="group/logo relative size-8 shrink-0 overflow-hidden rounded-lg p-0"
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
          <Tooltip.Content
            class=""
            arrowClasses=""
            portalProps={undefined}
            side="right"
            sideOffset={8}
          >
            {sidebarExpandLabel}
          </Tooltip.Content>
        </Tooltip.Root>
      </section>
    {:else}
      <section class="flex h-10 items-center gap-2 px-1.5 py-0.5">
        <span
          class="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary text-primary-foreground shadow-sm"
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
              {#snippet child({
                props,
              }: {
                props: ComponentProps<typeof Button>;
              })}
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
            <Tooltip.Content
              class=""
              arrowClasses=""
              portalProps={undefined}
              side="right"
              sideOffset={8}
            >
              {sidebarCollapseLabel}
            </Tooltip.Content>
          </Tooltip.Root>
        {/if}
      </section>
    {/if}
  </Tooltip.Provider>

  <Tooltip.Provider delayDuration={100} skipDelayDuration={0}>
    <nav class="flex-1 overflow-y-auto">
      {#each groupedNavigationItems as navGroup}
        <section class="mb-3">
          <div
            class={cn(
              "mb-1 h-4 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70",
              collapsed && "invisible",
            )}
            aria-hidden={collapsed}
          >
            {navGroup.label}
          </div>
          <ul class="flex flex-col gap-0.5">
            {#each navGroup.items as navItemState}
              {@const IconComponent =
                navIconComponents[navItemState.routeId] || SearchIcon}
              <li>
                <Tooltip.Root disabled={!collapsed}>
                  <Tooltip.Trigger
                    class={cn(
                      "grid h-8 w-full min-w-0 grid-cols-[2rem_minmax(0,1fr)] items-center rounded-lg px-1.5 text-left text-[13px] font-medium transition-colors",
                      navItemState.active
                        ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-muted hover:text-sidebar-foreground",
                    )}
                    type="button"
                    aria-label={collapsed ? navItemState.labelText : undefined}
                    aria-current={navItemState.active ? "page" : undefined}
                    onclick={navigateRouteAction(navItemState.routeId)}
                  >
                    <span
                      class="flex size-8 shrink-0 items-center justify-center"
                      aria-hidden="true"
                    >
                      <IconComponent class="size-3.5 shrink-0" />
                    </span>
                    <span class={collapsed ? "sr-only" : "min-w-0 truncate"}>
                      {navItemState.labelText}
                    </span>
                  </Tooltip.Trigger>
                  {#if collapsed}
                    <Tooltip.Content
                      class=""
                      arrowClasses=""
                      portalProps={undefined}
                      side="right"
                      sideOffset={8}
                    >
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
