<script>
  import BuiltinProfileDetectSection from "./BuiltinProfileDetectSection.svelte";
  import BuiltinProfileHooksSection from "./BuiltinProfileHooksSection.svelte";
  import BuiltinProfileOverviewSection from "./BuiltinProfileOverviewSection.svelte";
  import BuiltinProfileSimpleSections from "./BuiltinProfileSimpleSections.svelte";
  import BuiltinProfileStateListsSection from "./BuiltinProfileStateListsSection.svelte";
  let { profileDetail } = $props();
</script>

<div class="mt-2 grid gap-2">
  <BuiltinProfileOverviewSection {profileDetail} />

  <BuiltinProfileDetectSection {profileDetail} />

  <BuiltinProfileSimpleSections {profileDetail} />

  <BuiltinProfileStateListsSection {profileDetail} />

  <BuiltinProfileHooksSection {profileDetail} />
</div>
