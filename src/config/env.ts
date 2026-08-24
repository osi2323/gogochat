type EnvConfig = {
  apiBaseUrl: string;
  apiTimeoutMs: number;
  authCookieName: string;
  tenantId: string;
};

const DEFAULT_TIMEOUT_MS = 10_000;

const serverApiBaseUrl =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:4000/api";

const clientApiBaseUrl =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

// Docker ortamında INTERNAL_API_URL ile backend servis adı kullanılabilir.
const apiBaseUrl =
  typeof window === "undefined"
    ? serverApiBaseUrl
    : clientApiBaseUrl;

const apiTimeout =
  process.env.NEXT_PUBLIC_API_TIMEOUT || DEFAULT_TIMEOUT_MS.toString();

const authCookieName = process.env.NEXT_PUBLIC_AUTH_COOKIE || "auth_token";

export const env: EnvConfig = {
  apiBaseUrl,
  apiTimeoutMs: Number(apiTimeout) || DEFAULT_TIMEOUT_MS,
  authCookieName,
  tenantId: process.env.NEXT_PUBLIC_TENANT_ID || "master",
};

export const isApiConfigured = () => env.apiBaseUrl.trim().length > 0;
