import {
  createTemplateResource,
  deleteTemplateResource,
  getTemplateResource,
  listTemplateResource,
  updateTemplateResource,
} from "../../../api/client.js";
import type {
  TemplateResourceDetail,
  TemplateResourceApiMeta,
} from "$domains/templates/index.js";

interface OrchestrationTemplateApi {
  createTemplateResource(
    basePath: string,
    name: string,
    content: string,
  ): Promise<TemplateResourceDetail>;
  deleteTemplateResource(basePath: string, name: string): Promise<object>;
  getTemplateResource(
    basePath: string,
    name: string,
  ): Promise<TemplateResourceDetail>;
  listTemplateResource(basePath: string): Promise<TemplateResourceApiMeta[]>;
  updateTemplateResource(
    basePath: string,
    name: string,
    content: string,
  ): Promise<TemplateResourceDetail>;
}

export const orchestrationTemplateApi: OrchestrationTemplateApi = {
  createTemplateResource,
  deleteTemplateResource,
  getTemplateResource,
  listTemplateResource,
  updateTemplateResource,
};
