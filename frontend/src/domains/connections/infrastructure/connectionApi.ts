import {
  deleteConnection as deleteConnectionRequest,
  deleteConnectionHistory as deleteConnectionHistoryRequest,
  detectConnectionFacts as detectConnectionFactsRequest,
  downloadConnectionImportTemplateBlob as downloadConnectionImportTemplateRequest,
  getConnection as getConnectionRequest,
  getConnectionHistoryDetail as getConnectionHistoryDetailRequest,
  importConnections as importConnectionsRequest,
  listConnectionHistory as listConnectionHistoryRequest,
  listConnections as listConnectionsRequest,
  saveConnection as saveConnectionRequest,
  testConnection as testConnectionRequest,
} from "../../../api/client.js";
import type { ConnectionRequestPayload } from "../model/types.js";

export type { ConnectionRequestPayload } from "../model/types.js";

export const connectionApi = {
  deleteConnection(name: string): Promise<unknown> {
    return deleteConnectionRequest(name);
  },
  deleteHistory(name: string, historyId: string | number): Promise<unknown> {
    return deleteConnectionHistoryRequest(name, historyId);
  },
  detectFacts(payload: ConnectionRequestPayload) {
    return detectConnectionFactsRequest(payload);
  },
  downloadImportTemplate(
    language: string,
  ): Promise<{ blob: Blob; filename?: string }> {
    return downloadConnectionImportTemplateRequest(language);
  },
  getConnection(name: string) {
    return getConnectionRequest(name);
  },
  getHistoryDetail(name: string, historyId: string | number) {
    return getConnectionHistoryDetailRequest(name, historyId);
  },
  importConnections(file: File) {
    return importConnectionsRequest(file);
  },
  listConnections() {
    return listConnectionsRequest();
  },
  listHistory(name: string, limit: number) {
    return listConnectionHistoryRequest(name, limit);
  },
  saveConnection(name: string, payload: ConnectionRequestPayload) {
    return saveConnectionRequest(name, payload);
  },
  testConnection(payload: ConnectionRequestPayload) {
    return testConnectionRequest(payload);
  },
};
