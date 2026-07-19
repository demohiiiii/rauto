import {
  derived as deriveStore,
  get as getStore,
  writable,
} from "svelte/store";
import { plainObject } from "../../lib/jsonValue.js";
import { currentLanguageState } from "../../lib/i18n.js";
import {
  txBlockEditorFormStateFromJsonText,
  txBlockFormModelFromJson,
  txBlockFormModelToJsonText,
} from "./transactionBlockFormModels.js";
import {
  txWorkflowBlockEditorBindings,
  txWorkflowTemplateRefEditorDisplay,
  txWorkflowVisualEditorBindings,
  txWorkflowVisualEditorDisplay,
} from "./transactionWorkflowEditorState.js";

export * from "./transactionWorkflowEditorState.js";

const txWorkflowEditorPlainObject = plainObject;

function txWorkflowTemplateRefSourceEditorState(
  sourceValue = "",
  currentFormModel = null,
) {
  if (typeof sourceValue !== "string" || !sourceValue.trim()) {
    return {
      formError: "",
      formModel: currentFormModel || txBlockFormModelFromJson(),
    };
  }
  return txBlockEditorFormStateFromJsonText(sourceValue, currentFormModel);
}

export function createTxWorkflowTemplateRefSourceWorkspace({
  onSourceChange,
} = {}) {
  const editorDisplayModeStore = writable("form");
  const formModelStore = writable(txBlockFormModelFromJson());
  const formErrorStore = writable("");

  const applyState = (nextState = {}) => {
    formModelStore.set(nextState.formModel);
    formErrorStore.set(nextState.formError || "");
  };

  return {
    editorDisplayModeStore,
    formErrorStore,
    formModelStore,
    handleFormChange(nextModel) {
      formModelStore.set(nextModel);
      formErrorStore.set("");
      if (typeof onSourceChange === "function") {
        onSourceChange(txBlockFormModelToJsonText(nextModel));
      }
    },
    handleJsonChange(nextValue) {
      if (typeof onSourceChange === "function") {
        onSourceChange(nextValue);
      }
      applyState(
        txWorkflowTemplateRefSourceEditorState(
          nextValue,
          getStore(formModelStore),
        ),
      );
    },
    selectEditorView(nextView) {
      editorDisplayModeStore.set(nextView === "json" ? "json" : "form");
    },
    setSourceContext({ sourceValue = "" } = {}) {
      applyState(
        txWorkflowTemplateRefSourceEditorState(
          sourceValue,
          getStore(formModelStore),
        ),
      );
    },
  };
}

export function createTxWorkflowTemplateRefEditorWorkspace({
  initialBooleanRows = [],
  initialTemplateRef = {},
} = {}) {
  const booleanRowsStateStore = writable(
    Array.isArray(initialBooleanRows) ? initialBooleanRows : [],
  );
  const templateRefStateStore = writable(
    txWorkflowEditorPlainObject(initialTemplateRef) ? initialTemplateRef : {},
  );
  const editorDisplayStateStore = deriveStore(
    [templateRefStateStore, booleanRowsStateStore, currentLanguageState],
    ([$templateRefStateStore, $booleanRowsStateStore, _currentLanguageState]) =>
      txWorkflowTemplateRefEditorDisplay(
        $templateRefStateStore,
        $booleanRowsStateStore,
      ),
  );

  return {
    editorDisplayStateStore,
    setTemplateRefEditorContext({ booleanRows = [], templateRef = {} } = {}) {
      booleanRowsStateStore.set(Array.isArray(booleanRows) ? booleanRows : []);
      templateRefStateStore.set(
        txWorkflowEditorPlainObject(templateRef) ? templateRef : {},
      );
    },
  };
}

export function createTxWorkflowVisualEditorWorkspace({
  model = {},
  onChange = null,
} = {}) {
  const modelStateStore = writable(
    txWorkflowEditorPlainObject(model) ? model : {},
  );
  const onChangeStateStore = writable(onChange);
  const editorDisplayStateStore = deriveStore(
    [modelStateStore, currentLanguageState],
    ([$modelStateStore]) => txWorkflowVisualEditorDisplay($modelStateStore),
  );
  const workflowActionHandlersStateStore = deriveStore(
    [modelStateStore, onChangeStateStore],
    ([$modelStateStore, $onChangeStateStore]) =>
      txWorkflowVisualEditorBindings($modelStateStore, $onChangeStateStore),
  );
  const workflowRootFieldRowsStateStore = deriveStore(
    [editorDisplayStateStore, currentLanguageState],
    ([$editorDisplayStateStore]) => $editorDisplayStateStore.rootFieldRows,
  );
  const rootMetadataFieldRowsStateStore = deriveStore(
    [editorDisplayStateStore, currentLanguageState],
    ([$editorDisplayStateStore]) =>
      $editorDisplayStateStore.rootMetadataFieldRows,
  );
  const rootMetadataSourceStateStore = deriveStore(
    [editorDisplayStateStore],
    ([$editorDisplayStateStore]) => $editorDisplayStateStore.rootMetadataSource,
  );
  const blockRowsStateStore = deriveStore(
    [editorDisplayStateStore],
    ([$editorDisplayStateStore]) => $editorDisplayStateStore.blockRows,
  );

  function setVisualEditorContext({
    model: nextModel = {},
    onChange: nextOnChange = null,
  } = {}) {
    modelStateStore.set(
      txWorkflowEditorPlainObject(nextModel) ? nextModel : {},
    );
    onChangeStateStore.set(nextOnChange);
  }

  return {
    blockRowsStateStore,
    editorDisplayStateStore,
    rootMetadataFieldRowsStateStore,
    rootMetadataSourceStateStore,
    setVisualEditorContext,
    workflowActionHandlersStateStore,
    workflowRootFieldRowsStateStore,
  };
}

export function createTxWorkflowBlockEditorWorkspace({
  blockActionHandlers = {},
  blockRow = {},
} = {}) {
  const blockActionHandlersStateStore = writable(
    txWorkflowEditorPlainObject(blockActionHandlers) ? blockActionHandlers : {},
  );
  const blockRowStateStore = writable(
    txWorkflowEditorPlainObject(blockRow) ? blockRow : {},
  );
  const editorActionHandlersStateStore = deriveStore(
    [blockRowStateStore, blockActionHandlersStateStore],
    ([$blockRowStateStore, $blockActionHandlersStateStore]) =>
      txWorkflowBlockEditorBindings(
        $blockRowStateStore,
        $blockActionHandlersStateStore,
      ),
  );

  function setBlockEditorContext({
    blockActionHandlers: nextBlockActionHandlers = {},
    blockRow: nextBlockRow = {},
  } = {}) {
    blockActionHandlersStateStore.set(
      txWorkflowEditorPlainObject(nextBlockActionHandlers)
        ? nextBlockActionHandlers
        : {},
    );
    blockRowStateStore.set(
      txWorkflowEditorPlainObject(nextBlockRow) ? nextBlockRow : {},
    );
  }

  return {
    blockRowStateStore,
    editorActionHandlersStateStore,
    setBlockEditorContext,
  };
}
