<script>
  import { agentAuthBehavior } from "../actions/agentAuthBehavior.js";
  import { appEventsBehavior } from "../actions/appEventsBehavior.js";
  import { standardDeliveryBehavior } from "../actions/standardDeliveryBehavior.js";
  import ConnectionModal from "./fragments/ConnectionModal.svelte";
  import DetailModal from "./fragments/DetailModal.svelte";
  import EntryDrawer from "./fragments/EntryDrawer.svelte";
  import EntryDrawerBackdrop from "./fragments/EntryDrawerBackdrop.svelte";
  import HistoryDrawer from "./fragments/HistoryDrawer.svelte";
  import HistoryDrawerBackdrop from "./fragments/HistoryDrawerBackdrop.svelte";
  import RecordDrawer from "./fragments/RecordDrawer.svelte";
  import RecordDrawerBackdrop from "./fragments/RecordDrawerBackdrop.svelte";
  import SavedConnectionEditModal from "./fragments/SavedConnectionEditModal.svelte";
  import ToastStack from "./fragments/ToastStack.svelte";
  import DashboardHeader from "./layout/DashboardHeader.svelte";
  import DashboardSidebar from "./layout/DashboardSidebar.svelte";
  import BackupPage from "../pages/BackupPage.svelte";
  import BlacklistPage from "../pages/BlacklistPage.svelte";
  import InventoryPage from "../pages/InventoryPage.svelte";
  import OrchestratedPage from "../pages/OrchestratedPage.svelte";
  import PromptsPage from "../pages/PromptsPage.svelte";
  import ReplayPage from "../pages/ReplayPage.svelte";
  import ShowPage from "../pages/ShowPage.svelte";
  import StandardPage from "../pages/StandardPage.svelte";
  import TasksPage from "../pages/TasksPage.svelte";
  import TemplatesPage from "../pages/TemplatesPage.svelte";
  import TransferPage from "../pages/TransferPage.svelte";
  import {
    dashboardView,
    isDashboardTabActive,
  } from "../state/dashboardView.js";

  let { busy = false } = $props();
</script>

<div aria-busy={busy} use:appEventsBehavior>
  <div class="dashboard-shell drawer lg:drawer-open min-h-screen">
    <input id="sidebar-drawer" type="checkbox" class="drawer-toggle" />

    <div class="drawer-content flex flex-col">
      <header class="dashboard-header navbar sticky top-0 z-30">
        <DashboardHeader />
      </header>

      <main class="main-scroll">
        <div class="w-full max-w-none space-y-4">
          <div
            id="agent-auth-wrap"
            class="rounded-2xl border border-amber-200 bg-amber-50/70 p-4"
            hidden
            use:agentAuthBehavior
          >
            <div
              class="grid gap-3 lg:grid-cols-[1fr_minmax(320px,460px)] lg:items-start"
            >
              <div>
                <h2
                  id="agent-auth-title"
                  class="text-sm font-semibold text-slate-900"
                >
                  Agent API Token
                </h2>
                <p id="agent-auth-hint" class="mt-1 text-xs text-slate-600">
                  Managed agent mode requires a token for browser API requests.
                </p>
              </div>
              <div class="grid gap-2">
                <input
                  id="agent-api-token"
                  class="input"
                  type="password"
                  placeholder="agent api token"
                  autocomplete="off"
                />
                <div
                  class="inline-flex flex-wrap items-center justify-end gap-2"
                >
                  <button
                    id="agent-api-token-save-btn"
                    class="btn btn-sm btn-success"
                    type="button"
                  >
                    Save Token
                  </button>
                  <button
                    id="agent-api-token-clear-btn"
                    class="btn btn-sm btn-error"
                    type="button"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>
            <div id="agent-auth-out" class="mt-3"></div>
          </div>

          <section class="dashboard-panel" use:standardDeliveryBehavior>
            <ShowPage active={isDashboardTabActive($dashboardView, "show")} />
            <StandardPage
              active={isDashboardTabActive($dashboardView, "standard")}
            />
            <OrchestratedPage
              active={isDashboardTabActive($dashboardView, "orchestrated")}
            />
            <ReplayPage
              active={isDashboardTabActive($dashboardView, "replay")}
            />
            <PromptsPage
              active={isDashboardTabActive($dashboardView, "prompts")}
            />
            <TemplatesPage
              active={isDashboardTabActive($dashboardView, "templates")}
            />
            <InventoryPage
              active={isDashboardTabActive($dashboardView, "inventory")}
            />
            <TransferPage
              active={isDashboardTabActive($dashboardView, "transfer")}
            />
            <BlacklistPage
              active={isDashboardTabActive($dashboardView, "blacklist")}
            />
            <BackupPage
              active={isDashboardTabActive($dashboardView, "backup")}
            />
            <TasksPage active={isDashboardTabActive($dashboardView, "tasks")} />
          </section>
        </div>
      </main>
    </div>

    <div class="drawer-side z-40">
      <DashboardSidebar />
    </div>
  </div>

  <RecordDrawerBackdrop />
  <RecordDrawer />
  <DetailModal />
  <ConnectionModal />
  <SavedConnectionEditModal />
  <EntryDrawerBackdrop />
  <EntryDrawer />
  <HistoryDrawerBackdrop />
  <HistoryDrawer />
  <ToastStack />
</div>
