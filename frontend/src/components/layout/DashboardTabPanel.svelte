<script>
  let { active, children } = $props();
</script>

<div class="tab-panel" role="tabpanel" hidden={!active}>
  {@render children()}
</div>
