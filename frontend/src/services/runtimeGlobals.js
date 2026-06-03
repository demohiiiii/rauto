export function byId(id) {
  return document.getElementById(id);
}

export function runtimeValue(name) {
  try {
    return Function(
      `return typeof ${name} !== "undefined" ? ${name} : undefined`,
    )();
  } catch (_) {
    return window[name];
  }
}

export function setRuntimeValue(name, value) {
  try {
    Function("value", `${name} = value;`)(value);
  } catch (_) {
    window[name] = value;
  }
}

export function callRuntimeFunction(name, fallback, ...args) {
  const fn = window[name] || runtimeValue(name);
  if (typeof fn === "function") {
    return fn(...args);
  }
  return fallback(...args);
}

export function safeCall(name, ...args) {
  const fn = window[name];
  if (typeof fn === "function") {
    return fn(...args);
  }
  return undefined;
}
