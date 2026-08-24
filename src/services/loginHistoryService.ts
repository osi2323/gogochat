import { AxiosInstance } from "axios";

export interface LoginHistoryUser {
  id: number;
  username: string;
  password: string;
  gender: string;
  roleId: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface LoginHistoryRecord {
  id: number;
  user: LoginHistoryUser | null;
  userId: number | null;
  username: string;
  agentNickname?: string | null;
  role: string | null;
  starCount?: number | null;
  gender: "male" | "female" | null;
  loginDate: string;
  device: string | null;
  ipAddress: string | null;
  browser: string | null;
  createdAt: string;
}

export interface LoginLocationInfo {
  loginHistoryId: number;
  displayName: string;
  ipAddress: string;
  city: string;
  district: string;
  country: string;
  countryCode: string;
  isp: string;
}

export interface LoginIpIdentity {
  displayName: string;
  username: string;
  agentNickname: string | null;
  isGuest: boolean;
  role: string | null;
  lastLoginDate: string;
}

export interface LoginIpIdentityResponse {
  loginHistoryId: number;
  ipAddress: string;
  identities: LoginIpIdentity[];
}

export interface LoginHistoryResponse {
  items: LoginHistoryRecord[];
  total: number;
  page: number;
  limit: number;
  pageCount: number;
}

export const createLoginHistoryService = (client: AxiosInstance) => {
  return {
    /**
     * Fetch all login history records
     */
    getLoginHistory: async (
      page = 1,
      limit = 5
    ): Promise<LoginHistoryResponse> => {
      const response = await client.get<LoginHistoryResponse>(
        "/login-history",
        {
          params: { page, limit },
        }
      );
      return response.data;
    },
    getLocationByLoginHistoryId: async (
      id: number
    ): Promise<LoginLocationInfo> => {
      const response = await client.get<LoginLocationInfo>(
        `/login-history/${id}/location`
      );
      return response.data;
    },
    getIdentitiesByLoginHistoryId: async (
      id: number
    ): Promise<LoginIpIdentityResponse> => {
      const response = await client.get<LoginIpIdentityResponse>(
        `/login-history/${id}/identities`
      );
      return response.data;
    },
  };
};
