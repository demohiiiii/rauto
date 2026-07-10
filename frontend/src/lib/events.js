import {
  txAddObjectField,
  txRemoveObjectField,
  txRenameObjectField,
  txUpdateObjectField,
} from "./objectFields.js";
import { runWithCleanup } from "./svelte.js";

function eventCurrentTarget(event) {
  return event && event.currentTarget ? event.currentTarget : null;
}

function eventTarget(event) {
  return event && event.target ? event.target : null;
}

export function formValue(event, fallback = "") {
  const currentTarget = eventCurrentTarget(event);
  return currentTarget && "value" in currentTarget
    ? currentTarget.value
    : fallback;
}

export function formChecked(event) {
  const currentTarget = eventCurrentTarget(event);
  return !!(
    currentTarget &&
    "checked" in currentTarget &&
    currentTarget.checked
  );
}
export function formValueHandler(fieldHandler, fallback = "") {
  return (event) => fieldHandler(formValue(event, fallback));
}

export function formCheckedHandler(fieldHandler) {
  return (event) => fieldHandler(formChecked(event));
}

export function callIfFunction(callback, ...args) {
  if (typeof callback === "function") {
    return callback(...args);
  }
  return undefined;
}

export function callbackHandler(callback, ...prefixArgs) {
  return (...args) => callIfFunction(callback, ...prefixArgs, ...args);
}

export function callbackFormValueHandler(callback, ...prefixArgs) {
  return formValueHandler(callbackHandler(callback, ...prefixArgs));
}

export function callbackFormCheckedHandler(callback, ...prefixArgs) {
  return formCheckedHandler(callbackHandler(callback, ...prefixArgs));
}

export function callbackMappedFormValueHandler(
  callback,
  mapValue,
  fallback = "",
) {
  return formValueHandler(
    (value) => callIfFunction(callback, mapValue(value)),
    fallback,
  );
}

export function callbackMappedFormCheckedHandler(callback, mapChecked) {
  return formCheckedHandler((checked) =>
    callIfFunction(callback, mapChecked(checked)),
  );
}

export function collapsibleGroupBindings({
  onReadCollapsedPreference = () => false,
  onSetCollapsed = null,
  onWriteCollapsedPreference = null,
} = {}) {
  return {
    initialState(persistenceKey = "") {
      return {
        collapsed: !!onReadCollapsedPreference(persistenceKey),
        mounted: true,
      };
    },
    toggleCollapsed(collapsed = false, persistenceKey = "") {
      const nextCollapsed = !collapsed;
      callIfFunction(onWriteCollapsedPreference, persistenceKey, nextCollapsed);
      return nextCollapsed;
    },
    toggleHandler(collapsed = false, persistenceKey = "") {
      return () => {
        const nextCollapsed = this.toggleCollapsed(collapsed, persistenceKey);
        callIfFunction(onSetCollapsed, nextCollapsed);
      };
    },
  };
}

export function formValueCheckedHandler(fieldHandler, fallback = "") {
  return (event) =>
    fieldHandler(formValue(event, fallback), formChecked(event));
}

export function formFile(event) {
  const currentTarget = eventCurrentTarget(event);
  if (!currentTarget || !("files" in currentTarget)) return null;
  return currentTarget.files[0] || null;
}

export function resetFormValue(event) {
  const currentTarget = eventCurrentTarget(event);
  if (currentTarget && "value" in currentTarget) {
    currentTarget.value = "";
  }
}

export function eventIsSelfTarget(event) {
  return eventTarget(event) === eventCurrentTarget(event);
}

export function eventContainsRelatedTarget(event) {
  const currentTarget = eventCurrentTarget(event);
  const relatedTarget =
    event && event.relatedTarget ? event.relatedTarget : null;
  return !!(
    currentTarget &&
    relatedTarget &&
    typeof currentTarget.contains === "function" &&
    currentTarget.contains(relatedTarget)
  );
}

export function eventKeyIs(event, key) {
  return !!event && event.key === key;
}

export function eventKeyIn(event, keys) {
  return Array.isArray(keys) && !!event && keys.includes(event.key);
}

export function submitOnKeyHandler(
  key,
  callback,
  { preventDefault = true } = {},
) {
  return (event) => {
    if (!eventKeyIs(event, key)) return;
    if (preventDefault) {
      preventEventDefault(event);
    }
    return callIfFunction(callback, event);
  };
}

export function preventEventDefault(event) {
  if (event && typeof event.preventDefault === "function") {
    event.preventDefault();
  }
}

export function stopEventPropagation(event) {
  if (event && typeof event.stopPropagation === "function") {
    event.stopPropagation();
  }
}

export function blurEventTarget(event) {
  const target = eventTarget(event);
  if (target && typeof target.blur === "function") {
    target.blur();
  }
}

export function stringListEditorBindings({
  onRemove = null,
  onValueChange = null,
} = {}) {
  return {
    itemValueHandler(itemIndex) {
      return formValueHandler((valueText) =>
        callIfFunction(onValueChange, itemIndex, valueText),
      );
    },
    removeHandler(itemIndex) {
      return () => callIfFunction(onRemove, itemIndex);
    },
  };
}

export function objectFieldsEditorBindings({
  onRemove = null,
  onRename = null,
  onTypeChange = null,
  onValueChange = null,
} = {}) {
  return {
    fieldTypeHandler(fieldKey) {
      return formValueHandler((fieldType) =>
        callIfFunction(onTypeChange, fieldKey, fieldType),
      );
    },
    fieldValueHandler(fieldKey) {
      return formValueHandler((fieldValueText) =>
        callIfFunction(onValueChange, fieldKey, fieldValueText),
      );
    },
    removeFieldHandler(fieldKey) {
      return () => callIfFunction(onRemove, fieldKey);
    },
    renameFieldHandler(fieldKey) {
      return formValueHandler((nextFieldKey) =>
        callIfFunction(onRename, fieldKey, nextFieldKey),
      );
    },
  };
}

export function jsonObjectFieldsEditorBindings({ onChange = null } = {}) {
  return {
    addField(source = {}) {
      return callIfFunction(onChange, txAddObjectField(source));
    },
    addFieldAction(source = {}) {
      return () => this.addField(source);
    },
    changeFieldType(source = {}, fieldKey = "", fieldType = "") {
      return callIfFunction(
        onChange,
        txUpdateObjectField(source, fieldKey, { typeValue: fieldType }),
      );
    },
    typeChangeAction(source = {}) {
      return (fieldKey = "", fieldType = "") =>
        this.changeFieldType(source, fieldKey, fieldType);
    },
    changeFieldValue(source = {}, fieldKey = "", fieldValueText = "") {
      return callIfFunction(
        onChange,
        txUpdateObjectField(source, fieldKey, { valueText: fieldValueText }),
      );
    },
    valueChangeAction(source = {}) {
      return (fieldKey = "", fieldValueText = "") =>
        this.changeFieldValue(source, fieldKey, fieldValueText);
    },
    removeField(source = {}, fieldKey = "") {
      return callIfFunction(onChange, txRemoveObjectField(source, fieldKey));
    },
    removeFieldAction(source = {}) {
      return (fieldKey = "") => this.removeField(source, fieldKey);
    },
    renameField(source = {}, fieldKey = "", nextFieldKey = "") {
      return callIfFunction(
        onChange,
        txRenameObjectField(source, fieldKey, nextFieldKey),
      );
    },
    renameFieldAction(source = {}) {
      return (fieldKey = "", nextFieldKey = "") =>
        this.renameField(source, fieldKey, nextFieldKey);
    },
  };
}

export function presenceFieldControlBindings({
  onNullableModeChange = null,
  onPresenceChange = null,
  onValueChange = null,
} = {}) {
  return {
    nullableModeChangeHandler(event) {
      return callIfFunction(onNullableModeChange, event);
    },
    presenceChangeHandler(nextEnabled) {
      return callIfFunction(onPresenceChange, nextEnabled);
    },
    valueChangeHandler(event) {
      return callIfFunction(onValueChange, event);
    },
  };
}

function resolvePresenceFieldCallback(
  fieldRow,
  directHandler = null,
  rowHandlerFactory = null,
  keyHandlerFactory = null,
) {
  const fieldKey =
    fieldRow && typeof fieldRow === "object" && "fieldKey" in fieldRow
      ? fieldRow.fieldKey
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

export function presenceFieldRowBindings({
  fieldRow = {},
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
} = {}) {
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
  return presenceFieldControlBindings({
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

export function plainInputFieldBindings({
  onInput = null,
  onValueInput = null,
  onFormValue = formValue,
} = {}) {
  return {
    inputHandler(event) {
      callIfFunction(onInput, event);
      return callIfFunction(onValueInput, onFormValue(event));
    },
  };
}

export function plainSelectFieldBindings({
  onChange = null,
  onValueChange = null,
  onFormValue = formValue,
} = {}) {
  return {
    changeHandler(event) {
      callIfFunction(onChange, event);
      return callIfFunction(onValueChange, onFormValue(event));
    },
  };
}

export function textAreaFieldBindings({
  onInput = null,
  onValueInput = null,
  onFormValue = formValue,
} = {}) {
  return {
    inputHandler(event) {
      callIfFunction(onInput, event);
      return callIfFunction(onValueInput, onFormValue(event));
    },
  };
}

export function plainCheckboxFieldBindings({
  onChange = null,
  onCheckedChange = null,
  onFormChecked = formChecked,
} = {}) {
  return {
    changeHandler(event) {
      callIfFunction(onChange, event);
      return callIfFunction(onCheckedChange, onFormChecked(event));
    },
  };
}

export function filePickerButtonBindings({
  onFile,
  onFormFile = formFile,
  onResetFormValue = resetFormValue,
  onRunWithCleanup = runWithCleanup,
} = {}) {
  return {
    openPicker(inputElement, disabled = false) {
      if (disabled) return;
      if (inputElement && typeof inputElement.click === "function") {
        inputElement.click();
      }
    },
    openPickerHandler(inputElement, disabled = false) {
      return () => this.openPicker(inputElement, disabled);
    },
    selectFile(event) {
      return onRunWithCleanup(
        () => onFile(onFormFile(event)),
        () => onResetFormValue(event),
      );
    },
  };
}

export function eventEntriesTableBindings({ onOpenEntryIndex = null } = {}) {
  return {
    openEntryHandler(entryIndex) {
      return () => callIfFunction(onOpenEntryIndex, entryIndex);
    },
  };
}

export function jsonTextEditorBindings({
  onChange = null,
  onSetText = null,
} = {}) {
  return {
    changeText(updatedContent) {
      const nextText = typeof updatedContent === "string" ? updatedContent : "";
      callIfFunction(onChange, nextText);
      return nextText;
    },
    changeHandler() {
      return (updatedContent) => {
        const nextText = this.changeText(updatedContent);
        callIfFunction(onSetText, nextText);
      };
    },
    nextText(currentText = "", value = "") {
      const normalizedValue = this.normalizeValue(value);
      return currentText === normalizedValue ? null : normalizedValue;
    },
    normalizeValue(value = "") {
      return value == null ? "" : String(value);
    },
  };
}
