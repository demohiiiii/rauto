import { getTask, listTasks } from "../../../api/client.js";
import type { TasksApi } from "../model/types.js";

export const tasksApi: TasksApi = {
  getTask,
  listTasks,
};
