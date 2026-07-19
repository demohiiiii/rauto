<script>
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import { Skeleton } from "$lib/components/ui/skeleton/index.js";
  import { createDashboardAppWorkspace } from "./modules/dashboard/dashboardApp.js";

  const dashboardAppWorkspace = createDashboardAppWorkspace();
  const {
    applyAppBootstrap,
    bootstrapDisplayStateStore,
    dashboardBodyComponentStateStore,
    dashboardBodyLoadErrorStateStore,
    ensureDashboardBodyComponentLoaded,
  } = dashboardAppWorkspace;
  let LoadedBodyComponent = $derived($dashboardBodyComponentStateStore);
  let bodyLoadError = $derived($dashboardBodyLoadErrorStateStore);
  let bootstrapDisplay = $derived($bootstrapDisplayStateStore);

  $effect(() => {
    return ensureDashboardBodyComponentLoaded();
  });

  $effect(() => {
    return applyAppBootstrap();
  });
</script>

{#snippet loadingSkeleton()}
  <div class="grid gap-4" aria-label={bootstrapDisplay.loadFailedTitle}>
    <Skeleton class="h-8 w-56" />
    <div class="grid gap-3 md:grid-cols-3" aria-hidden="true">
      <Skeleton class="h-24" />
      <Skeleton class="h-24" />
      <Skeleton class="h-24" />
    </div>
    <Skeleton class="h-72" />
  </div>
{/snippet}

{#if bootstrapDisplay.showError}
  <main class="min-h-screen bg-background p-6 text-foreground">
    <Card.Root class="mx-auto max-w-2xl">
      <Card.Header>
        <Card.Title>{bootstrapDisplay.loadFailedTitle}</Card.Title>
        <Card.Description>{bootstrapDisplay.errorMessage}</Card.Description>
      </Card.Header>
      <Card.Footer>
        <Button href="/app" size="sm" variant="outline">
          {bootstrapDisplay.reloadButtonLabel}
        </Button>
      </Card.Footer>
    </Card.Root>
  </main>
{:else if bodyLoadError}
  <main class="min-h-screen bg-background p-6 text-foreground">
    <Card.Root class="mx-auto max-w-2xl">
      <Card.Header>
        <Card.Title>{bootstrapDisplay.loadFailedTitle}</Card.Title>
        <Card.Description>{bodyLoadError}</Card.Description>
      </Card.Header>
      <Card.Footer>
        <Button href="/app" size="sm" variant="outline">
          {bootstrapDisplay.reloadButtonLabel}
        </Button>
      </Card.Footer>
    </Card.Root>
  </main>
{:else if LoadedBodyComponent}
  <LoadedBodyComponent busy={bootstrapDisplay.busy} />
{:else}
  <main class="min-h-screen bg-background p-6 text-foreground">
    <section class="mx-auto max-w-6xl">
      {@render loadingSkeleton()}
    </section>
  </main>
{/if}
