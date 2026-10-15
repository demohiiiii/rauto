import assert from "node:assert/strict";
import test from "node:test";
import { EditorState } from "@codemirror/state";
import { diagnosticCount, setDiagnostics } from "@codemirror/lint";
import {
  inlineJsonErrorDecorations,
  jsonEditorDiagnostic,
} from "../src/components/fragments/jsonEditorDiagnostics.js";
import { runtimeVariablesJsonState } from "../src/domains/transactions/model/runtimeVariablesJson.js";

test("JSON diagnostics underline the reported character on its editor line", () => {
  const text = '\n\n{\n  "addresses": [\n    "192.0.2.1",\n  ]\n}';
  const state = EditorState.create({ doc: text });
  const detail = runtimeVariablesJsonState(text).error;
  assert.ok(detail);
  const [diagnostic] = jsonEditorDiagnostic(state, detail);
  const line = state.doc.line(6);
  assert.equal(diagnostic.from, line.from + 2);
  assert.equal(state.sliceDoc(diagnostic.from, diagnostic.to), "]");
  assert.equal(diagnostic.message, detail.message);
  assert.equal(diagnostic.severity, "error");
});

test("unfinished JSON on an empty last line produces a point diagnostic and inline message", () => {
  for (const newline of ["\n", "\r\n", "\r"]) {
    const text = `{${newline}  "addresses": [${newline}`;
    let state = EditorState.create({ doc: text });
    const diagnostics = jsonEditorDiagnostic(
      state,
      runtimeVariablesJsonState(text).error,
    );
    assert.equal(diagnostics[0].from, state.doc.length);
    assert.equal(diagnostics[0].to, state.doc.length);
    state = state.update(setDiagnostics(state, diagnostics)).state;
    const markers: { from: number; to: number }[] = [];
    inlineJsonErrorDecorations(state).between(
      0,
      state.doc.length,
      (from, to) => {
        markers.push({ from, to });
      },
    );
    assert.deepEqual(markers, [
      { from: state.doc.length, to: state.doc.length },
      { from: state.doc.length, to: state.doc.length },
    ]);
  }
});

test("diagnostic positions stay within the current document after replacements", () => {
  const state = EditorState.create({ doc: "{}\n" });
  for (const detail of [
    { line: 100, column: 100, message: "old location" },
    { line: -1, column: -1, message: "invalid location" },
    { line: null, column: null, message: "object required" },
  ]) {
    const [diagnostic] = jsonEditorDiagnostic(state, detail);
    assert.ok(diagnostic.from >= 0);
    assert.ok(diagnostic.from <= diagnostic.to);
    assert.ok(diagnostic.to <= state.doc.length);
  }
  assert.equal(
    jsonEditorDiagnostic(state, { line: 100, column: 100, message: "old" })[0]
      .from,
    state.doc.length,
  );
  assert.equal(
    jsonEditorDiagnostic(state, {
      line: null,
      column: null,
      message: "object required",
    })[0].from,
    0,
  );
});

test("an unexpected Unicode character is underlined as one complete character", () => {
  const state = EditorState.create({ doc: '{"address": 😀}' });
  const [diagnostic] = jsonEditorDiagnostic(state, {
    line: 1,
    column: 13,
    message: "Unexpected character",
  });
  assert.equal(state.sliceDoc(diagnostic.from, diagnostic.to), "😀");
});

test("fixing JSON clears both the inline error and gutter diagnostics", () => {
  let state = EditorState.create({ doc: '{"address":}' });
  state = state.update(
    setDiagnostics(
      state,
      jsonEditorDiagnostic(
        state,
        runtimeVariablesJsonState(state.doc.toString()).error,
      ),
    ),
  ).state;
  assert.equal(diagnosticCount(state), 1);
  const markers: { from: number; className?: string }[] = [];
  inlineJsonErrorDecorations(state).between(
    0,
    state.doc.length,
    (from, _to, decoration) => {
      markers.push({ from, className: decoration.spec.class });
    },
  );
  assert.equal(markers[0].from, 0);
  assert.equal(markers[0].className, "cm-json-error-line");
  assert.equal(markers[1].from, state.doc.length);

  state = state.update({
    changes: {
      from: 0,
      to: state.doc.length,
      insert: '{"address":"192.0.2.1"}',
    },
  }).state;
  state = state.update(
    setDiagnostics(state, jsonEditorDiagnostic(state, null)),
  ).state;
  assert.equal(diagnosticCount(state), 0);
  assert.equal(inlineJsonErrorDecorations(state).size, 0);
});
