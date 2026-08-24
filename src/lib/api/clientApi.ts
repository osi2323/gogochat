import { createApiClient } from "./createApiClient";
import { createAuthService } from "@/services/authService";
import { env } from "@/config/env";

/**
 * Get auth token from localStorage or cookie
 * Priority: localStorage > cookie
 */
export const getClientAuthToken = (): string | undefined => {
  if (typeof window === "undefined") return undefined;

  // First, try to get token from localStorage
  const tokenFromStorage = localStorage.getItem("accessToken");
  if (tokenFromStorage) {
    return tokenFromStorage;
  }

  // Fallback to cookie
  const cookies = document.cookie.split(";");

  const authCookie = cookies.find((cookie) =>
    cookie.trim().startsWith(`${env.authCookieName}=`)
  );

  if (!authCookie) {
    return undefined;
  }

  const token = authCookie.split("=")[1];

  return token;
};

export const hasClientAuthToken = () => Boolean(getClientAuthToken());

export const clearClientAuthState = () => {
  if (typeof window === "undefined") return;

  localStorage.removeItem("accessToken");
  localStorage.removeItem("isGuest");
  localStorage.removeItem("guestUsername");
  localStorage.removeItem("guestGender");
  localStorage.removeItem("guestStatusModeId");
  localStorage.removeItem("guestStatusModeName");
  localStorage.removeItem("guestStatusModeExpiresAt");
  localStorage.removeItem("agentSession");
  localStorage.removeItem("agentNickname");
  localStorage.removeItem("username");
  localStorage.removeItem("userId");

  const expireCookie = (name: string) => {
    document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  };

  expireCookie(env.authCookieName);
  if (env.authCookieName !== "auth_token") {
    expireCookie("auth_token");
  }
};

/**
 * Client-side API client
 * This client is used in the browser and includes credentials (cookies)
 */
export const getClientApiClient = () => {
  return createApiClient({
    getAuthToken: getClientAuthToken,
    configOverrides: {
      withCredentials: true, // Send cookies with requests
    },
  });
};

export const getClientAuthService = () => {
  const client = getClientApiClient();
  return createAuthService(client);
};
