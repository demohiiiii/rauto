import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync("frontend/src/app.css", "utf8");

function blockFor(selector) {
  const start = css.indexOf(`${selector} {`);
  assert.notEqual(start, -1, `${selector} block should exist`);
  const bodyStart = css.indexOf("{", start);

  let depth = 0;
  for (let index = bodyStart; index < css.length; index += 1) {
    const char = css[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0 && index > bodyStart) {
      return css.slice(start, index + 1);
    }
  }

  assert.fail(`${selector} block should close`);
}

function blocksFor(selector) {
  const blocks = [];
  let searchStart = 0;
  const selectorStart = `${selector} {`;

  while (searchStart < css.length) {
    const start = css.indexOf(selectorStart, searchStart);
    if (start === -1) break;
    const bodyStart = css.indexOf("{", start);

    let depth = 0;
    for (let index = bodyStart; index < css.length; index += 1) {
      const char = css[index];
      if (char === "{") depth += 1;
      if (char === "}") depth -= 1;
      if (depth === 0 && index > bodyStart) {
        blocks.push(css.slice(start, index + 1));
        searchStart = index + 1;
        break;
      }
    }
  }

  assert.notEqual(blocks.length, 0, `${selector} block should exist`);
  return blocks;
}

const semanticTokens = [
  "--background:",
  "--foreground:",
  "--card:",
  "--card-foreground:",
  "--popover:",
  "--popover-foreground:",
  "--primary:",
  "--primary-foreground:",
  "--secondary:",
  "--secondary-foreground:",
  "--muted:",
  "--muted-foreground:",
  "--accent:",
  "--accent-foreground:",
  "--destructive:",
  "--destructive-foreground:",
  "--border:",
  "--input:",
  "--ring:",
];

function assertTokensInBlock(selector, tokens) {
  const block = blockFor(selector);
  for (const token of tokens) {
    assert.match(block, new RegExp(token.replaceAll("-", "\\-")));
  }
}

test("app css defines shadcn semantic tokens", () => {
  assertTokensInBlock(":root", [...semanticTokens, "--radius:"]);
  assertTokensInBlock(".dark", semanticTokens);
});

test("theme tokens support light and dark dashboard themes", () => {
  assertTokensInBlock(".dashboard-body", semanticTokens);
  assertTokensInBlock(
    '.dashboard-body[data-dashboard-theme="light"]',
    semanticTokens,
  );
});

test("light dashboard theme keeps brand tokens connected to preset variables", () => {
  const lightBlocks = blocksFor(
    '.dashboard-body[data-dashboard-theme="light"]',
  );
  const tokenExpectations = new Map([
    ["--primary", "var(--rauto-primary)"],
    ["--primary-foreground", "var(--rauto-primary-foreground)"],
    ["--ring", "var(--rauto-ring)"],
  ]);

  for (const [token, expectedValue] of tokenExpectations) {
    const declarations = lightBlocks
      .flatMap(
        (block) => block.match(new RegExp(`${token}:\\s*[^;]+;`, "g")) || [],
      )
      .map((declaration) => declaration.replace(/\s+/g, " ").trim());

    assert.notEqual(
      declarations.length,
      0,
      `light dashboard theme should declare ${token}`,
    );
    for (const declaration of declarations) {
      assert.equal(declaration, `${token}: ${expectedValue};`);
    }
  }
});
