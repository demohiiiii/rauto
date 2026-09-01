import { safeString } from "../../../lib/ui.js";
import { profileValues } from "./profileEditor.js";
import { recordValue } from "./customProfileForm.js";
import type { CustomProfileForm, UnknownRecord } from "./types.js";

export interface BuiltinProfileOverviewState {
  builtins: UnknownRecord[];
  options: string[];
  overviewText: string;
  selected: string;
}

export interface BuiltinProfileDetailState {
  aliases: string;
  name: string;
  notes: string;
  source: string;
  summary: string;
}

export interface ProfileCatalogStatusState {
  message: string;
  tone: string;
}

export interface ProfileCatalogApi {
  getBuiltinProfileDetail(name: string): Promise<unknown>;
  getBuiltinProfileForm(name: string): Promise<unknown>;
  getDeviceProfilesOverview(): Promise<unknown>;
}

export function emptyBuiltinProfileOverview(): BuiltinProfileOverviewState {
  return { builtins: [], options: [], overviewText: "-", selected: "" };
}

export function emptyBuiltinProfileDetail(): BuiltinProfileDetailState {
  return { aliases: "", name: "", notes: "", source: "", summary: "" };
}

export function normalizeBuiltinProfileDetail(
  detailValue: unknown,
): BuiltinProfileDetailState {
  const detail = recordValue(detailValue);
  return {
    aliases: profileValues(detail.aliases).map(safeString).join(", "),
    name: safeString(detail.name || ""),
    notes: profileValues(detail.notes).map(safeString).join("\n"),
    source: safeString(detail.source || ""),
    summary: safeString(detail.summary || ""),
  };
}

function builtinOverviewLine(profile: UnknownRecord): string {
  const name = safeString(profile.name || "");
  const aliases = profileValues(profile.aliases)
    .map(safeString)
    .filter(Boolean);
  const aliasText = aliases.length ? ` (aliases: ${aliases.join(",")})` : "";
  return `- ${name}${aliasText}: ${safeString(profile.summary || "")}`;
}

export function normalizeBuiltinProfileOverview(
  builtinsValue: unknown,
  selectedName = "",
): BuiltinProfileOverviewState {
  const builtins = profileValues(builtinsValue).map(recordValue);
  const options = builtins
    .map((profile) => safeString(profile.name || ""))
    .filter(Boolean);
  return {
    builtins,
    options,
    overviewText: builtins.map(builtinOverviewLine).join("\n") || "-",
    selected: options.includes(selectedName) ? selectedName : "",
  };
}

export function selectBuiltinProfile(
  state: BuiltinProfileOverviewState,
  profileName: unknown,
): BuiltinProfileOverviewState {
  const selectedName = safeString(profileName).trim();
  return {
    ...state,
    selected: state.builtins.some(
      (profile) => safeString(profile.name) === selectedName,
    )
      ? selectedName
      : "",
  };
}

export function cloneBuiltinProfileAsCustom(
  profile: UnknownRecord,
): CustomProfileForm {
  const copied = JSON.parse(JSON.stringify(profile)) as CustomProfileForm;
  copied.name = `${safeString(copied.name)}_custom`;
  return copied;
}
