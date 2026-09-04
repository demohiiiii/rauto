import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizePromptMode,
  PROMPT_MODE,
  promptModeTabs,
} from "../src/config/dashboardModes.js";
import { promptModePresentation } from "../src/domains/profiles/presentation/profileCatalogPresentation.js";
import {
  normalizeBuiltinProfileDetail,
  normalizeBuiltinProfileOverview,
  selectBuiltinProfile,
} from "../src/domains/profiles/model/profileCatalog.js";

test("profile catalog model normalizes builtin summaries and selection", () => {
  const overview = normalizeBuiltinProfileOverview(
    [
      { name: "ios", aliases: ["iosxe"], summary: "Cisco IOS" },
      { name: "junos", aliases: [], summary: "Juniper Junos" },
    ],
    "ios",
  );

  assert.deepEqual(overview.options, ["ios", "junos"]);
  assert.equal(overview.selected, "ios");
  assert.equal(
    overview.overviewText,
    "- ios (aliases: iosxe): Cisco IOS\n- junos: Juniper Junos",
  );
  assert.equal(selectBuiltinProfile(overview, "missing").selected, "");
  assert.deepEqual(
    normalizeBuiltinProfileDetail({
      aliases: ["iosxe", "cisco_ios"],
      name: "ios",
      notes: ["first", "second"],
      source: "builtin",
      summary: "Cisco IOS",
    }),
    {
      aliases: "iosxe, cisco_ios",
      name: "ios",
      notes: "first\nsecond",
      source: "builtin",
      summary: "Cisco IOS",
    },
  );
});

test("profile management keeps one profile mode and normalizes legacy modes", () => {
  assert.deepEqual(
    promptModeTabs.map((tab) => tab.value),
    [PROMPT_MODE.builtin],
  );
  assert.equal(normalizePromptMode(PROMPT_MODE.edit), PROMPT_MODE.builtin);
  assert.equal(normalizePromptMode(PROMPT_MODE.diagnose), PROMPT_MODE.builtin);
  assert.deepEqual(promptModePresentation(PROMPT_MODE.diagnose), {
    builtinActive: true,
    diagnoseActive: false,
    editActive: false,
    profilesActive: true,
  });
});
