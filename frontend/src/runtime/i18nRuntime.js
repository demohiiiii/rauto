import { i18nEn } from "../i18n/en.js";
import { i18nZh } from "../i18n/zh.js";

export function installI18nRuntime() {
  window.i18n = { en: i18nEn, zh: i18nZh };
}
