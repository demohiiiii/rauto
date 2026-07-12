<script>
  import CircleIcon from "@lucide/svelte/icons/circle";
  import VideoIcon from "@lucide/svelte/icons/video";
  import ClockIcon from "@lucide/svelte/icons/clock";
  import MenuIcon from "@lucide/svelte/icons/menu";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Sheet from "$lib/components/ui/sheet/index.js";
  import { Skeleton } from "$lib/components/ui/skeleton/index.js";
  import { setContext } from "svelte";
  import DashboardOverlayHost from "./DashboardOverlayHost.svelte";
  import DashboardAgentAuthPanel from "./DashboardAgentAuthPanel.svelte";
  import DashboardPreferenceTools from "./DashboardPreferenceTools.svelte";
  import DashboardSidebar from "./DashboardSidebar.svelte";
  import StatusCard from "../fragments/StatusCard.svelte";
  import { dashboardPageDefinitions } from "../../config/dashboardNavigation.js";
  import {
    createDashboardBodyWorkspace,
    dashboardState,
  } from "../../modules/dashboardShell.js";
  import { dashboardThemeContextKey } from "../../lib/svelte.js";
  import { currentLanguageState } from "../../lib/i18n.js";

  let { busy } = $props();
  const pageDefinitions = dashboardPageDefinitions;
  setContext(dashboardThemeContextKey, dashboardState);
  const dashboardBodyWorkspace = createDashboardBodyWorkspace(pageDefinitions);
  const {
    applyShellState,
    bodyDisplayStateStore,
    closeSidebarAction,
    documentKeydownHandler,
    openHistoryDrawerAction,
    openRecordDrawerAction,
    openSidebarAction,
    pageOutletRowsStateStore,
    recordToolsDisplayStateStore,
    setSidebarOpen,
    sidebarOpenStateStore,
    toggleRecordLevelAction,
  } = dashboardBodyWorkspace;

  let shellState = $derived($dashboardState);
  let bodyDisplay = $derived($bodyDisplayStateStore);
  let recordToolsDisplay = $derived($recordToolsDisplayStateStore);
  let pageOutletRows = $derived($pageOutletRowsStateStore);
  let sidebarOpen = $derived($sidebarOpenStateStore);
  const shellClass =
    "min-h-screen lg:grid lg:h-dvh lg:min-h-0 lg:grid-cols-[18rem_minmax(0,1fr)] lg:overflow-hidden";
  const headerClass =
    "sticky top-0 z-30 flex min-h-16 w-full items-center border-b border-border bg-background/80 px-6 backdrop-blur-lg max-lg:px-3.5";
  const mainScrollClass =
    "min-h-0 p-5 md:p-8 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain";
  const panelClass = "border-0 bg-transparent";
  const topbarPrimaryClass =
    "flex min-w-0 flex-1 items-center gap-2 max-lg:overflow-x-auto max-lg:[scrollbar-width:none] max-lg:[&::-webkit-scrollbar]:hidden";
  const topbarActionsClass = "inline-flex flex-none items-center gap-3 px-2";
  const topbarToolGroupClass =
    "inline-flex min-h-10 items-center gap-0.5 rounded-2xl border border-border bg-card p-1";
  const topbarToolButtonClass =
    "min-h-8 justify-start gap-1.5 rounded-xl px-3 text-[0.82rem] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground";
  const topbarToolMetaClass =
    "text-[0.7rem] font-bold text-muted-foreground max-lg:hidden";
  const topbarToolBadgeClass =
    "inline-flex min-h-4.5 min-w-4.5 items-center justify-center rounded-full bg-secondary px-1.5 text-xs text-secondary-foreground";

  $effect(() => {
    return applyShellState({
      language: $currentLanguageState,
      shellState,
    });
  });
</script>

{#snippet pageLoadingSkeleton()}
  <div class="grid gap-4" aria-label={bodyDisplay.loadingStatus.message}>
    <Skeleton class="h-8 w-56" />
    <div class="grid gap-3 md:grid-cols-3" aria-hidden="true">
      <Skeleton class="h-24" />
      <Skeleton class="h-24" />
      <Skeleton class="h-24" />
    </div>
    <Skeleton class="h-72" />
  </div>
{/snippet}

<svelte:document onkeydown={documentKeydownHandler} />

<svelte:head>
  <title>{bodyDisplay.pageTitle}</title>
</svelte:head>

<div aria-busy={busy}>
  <div class={shellClass}>
    <div class="hidden lg:block lg:min-h-0">
      <DashboardSidebar />
    </div>

    <div class="flex min-w-0 flex-col lg:h-dvh lg:min-h-0">
      <header class={headerClass}>
        <div class="flex-none lg:hidden">
          <Button
            variant="ghost"
            size="icon-sm"
            type="button"
            aria-label={bodyDisplay.sidebarOpenAria}
            onclick={openSidebarAction}
          >
            <MenuIcon />
          </Button>
        </div>
        <div class={topbarPrimaryClass}>
          <div class={topbarToolGroupClass}>
            <Button
              class={topbarToolButtonClass}
              variant="ghost"
              size="sm"
              type="button"
              title={recordToolsDisplay.levelHintText}
              aria-label={recordToolsDisplay.levelHintText}
              onclick={toggleRecordLevelAction}
            >
              <CircleIcon
                class="size-3 fill-destructive text-destructive"
                data-icon="inline-start"
                aria-hidden="true"
              />
              <span class="leading-none">
                {recordToolsDisplay.recordLevelLabel}
              </span>
              <span class={topbarToolMetaClass}>
                {recordToolsDisplay.levelLabelText}
              </span>
            </Button>
            <Button
              class={topbarToolButtonClass}
              variant="ghost"
              size="sm"
              type="button"
              title={recordToolsDisplay.recordFabTitle}
              onclick={openRecordDrawerAction}
            >
              <VideoIcon data-icon="inline-start" aria-hidden="true" />
              <span class="leading-none">
                {recordToolsDisplay.recordFabTitle}
              </span>
              {#if recordToolsDisplay.recordFabHasCount}
                <span class={topbarToolBadgeClass}>
                  {recordToolsDisplay.recordFabBadgeText}
                </span>
              {/if}
            </Button>
            <Button
              class={topbarToolButtonClass}
              variant="ghost"
              size="sm"
              type="button"
              title={recordToolsDisplay.historyButtonLabel}
              onclick={openHistoryDrawerAction}
            >
              <ClockIcon data-icon="inline-start" aria-hidden="true" />
              <span class="leading-none">
                {recordToolsDisplay.historyButtonLabel}
              </span>
            </Button>
          </div>
        </div>
        <div class={topbarActionsClass}>
          <DashboardPreferenceTools />
        </div>
      </header>

      <main class={mainScrollClass}>
        <div class="mx-auto w-full max-w-6xl space-y-4">
          <DashboardAgentAuthPanel />

          <section class={panelClass}>
            {#each pageOutletRows as pageRow (pageRow.id)}
              {@const PageComponent = pageRow.PageComponent}
              {#if PageComponent}
                <PageComponent active={pageRow.active} />
              {:else if pageRow.active && pageRow.errorMessage}
                <StatusCard
                  message={pageRow.errorMessage}
                  tone={bodyDisplay.pageErrorStatus.tone}
                  variant={bodyDisplay.pageErrorStatus.variant}
                />
              {:else if pageRow.active}
                {@render pageLoadingSkeleton()}
              {/if}
            {/each}
          </section>
        </div>
      </main>
    </div>

    <Sheet.Root open={sidebarOpen} onOpenChange={setSidebarOpen}>
      <Sheet.Content
        side="left"
        class="w-64 p-0 sm:max-w-xs lg:hidden"
        showCloseButton={false}
      >
        <Sheet.Header class="sr-only">
          <Sheet.Title>{bodyDisplay.sidebarOpenAria}</Sheet.Title>
          <Sheet.Description>{bodyDisplay.sidebarOpenAria}</Sheet.Description>
        </Sheet.Header>
        <DashboardSidebar onClose={closeSidebarAction} />
      </Sheet.Content>
    </Sheet.Root>
  </div>

  <DashboardOverlayHost />
</div>
