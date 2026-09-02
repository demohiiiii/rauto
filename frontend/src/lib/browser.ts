type BrowserCleanup = () => void;
type BrowserFrameHandler = (timestamp?: number) => void;
type BrowserTimeoutHandler = () => void;

export interface NativeDialogElement {
  close(): void;
  showModal(): void;
}

export function hasWindow(): boolean {
  return typeof window !== "undefined";
}

export function hasDocument(): boolean {
  return typeof document !== "undefined";
}

export function storageGet(key: string, fallback = ""): string {
  try {
    if (!hasWindow()) return fallback;
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function storageSet(key: string, value: string): boolean {
  try {
    if (!hasWindow()) return false;
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function storageRemove(key: string): boolean {
  try {
    if (!hasWindow()) return false;
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function browserPrompt(
  message: string,
  initialValue = "",
): string | null {
  try {
    return window.prompt(message, initialValue);
  } catch {
    return null;
  }
}

export function browserConfirm(message: string): boolean {
  try {
    return window.confirm(message);
  } catch {
    return false;
  }
}

export function browserRequestAnimationFrame(
  frameHandler: BrowserFrameHandler,
): number {
  if (!hasWindow()) {
    frameHandler();
    return 0;
  }
  if (typeof window.requestAnimationFrame === "function") {
    return window.requestAnimationFrame(frameHandler);
  }
  return window.setTimeout(frameHandler, 0);
}

export function browserSetTimeout(
  timeoutHandler: BrowserTimeoutHandler,
  delay: number,
): number {
  if (!hasWindow()) {
    timeoutHandler();
    return 0;
  }
  return window.setTimeout(timeoutHandler, delay);
}

export function browserClearTimeout(timer: number | null | undefined): void {
  if (hasWindow() && timer) {
    window.clearTimeout(timer);
  }
}

export function supportsNativeDialogElement(
  node: unknown,
): node is NativeDialogElement {
  return (
    !!node &&
    typeof node === "object" &&
    "showModal" in node &&
    typeof node.showModal === "function" &&
    "close" in node &&
    typeof node.close === "function"
  );
}

export function prefersDarkColorScheme(): boolean {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return true;
  }
}

export function subscribeColorSchemeChange(
  colorSchemeHandler: EventListener,
): BrowserCleanup {
  if (!hasWindow() || typeof window.matchMedia !== "function") {
    return () => {};
  }
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  if (typeof media.addEventListener === "function") {
    media.addEventListener("change", colorSchemeHandler);
    return () => media.removeEventListener("change", colorSchemeHandler);
  }
  if (typeof media.addListener === "function") {
    media.addListener(colorSchemeHandler);
    return () => media.removeListener(colorSchemeHandler);
  }
  return () => {};
}

export function currentPathname(): string {
  return hasWindow() ? window.location.pathname : "/";
}

export function currentUrl(): URL {
  return new URL(hasWindow() ? window.location.href : "http://localhost/");
}

export function pushBrowserState(state: unknown, path: string): void {
  if (!hasWindow()) return;
  window.history.pushState(state, "", path);
}

export function replaceBrowserState(state: unknown, path: string): void {
  if (!hasWindow()) return;
  window.history.replaceState(state, hasDocument() ? document.title : "", path);
}

export function addWindowListener(
  type: string,
  listener: EventListenerOrEventListenerObject,
): BrowserCleanup {
  if (!hasWindow()) return () => {};
  window.addEventListener(type, listener);
  return () => window.removeEventListener(type, listener);
}

export function reloadBrowser(): void {
  if (hasWindow()) window.location.reload();
}

export function getDocumentLanguage(): string {
  return hasDocument() ? document.documentElement.lang : "";
}

export function setDocumentLanguage(language: string): void {
  if (hasDocument()) {
    document.documentElement.lang = language || "";
  }
}

export function requiredDocumentElementById(elementId: string): HTMLElement {
  if (!hasDocument()) {
    throw new Error(`Missing #${elementId} document element`);
  }
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Missing #${elementId} document element`);
  }
  return element;
}

export function bodyHasClass(className: string): boolean {
  return hasDocument() ? document.body.classList.contains(className) : false;
}

export function setBodyClass(className: string, enabled: boolean): void {
  if (!hasDocument()) return;
  document.body.classList.toggle(className, !!enabled);
}

export function addBodyClass(className: string): void {
  setBodyClass(className, true);
}

export function removeBodyClass(className: string): void {
  setBodyClass(className, false);
}

export function getBodyAttribute(name: string): string | null {
  return hasDocument() ? document.body.getAttribute(name) : null;
}

export function setBodyAttribute(name: string, value: string): void {
  if (hasDocument()) {
    document.body.setAttribute(name, value);
  }
}

export function removeBodyAttribute(name: string): void {
  if (hasDocument()) {
    document.body.removeAttribute(name);
  }
}

export function downloadBrowserBlob(blob: Blob, filename: string): void {
  if (!hasDocument()) return;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function writeClipboardText(text: string): Promise<void> {
  if (
    !hasWindow() ||
    !navigator.clipboard ||
    typeof navigator.clipboard.writeText !== "function"
  ) {
    throw new Error("clipboard unavailable");
  }
  await navigator.clipboard.writeText(text);
}
