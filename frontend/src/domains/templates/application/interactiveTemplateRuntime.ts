import { get, writable } from "svelte/store";
import { currentLanguage, tr } from "../../../lib/i18n.js";
import { safeString } from "../../../lib/ui.js";
import type { JsonObject, JsonValue } from "$lib/jsonValue.js";
import { templatesApi } from "../infrastructure/templatesApi.js";
import type {
  InteractiveTemplateDetail,
  InteractiveTemplateSelectState,
  InteractiveVarField,
  InteractiveVarsState,
  TemplateResourceApiMeta,
  TemplateVariableField,
} from "../model/types.js";

export function createInteractiveTemplateRuntime() {
  const INTERACTIVE_TEMPLATE_BASE = "/api/interactive-templates";
  const INTERACTIVE_BUILTIN_TEMPLATE_BASE =
    "/api/interactive-templates/builtins";
  const INTERACTIVE_BUILTIN_PREFIX = "builtin:";

  const interactiveVarsFieldState = writable<InteractiveVarsState>({
    draft: {},
    errorMessage: "",
    fields: [],
    hintText: tr("interactiveVarsFieldsHint"),
    values: {},
  });
  const runInteractiveTemplateSelectState =
    writable<InteractiveTemplateSelectState>({
      options: [],
      selected: "",
    });

  function defaultInteractiveVarDraft(field: InteractiveVarField): string {
    if (field.defaultValue === undefined || field.defaultValue === null)
      return "";
    if (field.kind === "boolean") {
      if (field.defaultValue === true) return "true";
      if (field.defaultValue === false) return "false";
      return "";
    }
    if (field.kind === "json") {
      try {
        return JSON.stringify(field.defaultValue, null, 2);
      } catch {
        return "";
      }
    }
    return safeString(field.defaultValue);
  }

  function interactiveVarsFieldValues(
    fields: InteractiveVarField[] = [],
    draft: Record<string, string> = {},
  ): Record<string, string> {
    return Object.fromEntries(
      fields.map((field) => {
        const draftValue = draft[field.name];
        const fieldValue =
          draftValue !== undefined
            ? safeString(draftValue ?? "")
            : defaultInteractiveVarDraft(field);
        return [field.name, fieldValue];
      }),
    );
  }

  async function fetchInteractiveTemplateCollections() {
    const [savedResult, builtinResult] = await Promise.allSettled([
      templatesApi.listTemplateResource(INTERACTIVE_TEMPLATE_BASE),
      templatesApi.listTemplateResource(INTERACTIVE_BUILTIN_TEMPLATE_BASE),
    ]);
    const metas = savedResult.status === "fulfilled" ? savedResult.value : [];
    const builtinMetas =
      builtinResult.status === "fulfilled" ? builtinResult.value : [];
    return {
      builtinMetas,
      metas,
      names: metas.map((meta) => meta.name).filter(Boolean),
    };
  }

  function buildBuiltinInteractiveTemplateValue(templateName: string): string {
    const normalized = templateName.trim();
    return normalized ? `${INTERACTIVE_BUILTIN_PREFIX}${normalized}` : "";
  }

  function updateInteractiveTemplateSelectOptions({
    builtinMetas = [],
    names = [],
  }: {
    builtinMetas?: TemplateResourceApiMeta[];
    names?: string[];
  }): void {
    const builtinValues = builtinMetas
      .map((meta) => buildBuiltinInteractiveTemplateValue(meta.name))
      .filter(Boolean);
    runInteractiveTemplateSelectState.update((state) => ({
      options: [...names, ...builtinValues],
      selected: safeString(state.selected || ""),
    }));
  }

  let collectionLoadVersion = 0;

  async function loadInteractiveTemplates() {
    const version = ++collectionLoadVersion;
    try {
      const interactiveTemplates = await fetchInteractiveTemplateCollections();
      if (version === collectionLoadVersion)
        updateInteractiveTemplateSelectOptions(interactiveTemplates);
      return interactiveTemplates;
    } catch (error) {
      if (version === collectionLoadVersion)
        updateInteractiveTemplateSelectOptions({ builtinMetas: [], names: [] });
      return {
        builtinMetas: [],
        error,
        metas: [],
        names: [],
      };
    }
  }

  type InteractiveTemplateSchema = Pick<
    InteractiveTemplateDetail,
    "vars_schema"
  > & {
    __selection_key?: string;
  };

  let lastInteractiveRunTemplateDetailState: InteractiveTemplateSchema | null =
    null;

  function parseBuiltinInteractiveTemplateValue(
    templateValue: string,
  ): string | null {
    const raw = templateValue.trim();
    if (!raw.toLowerCase().startsWith(INTERACTIVE_BUILTIN_PREFIX)) return null;
    const name = raw.slice(INTERACTIVE_BUILTIN_PREFIX.length).trim();
    return name || null;
  }

  function normalizeInteractiveTemplateVarSchema(
    field: TemplateVariableField,
  ): InteractiveVarField | null {
    const name = field.name.trim();
    if (!name) return null;
    const kind = field.type.trim().toLowerCase() || "string";
    return {
      name,
      label: field.label.trim() || name,
      description: field.description?.trim() ?? "",
      kind,
      required: field.required,
      allowEmpty: field.allow_empty,
      placeholder: field.placeholder?.trim() ?? "",
      options: field.options,
      defaultValue: field.default,
    };
  }

  function getInteractiveRunVarsSchema(
    detail: InteractiveTemplateSchema | null = lastInteractiveRunTemplateDetailState,
  ): InteractiveVarField[] {
    if (!detail) return [];
    return detail.vars_schema
      .map(normalizeInteractiveTemplateVarSchema)
      .filter((field): field is InteractiveVarField => field !== null);
  }

  function updateInteractiveTemplateVarFields(
    detail: InteractiveTemplateSchema | null = null,
    draft: Record<string, string> = {},
  ): void {
    lastInteractiveRunTemplateDetailState = detail;
    const schema = getInteractiveRunVarsSchema();
    const hintText = !schema.length
      ? lastInteractiveRunTemplateDetailState
        ? tr("interactiveVarsFieldsEmpty")
        : tr("interactiveVarsFieldsHint")
      : tr("interactiveVarsFieldsHint");
    interactiveVarsFieldState.update((state) => ({
      ...state,
      draft,
      errorMessage: "",
      fields: schema,
      hintText,
      values: interactiveVarsFieldValues(schema, draft),
    }));
  }

  function setInteractiveTemplateVarFieldsError(message: unknown): void {
    lastInteractiveRunTemplateDetailState = null;
    interactiveVarsFieldState.update((state) => ({
      ...state,
      draft: {},
      errorMessage:
        message instanceof Error ? message.message : String(message ?? ""),
      fields: [],
      hintText: tr("interactiveVarsFieldsHint"),
      values: {},
    }));
  }

  function setInteractiveVarDraftValue(name: string, fieldValue = ""): void {
    const key = name.trim();
    if (!key) return;
    interactiveVarsFieldState.update((state) => ({
      ...state,
      values: {
        ...state.values,
        [key]: fieldValue,
      },
    }));
  }

  async function ensureInteractiveRunTemplateDetail(
    templateName: string,
    loadConfig: { silent?: boolean } = {},
  ): Promise<InteractiveTemplateSchema | null> {
    const name = templateName.trim();
    if (!name) {
      updateInteractiveTemplateVarFields(null, {});
      return null;
    }
    if (
      lastInteractiveRunTemplateDetailState &&
      safeString(
        lastInteractiveRunTemplateDetailState.__selection_key || "",
      ).trim() === name
    ) {
      return lastInteractiveRunTemplateDetailState;
    }
    try {
      const builtinName = parseBuiltinInteractiveTemplateValue(name);
      const payload = await templatesApi.getInteractiveTemplate(
        builtinName || name,
        { builtin: Boolean(builtinName) },
      );
      const selectedDetail = { ...payload, __selection_key: name };
      updateInteractiveTemplateVarFields(selectedDetail, {});
      return selectedDetail;
    } catch (error) {
      const message =
        error && typeof error === "object" && "message" in error
          ? error.message
          : String(error);
      if (!loadConfig.silent) setInteractiveTemplateVarFieldsError(message);
      else updateInteractiveTemplateVarFields(null, {});
      throw error;
    }
  }

  function getCurrentInteractiveTemplateFieldDraft(): Record<string, string> {
    return { ...get(interactiveVarsFieldState).values };
  }

  function interactiveVarRequiredMessage(label: string): string {
    return currentLanguage() === "zh"
      ? `${label}${tr("interactiveVarRequiredSuffix")}`
      : `${label} ${tr("interactiveVarRequiredSuffix")}`;
  }

  function collectInteractiveTemplateFieldValues(): JsonObject {
    const fieldValues: JsonObject = {};
    const draft = getCurrentInteractiveTemplateFieldDraft();
    for (const field of getInteractiveRunVarsSchema()) {
      const hasDraft = Object.hasOwn(draft, field.name);
      const raw = safeString(hasDraft ? draft[field.name] : "");
      const isBlank = raw.trim() === "";
      const hasDefault = field.defaultValue != null;

      if (field.kind === "json") {
        if (isBlank) {
          if (field.required && !field.allowEmpty && !hasDefault) {
            throw new Error(interactiveVarRequiredMessage(field.label));
          }
          if (field.allowEmpty) fieldValues[field.name] = "";
          continue;
        }
        try {
          fieldValues[field.name] = JSON.parse(raw) as JsonValue;
        } catch {
          throw new Error(`${field.label} ${tr("interactiveVarJsonInvalid")}`);
        }
        continue;
      }

      if (field.kind === "boolean") {
        if (isBlank) {
          if (field.required && !field.allowEmpty && !hasDefault) {
            throw new Error(interactiveVarRequiredMessage(field.label));
          }
          if (field.allowEmpty) fieldValues[field.name] = "";
          continue;
        }
        fieldValues[field.name] = raw === "true";
        continue;
      }

      if (isBlank) {
        if (field.required && !field.allowEmpty && !hasDefault) {
          throw new Error(interactiveVarRequiredMessage(field.label));
        }
        if (field.allowEmpty) fieldValues[field.name] = "";
        continue;
      }

      if (field.kind === "number") {
        const parsed = Number(raw);
        if (Number.isNaN(parsed)) {
          throw new Error(
            `${field.label} ${tr("interactiveVarNumberInvalid")}`,
          );
        }
        fieldValues[field.name] = parsed;
        continue;
      }

      fieldValues[field.name] = raw;
    }
    return fieldValues;
  }

  function buildInteractiveVarsPayload(): JsonObject | null {
    const fieldVars = collectInteractiveTemplateFieldValues();
    return Object.keys(fieldVars).length ? fieldVars : null;
  }

  return {
    interactiveVarsFieldState,
    runInteractiveTemplateSelectState,
    loadInteractiveTemplates,
    parseBuiltinInteractiveTemplateValue,
    updateInteractiveTemplateVarFields,
    setInteractiveVarDraftValue,
    ensureInteractiveRunTemplateDetail,
    getCurrentInteractiveTemplateFieldDraft,
    buildInteractiveVarsPayload,
  };
}

export const {
  interactiveVarsFieldState,
  runInteractiveTemplateSelectState,
  loadInteractiveTemplates,
  parseBuiltinInteractiveTemplateValue,
  updateInteractiveTemplateVarFields,
  setInteractiveVarDraftValue,
  ensureInteractiveRunTemplateDetail,
  getCurrentInteractiveTemplateFieldDraft,
  buildInteractiveVarsPayload,
} = createInteractiveTemplateRuntime();
