import assert from "node:assert/strict";
import test from "node:test";
import {
  profileModeExpressionCandidates,
  profileModeExpressionFromSelection,
  profileModeExpressionMatchesOptions,
  profileModeExpressionSelectedOptions,
  profileModeExpressionSuggestions,
  profileModeExpressionUnmatchedCandidates,
} from "../src/domains/profiles/model/modeExpression.js";

test("profile mode expressions split comma and pipe candidates", (): void => {
  assert.deepEqual(profileModeExpressionCandidates(" Root, User | Config "), [
    "Root",
    "User",
    "Config",
  ]);
  assert.deepEqual(profileModeExpressionCandidates(",,Enable||"), ["Enable"]);
});

test("profile mode expressions match candidates case insensitively", () => {
  assert.equal(
    profileModeExpressionMatchesOptions(" root | user ", [
      "Root",
      "User",
      "Config",
    ]),
    true,
  );
  assert.equal(
    profileModeExpressionMatchesOptions("Root,Missing", ["Root", "User"]),
    false,
  );
});

test("profile mode expression suggestions preserve current custom values", () => {
  assert.deepEqual(
    profileModeExpressionSuggestions(["Root", "User", "Root"], "Root|User"),
    ["Root", "User", "Root|User"],
  );
});

test("profile mode expressions map multi-select values to canonical expressions", () => {
  assert.deepEqual(
    profileModeExpressionSelectedOptions("root|user", [
      "Root",
      "User",
      "Config",
    ]),
    ["Root", "User"],
  );
  assert.deepEqual(
    profileModeExpressionUnmatchedCandidates("Root|Maintenance", [
      "Root",
      "User",
    ]),
    ["Maintenance"],
  );
  assert.equal(
    profileModeExpressionFromSelection(["User", "Root"], "Maintenance", [
      "Root",
      "User",
    ]),
    "Root,User,Maintenance",
  );
});
