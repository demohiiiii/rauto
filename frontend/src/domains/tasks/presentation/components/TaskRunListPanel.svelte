<script lang="ts">
  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button/index.js";
  import DetailFieldCard from "$components/fragments/DetailFieldCard.svelte";
  import StatusCard from "$components/fragments/StatusCard.svelte";
  import WorkspaceActionHeader from "$components/fragments/WorkspaceActionHeader.svelte";
  import ClipboardListIcon from "@lucide/svelte/icons/clipboard-list";
  import type { TaskRunListDisplay } from "../tasksPresentation.js";

  interface TaskRunListPanelProps {
    onSelectTask: (taskId: string) => () => Promise<void>;
    taskRunListDisplay: TaskRunListDisplay;
  }

  let { onSelectTask, taskRunListDisplay }: TaskRunListPanelProps = $props();
  let taskListStatus = $derived(taskRunListDisplay.listStatus);
  let taskList = $derived(taskRunListDisplay.taskList);
</script>

<Card.Root class="gap-0 overflow-hidden border-border/80 py-0 shadow-sm">
  <WorkspaceActionHeader title={taskList.title} icon={ClipboardListIcon}>
    {#snippet actions()}
      <span class="text-xs text-muted-foreground">
        {taskList.countText}
      </span>
    {/snippet}
  </WorkspaceActionHeader>
  <Card.Content class="grid gap-2 p-4 sm:p-5">
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
              onclick={onSelectTask(taskRow.taskId)}
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
