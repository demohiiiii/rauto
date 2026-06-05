<script>
  import BatchShowExecuteFields from "../components/standard/BatchShowExecuteFields.svelte";
  import ShowExecuteFields from "../components/standard/ShowExecuteFields.svelte";

  let { active = false } = $props();
  let currentShowTab = $state("single");

  function selectShowTab(tab) {
    currentShowTab = tab === "batch" ? "batch" : "single";
    requestAnimationFrame(() => {
      window.loadShowObjects?.();
      window.loadBatchShowObjects?.();
    });
  }
</script>

<div id="panel-show" class="tab-panel" role="tabpanel" hidden={!active}>
  <h2 id="show-page-title" class="text-xl font-semibold">查询</h2>
  <div class="mt-3 grid gap-3">
    <div class="group-card">
      <div class="field-tools">
        <span id="show-page-card-title">查询</span>
      </div>
      <div class="group-body">
        <div class="tabs tabs-box w-fit" role="tablist" aria-label="Show tabs">
          <button
            id="show-tab-single"
            class="tab"
            class:tab-active={currentShowTab === "single"}
            type="button"
            role="tab"
            aria-selected={(currentShowTab === "single").toString()}
            onclick={() => selectShowTab("single")}
          >
            单个查询
          </button>
          <button
            id="show-tab-batch"
            class="tab"
            class:tab-active={currentShowTab === "batch"}
            type="button"
            role="tab"
            aria-selected={(currentShowTab === "batch").toString()}
            onclick={() => selectShowTab("batch")}
          >
            批量查询
          </button>
        </div>

        <div class="mt-3 grid gap-3">
          <ShowExecuteFields active={active && currentShowTab === "single"} />
          <BatchShowExecuteFields
            active={active && currentShowTab === "batch"}
          />
        </div>
      </div>
    </div>
  </div>
</div>
