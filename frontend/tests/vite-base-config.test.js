import test from "node:test";
import assert from "node:assert/strict";
import viteConfig from "../../vite.config.js";

function resolveConfig(command) {
  if (typeof viteConfig === "function") {
    return viteConfig({
      command,
      mode: command === "build" ? "production" : "development",
      isPreview: false,
      isSsrBuild: false,
    });
  }
  return viteConfig;
}

test("vite uses root base in dev and /static/ base in build", () => {
  const serveConfig = resolveConfig("serve");
  const buildConfig = resolveConfig("build");

  assert.equal(serveConfig.base, "/");
  assert.equal(buildConfig.base, "/static/");
});
