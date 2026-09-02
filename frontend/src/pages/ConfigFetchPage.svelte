<script lang="ts">
  import ConfigFetchWorkspace from "$domains/config-fetch/presentation/components/ConfigFetchWorkspace.svelte";

  let { active }: { active: boolean } = $props();
</script>

<ConfigFetchWorkspace {active} />
