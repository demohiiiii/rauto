<script lang="ts">
  import type { Component } from "svelte";
  import LockKeyholeIcon from "@lucide/svelte/icons/lock-keyhole";
  import LogInIcon from "@lucide/svelte/icons/log-in";
  import NetworkIcon from "@lucide/svelte/icons/network";
  import ServerIcon from "@lucide/svelte/icons/server";
  import ShieldCheckIcon from "@lucide/svelte/icons/shield-check";
  import TerminalIcon from "@lucide/svelte/icons/terminal";
  import * as Alert from "$lib/components/ui/alert/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { Skeleton } from "$lib/components/ui/skeleton/index.js";
  import { Spinner } from "$lib/components/ui/spinner/index.js";
  import { createWebAuthWorkspace } from "$domains/auth/index.js";
  import { createDashboardAppWorkspace } from "$domains/dashboard/index.js";

  const webAuthWorkspace = createWebAuthWorkspace();
  const dashboardAppWorkspace = createDashboardAppWorkspace();
  const {
    initialize: initializeWebAuth,
    refresh: refreshWebAuth,
    setPassword: setWebPassword,
    submitLogin: submitWebLogin,
    webAuthDisplayStateStore,
    webPasswordStateStore,
  } = webAuthWorkspace;
  const {
    applyAppBootstrap,
    bootstrapDisplayStateStore,
    dashboardBodyComponentStateStore,
    dashboardBodyLoadErrorStateStore,
    ensureDashboardBodyComponentLoaded,
  } = dashboardAppWorkspace;
  type DashboardBodyComponent = Component<{ busy: boolean }>;

  let LoadedBodyComponent = $derived(
    $dashboardBodyComponentStateStore as DashboardBodyComponent | null,
  );
  let bodyLoadError = $derived($dashboardBodyLoadErrorStateStore);
  let bootstrapDisplay = $derived($bootstrapDisplayStateStore);
  let webAuthDisplay = $derived($webAuthDisplayStateStore);

  function webPasswordInput(
    event: Event & { currentTarget: HTMLInputElement },
  ) {
    setWebPassword(event.currentTarget.value);
  }

  function webLoginSubmit(event: SubmitEvent) {
    event.preventDefault();
    void submitWebLogin();
  }

  $effect(() => {
    return initializeWebAuth();
  });

  $effect(() => {
    if (!webAuthDisplay.authenticated) return undefined;
    return ensureDashboardBodyComponentLoaded();
  });

  $effect(() => {
    if (!webAuthDisplay.authenticated) return undefined;
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

{#if webAuthDisplay.showLogin}
  <main
    class="relative flex min-h-dvh items-center justify-center overflow-hidden bg-muted/40 p-4 text-foreground sm:p-8"
  >
    <div
      class="absolute inset-x-0 top-0 h-1 bg-primary"
      aria-hidden="true"
    ></div>
    <Card.Root
      class="grid w-full max-w-[58rem] gap-0 overflow-hidden rounded-lg border-border/80 py-0 shadow-xl lg:min-h-[34rem] lg:grid-cols-[minmax(0,0.92fr)_minmax(24rem,1.08fr)]"
    >
      <section
        class="flex min-h-52 flex-col justify-between gap-8 border-b border-border bg-accent p-7 text-foreground lg:min-h-full lg:border-r lg:border-b-0 lg:p-10"
      >
        <div class="flex items-center gap-4 lg:flex-col lg:items-start">
          <img
            class="size-16 shrink-0"
            src="/static/rauto-icon.svg"
            alt=""
            aria-hidden="true"
          />
          <div class="min-w-0">
            <h1 class="text-3xl font-semibold">{webAuthDisplay.loginTitle}</h1>
            <p class="mt-1 text-sm text-muted-foreground">
              {webAuthDisplay.loginDescription}
            </p>
          </div>
        </div>

        <div class="hidden items-center lg:flex" aria-hidden="true">
          <div
            class="flex size-12 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary"
          >
            <NetworkIcon class="size-5" />
          </div>
          <div class="h-px min-w-8 flex-1 bg-border"></div>
          <div
            class="flex size-12 shrink-0 items-center justify-center rounded-lg border border-border bg-card/70 text-muted-foreground"
          >
            <TerminalIcon class="size-5" />
          </div>
          <div class="h-px min-w-8 flex-1 bg-border"></div>
          <div
            class="flex size-12 shrink-0 items-center justify-center rounded-lg border border-border bg-card/70 text-muted-foreground"
          >
            <ServerIcon class="size-5" />
          </div>
        </div>

        <div class="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheckIcon class="size-4" aria-hidden="true" />
          <span>rauto Web</span>
        </div>
      </section>

      <section class="flex items-center bg-card">
        <div class="w-full px-7 py-9 sm:px-10 lg:px-14 lg:py-12">
          <Card.Header class="px-0">
            <div
              class="mb-3 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary"
              aria-hidden="true"
            >
              <LockKeyholeIcon class="size-5" />
            </div>
            <Card.Title>
              <h2 class="text-xl font-semibold">
                {webAuthDisplay.loginFormTitle}
              </h2>
            </Card.Title>
            <Card.Description class="mt-1 leading-6">
              {webAuthDisplay.loginFormDescription}
            </Card.Description>
          </Card.Header>
          <Card.Content class="mt-8 px-0">
            <form class="flex flex-col gap-5" onsubmit={webLoginSubmit}>
              <div
                class="flex flex-col gap-2"
                data-invalid={webAuthDisplay.errorMessage ? "" : undefined}
              >
                <Label for="rauto-web-password" class="font-medium">
                  {webAuthDisplay.passwordLabel}
                </Label>
                <div class="relative">
                  <LockKeyholeIcon
                    class="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    id="rauto-web-password"
                    class="h-11 pl-10"
                    type="password"
                    autocomplete="current-password"
                    autocapitalize="none"
                    spellcheck="false"
                    placeholder={webAuthDisplay.passwordPlaceholder}
                    value={$webPasswordStateStore}
                    aria-invalid={!!webAuthDisplay.errorMessage}
                    oninput={webPasswordInput}
                  />
                </div>
              </div>
              {#if webAuthDisplay.errorMessage}
                <Alert.Root
                  class="items-center"
                  variant="destructive"
                  aria-live="polite"
                >
                  <Alert.Description>
                    {webAuthDisplay.errorMessage}
                  </Alert.Description>
                </Alert.Root>
              {/if}
              <Button
                class="mt-1 w-full"
                size="lg"
                type="submit"
                disabled={webAuthDisplay.busy}
              >
                {#if webAuthDisplay.busy}
                  <Spinner data-icon="inline-start" />
                {:else}
                  <LogInIcon data-icon="inline-start" />
                {/if}
                {webAuthDisplay.loginButtonLabel}
              </Button>
            </form>
          </Card.Content>
        </div>
      </section>
    </Card.Root>
  </main>
{:else if webAuthDisplay.showError}
  <main class="min-h-screen bg-background p-6 text-foreground">
    <Card.Root class="mx-auto max-w-2xl">
      <Card.Header class="">
        <Card.Title>{bootstrapDisplay.loadFailedTitle}</Card.Title>
        <Card.Description>{webAuthDisplay.errorMessage}</Card.Description>
      </Card.Header>
      <Card.Footer class="">
        <Button size="sm" variant="outline" onclick={refreshWebAuth}>
          {webAuthDisplay.retryButtonLabel}
        </Button>
      </Card.Footer>
    </Card.Root>
  </main>
{:else if !webAuthDisplay.authenticated}
  <main class="min-h-screen bg-background p-6 text-foreground">
    <section class="mx-auto max-w-6xl">
      {@render loadingSkeleton()}
    </section>
  </main>
{:else if bootstrapDisplay.showError}
  <main class="min-h-screen bg-background p-6 text-foreground">
    <Card.Root class="mx-auto max-w-2xl">
      <Card.Header class="">
        <Card.Title>{bootstrapDisplay.loadFailedTitle}</Card.Title>
        <Card.Description>{bootstrapDisplay.errorMessage}</Card.Description>
      </Card.Header>
      <Card.Footer class="">
        <Button href="/app" size="sm" variant="outline">
          {bootstrapDisplay.reloadButtonLabel}
        </Button>
      </Card.Footer>
    </Card.Root>
  </main>
{:else if bodyLoadError}
  <main class="min-h-screen bg-background p-6 text-foreground">
    <Card.Root class="mx-auto max-w-2xl">
      <Card.Header class="">
        <Card.Title>{bootstrapDisplay.loadFailedTitle}</Card.Title>
        <Card.Description>{bodyLoadError}</Card.Description>
      </Card.Header>
      <Card.Footer class="">
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
