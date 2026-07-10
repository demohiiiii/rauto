<script>
  import * as Card from "$lib/components/ui/card";
  import OutputBlock from "../../components/fragments/OutputBlock.svelte";
  import PlainInputField from "../../components/fragments/PlainInputField.svelte";
  import StatusCard from "../../components/fragments/StatusCard.svelte";
  import ValueLabelSelectField from "../../components/fragments/ValueLabelSelectField.svelte";
  import { taskEventFilterActionHandlers } from "../../modules/tasksState.js";
  import TaskDetailOverviewPanel from "./TaskDetailOverviewPanel.svelte";

  let {
    detailStatus,
    onGroupFilterChange,
    onSearchInput,
    taskDetail,
    taskEventsDisplay,
  } = $props();
  let actionHandlers = $derived(
    taskEventFilterActionHandlers({
      onGroupFilterChange,
      onSearchInput,
    }),
  );
</script>

{#snippet taskEventBadge(taskEventBadgeLabel, taskEventBadgeClass)}
  <span class={taskEventBadgeClass}>
    {taskEventBadgeLabel}
  </span>
{/snippet}

{#snippet taskEventGroup(eventGroupRow)}
  <section class="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
    <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div class="text-sm font-semibold text-slate-900">
        {eventGroupRow.label}
      </div>
      {#each eventGroupRow.badgeRows as eventGroupBadgeRow}
        {@render taskEventBadge(
          eventGroupBadgeRow.label,
          eventGroupBadgeRow.badgeClass,
        )}
      {/each}
    </div>
    <div class="grid gap-2">
      {#each eventGroupRow.taskEventRows as taskEvent, taskEventIndex}
        <details
          class="rounded-xl border border-slate-200 bg-white"
          open={taskEventIndex === 0}
        >
          <summary class="cursor-pointer list-none px-3 py-3">
            <div class="grid gap-1">
              <div class="flex flex-wrap items-center gap-2">
                <div class="text-xs font-semibold text-slate-700">
                  {taskEvent.eventType}
                </div>
                {#each taskEvent.badgeRows as taskEventBadgeRow}
                  {@render taskEventBadge(
                    taskEventBadgeRow.label,
                    taskEventBadgeRow.badgeClass,
                  )}
                {/each}
              </div>
              <div class="text-sm text-slate-900">
                {taskEvent.message}
              </div>
              <div class="text-[11px] text-slate-500">
                {taskEvent.occurredAtText}
              </div>
            </div>
          </summary>
          <div class="border-t border-slate-200 px-3 py-3">
            {#if taskEvent.hasDetails}
              <OutputBlock>{taskEvent.detailsPreview}</OutputBlock>
            {:else}
              <div class="text-xs text-slate-500">
                {taskEventsDisplay.noDetailsText}
              </div>
            {/if}
          </div>
        </details>
      {/each}
    </div>
  </section>
{/snippet}

<Card.Root>
  <Card.Header>
    <Card.Title>
      {taskDetail.title}
    </Card.Title>
  </Card.Header>
  <Card.Content class="grid gap-2">
    {#if detailStatus}
      <StatusCard message={detailStatus.message} tone={detailStatus.tone} />
    {/if}
    {#if !taskDetail.hasDetail}
      <div class="text-xs text-slate-500">
        {taskDetail.emptyMessage}
      </div>
    {:else}
      <div class="grid gap-2">
        <TaskDetailOverviewPanel {taskDetail} />

        <section class="rounded-xl border border-slate-200 bg-white px-3 py-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="text-sm font-semibold text-slate-900">
              {taskEventsDisplay.title}
            </div>
            <div class="text-xs text-slate-500">
              {taskEventsDisplay.countText}
            </div>
          </div>
          <div class="mt-3 grid gap-2 md:grid-cols-[180px_1fr]">
            <ValueLabelSelectField
              value={taskEventsDisplay.currentGroupValue}
              aria-label={taskEventsDisplay.filterGroupLabel}
              optionRows={taskEventsDisplay.eventGroupOptionRows}
              onValueChange={actionHandlers.groupFilterChangeHandler}
            />
            <PlainInputField
              value={taskEventsDisplay.searchField.value}
              type="text"
              aria-label={taskEventsDisplay.searchField.ariaLabelText}
              placeholderText={taskEventsDisplay.searchField.placeholder}
              onValueInput={actionHandlers.searchChangeHandler}
            />
          </div>
          <div class="mt-3 grid gap-2">
            {#if taskEventsDisplay.hasEventGroupRows}
              {#each taskEventsDisplay.eventGroupRows as eventGroupRow}
                {@render taskEventGroup(eventGroupRow)}
              {/each}
            {:else}
              <StatusCard message={taskEventsDisplay.emptyMessage} />
            {/if}
          </div>
        </section>
      </div>
    {/if}
  </Card.Content>
</Card.Root>
