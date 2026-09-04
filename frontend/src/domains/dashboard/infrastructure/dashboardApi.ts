import {
  getAgentApiToken,
  getAgentInfo,
  logoutWeb,
  setAgentApiToken,
} from "../../../api/client.js";

export interface DashboardAgentInfo {
  managed?: boolean;
}

export const dashboardApi = {
  getAgentApiToken(): string {
    return getAgentApiToken();
  },
  getAgentInfo(): Promise<DashboardAgentInfo> {
    return getAgentInfo();
  },
  logoutWeb(): ReturnType<typeof logoutWeb> {
    return logoutWeb();
  },
  setAgentApiToken(token: string): void {
    setAgentApiToken(token);
  },
};
