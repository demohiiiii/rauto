import {
  createTemplate,
  updateTemplate,
  executeTemplate,
  getTemplate,
  inspectCommandTemplate,
  listTemplates,
  renderTemplate,
} from "../../../api/client.js";
import type { StandardCommandApi } from "../model/types.js";

export const standardCommandApi: StandardCommandApi = {
  createTemplate,
  updateTemplate,
  executeTemplate,
  getTemplate,
  inspectCommandTemplate,
  listTemplates,
  renderTemplate,
};
