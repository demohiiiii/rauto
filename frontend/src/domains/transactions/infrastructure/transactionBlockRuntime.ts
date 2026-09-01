import { getTemplate } from "../../../api/client.js";
import { browserConfirm } from "../../../lib/browser.js";

export const transactionBlockRuntime = {
  confirm: browserConfirm as (message: string) => boolean,
  getTemplate: getTemplate as (name: string) => Promise<unknown>,
};
