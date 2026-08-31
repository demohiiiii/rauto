import { t } from "../../../lib/i18n.js";
import { safeString } from "../../../lib/ui.js";
import type {
  StandardCommandFlowExecutionInput,
  StandardCommandFlowExecutionPayload,
  StandardCommandFlowNormalizedExecutionSource,
  StandardCommandFlowTextfsmFields,
} from "./types.js";

const FLOW_BUILTIN_PREFIX = "builtin:";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parseBuiltinFlowTemplateValue(value: unknown): string | null {
  const raw = safeString(value ?? "").trim();
  if (!raw.toLowerCase().startsWith(FLOW_BUILTIN_PREFIX)) return null;
  const name = raw.slice(FLOW_BUILTIN_PREFIX.length).trim();
  return name || null;
}

export function normalizeCommandFlowExecutionSource(
  source: unknown = {},
): StandardCommandFlowNormalizedExecutionSource {
  const sourceFields = record(source);
  const kind = sourceFields.kind === "temporary" ? "temporary" : "saved";
  if (kind === "temporary") {
    const content = safeString(sourceFields.content ?? "");
    if (!content.trim()) {
      throw new Error(t("flowDraftContentRequired"));
    }
    return { content, kind };
  }

  const templateSelection = safeString(
    sourceFields.templateSelection ?? "",
  ).trim();
  if (!templateSelection) {
    throw new Error(t("flowTemplateNameRequired"));
  }
  return {
    builtinTemplateName: parseBuiltinFlowTemplateValue(templateSelection),
    kind,
    templateSelection,
  };
}

export function buildCommandFlowExecutionPayload(
  {
    connection,
    recordLevel,
    source,
    textfsm = {},
    vars,
  }: StandardCommandFlowExecutionInput = {},
  retryFields: Record<string, unknown> = {},
): StandardCommandFlowExecutionPayload {
  const normalizedSource = normalizeCommandFlowExecutionSource(source);
  const sourcePayload =
    normalizedSource.kind === "temporary"
      ? { content: normalizedSource.content }
      : {
          template_name: normalizedSource.builtinTemplateName
            ? null
            : normalizedSource.templateSelection,
          builtin_template_name: normalizedSource.builtinTemplateName,
        };
  return {
    ...sourcePayload,
    vars,
    ...record(textfsm),
    ...retryFields,
    connection,
    record_level: recordLevel,
  };
}

export function standardCommandFlowTextfsmPayload(
  fields: StandardCommandFlowTextfsmFields = {},
): Record<string, unknown> {
  return {
    textfsm_template: safeString(fields.template ?? "").trim() || null,
    parse_textfsm: !!fields.enabled,
    textfsm_platform: safeString(fields.platform ?? "").trim() || null,
    textfsm_strict_errors: !!fields.strictErrors,
  };
}
