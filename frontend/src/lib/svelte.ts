import { tick } from "svelte";
import { derived, writable } from "svelte/store";
import type { Component } from "svelte";
import type { Readable, Writable } from "svelte/store";
import { currentLanguageState, tr } from "./i18n.js";
import {
  callIfFunction,
  callbackFormCheckedHandler,
  callbackFormValueHandler,
} from "./events.js";
import { classNames, textfsmControlsDisplay } from "./ui.js";

export const dashboardThemeContextKey = Symbol("dashboardTheme");

type OptionalTask<TArgs extends unknown[], TResult = unknown> =
  | ((...args: TArgs) => TResult)
  | null
  | undefined;

export interface LazyComponentModule<TComponent> {
  default: TComponent;
}

interface DefaultLazyComponentEntry<TComponent> {
  id: string;
  load: () => Promise<LazyComponentModule<TComponent>>;
}

interface LazyComponentRegistryOptions<TEntry, TComponent> {
  errorMessage?: () => string;
  resolveId?: (lazyEntry: TEntry) => string | number | null | undefined;
  resolveLoad?: (
    lazyEntry: TEntry,
  ) => (() => Promise<LazyComponentModule<TComponent>>) | null | undefined;
}

export interface LazyComponentRegistry<TEntry, TComponent> {
  components: Readable<Record<string, TComponent>>;
  ensure(lazyEntry: TEntry): void;
  errors: Readable<Record<string, string>>;
}

function defaultLazyEntryId<TComponent>(
  lazyEntry: DefaultLazyComponentEntry<TComponent>,
): string {
  return lazyEntry.id;
}

function defaultLazyEntryLoad<TComponent>(
  lazyEntry: DefaultLazyComponentEntry<TComponent>,
): () => Promise<LazyComponentModule<TComponent>> {
  return lazyEntry.load;
}

function lazyComponent<TComponent>(
  moduleValue: LazyComponentModule<TComponent>,
): TComponent {
  return moduleValue.default;
}

export function createLazyComponentRegistry<
  TEntry = DefaultLazyComponentEntry<Component>,
  TComponent = Component,
>({
  errorMessage = () => tr("requestFailed", "request failed"),
  resolveId = defaultLazyEntryId as (
    lazyEntry: TEntry,
  ) => string | number | null | undefined,
  resolveLoad = defaultLazyEntryLoad as (
    lazyEntry: TEntry,
  ) => (() => Promise<LazyComponentModule<TComponent>>) | null | undefined,
}: LazyComponentRegistryOptions<
  TEntry,
  TComponent
> = {}): LazyComponentRegistry<TEntry, TComponent> {
  let componentSnapshot: Record<string, TComponent> = {};
  let errorSnapshot: Record<string, string> = {};
  const loadPromises = new Map<string, Promise<void>>();
  const components = writable(componentSnapshot);
  const errors = writable(errorSnapshot);

  function setComponent(id: string, component: TComponent): void {
    componentSnapshot = {
      ...componentSnapshot,
      [id]: component,
    };
    components.set(componentSnapshot);
  }

  function setError(id: string, message = ""): void {
    errorSnapshot = {
      ...errorSnapshot,
      [id]: message,
    };
    errors.set(errorSnapshot);
  }

  function ensure(lazyEntry: TEntry): void {
    const id = String(resolveId(lazyEntry) || "").trim();
    const load = resolveLoad(lazyEntry);
    if (!id || !load || componentSnapshot[id] || loadPromises.has(id)) {
      return;
    }

    const promise = loadComponentEntry({ id, load });
    loadPromises.set(id, promise);
  }

  async function loadComponentEntry({
    id,
    load,
  }: {
    id: string;
    load: () => Promise<LazyComponentModule<TComponent>>;
  }): Promise<void> {
    try {
      const componentModule = await load();
      setComponent(id, lazyComponent(componentModule));
      setError(id, "");
    } catch (error) {
      setError(id, errorMessageFrom(error, errorMessage));
    } finally {
      loadPromises.delete(id);
    }
  }

  return {
    components,
    ensure,
    errors,
  };
}

function errorMessageFrom(
  error: unknown,
  fallbackMessage: () => string,
): string {
  return error !== null &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
    ? error.message
    : fallbackMessage();
}

export type DomUpdateTask = () => unknown;

export function afterDomUpdate(updateTask: DomUpdateTask): () => void {
  let cancelled = false;
  void runAfterDomUpdate(updateTask, () => cancelled);
  return () => {
    cancelled = true;
  };
}

interface FocusableElement {
  focus(): void;
  select?: () => void;
}

interface FocusElementOptions {
  select?: boolean;
}

export function focusElement(
  element: FocusableElement | null | undefined,
  { select = false }: FocusElementOptions = {},
): void {
  if (!element || typeof element.focus !== "function") {
    return;
  }
  element.focus();
  if (select && typeof element.select === "function") {
    element.select();
  }
}

export function focusElementAfterDomUpdate(
  element: FocusableElement | null | undefined,
  focusOptions?: FocusElementOptions,
): () => void {
  return afterDomUpdate(() => focusElement(element, focusOptions));
}

function callOptionalFunction<TArgs extends unknown[], TResult>(
  optionalTask: OptionalTask<TArgs, TResult>,
  ...args: TArgs
): TResult | undefined {
  return typeof optionalTask === "function" ? optionalTask(...args) : undefined;
}

async function runAfterDomUpdate(
  updateTask: DomUpdateTask,
  isCancelled: () => boolean,
): Promise<void> {
  await tick();
  if (!isCancelled()) callOptionalFunction(updateTask);
}

export function runWithCleanup<TResult>(
  operation: OptionalTask<[], TResult | PromiseLike<TResult>>,
  cleanup: OptionalTask<[]>,
): void {
  let result: TResult | PromiseLike<TResult> | undefined;
  try {
    result = callOptionalFunction(operation);
  } catch (error) {
    callOptionalFunction(cleanup);
    throw error;
  }
  void finishWithCleanup(result, cleanup);
}

async function finishWithCleanup<TResult>(
  result: TResult | PromiseLike<TResult> | undefined,
  cleanup: OptionalTask<[]>,
): Promise<void> {
  try {
    await result;
  } finally {
    callOptionalFunction(cleanup);
  }
}

export interface LoadingRunner<TKey> {
  isLoading(key: TKey): boolean;
  run<TResult>(
    key: TKey,
    operation: OptionalTask<[], TResult | PromiseLike<TResult>>,
  ): Promise<TResult | undefined>;
}

export function createLoadingRunner<TKey>(
  readKeys: () => readonly TKey[],
  writeKeys: (keys: TKey[]) => unknown,
): LoadingRunner<TKey> {
  function currentKeys(): readonly TKey[] {
    const keys = callOptionalFunction(readKeys);
    return Array.isArray(keys) ? keys : [];
  }

  function isLoading(key: TKey): boolean {
    return currentKeys().includes(key);
  }

  async function run<TResult>(
    key: TKey,
    operation: OptionalTask<[], TResult | PromiseLike<TResult>>,
  ): Promise<TResult | undefined> {
    if (isLoading(key)) return undefined;
    writeKeys([...currentKeys(), key]);
    try {
      return await callOptionalFunction(operation);
    } finally {
      writeKeys(currentKeys().filter((loadingKey) => loadingKey !== key));
    }
  }

  return { isLoading, run };
}

interface LoadingState<TKey> {
  keys: TKey[];
}

interface LoadingStateRunnerConfig<TKey> {
  setKeys?: (keys: TKey[]) => unknown;
}

export function createLoadingStateRunner<TKey>(
  loadingState: LoadingState<TKey>,
  loadingConfig: LoadingStateRunnerConfig<TKey> = {},
): LoadingRunner<TKey> {
  const setKeys = loadingConfig.setKeys;
  return createLoadingRunner(
    () => loadingState.keys,
    (keys) => {
      loadingState.keys = keys;
      if (typeof setKeys === "function") {
        setKeys(keys);
      }
    },
  );
}

interface LatestAsyncValueLoaderOptions<TInput, TResult> {
  initialValue?: Awaited<TResult>;
  loadValue?: OptionalTask<[TInput], TResult | PromiseLike<TResult>>;
}

export function createLatestAsyncValueLoader<
  TInput = unknown,
  TResult = unknown,
>({
  initialValue,
  loadValue,
}: LatestAsyncValueLoaderOptions<TInput, TResult> = {}) {
  let currentRequestVersion = 0;
  const state = writable<Awaited<TResult> | undefined>(initialValue);

  async function refresh(
    loadInput: TInput,
  ): Promise<Awaited<TResult> | undefined> {
    currentRequestVersion += 1;
    const requestVersion = currentRequestVersion;
    const nextValue = await callOptionalFunction(loadValue, loadInput);
    if (currentRequestVersion === requestVersion) {
      state.set(nextValue);
    }
    return nextValue;
  }

  return { refresh, state };
}

interface KeyedListStateOptions {
  normalizeKey?: (key: unknown) => string;
  onChange?: OptionalTask<[string]>;
}

export interface KeyedListState<TRow> {
  has(rawKey: unknown): boolean;
  rowsState: Readable<Record<string, TRow[]>>;
  set(rawKey: unknown, rows?: readonly TRow[]): void;
  stateFor(rawKey: unknown): Writable<TRow[]>;
  update(rawKey: unknown, updater: (rows: TRow[]) => readonly TRow[]): void;
}

export function createKeyedListState<TRow>(
  keys: readonly string[] = [],
  {
    normalizeKey = (key: unknown) => String(key ?? ""),
    onChange = null,
  }: KeyedListStateOptions = {},
): KeyedListState<TRow> {
  const keyOrder = [...keys];
  const states = new Map<string, Writable<TRow[]>>();

  function stateFor(rawKey: unknown): Writable<TRow[]> {
    const key = normalizeKey(rawKey);
    if (!states.has(key)) states.set(key, writable([]));
    return states.get(key)!;
  }

  function publishChange(key: string): void {
    callOptionalFunction(onChange, key);
  }

  function set(rawKey: unknown, rows: readonly TRow[] = []): void {
    const key = normalizeKey(rawKey);
    stateFor(key).set(Array.isArray(rows) ? rows : []);
    publishChange(key);
  }

  function update(
    rawKey: unknown,
    updater: (rows: TRow[]) => readonly TRow[],
  ): void {
    const key = normalizeKey(rawKey);
    stateFor(key).update((rows) => {
      const nextRows = callOptionalFunction(
        updater,
        Array.isArray(rows) ? rows : [],
      );
      return Array.isArray(nextRows) ? [...nextRows] : [];
    });
    publishChange(key);
  }

  return {
    has: (rawKey) => states.has(normalizeKey(rawKey)),
    rowsState: derived(keyOrder.map(stateFor), (rowsByKey) =>
      Object.fromEntries(keyOrder.map((key, index) => [key, rowsByKey[index]])),
    ),
    set,
    stateFor,
    update,
  };
}

export function createSwitchingStore<TSource, TValue>(
  sourceStore: Readable<TSource>,
  resolveTargetStore: (source: TSource) => Readable<TValue> | null | undefined,
  initialValue: TValue,
): Readable<TValue> {
  return derived(
    sourceStore,
    ($sourceStore, set) => {
      const targetStore = resolveTargetStore($sourceStore);
      if (!targetStore || typeof targetStore.subscribe !== "function") {
        set(initialValue);
        return () => {};
      }
      return targetStore.subscribe((targetValue) => {
        set(targetValue ?? initialValue);
      });
    },
    initialValue,
  );
}

interface TextfsmControlsCallbacks {
  onEnabledChange?: OptionalTask<[boolean]>;
  onExcelNameChange?: OptionalTask<[string]>;
  onPlatformChange?: OptionalTask<[string]>;
  onStrictErrorsChange?: OptionalTask<[boolean]>;
  onTemplateChange?: OptionalTask<[string]>;
}

interface TextfsmFields {
  excelName?: unknown;
  platform?: unknown;
  platformOptions?: unknown;
  [key: string]: unknown;
}

interface TextfsmDisplayInputs {
  excelNamePlaceholderKey?: string;
  hintKey?: string;
  includeTemplateInput?: boolean;
  textfsmFields?: TextfsmFields;
}

interface TextfsmInputsState {
  excelNamePlaceholderKey: string;
  hintKey: string;
  includeTemplateInput: boolean;
  textfsmFields: TextfsmFields;
}

function textfsmControlActionHandlers({
  onEnabledChange = null,
  onExcelNameChange = null,
  onPlatformChange = null,
  onStrictErrorsChange = null,
  onTemplateChange = null,
}: TextfsmControlsCallbacks = {}) {
  return {
    enabledCheckedHandler: callbackFormCheckedHandler((textfsmEnabled) =>
      callIfFunction(onEnabledChange, textfsmEnabled),
    ),
    excelNameValueHandler: callbackFormValueHandler((excelName) =>
      callIfFunction(onExcelNameChange, excelName),
    ),
    platformValueHandler: callbackFormValueHandler((textfsmPlatform) =>
      callIfFunction(onPlatformChange, textfsmPlatform),
    ),
    strictErrorsCheckedHandler: callbackFormCheckedHandler(
      (textfsmStrictErrors) =>
        callIfFunction(onStrictErrorsChange, textfsmStrictErrors),
    ),
    templateValueHandler: callbackFormValueHandler((textfsmTemplate) =>
      callIfFunction(onTemplateChange, textfsmTemplate),
    ),
  };
}

export function createTextfsmControlsWorkspace({
  onEnabledChange = null,
  onExcelNameChange = null,
  onPlatformChange = null,
  onStrictErrorsChange = null,
  onTemplateChange = null,
}: TextfsmControlsCallbacks = {}) {
  const textfsmInputsStateStore = writable<TextfsmInputsState>({
    excelNamePlaceholderKey: "",
    hintKey: "",
    includeTemplateInput: false,
    textfsmFields: {},
  });
  const actionHandlers = textfsmControlActionHandlers({
    onEnabledChange,
    onExcelNameChange,
    onPlatformChange,
    onStrictErrorsChange,
    onTemplateChange,
  });
  const usesExcelNameStateStore = derived(
    textfsmInputsStateStore,
    ($textfsmInputsStateStore) => {
      const textfsmFieldsValue = $textfsmInputsStateStore.textfsmFields;
      return (
        textfsmFieldsValue &&
        typeof textfsmFieldsValue === "object" &&
        Object.prototype.hasOwnProperty.call(textfsmFieldsValue, "excelName")
      );
    },
  );
  const platformSelectClassStateStore = derived(
    [textfsmInputsStateStore, usesExcelNameStateStore],
    ([$textfsmInputsStateStore, $usesExcelNameStateStore]) =>
      classNames(
        "select",
        !$textfsmInputsStateStore.includeTemplateInput &&
          !$usesExcelNameStateStore &&
          "md:col-span-2",
      ),
  );
  const controlsDisplayStateStore = derived(
    [textfsmInputsStateStore, currentLanguageState],
    ([$textfsmInputsStateStore, _currentLanguageState]) => {
      const textfsmFieldsValue =
        $textfsmInputsStateStore.textfsmFields &&
        typeof $textfsmInputsStateStore.textfsmFields === "object"
          ? $textfsmInputsStateStore.textfsmFields
          : {};
      return textfsmControlsDisplay({
        excelNamePlaceholderKey:
          $textfsmInputsStateStore.excelNamePlaceholderKey,
        hintKey: $textfsmInputsStateStore.hintKey,
        platform: textfsmFieldsValue.platform,
        platformOptions: textfsmFieldsValue.platformOptions,
      });
    },
  );
  function enabledCheckedHandler(event: unknown) {
    return actionHandlers.enabledCheckedHandler(event);
  }

  function excelNameValueHandler(event: unknown) {
    return actionHandlers.excelNameValueHandler(event);
  }

  function platformValueHandler(event: unknown) {
    return actionHandlers.platformValueHandler(event);
  }

  function strictErrorsCheckedHandler(event: unknown) {
    return actionHandlers.strictErrorsCheckedHandler(event);
  }

  function templateValueHandler(event: unknown) {
    return actionHandlers.templateValueHandler(event);
  }
  return {
    controlsDisplayStateStore,
    enabledCheckedHandler,
    excelNameValueHandler,
    platformValueHandler,
    platformSelectClassStateStore,
    setDisplayInputs({
      excelNamePlaceholderKey: nextExcelNamePlaceholderKey = "",
      hintKey: nextHintKey = "",
      includeTemplateInput: nextIncludeTemplateInput = false,
      textfsmFields: nextTextfsmFields = {},
    }: TextfsmDisplayInputs = {}) {
      textfsmInputsStateStore.set({
        excelNamePlaceholderKey: nextExcelNamePlaceholderKey,
        hintKey: nextHintKey,
        includeTemplateInput: nextIncludeTemplateInput,
        textfsmFields: nextTextfsmFields,
      });
    },
    strictErrorsCheckedHandler,
    templateValueHandler,
    usesExcelNameStateStore,
  };
}
