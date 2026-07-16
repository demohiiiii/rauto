<script>
  import * as Card from "$lib/components/ui/card";
  import DashboardTabPanel from "../components/layout/DashboardTabPanel.svelte";
  import DetailFieldCard from "../components/fragments/DetailFieldCard.svelte";
  import StatusCard from "../components/fragments/StatusCard.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import { createTasksPageWorkspace } from "../modules/tasksState.js";
  import TaskDetailPanel from "./tasks/TaskDetailPanel.svelte";
  import TaskFiltersPanel from "./tasks/TaskFiltersPanel.svelte";

  let { active } = $props();
  const tasksPageWorkspace = createTasksPageWorkspace();
  const { taskDisplayStateStore } = tasksPageWorkspace;
  let taskDisplay = $derived($taskDisplayStateStore);
  let taskRunListDisplay = $derived(taskDisplay.taskRunListDisplay);
  let taskListStatus = $derived(taskRunListDisplay.listStatus);
  let taskList = $derived(taskRunListDisplay.taskList);

  $effect(() => {
    void tasksPageWorkspace.setPageContext({ active });
  });

  $effect(() => {
    if (active) return;
    tasksPageWorkspace.destroy();
  });
</script>

{#snippet taskRunList()}
  <Card.Root>
    <Card.Header class="flex flex-row items-center justify-between gap-2">
      <Card.Title>
        {taskList.title}
      </Card.Title>
      <span class="text-xs text-muted-foreground">
        {taskList.countText}
      </span>
    </Card.Header>
    <Card.Content class="grid gap-2">
      <div class="grid gap-2">
        {#if taskListStatus}
          <StatusCard
            message={taskListStatus.message}
            tone={taskListStatus.tone}
          />
        {/if}
      </div>
      <div class="grid gap-2">
        {#each taskList.taskRows as taskRow}
          <article class={taskRow.rowClass}>
            <div class="flex flex-wrap items-start justify-between gap-2">
              <div class="grid gap-1">
                <div class="flex flex-wrap items-center gap-2">
                  <div class="font-mono text-xs text-slate-500">
                    {taskRow.taskId}
                  </div>
                  {#each taskRow.badgeRows as taskBadgeRow}
                    <span class={taskBadgeRow.badgeClass}>
                      {taskBadgeRow.label}
                    </span>
                  {/each}
                </div>
                <div class="text-sm font-semibold text-slate-900">
                  {taskRow.summaryText}
                </div>
                <div class="mt-1 grid gap-1 md:grid-cols-2">
                  {#each taskRow.metaFields as taskMetaField}
                    <DetailFieldCard
                      detailValue={taskMetaField.detailValue}
                      label={taskMetaField.label}
                      variant="inline"
                    />
                  {/each}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                type="button"
                onclick={tasksPageWorkspace.selectTask(taskRow.taskId)}
              >
                {taskList.detailButtonLabel}
              </Button>
            </div>
          </article>
        {/each}
      </div>
      {#if !taskList.hasTaskRows}
        <div class="text-xs text-slate-500">
          {taskList.emptyMessage}
        </div>
      {/if}
    </Card.Content>
  </Card.Root>
{/snippet}

<DashboardTabPanel {active}>
  <div class="grid gap-3 xl:grid-cols-[1.15fr_0.85fr]">
    <div class="grid gap-3">
      <TaskFiltersPanel
        taskFilters={taskDisplay.taskFilters}
        onClearFilters={tasksPageWorkspace.clearFilters}
        onErrorFilterChange={tasksPageWorkspace.updateTaskErrorFilter}
        onLimitChange={tasksPageWorkspace.updateTaskLimit}
        onOperationChange={tasksPageWorkspace.updateTaskOperation}
        onOutcomeChange={tasksPageWorkspace.updateTaskOutcome}
        onRecordingChange={tasksPageWorkspace.updateTaskRecording}
        onRefresh={tasksPageWorkspace.refreshTasks}
        onSearchInput={tasksPageWorkspace.updateTaskSearch}
        onStatusChange={tasksPageWorkspace.updateTaskStatus}
        onTimeRangeChange={tasksPageWorkspace.updateTaskTimeRange}
      />

      {@render taskRunList()}
    </div>

    <TaskDetailPanel
      detailStatus={taskDisplay.detailStatus}
      onGroupFilterChange={tasksPageWorkspace.updateTaskEventGroupFilter}
      onSearchInput={tasksPageWorkspace.updateTaskEventSearch}
      taskDetail={taskDisplay.taskDetail}
      taskEventsDisplay={taskDisplay.taskEventsDisplay}
    />
  </div>
</DashboardTabPanel>
