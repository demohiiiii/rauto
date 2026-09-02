import {
  createTemplateResource,
  deleteTemplateResource,
  getTemplateResource,
  listTemplateResource,
  updateTemplateResource,
} from "../../../api/client.js";
import type { TemplateResourceMeta } from "$domains/templates/index.js";

interface OrchestrationTemplateApi {
  createTemplateResource(
    basePath: string,
    name: string,
    content: string,
  ): Promise<unknown>;
  deleteTemplateResource(basePath: string, name: string): Promise<unknown>;
  getTemplateResource(basePath: string, name: string): Promise<unknown>;
  listTemplateResource(basePath: string): Promise<TemplateResourceMeta[]>;
  updateTemplateResource(
    basePath: string,
    name: string,
    content: string,
  ): Promise<unknown>;
}

export const orchestrationTemplateApi: OrchestrationTemplateApi = {
  createTemplateResource,
  deleteTemplateResource,
  getTemplateResource,
  listTemplateResource,
  updateTemplateResource,
};
