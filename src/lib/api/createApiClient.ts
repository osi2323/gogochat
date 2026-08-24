import axios, { type AxiosInstance, type CreateAxiosDefaults } from "axios";

import { env } from "@/config/env";
import { toApiError } from "./errors";

export type CreateApiClientOptions = {
  baseURL?: string;
  getAuthToken?: () => string | undefined | Promise<string | undefined>;
  extraHeaders?: Record<string, string>;
  configOverrides?: CreateAxiosDefaults;
};

export const createApiClient = (
  options: CreateApiClientOptions = {}
): AxiosInstance => {
  const baseURL = options.baseURL ?? env.apiBaseUrl;

  if (!baseURL) {
    throw new Error(
      "API base URL is missing. Define NEXT_PUBLIC_API_URL or API_URL to continue."
    );
  }

  const instance = axios.create({
    baseURL,
    timeout: env.apiTimeoutMs,
    headers: {
      "Content-Type": "application/json",
      "x-tenant": env.tenantId,
      ...options.extraHeaders,
    },
    ...options.configOverrides,
  });

  instance.interceptors.request.use(async (config) => {
    if (options.getAuthToken) {
      const token = await options.getAuthToken();
      if (token) {
        config.headers = config.headers ?? {};
        config.headers.Authorization = `Bearer ${token}`;
      }
    }

    if (typeof window !== "undefined") {
      const agentNickname = (localStorage.getItem("agentNickname") || "").trim();
      const isAgentSession = localStorage.getItem("agentSession") === "true";
      if (agentNickname && isAgentSession) {
        config.headers = config.headers ?? {};
        config.headers["x-agent-nickname"] = encodeURIComponent(agentNickname);
      }
    }

    return config;
  });

  instance.interceptors.response.use(
    (response) => response,
    (error) => {
      return Promise.reject(toApiError(error));
    }
  );

  return instance;
};
