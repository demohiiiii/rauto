<script>
  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button/index.js";
  import LoadingButton from "../../components/fragments/LoadingButton.svelte";
  import PlainInputField from "../../components/fragments/PlainInputField.svelte";
  import PlainSelectField from "../../components/fragments/PlainSelectField.svelte";
  import { taskFiltersActionHandlers } from "../../modules/tasksState.js";

  let {
    taskFilters,
    onClearFilters,
    onErrorFilterChange,
    onLimitChange,
    onOperationChange,
    onOutcomeChange,
    onRecordingChange,
    onRefresh,
    onSearchInput,
    onStatusChange,
    onTimeRangeChange,
  } = $props();
  let actionHandlers = $derived(
    taskFiltersActionHandlers({
      onErrorFilterChange,
      onLimitChange,
      onOperationChange,
      onOutcomeChange,
      onRecordingChange,
      onSearchInput,
      onStatusChange,
      onTimeRangeChange,
    }),
  );
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>
      {taskFilters.title}
    </Card.Title>
  </Card.Header>
  <Card.Content
    class="grid gap-2 md:grid-cols-[120px_1fr_1fr_1fr_1fr_1fr_1fr_auto_auto]"
  >
    <PlainSelectField
      title={taskFilters.fields.limit.label}
      aria-label={taskFilters.fields.limit.label}
      value={taskFilters.fields.limit.currentValue}
      optionRows={taskFilters.fields.limit.options}
      onValueChange={actionHandlers.limitChangeHandler}
    />
    <PlainInputField
      value={taskFilters.searchField.value}
      type="text"
      aria-label={taskFilters.searchField.ariaLabelText}
      placeholderText={taskFilters.searchField.placeholder}
      onValueInput={actionHandlers.searchChangeHandler}
    />
    <PlainSelectField
      title={taskFilters.fields.operation.label}
      aria-label={taskFilters.fields.operation.label}
      value={taskFilters.fields.operation.currentValue}
      optionRows={taskFilters.fields.operation.options}
      onValueChange={actionHandlers.operationChangeHandler}
    />
    <PlainSelectField
      title={taskFilters.fields.status.label}
      aria-label={taskFilters.fields.status.label}
      value={taskFilters.fields.status.currentValue}
      optionRows={taskFilters.fields.status.options}
      onValueChange={actionHandlers.statusChangeHandler}
    />
    <PlainSelectField
      title={taskFilters.fields.outcome.label}
      aria-label={taskFilters.fields.outcome.label}
      value={taskFilters.fields.outcome.currentValue}
      optionRows={taskFilters.fields.outcome.options}
      onValueChange={actionHandlers.outcomeChangeHandler}
    />
    <PlainSelectField
      title={taskFilters.fields.timeRange.label}
      aria-label={taskFilters.fields.timeRange.label}
      value={taskFilters.fields.timeRange.currentValue}
      optionRows={taskFilters.fields.timeRange.options}
      onValueChange={actionHandlers.timeRangeChangeHandler}
    />
    <PlainSelectField
      title={taskFilters.fields.recording.label}
      aria-label={taskFilters.fields.recording.label}
      value={taskFilters.fields.recording.currentValue}
      optionRows={taskFilters.fields.recording.options}
      onValueChange={actionHandlers.recordingChangeHandler}
    />
    <PlainSelectField
      title={taskFilters.fields.errorFilter.label}
      aria-label={taskFilters.fields.errorFilter.label}
      value={taskFilters.fields.errorFilter.currentValue}
      optionRows={taskFilters.fields.errorFilter.options}
      onValueChange={actionHandlers.errorFilterChangeHandler}
    />
    <LoadingButton
      variant="outline"
      size="sm"
      loading={taskFilters.refreshLoading}
      onclick={onRefresh}
    >
      <span>{taskFilters.refreshButtonLabel}</span>
    </LoadingButton>
    <Button variant="outline" size="sm" type="button" onclick={onClearFilters}>
      {taskFilters.clearButtonLabel}
    </Button>
  </Card.Content>
</Card.Root>
