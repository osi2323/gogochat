import { cookies, headers } from "next/headers";
import type { AxiosInstance, CreateAxiosDefaults } from "axios";

import { env } from "@/config/env";
import { createApiClient } from "./createApiClient";

export type ServerApiClientOptions = {
  token?: string;
  baseURL?: string;
  cookieName?: string;
  forwardHeaders?: string[];
  extraHeaders?: Record<string, string>;
  configOverrides?: CreateAxiosDefaults;
};

const DEFAULT_FORWARDED_HEADERS = ["accept-language", "user-agent"];

export const getServerApiClient = async (
  options: ServerApiClientOptions = {}
): Promise<AxiosInstance> => {
  const forwardedHeaders = await collectForwardedHeaders(
    options.forwardHeaders ?? DEFAULT_FORWARDED_HEADERS
  );

  return createApiClient({
    baseURL: options.baseURL,
    extraHeaders: {
      ...forwardedHeaders,
      ...options.extraHeaders,
    },
    configOverrides: options.configOverrides,
    getAuthToken: async () => {
      if (options.token) {
        return options.token;
      }

      const cookieName = options.cookieName ?? env.authCookieName;
      const cookieStore = await cookies();
      const tokenFromCookie = cookieStore.get(cookieName)?.value;
      return tokenFromCookie ?? undefined;
    },
  });
};

const collectForwardedHeaders = async (headerKeys: string[]) => {
  const headerStore = await headers();

  return headerKeys.reduce<Record<string, string>>((acc, key) => {
    const value = headerStore.get(key);
    if (value) {
      acc[key] = value;
    }

    return acc;
  }, {});
};
