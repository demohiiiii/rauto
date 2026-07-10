export function hasWindow() {
  return typeof window !== "undefined";
}

export function hasDocument() {
  return typeof document !== "undefined";
}

export function storageGet(key, fallback = "") {
  try {
    if (!hasWindow()) return fallback;
    return localStorage.getItem(key) ?? fallback;
  } catch (_) {
    return fallback;
  }
}

export function storageSet(key, value) {
  try {
    if (!hasWindow()) return false;
    localStorage.setItem(key, value);
    return true;
  } catch (_) {
    return false;
  }
}

export function storageRemove(key) {
  try {
    if (!hasWindow()) return false;
    localStorage.removeItem(key);
    return true;
  } catch (_) {
    return false;
  }
}

export function browserPrompt(message, initialValue = "") {
  try {
    return window.prompt(message, initialValue);
  } catch (_) {
    return null;
  }
}

export function browserConfirm(message) {
  try {
    return window.confirm(message);
  } catch (_) {
    return false;
  }
}

export function browserRequestAnimationFrame(frameHandler) {
  if (!hasWindow()) {
    frameHandler();
    return 0;
  }
  if (typeof window.requestAnimationFrame === "function") {
    return window.requestAnimationFrame(frameHandler);
  }
  return window.setTimeout(frameHandler, 0);
}

export function browserSetTimeout(timeoutHandler, delay) {
  if (!hasWindow()) {
    timeoutHandler();
    return 0;
  }
  return window.setTimeout(timeoutHandler, delay);
}

export function browserClearTimeout(timer) {
  if (hasWindow() && timer) {
    window.clearTimeout(timer);
  }
}

export function supportsNativeDialogElement(node) {
  return (
    !!node &&
    typeof node.showModal === "function" &&
    typeof node.close === "function"
  );
}

export function prefersDarkColorScheme() {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch (_) {
    return true;
  }
}

export function subscribeColorSchemeChange(colorSchemeHandler) {
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

export function currentPathname() {
  return hasWindow() ? window.location.pathname : "/";
}

export function currentUrl() {
  return new URL(hasWindow() ? window.location.href : "http://localhost/");
}

export function pushBrowserState(state, path) {
  if (!hasWindow()) return;
  window.history.pushState(state, "", path);
}

export function replaceBrowserState(state, path) {
  if (!hasWindow()) return;
  window.history.replaceState(state, hasDocument() ? document.title : "", path);
}

export function addWindowListener(type, listener) {
  if (!hasWindow()) return () => {};
  window.addEventListener(type, listener);
  return () => window.removeEventListener(type, listener);
}

export function getDocumentLanguage() {
  return hasDocument() ? document.documentElement.lang : "";
}

export function setDocumentLanguage(language) {
  if (hasDocument()) {
    document.documentElement.lang = language || "";
  }
}

export function requiredDocumentElementById(elementId) {
  if (!hasDocument()) {
    throw new Error(`Missing #${elementId} document element`);
  }
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Missing #${elementId} document element`);
  }
  return element;
}

export function bodyHasClass(className) {
  return hasDocument() ? document.body.classList.contains(className) : false;
}

export function setBodyClass(className, enabled) {
  if (!hasDocument()) return;
  document.body.classList.toggle(className, !!enabled);
}

export function addBodyClass(className) {
  setBodyClass(className, true);
}

export function removeBodyClass(className) {
  setBodyClass(className, false);
}

export function getBodyAttribute(name) {
  return hasDocument() ? document.body.getAttribute(name) : null;
}

export function setBodyAttribute(name, value) {
  if (hasDocument()) {
    document.body.setAttribute(name, value);
  }
}

export function removeBodyAttribute(name) {
  if (hasDocument()) {
    document.body.removeAttribute(name);
  }
}

export function downloadBrowserBlob(blob, filename) {
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

export async function writeClipboardText(text) {
  if (
    !hasWindow() ||
    !navigator.clipboard ||
    typeof navigator.clipboard.writeText !== "function"
  ) {
    throw new Error("clipboard unavailable");
  }
  await navigator.clipboard.writeText(text);
}
