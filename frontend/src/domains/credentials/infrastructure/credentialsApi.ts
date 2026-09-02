import {
  createCredential,
  deleteCredential,
  downloadCredentialImportTemplateBlob,
  getCredential,
  importCredentials,
  listCredentials,
  updateCredential,
} from "../../../api/client.js";
import type { CredentialsApi } from "../model/types.js";

export const credentialsApi: CredentialsApi = {
  createCredential,
  deleteCredential,
  downloadImportTemplate: downloadCredentialImportTemplateBlob,
  getCredential,
  importCredentials,
  listCredentials,
  updateCredential,
};
