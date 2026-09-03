import { fileURLToPath } from "node:url";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const LUCIDE_MODULE_PATTERN = /[\\/]node_modules[\\/]@lucide[\\/]svelte[\\/]/;
const SHARED_UI_MODULE_PATTERN =
  /[\\/]frontend[\\/]src[\\/](?:components|lib[\\/]components)[\\/]/;

function isApplicationModule(id) {
  return !id.startsWith("\0") && !id.includes("/node_modules/");
}

export default defineConfig(({ command, isPreview }) => ({
  root: "frontend",
  base: command === "build" || isPreview ? "/static/" : "/",
  plugins: [
    tailwindcss(),
    svelte({
      configFile: fileURLToPath(new URL("./svelte.config.js", import.meta.url)),
    }),
  ],
  resolve: {
    alias: {
      $api: fileURLToPath(new URL("./frontend/src/api", import.meta.url)),
      $components: fileURLToPath(
        new URL("./frontend/src/components", import.meta.url),
      ),
      $config: fileURLToPath(new URL("./frontend/src/config", import.meta.url)),
      $domains: fileURLToPath(
        new URL("./frontend/src/domains", import.meta.url),
      ),
      $lib: fileURLToPath(new URL("./frontend/src/lib", import.meta.url)),
    },
  },
  build: {
    outDir: "../static",
    emptyOutDir: true,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "app-initial",
              test: isApplicationModule,
              tags: ["$initial"],
              priority: 300,
            },
            {
              name: "vendor-icons",
              test: LUCIDE_MODULE_PATTERN,
              priority: 200,
            },
            {
              name: "shared-ui",
              test: SHARED_UI_MODULE_PATTERN,
              entriesAware: true,
              entriesAwareMergeThreshold: 12 * 1024,
              maxModuleSize: 10 * 1024,
              priority: 100,
            },
          ],
        },
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
}));
