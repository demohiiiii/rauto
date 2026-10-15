import assert from "node:assert/strict";
import test from "node:test";
import { runtimeVariablesJsonState } from "../src/domains/transactions/model/runtimeVariablesJson.js";
import { jsonParseErrorDetail } from "../src/lib/jsonValue.js";

test("variable JSON errors retain leading blank lines in their location", () => {
  const state = runtimeVariablesJsonState(
    '\n\n{\n  "addresses": [\n    "192.0.2.1",\n  ]\n}',
  );
  assert.equal(state.formattedText, null);
  assert.equal(state.error?.line, 6);
  assert.equal(state.error?.column, 3);
  assert.ok(state.error.message);
});

test("unfinished variable JSON points to the end of the input", () => {
  for (const newline of ["\n", "\r\n", "\r"]) {
    const text = `{${newline}  "addresses": [`;
    const state = runtimeVariablesJsonState(text);
    assert.equal(state.formattedText, null);
    assert.equal(state.error?.line, 2);
    assert.equal(state.error?.column, 17);
  }
  assert.deepEqual(
    jsonParseErrorDetail(
      '{\n  "addresses": [\n',
      new SyntaxError("Unexpected end of JSON input"),
    ),
    { message: "Unexpected end of JSON input", line: 3, column: 1 },
  );
});

test("variable JSON locates errors even when native context is ambiguous", () => {
  const text = '{\n  "first": },\n  "second": }\n}';
  const nativeParse = JSON.parse;
  const original = new SyntaxError(
    `Unexpected token '}', ..."}"... is not valid JSON`,
  );
  try {
    JSON.parse = () => {
      throw original;
    };
    const state = runtimeVariablesJsonState(text);
    assert.equal(state.formattedText, null);
    assert.equal(state.error?.line, 2);
    assert.equal(state.error?.column, 12);
    assert.equal(state.error?.message, original.message);
  } finally {
    JSON.parse = nativeParse;
  }
});

test("formatting variable JSON preserves nested values and string whitespace", () => {
  const text =
    '{"addresses":["192.0.2.1",{"label":"two  spaces\\nnext line"}],"enabled":true,"optional":null,"count":2}';
  const state = runtimeVariablesJsonState(text);
  assert.equal(state.error, null);
  assert.ok(state.formattedText);
  assert.match(state.formattedText, /\n  "addresses": \[\n    "192\.0\.2\.1",/);
  assert.deepEqual(JSON.parse(state.formattedText), JSON.parse(text));
  assert.equal(
    runtimeVariablesJsonState(state.formattedText).formattedText,
    state.formattedText,
  );
});

test("formatting only changes whitespace and preserves JSON literals and key order", () => {
  const text =
    '{"9":9007199254740993,"0":-0,"big":1e400,"escaped":"\\u0061\\\\\\\"","duplicate":1,"duplicate":2,"empty":[{},[]]}';
  const formatted = runtimeVariablesJsonState(text).formattedText;
  assert.ok(formatted);
  assert.ok(formatted.indexOf('"9"') < formatted.indexOf('"0"'));
  assert.match(formatted, /9007199254740993/);
  assert.match(formatted, /"0": -0/);
  assert.match(formatted, /1e400/);
  assert.match(formatted, /"duplicate": 1,\n  "duplicate": 2/);
  assert.deepEqual(
    formatted.match(/"(?:\\.|[^"\\])*"|[^\s]/g),
    text.match(/"(?:\\.|[^"\\])*"|[^\s]/g),
  );
});

test("JSON value formatting accepts lists and primitives; empty variables remain optional", () => {
  for (const text of [
    '[1,{"enabled":false}]',
    '"two  spaces"',
    "0",
    "false",
    "null",
  ]) {
    const state = runtimeVariablesJsonState(text);
    assert.equal(state.error, null);
    assert.ok(state.formattedText);
    assert.deepEqual(JSON.parse(state.formattedText), JSON.parse(text));
  }
  assert.deepEqual(runtimeVariablesJsonState(" \n\t"), {
    error: null,
    formattedText: "{}",
  });
});
