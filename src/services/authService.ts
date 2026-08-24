import type { AxiosInstance } from "axios";
import {
  AuthResponse,
  CheckUsernamePayload,
  CheckUsernameResponse,
  GuestLoginPayload,
  GuestLoginResponse,
  LoginPayload,
  RegisterPayload,
  MeResponse,
} from "./auth.types";

export const createAuthService = (client: AxiosInstance) => ({
  checkUsername: async (
    payload: CheckUsernamePayload
  ): Promise<CheckUsernameResponse> => {
    const { data } = await client.get<CheckUsernameResponse>(
      "/auth/check-username",
      {
        params: payload,
      }
    );

    return data;
  },
  login: async (payload: LoginPayload): Promise<AuthResponse> => {
    const { data } = await client.post<AuthResponse>("/auth/login", payload);
    return data;
  },
  register: async (payload: RegisterPayload): Promise<AuthResponse> => {
    const { data } = await client.post<AuthResponse>("/auth/register", payload);
    return data;
  },
  guestLogin: async (payload: GuestLoginPayload): Promise<GuestLoginResponse> => {
    const { data } = await client.post<GuestLoginResponse>("/auth/guest", payload);
    return data;
  },
  me: async (): Promise<MeResponse> => {
    const { data } = await client.get<MeResponse>("/auth/me", {
      params: { _ts: Date.now() },
    });
    return data;
  },
});
