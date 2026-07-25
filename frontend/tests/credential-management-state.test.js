import test from "node:test";
import assert from "node:assert/strict";

import {
  credentialErrorMessage,
  credentialFormValidationMessage,
  credentialDeleteBlockedMessage,
  credentialImportFailureMessage,
  credentialImportReport,
  credentialRow,
  credentialSavePayload,
} from "../src/modules/credentials/credentialState.js";

const translate = (key) =>
  ({
    credentialNameRequired: "name required",
    credentialNameInvalid: "name invalid",
    credentialUsernameRequired: "username required",
    credentialPasswordRequired: "password required",
    requestFailed: "request failed",
  })[key] || key;

test("credential state normalizes catalog rows and secret presence", () => {
  assert.deepEqual(
    credentialRow({
      id: "cred-1",
      name: "ops",
      username: "admin",
      has_password: true,
      has_enable_password: false,
      enable_enabled: true,
      connection_count: 3,
      referencing_connections: ["edge-2", "edge-1"],
    }),
    {
      id: "cred-1",
      name: "ops",
      username: "admin",
      hasPassword: true,
      hasEnablePassword: false,
      enableEnabled: true,
      connectionCount: 3,
      referencingConnections: ["edge-1", "edge-2"],
      searchText: "ops admin edge-1 edge-2",
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
  const importTranslate = (key) => `translated:${key}`;
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
      password: null,
      enable_password: null,
      enable_enabled: true,
    },
  );
});

test("credential delete message lists referencing connections", () => {
  assert.equal(
    credentialDeleteBlockedMessage(["edge-2", "edge-1"]),
    "该凭证仍被以下连接引用：edge-1、edge-2",
  );
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
