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
import type {
  ConnectionHistoryItem,
  ConnectionImportReport,
  SavedConnection,
  SavedConnectionDetail,
} from "../model/types.js";

export type ConnectionRequestPayload = Record<string, unknown>;

export const connectionApi = {
  deleteConnection(name: string): Promise<unknown> {
    return deleteConnectionRequest(name);
  },
  deleteHistory(name: string, historyId: string | number): Promise<unknown> {
    return deleteConnectionHistoryRequest(name, historyId);
  },
  detectFacts(
    payload: ConnectionRequestPayload,
  ): Promise<Record<string, unknown>> {
    return detectConnectionFactsRequest(payload);
  },
  downloadImportTemplate(
    language: string,
  ): Promise<{ blob: Blob; filename?: string }> {
    return downloadConnectionImportTemplateRequest(language);
  },
  getConnection(name: string): Promise<SavedConnectionDetail> {
    return getConnectionRequest(name);
  },
  getHistoryDetail(
    name: string,
    historyId: string | number,
  ): Promise<Record<string, unknown>> {
    return getConnectionHistoryDetailRequest(name, historyId);
  },
  importConnections(file: File): Promise<ConnectionImportReport> {
    return importConnectionsRequest(file);
  },
  listConnections(): Promise<SavedConnection[]> {
    return listConnectionsRequest();
  },
  listHistory(name: string, limit: number): Promise<ConnectionHistoryItem[]> {
    return listConnectionHistoryRequest(name, limit);
  },
  saveConnection(
    name: string,
    payload: ConnectionRequestPayload,
  ): Promise<SavedConnectionDetail> {
    return saveConnectionRequest(name, payload);
  },
  testConnection(
    payload: ConnectionRequestPayload,
  ): Promise<Record<string, unknown>> {
    return testConnectionRequest(payload);
  },
};
