import {
  createTemplateResource,
  deleteTemplateResource,
  getTemplateResource,
  listTemplateResource,
  updateTemplateResource,
} from "../../../api/client.js";

interface OrchestrationTemplateApi {
  createTemplateResource(
    basePath: string,
    name: string,
    content: string,
  ): Promise<unknown>;
  deleteTemplateResource(basePath: string, name: string): Promise<unknown>;
  getTemplateResource(basePath: string, name: string): Promise<unknown>;
  listTemplateResource(basePath: string): Promise<unknown>;
  updateTemplateResource(
    basePath: string,
    name: string,
    content: string,
  ): Promise<unknown>;
}

export const orchestrationTemplateApi = {
  createTemplateResource,
  deleteTemplateResource,
  getTemplateResource,
  listTemplateResource,
  updateTemplateResource,
} as unknown as OrchestrationTemplateApi;
