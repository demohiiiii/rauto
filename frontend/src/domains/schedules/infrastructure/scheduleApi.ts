import {
  createSchedule,
  deleteSchedule,
  listConfigCommands,
  listConnections,
  listInventoryGroups,
  listInventoryLabels,
  listScheduleRuns,
  listSchedules,
  listTemplateResource,
  previewSchedule,
  runScheduleNow,
  setScheduleEnabled,
  updateSchedule,
} from "../../../api/client.js";
import type { ScheduleApi } from "../model/types.js";

export const scheduleApi: ScheduleApi = {
  createSchedule,
  deleteSchedule,
  listConfigCommands,
  listConnections,
  listInventoryGroups,
  listInventoryLabels,
  listScheduleRuns,
  listSchedules,
  listTemplateResource,
  previewSchedule,
  runScheduleNow,
  setScheduleEnabled,
  updateSchedule,
};
