import {
  txAddObjectField,
  txRemoveObjectField,
  txRenameObjectField,
  txUpdateObjectField,
} from "./objectFields.js";
import { runWithCleanup } from "./svelte.js";
import type { PlainObject } from "./jsonValue.js";

type OptionalCallback<TArgs extends unknown[], TResult = unknown> =
  | ((...args: TArgs) => TResult)
  | null
  | undefined;

interface EventShape {
  currentTarget?: unknown;
  key?: unknown;
  relatedTarget?: unknown;
  target?: unknown;
}

interface ValueTarget {
  value: unknown;
}

interface CheckedTarget {
  checked: unknown;
}

interface FileTarget {
  files: ArrayLike<File> | null;
}

interface ContainerTarget {
  contains(value: Node | null): boolean;
}

interface BlurTarget {
  blur(): void;
}

function eventShape(event: unknown): EventShape | null {
  return event !== null && typeof event === "object"
    ? (event as EventShape)
    : null;
}

function hasProperty<K extends PropertyKey>(
  value: unknown,
  property: K,
): value is object & Record<K, unknown> {
  return value !== null && typeof value === "object" && property in value;
}

function eventCurrentTarget(event: unknown): unknown {
  return eventShape(event)?.currentTarget || null;
}

function eventTarget(event: unknown): unknown {
  return eventShape(event)?.target || null;
}

export function formValue(event: unknown, fallback = ""): string {
  const currentTarget = eventCurrentTarget(event);
  return hasProperty(currentTarget, "value")
    ? String((currentTarget as ValueTarget).value)
    : fallback;
}

export function formChecked(event: unknown): boolean {
  const currentTarget = eventCurrentTarget(event);
  return !!(
    hasProperty(currentTarget, "checked") &&
    (currentTarget as CheckedTarget).checked
  );
}

export function formValueHandler<TResult>(
  fieldHandler: (value: string) => TResult,
  fallback = "",
): (event: unknown) => TResult {
  return (event) => fieldHandler(formValue(event, fallback));
}

export function formCheckedHandler<TResult>(
  fieldHandler: (checked: boolean) => TResult,
): (event: unknown) => TResult {
  return (event) => fieldHandler(formChecked(event));
}

export function callIfFunction<TArgs extends unknown[], TResult>(
  callback: OptionalCallback<TArgs, TResult>,
  ...args: TArgs
): TResult | undefined {
  if (typeof callback === "function") {
    return callback(...args);
  }
  return undefined;
}

export function callbackHandler<
  TPrefixArgs extends unknown[],
  TArgs extends unknown[],
  TResult,
>(
  callback: OptionalCallback<[...TPrefixArgs, ...TArgs], TResult>,
  ...prefixArgs: TPrefixArgs
): (...args: TArgs) => TResult | undefined {
  return (...args) => callIfFunction(callback, ...prefixArgs, ...args);
}

export function callbackFormValueHandler<
  TPrefixArgs extends unknown[],
  TResult,
>(
  callback: OptionalCallback<[...TPrefixArgs, string], TResult>,
  ...prefixArgs: TPrefixArgs
): (event: unknown) => TResult | undefined {
  return formValueHandler(callbackHandler(callback, ...prefixArgs));
}

export function callbackFormCheckedHandler<
  TPrefixArgs extends unknown[],
  TResult,
>(
  callback: OptionalCallback<[...TPrefixArgs, boolean], TResult>,
  ...prefixArgs: TPrefixArgs
): (event: unknown) => TResult | undefined {
  return formCheckedHandler(callbackHandler(callback, ...prefixArgs));
}

export function callbackMappedFormValueHandler<TResult>(
  callback: OptionalCallback<[string], TResult>,
  mapValue: (value: string) => string,
  fallback?: string,
): (event: unknown) => TResult | undefined;
export function callbackMappedFormValueHandler<TMapped, TResult>(
  callback: OptionalCallback<[TMapped], TResult>,
  mapValue: (value: string) => TMapped,
  fallback?: string,
): (event: unknown) => TResult | undefined;
export function callbackMappedFormValueHandler(
  callback: ((value: never) => unknown) | null | undefined,
  mapValue: (value: string) => unknown,
  fallback = "",
): (event: unknown) => unknown {
  return formValueHandler(
    (value) =>
      typeof callback === "function"
        ? Reflect.apply(callback, undefined, [mapValue(value)])
        : undefined,
    fallback,
  );
}

export function callbackMappedFormCheckedHandler<TResult>(
  callback: OptionalCallback<[boolean], TResult>,
  mapChecked: (checked: boolean) => boolean,
): (event: unknown) => TResult | undefined;
export function callbackMappedFormCheckedHandler<TMapped, TResult>(
  callback: OptionalCallback<[TMapped], TResult>,
  mapChecked: (checked: boolean) => TMapped,
): (event: unknown) => TResult | undefined;
export function callbackMappedFormCheckedHandler(
  callback: ((value: never) => unknown) | null | undefined,
  mapChecked: (checked: boolean) => unknown,
): (event: unknown) => unknown {
  return formCheckedHandler((checked) =>
    typeof callback === "function"
      ? Reflect.apply(callback, undefined, [mapChecked(checked)])
      : undefined,
  );
}

interface CollapsibleGroupBindingOptions {
  onReadCollapsedPreference?: (persistenceKey: string) => unknown;
  onSetCollapsed?: OptionalCallback<[boolean]>;
  onWriteCollapsedPreference?: OptionalCallback<[string, boolean]>;
}

export function collapsibleGroupBindings({
  onReadCollapsedPreference = () => false,
  onSetCollapsed = null,
  onWriteCollapsedPreference = null,
}: CollapsibleGroupBindingOptions = {}) {
  return {
    initialState(persistenceKey = ""): {
      collapsed: boolean;
      mounted: boolean;
    } {
      return {
        collapsed: !!onReadCollapsedPreference(persistenceKey),
        mounted: true,
      };
    },
    toggleCollapsed(collapsed = false, persistenceKey = ""): boolean {
      const nextCollapsed = !collapsed;
      callIfFunction(onWriteCollapsedPreference, persistenceKey, nextCollapsed);
      return nextCollapsed;
    },
    toggleHandler(collapsed = false, persistenceKey = ""): () => void {
      return () => {
        const nextCollapsed = this.toggleCollapsed(collapsed, persistenceKey);
        callIfFunction(onSetCollapsed, nextCollapsed);
      };
    },
  };
}

interface TabListSelectionBindingOptions<TResult> {
  getActiveValue?: () => string;
  onSelect?: OptionalCallback<[string], TResult>;
  onSelectedValueChange?: OptionalCallback<[string]>;
}

export function tabListSelectionBindings<TResult>({
  getActiveValue = () => "",
  onSelect = null,
  onSelectedValueChange = null,
}: TabListSelectionBindingOptions<TResult> = {}) {
  return {
    valueChangeHandler(nextValue: string): TResult | undefined {
      const selected = callIfFunction(onSelect, nextValue);
      if (selected === false) {
        callIfFunction(onSelectedValueChange, getActiveValue());
      }
      return selected;
    },
  };
}

export function formValueCheckedHandler<TResult>(
  fieldHandler: (value: string, checked: boolean) => TResult,
  fallback = "",
): (event: unknown) => TResult {
  return (event) =>
    fieldHandler(formValue(event, fallback), formChecked(event));
}

export function formFile(event: unknown): File | null {
  const currentTarget = eventCurrentTarget(event);
  if (!hasProperty(currentTarget, "files")) return null;
  return (currentTarget as FileTarget).files?.[0] || null;
}

export function resetFormValue(event: unknown): void {
  const currentTarget = eventCurrentTarget(event);
  if (hasProperty(currentTarget, "value")) {
    (currentTarget as ValueTarget).value = "";
  }
}

export function eventIsSelfTarget(event: unknown): boolean {
  return eventTarget(event) === eventCurrentTarget(event);
}

export function eventContainsRelatedTarget(event: unknown): boolean {
  const currentTarget = eventCurrentTarget(event);
  const relatedTarget = eventShape(event)?.relatedTarget || null;
  return !!(
    hasProperty(currentTarget, "contains") &&
    typeof currentTarget.contains === "function" &&
    (currentTarget as ContainerTarget).contains(relatedTarget as Node | null)
  );
}

export function eventKeyIs(event: unknown, key: string): boolean {
  return eventShape(event)?.key === key;
}

export function eventKeyIn(event: unknown, keys: readonly string[]): boolean {
  const key = eventShape(event)?.key;
  return Array.isArray(keys) && typeof key === "string" && keys.includes(key);
}

export function submitOnKeyHandler(
  key: string,
  callback: OptionalCallback<[unknown]>,
  { preventDefault = true }: { preventDefault?: boolean } = {},
): (event: unknown) => unknown {
  return (event) => {
    if (!eventKeyIs(event, key)) return;
    if (preventDefault) {
      preventEventDefault(event);
    }
    return callIfFunction(callback, event);
  };
}

export function preventEventDefault(event: unknown): void {
  if (
    hasProperty(event, "preventDefault") &&
    typeof event.preventDefault === "function"
  ) {
    event.preventDefault();
  }
}

export function stopEventPropagation(event: unknown): void {
  if (
    hasProperty(event, "stopPropagation") &&
    typeof event.stopPropagation === "function"
  ) {
    event.stopPropagation();
  }
}

export function blurEventTarget(event: unknown): void {
  const target = eventTarget(event);
  if (hasProperty(target, "blur") && typeof target.blur === "function") {
    (target as BlurTarget).blur();
  }
}

interface StringListEditorBindingOptions {
  onRemove?: OptionalCallback<[number]>;
  onValueChange?: OptionalCallback<[number, string]>;
}

export function stringListEditorBindings({
  onRemove = null,
  onValueChange = null,
}: StringListEditorBindingOptions = {}) {
  return {
    itemValueHandler(itemIndex: number) {
      return formValueHandler((valueText) =>
        callIfFunction(onValueChange, itemIndex, valueText),
      );
    },
    removeHandler(itemIndex: number) {
      return () => callIfFunction(onRemove, itemIndex);
    },
  };
}

interface ObjectFieldsEditorBindingOptions {
  onRemove?: OptionalCallback<[string]>;
  onRename?: OptionalCallback<[string, string]>;
  onTypeChange?: OptionalCallback<[string, string]>;
  onValueChange?: OptionalCallback<[string, string]>;
}

export function objectFieldsEditorBindings({
  onRemove = null,
  onRename = null,
  onTypeChange = null,
  onValueChange = null,
}: ObjectFieldsEditorBindingOptions = {}) {
  return {
    fieldTypeHandler(fieldKey: string) {
      return formValueHandler((fieldType) =>
        callIfFunction(onTypeChange, fieldKey, fieldType),
      );
    },
    fieldValueHandler(fieldKey: string) {
      return formValueHandler((fieldValueText) =>
        callIfFunction(onValueChange, fieldKey, fieldValueText),
      );
    },
    removeFieldHandler(fieldKey: string) {
      return () => callIfFunction(onRemove, fieldKey);
    },
    renameFieldHandler(fieldKey: string) {
      return formValueHandler((nextFieldKey) =>
        callIfFunction(onRename, fieldKey, nextFieldKey),
      );
    },
  };
}

interface JsonObjectFieldsEditorBindingOptions {
  onChange?: OptionalCallback<[PlainObject]>;
}

export function jsonObjectFieldsEditorBindings({
  onChange = null,
}: JsonObjectFieldsEditorBindingOptions = {}) {
  return {
    addField(source: unknown = {}) {
      return callIfFunction(onChange, txAddObjectField(source));
    },
    addFieldAction(source: unknown = {}) {
      return () => this.addField(source);
    },
    changeFieldType(source: unknown = {}, fieldKey = "", fieldType = "") {
      return callIfFunction(
        onChange,
        txUpdateObjectField(source, fieldKey, { typeValue: fieldType }),
      );
    },
    typeChangeAction(source: unknown = {}) {
      return (fieldKey = "", fieldType = "") =>
        this.changeFieldType(source, fieldKey, fieldType);
    },
    changeFieldValue(source: unknown = {}, fieldKey = "", fieldValueText = "") {
      return callIfFunction(
        onChange,
        txUpdateObjectField(source, fieldKey, { valueText: fieldValueText }),
      );
    },
    valueChangeAction(source: unknown = {}) {
      return (fieldKey = "", fieldValueText = "") =>
        this.changeFieldValue(source, fieldKey, fieldValueText);
    },
    removeField(source: unknown = {}, fieldKey = "") {
      return callIfFunction(onChange, txRemoveObjectField(source, fieldKey));
    },
    removeFieldAction(source: unknown = {}) {
      return (fieldKey = "") => this.removeField(source, fieldKey);
    },
    renameField(source: unknown = {}, fieldKey = "", nextFieldKey = "") {
      return callIfFunction(
        onChange,
        txRenameObjectField(source, fieldKey, nextFieldKey),
      );
    },
    renameFieldAction(source: unknown = {}) {
      return (fieldKey = "", nextFieldKey = "") =>
        this.renameField(source, fieldKey, nextFieldKey);
    },
  };
}

interface PresenceFieldControlBindingOptions<
  TNullableValue,
  TPresenceValue,
  TValue,
> {
  onNullableModeChange?: OptionalCallback<[TNullableValue]>;
  onPresenceChange?: OptionalCallback<[TPresenceValue]>;
  onValueChange?: OptionalCallback<[TValue]>;
}

export function presenceFieldControlBindings<
  TNullableValue = unknown,
  TPresenceValue = boolean,
  TValue = unknown,
>({
  onNullableModeChange = null,
  onPresenceChange = null,
  onValueChange = null,
}: PresenceFieldControlBindingOptions<
  TNullableValue,
  TPresenceValue,
  TValue
> = {}) {
  return {
    nullableModeChangeHandler(event: TNullableValue) {
      return callIfFunction(onNullableModeChange, event);
    },
    presenceChangeHandler(nextEnabled: TPresenceValue) {
      return callIfFunction(onPresenceChange, nextEnabled);
    },
    valueChangeHandler(event: TValue) {
      return callIfFunction(onValueChange, event);
    },
  };
}

interface PresenceFieldRowShape {
  enabled?: unknown;
  fieldKey?: unknown;
  showNullableModeSelect?: unknown;
}

function resolvePresenceFieldCallback<
  TValue,
  TFieldRow extends PresenceFieldRowShape,
>(
  fieldRow: TFieldRow,
  directHandler: OptionalCallback<[TValue]> = null,
  rowHandlerFactory: OptionalCallback<
    [TFieldRow],
    OptionalCallback<[TValue]>
  > = null,
  keyHandlerFactory: OptionalCallback<
    [string],
    OptionalCallback<[TValue]>
  > = null,
): OptionalCallback<[TValue]> {
  const fieldKey =
    fieldRow && typeof fieldRow === "object" && "fieldKey" in fieldRow
      ? String(fieldRow.fieldKey)
      : "";
  if (typeof directHandler === "function") {
    return directHandler;
  }
  if (typeof rowHandlerFactory === "function") {
    return rowHandlerFactory(fieldRow);
  }
  if (typeof keyHandlerFactory === "function") {
    return keyHandlerFactory(fieldKey);
  }
  return null;
}

interface PresenceFieldRowBindingOptions<
  TNullableValue,
  TValue,
  TFieldRow extends PresenceFieldRowShape,
> {
  fieldRow: TFieldRow;
  onNullableModeChange?: OptionalCallback<[TNullableValue]>;
  onNullableModeChangeForKey?: OptionalCallback<
    [string],
    OptionalCallback<[TNullableValue]>
  >;
  onNullableModeChangeForRow?: OptionalCallback<
    [TFieldRow],
    OptionalCallback<[TNullableValue]>
  >;
  onPresenceChange?: OptionalCallback<[boolean]>;
  onPresenceChangeForKey?: OptionalCallback<
    [string],
    OptionalCallback<[boolean]>
  >;
  onPresenceChangeForRow?: OptionalCallback<
    [TFieldRow],
    OptionalCallback<[boolean]>
  >;
  onValueChange?: OptionalCallback<[TValue]>;
  onValueChangeForKey?: OptionalCallback<[string], OptionalCallback<[TValue]>>;
  onValueChangeForRow?: OptionalCallback<
    [TFieldRow],
    OptionalCallback<[TValue]>
  >;
  showPresenceToggle?: boolean;
}

export function presenceFieldRowBindings<
  TNullableValue = unknown,
  TValue = unknown,
  TFieldRow extends PresenceFieldRowShape = PresenceFieldRowShape,
>({
  fieldRow,
  showPresenceToggle = false,
  onNullableModeChange = null,
  onValueChange = null,
  onPresenceChange = null,
  onNullableModeChangeForKey = null,
  onNullableModeChangeForRow = null,
  onValueChangeForKey = null,
  onPresenceChangeForKey = null,
  onValueChangeForRow = null,
  onPresenceChangeForRow = null,
}: PresenceFieldRowBindingOptions<TNullableValue, TValue, TFieldRow>) {
  const nullableModeChangeHandler = fieldRow.showNullableModeSelect
    ? resolvePresenceFieldCallback(
        fieldRow,
        onNullableModeChange,
        onNullableModeChangeForRow,
        onNullableModeChangeForKey,
      )
    : null;
  const presenceChangeHandler = showPresenceToggle
    ? resolvePresenceFieldCallback(
        fieldRow,
        onPresenceChange,
        onPresenceChangeForRow,
        onPresenceChangeForKey,
      )
    : null;
  const valueChangeHandler = resolvePresenceFieldCallback(
    fieldRow,
    onValueChange,
    onValueChangeForRow,
    onValueChangeForKey,
  );
  return presenceFieldControlBindings<TNullableValue, boolean, TValue>({
    onNullableModeChange: nullableModeChangeHandler,
    onPresenceChange: presenceChangeHandler,
    onValueChange(event) {
      if (showPresenceToggle && !fieldRow.enabled) {
        callIfFunction(presenceChangeHandler, true);
      }
      return callIfFunction(valueChangeHandler, event);
    },
  });
}

interface ValueFieldBindingOptions<TEvent> {
  onFormValue?: (event: TEvent) => string;
  onInput?: OptionalCallback<[TEvent]>;
  onValueInput?: OptionalCallback<[string]>;
}

export function plainInputFieldBindings<TEvent = unknown>({
  onInput = null,
  onValueInput = null,
  onFormValue = (event: TEvent) => formValue(event),
}: ValueFieldBindingOptions<TEvent> = {}) {
  return {
    inputHandler(event: TEvent) {
      callIfFunction(onInput, event);
      return callIfFunction(onValueInput, onFormValue(event));
    },
  };
}

interface SelectFieldBindingOptions<TEvent> {
  onChange?: OptionalCallback<[TEvent]>;
  onFormValue?: (event: TEvent) => string;
  onValueChange?: OptionalCallback<[string]>;
}

export function plainSelectFieldBindings<TEvent = unknown>({
  onChange = null,
  onValueChange = null,
  onFormValue = (event: TEvent) => formValue(event),
}: SelectFieldBindingOptions<TEvent> = {}) {
  return {
    changeHandler(event: TEvent) {
      callIfFunction(onChange, event);
      return callIfFunction(onValueChange, onFormValue(event));
    },
  };
}

export function textAreaFieldBindings<TEvent = unknown>({
  onInput = null,
  onValueInput = null,
  onFormValue = (event: TEvent) => formValue(event),
}: ValueFieldBindingOptions<TEvent> = {}) {
  return {
    inputHandler(event: TEvent) {
      callIfFunction(onInput, event);
      return callIfFunction(onValueInput, onFormValue(event));
    },
  };
}

interface CheckboxFieldBindingOptions<TEvent> {
  onChange?: OptionalCallback<[TEvent]>;
  onCheckedChange?: OptionalCallback<[boolean]>;
  onFormChecked?: (event: TEvent) => boolean;
}

export function plainCheckboxFieldBindings<TEvent = unknown>({
  onChange = null,
  onCheckedChange = null,
  onFormChecked = (event: TEvent) => formChecked(event),
}: CheckboxFieldBindingOptions<TEvent> = {}) {
  return {
    changeHandler(event: TEvent) {
      callIfFunction(onChange, event);
      return callIfFunction(onCheckedChange, onFormChecked(event));
    },
  };
}

interface ClickableElement {
  click(): void;
}

interface FilePickerButtonBindingOptions<TEvent> {
  onFile?: (file: File | null) => unknown;
  onFormFile?: (event: TEvent) => File | null;
  onResetFormValue?: (event: TEvent) => unknown;
  onRunWithCleanup?: (
    operation: () => unknown,
    cleanup: () => unknown,
  ) => unknown;
}

export function filePickerButtonBindings<TEvent = unknown>({
  onFile,
  onFormFile = (event: TEvent) => formFile(event),
  onResetFormValue = (event: TEvent) => resetFormValue(event),
  onRunWithCleanup = runWithCleanup,
}: FilePickerButtonBindingOptions<TEvent> = {}) {
  return {
    openPicker(inputElement: ClickableElement | null, disabled = false): void {
      if (disabled) return;
      if (inputElement && typeof inputElement.click === "function") {
        inputElement.click();
      }
    },
    openPickerHandler(
      inputElement: ClickableElement | null,
      disabled = false,
    ): () => void {
      return () => this.openPicker(inputElement, disabled);
    },
    selectFile(event: TEvent) {
      return onRunWithCleanup(
        () => callIfFunction(onFile, onFormFile(event)),
        () => onResetFormValue(event),
      );
    },
  };
}

interface EventEntriesTableBindingOptions {
  onOpenEntryIndex?: OptionalCallback<[number]>;
}

export function eventEntriesTableBindings({
  onOpenEntryIndex = null,
}: EventEntriesTableBindingOptions = {}) {
  return {
    openEntryHandler(entryIndex: number) {
      return () => callIfFunction(onOpenEntryIndex, entryIndex);
    },
  };
}

interface JsonTextEditorBindingOptions {
  onChange?: OptionalCallback<[string]>;
  onSetText?: OptionalCallback<[string]>;
}

export function jsonTextEditorBindings({
  onChange = null,
  onSetText = null,
}: JsonTextEditorBindingOptions = {}) {
  return {
    changeText(updatedContent: unknown): string {
      const nextText = typeof updatedContent === "string" ? updatedContent : "";
      callIfFunction(onChange, nextText);
      return nextText;
    },
    changeHandler(): (updatedContent: unknown) => void {
      return (updatedContent: unknown) => {
        const nextText = this.changeText(updatedContent);
        callIfFunction(onSetText, nextText);
      };
    },
    nextText(currentText = "", value: unknown = ""): string | null {
      const normalizedValue = this.normalizeValue(value);
      return currentText === normalizedValue ? null : normalizedValue;
    },
    normalizeValue(value: unknown = ""): string {
      return value == null ? "" : String(value);
    },
  };
}
