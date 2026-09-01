import {
  deleteCustomProfile,
  getCustomProfileForm,
  saveCustomProfileForm,
} from "../../../api/client.js";
import { promptForResourceName, statusPresentation } from "../../../lib/ui.js";
import { showToast } from "$domains/overlays/index.js";
import type { CustomProfileEditorRuntime } from "../model/types.js";

export const profileEditorRuntime: CustomProfileEditorRuntime = {
  deleteCustomProfile,
  getCustomProfileForm,
  promptForResourceName,
  publishStatus(message, tone) {
    const presentation = statusPresentation(message, tone);
    if (presentation.shouldToast) {
      showToast(presentation.text, presentation.tone);
    }
    return {
      message: presentation.inlineMessage,
      tone: presentation.tone,
    };
  },
  saveCustomProfileForm,
};
