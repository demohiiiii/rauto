<script>
  import { profileDiagnoseBehavior } from "../actions/profileDiagnoseBehavior.js";
  import PromptBuiltinPanel from "../components/prompts/PromptBuiltinPanel.svelte";
  import PromptCustomPanel from "../components/prompts/PromptCustomPanel.svelte";
  import PromptDiagnosePanel from "../components/prompts/PromptDiagnosePanel.svelte";
  import PromptModeTabs from "../components/prompts/PromptModeTabs.svelte";
  import { dashboardView } from "../state/dashboardView.js";

  let { active = false } = $props();
</script>

<div
  id="panel-prompts"
  class="tab-panel"
  role="tabpanel"
  hidden={!active}
  use:profileDiagnoseBehavior
>
  <h2 id="prompt-mgr-title" class="text-xl font-semibold">
    Device Prompt Profiles
  </h2>
  <PromptModeTabs />
  <PromptBuiltinPanel active={$dashboardView.currentPromptMode === "view"} />
  <PromptCustomPanel active={$dashboardView.currentPromptMode === "edit"} />
  <PromptDiagnosePanel
    active={$dashboardView.currentPromptMode === "diagnose"}
  />
</div>
