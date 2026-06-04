import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

function chunkNameFromPath(id, marker, prefix) {
  const [, tail = "index"] = id.split(marker);
  const name = tail
    .replace(/\.(js|svelte|css)$/, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return `${prefix}-${name || "index"}`;
}

function dashboardChunk(id) {
  if (
    id.includes("ace-builds") ||
    id.includes("/frontend/src/services/txJsonEditors")
  ) {
    return "editor-ace";
  }
  if (id.includes("/node_modules/")) {
    if (id.includes("/node_modules/svelte/")) return "vendor-svelte";
    return "vendor";
  }
  if (id.includes("/frontend/src/i18n/")) return "i18n";
  if (id.includes("/frontend/src/pages/")) {
    return chunkNameFromPath(id, "/frontend/src/pages/", "page");
  }
  if (id.includes("/frontend/src/actions/")) return "actions";
  if (id.includes("/frontend/src/services/")) return "services";
  if (id.includes("/frontend/src/runtime/render")) return "runtime-render";
  if (
    id.includes("/frontend/src/runtime/connectionsRuntime") ||
    id.includes("/frontend/src/runtime/profilesRuntime")
  ) {
    return "runtime-business";
  }
  if (id.includes("/frontend/src/runtime/")) return "runtime-core";
  return undefined;
}

export default defineConfig({
  root: "frontend",
  base: "/static/",
  plugins: [tailwindcss(), svelte()],
  build: {
    outDir: "../static",
    emptyOutDir: true,
    rolldownOptions: {
      output: {
        manualChunks: dashboardChunk,
      },
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
  },
});
