import { resolveMediaUrl } from "@/lib/mediaUrl";

const remoteMediaUrlPattern = /^https?:\/+/i;
const imageExtensionPattern = /\.(?:png|gif|jpe?g|webp|avif)$/i;

const normalizeRemoteMediaUrl = (value: string) => {
  if (!remoteMediaUrlPattern.test(value)) return null;
  return value
    .replace(/^http:\/(?!\/)/i, "http://")
    .replace(/^https:\/(?!\/)/i, "https://");
};

export const resolveAvatarUrl = (icon?: string | null): string | null => {
  const normalized = (icon || "").trim();
  if (!normalized) return null;

  if (normalized.startsWith("data:")) return normalized;

  const remoteUrl = normalizeRemoteMediaUrl(normalized);
  if (remoteUrl) return remoteUrl;

  if (normalized.startsWith("/") || normalized.startsWith("uploads/")) {
    return resolveMediaUrl(normalized);
  }

  const extension = imageExtensionPattern.test(normalized) ? "" : ".png";
  return `/avatarlar/${normalized}${extension}`;
};
