import { tr } from "../../../lib/i18n.js";
import type {
  CredentialOptionsDisplay,
  CredentialOptionsState,
  CredentialTranslate,
  CredentialsPageDisplay,
  CredentialsPageState,
} from "../model/types.js";

export function credentialsPagePresentation(
  state: CredentialsPageState,
): CredentialsPageDisplay {
  const query = state.searchQuery.trim().toLowerCase();
  return {
    ...state,
    filteredCredentials: state.credentials.filter(
      (item) => !query || item.searchText.includes(query),
    ),
  };
}

export function credentialOptionsPresentation(
  state: CredentialOptionsState,
): CredentialOptionsDisplay {
  return {
    ...state,
    credentialOptionRows: [
      {
        optionLabel: tr("credentialRequired"),
        optionValue: "",
      },
      ...state.credentials.map((credential) => ({
        optionLabel: `${credential.name} · ${credential.username}`,
        optionValue: credential.id,
      })),
    ],
  };
}

export function credentialAuthTypeLabel(
  authType: string,
  translate: CredentialTranslate = tr,
): string {
  const key =
    {
      agent: "credentialAuthAgent",
      password: "credentialAuthPassword",
      private_key: "credentialAuthPrivateKey",
      private_key_file: "credentialAuthPrivateKeyFile",
    }[authType] || "credentialAuthPassword";
  return translate(key);
}
