import {
  createTemplateResource,
  deleteTemplateResource,
  getTemplateResource,
  listTemplateResource,
  updateTemplateResource,
} from "../../../api/client.js";
import { promptForResourceName } from "../../../lib/ui.js";
import type { TransactionJsonTemplateRuntime } from "../model/types.js";

export const transactionJsonTemplateRuntime: TransactionJsonTemplateRuntime = {
  createTemplateResource,
  deleteTemplateResource,
  getTemplateResource,
  listTemplateResource,
  promptForResourceName,
  updateTemplateResource,
};
