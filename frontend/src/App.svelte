<script>
  import { onMount } from "svelte";
  import DashboardBody from "./components/DashboardBody.svelte";
  import { bootstrapDashboardApp } from "./runtime/dashboardBootstrap.js";

  let status = $state("loading");
  let error = $state("");
  let destroyDashboardRouter = null;

  onMount(() => {
    bootstrapDashboardApp()
      .then((destroy) => {
        destroyDashboardRouter = destroy;
        status = "ready";
      })
      .catch((nextError) => {
        error =
          nextError instanceof Error ? nextError.message : String(nextError);
        status = "error";
      });

    return () => {
      if (destroyDashboardRouter) {
        destroyDashboardRouter();
        destroyDashboardRouter = null;
      }
    };
  });
</script>

{#if status === "error"}
  <main class="min-h-screen bg-slate-50 p-6 text-slate-900">
    <section
      class="mx-auto max-w-2xl rounded-2xl border border-rose-200 bg-white p-5 shadow-sm"
    >
      <h1 class="text-lg font-semibold text-rose-700">
        Failed to load rauto web dashboard
      </h1>
      <p class="mt-2 text-sm text-slate-600">{error}</p>
      <a class="btn btn-sm mt-4" href="/app">Reload dashboard</a>
    </section>
  </main>
{/if}

<DashboardBody busy={status === "loading"} />
