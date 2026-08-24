import { env } from "@/config/env";

const getApiOrigin = () => {
  const baseUrl = env.apiBaseUrl.trim();
  if (!baseUrl) return "";

  try {
    return new URL(baseUrl).origin;
  } catch {
    return "";
  }
};

export const resolveMediaUrl = (value?: string | null): string | null => {
  const normalized = (value || "").trim();
  if (!normalized) return null;

  if (
    normalized.startsWith("data:") ||
    normalized.startsWith("http://") ||
    normalized.startsWith("https://")
  ) {
    return normalized;
  }

  const apiOrigin = getApiOrigin();
  if (normalized.startsWith("/uploads/")) {
    return apiOrigin ? `${apiOrigin}${normalized}` : normalized;
  }

  if (normalized.startsWith("uploads/")) {
    return apiOrigin ? `${apiOrigin}/${normalized}` : `/${normalized}`;
  }

  return normalized;
};
