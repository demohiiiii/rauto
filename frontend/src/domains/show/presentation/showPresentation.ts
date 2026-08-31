import {
  normalizeShowQuery,
  SHOW_QUERY,
} from "../../../config/dashboardModes.js";
import { t } from "../../../lib/i18n.js";
import { selectOptionsWithCurrent } from "../../../lib/ui.js";
import type {
  ShowModeOptionRow,
  ShowObjectSelectionDisplay,
  ShowPageDisplay,
} from "../model/types.js";

export function showModeOptionRows(
  selected = "",
  modeOptions: string[] = [],
): ShowModeOptionRow[] {
  const rows = selectOptionsWithCurrent(modeOptions, selected).map((value) => ({
    labelText: value,
    valueText: value,
  }));
  return [{ labelText: t("showModeAutoPlaceholder"), valueText: "" }, ...rows];
}

export function showPagePresentation(query = ""): ShowPageDisplay {
  const normalized = normalizeShowQuery(query);
  return {
    batchActive: normalized === SHOW_QUERY.batch,
    queryAriaLabel: t("opExecShow"),
    singleActive: normalized === SHOW_QUERY.single,
    title: t("opExecShow"),
  };
}

export function showObjectSelectionPresentation({
  selectedMode = "",
  modeOptions = [],
}: {
  selectedMode?: string;
  modeOptions?: string[];
} = {}): ShowObjectSelectionDisplay {
  return {
    commandLabel: t("showPreviewCommand"),
    mappingLabel: t("showPreviewMapping"),
    modeOptionRows: showModeOptionRows(selectedMode, modeOptions),
    modePlaceholder: t("modePlaceholder"),
    objectLabel: t("showObjectPlaceholder"),
    objectPlaceholder: t("showObjectPlaceholder"),
    platformLabel: t("showPreviewPlatform"),
    previewEmptyText: "-",
    previewTitle: t("showPreviewTitle"),
    sourceLabel: t("showPreviewSource"),
    textfsmLabel: t("showPreviewTextfsm"),
  };
}
