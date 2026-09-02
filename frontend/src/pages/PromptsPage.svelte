<script lang="ts">
  import ProfilesWorkspace from "$domains/profiles/presentation/components/ProfilesWorkspace.svelte";

  let { active }: { active: boolean } = $props();
</script>

<ProfilesWorkspace {active} />
