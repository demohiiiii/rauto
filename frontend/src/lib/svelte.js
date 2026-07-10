import { tick } from "svelte";
import { derived, get, writable } from "svelte/store";
import { currentLanguageState, tr } from "./i18n.js";
import {
  callIfFunction,
  callbackFormCheckedHandler,
  callbackFormValueHandler,
} from "./events.js";
import {
  classNames,
  parsedOutputBlockFragmentDisplay,
  tabListPresentation,
  textfsmControlsDisplay,
} from "./ui.js";

export const dashboardThemeContextKey = Symbol("dashboardTheme");

export function createLazyComponentRegistry({
  errorMessage = () => tr("requestFailed", "request failed"),
  resolveId = (lazyEntry) => lazyEntry.id,
  resolveLoad = (lazyEntry) => lazyEntry.load,
} = {}) {
  let componentSnapshot = {};
  let errorSnapshot = {};
  const loadPromises = new Map();
  const components = writable(componentSnapshot);
  const errors = writable(errorSnapshot);

  function setComponent(id, component) {
    componentSnapshot = {
      ...componentSnapshot,
      [id]: component,
    };
    components.set(componentSnapshot);
  }

  function setError(id, message = "") {
    errorSnapshot = {
      ...errorSnapshot,
      [id]: message,
    };
    errors.set(errorSnapshot);
  }

  function ensure(lazyEntry) {
    const id = String(resolveId(lazyEntry) || "").trim();
    const load = resolveLoad(lazyEntry);
    if (!id || !load || componentSnapshot[id] || loadPromises.has(id)) {
      return;
    }

    const promise = loadComponentEntry({ id, load });
    loadPromises.set(id, promise);
  }

  async function loadComponentEntry({ id, load }) {
    try {
      const componentModule = await load();
      setComponent(id, componentModule.default);
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

function errorMessageFrom(error, fallbackMessage) {
  return error && typeof error.message === "string"
    ? error.message
    : fallbackMessage();
}

export function afterDomUpdate(updateTask) {
  let cancelled = false;
  void runAfterDomUpdate(updateTask, () => cancelled);
  return () => {
    cancelled = true;
  };
}

export function focusElement(element, { select = false } = {}) {
  if (!element || typeof element.focus !== "function") {
    return;
  }
  element.focus();
  if (select && typeof element.select === "function") {
    element.select();
  }
}

export function focusElementAfterDomUpdate(element, focusOptions) {
  return afterDomUpdate(() => focusElement(element, focusOptions));
}

function callOptionalFunction(optionalTask, ...args) {
  return typeof optionalTask === "function" ? optionalTask(...args) : undefined;
}

async function runAfterDomUpdate(updateTask, isCancelled) {
  await tick();
  if (!isCancelled()) callOptionalFunction(updateTask);
}

export function runWithCleanup(operation, cleanup) {
  let result;
  try {
    result = callOptionalFunction(operation);
  } catch (error) {
    callOptionalFunction(cleanup);
    throw error;
  }
  void finishWithCleanup(result, cleanup);
}

async function finishWithCleanup(result, cleanup) {
  try {
    await result;
  } finally {
    callOptionalFunction(cleanup);
  }
}

export function createLoadingRunner(readKeys, writeKeys) {
  function currentKeys() {
    const keys = callOptionalFunction(readKeys);
    return Array.isArray(keys) ? keys : [];
  }

  function isLoading(key) {
    return currentKeys().includes(key);
  }

  async function run(key, operation) {
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

export function createLoadingStateRunner(loadingState, loadingConfig = {}) {
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

export function createLatestAsyncValueLoader({ initialValue, loadValue } = {}) {
  let currentRequestVersion = 0;
  const state = writable(initialValue);

  async function refresh(loadInput) {
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

export function createSwitchingStore(
  sourceStore,
  resolveTargetStore,
  initialValue,
) {
  return derived(
    sourceStore,
    ($sourceStore, set) => {
      const targetStore =
        typeof resolveTargetStore === "function"
          ? resolveTargetStore($sourceStore)
          : null;
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

function textfsmControlActionHandlers({
  onEnabledChange = null,
  onExcelNameChange = null,
  onPlatformChange = null,
  onStrictErrorsChange = null,
  onTemplateChange = null,
} = {}) {
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
} = {}) {
  const textfsmInputsStateStore = writable({
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
  function enabledCheckedHandler(event) {
    return actionHandlers.enabledCheckedHandler(event);
  }

  function excelNameValueHandler(event) {
    return actionHandlers.excelNameValueHandler(event);
  }

  function platformValueHandler(event) {
    return actionHandlers.platformValueHandler(event);
  }

  function strictErrorsCheckedHandler(event) {
    return actionHandlers.strictErrorsCheckedHandler(event);
  }

  function templateValueHandler(event) {
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
    } = {}) {
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
