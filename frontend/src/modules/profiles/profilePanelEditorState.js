import { currentLanguageState } from "../../lib/i18n.js";
import { derived } from "svelte/store";
import {
  builtinProfileDetectDetailsPresentation,
  builtinProfileHooksDetailsPresentation,
  builtinProfileStateListsPresentation,
} from "./profilesEditorState.js";

export function createBuiltinProfileHooksSectionWorkspace() {
  return {
    hooksDisplayStateStore: derived(currentLanguageState, () =>
      builtinProfileHooksDetailsPresentation(),
    ),
  };
}

export function createBuiltinProfileStateListsSectionWorkspace() {
  return {
    stateListsDisplayStateStore: derived(currentLanguageState, () =>
      builtinProfileStateListsPresentation(),
    ),
  };
}

export function createBuiltinProfileDetectSectionWorkspace() {
  return {
    detectDisplayStateStore: derived(currentLanguageState, () =>
      builtinProfileDetectDetailsPresentation(),
    ),
  };
}
