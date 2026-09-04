import test from "node:test";
import assert from "node:assert/strict";
import { get } from "svelte/store";

import {
  createCredentialCreateWorkspace,
  createCredentialImportWorkspace,
  createCredentialsPageWorkspace,
  credentialErrorMessage,
  credentialFormValidationMessage,
  credentialDeleteBlockedMessage,
  credentialImportFailureMessage,
  credentialImportReport,
  credentialRow,
  credentialSavePayload,
} from "../src/domains/credentials/index.js";
import type {
  CredentialApiRow,
  CredentialImportReport,
  CredentialRow,
  CredentialSavePayload,
} from "../src/domains/credentials/index.js";
import { loadI18nLanguage, setCurrentLanguage } from "../src/lib/i18n.js";

const messages = {
  credentialNameRequired: "name required",
  credentialNameInvalid: "name invalid",
  credentialUsernameRequired: "username required",
  credentialPasswordRequired: "password required",
  credentialPrivateKeyRequired: "private key required",
  credentialPrivateKeyPathRequired: "private key path required",
  requestFailed: "request failed",
};

const translate = (key: string): string =>
  messages[key as keyof typeof messages] || key;

function credentialApiRow(
  overrides: Partial<CredentialApiRow> = {},
): CredentialApiRow {
  return {
    auth_type: "password",
    connection_count: 0,
    enable_enabled: false,
    has_auth_secret: false,
    has_enable_password: false,
    has_passphrase: false,
    has_password: false,
    id: "credential-1",
    name: "ops",
    private_key_path: null,
    referencing_connections: [],
    username: "admin",
    ...overrides,
  };
}

test("credential state normalizes catalog rows and secret presence", () => {
  assert.deepEqual(
    credentialRow(
      credentialApiRow({
        id: "cred-1",
        name: "ops",
        username: "admin",
        has_password: true,
        has_enable_password: false,
        enable_enabled: true,
        connection_count: 3,
        referencing_connections: ["edge-2", "edge-1"],
      }),
    ),
    {
      id: "cred-1",
      name: "ops",
      username: "admin",
      authType: "password",
      hasAuthSecret: false,
      hasPassword: true,
      privateKeyPath: "",
      hasPassphrase: false,
      hasEnablePassword: false,
      enableEnabled: true,
      connectionCount: 3,
      referencingConnections: ["edge-1", "edge-2"],
      searchText: "ops admin password edge-1 edge-2",
    },
  );
});

test("credential import reports normalize counts and redact no data", () => {
  assert.deepEqual(
    credentialImportReport({
      file_name: "credentials.csv",
      total_rows: 3,
      imported: 2,
      created: 1,
      updated: 1,
      failed: 1,
      failures: [{ row: 4, name: "bad", message: "invalid value" }],
    }),
    {
      fileName: "credentials.csv",
      totalRows: 3,
      imported: 2,
      created: 1,
      updated: 1,
      failed: 1,
      failures: [{ row: 4, name: "bad", message: "invalid value" }],
    },
  );
});

test("credential import row errors are localized", () => {
  const importTranslate = (key: string): string => `translated:${key}`;
  assert.equal(
    credentialImportFailureMessage(
      { message: "login_secret is required for new credentials" },
      importTranslate,
    ),
    "translated:credentialImportSecretRequired",
  );
  assert.equal(
    credentialImportFailureMessage(
      {
        message:
          "row 2 cannot provide enable_secret when enable_enabled is false",
      },
      importTranslate,
    ),
    "translated:credentialImportEnableConflict",
  );
});

test("credential save payload sends a blank Enable secret as null", () => {
  assert.deepEqual(
    credentialSavePayload({
      name: " ops ",
      username: " admin ",
      password: "",
      enablePassword: "",
      enableEnabled: true,
    }),
    {
      name: "ops",
      username: "admin",
      auth_type: "password",
      password: null,
      private_key: null,
      private_key_path: null,
      passphrase: null,
      enable_password: null,
      enable_enabled: true,
    },
  );
});

test("credential delete message uses a comma separator in every language", async () => {
  try {
    await loadI18nLanguage("zh");
    assert.equal(
      credentialDeleteBlockedMessage(["edge-3", "edge-1", "edge-2"]),
      "该凭证仍被以下连接引用：edge-1, edge-2, edge-3",
    );

    await loadI18nLanguage("en");
    assert.equal(
      credentialDeleteBlockedMessage(["edge-3", "edge-1", "edge-2"]),
      "This credential is still referenced by: edge-1, edge-2, edge-3",
    );
  } finally {
    setCurrentLanguage("zh");
  }
});

test("credential form validates names and required create fields locally", () => {
  assert.equal(
    credentialFormValidationMessage(
      { name: "", username: "admin", password: "secret" },
      { translate },
    ),
    "name required",
  );
  assert.equal(
    credentialFormValidationMessage(
      { name: "bad name", username: "admin", password: "secret" },
      { translate },
    ),
    "name invalid",
  );
  assert.equal(
    credentialFormValidationMessage(
      { name: "valid_name", username: "", password: "secret" },
      { translate },
    ),
    "username required",
  );
  assert.equal(
    credentialFormValidationMessage(
      { name: "valid_name", username: "admin", password: "" },
      { translate },
    ),
    "password required",
  );
  assert.equal(
    credentialFormValidationMessage(
      { name: "valid_name", username: "admin", password: "" },
      { editing: true, translate },
    ),
    "",
  );
  assert.equal(
    credentialFormValidationMessage(
      {
        name: "key",
        username: "admin",
        authType: "private_key",
        privateKey: "",
      },
      { translate },
    ),
    "private key required",
  );
  assert.equal(
    credentialFormValidationMessage(
      {
        name: "agent",
        username: "admin",
        authType: "agent",
      },
      { translate },
    ),
    "",
  );
});

test("credential API validation errors are localized instead of leaking backend text", () => {
  assert.equal(
    credentialErrorMessage(
      new Error(
        "invalid device credential name '', use only letters/numbers/_/./-",
      ),
      translate,
    ),
    "name required",
  );
  assert.equal(
    credentialErrorMessage(
      new Error(
        "invalid device credential name 'bad name', use only letters/numbers/_/./-",
      ),
      translate,
    ),
    "name invalid",
  );
  assert.equal(
    credentialErrorMessage(
      new Error("device credential username is required"),
      translate,
    ),
    "username required",
  );
  assert.equal(
    credentialErrorMessage(new Error("login password is required"), translate),
    "password required",
  );
  assert.equal(
    credentialErrorMessage(new Error("network down"), translate),
    "network down",
  );
});

test("credentials page workspace loads once and selects the first credential", async () => {
  let listCalls = 0;
  let detailCalls = 0;
  const row = credentialApiRow();
  const workspace = createCredentialsPageWorkspace({
    api: {
      async getCredential(id) {
        detailCalls += 1;
        assert.equal(id, row.id);
        return row;
      },
      async listCredentials() {
        listCalls += 1;
        return [row];
      },
    },
  });

  await workspace.setPageContext({ active: false });
  await workspace.setPageContext({ active: true });
  await workspace.setPageContext({ active: true });

  assert.equal(listCalls, 1);
  assert.equal(detailCalls, 1);
  assert.equal(get(workspace.stateStore).selectedId, row.id);
  assert.equal(get(workspace.stateStore).form.username, "admin");
});

test("credentials page workspace creates a validated credential", async () => {
  const requests: CredentialSavePayload[] = [];
  const created = credentialApiRow({ id: "credential-created" });
  const workspace = createCredentialsPageWorkspace({
    api: {
      async createCredential(payload) {
        requests.push(payload);
        return created;
      },
      async getCredential() {
        return created;
      },
      async listCredentials() {
        return [created];
      },
    },
  });

  workspace.patchForm({
    name: " ops ",
    password: "secret",
    username: " admin ",
  });
  await workspace.save();

  assert.equal(requests.length, 1);
  assert.equal(requests[0].name, "ops");
  assert.equal(requests[0].username, "admin");
  assert.equal(requests[0].password, "secret");
  assert.equal(get(workspace.stateStore).selectedId, created.id);
  assert.equal(get(workspace.stateStore).status.tone, "success");
});

test("credential create workspace validates and publishes the created row", async () => {
  const createdRows: CredentialRow[] = [];
  let createCalls = 0;
  const workspace = createCredentialCreateWorkspace({
    api: {
      async createCredential(payload) {
        createCalls += 1;
        return credentialApiRow({
          auth_type: payload.auth_type,
          enable_enabled: payload.enable_enabled,
          id: "credential-1",
          name: payload.name,
          private_key_path: payload.private_key_path,
          username: payload.username,
        });
      },
    },
    onCreated(row) {
      createdRows.push(row);
    },
  });

  workspace.setOpen(true);
  await workspace.submit();
  assert.equal(createCalls, 0);
  assert.ok(get(workspace.stateStore).error);

  workspace.patchForm({ name: "ops", password: "secret", username: "admin" });
  await workspace.submit();
  assert.equal(createCalls, 1);
  assert.equal(createdRows[0].id, "credential-1");
  assert.equal(get(workspace.stateStore).open, false);
});

test("credential import workspace validates files and forwards reports", async () => {
  const reports: CredentialImportReport[] = [];
  let importCalls = 0;
  const workspace = createCredentialImportWorkspace({
    api: {
      async importCredentials(file) {
        importCalls += 1;
        assert.equal(file.name, "credentials.csv");
        return {
          created: 1,
          failed: 0,
          failures: [],
          file_name: file.name,
          imported: 1,
          total_rows: 1,
          updated: 0,
        };
      },
    },
    onImported(report) {
      reports.push(report);
    },
  });

  await workspace.submitImport();
  assert.equal(importCalls, 0);
  assert.ok(get(workspace.stateStore).error);

  workspace.selectFile(new File(["name,username"], "credentials.csv"));
  await workspace.submitImport();
  assert.equal(importCalls, 1);
  assert.equal(reports[0].imported, 1);
  assert.equal(get(workspace.stateStore).report?.fileName, "credentials.csv");
});
