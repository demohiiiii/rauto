import { mount } from "svelte";
import App from "./App.svelte";
import "./app.css";
import { requiredDocumentElementById, storageGet } from "./lib/browser.js";
import { loadI18nLanguage } from "./lib/i18n.js";

await loadI18nLanguage(storageGet("rauto_lang") === "en" ? "en" : "zh");

const app = mount(App, {
  target: requiredDocumentElementById("app"),
});

export default app;
