import { diagnoseProfile } from "../../../api/client.js";

export const profileDiagnosticsApi = {
  diagnoseProfile: diagnoseProfile as (name: string) => Promise<unknown>,
};
