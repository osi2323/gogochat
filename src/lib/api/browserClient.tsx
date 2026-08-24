'use client';

import type { AxiosInstance } from 'axios';

import { createApiClient } from './createApiClient';

export type BrowserApiClientOptions = {
  token?: string;
  baseURL?: string;
  storageKey?: string;
  extraHeaders?: Record<string, string>;
};

const DEFAULT_STORAGE_KEY = 'access_token';

export const getBrowserApiClient = (
  options: BrowserApiClientOptions = {},
): AxiosInstance => {
  return createApiClient({
    baseURL: options.baseURL,
    extraHeaders: options.extraHeaders,
    getAuthToken: () => {
      if (options.token) {
        return options.token;
      }

      if (typeof window === 'undefined') {
        return undefined;
      }

      const storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY;
      const storedToken = window.localStorage?.getItem(storageKey);
      return storedToken ?? undefined;
    },
  });
};
