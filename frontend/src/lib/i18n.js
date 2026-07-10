import { get, writable } from "svelte/store";

const i18nDictionaries = {
  en: null,
  zh: null,
};
const i18nLoadPromises = new Map();

function normalizeI18nLanguage(lang) {
  return lang === "en" ? "en" : "zh";
}

export const currentLanguageState = writable("zh");

export function currentLanguage() {
  return normalizeI18nLanguage(get(currentLanguageState));
}

export function setCurrentLanguage(lang) {
  currentLanguageState.set(normalizeI18nLanguage(lang));
}

export async function loadI18nLanguage(lang) {
  const normalizedLang = normalizeI18nLanguage(lang);
  if (i18nDictionaries[normalizedLang]) {
    setCurrentLanguage(normalizedLang);
    return i18nDictionaries[normalizedLang];
  }
  if (!i18nLoadPromises.has(normalizedLang)) {
    i18nLoadPromises.set(normalizedLang, loadI18nDictionary(normalizedLang));
  }
  const dictionary = await i18nLoadPromises.get(normalizedLang);
  setCurrentLanguage(normalizedLang);
  return dictionary;
}

async function importI18nDictionary(normalizedLang) {
  if (normalizedLang === "en") {
    const module = await import("../i18n/en.js");
    return module.i18nEn;
  }
  const module = await import("../i18n/zh.js");
  return module.i18nZh;
}

async function loadI18nDictionary(normalizedLang) {
  try {
    const dictionary = await importI18nDictionary(normalizedLang);
    i18nDictionaries[normalizedLang] = dictionary || {};
    return i18nDictionaries[normalizedLang];
  } catch (error) {
    i18nLoadPromises.delete(normalizedLang);
    throw error;
  }
}

export function tr(key, fallback = key) {
  const currentLang = currentLanguage();
  const dict = i18nDictionaries[currentLang] || {};
  const englishDict = i18nDictionaries.en || {};
  const chineseDict = i18nDictionaries.zh || {};
  return dict[key] || englishDict[key] || chineseDict[key] || fallback;
}

export function t(key) {
  return tr(key, key);
}
