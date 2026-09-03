<script lang="ts">
  import DashboardTabPanel from "$components/layout/DashboardTabPanel.svelte";
  import { createTasksPageWorkspace } from "$domains/tasks/index.js";
  import TaskDetailPanel from "./TaskDetailPanel.svelte";
  import TaskFiltersPanel from "./TaskFiltersPanel.svelte";
  import TaskRunListPanel from "./TaskRunListPanel.svelte";

  let { active }: { active: boolean } = $props();
  const tasksPageWorkspace = createTasksPageWorkspace();
  const { taskDisplayStateStore } = tasksPageWorkspace;
  let taskDisplay = $derived($taskDisplayStateStore);

  $effect(() => {
    void tasksPageWorkspace.setPageContext({ active });
  });

  $effect(() => {
    if (active) return;
    tasksPageWorkspace.destroy();
  });
</script>

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

      <TaskRunListPanel
        taskRunListDisplay={taskDisplay.taskRunListDisplay}
        onSelectTask={tasksPageWorkspace.selectTask}
      />
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
