import {
  executeTemplate,
  getTemplate,
  inspectCommandTemplate,
  listTemplates,
  renderTemplate,
} from "../../../api/client.js";
import type { StandardCommandApi } from "../model/types.js";

export const standardCommandApi = {
  executeTemplate,
  getTemplate,
  inspectCommandTemplate,
  listTemplates,
  renderTemplate,
} as StandardCommandApi;
