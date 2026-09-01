import { browserConfirm } from "../../../lib/browser.js";
import { tr } from "../../../lib/i18n.js";
import { profileModeExpressionMatchesOptions } from "$domains/profiles/model/modeExpression.js";
import {
  notifyCustomShowObjectsChanged,
  setCachedDeviceProfiles,
} from "./templateCatalogRuntime.js";

export const templatesRuntime = {
  confirmDiscard: () =>
    browserConfirm(
      tr(
        "templateManagerDiscardConfirm",
        "Discard the unsaved template changes?",
      ),
    ),
  notifyCustomShowObjectsChanged,
  profileModeMatches: profileModeExpressionMatchesOptions,
  setCachedDeviceProfiles,
};
