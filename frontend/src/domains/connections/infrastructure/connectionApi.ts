import {
  deleteConnection as deleteConnectionRequest,
  deleteSessionHistory as deleteSessionHistoryRequest,
  detectConnectionFacts as detectConnectionFactsRequest,
  downloadConnectionImportTemplateBlob as downloadConnectionImportTemplateRequest,
  getConnection as getConnectionRequest,
  getSessionHistoryDetail as getSessionHistoryDetailRequest,
  importConnections as importConnectionsRequest,
  listSessionHistory as listSessionHistoryRequest,
  listSessionHistoryDevices as listSessionHistoryDevicesRequest,
  listConnections as listConnectionsRequest,
  saveConnection as saveConnectionRequest,
  testConnection as testConnectionRequest,
} from "../../../api/client.js";
import type {
  ConnectionHistoryTargetQuery,
  ConnectionRequestPayload,
} from "../model/types.js";

export type { ConnectionRequestPayload } from "../model/types.js";

export const connectionApi = {
  deleteConnection(name: string): Promise<unknown> {
    return deleteConnectionRequest(name);
  },
  deleteHistory(historyId: string | number): Promise<unknown> {
    return deleteSessionHistoryRequest(historyId);
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
  getHistoryDetail(historyId: string | number) {
    return getSessionHistoryDetailRequest(historyId);
  },
  importConnections(file: File) {
    return importConnectionsRequest(file);
  },
  listConnections() {
    return listConnectionsRequest();
  },
  listHistory(limit: number, target: ConnectionHistoryTargetQuery = {}) {
    return listSessionHistoryRequest(limit, target);
  },
  listHistoryDevices() {
    return listSessionHistoryDevicesRequest();
  },
  saveConnection(name: string, payload: ConnectionRequestPayload) {
    return saveConnectionRequest(name, payload);
  },
  testConnection(payload: ConnectionRequestPayload) {
    return testConnectionRequest(payload);
  },
};
