interface OrchestrationDetailConfig {
  detailPayload: Record<string, unknown>;
  kind: "orchestrationDetail";
  title: string;
}

export const orchestrationDetailRuntime = {
  async openDetail(detailConfig: OrchestrationDetailConfig): Promise<void> {
    const { openDetailModal } = await import("$domains/overlays/index.js");
    openDetailModal("", detailConfig);
  },
};
