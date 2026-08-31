import { tr } from "../../../lib/i18n.js";
import { availableConfigKinds } from "../model/scheduleForm.js";
import type {
  MultiSelectOption,
  SchedulesDisplayState,
  SchedulesState,
} from "../model/types.js";

function formatTime(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function multiSelectOptions(values: string[]): MultiSelectOption[] {
  return values.map((value) => ({ label: value, value }));
}

export function schedulePresentation(
  state: SchedulesState,
): SchedulesDisplayState {
  const configKinds = availableConfigKinds(state).sort();
  return {
    ...state,
    scheduleRows: state.schedules.map((schedule) => ({
      ...schedule,
      active: schedule.id === state.selectedId,
      lastRunText: formatTime(schedule.last_run_at),
      nextRunText: formatTime(schedule.next_run_at),
    })),
    runRows: state.runs.map((run) => ({
      ...run,
      completedText: formatTime(run.completed_at),
      scheduledForText: formatTime(run.scheduled_for),
    })),
    connectionOptions: [
      {
        optionLabel: tr("scheduleConnectionPlaceholder", "Select a connection"),
        optionValue: "",
      },
      ...state.connections.map((connection) => ({
        optionLabel: connection.name,
        optionValue: connection.name,
      })),
    ],
    configTargetOptions: multiSelectOptions(
      state.connections.map((connection) => connection.name),
    ),
    configGroupOptions: multiSelectOptions(
      state.inventoryGroups.map((group) => group.name),
    ),
    configLabelOptions: multiSelectOptions(
      state.inventoryLabels.map((label) => label.name),
    ),
    configKindOptions: (configKinds.length
      ? configKinds
      : state.configKinds
    ).map((kind) => ({ optionLabel: kind, optionValue: kind })),
    orchestrationTemplateOptions: [
      {
        optionLabel: tr("scheduleTemplatePlaceholder", "Select a template"),
        optionValue: "",
      },
      ...state.orchestrationTemplates.map((template) => ({
        optionLabel: template.name,
        optionValue: template.name,
      })),
    ],
    txWorkflowTemplateOptions: [
      {
        optionLabel: tr(
          "scheduleTxTemplatePlaceholder",
          "Select a workflow template",
        ),
        optionValue: "",
      },
      ...state.txWorkflowTemplates.map((template) => ({
        optionLabel: template.name,
        optionValue: template.name,
      })),
    ],
  };
}
