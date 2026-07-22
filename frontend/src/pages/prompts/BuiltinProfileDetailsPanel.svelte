<script>
  import WorkflowIcon from "@lucide/svelte/icons/workflow";
  import BuiltinProfileDetectSection from "./BuiltinProfileDetectSection.svelte";
  import BuiltinProfileHooksSection from "./BuiltinProfileHooksSection.svelte";
  import BuiltinProfileOverviewSection from "./BuiltinProfileOverviewSection.svelte";
  import BuiltinProfileSimpleSections from "./BuiltinProfileSimpleSections.svelte";
  import BuiltinProfileStateListsSection from "./BuiltinProfileStateListsSection.svelte";
  let { profileDetail } = $props();
  let detailDisplay = $derived(profileDetail.detailDisplay);
</script>

<div class="grid min-w-0 gap-5 pt-5">
  <BuiltinProfileOverviewSection {profileDetail} />

  <BuiltinProfileDetectSection {profileDetail} />

  <section class="overflow-hidden rounded-lg border border-border bg-card/50">
    <header class="flex items-start gap-3 border-b border-border px-4 py-4">
      <div
        class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
      >
        <WorkflowIcon class="size-4" aria-hidden="true" />
      </div>
      <div class="min-w-0">
        <h3 class="text-sm font-semibold">
          {detailDisplay.configurationTitle}
        </h3>
        <p class="mt-1 text-xs leading-5 text-muted-foreground">
          {detailDisplay.configurationDescription}
        </p>
      </div>
    </header>

    <div
      class="grid lg:grid-cols-2 lg:[&>section:nth-child(odd)]:border-r lg:[&>section:nth-child(odd)]:border-border"
    >
      <BuiltinProfileSimpleSections {profileDetail} />
    </div>
    <div class="border-t border-border">
      <BuiltinProfileStateListsSection {profileDetail} />
    </div>
  </section>

  <BuiltinProfileHooksSection {profileDetail} />
</div>
