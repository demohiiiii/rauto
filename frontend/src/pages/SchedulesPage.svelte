<script>
  import CalendarClockIcon from "@lucide/svelte/icons/calendar-clock";
  import PauseIcon from "@lucide/svelte/icons/pause";
  import PencilIcon from "@lucide/svelte/icons/pencil";
  import PlayIcon from "@lucide/svelte/icons/play";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import RefreshCwIcon from "@lucide/svelte/icons/refresh-cw";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import ScheduleEditorDialog from "../components/schedules/ScheduleEditorDialog.svelte";
  import StatusCard from "../components/fragments/StatusCard.svelte";
  import WorkspaceActionHeader from "../components/fragments/WorkspaceActionHeader.svelte";
  import DashboardTabPanel from "../components/layout/DashboardTabPanel.svelte";
  import { tr } from "../lib/i18n.js";
  import { createSchedulesPageWorkspace } from "../modules/schedules/schedulesState.js";

  let { active } = $props();
  const workspace = createSchedulesPageWorkspace();
  const { displayStateStore } = workspace;
  let display = $derived($displayStateStore);

  $effect(() => {
    void workspace.setPageContext({ active });
  });

  function statusClass(status) {
    if (status === "success") return "bg-emerald-100 text-emerald-700";
    if (status === "failed") return "bg-rose-100 text-rose-700";
    if (status === "running") return "bg-blue-100 text-blue-700";
    if (status === "skipped") return "bg-amber-100 text-amber-700";
    return "bg-muted text-muted-foreground";
  }

  function actionLabel(action) {
    if (action?.type === "config_fetch") {
      return tr("scheduleActionConfigFetch", "Configuration fetch");
    }
    if (action?.type === "tx_workflow") {
      return tr("scheduleActionTxWorkflow", "Transaction workflow");
    }
    return tr("scheduleActionOrchestrate", "Orchestration");
  }

  function actionSummary(action) {
    if (action?.type === "config_fetch") {
      const selectors = [
        ...(Array.isArray(action.targets) ? action.targets : []),
        ...(Array.isArray(action.groups)
          ? action.groups.map(
              (group) => `${tr("scheduleConfigGroups", "Groups")}: ${group}`,
            )
          : []),
        ...(Array.isArray(action.labels)
          ? action.labels.map(
              (label) => `${tr("scheduleConfigLabels", "Labels")}: ${label}`,
            )
          : []),
      ];
      if (!selectors.length && action.connection_name) {
        selectors.push(action.connection_name);
      }
      return `${selectors.join(", ") || "-"} · ${action.kind}`;
    }
    if (action?.type === "tx_workflow") {
      return `${action.connection_name} · ${action.template_name}`;
    }
    return action?.template_name || "-";
  }

  function confirmDelete(schedule) {
    if (window.confirm(tr("scheduleDeleteConfirm", "Delete this schedule?"))) {
      void workspace.remove(schedule.id);
    }
  }
</script>

<DashboardTabPanel {active}>
  <div class="grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]">
    <Card.Root class="gap-0 overflow-hidden border-border/80 py-0 shadow-sm">
      <WorkspaceActionHeader
        title={tr("scheduleListTitle", "Schedules")}
        icon={CalendarClockIcon}
      >
        {#snippet actions()}
          <Button
            variant="ghost"
            size="icon-sm"
            type="button"
            title={tr("refresh", "Refresh")}
            aria-label={tr("refresh", "Refresh")}
            onclick={() => workspace.refresh()}
          >
            <RefreshCwIcon />
          </Button>
          <Button
            variant="outline"
            size="sm"
            type="button"
            onclick={workspace.startCreate}
          >
            <PlusIcon data-icon="inline-start" />
            {tr("scheduleNew", "New schedule")}
          </Button>
        {/snippet}
      </WorkspaceActionHeader>
      <Card.Content class="grid gap-2 p-4 sm:p-5">
        {#if display.listStatus}
          <StatusCard
            message={display.listStatus.message}
            tone={display.listStatus.tone}
          />
        {/if}
        {#each display.scheduleRows as schedule (schedule.id)}
          <article
            class:!border-primary={schedule.active}
            class="grid gap-3 rounded-md border border-border p-3"
          >
            <button
              class="grid min-w-0 gap-1.5 text-left"
              type="button"
              onclick={workspace.selectSchedule(schedule.id)}
            >
              <span class="flex flex-wrap items-center gap-2">
                <span class="text-sm font-semibold">{schedule.name}</span>
                <span
                  class={schedule.enabled
                    ? "rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-700"
                    : "rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"}
                >
                  {schedule.enabled
                    ? tr("enabled", "Enabled")
                    : tr("disabled", "Disabled")}
                </span>
                <span
                  class="rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary"
                >
                  {actionLabel(schedule.action)}
                </span>
              </span>
              <span class="truncate text-xs text-muted-foreground">
                {actionSummary(schedule.action)}
              </span>
              <code class="text-xs text-muted-foreground">
                {schedule.cron_expression} · {schedule.timezone}
              </code>
              <span class="text-xs text-muted-foreground">
                {tr("scheduleNextRun", "Next")}: {schedule.nextRunText}
              </span>
            </button>
            <div class="flex flex-wrap items-center gap-2 border-t pt-2">
              <Button
                variant="outline"
                size="sm"
                type="button"
                onclick={workspace.runNow(schedule)}
              >
                <PlayIcon data-icon="inline-start" />
                {tr("scheduleRunNow", "Run now")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onclick={workspace.toggleEnabled(schedule)}
              >
                {#if schedule.enabled}
                  <PauseIcon data-icon="inline-start" />
                  {tr("scheduleDisable", "Disable")}
                {:else}
                  <PlayIcon data-icon="inline-start" />
                  {tr("scheduleEnable", "Enable")}
                {/if}
              </Button>
              <Button
                class="ml-auto"
                variant="ghost"
                size="icon-sm"
                type="button"
                title={tr("edit", "Edit")}
                aria-label={tr("edit", "Edit")}
                onclick={workspace.editSchedule(schedule.id)}
              >
                <PencilIcon />
              </Button>
              <Button
                variant="destructive"
                size="icon-sm"
                type="button"
                disabled={display.busyAction === `delete:${schedule.id}`}
                title={tr("delete", "Delete")}
                aria-label={tr("delete", "Delete")}
                onclick={() => confirmDelete(schedule)}
              >
                <Trash2Icon />
              </Button>
            </div>
          </article>
        {:else}
          <StatusCard message={tr("scheduleEmpty", "No schedules")} />
        {/each}
      </Card.Content>
    </Card.Root>

    <Card.Root
      class="h-fit gap-0 overflow-hidden border-border/80 py-0 shadow-sm"
    >
      <WorkspaceActionHeader
        title={tr("scheduleRuns", "Recent runs")}
        icon={RefreshCwIcon}
      />
      <Card.Content class="grid gap-2 p-4 sm:p-5">
        {#if !display.selectedId}
          <StatusCard
            message={tr(
              "scheduleSelectForRuns",
              "Select a schedule to view its runs",
            )}
          />
        {:else}
          {#if display.runsStatus}
            <StatusCard
              message={display.runsStatus.message}
              tone={display.runsStatus.tone}
            />
          {/if}
          {#each display.runRows as run (run.id)}
            <div class="grid gap-1 rounded-md border border-border p-3 text-xs">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <span class="break-all font-mono text-muted-foreground">
                  {run.task_id || run.id}
                </span>
                <span
                  class={`rounded px-1.5 py-0.5 ${statusClass(run.status)}`}
                >
                  {run.status}
                </span>
              </div>
              <span>{run.scheduledForText}</span>
              {#if run.error || run.skip_reason}
                <span class="break-all text-rose-600">
                  {run.error || run.skip_reason}
                </span>
              {/if}
            </div>
          {:else}
            <StatusCard message={tr("scheduleRunsEmpty", "No runs")} />
          {/each}
        {/if}
      </Card.Content>
    </Card.Root>
  </div>

  <ScheduleEditorDialog {display} {workspace} />
</DashboardTabPanel>
