import assert from "node:assert/strict";
import test from "node:test";
import {
  collectDetectProfile,
  ensureDetectProfileDefaults,
  normalizeDetectProfileForm,
} from "../src/domains/profiles/model/profileDiagnostics.js";

const validationMessages = {
  invalidWeight: "invalid weight",
  probeCommandRequired: "command required",
};

test("detect profile form creates editable defaults only when enabled", () => {
  assert.deepEqual(normalizeDetectProfileForm(null), {
    enabled: false,
    initialRules: [],
    probes: [],
  });

  const enabled = normalizeDetectProfileForm({ initial_rules: [], probes: [] });
  assert.equal(enabled.enabled, true);
  assert.deepEqual(enabled.initialRules, [{ pattern: "", weight: "50" }]);
  assert.deepEqual(enabled.probes, [
    {
      command: "",
      error_patterns: [],
      rules: [{ pattern: "", weight: "50" }],
    },
  ]);

  const disabled = { enabled: false, initialRules: [], probes: [] };
  assert.equal(ensureDetectProfileDefaults(disabled), disabled);
});

test("detect profile collection trims values and omits empty probes", () => {
  const form = normalizeDetectProfileForm({
    initial_rules: [{ pattern: " login ", weight: 75 }],
    probes: [
      {
        command: " show version ",
        error_patterns: [" denied ", ""],
        rules: [{ pattern: " ready ", weight: 25 }],
      },
      { command: "", error_patterns: [], rules: [] },
    ],
  });

  assert.deepEqual(collectDetectProfile(form, validationMessages), {
    initial_rules: [{ pattern: "login", weight: 75 }],
    probes: [
      {
        command: "show version",
        error_patterns: ["denied"],
        rules: [{ pattern: "ready", weight: 25 }],
      },
    ],
  });
});

test("detect profile collection rejects invalid rule weights", () => {
  const form = normalizeDetectProfileForm({
    initial_rules: [{ pattern: "login", weight: 1 }],
    probes: [],
  });
  form.initialRules[0].weight = "1.5";
  assert.throws(
    () => collectDetectProfile(form, validationMessages),
    /invalid weight/,
  );
});
