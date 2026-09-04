import {
  addBodyClass,
  addWindowListener,
  bodyHasClass,
  currentPathname,
  currentUrl,
  getBodyAttribute,
  getDocumentLanguage,
  pushBrowserState,
  reloadBrowser,
  removeBodyAttribute,
  removeBodyClass,
  replaceBrowserState,
  setBodyAttribute,
  setDocumentLanguage,
  storageSet,
  subscribeColorSchemeChange,
} from "../../../lib/browser.js";

export const dashboardRuntime = {
  addBodyClass(className: string): void {
    addBodyClass(className);
  },
  addWindowListener(type: string, listener: EventListener): () => void {
    return addWindowListener(type, listener);
  },
  currentPathname(): string {
    return currentPathname();
  },
  currentUrl(): URL {
    return currentUrl();
  },
  bodyHasClass(className: string): boolean {
    return bodyHasClass(className);
  },
  getBodyAttribute(name: string): string | null {
    return getBodyAttribute(name);
  },
  getDocumentLanguage(): string {
    return getDocumentLanguage();
  },
  pushBrowserState(state: object, path: string): void {
    pushBrowserState(state, path);
  },
  reloadBrowser(): void {
    reloadBrowser();
  },
  removeBodyAttribute(name: string): void {
    removeBodyAttribute(name);
  },
  removeBodyClass(className: string): void {
    removeBodyClass(className);
  },
  replaceBrowserState(state: object, path: string): void {
    replaceBrowserState(state, path);
  },
  storageSet(key: string, value: string): boolean {
    return storageSet(key, value);
  },
  setBodyAttribute(name: string, value: string): void {
    setBodyAttribute(name, value);
  },
  setDocumentLanguage(language: string): void {
    setDocumentLanguage(language);
  },
  subscribeColorSchemeChange(listener: EventListener): () => void {
    return subscribeColorSchemeChange(listener);
  },
};
