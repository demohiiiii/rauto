import { get, writable } from "svelte/store";
import type { I18nDictionary, I18nLanguage } from "../i18n/types.js";

const i18nDictionaries: Record<I18nLanguage, I18nDictionary | null> = {
  en: null,
  zh: null,
};
const i18nLoadPromises = new Map<I18nLanguage, Promise<I18nDictionary>>();

function normalizeI18nLanguage(lang: unknown): I18nLanguage {
  return lang === "en" ? "en" : "zh";
}

export const currentLanguageState = writable<I18nLanguage>("zh");

export function currentLanguage(): I18nLanguage {
  return normalizeI18nLanguage(get(currentLanguageState));
}

export function setCurrentLanguage(lang: unknown): void {
  currentLanguageState.set(normalizeI18nLanguage(lang));
}

export async function loadI18nLanguage(lang: unknown): Promise<I18nDictionary> {
  const normalizedLang = normalizeI18nLanguage(lang);
  if (i18nDictionaries[normalizedLang]) {
    setCurrentLanguage(normalizedLang);
    return i18nDictionaries[normalizedLang];
  }
  let loadPromise = i18nLoadPromises.get(normalizedLang);
  if (!loadPromise) {
    loadPromise = loadI18nDictionary(normalizedLang);
    i18nLoadPromises.set(normalizedLang, loadPromise);
  }
  const dictionary = await loadPromise;
  setCurrentLanguage(normalizedLang);
  return dictionary;
}

async function importI18nDictionary(
  normalizedLang: I18nLanguage,
): Promise<I18nDictionary> {
  if (normalizedLang === "en") {
    const module = await import("../i18n/en.js");
    return module.i18nEn;
  }
  const module = await import("../i18n/zh.js");
  return module.i18nZh;
}

async function loadI18nDictionary(
  normalizedLang: I18nLanguage,
): Promise<I18nDictionary> {
  try {
    const dictionary = await importI18nDictionary(normalizedLang);
    i18nDictionaries[normalizedLang] = dictionary || {};
    return i18nDictionaries[normalizedLang];
  } catch (error) {
    i18nLoadPromises.delete(normalizedLang);
    throw error;
  }
}

export function tr(key: string, fallback = key): string {
  const currentLang = currentLanguage();
  const dict = i18nDictionaries[currentLang] || {};
  const englishDict = i18nDictionaries.en || {};
  const chineseDict = i18nDictionaries.zh || {};
  return dict[key] || englishDict[key] || chineseDict[key] || fallback;
}

export function t(key: string, fallback = key): string {
  return tr(key, fallback);
}
