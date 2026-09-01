import {
  browserClearTimeout,
  browserSetTimeout,
} from "../../../lib/browser.js";
import { createLazyComponentRegistry } from "../../../lib/svelte.js";
import { dashboardDetailRendererDefinitions } from "$domains/dashboard/model/navigation.js";
import type {
  OverlayDetailRendererDefinitions,
  OverlayDetailRendererRegistry,
  OverlayOrchestrationDetailDisplay,
} from "../model/types.js";

export const overlayDetailRendererDefinitions =
  dashboardDetailRendererDefinitions as OverlayDetailRendererDefinitions;

export const overlayDetailRuntime = {
  clearTimeout(timer: number): void {
    browserClearTimeout(timer);
  },
  createRendererRegistry(
    definitions: OverlayDetailRendererDefinitions,
    errorMessage: () => string,
  ): OverlayDetailRendererRegistry {
    return createLazyComponentRegistry({
      errorMessage,
      resolveId: (id: string) => id,
      resolveLoad: (id: string) => definitions[id],
    }) as unknown as OverlayDetailRendererRegistry;
  },
  async loadOrchestrationDetailDisplay(): Promise<OverlayOrchestrationDetailDisplay> {
    const { orchestrationDetailDisplay } =
      await import("../../../modules/orchestration/orchestrationResultDetailState.js");
    return orchestrationDetailDisplay as OverlayOrchestrationDetailDisplay;
  },
  setTimeout(handler: () => void, delay: number): number {
    return browserSetTimeout(handler, delay);
  },
};
