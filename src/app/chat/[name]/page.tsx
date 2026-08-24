"use client";

import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams } from "next/navigation";
import { io, Socket } from "socket.io-client";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { ChatInput } from "@/components/chat/ChatInput";
import {
  ChatSidebar,
  type FriendActivityEvent,
  type TenantJoinEffectEvent,
} from "@/components/chat/ChatSidebar";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { ChatContextMenu } from "@/components/chat/ChatContextMenu";
import { ChatRoomManageModal } from "@/components/chat/ChatRoomManageModal";
import { ConfirmationModal } from "@/components/chat/ConfirmationModal";
import { DirectMessagesModal } from "@/components/chat/DirectMessagesModal";
import { SettingsModal } from "@/components/chat/SettingsModal";
import { VoiceCallOverlay } from "@/components/chat/VoiceCallOverlay";
import {
  CallVoiceProvider,
  useCallVoice,
} from "@/contexts/CallVoiceContext";
import { VoiceChatProvider, useVoiceChat } from "@/contexts/VoiceChatContext";
import { apiClient } from "@/services/apiClient";
import type {
  LoginIpIdentityResponse,
  LoginLocationInfo,
} from "@/services/loginHistoryService";
import type {
  ChatPermissionsSettings,
  SystemResetPayload,
} from "@/services/systemSettingsService";
import type { CallHistoryRecord } from "@/services/callHistoryService";
import { AdminPanelModal } from "@/components/admin/AdminPanelModal";
import { getClientApiClient } from "@/lib/api/clientApi";
import { ApiError } from "@/lib/api/errors";
import { formatAgentDisplayName } from "@/lib/agentDisplay";
import { readChatPreferencesFromStorage } from "@/lib/chatPreferences";
import {
  Activity,
  Crown,
  Flame,
  ImageIcon,
  LockKeyhole,
  MessageSquare,
  Megaphone,
  Mic,
  MicOff,
  Power,
  Radio,
  RefreshCw,
  Settings,
  ShieldCheck,
  User,
  UsersRound,
  Volume2,
  X,
} from "lucide-react";
import {
  clearRoomNavigationIntent,
  getRoomNavigationIntent,
  setRoomNavigationIntent,
} from "@/lib/chatNavigation";
import { Room } from "@/services/roomService";
import { useRouter } from "next/navigation";
import { env } from "@/config/env";
import { resolveAvatarUrl } from "@/lib/avatarUrl";
import { toast } from "sonner";
import {
  hasEffectivePermission,
  PERMISSION_LABELS,
} from "@/lib/permissions";
import { playDirectMessageSound } from "@/lib/notificationSounds";
import {
  isJoinEffectId,
  joinEffectsById,
  type JoinEffectId,
} from "@/lib/joinEffects";
import "@/styles/join-effects.css";

const isTimeoutError = (error: unknown) =>
  error instanceof Error &&
  error.message.toLowerCase().includes("timeout");

const isLobbyRoomLike = (value?: string | null) => {
  const normalized = (value || "").trim().toLocaleLowerCase("tr-TR");
  return normalized === "lobby" || normalized === "lobi";
};

const ROOM_SOCKET_JOINED_EVENT = "kingmobile:room-socket-joined";
const VOICE_SEAT_FORCE_RELEASED_EVENT =
  "kingmobile:voice-seat-force-released";
const ROOM_USERS_SNAPSHOT_RETRY_DELAYS_MS = [0, 120, 350, 800];

type RoomSocketJoinedEventDetail = {
  room?: string | null;
};

type VoiceSeatForceReleasedEventDetail = {
  room?: string | null;
  username?: string | null;
};

const requestRoomUsersSnapshotBurst = (socket: Socket, room: string) => {
  if (!room.trim()) return;

  ROOM_USERS_SNAPSHOT_RETRY_DELAYS_MS.forEach((delay) => {
    window.setTimeout(() => {
      if (!socket.connected) return;
      socket.emit("room:getUsers", { room });
    }, delay);
  });
};

const withJoinFastFallback = async <T,>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T | null> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race<T | null>([
      promise,
      new Promise<null>((resolve) => {
        timeoutId = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

const isGuestSessionFromStorage = () => {
  if (typeof window === "undefined") return false;

  const guestUsername = (localStorage.getItem("guestUsername") || "").trim();
  return localStorage.getItem("isGuest") === "true" || !!guestUsername;
};

type ChatSiteTheme = "default" | "dark" | "ocean" | "rose" | "emerald";

const CHAT_SITE_THEME_VARS: Record<ChatSiteTheme, Record<string, string>> = {
  default: {
    "--chat-app-bg": "#ffffff",
    "--chat-sidebar-bg": "#dde3ea",
    "--chat-panel-bg": "#edf1f5",
    "--chat-panel-muted": "#e7ecf2",
    "--chat-card-bg": "#ffffff",
    "--chat-card-soft-bg": "#f8fafc",
    "--chat-border": "#b8c2cf",
    "--chat-header-bg": "#e1e7ee",
    "--chat-input-shell-bg": "#ffffff",
    "--chat-input-bg": "#f4f4f5",
    "--chat-text": "#18181b",
    "--chat-muted": "#52606f",
    "--chat-accent": "#2563eb",
    "--chat-accent-strong": "#1d4ed8",
    "--chat-accent-soft": "#dbeafe",
    "--chat-messages-bg": "transparent",
    "--chat-mobile-input-bg": "rgba(0,0,0,0.9)",
    "--chat-mobile-bubble-bg": "#1c1c1e",
    "--chat-mobile-bubble-text": "#ffffff",
    "--chat-message-desktop-bg": "#ffffff",
    "--chat-message-desktop-text": "#18181b",
    "--chat-message-desktop-border": "#c2ccd7",
    "--chat-mobile-control-frame": "rgba(255,255,255,0.18)",
    "--chat-mobile-control-bg": "rgba(0,0,0,0.76)",
    "--chat-mobile-control-ring": "rgba(253,230,138,0.1)",
    "--chat-mobile-control-text": "#ffffff",
  },
  dark: {
    "--chat-app-bg": "#070b16",
    "--chat-sidebar-bg": "#0b1020",
    "--chat-panel-bg": "#111827",
    "--chat-panel-muted": "#0f172a",
    "--chat-card-bg": "#151d2f",
    "--chat-card-soft-bg": "#101827",
    "--chat-border": "#263247",
    "--chat-header-bg": "#101827",
    "--chat-input-shell-bg": "#0b1020",
    "--chat-input-bg": "#151d2f",
    "--chat-text": "#f8fafc",
    "--chat-muted": "#a5b4c8",
    "--chat-accent": "#38bdf8",
    "--chat-accent-strong": "#0ea5e9",
    "--chat-accent-soft": "rgba(56,189,248,0.16)",
    "--chat-messages-bg": "transparent",
    "--chat-mobile-input-bg": "#07101f",
    "--chat-mobile-bubble-bg": "#1a2d42",
    "--chat-mobile-bubble-text": "#f8fafc",
    "--chat-message-desktop-bg": "rgba(21,29,47,0.94)",
    "--chat-message-desktop-text": "#f8fafc",
    "--chat-message-desktop-border": "#263247",
    "--chat-mobile-control-frame": "rgba(56,189,248,0.28)",
    "--chat-mobile-control-bg": "rgba(8,18,33,0.9)",
    "--chat-mobile-control-ring": "rgba(56,189,248,0.24)",
    "--chat-mobile-control-text": "#ffffff",
  },
  ocean: {
    "--chat-app-bg": "#e8f7fb",
    "--chat-sidebar-bg": "#d7f0f7",
    "--chat-panel-bg": "#eaf9fc",
    "--chat-panel-muted": "#dff4f8",
    "--chat-card-bg": "#ffffff",
    "--chat-card-soft-bg": "#f0fbfd",
    "--chat-border": "#75c7df",
    "--chat-header-bg": "#e0f2fe",
    "--chat-input-shell-bg": "#f2fbfd",
    "--chat-input-bg": "#ffffff",
    "--chat-text": "#0f172a",
    "--chat-muted": "#315d70",
    "--chat-accent": "#0891b2",
    "--chat-accent-strong": "#0e7490",
    "--chat-accent-soft": "#cffafe",
    "--chat-messages-bg": "transparent",
    "--chat-mobile-input-bg": "#06364a",
    "--chat-mobile-bubble-bg": "#0e7490",
    "--chat-mobile-bubble-text": "#ffffff",
    "--chat-message-desktop-bg": "#ffffff",
    "--chat-message-desktop-text": "#0f172a",
    "--chat-message-desktop-border": "#8ad2e5",
    "--chat-mobile-control-frame": "rgba(103,232,249,0.3)",
    "--chat-mobile-control-bg": "rgba(6,54,74,0.9)",
    "--chat-mobile-control-ring": "rgba(103,232,249,0.24)",
    "--chat-mobile-control-text": "#ffffff",
  },
  rose: {
    "--chat-app-bg": "#fff1f5",
    "--chat-sidebar-bg": "#ffe4ec",
    "--chat-panel-bg": "#fff1f5",
    "--chat-panel-muted": "#ffe4e6",
    "--chat-card-bg": "#ffffff",
    "--chat-card-soft-bg": "#fff7f9",
    "--chat-border": "#f3a7b4",
    "--chat-header-bg": "#ffe4ec",
    "--chat-input-shell-bg": "#fff7f9",
    "--chat-input-bg": "#ffffff",
    "--chat-text": "#1f1720",
    "--chat-muted": "#744050",
    "--chat-accent": "#e11d48",
    "--chat-accent-strong": "#be123c",
    "--chat-accent-soft": "#ffe4e6",
    "--chat-messages-bg": "transparent",
    "--chat-mobile-input-bg": "#4a1021",
    "--chat-mobile-bubble-bg": "#be123c",
    "--chat-mobile-bubble-text": "#ffffff",
    "--chat-message-desktop-bg": "#ffffff",
    "--chat-message-desktop-text": "#1f1720",
    "--chat-message-desktop-border": "#efafba",
    "--chat-mobile-control-frame": "rgba(251,113,133,0.32)",
    "--chat-mobile-control-bg": "rgba(74,16,33,0.9)",
    "--chat-mobile-control-ring": "rgba(251,113,133,0.26)",
    "--chat-mobile-control-text": "#ffffff",
  },
  emerald: {
    "--chat-app-bg": "#ecfdf5",
    "--chat-sidebar-bg": "#d9f7e9",
    "--chat-panel-bg": "#ecfdf5",
    "--chat-panel-muted": "#dff7ed",
    "--chat-card-bg": "#ffffff",
    "--chat-card-soft-bg": "#f3fcf7",
    "--chat-border": "#75d7ae",
    "--chat-header-bg": "#dff7ed",
    "--chat-input-shell-bg": "#f3fcf7",
    "--chat-input-bg": "#ffffff",
    "--chat-text": "#102018",
    "--chat-muted": "#35634e",
    "--chat-accent": "#059669",
    "--chat-accent-strong": "#047857",
    "--chat-accent-soft": "#d1fae5",
    "--chat-messages-bg": "transparent",
    "--chat-mobile-input-bg": "#073b2d",
    "--chat-mobile-bubble-bg": "#0f766e",
    "--chat-mobile-bubble-text": "#ffffff",
    "--chat-message-desktop-bg": "#ffffff",
    "--chat-message-desktop-text": "#102018",
    "--chat-message-desktop-border": "#83ddb9",
    "--chat-mobile-control-frame": "rgba(52,211,153,0.32)",
    "--chat-mobile-control-bg": "rgba(7,59,45,0.9)",
    "--chat-mobile-control-ring": "rgba(52,211,153,0.24)",
    "--chat-mobile-control-text": "#ffffff",
  },
};

const normalizeChatSiteTheme = (value: unknown): ChatSiteTheme => {
  if (
    value === "dark" ||
    value === "ocean" ||
    value === "rose" ||
    value === "emerald"
  ) {
    return value;
  }
  if (value === "blue") return "ocean";
  return "dark";
};

const readStoredChatSiteTheme = (): ChatSiteTheme => {
  if (typeof window === "undefined") return "dark";
  const stored = localStorage.getItem("chatSiteTheme");
  return normalizeChatSiteTheme(stored);
};

const resolveCurrentDeviceType = () => {
  if (typeof window === "undefined") return "desktop";
  const userAgent = navigator.userAgent || "";
  const maxTouchPoints = navigator.maxTouchPoints || 0;
  const isMobile =
    /Mobi|Android|iPhone|iPod|Windows Phone/i.test(userAgent) ||
    (/iPad|Macintosh/i.test(userAgent) && maxTouchPoints > 1);

  return isMobile ? "mobile" : "desktop";
};

type RoomUser = {
  id: string;
  username: string;
  loginHistoryId?: number | null;
  displayUsername?: string;
  gender: "male" | "female";
  isGuest: boolean;
  guest?: boolean;
  guestAlias?: string | null;
  guestAliasReleased?: boolean | null;
  statusModeName?: string | null;
  statusModeId?: number | null;
  statusMode?: {
    id?: number | null;
    name?: string | null;
  } | null;
  isInVoiceChat?: boolean;
  isMuted?: boolean;
  isInVoiceSeat?: boolean;
  voiceSeatJoinedAt?: number | null;
  voiceSeatIndex?: number | null;
  isCameraOn?: boolean;
  frame?: string | null;
  icon?: string | null;
  deviceType?: string | null;
  device?: string | null;
  clientType?: string | null;
  isBot?: boolean;
  isHandRaised?: boolean;
  handRaised?: boolean;
  handRaisedAt?: number | null;
  agentNickname?: string | null;
  roleName?: string | null;
  role_title?: string | null;
  role?: {
    name?: string | null;
    icon?: string | null;
    starColor?: string | null;
    starCount?: number | null;
  } | null;
  role_data?: Record<string, unknown> | null;
  roleIcon?: string | null;
  roleStarColor?: string | null;
  roleStarCount?: number | null;
  fontName?: string | null;
  granite?: string | null;
  nickColor?: string | null;
  userGif?: string | null;
  flashNick?: string | null;
  joinEffect?: JoinEffectId | null;
  micBanned?: boolean;
  micBannedByStarCount?: number | null;
  cameraBanned?: boolean;
  cameraBannedByStarCount?: number | null;
  roomMuted?: boolean;
  roomMutedByStarCount?: number | null;
  globalMuted?: boolean;
  globalMutedByStarCount?: number | null;
  rooms?: Array<{ roomKey: string; roomName: string }>;
};

type JoinRoomErrorData =
  | string
  | {
      message?: string;
      detail?: string;
      countdownSeconds?: number;
      remainingDurationMs?: number;
      requiredMinStar?: number | string | null;
    }
  | null
  | undefined;

type JoinRoomAck = {
  success?: boolean;
  status?: "ok" | "error" | string;
  room?: string;
  message?: string;
  detail?: string;
  countdownSeconds?: number;
  remainingDurationMs?: number;
  requiredMinStar?: number | string | null;
};

type SystemResetStartData = Partial<SystemResetPayload>;

type JoinEffectEventPayload = {
  room: string;
  socketId?: string;
  username: string;
  displayUsername?: string | null;
  loginHistoryId?: number | null;
  gender: "male" | "female";
  isGuest: boolean;
  isBot?: boolean;
  statusModeId?: number | null;
  statusModeName?: string | null;
  icon?: string | null;
  deviceType?: string | null;
  device?: string | null;
  clientType?: string | null;
  roleIcon?: string | null;
  roleStarColor?: string | null;
  roleStarCount?: number | null;
  roleName?: string | null;
  role_title?: string | null;
  role_data?: Record<string, unknown> | null;
  agentNickname?: string | null;
  entryType?: "site" | "room";
  joinEffect?: string | null;
  welcomeMessageContent?: string | null;
};

const isJoinEffectClientDebugEnabled = () =>
  typeof window !== "undefined" &&
  localStorage.getItem("joinEffectDebug") === "true";

const logJoinEffectClientDebug = (
  event: string,
  payload: Record<string, unknown>,
) => {
  if (!isJoinEffectClientDebugEnabled()) return;
  console.log(`[JOIN_EFFECT_CLIENT] ${event}`, payload);
};

const mobileStaticJoinEffectGifIds = new Set<JoinEffectId>([
  "gif-effect-3",
  "gif-effect-4",
  "gif-effect-dplpd",
]);

type ModerationBanEvent = {
  userId?: number | string | null;
  user_id?: number | string | null;
  user?: {
    id?: number | string | null;
    username?: string | null;
  } | null;
  username?: string | null;
  user_name?: string | null;
  bannedBy?: string | null;
  bannedByUsername?: string | null;
  bannedById?: number | string | null;
  banned_by?: string | null;
  banned_by_id?: number | string | null;
  reason?: string | null;
  expiresAt?: string | null;
  expires_at?: string | null;
  createdAt?: string | null;
  created_at?: string | null;
  isGuest?: boolean;
  guest?: boolean;
};

type RoleSnapshot = {
  roleName?: string | null;
  roleIcon?: string | null;
  roleStarColor?: string | null;
  roleStarCount?: number | null;
};

const ROOM_USER_PRESENCE_GRACE_MS = 6000;

type StatusModeOption = {
  id: number;
  name: string;
};

const parseStoredStatusId = (value: string | null): number | null => {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeStatusModeOptions = (value: unknown): StatusModeOption[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const id = Number((item as { id?: unknown })?.id);
      const name = (item as { name?: unknown })?.name;
      if (!Number.isFinite(id) || typeof name !== "string" || !name.trim()) {
        return null;
      }
      return { id, name: name.trim() };
    })
    .filter((item): item is StatusModeOption => item !== null);
};

type CallPeer = {
  username: string;
  icon?: string | null;
  gender?: string | null;
  roleName?: string | null;
  isGuest?: boolean;
};

type CallType = "voice" | "video";
type CommunicationPermissions = {
  guestCanWrite: boolean;
  memberAndGuestMicDurationSeconds: number;
  membersPrivateMessageEnabled: boolean;
  membersVoiceCallEnabled: boolean;
  guestPrivateMessageEnabled: boolean;
  guestVoiceCallEnabled: boolean;
  showMicrophonesOnMobile: boolean;
};

type VoiceCallUser = {
  username: string;
  displayUsername?: string;
  icon?: string | null;
  gender?: string | null;
  roleName?: string | null;
  agentNickname?: string | null;
  isGuest?: boolean;
};

type CallState =
  | { status: "idle" }
  | {
      status: "outgoing";
      callType: CallType;
      callId: string;
      target: CallPeer;
      startedAt: number;
      expiresAt: number;
    }
  | {
      status: "incoming";
      callType: CallType;
      callId: string;
      from: CallPeer;
      startedAt: number;
      expiresAt: number;
    }
  | {
      status: "active";
      callType: CallType;
      callId: string;
      peer: CallPeer;
      connectedAt: number;
      direction: "incoming" | "outgoing";
    };

type CallHistoryEntry = {
  id: number;
  callId: string;
  peerName: string;
  direction: "incoming" | "outgoing";
  status: "missed" | "completed" | "rejected" | "canceled";
  startedAt: number;
  endedAt?: number;
  durationSec?: number;
};

type ReplyToMessage = {
  id: number;
  content: string;
  username: string;
  createdAt: string;
};

type Message = {
  id?: number; // API'den gelen gerçek mesaj ID'si (reply için)
  room: string;
  username: string;
  originalUsername?: string;
  profileUsername?: string;
  message: string;
  gender: "male" | "female";
  isGuest: boolean;
  timestamp: string;
  isSystemMessage?: boolean; // Sistem mesajları için flag
  systemStyle?: "default" | "announcement";
  isClickable?: boolean; // Tıklanabilir sistem mesajları için flag
  isExitMessage?: boolean; // Mikrofon sırasından çıkış mesajları için
  isRoomDescription?: boolean; // Oda açıklaması mesajları için flag
  image?: string; // Resim mesajları için
  audio?: string; // Ses dosyaları için
  audioFileName?: string; // Ses dosyası adı için
  videoUrl?: string; // YouTube video URL'i için
  videoTitle?: string; // YouTube video başlığı için
  videoThumbnail?: string; // YouTube video thumbnail'i için
  videoId?: string; // YouTube video ID'si için
  replyToMessage?: ReplyToMessage | null; // Yanıtlanan mesaj bilgisi
  avatar?: string | null; // Kullanıcı avatarı
  fontColor?: string | null; // Mesaj yazı rengi
  targetGroup?: "everyone" | "members" | "staff" | null; // Hedef kitle
  roleStarCount?: number | null;
  isBot?: boolean;
  botId?: number | null;
  botSpeakerUsername?: string | null;
  botSpeakerDisplayName?: string | null;
  loginHistoryId?: number | null;
  loginTargetStarCount?: number | null;
  systemAction?: "exitRoof" | "sendWelcomeMessage";
  flashNick?: string | null;
  fontName?: string | null;
  granite?: string | null;
  userGif?: string | null;
  nickColor?: string | null;
  welcomeTargetUsername?: string | null;
  welcomeTargetDisplayName?: string | null;
  welcomeMessageContent?: string | null;
  welcomePromptKey?: string | null;
  isWelcomeMessage?: boolean;
  isAiWelcomeMessage?: boolean;
};

const createRoomDescriptionMessage = (
  room: string,
  message: string,
): Message => ({
  room,
  username: "Sistem",
  message,
  gender: "male",
  isGuest: false,
  timestamp: new Date().toISOString(),
  isSystemMessage: true,
  isClickable: false,
  isRoomDescription: true,
});

const pinRoomDescriptionMessage = (
  messages: Message[],
  roomDescriptionMessages: Message[] = [],
): Message[] => {
  const pinnedDescription = [...roomDescriptionMessages, ...messages].find(
    (message) => message.isRoomDescription && message.message.trim(),
  );
  const regularMessages = messages.filter((message) => !message.isRoomDescription);

  if (!pinnedDescription) {
    return regularMessages;
  }

  return [
    {
      ...pinnedDescription,
      username: "Sistem",
      isSystemMessage: true,
      isClickable: false,
      isRoomDescription: true,
    },
    ...regularMessages,
  ];
};

type ImmediateSentMessage = {
  id: number;
  content: string;
  finalContent: string;
  username: string;
  originalUsername: string;
  displayUsername?: string;
  gender: "male" | "female";
  isGuest: boolean;
  createdAt: string;
  fontColor?: string | null;
  targetGroup?: "everyone" | "members" | "staff" | null;
  icon?: string | null;
  image?: string | null;
  audio?: string | null;
  audioFileName?: string | null;
  replyToMessage?: (ReplyToMessage & {
    user?: { username?: string | null } | null;
  }) | null;
  isWelcomeMessage?: boolean;
};

type ApiMessageRecord = {
  id?: number;
  content?: string | null;
  createdAt?: string | null;
  image?: string | null;
  audio?: string | null;
  audioFileName?: string | null;
  fontColor?: string | null;
  targetGroup?: "everyone" | "members" | "staff" | null;
  botId?: number | null;
  botUsername?: string | null;
  botSpeakerUsername?: string | null;
  botSpeakerDisplayName?: string | null;
  replyToMessage?: (ReplyToMessage & {
    user?: { username?: string | null } | null;
  }) | null;
  user?: {
    username?: string;
    displayUsername?: string;
    agentNickname?: string | null;
    isGuest?: boolean;
    role?: {
      starCount?: number | null;
    } | null;
    gender?: "male" | "female" | null;
    icon?: string | null;
    nickColor?: string | null;
    flashNick?: string | null;
    fontName?: string | null;
    granite?: string | null;
  } | null;
};

type JoinEffectBanner = {
  key: string;
  socketId?: string | null;
  username: string;
  loginHistoryId?: number | null;
  joinEffect: JoinEffectId;
  source?: "site" | "room";
  icon?: string | null;
  roleIcon?: string | null;
  roleStarColor?: string | null;
  roleStarCount?: number | null;
  roleName?: string | null;
  role_data?: Record<string, unknown> | null;
  agentNickname?: string | null;
  entryType?: "site" | "room";
};

type PendingTeleportToastPayload = {
  toRoom: string;
  byWhom: string;
  targetSlug?: string;
  createdAt?: number;
};

type PendingRoomAccessDeniedToastPayload = {
  fromRoom: string;
  targetSlug?: string;
  createdAt?: number;
};

const PENDING_TELEPORT_TOAST_KEY = "pendingTeleportToast";
const PENDING_ROOM_ACCESS_DENIED_TOAST_KEY = "pendingRoomAccessDeniedToast";

type BannerInspectModal =
  | { type: "location"; data: LoginLocationInfo }
  | { type: "identities"; data: LoginIpIdentityResponse };

const getJoinRoomErrorMessage = (data: JoinRoomErrorData): string => {
  const errorMessage =
    typeof data === "string"
      ? data
      : data?.message || "Odaya katılma hatası";

  if (errorMessage === "username_taken") {
    return "SEÇTİĞİNİZ RUMUZ BİR BAŞKASI TARAFINDAN SUAN KULLANILIYOR";
  }

  if (errorMessage === "minimum_star_required") {
    const requiredMinStar =
      typeof data === "string" ? 0 : Number(data?.requiredMinStar ?? 0);
    if (requiredMinStar > 0) {
      return `Bu odaya girmek için en az ${requiredMinStar} yıldız gerekir.`;
    }
  }

  if (errorMessage === "meeting_permission_required") {
    return "Toplantı odasına giriş yetkiniz yok.";
  }

  return (typeof data === "string" ? null : data?.detail) || errorMessage;
};

// Helper to calculate avatar URL - returns null if no custom icon (to show initials)
const calculateAvatar = (icon: string | null | undefined): string | null => {
  return resolveAvatarUrl(icon);
};

const resolveFrameUrl = (frame: string | null | undefined): string | null => {
  const trimmedFrame = frame?.trim();
  if (!trimmedFrame) return null;

  if (
    trimmedFrame.startsWith("/") ||
    trimmedFrame.startsWith("http://") ||
    trimmedFrame.startsWith("https://") ||
    trimmedFrame.startsWith("data:") ||
    trimmedFrame.startsWith("blob:")
  ) {
    return trimmedFrame.replace(/\.png$/i, ".gif");
  }

  return `/cerceveler/${trimmedFrame.replace(/\.(png|gif)$/i, "")}.gif`;
};

const resolveViewerAwareDisplayName = (
  user: {
    username?: string | null;
    displayUsername?: string | null;
    agentNickname?: string | null;
    roleStarCount?: number | null;
  },
  viewerStarCount: number,
): string => {
  const username = (user.username || "").trim();
  if (!username) {
    return (user.displayUsername || user.agentNickname || "").trim();
  }

  return formatAgentDisplayName(
    {
      username,
      displayUsername: user.displayUsername,
      agentNickname: user.agentNickname,
      roleStarCount: user.roleStarCount,
    },
    viewerStarCount,
  );
};

const resolveWelcomeTargetDisplayName = (user: {
  username?: string | null;
  displayUsername?: string | null;
  agentNickname?: string | null;
}): string => {
  const agentNickname = (user.agentNickname || "").trim();
  if (agentNickname) {
    return agentNickname;
  }

  return (user.displayUsername || user.username || "").trim();
};

const isSelfJoinLeaveSystemMessage = (
  messageText: string,
  currentUsername: string | null,
  currentAgentNickname: string | null,
): boolean => {
  const actor = getJoinLeaveActorFromMessage(messageText);

  if (!actor) return false;

  const normalizedActor = actor.toLocaleLowerCase("tr-TR");
  const candidates = [currentUsername, currentAgentNickname]
    .map((value) => (value || "").trim())
    .filter(Boolean)
    .map((value) => value.toLocaleLowerCase("tr-TR"));

  return candidates.includes(normalizedActor);
};

const getJoinLeaveActorFromMessage = (messageText: string): string => {
  const text = (messageText || "").trim();
  const joinMatch = text.match(/^(.*) odaya katıldı! 👋$/);
  const leaveMatch = text.match(/^(.*) siteden çıkış yaptı! 👋$/);
  const roofLeaveMatch = text.match(
    /^(.*) ➔ siteden çıkış yaptı \(çatıdaydı\)$/,
  );
  return (joinMatch?.[1] ?? leaveMatch?.[1] ?? roofLeaveMatch?.[1] ?? "").trim();
};

const isJoinLeaveSystemMessage = (messageText: string): boolean =>
  getJoinLeaveActorFromMessage(messageText).length > 0;

const normalizeTargetGroup = (
  targetGroup: unknown,
): Message["targetGroup"] => {
  if (
    targetGroup === "everyone" ||
    targetGroup === "members" ||
    targetGroup === "staff"
  ) {
    return targetGroup;
  }
  return null;
};

const normalizeMessageTimestamp = (value?: string | null): string => {
  const normalized = (value || "").trim();
  if (!normalized) {
    return new Date().toISOString();
  }

  if (/Z$/i.test(normalized)) {
    return normalized;
  }

  const wallClockMatch = normalized.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(?:[+-]\d{2}:\d{2})?$/,
  );
  if (wallClockMatch) {
    const [, year, month, day, hour, minute, second = "00", millisecond] =
      wallClockMatch;
    const normalizedMillisecond = (millisecond ?? "000").padEnd(3, "0");
    return `${year}-${month}-${day}T${hour}:${minute}:${second}.${normalizedMillisecond}Z`;
  }

  return normalized;
};

const areMessagesEquivalent = (left: Message, right: Message): boolean => {
  if (left.id != null && right.id != null) {
    return left.id === right.id;
  }

  const leftAuthor = left.originalUsername || left.username;
  const rightAuthor = right.originalUsername || right.username;
  if (leftAuthor !== rightAuthor) return false;
  if ((left.targetGroup ?? null) !== (right.targetGroup ?? null)) return false;
  if ((left.message || "").trim() !== (right.message || "").trim()) return false;
  if ((left.image ?? null) !== (right.image ?? null)) return false;
  if ((left.audio ?? null) !== (right.audio ?? null)) return false;
  if ((left.audioFileName ?? null) !== (right.audioFileName ?? null)) {
    return false;
  }
  if ((left.videoUrl ?? null) !== (right.videoUrl ?? null)) return false;

  const leftTimestamp = Date.parse(left.timestamp || "");
  const rightTimestamp = Date.parse(right.timestamp || "");
  if (!Number.isNaN(leftTimestamp) && !Number.isNaN(rightTimestamp)) {
    return Math.abs(leftTimestamp - rightTimestamp) <= 30000;
  }

  return true;
};

type AdminPanelView =
  | "main"
  | "generalSettings"
  | "sistem"
  | "loginHistory"
  | "rooms"
  | "staff"
  | "members"
  | "banned"
  | "roles"
  | "blockedWords"
  | "bots"
  | "forbiddenNicknames"
  | "statusModes"
  | "adminActions"
  | "radio"
  | "webConsole";

type SecuritySettings = {
  membersMicrophoneDisabled?: boolean;
  guestsWritingDisabled?: boolean;
  guestsMicrophoneDisabled?: boolean;
};

type RadioSettings = {
  id?: number;
  radioLink?: string | null;
  radioRequestLink?: string | null;
};

const clearAuthSession = () => {
  if (typeof window === "undefined") return;

  [
    "isGuest",
    "guestUsername",
    "guestGender",
    "guestStatusModeId",
    "guestStatusModeName",
    "guestStatusModeExpiresAt",
    "accessToken",
    "username",
    "userId",
    "roofStatus", // Çatı durumunu da temizle
    "agentNickname", // Ajan girişini de temizle
    "agentSession",
    "profileJoinEffect",
    "priorStatusModeId", // Önceki durum ID'sini temizle
    "priorStatusModeName", // Önceki durum ismini temizle
  ].forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore storage errors
    }
  });

  const expireCookie = (name: string) => {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
  };

  try {
    document.cookie.split(";").forEach((cookie) => {
      const eqPos = cookie.indexOf("=");
      const name = (eqPos > -1 ? cookie.slice(0, eqPos) : cookie).trim();
      if (name) {
        expireCookie(name);
      }
    });
  } catch {
    // Ignore cookie parsing errors
  }

  if (env.authCookieName) {
    expireCookie(env.authCookieName);
  }
  if (env.authCookieName !== "auth_token") {
    expireCookie("auth_token");
  }
};

const getGuestStatusFromStorage = (): string | null => {
  if (typeof window === "undefined") return null;
  const expiresAtRaw = localStorage.getItem("guestStatusModeExpiresAt");
  const expiresAt = expiresAtRaw ? Number(expiresAtRaw) : null;
  const isExpired =
    !expiresAt || Number.isNaN(expiresAt) ? true : Date.now() > expiresAt;

  if (isExpired) {
    localStorage.removeItem("guestStatusModeId");
    localStorage.removeItem("guestStatusModeName");
    localStorage.removeItem("guestStatusModeExpiresAt");
    return null;
  }

  const name = localStorage.getItem("guestStatusModeName");
  return name || null;
};

const personalRoomDesignImages = [
  "avatar.jpg",
  "kingmobile.png",
  "pexels-amed-zenger-315696382-13641990.jpg",
  "pexels-ellie-burgin-1661546-3362702.jpg",
  "pexels-umudicreative-17133047.jpg",
  "pexels-efrem-efre-2786187-29557632.jpg",
  "pexels-artosuraj-36286291.jpg",
  "pexels-onuryumlu-15795028.jpg",
  "pexels-njeromin-11830264.jpg",
  "456712280_17999227514656648_949295733479667370_n.jpg",
  "galatasaray.jpg",
  "fenerbahce.jpg",
];

const FALLBACK_CHAT_BACKGROUND = "/images/kingmobile.png";

// Inner component that uses VoiceChat context
function ChatPageContent({
  socket,
  roomName,
  roomId,
  roomUsers,
  setRoomUsers,
  messages,
  setMessages,
  joinError,
  currentUsername,
  userStarCount,
  currentUserRoleReady,
  currentUserRoleSnapshot,
  forbiddenWords,
  chatBackground,
  chatFontSize,
  chatFontColor,
  roomDetail,
  ownerAvatar,
  onToggleHand,
  isHandRaised,
  onGoMeetingRoom,
  canAccessMeetingRoom,
  firstMessageDelayRemaining,
  chatPermissions,
  communicationPermissions,
  currentUserPermissions,
  currentRolePermissions,
  micDisabled,
  micDisabledReason,
  micWaitRemainingSeconds,
  initialCameraBanned,
  writingDisabled,
  writingDisabledReason,
  radioLink,
  radioRequestLink,
  isOnRoof,
  currentUserIcon,
  currentUserGender,
  addSystemMessage,
  onMessageSent,
  onForbiddenWordsChange,
  onTriggerJoinEffect,
  activeJoinEffect,
  showJoinLeaveEventsEnabled,
  hideGeneralMessagesEnabled,
  disableJoinEffectsEnabled,
  isMobileJoinEffectMode,
  welcomeMessageTemplate,
}: {
  socket: Socket | null;
  roomName: string;
  roomId: string | null;
  roomUsers: RoomUser[];
  setRoomUsers: React.Dispatch<React.SetStateAction<RoomUser[]>>;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  joinError: string | null;
  currentUsername: string | null;
  userStarCount: number;
  currentUserRoleReady: boolean;
  currentUserRoleSnapshot: RoleSnapshot | null;
  forbiddenWords: Array<{
    forbiddenWord: string;
    replacementWord?: string | null;
  }>;
  chatBackground: string | null;
  chatFontSize: string;
  chatFontColor?: string | null;
  roomDetail?: Room | null;
  ownerAvatar?: string | null;
  onToggleHand: (next?: boolean) => void;
  isHandRaised: boolean;
  onGoMeetingRoom?: () => void;
  canAccessMeetingRoom: boolean;
  firstMessageDelayRemaining: number;
  chatPermissions: ChatPermissionsSettings | null;
  communicationPermissions: CommunicationPermissions | null;
  currentUserPermissions: string[];
  currentRolePermissions: Record<string, unknown> | null;
  micDisabled: boolean;
  micDisabledReason?: string | null;
  micWaitRemainingSeconds: number;
  initialCameraBanned: boolean;
  writingDisabled: boolean;
  writingDisabledReason?: string | null;
  radioLink: string | null;
  radioRequestLink: string | null;
  isOnRoof: boolean;
  currentUserIcon?: string | null;
  currentUserGender?: string | null;
  addSystemMessage: (
    message: string,
    room?: string,
    skipDuplicateCheck?: boolean,
    isClickable?: boolean,
    isRoomDescription?: boolean,
  ) => void;
  onMessageSent: (messageData: ImmediateSentMessage) => void;
  onForbiddenWordsChange: (
    words: Array<{
      forbiddenWord: string;
      replacementWord?: string | null;
    }>,
  ) => void;
  onTriggerJoinEffect: (
    banner: JoinEffectBanner,
    options?: { force?: boolean },
  ) => void;
  activeJoinEffect: JoinEffectBanner | null;
  showJoinLeaveEventsEnabled: boolean;
  hideGeneralMessagesEnabled: boolean;
  disableJoinEffectsEnabled: boolean;
  isMobileJoinEffectMode: boolean;
  welcomeMessageTemplate: string;
}) {
  const router = useRouter();

  const {
    syncWithRoomUsers,
    joinVoiceChat,
    leaveVoiceChat,
    isInVoiceChat,
    isMuted,
    micBanned,
    toggleMute,
    speakingUsers,
  } = useVoiceChat();
  const callVoice = useCallVoice();
  const joinCall = callVoice.joinCall;
  const leaveCall = callVoice.leaveCall;
  const callRemoteUsers = callVoice.remoteUsers;
  const localVideoTrack = callVoice.localVideoTrack;
  const chatBackgroundStyle: React.CSSProperties = chatBackground
    ? {
        backgroundColor: "#020612",
        backgroundImage: `url('${chatBackground}')`,
        backgroundPosition: "center center",
        backgroundRepeat: "no-repeat",
        backgroundSize: "cover",
      }
    : {
        backgroundColor: "#020612",
      };
  const mobileSoftButtonFrame =
    "border border-[var(--chat-mobile-control-frame)] bg-black/10 shadow-[0_6px_16px_rgba(0,0,0,0.22)] ring-1 ring-[var(--chat-mobile-control-ring)] backdrop-blur-md";
  const mobileSoftButtonInner =
    "flex h-full w-full items-center justify-center rounded-xl bg-[var(--chat-mobile-control-bg)] text-[var(--chat-mobile-control-text)] backdrop-blur-md";
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [adminInitialView, setAdminInitialView] =
    useState<AdminPanelView | null>(null);
  const [adminInitialRoomName, setAdminInitialRoomName] = useState<
    string | null
  >(null);
  const [showManageModal, setShowManageModal] = useState(false);
  const [showClearHistoryModal, setShowClearHistoryModal] = useState(false);
  const [showMobileSafeExitModal, setShowMobileSafeExitModal] = useState(false);
  const [mobileSafeExitClearDirect, setMobileSafeExitClearDirect] =
    useState(false);
  const [mobileSafeExitClearRoom, setMobileSafeExitClearRoom] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [activeMobileVoiceMenuUsername, setActiveMobileVoiceMenuUsername] =
    useState<string | null>(null);
  const [optimisticVoiceSeatJoinedAt, setOptimisticVoiceSeatJoinedAt] =
    useState<number | null>(null);
  const [optimisticVoiceSeatIndex, setOptimisticVoiceSeatIndex] = useState<
    number | null
  >(null);
  const [mobileSidebarTab, setMobileSidebarTab] = useState<
    "room" | "all" | "rooms" | "calls" | "friends" | "wall"
  >("room");

  useEffect(() => {
    const openFriends = () => {
      setCloseMobileSidebarOnProfileClose(false);
      setMobileInitialSelectedUser(null);
      setMobileSidebarTab("friends");
      setIsMobileSidebarOpen(true);
    };
    window.addEventListener("chatson:open-mobile-friends", openFriends);
    return () => window.removeEventListener("chatson:open-mobile-friends", openFriends);
  }, []);
  const [sidebarCounts, setSidebarCounts] = useState({
    roomUsersCount: 0,
    allUsersCount: 0,
  });
  const [showMobileMessages, setShowMobileMessages] = useState(false);
  const [showMobileSettings, setShowMobileSettings] = useState(false);
  const [chatSiteTheme, setChatSiteTheme] =
    useState<ChatSiteTheme>("dark");
  const [showMobileRoomDesignPicker, setShowMobileRoomDesignPicker] =
    useState(false);
  const [dmUnreadCount, setDmUnreadCount] = useState(0);
  const [pendingDmConversationCounts, setPendingDmConversationCounts] =
    useState<Record<number, number>>({});
  const pendingDmConversationCountsRef = useRef<Record<number, number>>({});
  const dmLocallyReadLastMessageIdsRef = useRef<Record<number, string>>({});
  const clearHistoryInProgressRef = useRef(false);
  const hasShownVoiceJoinedToastRef = useRef(false);
  const [replyTo, setReplyTo] = useState<{
    sender: string;
    content: string;
    messageId?: number;
  } | null>(null);

  const applyMobileRoomDesign = useCallback((path: string | null) => {
    if (typeof window === "undefined") return;

    if (path) {
      localStorage.setItem("chatBackground", path);
    } else {
      localStorage.removeItem("chatBackground");
    }

    window.dispatchEvent(
      new CustomEvent("chatBackgroundChanged", {
        detail: path,
      }),
    );
    setShowMobileRoomDesignPicker(false);
  }, []);

  useEffect(() => {
    setChatSiteTheme(readStoredChatSiteTheme());

    const handleChatSiteThemeChanged = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      setChatSiteTheme(normalizeChatSiteTheme(detail));
    };

    window.addEventListener(
      "chatSiteThemeChanged",
      handleChatSiteThemeChanged as EventListener,
    );
    return () => {
      window.removeEventListener(
        "chatSiteThemeChanged",
        handleChatSiteThemeChanged as EventListener,
      );
    };
  }, []);

  const [profileOpenRequest, setProfileOpenRequest] = useState<{
    username: string;
    id: number;
    fallbackUser?: RoomUser | null;
  } | null>(null);
  // Mobil için ayrı profil isteği — ana sidebar (gizli) temizlemeden önce yarış olmaz
  const [mobileProfileOpenRequest, setMobileProfileOpenRequest] = useState<{
    username: string;
    id: number;
    fallbackUser?: RoomUser | null;
  } | null>(null);
  // Mobil sidebar mount olduğunda profili anında açmak için — oda listesi flicker'ı olmaz
  const [mobileInitialSelectedUser, setMobileInitialSelectedUser] = useState<RoomUser | null>(null);
  const [closeMobileSidebarOnProfileClose, setCloseMobileSidebarOnProfileClose] =
    useState(false);

  const currentRoomUser = useMemo(() => {
    const normalizedCurrentUsername = (currentUsername || "")
      .trim()
      .toLocaleLowerCase("tr-TR");
    if (!normalizedCurrentUsername) return null;
    return (
      roomUsers.find(
        (roomUser) =>
          roomUser.username.trim().toLocaleLowerCase("tr-TR") ===
          normalizedCurrentUsername,
      ) ?? null
    );
  }, [roomUsers, currentUsername]);
  const currentAgentNickname = currentRoomUser?.agentNickname || null;
  const currentUserIsGuest =
    currentRoomUser?.isGuest === true || isGuestSessionFromStorage();
  const normalizedCurrentUsername = (currentUsername || "")
    .trim()
    .toLocaleLowerCase("tr-TR");
  const mobileVoiceUsers = useMemo(() => {
    const getSeatSortValue = (user: RoomUser) =>
      typeof user.voiceSeatIndex === "number"
        ? user.voiceSeatIndex
        : Number.MAX_SAFE_INTEGER;
    const getJoinedAtSortValue = (user: RoomUser) =>
      typeof user.voiceSeatJoinedAt === "number"
        ? user.voiceSeatJoinedAt
        : Number.MAX_SAFE_INTEGER;

    const seatedUsers = roomUsers.filter(
      (user) =>
        user.isInVoiceSeat === true &&
        user.isInVoiceChat === true &&
        user.statusModeName !== "Çatıda",
    );
    const seatedUsernames = new Set(
      seatedUsers.map((user) =>
        user.username.trim().toLocaleLowerCase("tr-TR"),
      ),
    );
    const openMicUsers = roomUsers.filter((user) => {
      const normalizedUsername = user.username.trim().toLocaleLowerCase("tr-TR");
      if (!normalizedUsername || seatedUsernames.has(normalizedUsername)) {
        return false;
      }
      return (
        user.isInVoiceChat === true &&
        user.statusModeName !== "Çatıda"
      );
    });

    const hasCurrentUserSeat = seatedUsers.some(
      (user) =>
        user.username.trim().toLocaleLowerCase("tr-TR") ===
        normalizedCurrentUsername,
    );
    const hasCurrentUserOpenMic =
      normalizedCurrentUsername.length > 0 &&
      openMicUsers.some(
        (user) =>
          user.username.trim().toLocaleLowerCase("tr-TR") ===
          normalizedCurrentUsername,
      );

    if (
      optimisticVoiceSeatJoinedAt !== null &&
      normalizedCurrentUsername &&
      !hasCurrentUserSeat &&
      !isOnRoof
    ) {
      const optimisticCurrentUser: RoomUser =
        currentRoomUser ?? {
          id: `current-${currentUsername || "user"}`,
          username: currentUsername || "",
          displayUsername: currentUsername || "",
          gender: currentUserGender === "female" ? "female" : "male",
          isGuest: currentUserIsGuest,
          icon: currentUserIcon ?? null,
        };

      seatedUsers.push({
        ...optimisticCurrentUser,
        isInVoiceChat: true,
        isInVoiceSeat: true,
        isMuted,
        voiceSeatJoinedAt: optimisticVoiceSeatJoinedAt,
        voiceSeatIndex: optimisticVoiceSeatIndex,
      });
      seatedUsernames.add(normalizedCurrentUsername);
    } else if (
      isInVoiceChat &&
      !isMuted &&
      normalizedCurrentUsername &&
      !hasCurrentUserSeat &&
      !hasCurrentUserOpenMic &&
      !isOnRoof
    ) {
      const openMicCurrentUser: RoomUser =
        currentRoomUser ?? {
          id: `current-${currentUsername || "user"}`,
          username: currentUsername || "",
          displayUsername: currentUsername || "",
          gender: currentUserGender === "female" ? "female" : "male",
          isGuest: currentUserIsGuest,
          icon: currentUserIcon ?? null,
        };

      openMicUsers.unshift({
        ...openMicCurrentUser,
        isInVoiceChat: true,
        isInVoiceSeat: false,
        isMuted: false,
        voiceSeatJoinedAt: null,
        voiceSeatIndex: null,
      });
    }

    const visibleOpenMicUsers = openMicUsers.filter(
      (user) =>
        !seatedUsernames.has(user.username.trim().toLocaleLowerCase("tr-TR")),
    );

    return [...seatedUsers, ...visibleOpenMicUsers]
      .sort((left, right) => {
        const seatDiff = getSeatSortValue(left) - getSeatSortValue(right);
        if (seatDiff !== 0) return seatDiff;
        const leftMuted = left.isMuted ? 1 : 0;
        const rightMuted = right.isMuted ? 1 : 0;
        if (leftMuted !== rightMuted) return leftMuted - rightMuted;
        return getJoinedAtSortValue(left) - getJoinedAtSortValue(right);
      })
      .slice(0, 5);
  }, [
    currentRoomUser,
    currentUserGender,
    currentUserIcon,
    currentUserIsGuest,
    currentUsername,
    isInVoiceChat,
    isMuted,
    isOnRoof,
    normalizedCurrentUsername,
    optimisticVoiceSeatJoinedAt,
    optimisticVoiceSeatIndex,
    roomUsers,
  ]);
  const mobileVoiceSlots = useMemo(() => {
    const slots: Array<RoomUser | null> = Array.from({ length: 5 }, () => null);
    const overflowUsers: RoomUser[] = [];

    mobileVoiceUsers.forEach((user) => {
      const index =
        typeof user.voiceSeatIndex === "number" ? user.voiceSeatIndex : null;
      if (index !== null && index >= 0 && index < slots.length && !slots[index]) {
        slots[index] = user;
        return;
      }
      overflowUsers.push(user);
    });

    overflowUsers.forEach((user) => {
      const emptyIndex = slots.findIndex((slot) => slot === null);
      if (emptyIndex !== -1) slots[emptyIndex] = user;
    });

    return slots;
  }, [mobileVoiceUsers]);

  useEffect(() => {
    if (!socket || !currentUsername) return;

    const handleRoomSocketJoined = (event: Event) => {
      if (!socket.connected || isOnRoof) return;

      const detail = (event as CustomEvent<RoomSocketJoinedEventDetail>).detail;
      const voiceRoomKey =
        typeof detail?.room === "string" && detail.room.trim()
          ? detail.room.trim()
          : roomId || roomName;
      if (!voiceRoomKey) return;

      const hadVoiceSeat =
        optimisticVoiceSeatJoinedAt !== null ||
        currentRoomUser?.isInVoiceSeat === true;
      if (!hadVoiceSeat) return;

      const fallbackJoinedAt =
        optimisticVoiceSeatJoinedAt ??
        currentRoomUser?.voiceSeatJoinedAt ??
        Date.now();
      const fallbackSeatIndex =
        optimisticVoiceSeatIndex ??
        (typeof currentRoomUser?.voiceSeatIndex === "number"
          ? currentRoomUser.voiceSeatIndex
          : undefined);
      setOptimisticVoiceSeatJoinedAt(fallbackJoinedAt);
      setOptimisticVoiceSeatIndex(fallbackSeatIndex ?? null);

      socket.emit(
        "voice:takeSeat",
        {
          room: voiceRoomKey,
          username: currentUsername,
          seatIndex: fallbackSeatIndex,
        },
        (
          response:
            | {
                status?: string;
                message?: string;
                voiceSeatJoinedAt?: number | null;
                voiceSeatIndex?: number | null;
              }
            | null
            | undefined,
        ) => {
          if (response?.status === "ok") {
            if (typeof response.voiceSeatJoinedAt === "number") {
              setOptimisticVoiceSeatJoinedAt(response.voiceSeatJoinedAt);
            }
            if (typeof response.voiceSeatIndex === "number") {
              setOptimisticVoiceSeatIndex(response.voiceSeatIndex);
            }
            return;
          }

          if (
            response?.message === "voice_seats_full" ||
            response?.message === "on_roof"
          ) {
            setOptimisticVoiceSeatJoinedAt(null);
            setOptimisticVoiceSeatIndex(null);
          }
        },
      );
    };

    window.addEventListener(ROOM_SOCKET_JOINED_EVENT, handleRoomSocketJoined);
    return () => {
      window.removeEventListener(
        ROOM_SOCKET_JOINED_EVENT,
        handleRoomSocketJoined,
      );
    };
  }, [
    socket,
    currentUsername,
    currentRoomUser,
    isOnRoof,
    optimisticVoiceSeatJoinedAt,
    optimisticVoiceSeatIndex,
    roomId,
    roomName,
  ]);

  useEffect(() => {
    const handleVoiceSeatForceReleased = (event: Event) => {
      const detail = (event as CustomEvent<VoiceSeatForceReleasedEventDetail>)
        .detail;
      const normalizedEventUsername = String(detail?.username || "")
        .trim()
        .toLocaleLowerCase("tr-TR");
      if (
        !normalizedCurrentUsername ||
        normalizedEventUsername !== normalizedCurrentUsername
      ) {
        return;
      }

      const normalizedEventRoom = String(detail?.room || "")
        .trim()
        .toLocaleLowerCase("tr-TR");
      const currentRoomKeys = [roomId, roomName]
        .map((value) =>
          String(value || "")
            .trim()
            .toLocaleLowerCase("tr-TR"),
        )
        .filter(Boolean);
      if (
        normalizedEventRoom &&
        currentRoomKeys.length > 0 &&
        !currentRoomKeys.includes(normalizedEventRoom)
      ) {
        return;
      }

      setOptimisticVoiceSeatJoinedAt(null);
      setOptimisticVoiceSeatIndex(null);
      setActiveMobileVoiceMenuUsername(null);
      setRoomUsers((prevUsers) =>
        prevUsers.map((user) =>
          user.username.trim().toLocaleLowerCase("tr-TR") ===
          normalizedCurrentUsername
            ? {
                ...user,
                isMuted: true,
                isInVoiceSeat: false,
                voiceSeatJoinedAt: null,
                voiceSeatIndex: null,
              }
            : user,
        ),
      );
    };

    window.addEventListener(
      VOICE_SEAT_FORCE_RELEASED_EVENT,
      handleVoiceSeatForceReleased,
    );
    return () => {
      window.removeEventListener(
        VOICE_SEAT_FORCE_RELEASED_EVENT,
        handleVoiceSeatForceReleased,
      );
    };
  }, [normalizedCurrentUsername, roomId, roomName, setRoomUsers]);

  const handleOpenMobileVoiceProfile = useCallback((voiceUser: RoomUser) => {
    const username = voiceUser.username || voiceUser.agentNickname || "";
    if (!username.trim()) return;

    setMobileInitialSelectedUser(voiceUser);
    setCloseMobileSidebarOnProfileClose(true);
    setMobileProfileOpenRequest({
      username,
      id: Date.now(),
      fallbackUser: voiceUser,
    });
    setMobileSidebarTab("room");
    setIsMobileSidebarOpen(true);
  }, []);

  const handleJoinMobileVoiceSlot = useCallback(async (seatIndex: number) => {
    const voiceRoomKey = roomId || roomName;
    if (!socket || !voiceRoomKey || !currentUsername) {
      toast.error("Oda bağlantısı hazır değil. Lütfen tekrar deneyin.");
      return;
    }
    if (isOnRoof) {
      toast.warning("Çatıdayken avatar koltuğunda görünemezsin.");
      return;
    }

    const alreadyHasSeat = mobileVoiceUsers.some(
      (user) =>
        user.username.trim().toLocaleLowerCase("tr-TR") ===
        normalizedCurrentUsername,
    );
    const shouldOpenMicAfterSeat = !alreadyHasSeat && (!isInVoiceChat || isMuted);

    if (shouldOpenMicAfterSeat) {
      if (micDisabled) {
        if (micDisabledReason) toast.error(micDisabledReason);
        return;
      }
      if (micWaitRemainingSeconds > 0) {
        toast.warning(
          `Mikrofonu açmak için ${micWaitRemainingSeconds} sn beklemelisiniz.`,
        );
        return;
      }
      if (micBanned) {
        toast.error("Mikrofonunuz bir yetkili tarafından yasaklandı.");
        return;
      }
    }

    if (!alreadyHasSeat && mobileVoiceUsers.length >= 5) {
      toast.warning(
        "5 avatar koltuğu dolu. Mikrofon al butonuyla konuşmaya devam edebilirsin.",
      );
      return;
    }

    localStorage.setItem("roofStatus", "false");
    localStorage.setItem("statusModeName", "Çevrimiçi");

    const nextSeatJoinedAt = optimisticVoiceSeatJoinedAt ?? Date.now();
    setOptimisticVoiceSeatJoinedAt(nextSeatJoinedAt);
    setOptimisticVoiceSeatIndex(seatIndex);
    socket.emit(
      "voice:takeSeat",
      {
        room: voiceRoomKey,
        username: currentUsername,
        seatIndex,
      },
      (
        response:
          | {
              status?: string;
              message?: string;
              voiceSeatJoinedAt?: number | null;
              voiceSeatIndex?: number | null;
            }
          | null
          | undefined,
      ) => {
        if (response?.status === "ok") {
          if (typeof response.voiceSeatJoinedAt === "number") {
            setOptimisticVoiceSeatJoinedAt(response.voiceSeatJoinedAt);
          }
          if (typeof response.voiceSeatIndex === "number") {
            setOptimisticVoiceSeatIndex(response.voiceSeatIndex);
          }
          setRoomUsers((prevUsers) =>
            prevUsers.map((user) =>
              user.username.trim().toLocaleLowerCase("tr-TR") ===
              normalizedCurrentUsername
                ? {
                    ...user,
                    isInVoiceChat: true,
                    isInVoiceSeat: true,
                    voiceSeatJoinedAt:
                      typeof response.voiceSeatJoinedAt === "number"
                        ? response.voiceSeatJoinedAt
                        : user.voiceSeatJoinedAt,
                    voiceSeatIndex:
                      typeof response.voiceSeatIndex === "number"
                        ? response.voiceSeatIndex
                        : seatIndex,
                  }
                : user,
            ),
          );
          if (socket.connected) {
            socket.emit("room:getUsers", { room: voiceRoomKey });
          }
          return;
        }
        if (response?.message === "voice_seats_full") {
          setOptimisticVoiceSeatJoinedAt(null);
          setOptimisticVoiceSeatIndex(null);
          toast.warning(
            "5 avatar koltuğu dolu. Mikrofon al butonuyla konuşmaya devam edebilirsin.",
          );
          return;
        }
        if (response?.message === "on_roof") {
          setOptimisticVoiceSeatJoinedAt(null);
          setOptimisticVoiceSeatIndex(null);
          localStorage.setItem("roofStatus", "true");
          localStorage.setItem("statusModeName", "Çatıda");
          toast.warning("Çatıdayken avatar koltuğunda görünemezsin.");
          return;
        }
        if (response?.message === "voice_seat_taken") {
          toast.warning("Bu koltuk dolu.");
        }
      },
    );

    if (!isInVoiceChat) {
      localStorage.removeItem("voiceChatOptOut");
      const joined = await joinVoiceChat({
        startMuted: false,
        skipPermissionPreflight: true,
      });
      if (!joined) {
        setOptimisticVoiceSeatJoinedAt(null);
        setOptimisticVoiceSeatIndex(null);
        socket.emit("voice:releaseSeat", {
          room: voiceRoomKey,
          username: currentUsername,
        });
        return;
      }
      if (shouldOpenMicAfterSeat) {
        toggleMute();
      }
      setActiveMobileVoiceMenuUsername(currentUsername || null);
      return;
    }

    if (shouldOpenMicAfterSeat) {
      toggleMute();
    }
  }, [
    socket,
    roomId,
    roomName,
    currentUsername,
    isInVoiceChat,
    isMuted,
    isOnRoof,
    joinVoiceChat,
    micBanned,
    micDisabled,
    micDisabledReason,
    micWaitRemainingSeconds,
    mobileVoiceUsers,
    normalizedCurrentUsername,
    optimisticVoiceSeatJoinedAt,
    setRoomUsers,
    toggleMute,
  ]);
  const handleToggleOwnMobileVoiceMute = useCallback(() => {
    if (isMuted) {
      if (micDisabled) {
        if (micDisabledReason) toast.error(micDisabledReason);
        return;
      }
      if (micWaitRemainingSeconds > 0) {
        toast.warning(
          `Mikrofonu açmak için ${micWaitRemainingSeconds} sn beklemelisiniz.`,
        );
        return;
      }
      if (micBanned) {
        toast.error("Mikrofonunuz bir yetkili tarafından yasaklandı.");
        return;
      }
      if (isOnRoof) {
        toast.warning(
          "Çatıdayken mikrofonunu açamazsın, sadece dinleyebilirsin.",
        );
        return;
      }
    }

    toggleMute();
  }, [
    isMuted,
    isOnRoof,
    micBanned,
    micDisabled,
    micDisabledReason,
    micWaitRemainingSeconds,
    toggleMute,
  ]);
  const handleLeaveMobileVoiceChat = useCallback(async () => {
    setOptimisticVoiceSeatJoinedAt(null);
    setOptimisticVoiceSeatIndex(null);
    const normalizedUsername = (currentUsername || "")
      .trim()
      .toLocaleLowerCase("tr-TR");
    if (normalizedUsername) {
      setRoomUsers((prevUsers) =>
        prevUsers.map((user) =>
          user.username.trim().toLocaleLowerCase("tr-TR") ===
          normalizedUsername
            ? {
                ...user,
                isInVoiceSeat: false,
                voiceSeatJoinedAt: null,
                voiceSeatIndex: null,
                isMuted: true,
              }
            : user,
        ),
      );
    }

    await leaveVoiceChat();
    setActiveMobileVoiceMenuUsername(null);
  }, [
    currentUsername,
    leaveVoiceChat,
    roomId,
    roomName,
    setRoomUsers,
  ]);

  const refreshDmUnreadCount = useCallback(async () => {
    try {
      const [unreadData, conversations] = await Promise.all([
        apiClient.directMessages.getUnreadCount(),
        apiClient.directMessages.listConversations(),
      ]);
      const pendingCount = Object.values(
        pendingDmConversationCountsRef.current,
      ).reduce((sum, count) => sum + count, 0);
      const conversationUnreadCount = Array.isArray(conversations)
        ? conversations.reduce((total, conversation) => {
            const conversationId = Number(conversation?.id ?? 0);
            const lastMessageId =
              conversation?.lastMessage?.id == null
                ? null
                : String(conversation.lastMessage.id);
            const isLocallyRead =
              conversationId > 0 &&
              lastMessageId != null &&
              dmLocallyReadLastMessageIdsRef.current[conversationId] ===
                lastMessageId;
            if (isLocallyRead) return total;
            return total + Number(conversation?.unreadCount ?? 0);
          }, 0)
        : 0;
      const apiUnreadCount = unreadData?.unreadCount ?? 0;
      const hasLocalReadConversations = Object.keys(
        dmLocallyReadLastMessageIdsRef.current,
      ).length > 0;
      const nextUnreadCount = Math.max(
        hasLocalReadConversations ? 0 : apiUnreadCount,
        conversationUnreadCount,
        pendingCount,
      );
      setDmUnreadCount(nextUnreadCount);
    } catch (error) {
      if (error instanceof ApiError && /timeout/i.test(error.message || "")) {
        return;
      }
      console.error("DM unread count fetch failed:", error);
    }
  }, []);
  const handleDmUnreadCountChange = useCallback((count: number) => {
    const pendingCount = Object.values(
      pendingDmConversationCountsRef.current,
    ).reduce((sum, pendingCount) => sum + pendingCount, 0);
    const nextUnreadCount = Math.max(count, pendingCount);
    console.log("[DM_MOBILE_BUTTON_UNREAD]", {
      incomingCount: count,
      pendingCount,
      nextUnreadCount,
      pendingDmConversationCounts: pendingDmConversationCountsRef.current,
    });
    setDmUnreadCount(nextUnreadCount);
  }, []);

  useEffect(() => {
    void refreshDmUnreadCount();
  }, [refreshDmUnreadCount]);

  useEffect(() => {
    const delayedRefreshId = window.setTimeout(() => {
      void refreshDmUnreadCount();
    }, 1200);
    const pollingRefreshId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refreshDmUnreadCount();
      }
    }, 4000);

    return () => {
      window.clearTimeout(delayedRefreshId);
      window.clearInterval(pollingRefreshId);
    };
  }, [refreshDmUnreadCount]);

  useEffect(() => {
    if (!socket) return;

    const handleConnectRefresh = () => {
      void refreshDmUnreadCount();
    };

    const handleDmNewMessage = (payload?: {
      unreadCount?: number | null;
      conversationId?: number | null;
    }) => {
      const preferences = readChatPreferencesFromStorage();
      if (
        !preferences.hideDirectMessageAlerts &&
        !preferences.muteVibrationSounds
      ) {
        playDirectMessageSound();
      }

      const conversationId = Number(payload?.conversationId ?? 0);
      let nextPendingCounts = pendingDmConversationCountsRef.current;
      if (conversationId > 0) {
        nextPendingCounts = {
          ...pendingDmConversationCountsRef.current,
          [conversationId]:
            (pendingDmConversationCountsRef.current[conversationId] ?? 0) + 1,
        };
        pendingDmConversationCountsRef.current = nextPendingCounts;
        setPendingDmConversationCounts(nextPendingCounts);
        if (dmLocallyReadLastMessageIdsRef.current[conversationId] != null) {
          const nextLocalReads = { ...dmLocallyReadLastMessageIdsRef.current };
          delete nextLocalReads[conversationId];
          dmLocallyReadLastMessageIdsRef.current = nextLocalReads;
        }
      }
      const pendingCount = Object.values(nextPendingCounts).reduce(
        (sum, count) => sum + count,
        0,
      );
      console.log("[DM_MOBILE_BUTTON_SOCKET]", {
        conversationId,
        payloadUnreadCount: payload?.unreadCount ?? null,
        pendingCount,
        pendingDmConversationCounts: nextPendingCounts,
      });
      setDmUnreadCount((prev) =>
        Math.max(prev + 1, Number(payload?.unreadCount ?? 0), pendingCount, 1),
      );
      window.setTimeout(() => {
        void refreshDmUnreadCount();
      }, 250);
    };

    const handleDmRead = (payload?: { conversationId?: number | null }) => {
      const conversationId = Number(payload?.conversationId ?? 0);
      if (conversationId > 0) {
        setPendingDmConversationCounts((prev) => {
          const next = { ...prev };
          delete next[conversationId];
          pendingDmConversationCountsRef.current = next;
          return next;
        });
      }
      void refreshDmUnreadCount();
    };

    if (socket.connected) {
      void refreshDmUnreadCount();
    }

    socket.on("connect", handleConnectRefresh);
    socket.on("dm:newMessage", handleDmNewMessage);
    socket.on("dm:read", handleDmRead);

    return () => {
      socket.off("connect", handleConnectRefresh);
      socket.off("dm:newMessage", handleDmNewMessage);
      socket.off("dm:read", handleDmRead);
    };
  }, [socket, refreshDmUnreadCount]);

  const mobileSidebarRoomUsersFallback = useMemo(() => {
    const normalizedCurrentUsername = (currentUsername || "")
      .trim()
      .toLocaleLowerCase("tr-TR");

    return roomUsers.filter((user) => {
      const normalizedUsername = String(user.username || "")
        .trim()
        .toLocaleLowerCase("tr-TR");
      const isCurrentUser =
        normalizedCurrentUsername.length > 0 &&
        normalizedUsername === normalizedCurrentUsername;

      if (user.statusModeName === "Çatıda" && !user.isBot && !isCurrentUser) {
        const userStarCountValue = Number(user.roleStarCount || 0);
        return Number(userStarCount || 0) >= userStarCountValue;
      }

      return true;
    }).length;
  }, [roomUsers, currentUsername, userStarCount]);
  const effectiveMobileSidebarRoomUsersCount =
    sidebarCounts.roomUsersCount > 0
      ? sidebarCounts.roomUsersCount
      : mobileSidebarRoomUsersFallback;
  const effectiveMobileAllUsersCount =
    sidebarCounts.allUsersCount > 0
      ? sidebarCounts.allUsersCount
      : 0;
  const shouldHideInitialMobileSidebarCount =
    effectiveMobileSidebarRoomUsersCount === 0 &&
    roomUsers.length === 0 &&
    !roomId;

  const activeJoinEffectAvatar = useMemo(() => {
    return calculateAvatar(activeJoinEffect?.icon);
  }, [activeJoinEffect]);
  const activeJoinEffectDef = useMemo(() => {
    if (!activeJoinEffect) return null;
    return joinEffectsById[activeJoinEffect.joinEffect] ?? null;
  }, [activeJoinEffect]);
  const activeJoinEffectEntryType =
    activeJoinEffect?.entryType ?? activeJoinEffect?.source ?? "room";
  const shouldRenderJoinEffectGif =
    activeJoinEffectDef?.previewType === "gif" &&
    activeJoinEffectDef.gifPath &&
    activeJoinEffect &&
    !(
      isMobileJoinEffectMode &&
      mobileStaticJoinEffectGifIds.has(activeJoinEffect.joinEffect)
    );
  const [bannerInspectModal, setBannerInspectModal] =
    useState<BannerInspectModal | null>(null);
  const [bannerInspectLoading, setBannerInspectLoading] = useState<
    "location" | "identities" | null
  >(null);
  const [activeInspectLoginHistoryId, setActiveInspectLoginHistoryId] =
    useState<number | null>(null);
  const buildRoomDescriptionMessages = useCallback((): Message[] => {
    const roomDescription =
      roomDetail?.description?.trim() ||
      roomDetail?.name?.trim() ||
      roomName?.trim();

    if (!roomDescription) return [];

    return [createRoomDescriptionMessage(roomId || roomName, roomDescription)];
  }, [roomDetail?.description, roomDetail?.name, roomId, roomName]);
  const openLoginLocationModal = useCallback(async (loginHistoryId: number) => {
    const canViewIpInSession = hasEffectivePermission({
      permissionLabel: PERMISSION_LABELS.IP_VIEW,
      userPermissions: currentUserPermissions,
      rolePermissions: currentRolePermissions,
    });
    if (!canViewIpInSession) {
      toast.error("İp görme yetkiniz yok.");
      return;
    }
    try {
      setActiveInspectLoginHistoryId(loginHistoryId);
      setBannerInspectLoading("location");
      const data = await apiClient.loginHistory.getLocationByLoginHistoryId(
        loginHistoryId,
      );
      setBannerInspectModal({ type: "location", data });
    } catch (error) {
      const apiError = error as { response?: { status?: number } };
      if (apiError?.response?.status === 404) {
        toast.error("Giriş kaydı bulunamadı.");
      } else if (apiError?.response?.status === 403) {
        toast.error("Bu kullanıcı için yetkiniz yok.");
      } else {
        toast.error("Konum bilgileri alınamadı.");
      }
    } finally {
      setBannerInspectLoading(null);
      setActiveInspectLoginHistoryId(null);
    }
  }, [currentRolePermissions, currentUserPermissions]);
  const openLoginIdentitiesModal = useCallback(async (loginHistoryId: number) => {
    const canViewIpInSession = hasEffectivePermission({
      permissionLabel: PERMISSION_LABELS.IP_VIEW,
      userPermissions: currentUserPermissions,
      rolePermissions: currentRolePermissions,
    });
    if (!canViewIpInSession) {
      toast.error("İp görme yetkiniz yok.");
      return;
    }
    try {
      setActiveInspectLoginHistoryId(loginHistoryId);
      setBannerInspectLoading("identities");
      const data = await apiClient.loginHistory.getIdentitiesByLoginHistoryId(
        loginHistoryId,
      );
      setBannerInspectModal({ type: "identities", data });
    } catch (error) {
      const apiError = error as { response?: { status?: number } };
      if (apiError?.response?.status === 404) {
        toast.error("Giriş kaydı bulunamadı.");
      } else if (apiError?.response?.status === 403) {
        toast.error("Bu kullanıcı için yetkiniz yok.");
      } else {
        toast.error("Giriş rumuzları alınamadı.");
      }
    } finally {
      setBannerInspectLoading(null);
      setActiveInspectLoginHistoryId(null);
    }
  }, [currentRolePermissions, currentUserPermissions]);
  const [ignoredUsernamesSet, setIgnoredUsernamesSet] = useState<Set<string>>(
    new Set(),
  );
  useEffect(() => {
    let timeoutId: number | undefined;
    const syncIgnoredUsers = () => {
      const preferences = readChatPreferencesFromStorage();
      const nextIgnored = new Set(
        (preferences.ignoredUsernames ?? [])
          .map((username) => (username || "").trim().toLowerCase())
          .filter(Boolean),
      );
      setIgnoredUsernamesSet(nextIgnored);
    };

    syncIgnoredUsers();
    const onPreferencesChanged = () => {
      timeoutId = window.setTimeout(syncIgnoredUsers, 0);
    };
    window.addEventListener("chatPreferencesChanged", onPreferencesChanged);
    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      window.removeEventListener("chatPreferencesChanged", onPreferencesChanged);
    };
  }, []);

  const visibleMessages = useMemo(
    () =>
      messages.reduce<Array<{ msg: Message; index: number }>>((acc, msg, index) => {
        const normalizedSender = (msg.username || "").trim().toLowerCase();
        if (
          msg.username !== "Sistem" &&
          ignoredUsernamesSet.has(normalizedSender)
        ) {
          return acc;
        }
        const isGeneralMessage =
          msg.targetGroup === "everyone" ||
          (!msg.targetGroup && msg.message.trimStart().startsWith("HERKESE:"));
        if (hideGeneralMessagesEnabled && isGeneralMessage) {
          return acc;
        }
        if (
          msg.username === "Sistem" &&
          !showJoinLeaveEventsEnabled &&
          isJoinLeaveSystemMessage(msg.message)
        ) {
          return acc;
        }
        if (
          msg.username === "Sistem" &&
          isSelfJoinLeaveSystemMessage(
            msg.message,
            currentUsername,
            currentAgentNickname,
          )
        ) {
          return acc;
        }
        acc.push({ msg, index });
        return acc;
      }, []),
    [
      messages,
      ignoredUsernamesSet,
      showJoinLeaveEventsEnabled,
      hideGeneralMessagesEnabled,
      currentUsername,
      currentAgentNickname,
    ],
  );
  const chatMessages = visibleMessages;
  const lastChatMessageKey = useMemo(() => {
    const last = chatMessages[chatMessages.length - 1];
    if (!last) return "";
    const { msg, index } = last;
    return [
      msg.id ?? "no-id",
      msg.timestamp || "no-time",
      msg.originalUsername || msg.username || "no-user",
      msg.message || "no-message",
      index,
    ].join("|");
  }, [chatMessages]);
  const [callState, setCallState] = useState<CallState>({ status: "idle" });
  const [callHistory, setCallHistory] = useState<CallHistoryEntry[]>([]);
  const callStateRef = useRef<CallState>({ status: "idle" });
  const friendActivityDedupRef = useRef<Map<string, number>>(new Map());
  const friendRoomTransitionSuppressUntilRef = useRef<Map<string, number>>(
    new Map(),
  );
  const pendingFriendOfflineTimersRef = useRef<
    Record<
      string,
      {
        timerId: number;
        fromRoomName: string | null;
        createdAt: number;
      }
    >
  >({});
  const pendingRoofExitJoinEffectTimersRef = useRef<Record<string, number>>({});
  const hasLeftRoomRef = useRef(false);
  const emitLeaveOnce = useCallback(
    (
      socketInstance: Socket | null | undefined,
      room: string | null | undefined,
      username: string | null | undefined,
    ) => {
      if (hasLeftRoomRef.current) return;
      if (!socketInstance || !room) return;
      hasLeftRoomRef.current = true;
      try {
        socketInstance.emit("leaveRoom", {
          room,
          username: username ?? undefined,
        });
      } catch (error) {
        console.error("leaveRoom emit failed:", error);
      }
    },
    [],
  );

  useEffect(() => {
    hasLeftRoomRef.current = false;
  }, [socket, roomId, roomName]);

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  useEffect(() => {
    return () => {
      friendRoomTransitionSuppressUntilRef.current.clear();
      for (const entry of Object.values(pendingFriendOfflineTimersRef.current)) {
        window.clearTimeout(entry.timerId);
      }
      pendingFriendOfflineTimersRef.current = {};
      for (const timerId of Object.values(
        pendingRoofExitJoinEffectTimersRef.current,
      )) {
        window.clearTimeout(timerId);
      }
      pendingRoofExitJoinEffectTimersRef.current = {};
    };
  }, []);

  const canAccessAdminPanel = useMemo(
    () =>
      hasEffectivePermission({
        permissionLabel: PERMISSION_LABELS.ADMIN_PANEL,
        userPermissions: currentUserPermissions,
        rolePermissions: currentRolePermissions,
      }),
    [currentRolePermissions, currentUserPermissions],
  );
  const canUseRoofForSettings = useMemo(
    () =>
      userStarCount >= 1 &&
      hasEffectivePermission({
        permissionLabel: PERMISSION_LABELS.ROOF_ACCESS,
        userPermissions: currentUserPermissions,
        rolePermissions: currentRolePermissions,
      }),
    [currentRolePermissions, currentUserPermissions, userStarCount],
  );
  const canViewIp = useMemo(
    () =>
      hasEffectivePermission({
        permissionLabel: PERMISSION_LABELS.IP_VIEW,
        userPermissions: currentUserPermissions,
        rolePermissions: currentRolePermissions,
      }),
    [currentRolePermissions, currentUserPermissions],
  );
  const canDeleteRoomMessages = useMemo(
    () =>
      hasEffectivePermission({
        permissionLabel: PERMISSION_LABELS.ROOM_MESSAGES_DELETE,
        userPermissions: currentUserPermissions,
        rolePermissions: currentRolePermissions,
    }),
    [currentRolePermissions, currentUserPermissions],
  );
  const canManageRadio = useMemo(
    () =>
      hasEffectivePermission({
        permissionLabel: PERMISSION_LABELS.RADIO_MANAGEMENT,
        userPermissions: currentUserPermissions,
        rolePermissions: currentRolePermissions,
      }),
    [currentRolePermissions, currentUserPermissions],
  );
  const handleManageRoom = useCallback(() => {
    setShowManageModal(true);
  }, []);
  const openAdminPanel = useCallback(() => {
    if (!canAccessAdminPanel) {
      toast.error("Admin paneli erişim yetkiniz yok.");
      return;
    }
    setIsAdminPanelOpen(true);
  }, [canAccessAdminPanel]);
  useEffect(() => {
    if (!isAdminPanelOpen || canAccessAdminPanel) return;
    setIsAdminPanelOpen(false);
    setAdminInitialView(null);
    setAdminInitialRoomName(null);
    toast.error("Admin paneli erişim yetkiniz kaldırıldı.");
  }, [canAccessAdminPanel, isAdminPanelOpen]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleFriendActivity = useCallback(
    (event: FriendActivityEvent) => {
      const normalizedUsername = (event.username || "").trim();
      if (!normalizedUsername) return;
      const activityUserKey = (event.rawUsername || normalizedUsername)
        .trim()
        .toLowerCase();
      if (!activityUserKey) return;

      // Oda geçişi sırasında gelen geçici offline event'lerini bastırmak için:
      // - room_changed geldiğinde bekleyen offline mesajını iptal et
      // - online geldiğinde bekleyen offline varsa geçiş say ve login mesajını gösterme
      const pendingOfflineEntry =
        pendingFriendOfflineTimersRef.current[activityUserKey];
      const now = Date.now();
      const transitionSuppressUntil =
        friendRoomTransitionSuppressUntilRef.current.get(activityUserKey) ?? 0;
      const isInTransitionSuppressWindow = now < transitionSuppressUntil;
      if (event.type === "friend_room_changed") {
        friendRoomTransitionSuppressUntilRef.current.set(
          activityUserKey,
          now + 12000,
        );
        if (pendingOfflineEntry) {
          window.clearTimeout(pendingOfflineEntry.timerId);
          delete pendingFriendOfflineTimersRef.current[activityUserKey];
        }
        return;
      }

      const currentRoom =
        event.type === "friend_online" || event.type === "friend_offline"
          ? ""
          : event.toRoomName?.trim() || event.fromRoomName?.trim() || "";
      const dedupKey = `${event.type}:${(
        event.rawUsername || normalizedUsername
      )
        .trim()
        .toLowerCase()}:${currentRoom.toLowerCase()}`;
      const dedupMap = friendActivityDedupRef.current;
      const lastTimestamp = dedupMap.get(dedupKey) ?? 0;
      if (now - lastTimestamp < 8000) return;

      for (const [key, ts] of dedupMap.entries()) {
        if (now - ts > 20000) dedupMap.delete(key);
      }
      dedupMap.set(dedupKey, now);

      const targetRoomName = event.toRoomName?.trim() || "Bilinmeyen Oda";
      if (event.type === "friend_online") {
        if (isInTransitionSuppressWindow) return;
        if (pendingOfflineEntry) {
          window.clearTimeout(pendingOfflineEntry.timerId);
          delete pendingFriendOfflineTimersRef.current[activityUserKey];
          return;
        }
        addSystemMessage(
          `${normalizedUsername} ➔ Arkadaşın siteye giriş yaptı. Şu an ${targetRoomName} odasına katıldı.`,
        );
        return;
      }

      if (event.type === "friend_offline") {
        if (isInTransitionSuppressWindow) return;
        const existingTimer = pendingFriendOfflineTimersRef.current[activityUserKey];
        if (existingTimer) {
          window.clearTimeout(existingTimer.timerId);
        }

        const createdAt = Date.now();
        const timerId = window.setTimeout(() => {
          const latest = pendingFriendOfflineTimersRef.current[activityUserKey];
          if (!latest || latest.createdAt !== createdAt) return;
          delete pendingFriendOfflineTimersRef.current[activityUserKey];

          const shouldShowRoofSuffix =
            event.wasOnRoof === true &&
            roomUsers.some(
              (user) =>
                user.username.trim().toLowerCase() === activityUserKey &&
                user.statusModeName === "Çatıda",
            );

          addSystemMessage(
            `${normalizedUsername} ➔ Arkadaşın siteden çıkış yaptı${
              shouldShowRoofSuffix ? " (çatıdaydı)" : ""
            }.`,
          );
        }, 10000);
        pendingFriendOfflineTimersRef.current[activityUserKey] = {
          timerId,
          fromRoomName: event.fromRoomName?.trim() || null,
          createdAt,
        };
        return;
      }

      if (event.type === "friend_room_changed") return;
    },
    [addSystemMessage, roomUsers],
  );

  function handleTenantJoinEffect(event: TenantJoinEffectEvent) {
    if (typeof window === "undefined") {
      return;
    }

    const normalizedUsername = (event.username || "").trim().toLocaleLowerCase("tr-TR");
    const normalizedCurrentUsername = (currentUsername || "")
      .trim()
      .toLocaleLowerCase("tr-TR");

    if (
      normalizedUsername &&
      normalizedCurrentUsername &&
      normalizedUsername === normalizedCurrentUsername
    ) {
      return;
    }

    window.dispatchEvent(
      new CustomEvent("tenantJoinEffectTriggered", { detail: event }),
    );
  }

  const mapCallHistoryRecord = useCallback(
    (record: CallHistoryRecord): CallHistoryEntry => ({
      id: record.id,
      callId: record.callId,
      peerName: record.peerName,
      direction: record.direction,
      status: record.status,
      startedAt: new Date(record.startedAt).getTime(),
      endedAt: record.endedAt ? new Date(record.endedAt).getTime() : undefined,
      durationSec: record.durationSec ?? undefined,
    }),
    [],
  );

  useEffect(() => {
    if (!currentUsername) {
      setCallHistory([]);
      return;
    }

    let isMounted = true;
    apiClient.callHistory
      .list()
      .then((records) => {
        if (!isMounted) return;
        setCallHistory(records.map(mapCallHistoryRecord));
      })
      .catch((error) => {
        console.error("Çağrı geçmişi yüklenemedi:", error);
      });

    return () => {
      isMounted = false;
    };
  }, [currentUsername, currentAgentNickname, mapCallHistoryRecord]);

  const addCallHistoryEntry = useCallback((entry: Omit<CallHistoryEntry, "id">) => {
    void apiClient.callHistory
      .create({
        callId: entry.callId,
        peerName: entry.peerName,
        direction: entry.direction,
        status: entry.status,
        startedAt: new Date(entry.startedAt).toISOString(),
        endedAt: entry.endedAt ? new Date(entry.endedAt).toISOString() : null,
        durationSec: entry.durationSec ?? null,
      })
      .then((record) => {
        const mapped = mapCallHistoryRecord(record);
        setCallHistory((prev) => [
          mapped,
          ...prev.filter((item) => item.id !== mapped.id),
        ]);
      })
      .catch((error) => {
        console.error("Çağrı geçmişi kaydedilemedi:", error);
      });
  }, [mapCallHistoryRecord]);

  const deleteCallHistoryEntry = useCallback(async (id: number) => {
    let removedEntry: CallHistoryEntry | undefined;
    setCallHistory((prev) => {
      removedEntry = prev.find((entry) => entry.id === id);
      return prev.filter((entry) => entry.id !== id);
    });
    try {
      await apiClient.callHistory.delete(id);
    } catch (error) {
      if (removedEntry) {
        setCallHistory((prev) => [
          removedEntry as CallHistoryEntry,
          ...prev.filter((entry) => entry.id !== id),
        ]);
      }
      const message =
        error instanceof ApiError && error.message?.trim()
          ? error.message
          : "Çağrı kaydı silinemedi.";
      toast.error(message);
    }
  }, []);

	  const mapUserToPeer = useCallback(
	    (user: VoiceCallUser): CallPeer => ({
	      username: user.displayUsername || user.username,
	      icon: user.agentNickname ? null : (user.icon ?? null),
	      gender: user.gender ?? null,
	      roleName: user.agentNickname ? "Misafir" : user.roleName ?? null,
	      isGuest: user.isGuest === true || Boolean(user.agentNickname),
	    }),
	    [],
	  );

  const startCall = useCallback(
    (user: VoiceCallUser, callType: CallType) => {
      if (!socket || !currentUsername) return;
      const canStartCall = currentUserIsGuest
        ? communicationPermissions?.guestVoiceCallEnabled !== false
        : communicationPermissions?.membersVoiceCallEnabled !== false;
      if (!canStartCall) {
        toast.error(
          currentUserIsGuest
            ? "Misafir sesli/görüntülü arama kapalı."
            : "Üye sesli/görüntülü arama kapalı.",
        );
        return;
      }
      if (callStateRef.current.status !== "idle") {
        toast.error("Baska bir arama devam ediyor.");
        return;
      }
      const callId = `${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      const startedAt = Date.now();
      const expiresAt = startedAt + 20000;
      setCallState({
        status: "outgoing",
        callType,
        callId,
        target: mapUserToPeer(user),
        startedAt,
        expiresAt,
      });
      socket.emit("call:request", {
        targetUsername: user.username,
        targetAgentNickname: user.agentNickname ?? null,
        callerUsername: currentUsername,
        callerAgentNickname:
          typeof window !== "undefined"
            ? (localStorage.getItem("agentNickname") || "").trim() || null
            : null,
        callerIsGuest: currentUserIsGuest,
        tenantId: env.tenantId ? `tenant_${env.tenantId}` : "tenant_master",
        callId,
        callType,
      });
    },
    [
      socket,
      currentUsername,
      currentUserIsGuest,
      communicationPermissions?.guestVoiceCallEnabled,
      communicationPermissions?.membersVoiceCallEnabled,
      mapUserToPeer,
    ],
  );

  const startVoiceCall = useCallback(
    (user: VoiceCallUser) => startCall(user, "voice"),
    [startCall],
  );

  const startVideoCall = useCallback(
    (user: VoiceCallUser) => startCall(user, "video"),
    [startCall],
  );

  useEffect(() => {
    if (!socket || !currentUsername) return;

    const handleIncoming = (data: {
      callId: string;
      callType?: CallType;
      fromUsername: string;
      fromIcon?: string | null;
      fromGender?: string | null;
      fromRoleName?: string | null;
      fromIsGuest?: boolean;
    }) => {
      if (callStateRef.current.status !== "idle") {
        socket.emit("call:reject", { callId: data.callId, reason: "busy" });
        return;
      }
      const startedAt = Date.now();
      const expiresAt = startedAt + 20000;
      setCallState({
        status: "incoming",
        callType: data.callType ?? "voice",
        callId: data.callId,
        from: {
          username: data.fromUsername,
          icon: data.fromIcon ?? null,
          gender: data.fromGender ?? null,
          roleName: data.fromRoleName ?? null,
          isGuest: data.fromIsGuest === true,
        },
        startedAt,
        expiresAt,
      });
    };

    const handleAccepted = async (data: { callId: string; callType?: CallType }) => {
      const current = callStateRef.current;
      if (current.status !== "outgoing" || current.callId !== data.callId) {
        return;
      }
      leaveVoiceChat();
      try {
        await joinCall(data.callId, currentUsername, current.callType);
        setCallState({
          status: "active",
          callType: current.callType,
          callId: data.callId,
          peer: current.target,
          connectedAt: Date.now(),
          direction: "outgoing",
        });
      } catch (error) {
        socket.emit("call:end", { callId: data.callId, durationSec: 0 });
        setCallState({ status: "idle" });
        toast.error("Arama baslatilamadi.");
      }
    };

    const handleRejected = (data: {
      callId: string;
      reason: "rejected" | "busy" | "not_allowed";
      code?:
        | "target_rejects_incoming_calls"
        | "system_voice_call_disabled"
        | "member_voice_call_disabled"
        | "guest_voice_call_disabled"
        | "blocked_user"
        | "private_call_permission_denied";
    }) => {
      const current = callStateRef.current;
      if (current.status !== "outgoing" || current.callId !== data.callId) {
        return;
      }
      addCallHistoryEntry({
        callId: data.callId,
        peerName: current.target.username,
        direction: "outgoing",
        status: "rejected",
        startedAt: current.startedAt,
        endedAt: Date.now(),
      });
      setCallState({ status: "idle" });
      if (data.reason === "busy") {
        toast.error("Karsi taraf mesgul.");
        return;
      }
      if (data.reason === "not_allowed") {
        if (data.code === "target_rejects_incoming_calls") {
          toast.error("Bu kullanıcı gelen özel aramaları kabul etmiyor.");
          return;
        }
        if (data.code === "blocked_user") {
          toast.error("Bu kullanıcıyla özel iletişim engelli.");
          return;
        }
        if (data.code === "private_call_permission_denied") {
          toast.error("Özel arama yetkiniz bulunmuyor.");
          return;
        }
        if (data.code === "member_voice_call_disabled") {
          toast.error("Üyelere sesli/görüntülü arama kapalı.");
          return;
        }
        if (data.code === "guest_voice_call_disabled") {
          toast.error("Misafirlere sesli/görüntülü arama kapalı.");
          return;
        }
        toast.error("Ayarlar nedeniyle bu kullanıcıyla özel arama yapılamıyor.");
      }
    };

    const handleCanceled = (data: { callId: string }) => {
      const current = callStateRef.current;
      if (current.status !== "incoming" || current.callId !== data.callId) {
        return;
      }
      addCallHistoryEntry({
        callId: data.callId,
        peerName: current.from.username,
        direction: "incoming",
        status: "missed",
        startedAt: current.startedAt,
        endedAt: Date.now(),
      });
      setCallState({ status: "idle" });
    };

    const handleMissed = (data: {
      callId: string;
      callerUsername: string;
      targetUsername: string;
    }) => {
      const direction =
        currentUsername === data.callerUsername ? "outgoing" : "incoming";
      const current = callStateRef.current;
      const startedAt =
        current.status !== "idle" && current.callId === data.callId
          ? "startedAt" in current
            ? current.startedAt
            : Date.now()
          : Date.now();
      addCallHistoryEntry({
        callId: data.callId,
        peerName:
          direction === "outgoing"
            ? data.targetUsername
            : data.callerUsername,
        direction,
        status: "missed",
        startedAt,
        endedAt: Date.now(),
      });
      if (current.status !== "idle" && current.callId === data.callId) {
        setCallState({ status: "idle" });
      }
    };

    const handleEnded = async (data: {
      callId: string;
      durationSec?: number;
    }) => {
      const current = callStateRef.current;
      if (current.status !== "active" || current.callId !== data.callId) {
        return;
      }
      await leaveCall();
      addCallHistoryEntry({
        callId: data.callId,
        peerName: current.peer.username,
        direction: current.direction,
        status: "completed",
        startedAt: current.connectedAt,
        endedAt: Date.now(),
        durationSec:
          data.durationSec ??
          Math.max(
            0,
            Math.floor((Date.now() - current.connectedAt) / 1000),
          ),
      });
      setCallState({ status: "idle" });
    };

    socket.on("call:incoming", handleIncoming);
    socket.on("call:accepted", handleAccepted);
    socket.on("call:rejected", handleRejected);
    socket.on("call:canceled", handleCanceled);
    socket.on("call:missed", handleMissed);
    socket.on("call:ended", handleEnded);

    return () => {
      socket.off("call:incoming", handleIncoming);
      socket.off("call:accepted", handleAccepted);
      socket.off("call:rejected", handleRejected);
      socket.off("call:canceled", handleCanceled);
      socket.off("call:missed", handleMissed);
      socket.off("call:ended", handleEnded);
    };
  }, [
    socket,
    currentUsername,
    joinCall,
    leaveCall,
    leaveVoiceChat,
    addCallHistoryEntry,
  ]);

  const acceptCall = useCallback(
    async (callId: string) => {
      if (!socket || !currentUsername) return;
      const current = callStateRef.current;
      if (current.status !== "incoming" || current.callId !== callId) return;
      socket.emit("call:accept", { callId });
      leaveVoiceChat();
      try {
        await joinCall(callId, currentUsername, current.callType);
        setCallState({
          status: "active",
          callType: current.callType,
          callId,
          peer: current.from,
          connectedAt: Date.now(),
          direction: "incoming",
        });
      } catch (error) {
        socket.emit("call:end", { callId, durationSec: 0 });
        setCallState({ status: "idle" });
        toast.error("Arama baslatilamadi.");
      }
    },
    [socket, currentUsername, joinCall, leaveVoiceChat],
  );

  const rejectCall = useCallback(
    (callId: string) => {
      if (!socket) return;
      const current = callStateRef.current;
      if (current.status !== "incoming" || current.callId !== callId) return;
      socket.emit("call:reject", { callId, reason: "rejected" });
      addCallHistoryEntry({
        callId,
        peerName: current.from.username,
        direction: "incoming",
        status: "rejected",
        startedAt: current.startedAt,
        endedAt: Date.now(),
      });
      setCallState({ status: "idle" });
    },
    [socket, addCallHistoryEntry],
  );

  const cancelCall = useCallback(
    (callId: string) => {
      if (!socket) return;
      const current = callStateRef.current;
      if (current.status !== "outgoing" || current.callId !== callId) return;
      socket.emit("call:cancel", { callId });
      addCallHistoryEntry({
        callId,
        peerName: current.target.username,
        direction: "outgoing",
        status: "canceled",
        startedAt: current.startedAt,
        endedAt: Date.now(),
      });
      setCallState({ status: "idle" });
    },
    [socket, addCallHistoryEntry],
  );

  const endCall = useCallback(
    async (callId: string) => {
      const current = callStateRef.current;
      if (current.status !== "active" || current.callId !== callId) return;
      const durationSec = Math.max(
        0,
        Math.floor((Date.now() - current.connectedAt) / 1000),
      );
      if (socket) {
        socket.emit("call:end", { callId, durationSec });
      }
      await leaveCall();
      addCallHistoryEntry({
        callId,
        peerName: current.peer.username,
        direction: current.direction,
        status: "completed",
        startedAt: current.connectedAt,
        endedAt: Date.now(),
        durationSec,
      });
      setCallState({ status: "idle" });
    },
    [socket, leaveCall, addCallHistoryEntry],
  );

  // Handler to exit from roof status
  const handleExitRoof = useCallback(async () => {
    const savedId = parseStoredStatusId(localStorage.getItem("priorStatusModeId"));
    const savedName = localStorage.getItem("priorStatusModeName")?.trim() || null;
    const apiClientRef = getClientApiClient();

    const targetId = savedId ?? null;
    const targetName =
      (savedName && savedName !== "Çatıda" ? savedName : "Çevrimiçi");

    // localStorage'ı güncelle
    if (targetId !== null) {
      localStorage.setItem("statusModeId", String(targetId));
    } else {
      localStorage.removeItem("statusModeId");
    }
    localStorage.setItem("statusModeName", targetName);
    localStorage.setItem("roofStatus", "false");

    // Socket üzerinden status güncellemesini gönder
    window.dispatchEvent(
      new CustomEvent("statusModeUpdated", {
        detail: {
          statusModeId: targetId,
          statusModeName: targetName,
        },
      }),
    );

    const normalizedJoinEffect =
      typeof window !== "undefined"
        ? localStorage.getItem("profileJoinEffect")
        : null;
    const selectedJoinEffect =
      normalizedJoinEffect && isJoinEffectId(normalizedJoinEffect)
        ? normalizedJoinEffect
        : undefined;

    if (selectedJoinEffect && currentUsername) {
      onTriggerJoinEffect(
        {
          key: `${currentUsername.toLocaleLowerCase("tr-TR")}:${selectedJoinEffect}:roof-exit-local:${Date.now()}`,
          username: currentUsername,
          loginHistoryId: null,
          joinEffect: selectedJoinEffect,
          source: "room",
          icon: currentUserIcon ?? null,
          roleIcon: currentUserRoleSnapshot?.roleIcon ?? null,
          roleStarColor: currentUserRoleSnapshot?.roleStarColor ?? null,
          roleStarCount:
            currentUserRoleSnapshot?.roleStarCount ?? userStarCount ?? null,
          agentNickname: null,
        },
        { force: true },
      );
    }

    try {
      let persistedStatusModeId = targetId;
      if (persistedStatusModeId === null) {
        const statusModesResponse = await apiClientRef.get("/status-modes");
        const statusModes = normalizeStatusModeOptions(statusModesResponse?.data);
        persistedStatusModeId =
          statusModes.find((mode) => mode.name === targetName)?.id ??
          statusModes.find((mode) => mode.name === "Çevrimiçi")?.id ??
          null;
      }
      if (persistedStatusModeId !== null) {
        await apiClientRef.patch("/user/status-mode", {
          statusModeId: persistedStatusModeId,
        });
      }
    } catch (error) {
      console.error("Exit roof status API update failed:", error);
    }

    // Mesajlardan "Çatıdan inmek için tıkla" mesajını kaldır ve "Çatıdan indiniz" mesajı ekle
    setMessages((prev) => {
      const filtered = prev.filter(
        (msg) =>
          !(
            msg.isSystemMessage &&
            msg.isClickable &&
            msg.message.includes("Çatıdan inmek için tıkla")
          ),
      );

      // Yeşil renkli "Çatıdan indiniz, görünür mod" sistem mesajı ekle
      return [
        ...filtered,
        {
          room: roomId || roomName,
          username: "Sistem",
          message: "Çatıdan indiniz, görünür mod ✓",
          gender: "male",
          isGuest: false,
          timestamp: new Date().toISOString(),
          isSystemMessage: true,
          fontColor: "#16a34a", // Yeşil renk (green-600)
        } as Message,
      ];
    });
  }, [
    setMessages,
    roomId,
    roomName,
    socket,
    currentUsername,
    currentUserIcon,
    currentUserRoleSnapshot,
    userStarCount,
    onTriggerJoinEffect,
  ]);

  const handleWelcomeMessageClick = useCallback(
    async (systemMessage: Message) => {
      const finalContent = systemMessage.welcomeMessageContent?.trim();
      if (!finalContent || !roomId) return;

      const isGuest =
        localStorage.getItem("isGuest") === "true" &&
        !localStorage.getItem("accessToken");
      const username = isGuest
        ? localStorage.getItem("guestUsername")
        : localStorage.getItem("username");
      const fallbackGender = localStorage.getItem("guestGender") || "male";

      if (!username) {
        toast.error("Kullanıcı bilgisi bulunamadı.");
        return;
      }

      const roomNameToSend = roomName || roomId;
      const payload = {
        content: finalContent,
        type: "normal" as const,
        roomName: roomNameToSend,
      };

      const removePrompt = () => {
        setMessages((prev) =>
          prev.filter((msg) => {
            if (msg.systemAction !== "sendWelcomeMessage") return true;
            if (
              systemMessage.welcomePromptKey &&
              msg.welcomePromptKey === systemMessage.welcomePromptKey
            ) {
              return false;
            }
            return !(
              msg.timestamp === systemMessage.timestamp &&
              msg.message === systemMessage.message
            );
          }),
        );
      };

      try {
        const responseData = await apiClient.messages.sendMessage(payload);
        const effectiveGender =
          (responseData?.user?.gender as "male" | "female") ||
          currentUserGender ||
          (fallbackGender as "male" | "female");
        const effectiveIcon = responseData?.user?.icon || currentUserIcon || null;

        if (responseData?.id) {
          onMessageSent({
            id: responseData.id,
            content: finalContent,
            finalContent,
            username: responseData.user?.username ?? username,
            originalUsername: responseData.user?.username ?? username,
            displayUsername:
              responseData.user?.displayUsername ??
              responseData.user?.agentNickname ??
              username,
            gender: effectiveGender,
            isGuest,
            createdAt: responseData.createdAt ?? new Date().toISOString(),
            fontColor: responseData.fontColor ?? null,
            targetGroup:
              (responseData.targetGroup as
                | "everyone"
                | "members"
                | "staff"
                | null) ?? null,
            icon: responseData.user?.icon ?? effectiveIcon,
            replyToMessage: null,
            isWelcomeMessage: true,
          });
        }

        removePrompt();
      } catch (error) {
        console.error("❌ Error sending welcome message:", error);
        toast.error("Karşılama mesajı kaydedilemedi. Lütfen tekrar deneyin.");
      }
    },
    [
      chatFontColor,
      onMessageSent,
      currentUserGender,
      currentUserIcon,
      roomId,
      roomName,
      setMessages,
    ],
  );

  const handleSystemMessageClick = useCallback(
    (msg: Message) => {
      if (msg.systemAction === "sendWelcomeMessage") {
        void handleWelcomeMessageClick(msg);
        return;
      }

      handleExitRoof();
    },
    [handleExitRoof, handleWelcomeMessageClick],
  );

  useEffect(() => {
    if (roomUsers.length > 0) {
      syncWithRoomUsers(roomUsers);
    }
  }, [roomUsers, syncWithRoomUsers]);

  // Auto-scroll only when the chat stream gets a new normal message.
  useEffect(() => {
    if (!lastChatMessageKey) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lastChatMessageKey]);

  // Auto-join voice chat silently on desktop only.
  useEffect(() => {
    if (!socket || !roomId || !currentUsername || joinError || isInVoiceChat) {
      return;
    }

    const optedOut = localStorage.getItem("voiceChatOptOut") === "true";
    if (optedOut) return;

    if (resolveCurrentDeviceType() === "mobile") return;

    const autoJoinTimeoutId = window.setTimeout(() => {
      void (async () => {
      const joined = await joinVoiceChat({ startMuted: true });
      if (joined && !hasShownVoiceJoinedToastRef.current) {
        hasShownVoiceJoinedToastRef.current = true;
        toast.success("Canlı yayına bağlandınız");
      }
      })();
    }, 3000);

    return () => {
      window.clearTimeout(autoJoinTimeoutId);
    };
  }, [socket, roomId, currentUsername, joinError, isInVoiceChat, joinVoiceChat]);

  // Çatıda ise mikrofonu kapat ve elini indir (ama sesli sohbetten çıkma!)
  useEffect(() => {
    if (isOnRoof) {
      setOptimisticVoiceSeatJoinedAt(null);
      setOptimisticVoiceSeatIndex(null);
      const voiceRoomKey = roomId || roomName;
      if (socket && voiceRoomKey && currentUsername) {
        socket.emit("voice:releaseSeat", {
          room: voiceRoomKey,
          username: currentUsername,
        });
      }
      // Rule 1: Mikrofondaysa sesi kapat (eğer açıksa)
      if (isInVoiceChat && !isMuted) {
        toggleMute();
      }
      // Rule 2: Eli kaldırıksa indir
      if (isHandRaised) {
        onToggleHand(false);
      }
    }
  }, [
    isOnRoof,
    socket,
    roomId,
    roomName,
    currentUsername,
    isInVoiceChat,
    isMuted,
    isHandRaised,
    toggleMute,
    onToggleHand,
  ]);

  // Çatıda iken tıklanabilir sistem mesajı göster
  useEffect(() => {
    if (isOnRoof) {
      setMessages((prev) => {
        const hasRoofMessage = prev.some(
          (msg) =>
            msg.isSystemMessage &&
            msg.isClickable &&
            msg.message.includes("Çatıdan inmek için tıkla"),
        );

        if (hasRoofMessage) {
          return prev;
        }

        return [
          ...prev,
          {
            room: roomId || roomName,
            username: "Sistem",
            message: "Çatıdasınız. Çatıdan inmek için tıkla 👆",
            gender: "male",
            isGuest: false,
            timestamp: new Date().toISOString(),
            isSystemMessage: true,
            isClickable: true,
            systemAction: "exitRoof",
          } as Message,
        ];
      });
      return;
    }

    setMessages((prev) =>
      prev.filter(
        (msg) =>
          !(
            msg.isSystemMessage &&
            msg.isClickable &&
            msg.message.includes("Çatıdan inmek için tıkla")
          ),
      ),
    );
  }, [isOnRoof, roomId, roomName, setMessages]);

  // Handle right-click on messages area
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
    });
  };

  // Context menu actions
  const handleClearScreen = async () => {
    if (clearHistoryInProgressRef.current) return;
    clearHistoryInProgressRef.current = true;

    try {
      await apiClient.messages.clearHistory(roomName);
      setMessages(buildRoomDescriptionMessages());
      localStorage.removeItem(`chat-history-${roomName}`);
      toast.success("Chat ekranı temizlendi.");
    } catch (error) {
      console.error("Ekran temizleme hatası:", error);
      toast.error("Ekran temizlenirken bir hata oluştu.");
    } finally {
      clearHistoryInProgressRef.current = false;
    }
  };

  const handleDeleteHistory = () => {
    if (clearHistoryInProgressRef.current || showClearHistoryModal) return;
    setShowClearHistoryModal(true);
  };

  const confirmDeleteHistory = async () => {
    if (clearHistoryInProgressRef.current) return;
    clearHistoryInProgressRef.current = true;
    setShowClearHistoryModal(false);

    try {
      await apiClient.messages.clearHistory(roomName);
      setMessages(buildRoomDescriptionMessages());
      localStorage.removeItem(`chat-history-${roomName}`);
      toast.success("Mesaj geçmişi tüm cihazlardan temizlendi.");
    } catch (error) {
      console.error("Geçmiş silme hatası:", error);
      toast.error("Geçmiş silinirken bir hata oluştu.");
    } finally {
      clearHistoryInProgressRef.current = false;
    }
  };

  const handleDeleteRoomMessagesForEveryone = async () => {
    if (!canDeleteRoomMessages) {
      toast.error("Oda yazılarını silme yetkiniz yok.");
      return;
    }

    const confirmed = window.confirm(
      "Bu odadaki tüm mesajları herkesten silmek istediğinize emin misiniz? Bu işlem geri alınamaz.",
    );
    if (!confirmed) return;

    try {
      await apiClient.messages.clearRoomHistory(roomName);
      setMessages(buildRoomDescriptionMessages());
      localStorage.removeItem(`chat-history-${roomName}`);
      toast.success("Oda yazıları herkesten silindi.");
    } catch (error) {
      console.error("Oda yazılarını silme hatası:", error);
      toast.error("Oda yazıları silinirken bir hata oluştu.");
    }
  };

  const readApiErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof ApiError && error.message?.trim()) {
      return error.message;
    }
    const responseMessage = (error as { response?: { data?: { message?: string } } })
      ?.response?.data?.message;
    return responseMessage?.trim() || fallback;
  };

  const handleClearBannedUsers = async () => {
    const client = getClientApiClient();
    try {
      const response = await client.delete<{
        clearedCount?: number;
        skippedCount?: number;
      }>("/moderation/bans/clear");
      const clearedCount = response.data?.clearedCount ?? 0;
      const skippedCount = response.data?.skippedCount ?? 0;
      toast.success(
        skippedCount > 0
          ? `${clearedCount} ban temizlendi, ${skippedCount} kayıt yetki nedeniyle kaldı.`
          : `${clearedCount} ban temizlendi.`,
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        try {
          const response = await client.get<{
            bannedUsers?: Array<{ id: number }>;
          }>("/moderation/banned-users");
          const bannedUsers = response.data?.bannedUsers ?? [];
          await Promise.all(
            bannedUsers.map((user) =>
              client.delete(`/moderation/unban/${user.id}`),
            ),
          );
          toast.success(`${bannedUsers.length} ban temizlendi.`);
          return;
        } catch (fallbackError) {
          console.error("Banlıları tek tek temizleme hatası:", fallbackError);
          toast.error(
            readApiErrorMessage(fallbackError, "Banlılar temizlenemedi."),
          );
          return;
        }
      }
      console.error("Banlıları temizleme hatası:", error);
      toast.error(readApiErrorMessage(error, "Banlılar temizlenemedi."));
    }
  };

  const handleClearBlockedUsers = async () => {
    const client = getClientApiClient();
    try {
      const response = await client.delete<{
        clearedCount?: number;
      }>("/friends/blocks/clear-all");
      toast.success(`${response.data?.clearedCount ?? 0} engel temizlendi.`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        try {
          const response = await client.get<Array<{ username: string }>>(
            "/friends/blocks",
          );
          const blockedUsers = response.data ?? [];
          await Promise.all(
            blockedUsers.map((user) =>
              client.delete(`/friends/blocks/${encodeURIComponent(user.username)}`),
            ),
          );
          toast.success(`${blockedUsers.length} engel temizlendi.`);
          return;
        } catch (fallbackError) {
          console.error("Engellileri tek tek temizleme hatası:", fallbackError);
          toast.error(
            readApiErrorMessage(fallbackError, "Engelliler temizlenemedi."),
          );
          return;
        }
      }
      console.error("Engellileri temizleme hatası:", error);
      toast.error(readApiErrorMessage(error, "Engelliler temizlenemedi."));
    }
  };

  const handleClearRoomBlocks = async () => {
    const targetRoom = (roomName || "").trim();
    if (!targetRoom) {
      toast.error("Aktif oda bilgisi bulunamadı.");
      return;
    }

    const client = getClientApiClient();
    try {
      const response = await client.delete<{
        clearedCount?: number;
        skippedCount?: number;
      }>(`/moderation/room-mutes/${encodeURIComponent(targetRoom)}/clear`);
      const clearedCount = response.data?.clearedCount ?? 0;
      const skippedCount = response.data?.skippedCount ?? 0;
      toast.success(
        skippedCount > 0
          ? `${clearedCount} oda engeli temizlendi, ${skippedCount} kayıt yetki nedeniyle kaldı.`
          : `${clearedCount} oda engeli temizlendi.`,
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        if (!socket || !socket.connected) {
          toast.error("Sunucu bağlantısı yok.");
          return;
        }

        const mutedUsers = roomUsers.filter((user) => user.roomMuted === true);
        try {
          const results = await Promise.all(
            mutedUsers.map(
              (user) =>
                new Promise<{ status?: "ok" | "error"; message?: string }>(
                  (resolve) => {
                    socket.emit(
                      "moderation:toggleRoomMute",
                      {
                        room: targetRoom,
                        targetUsername: user.username,
                      },
                      (ack: { status?: "ok" | "error"; message?: string }) =>
                        resolve(ack || {}),
                    );
                  },
                ),
            ),
          );
          const clearedCount = results.filter(
            (result) => result.status === "ok",
          ).length;
          const skippedCount = Math.max(mutedUsers.length - clearedCount, 0);
          toast.success(
            skippedCount > 0
              ? `${clearedCount} oda engeli temizlendi, ${skippedCount} kayıt yetki nedeniyle kaldı.`
              : `${clearedCount} oda engeli temizlendi.`,
          );
          return;
        } catch (fallbackError) {
          console.error(
            "Oda engellerini tek tek temizleme hatası:",
            fallbackError,
          );
          toast.error("Oda engelleri temizlenemedi.");
          return;
        }
      }
      console.error("Oda engellerini temizleme hatası:", error);
      toast.error(readApiErrorMessage(error, "Oda engelleri temizlenemedi."));
    }
  };

  const handleClearGlobalMutes = async () => {
    const client = getClientApiClient();
    try {
      const response = await client.delete<{
        clearedCount?: number;
        skippedCount?: number;
      }>("/moderation/global-mutes/clear");
      const clearedCount = response.data?.clearedCount ?? 0;
      const skippedCount = response.data?.skippedCount ?? 0;
      toast.success(
        skippedCount > 0
          ? `${clearedCount} tüm oda susturması temizlendi, ${skippedCount} kayıt yetki nedeniyle kaldı.`
          : `${clearedCount} tüm oda susturması temizlendi.`,
      );
    } catch (error) {
      console.error("Tüm oda susturmalarını temizleme hatası:", error);
      toast.error(
        readApiErrorMessage(error, "Tüm oda susturmaları temizlenemedi."),
      );
    }
  };

  const handleSafeExit = useCallback(async (options?: {
    skipConfirm?: boolean;
    clearDirectHistory?: boolean;
    clearRoomHistory?: boolean;
  }) => {
    if (!options?.skipConfirm) {
      const isConfirmed = window.confirm(
        "Emin misiniz?\n\nGüvenli Çıkış yaptığınızda; giriş sayfasında yeniden rumuz ve -varsa- şifre sorulacaktır.",
      );

      if (!isConfirmed) {
        return;
      }
    }

    const preferences = readChatPreferencesFromStorage();
    const shouldClearRoomHistory =
      preferences.keepRoomChatHistory !== true ||
      options?.clearRoomHistory === true;
    const shouldClearDirectHistory =
      preferences.keepDirectChatHistory !== true ||
      options?.clearDirectHistory === true;
    let hasCleanupError = false;

    if (shouldClearDirectHistory) {
      try {
        await apiClient.directMessages.clearHistory();
      } catch (error) {
        hasCleanupError = true;
        console.error("Güvenli çıkışta özel mesaj geçmişi temizlenemedi:", error);
      }
    }

    if (shouldClearRoomHistory) {
      try {
        const rooms = await apiClient.rooms.getRooms();
        const roomNames = Array.from(
          new Set(
            rooms
              .map((room) => room.name?.trim())
              .filter((name): name is string => Boolean(name)),
          ),
        );

        if (roomNames.length > 0) {
          const results = await Promise.allSettled(
            roomNames.map((name) => apiClient.messages.clearHistory(name)),
          );
          const rejected = results.filter(
            (result): result is PromiseRejectedResult =>
              result.status === "rejected",
          );
          if (rejected.length > 0) {
            hasCleanupError = true;
            console.error(
              "Güvenli çıkışta oda geçmişi temizleme hataları:",
              rejected.map((result) => result.reason),
            );
          }
        }
      } catch (error) {
        hasCleanupError = true;
        console.error("Güvenli çıkışta oda listesi alınamadı:", error);
      }
    }

    if (hasCleanupError) {
      toast.error(
        "Bazı geçmişler temizlenemedi. Güvenli çıkış işlemi devam ediyor.",
      );
    }

    if (socket) {
      emitLeaveOnce(socket, roomId ?? roomName, currentUsername);
      socket.disconnect();
    }

    clearAuthSession();

    // Redirect to home
    window.location.href = "/";
  }, [socket, roomId, roomName, currentUsername, emitLeaveOnce]);

  const handleOpenMobileSafeExitModal = useCallback(() => {
    const preferences = readChatPreferencesFromStorage();
    setMobileSafeExitClearDirect(preferences.keepDirectChatHistory !== true);
    setMobileSafeExitClearRoom(preferences.keepRoomChatHistory !== true);
    setShowMobileSafeExitModal(true);
  }, []);

  const handleWhatsAppShare = useCallback(() => {
    if (typeof window === "undefined") return;

    const shareUrl = window.location.href;
    const text = `ChatsON sohbetine katıl: ${shareUrl}`;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }, []);

  const handleReplyMessage = (
    sender: string,
    content: string,
    messageId?: number,
  ) => {
    setReplyTo({ sender, content, messageId });
  };

  const handleCancelReply = () => {
    setReplyTo(null);
  };

  const handleDeleteMessageForMe = (messageIndex: number) => {
    setMessages((prev) => prev.filter((_, idx) => idx !== messageIndex));
  };

  const renderVisibleMessage = ({
    msg,
    index,
  }: {
    msg: Message;
    index: number;
  }) => {
    const date = msg?.timestamp ? new Date(msg.timestamp) : null;
    const time =
      date && !Number.isNaN(date.getTime())
        ? date.toLocaleTimeString("tr-TR", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "";
    const messageKeyBase =
      msg.id != null
        ? `msg-${msg.id}`
        : [
            msg.timestamp || "no-time",
            msg.originalUsername || msg.username || "no-user",
            msg.message || "no-message",
            msg.systemAction || "no-action",
            msg.image || "no-image",
            msg.audio || "no-audio",
          ].join("|");
    const messageKey = `${messageKeyBase}::${index}`;
    const normalizedSpeakerUsername = (msg.botSpeakerUsername || "")
      .trim()
      .toLocaleLowerCase("tr-TR");
    const speakerRoomUser = normalizedSpeakerUsername
      ? roomUsers.find(
          (user) =>
            user.username.trim().toLocaleLowerCase("tr-TR") ===
            normalizedSpeakerUsername,
        )
      : null;
    const speakerStarCount =
      normalizedSpeakerUsername &&
      currentUsername &&
      normalizedSpeakerUsername === currentUsername.trim().toLocaleLowerCase("tr-TR")
        ? Number(userStarCount ?? 0)
        : Number(speakerRoomUser?.roleStarCount ?? NaN);
    const canViewBotSpeakerLabel =
      Boolean(msg.botSpeakerDisplayName) &&
      Number.isFinite(speakerStarCount) &&
      Number(userStarCount ?? 0) >= speakerStarCount;
    const buildProfileFallbackUser = (profileTarget: string): RoomUser => {
      const originalUsername = msg.originalUsername || msg.username || profileTarget;
      const isAgentProfile =
        Boolean(msg.profileUsername) && msg.profileUsername !== originalUsername;

      return {
        id: `offline-${originalUsername}-${msg.id ?? messageKey}`,
        username: originalUsername,
        displayUsername: msg.username || profileTarget,
        gender: msg.gender,
        isGuest: msg.isGuest || isAgentProfile,
        statusModeName: "Çevrimdışı",
        icon: isAgentProfile ? null : (msg.avatar ?? null),
        agentNickname: isAgentProfile ? profileTarget : null,
        roleName: isAgentProfile ? null : null,
        roleStarCount: msg.roleStarCount ?? null,
        flashNick: isAgentProfile ? null : (msg.flashNick ?? null),
        fontName: isAgentProfile ? null : (msg.fontName ?? null),
        granite: isAgentProfile ? null : (msg.granite ?? null),
        nickColor: isAgentProfile ? null : (msg.nickColor ?? null),
        userGif: isAgentProfile ? null : (msg.userGif ?? null),
      };
    };

    return (
      <ChatMessage
        key={messageKey}
        sender={msg.username}
        profileUsername={msg.profileUsername || msg.originalUsername || msg.username}
        content={msg.message}
        time={time}
        isMe={(msg.originalUsername || msg.username) === currentUsername}
        isSystemMessage={msg.isSystemMessage}
        systemStyle={msg.systemStyle}
        isClickableSystemMessage={msg.isClickable}
        isRoomDescriptionMessage={msg.isRoomDescription}
        onSystemMessageClick={
          msg.isClickable ? () => handleSystemMessageClick(msg) : undefined
        }
        image={msg.image}
        audio={msg.audio}
        audioFileName={msg.audioFileName}
        videoUrl={msg.videoUrl}
        videoTitle={msg.videoTitle}
        videoThumbnail={msg.videoThumbnail}
        videoId={msg.videoId}
        messageFontSize={chatFontSize}
        fontColor={msg.fontColor || undefined}
        messageId={msg.id}
        replyToMessage={msg.replyToMessage}
        targetGroup={msg.targetGroup}
        inspectLoginHistoryId={msg.loginHistoryId}
        canInspectLoginHistory={
          Boolean(msg.loginHistoryId) &&
          canViewIp &&
          userStarCount > Number(msg.loginTargetStarCount ?? 0)
        }
        inspectLoading={
          activeInspectLoginHistoryId === msg.loginHistoryId
            ? bannerInspectLoading
            : null
        }
        onShowLoginLocation={openLoginLocationModal}
        onShowLoginIdentities={openLoginIdentitiesModal}
        onReply={handleReplyMessage}
        onDeleteForMe={() => handleDeleteMessageForMe(index)}
        avatar={msg.avatar}
        flashNick={msg.flashNick}
        fontName={msg.fontName}
        granite={msg.granite}
        nickColor={msg.nickColor}
        botSpeakerName={
          canViewBotSpeakerLabel ? (msg.botSpeakerDisplayName ?? undefined) : undefined
        }
        isWelcomeMessage={msg.isWelcomeMessage}
        isAiWelcomeMessage={msg.isAiWelcomeMessage}
        isWelcomePrompt={msg.systemAction === "sendWelcomeMessage"}
        onShowProfile={(username) => {
          const ts = Date.now();
          const fallbackUser = buildProfileFallbackUser(username);
          if (typeof window !== "undefined" && window.innerWidth < 768) {
            // Mobil: kullanıcıyı direkt bul ve initialSelectedUser olarak geç
            // Böylece sidebar mount olunca profil anında açık gelir, oda listesi gözükmez
            const foundUser = roomUsers.find(
              (u) =>
                u.username.toLocaleLowerCase("tr-TR") === username.toLocaleLowerCase("tr-TR") ||
                (u.agentNickname || "").toLocaleLowerCase("tr-TR") === username.toLocaleLowerCase("tr-TR"),
            ) ?? null;
            setMobileInitialSelectedUser(foundUser ?? fallbackUser);
            setCloseMobileSidebarOnProfileClose(true);
            setMobileProfileOpenRequest({
              username,
              id: ts,
              fallbackUser,
            });
            setMobileSidebarTab("room");
            setIsMobileSidebarOpen(true);
          } else {
            setProfileOpenRequest({ username, id: ts, fallbackUser });
          }
        }}
      />
    );
  };

  const chatThemeClassName =
    "chat-theme-root bg-[var(--chat-app-bg)] text-[var(--chat-text)]";
  const chatMessagesPanelClassName =
    "bg-[var(--chat-messages-bg)]";
  const mobileInputShellClassName =
    "bg-[var(--chat-mobile-input-bg)]";
  const showMobileVoiceSlots =
    communicationPermissions?.showMicrophonesOnMobile !== false;
  const activeMobileVoiceMenuUser = showMobileVoiceSlots
    ? mobileVoiceUsers.find(
        (user) =>
          user.username.trim().toLocaleLowerCase("tr-TR") ===
          (activeMobileVoiceMenuUsername || "")
            .trim()
            .toLocaleLowerCase("tr-TR"),
      )
    : undefined;
  const activeMobileVoiceMenuSlotIndex = activeMobileVoiceMenuUser
    ? mobileVoiceSlots.findIndex(
        (slot) =>
          slot?.username.trim().toLocaleLowerCase("tr-TR") ===
          activeMobileVoiceMenuUser.username.trim().toLocaleLowerCase("tr-TR"),
      )
    : -1;
  const activeMobileVoiceMenuStyle: CSSProperties =
    activeMobileVoiceMenuSlotIndex <= 0
      ? { left: 12 }
      : activeMobileVoiceMenuSlotIndex >= 4
        ? { right: 12 }
        : {
            left: `${(activeMobileVoiceMenuSlotIndex + 0.5) * 20}vw`,
            transform: "translateX(-50%)",
          };
  const chatThemeStyle = CHAT_SITE_THEME_VARS[
    chatSiteTheme
  ] as React.CSSProperties;

  useEffect(() => {
    if (!showMobileVoiceSlots) {
      setActiveMobileVoiceMenuUsername(null);
    }
  }, [showMobileVoiceSlots]);

  const [desktopRooms, setDesktopRooms] = useState<Room[]>([]);
  const [desktopPresenceUsers, setDesktopPresenceUsers] = useState<RoomUser[]>([]);
  const [headerRoster, setHeaderRoster] = useState<{
    chatHeaderLogo: string | null;
    siteName: string | null;
    siteOwners: Array<{
      id: number;
      username: string;
      icon?: string | null;
      gender?: string | null;
      roleName?: string | null;
      starCount?: number | null;
      starColor?: string | null;
    }>;
    managers: Array<{
      id: number;
      username: string;
      icon?: string | null;
      gender?: string | null;
      roleName?: string | null;
      starCount?: number | null;
      starColor?: string | null;
    }>;
  }>({
    chatHeaderLogo: null,
    siteName: null,
    siteOwners: [],
    managers: [],
  });

  useEffect(() => {
    let cancelled = false;

    const loadDesktopRooms = async () => {
      try {
        const rooms = await apiClient.rooms.getRooms();
        if (!cancelled) {
          setDesktopRooms(
            [...rooms].sort((left, right) =>
              Number(left.listOrder ?? 0) - Number(right.listOrder ?? 0),
            ),
          );
        }
      } catch (error) {
        console.error("Desktop rooms could not be loaded:", error);
      }
    };

    void loadDesktopRooms();
    const timer = window.setInterval(() => void loadDesktopRooms(), 30000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadHeaderRoster = async () => {
      try {
        const response = await getClientApiClient().get("/system-settings/public-header-roster", {
          params: { _ts: Date.now() },
        });
        if (!cancelled && response?.data) {
          setHeaderRoster({
            chatHeaderLogo: response.data.chatHeaderLogo ?? null,
            siteName: response.data.siteName ?? null,
            siteOwners: Array.isArray(response.data.siteOwners) ? response.data.siteOwners : [],
            managers: Array.isArray(response.data.managers) ? response.data.managers : [],
          });
        }
      } catch (error) {
        console.error("Header roster could not be loaded:", error);
      }
    };

    const handleRosterUpdated = () => void loadHeaderRoster();
    void loadHeaderRoster();
    const timer = window.setInterval(() => void loadHeaderRoster(), 30000);
    window.addEventListener("kingmobile:header-roster-updated", handleRosterUpdated);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("kingmobile:header-roster-updated", handleRosterUpdated);
    };
  }, []);

  const onlinePresenceUsers = useMemo(() => {
    const source = desktopPresenceUsers.length > 0 ? desktopPresenceUsers : roomUsers;
    const byName = new Map<string, RoomUser>();
    source.forEach((user) => {
      const key = user.username?.trim().toLocaleLowerCase("tr-TR");
      if (!key) return;
      byName.set(key, user);
    });
    return [...byName.values()];
  }, [desktopPresenceUsers, roomUsers]);

  const onlinePresenceNames = useMemo(
    () =>
      new Set(
        onlinePresenceUsers
          .filter((user) => user.statusModeName !== "Çatıda")
          .map((user) => user.username.trim().toLocaleLowerCase("tr-TR")),
      ),
    [onlinePresenceUsers],
  );

  const normalizeRosterUser = useCallback(
    (user: {
      id: number;
      username: string;
      icon?: string | null;
      gender?: string | null;
      roleName?: string | null;
      starCount?: number | null;
      starColor?: string | null;
    }): RoomUser => {
      const liveUser = onlinePresenceUsers.find(
        (candidate) =>
          candidate.username.trim().toLocaleLowerCase("tr-TR") ===
          user.username.trim().toLocaleLowerCase("tr-TR"),
      );
      return {
        ...(liveUser ?? {}),
        id: String(liveUser?.id ?? user.id),
        username: user.username,
        displayUsername: liveUser?.displayUsername ?? user.username,
        gender: (liveUser?.gender ?? user.gender ?? "male") as "male" | "female",
        isGuest: false,
        icon: liveUser?.icon ?? user.icon ?? null,
        roleName: liveUser?.roleName ?? user.roleName ?? undefined,
        roleStarCount: Number(liveUser?.roleStarCount ?? user.starCount ?? 0),
        roleStarColor: liveUser?.roleStarColor ?? user.starColor ?? undefined,
      } as RoomUser;
    },
    [onlinePresenceUsers],
  );

  const desktopSiteOwners = useMemo(() => {
    if (headerRoster.siteOwners.length > 0) {
      return headerRoster.siteOwners.map(normalizeRosterUser);
    }
    return onlinePresenceUsers
      .filter((user) => {
        const normalized = user.username.trim().toLocaleLowerCase("tr-TR");
        return normalized === "root" || Number(user.roleStarCount ?? 0) >= 24;
      })
      .sort(
        (left, right) => Number(right.roleStarCount ?? 0) - Number(left.roleStarCount ?? 0),
      );
  }, [headerRoster.siteOwners, normalizeRosterUser, onlinePresenceUsers]);

  const desktopManagers = useMemo(() => {
    if (headerRoster.managers.length > 0) {
      return headerRoster.managers.map(normalizeRosterUser);
    }
    const owners = new Set(
      desktopSiteOwners.map((user) =>
        user.username.trim().toLocaleLowerCase("tr-TR"),
      ),
    );
    return onlinePresenceUsers
      .filter((user) => {
        const normalized = user.username.trim().toLocaleLowerCase("tr-TR");
        const stars = Number(user.roleStarCount ?? 0);
        return !owners.has(normalized) && stars >= 10;
      })
      .sort(
        (left, right) => Number(right.roleStarCount ?? 0) - Number(left.roleStarCount ?? 0),
      );
  }, [desktopSiteOwners, headerRoster.managers, normalizeRosterUser, onlinePresenceUsers]);

  const desktopOnlineCount = onlinePresenceUsers.length;
  const desktopHeaderLogo = resolveAvatarUrl(headerRoster.chatHeaderLogo);
  const desktopSiteName = headerRoster.siteName?.trim() || "ChatsON";

  const openDesktopRoom = useCallback(
    (room: Room) => {
      const target = String(room.name || room.id || "").trim();
      if (!target) return;
      setRoomNavigationIntent("sidebar");
      router.push(`/chat/${encodeURIComponent(target)}`);
    },
    [router],
  );

  return (
    <div
      className={`kingmobile-desktop-shell relative flex h-[100dvh] overflow-hidden ${chatThemeClassName}`}
      data-chat-theme={chatSiteTheme}
      style={chatThemeStyle}
    >
      <style>{`
        @media (min-width: 768px) {
          .kingmobile-desktop-shell { background: var(--chat-app-bg); color: var(--chat-text); }
          .kingmobile-desktop-shell > .chat-theme-sidebar {
            width: 330px !important;
            height: calc(100dvh - 160px) !important;
            margin-top: 160px !important;
            border-color: var(--chat-border) !important;
            background: var(--chat-sidebar-bg) !important;
          }
          .kingmobile-desktop-shell .chat-theme-sidebar-header {
            background: var(--chat-header-bg) !important;
            border-color: var(--chat-border) !important;
          }
          .kingmobile-desktop-shell .chat-theme-sidebar-content {
            background: var(--chat-sidebar-bg) !important;
            color: var(--chat-text) !important;
          }
          .kingmobile-desktop-shell .chat-theme-sidebar-content .bg-white,
          .kingmobile-desktop-shell .chat-theme-sidebar-content .bg-zinc-100,
          .kingmobile-desktop-shell .chat-theme-sidebar-content .dark\\:bg-white,
          .kingmobile-desktop-shell .chat-theme-sidebar-content .dark\\:bg-zinc-100 {
            background: var(--chat-card-bg) !important;
          }
          .kingmobile-desktop-shell .chat-theme-sidebar-content .text-black,
          .kingmobile-desktop-shell .chat-theme-sidebar-content .text-zinc-800,
          .kingmobile-desktop-shell .chat-theme-sidebar-content .text-zinc-900,
          .kingmobile-desktop-shell .chat-theme-sidebar-content .dark\\:text-black {
            color: var(--chat-text) !important;
          }
          .kingmobile-desktop-shell .chat-theme-sidebar-content .text-zinc-500,
          .kingmobile-desktop-shell .chat-theme-sidebar-content .text-zinc-600,
          .kingmobile-desktop-shell .chat-theme-sidebar-content .text-zinc-700 {
            color: var(--chat-muted) !important;
          }
          .kingmobile-desktop-shell .chat-theme-sidebar-content input {
            border-color: var(--chat-border) !important;
            background: var(--chat-input-bg) !important;
            color: var(--chat-text) !important;
          }
          .kingmobile-desktop-shell .chat-theme-sidebar-content input::placeholder { color: var(--chat-muted) !important; }
          .kingmobile-desktop-shell .kingmobile-chat-input-shell {
            border-top: 1px solid var(--chat-border);
            background: var(--chat-input-shell-bg) !important;
          }
          .kingmobile-desktop-shell .kingmobile-topbar,
          .kingmobile-desktop-shell .kingmobile-roombar {
            background: var(--chat-header-bg) !important;
            border-color: var(--chat-border) !important;
            color: var(--chat-text) !important;
          }
          .kingmobile-desktop-shell .kingmobile-right-panel {
            background: var(--chat-sidebar-bg) !important;
            border-color: var(--chat-border) !important;
            color: var(--chat-text) !important;
          }
          .kingmobile-desktop-shell .kingmobile-panel-card {
            background: var(--chat-card-bg) !important;
            border-color: var(--chat-border) !important;
            color: var(--chat-text) !important;
          }
          .kingmobile-desktop-shell .kingmobile-room-button {
            border-color: var(--chat-border) !important;
            background: var(--chat-card-soft-bg) !important;
            color: var(--chat-text) !important;
          }
          .kingmobile-desktop-shell .kingmobile-room-button[data-active="true"] {
            border-color: var(--chat-accent) !important;
            background: var(--chat-accent-soft) !important;
            color: var(--chat-accent-strong) !important;
          }
          .kingmobile-desktop-shell:not([data-chat-theme="dark"]) .kingmobile-panel-card,
          .kingmobile-desktop-shell:not([data-chat-theme="dark"]) .kingmobile-room-button,
          .kingmobile-desktop-shell:not([data-chat-theme="dark"]) .chat-theme-user-card {
            border-width: 2px !important;
            box-shadow: 0 10px 28px rgba(15,23,42,0.12), inset 0 0 0 1px color-mix(in srgb, var(--chat-border) 78%, transparent);
          }
          .kingmobile-desktop-shell:not([data-chat-theme="dark"]) .kingmobile-topbar,
          .kingmobile-desktop-shell:not([data-chat-theme="dark"]) .kingmobile-roombar,
          .kingmobile-desktop-shell:not([data-chat-theme="dark"]) .kingmobile-right-panel {
            box-shadow: inset 0 -1px 0 color-mix(in srgb, var(--chat-border) 75%, transparent);
          }
          .kingmobile-desktop-shell:not([data-chat-theme="dark"]) .kingmobile-topbar,
          .kingmobile-desktop-shell:not([data-chat-theme="dark"]) .kingmobile-right-panel,
          .kingmobile-desktop-shell:not([data-chat-theme="dark"]) .chat-theme-sidebar-content {
            font-weight: 650;
          }
          .kingmobile-desktop-shell:not([data-chat-theme="dark"]) .kingmobile-topbar,
          .kingmobile-desktop-shell:not([data-chat-theme="dark"]) .kingmobile-roombar,
          .kingmobile-desktop-shell:not([data-chat-theme="dark"]) .kingmobile-right-panel,
          .kingmobile-desktop-shell:not([data-chat-theme="dark"]) .chat-theme-sidebar {
            border-width: 2px !important;
          }
          .kingmobile-desktop-shell:not([data-chat-theme="dark"]) .text-slate-400,
          .kingmobile-desktop-shell:not([data-chat-theme="dark"]) .text-slate-500 {
            font-weight: 650;
          }
          .kingmobile-desktop-shell .kingmobile-right-panel::-webkit-scrollbar { width: 6px; }
          .kingmobile-desktop-shell .kingmobile-right-panel::-webkit-scrollbar-thumb { background: #27364b; border-radius: 999px; }
        }
      `}</style>

      <div className="kingmobile-topbar absolute inset-x-0 top-0 z-40 hidden h-[160px] border-b border-slate-800/90 bg-[#060d17]/98 text-white shadow-[0_16px_44px_rgba(0,0,0,0.42)] backdrop-blur-xl md:block">
        <div className="flex h-[100px] items-center gap-3 overflow-hidden border-b border-slate-800/90 px-4 pr-[400px]">
          <div className="flex w-[310px] shrink-0 items-center pr-3">
            <div className="relative flex h-[72px] w-full items-center justify-center overflow-hidden rounded-[22px] border-2 border-violet-400/35 bg-gradient-to-br from-violet-600/18 via-blue-500/10 to-cyan-400/10 px-5 shadow-[0_0_34px_rgba(124,58,237,0.18)]">
              {desktopHeaderLogo ? (
                <img
                  src={desktopHeaderLogo}
                  alt={desktopSiteName}
                  className="max-h-[58px] w-full object-contain"
                />
              ) : (
                <span className="bg-gradient-to-r from-amber-200 via-violet-300 to-cyan-300 bg-clip-text text-3xl font-black tracking-[-0.04em] text-transparent">
                  ChatsON
                </span>
              )}
              <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent" />
            </div>
          </div>

          <div className="w-fit min-w-[210px] max-w-[460px] shrink-0 rounded-[20px] border-2 border-amber-300/30 bg-gradient-to-r from-amber-300/[0.10] via-amber-200/[0.04] to-transparent px-3.5 py-2.5 shadow-[0_10px_30px_rgba(251,191,36,0.08)]">
            <div className="mb-1.5 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-amber-300/90">
              <Crown className="h-3.5 w-3.5" />
              Site Sahipleri
            </div>
            <div className="flex min-w-0 items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {desktopSiteOwners.length > 0 ? desktopSiteOwners.map((user) => {
                const avatar = calculateAvatar(user.icon);
                const isOnline = onlinePresenceNames.has(user.username.trim().toLocaleLowerCase("tr-TR"));
                return (
                  <button
                    key={`owner-${user.id}-${user.username}`}
                    type="button"
                    onClick={() => setProfileOpenRequest({ username: user.username, id: Date.now(), fallbackUser: user })}
                    className="group flex shrink-0 items-center gap-2.5 rounded-2xl border-2 border-amber-300/35 bg-[var(--chat-card-bg)] px-2.5 py-2 text-left shadow-[0_8px_24px_rgba(251,191,36,0.09)] transition hover:-translate-y-0.5 hover:border-amber-300/65"
                  >
                    <span className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border-2 border-amber-300/50 bg-slate-800 text-xs font-black text-amber-100 shadow-[0_0_16px_rgba(251,191,36,0.08)]">
                      {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : (user.displayUsername || user.username).slice(0, 1).toUpperCase()}
                      <span className={`absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full border-2 border-slate-900 ${isOnline ? "bg-emerald-400" : "bg-slate-500"}`} />
                    </span>
                    <span className="min-w-0 pr-1">
                      <span className="block max-w-[120px] truncate text-sm font-black tracking-tight text-amber-100">{user.displayUsername || user.agentNickname || user.username}</span>
                      <span className={`mt-0.5 block text-[9px] font-bold uppercase tracking-wide ${isOnline ? "text-emerald-400" : "text-[var(--chat-muted)]"}`}>{isOnline ? "Online" : "Offline"}</span>
                    </span>
                  </button>
                );
              }) : (
                <span className="px-2 py-2 text-[11px] font-semibold text-[var(--chat-muted)]">Liste boş</span>
              )}
            </div>
          </div>

          <div className="relative flex h-[76px] w-[154px] shrink-0 flex-col items-center justify-center overflow-hidden rounded-[20px] border-2 border-emerald-300/30 bg-gradient-to-br from-emerald-500/10 via-cyan-500/5 to-transparent shadow-[0_0_26px_rgba(16,185,129,0.08)]">
            <div className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/70 to-transparent" />
            <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.18em] text-emerald-400/80">
              <Activity className="h-3.5 w-3.5" /> Canlı
            </div>
            <div className="mt-0.5 text-[26px] font-black leading-none text-[var(--chat-text)]">{desktopOnlineCount}</div>
            <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.11em] text-[var(--chat-muted)]">Online kullanıcı</div>
          </div>

          <div className="min-w-[250px] flex-1 overflow-hidden rounded-[20px] border-2 border-cyan-300/25 bg-gradient-to-r from-cyan-300/[0.08] via-sky-300/[0.03] to-transparent px-3.5 py-2.5 shadow-[0_10px_28px_rgba(34,211,238,0.06)]">
            <div className="mb-1.5 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-300/90">
              <ShieldCheck className="h-3.5 w-3.5" />
              Yönetim Listesi
            </div>
            <div className="flex min-w-0 items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {desktopManagers.length > 0 ? desktopManagers.map((user) => {
                const avatar = calculateAvatar(user.icon);
                const isOnline = onlinePresenceNames.has(user.username.trim().toLocaleLowerCase("tr-TR"));
                return (
                  <button
                    key={`manager-${user.id}-${user.username}`}
                    type="button"
                    onClick={() => setProfileOpenRequest({ username: user.username, id: Date.now(), fallbackUser: user })}
                    className="group flex shrink-0 items-center gap-2.5 rounded-2xl border-2 border-cyan-300/28 bg-[var(--chat-card-bg)] px-2.5 py-2 text-left shadow-[0_8px_24px_rgba(34,211,238,0.07)] transition hover:-translate-y-0.5 hover:border-cyan-300/55"
                  >
                    <span className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border-2 border-cyan-300/40 bg-slate-800 text-xs font-black text-cyan-100">
                      {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : (user.displayUsername || user.username).slice(0, 1).toUpperCase()}
                      <span className={`absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full border-2 border-slate-900 ${isOnline ? "bg-emerald-400" : "bg-slate-500"}`} />
                    </span>
                    <span className="min-w-0 pr-1">
                      <span className="block max-w-[110px] truncate text-sm font-black tracking-tight text-cyan-50">{user.displayUsername || user.agentNickname || user.username}</span>
                      <span className="mt-0.5 block text-[9px] font-bold text-violet-400">★ {Number(user.roleStarCount ?? 0)} · {isOnline ? "ONLINE" : "OFF"}</span>
                    </span>
                  </button>
                );
              }) : (
                <span className="px-2 py-2 text-[11px] font-semibold text-[var(--chat-muted)]">Liste boş</span>
              )}
            </div>
          </div>
        </div>

        <div className="kingmobile-roombar flex h-[60px] items-center gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="mr-1 flex shrink-0 items-center gap-2 text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">
            <UsersRound className="h-4 w-4" />
            Odalar
          </div>
          {desktopRooms.length > 0 ? desktopRooms.map((room) => {
            const active = String(room.name).trim().toLocaleLowerCase("tr-TR") === String(roomDetail?.name || roomName).trim().toLocaleLowerCase("tr-TR");
            return (
              <button
                key={`desktop-room-${room.id}-${room.name}`}
                type="button"
                onClick={() => openDesktopRoom(room)}
                data-active={active ? "true" : "false"}
                className={`kingmobile-room-button flex h-10 shrink-0 items-center gap-2 rounded-xl border px-3.5 text-xs font-bold transition ${active ? "border-violet-400/60 bg-gradient-to-r from-violet-600/40 to-blue-600/30 text-white shadow-[0_0_18px_rgba(124,58,237,0.22)]" : "border-slate-800 bg-slate-900/65 text-slate-300 hover:border-slate-700 hover:bg-slate-800"}`}
              >
                {room.isPrivate ? <LockKeyhole className="h-3.5 w-3.5 text-amber-300" /> : room.radioPanelLink ? <Radio className="h-3.5 w-3.5 text-cyan-300" /> : <MessageSquare className="h-3.5 w-3.5 text-slate-400" />}
                <span className="max-w-[145px] truncate">{room.name}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] ${active ? "bg-white/10 text-white" : "bg-slate-800 text-slate-400"}`}>{room.visibleUserCount ?? 0}</span>
              </button>
            );
          }) : <span className="text-xs text-slate-500">Oda bulunamadı</span>}
        </div>
      </div>

      {/* Error Toast */}
      {joinError && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-full px-4">
          <div className="bg-red-500 text-white px-6 py-4 rounded-lg shadow-lg flex items-start gap-3">
            <svg
              className="w-6 h-6 shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="flex-1">
              <p className="font-semibold">Hata</p>
              <p className="text-sm mt-1">{joinError}</p>
              <p className="text-xs mt-2 opacity-90">
                Ana sayfaya yönlendiriliyorsunuz...
              </p>
            </div>
          </div>
        </div>
      )}

      <ChatSidebar
        users={roomUsers}
        forceVisible={false}
        onBotUserPatch={(username, patch) => {
          const normalizedUsername = username.trim().toLowerCase();
          const currentRoomKeys = [roomId, roomName]
            .map((value) =>
              String(value || "")
                .trim()
                .toLocaleLowerCase("tr-TR"),
            )
            .filter(Boolean);
          const patchRoomKeys = (patch.rooms ?? [])
            .flatMap((room) => [room.roomKey, room.roomName])
            .map((value) =>
              String(value || "")
                .trim()
                .toLocaleLowerCase("tr-TR"),
            )
            .filter(Boolean);
          const patchTargetsCurrentRoom =
            patchRoomKeys.length === 0 ||
            currentRoomKeys.length === 0 ||
            patchRoomKeys.some((roomKey) => currentRoomKeys.includes(roomKey));

          setRoomUsers((prev) => {
            if (Array.isArray(patch.rooms) && patch.rooms.length === 0) {
              return prev.filter(
                (user) =>
                  !user.isBot ||
                  user.username.trim().toLowerCase() !== normalizedUsername,
              );
            }

            if (Array.isArray(patch.rooms) && !patchTargetsCurrentRoom) {
              return prev.filter(
                (user) =>
                  !user.isBot ||
                  user.username.trim().toLowerCase() !== normalizedUsername,
              );
            }

            const existingIndex = prev.findIndex(
              (user) =>
                user.isBot &&
                user.username.trim().toLowerCase() === normalizedUsername,
            );

            const mergeBot = (user: RoomUser): RoomUser => ({
              ...user,
              ...patch,
              isBot: true,
              username: patch.username ?? user.username,
              displayUsername:
                patch.displayUsername ?? user.displayUsername ?? username,
              gender: patch.gender ?? user.gender,
              isGuest: patch.isGuest ?? user.isGuest ?? false,
              isInVoiceChat: patch.isInVoiceChat ?? user.isInVoiceChat,
              isMuted: patch.isMuted ?? user.isMuted,
              isCameraOn: patch.isCameraOn ?? user.isCameraOn,
              isHandRaised: patch.isHandRaised ?? user.isHandRaised,
              handRaisedAt:
                patch.handRaisedAt !== undefined
                  ? patch.handRaisedAt
                  : user.handRaisedAt,
              roomMuted: patch.roomMuted ?? user.roomMuted,
              globalMuted: patch.globalMuted ?? user.globalMuted,
              rooms: patch.rooms ?? user.rooms,
            });

            if (existingIndex !== -1) {
              return prev.map((user, index) =>
                index === existingIndex ? mergeBot(user) : user,
              );
            }

            if (Array.isArray(patch.rooms) && patch.rooms.length > 0) {
              const nextBot: RoomUser = {
                id: patch.id ?? patch.socketId ?? `bot_${username}`,
                username: patch.username ?? username,
                displayUsername: patch.displayUsername ?? username,
                gender: patch.gender ?? "female",
                isGuest: patch.isGuest ?? false,
                isBot: true,
                ...patch,
              };
              return [...prev, nextBot];
            }

            return prev;
          });
        }}
        currentUserStarCount={userStarCount}
        currentUserIsGuest={currentUserIsGuest}
        currentUserRoleReady={currentUserRoleReady}
        currentUserRoleSnapshot={currentUserRoleSnapshot}
        currentUserPermissions={currentUserPermissions}
        currentRolePermissions={currentRolePermissions}
        speakingUsers={speakingUsers}
        socket={socket}
        currentRoomId={roomId}
        currentRoomName={roomName}
        profileOpenRequest={profileOpenRequest}
        onProfileOpenHandled={() => setProfileOpenRequest(null)}
        onStartVoiceCall={startVoiceCall}
        onStartVideoCall={startVideoCall}
        onFriendActivity={handleFriendActivity}
        onTenantJoinEffect={handleTenantJoinEffect}
        onCountsChange={setSidebarCounts}
        onActiveTenantUsersChange={setDesktopPresenceUsers}
        hideRoomsNavButton
        communicationPermissions={communicationPermissions}
        chatPermissions={chatPermissions}
        onMicInviteAccepted={async (payload) => {
          if (roomId && payload.room && String(payload.room) !== String(roomId)) {
            toast.error("Mikrofon daveti farklı bir oda için geçersiz.");
            return;
          }

          const wasInVoiceChat = isInVoiceChat;
          const wasMuted = isMuted;

          if (!wasInVoiceChat) {
            await joinVoiceChat();
            await new Promise((resolve) => setTimeout(resolve, 200));
          }

          const shouldUnmute = wasInVoiceChat ? wasMuted : true;
          if (shouldUnmute) {
            if (micWaitRemainingSeconds > 0) {
              toast.warning(
                `Mikrofonu açmak için ${micWaitRemainingSeconds} sn beklemelisiniz.`,
              );
              return;
            }
            await Promise.resolve(toggleMute());
          }
        }}
        callHistory={callHistory}
        onDeleteCallHistory={deleteCallHistoryEntry}
      />

      <aside className="kingmobile-right-panel absolute bottom-0 right-0 top-[160px] z-30 hidden w-[330px] flex-col gap-3 overflow-y-auto border-l border-slate-800/90 bg-[#07111c] p-3 text-slate-100 md:flex">
        <section className="kingmobile-panel-card rounded-2xl border border-slate-800 bg-[#0b1623] p-4 shadow-[0_10px_30px_rgba(0,0,0,0.18)]">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-[0.1em] text-slate-300">Oda Bilgileri</h3>
            {canAccessAdminPanel ? (
              <button type="button" onClick={handleManageRoom} className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-slate-300 transition hover:bg-slate-700" title="Odayı yönet">
                <Settings className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-violet-600 to-blue-600 text-sm font-black text-white">
              {roomDetail?.logo ? <img src={roomDetail.logo} alt="" className="h-full w-full object-cover" /> : (roomDetail?.name || roomName).slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="truncate text-base font-black text-white">{roomDetail?.name || roomName}</div>
              <div className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-slate-400">{roomDetail?.description || "ChatsON sohbet odası"}</div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <div><span className="block text-[10px] uppercase text-slate-500">Oda Sahibi</span><span className="mt-0.5 block truncate font-bold text-amber-200">{roomDetail?.owner?.username || "-"}</span></div>
            <div><span className="block text-[10px] uppercase text-slate-500">Katılımcı</span><span className="mt-0.5 block font-bold text-slate-200">{sidebarCounts.roomUsersCount} / {roomDetail?.maxUsers || 0}</span></div>
            <div><span className="block text-[10px] uppercase text-slate-500">Oda ID</span><span className="mt-0.5 block font-bold text-slate-200">#{roomDetail?.id ?? "-"}</span></div>
            <div><span className="block text-[10px] uppercase text-slate-500">Minimum Rütbe</span><span className="mt-0.5 block font-bold text-violet-200">★ {roomDetail?.minStar ?? 0}</span></div>
          </div>
        </section>

        <section className="kingmobile-panel-card rounded-2xl border border-slate-800 bg-[#0b1623] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.1em] text-slate-300"><Mic className="h-4 w-4 text-emerald-400" /> Aktif Sesliler</h3>
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">{mobileVoiceUsers.length}</span>
          </div>
          {mobileVoiceUsers.length > 0 ? (
            <div className="grid grid-cols-4 gap-2">
              {mobileVoiceUsers.slice(0, 8).map((user) => {
                const avatar = calculateAvatar(user.icon);
                return (
                  <button key={`desktop-voice-${user.id}-${user.username}`} type="button" onClick={() => setProfileOpenRequest({ username: user.username, id: Date.now(), fallbackUser: user })} className="group min-w-0 text-center">
                    <span className={`mx-auto flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border-2 bg-slate-800 ${speakingUsers.has(user.username) && !user.isMuted ? "border-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.35)]" : "border-slate-700"}`}>
                      {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : <span className="text-xs font-black text-white">{(user.displayUsername || user.username).slice(0, 1).toUpperCase()}</span>}
                    </span>
                    <span className="mt-1 block truncate text-[10px] font-bold text-slate-300 group-hover:text-white">{user.displayUsername || user.agentNickname || user.username}</span>
                  </button>
                );
              })}
            </div>
          ) : <div className="rounded-xl bg-slate-900/55 px-3 py-5 text-center text-xs text-slate-500">Şu anda aktif sesli yok</div>}
        </section>

        <section className="kingmobile-panel-card rounded-2xl border border-violet-500/15 bg-gradient-to-br from-violet-500/10 to-slate-900/20 p-4">
          <h3 className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.1em] text-violet-300"><MessageSquare className="h-4 w-4" /> Oda Duyurusu</h3>
          <p className="text-xs leading-relaxed text-slate-300">{roomDetail?.description || "Oda duyurusu henüz eklenmedi."}</p>
          {roomDetail?.owner?.username ? <div className="mt-2 text-right text-[10px] font-semibold text-violet-300">— {roomDetail.owner.username}</div> : null}
        </section>

        <section className="kingmobile-panel-card rounded-2xl border border-blue-500/15 bg-[#0b1623] p-4">
          <h3 className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.1em] text-blue-300"><Radio className="h-4 w-4" /> Oda Radyosu</h3>
          {(roomDetail?.radioPanelLink || radioLink) ? (
            <>
              <div className="flex items-center justify-between">
                <div><div className="text-sm font-black text-white">Radyo Yayını</div><div className="mt-0.5 text-[10px] font-semibold text-emerald-300">Canlı bağlantı mevcut</div></div>
                <button type="button" onClick={() => window.open(roomDetail?.radioPanelLink || radioLink || "", "_blank", "noopener,noreferrer")} className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-600 text-white shadow-lg" title="Radyoyu aç"><Radio className="h-4 w-4" /></button>
              </div>
            </>
          ) : <div className="text-xs text-slate-500">Bu odada radyo bağlantısı tanımlı değil.</div>}
        </section>
      </aside>

      <button
        type="button"
        onClick={() => {
          setCloseMobileSidebarOnProfileClose(false);
          setMobileInitialSelectedUser(null);
          setMobileSidebarTab("rooms");
          setIsMobileSidebarOpen(true);
        }}
        className="fixed left-0 top-1/2 z-[105] flex h-14 w-9 -translate-y-1/2 items-center justify-center rounded-r-[18px] border-2 border-l-0 border-violet-300/40 bg-[#08111f]/96 text-white shadow-[8px_8px_28px_rgba(0,0,0,0.34)] backdrop-blur-xl transition active:scale-95 md:hidden"
        aria-label="Oda listesini aç"
        title="Odalar"
      >
        <UsersRound className="h-5 w-5 text-cyan-200" />
      </button>

      <button
        type="button"
        onClick={() => {
          setCloseMobileSidebarOnProfileClose(false);
          setMobileInitialSelectedUser(null);
          setMobileSidebarTab("room");
          setIsMobileSidebarOpen(true);
        }}
        className="fixed right-0 top-1/2 z-[105] flex h-14 w-9 -translate-y-1/2 items-center justify-center rounded-l-[18px] border-2 border-r-0 border-cyan-300/40 bg-[#08111f]/96 text-white shadow-[-8px_8px_28px_rgba(0,0,0,0.34)] backdrop-blur-xl transition active:scale-95 md:hidden"
        aria-label="Kişi listesini aç"
        title="Kişiler"
      >
        <UserRound className="h-5 w-5 text-violet-200" />
      </button>

      {isMobileSidebarOpen ? (
        <div
          className={`fixed inset-0 z-[140] flex md:hidden ${
            mobileSidebarTab === "rooms" || mobileSidebarTab === "calls"
              ? "items-stretch justify-start bg-black/25"
              : "items-stretch justify-end bg-black/25"
          }`}
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Liste panelini kapat"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
          <div
            className={`relative z-10 mt-[18svh] h-[64svh] w-[46vw] min-w-[176px] max-w-[300px] overflow-hidden border-2 border-slate-300/70 bg-[#f4f4f6] shadow-2xl ${
              mobileSidebarTab === "rooms" || mobileSidebarTab === "calls"
                ? "rounded-r-[22px] border-l-0"
                : "rounded-l-[22px] border-r-0"
            }`}
          >
            {(mobileSidebarTab === "room" || mobileSidebarTab === "all") ? (
              <div className="absolute left-2 right-2 top-2 z-20 grid grid-cols-2 gap-1 rounded-xl border border-zinc-200 bg-white/95 p-1 shadow-sm">
                <button type="button" onClick={() => setMobileSidebarTab("room")} className={`rounded-lg px-2 py-1.5 text-[10px] font-black ${mobileSidebarTab === "room" ? "bg-zinc-900 text-white" : "text-zinc-500"}`}>ODADAKİLER</button>
                <button type="button" onClick={() => setMobileSidebarTab("all")} className={`rounded-lg px-2 py-1.5 text-[10px] font-black ${mobileSidebarTab === "all" ? "bg-zinc-900 text-white" : "text-zinc-500"}`}>TÜM KİŞİLER</button>
              </div>
            ) : null}
            <div className={(mobileSidebarTab === "room" || mobileSidebarTab === "all") ? "h-full pt-12" : "h-full"}>
            <ChatSidebar
              users={roomUsers}
              forceVisible
              defaultTab={mobileSidebarTab}
              mobileRoomOnly={mobileSidebarTab === "room"}
              mobileAllUsersFullscreen={mobileSidebarTab === "all"}
              mobileRoomsFullscreen={
                mobileSidebarTab === "rooms" || mobileSidebarTab === "calls"
              }
              onMobileRoomClose={() => {
                setIsMobileSidebarOpen(false);
                setMobileInitialSelectedUser(null);
                setCloseMobileSidebarOnProfileClose(false);
              }}
              currentUserStarCount={userStarCount}
              currentUserIsGuest={currentUserIsGuest}
              currentUserRoleReady={currentUserRoleReady}
              currentUserRoleSnapshot={currentUserRoleSnapshot}
              currentUserPermissions={currentUserPermissions}
              currentRolePermissions={currentRolePermissions}
              speakingUsers={speakingUsers}
              socket={socket}
              currentRoomId={roomId}
              currentRoomName={roomName}
              profileOpenRequest={mobileProfileOpenRequest}
              onProfileOpenHandled={() => setMobileProfileOpenRequest(null)}
              initialSelectedUser={mobileInitialSelectedUser}
              closeMobileRoomOnProfileClose={closeMobileSidebarOnProfileClose}
              onStartVoiceCall={startVoiceCall}
              onStartVideoCall={startVideoCall}
              onFriendActivity={handleFriendActivity}
              onTenantJoinEffect={handleTenantJoinEffect}
              onCountsChange={setSidebarCounts}
              communicationPermissions={communicationPermissions}
              chatPermissions={chatPermissions}
              onMicInviteAccepted={async (payload) => {
                if (roomId && payload.room && String(payload.room) !== String(roomId)) {
                  toast.error("Mikrofon daveti farklı bir oda için geçersiz.");
                  return;
                }

                const wasInVoiceChat = isInVoiceChat;
                const wasMuted = isMuted;

                if (!wasInVoiceChat) {
                  await joinVoiceChat();
                  await new Promise((resolve) => setTimeout(resolve, 200));
                }

                const shouldUnmute = wasInVoiceChat ? wasMuted : true;
                if (shouldUnmute) {
                  if (micWaitRemainingSeconds > 0) {
                    toast.warning(
                      `Mikrofonu açmak için ${micWaitRemainingSeconds} sn beklemelisiniz.`,
                    );
                    return;
                  }
                  await Promise.resolve(toggleMute());
                }
              }}
              callHistory={callHistory}
              onDeleteCallHistory={deleteCallHistoryEntry}
            />
            </div>
          </div>
        </div>
      ) : null}

      {/* Chat Area - Daha çok yer kaplayan alan */}
      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden md:mr-[330px] md:pt-[160px]">
        {activeJoinEffect && !disableJoinEffectsEnabled && (
          <div className="join-effect-host">
            <div className="join-effect-banner-wrap">
              <div
                className={`join-effect-banner join-effect-${activeJoinEffect.joinEffect} ${
                  activeJoinEffectDef?.previewType === "gif"
                    ? "join-effect-banner--gif"
                    : ""
                } ${
                  activeJoinEffectDef?.previewType === "gif" &&
                  isMobileJoinEffectMode &&
                  !shouldRenderJoinEffectGif
                    ? "join-effect-banner--mobile-static-gif"
                    : ""
                }`}
              >
                {shouldRenderJoinEffectGif && (
                    <img
                      src={activeJoinEffectDef.gifPath}
                      alt={activeJoinEffectDef.title}
                      loading="lazy"
                      className="join-effect-gif-bg"
                    />
                  )}
                <div className="join-effect-banner__inner">
                  <div className="join-effect-content-overlay">
                    <div className="join-effect-avatar">
                      {activeJoinEffectAvatar ? (
                        <img src={activeJoinEffectAvatar} alt="avatar" />
                      ) : (
                        resolveViewerAwareDisplayName(
                          activeJoinEffect,
                          userStarCount,
                        )
                          .slice(0, 2)
                          .toUpperCase()
                      )}
                    </div>
                    <div className="join-effect-text">
                      <p className="join-effect-title">
                        <span className="join-effect-title__username">
                          {resolveViewerAwareDisplayName(
                            activeJoinEffect,
                            userStarCount,
                          )}
                        </span>{" "}
                        {activeJoinEffectEntryType === "site"
                          ? "siteye giriş yaptı"
                          : "odaya giriş yaptı"}
                      </p>
                    </div>
                  </div>
                  <div
                    className="join-effect-side"
                    style={{
                      color:
                        activeJoinEffect.roleStarColor && activeJoinEffect.roleStarColor.trim()
                          ? activeJoinEffect.roleStarColor
                          : undefined,
                    }}
                  >
                    {(() => {
                      if (activeJoinEffect.agentNickname) return "Çevrimiçi";

                      // Öncelik 1: 2-16 rütbe arasıysa yıldız sayısı kadar sembol koy
                      if (activeJoinEffect.roleStarCount && activeJoinEffect.roleStarCount >= 2 && activeJoinEffect.roleStarCount <= 16) {
                        return "★".repeat(activeJoinEffect.roleStarCount);
                      }

                      // Öncelik 2: roleIcon (17+ rütbeler için)
                      if (activeJoinEffect.roleIcon && typeof activeJoinEffect.roleIcon === "string" && activeJoinEffect.roleIcon.trim() !== "") {
                        return activeJoinEffect.roleIcon;
                      }

                      // Öncelik 3: roleName
                      if (activeJoinEffect.roleName && activeJoinEffect.roleName.trim() !== "" && activeJoinEffect.roleName !== "undefined" && activeJoinEffect.roleName !== "null") {
                        return activeJoinEffect.roleName;
                      }

                      // Öncelik 4: Yıldız sembolü
                      if (activeJoinEffect.roleStarCount && activeJoinEffect.roleStarCount > 0) {
                        return "★".repeat(Math.max(1, Math.min(activeJoinEffect.roleStarCount, 12)));
                      }

                      return "Çevrimiçi";
                    })()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {bannerInspectModal?.type === "location" ? (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-4">
            <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-xl">
              <div className="border-b border-zinc-200 px-5 py-4">
                <h3 className="text-lg font-semibold text-zinc-900">
                  Konum Bilgileri
                </h3>
              </div>
              <div className="space-y-4 px-5 py-4">
                {[
                  ["Şehir", bannerInspectModal.data.city],
                  ["İlçe", bannerInspectModal.data.district],
                  ["Ülke", bannerInspectModal.data.country],
                  ["Ip Adresi", bannerInspectModal.data.ipAddress],
                  ["Hizmet Sağlayıcı", bannerInspectModal.data.isp],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-start gap-3 border-b border-zinc-100 pb-3 text-sm text-zinc-700 last:border-b-0 last:pb-0"
                  >
                    <span className="mt-0.5 text-zinc-400">◉</span>
                    <p>
                      <span className="font-semibold text-zinc-900">{label}</span>
                      {" : "}
                      <span>{value || "Bilinmiyor"}</span>
                    </p>
                  </div>
                ))}
              </div>
              <div className="flex justify-end border-t border-zinc-200 bg-zinc-50 px-5 py-4">
                <button
                  type="button"
                  onClick={() => setBannerInspectModal(null)}
                  className="rounded-md bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600"
                >
                  Tamam
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {bannerInspectModal?.type === "identities" ? (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-4">
            <div className="w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-xl">
              <div className="flex items-center justify-between bg-blue-600 px-4 py-3 text-white">
                <h3 className="text-base font-semibold">Giriş Rumuzları</h3>
                <button
                  type="button"
                  onClick={() => setBannerInspectModal(null)}
                  className="rounded bg-white/90 px-2 py-1 text-xs font-semibold text-zinc-900"
                >
                  X
                </button>
              </div>
              <div className="max-h-[50vh] space-y-3 overflow-y-auto px-4 py-4">
                {bannerInspectModal.data.identities.length === 0 ? (
                  <p className="text-sm text-zinc-500">
                    Bu IP için kayıtlı rumuz bulunamadı.
                  </p>
                ) : (
                  bannerInspectModal.data.identities.map((identity: LoginIpIdentityResponse["identities"][number]) => (
                    <div
                      key={`${identity.displayName}-${identity.lastLoginDate}`}
                      className="flex items-center justify-between gap-3 text-sm text-zinc-800"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-green-500">↪</span>
                        <span>{identity.displayName}</span>
                      </div>
                      {identity.isGuest ? (
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-600">
                          Misafir
                        </span>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : null}
        <VoiceCallOverlay
          callState={callState}
          remoteUsers={callRemoteUsers}
          localVideoTrack={localVideoTrack}
          onAccept={acceptCall}
          onReject={rejectCall}
          onCancel={cancelCall}
          onEnd={endCall}
        />
        {/* Desktop room details moved to the modern right panel. Mobile header remains unchanged below. */}

        {/* Main Chat Content Area (Header + Messages) */}
        <div 
          className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-cover bg-center bg-no-repeat"
          style={chatBackgroundStyle}
          onContextMenu={handleContextMenu}
        >
          {/* Mobile Header (Fixed at top of chat area) */}
          <div className="block md:hidden shrink-0 z-20">
            <ChatHeader
              name={roomName}
              ownerName={roomDetail?.owner?.username}
              ownerRole={roomDetail?.owner?.role?.name}
              ownerAvatar={ownerAvatar}
              description={roomDetail?.description}
              mobileBackgroundImage={chatBackground}
              onMobileBack={() => {
                setCloseMobileSidebarOnProfileClose(false);
                setMobileInitialSelectedUser(null);
                setMobileSidebarTab("rooms");
                setIsMobileSidebarOpen(true);
              }}
              mobileActions={
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setCloseMobileSidebarOnProfileClose(false);
                      setMobileInitialSelectedUser(null);
                      setMobileSidebarTab("all");
                      setIsMobileSidebarOpen(true);
                    }}
                    className={`relative flex h-8 items-center rounded-xl transition-all active:scale-95 active:opacity-80 ${mobileSoftButtonFrame}`}
                    aria-label="Tüm kullanıcıları aç"
                    title="Tüm kullanıcılar"
                  >
                    <div className="flex h-full items-center gap-1 rounded-xl bg-[var(--chat-mobile-control-bg)] px-2.5 text-white backdrop-blur-md">
                      <Flame className="h-3.5 w-3.5 text-amber-300" />
                      <span className="text-[11px] font-black text-white">
                        {effectiveMobileAllUsersCount}
                      </span>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowMobileRoomDesignPicker(true)}
                    className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all active:scale-95 active:opacity-80 ${mobileSoftButtonFrame}`}
                    aria-label="Kişisel oda dizaynı seç"
                    title="Kişisel oda dizaynı"
                  >
                    <span className={mobileSoftButtonInner}>
                      <ImageIcon className="h-3.5 w-3.5" />
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenMobileSafeExitModal}
                    className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all active:scale-95 active:opacity-80 ${mobileSoftButtonFrame}`}
                    aria-label="Çıkış"
                    title="Çıkış"
                  >
                    <span className={mobileSoftButtonInner}>
                      <Power className="h-3.5 w-3.5" />
                    </span>
                  </button>
                </>
              }
              mobileVoiceSlots={
                showMobileVoiceSlots ? (
                  <>
                  {activeMobileVoiceMenuUser ? (
                    <>
                      <button
                        type="button"
                        className="fixed inset-0 z-[420] cursor-default bg-transparent md:hidden"
                        aria-label="Mikrofon menüsünü kapat"
                        onClick={() => setActiveMobileVoiceMenuUsername(null)}
                      />
                      <div
                        className="fixed top-[104px] z-[430] w-max max-w-[calc(100vw-24px)] overflow-hidden rounded-[10px] bg-white/95 text-[13px] text-[#007aff] shadow-xl ring-1 ring-black/5 backdrop-blur-md md:hidden"
                        style={activeMobileVoiceMenuStyle}
                      >
                        <div className="flex h-7 items-center gap-1.5 border-b border-zinc-200/80 px-2.5 text-left text-zinc-700">
                          <span className="min-w-0 flex-1 truncate font-semibold">
                            {resolveViewerAwareDisplayName(
                              activeMobileVoiceMenuUser,
                              userStarCount,
                            )}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleLeaveMobileVoiceChat}
                          className="flex h-8 w-full items-center gap-1.5 whitespace-nowrap border-b border-zinc-200/80 px-2.5 text-left text-red-500"
                        >
                          <Power className="h-4 w-4" />
                          <span>Mikrofon bırak</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleToggleOwnMobileVoiceMute}
                          className="flex h-8 w-full items-center gap-1.5 whitespace-nowrap px-2.5 text-left text-[#007aff]"
                        >
                          {isMuted ? (
                            <Mic className="h-4 w-4" />
                          ) : (
                            <MicOff className="h-4 w-4" />
                          )}
                          <span>
                            {isMuted ? "Mikrofonu aç" : "Mikrofonu kapat"}
                          </span>
                        </button>
                      </div>
                    </>
                  ) : null}
                  {mobileVoiceSlots.map((voiceUser, index) => {
                    if (!voiceUser) {
                      return (
                        <button
                          key={`mobile-voice-slot-empty-${index}`}
                          type="button"
                          onClick={() => {
                            void handleJoinMobileVoiceSlot(index);
                          }}
                          className="flex min-w-0 flex-col items-center gap-1 text-white"
                          aria-label="Sese katıl"
                          title="Sese katıl"
                        >
                          <span
                            className={`flex h-12 w-12 items-center justify-center rounded-full transition-transform active:scale-95 ${mobileSoftButtonFrame}`}
                          >
                            <span className={mobileSoftButtonInner}>
                              <MicOff className="h-5 w-5" />
                            </span>
                          </span>
                          <span className="w-full truncate text-center text-[10px] font-medium text-white drop-shadow-sm">
                            Bize katıl
                          </span>
                        </button>
                      );
                    }

                    const voiceUsername = voiceUser.username || "";
                    const normalizedVoiceUsername = voiceUsername
                      .trim()
                      .toLocaleLowerCase("tr-TR");
                    const isOwnVoiceSlot =
                      normalizedCurrentUsername.length > 0 &&
                      normalizedVoiceUsername === normalizedCurrentUsername;
                    const avatarUrl = calculateAvatar(voiceUser.icon);
                    const frameUrl = resolveFrameUrl(voiceUser.frame);
                    const displayName = resolveViewerAwareDisplayName(
                      voiceUser,
                      userStarCount,
                    );
                    const fallbackInitial =
                      (displayName || voiceUsername || "?").trim().charAt(0) ||
                      "?";
                    const isVoiceMuted = isOwnVoiceSlot
                      ? isMuted
                      : voiceUser.isMuted === true;
                    const isSpeaking = Array.from(speakingUsers).some(
                      (speakingUsername) =>
                        speakingUsername.trim().toLocaleLowerCase("tr-TR") ===
                        normalizedVoiceUsername,
                    );

                    return (
                      <button
                        key={`mobile-voice-slot-${voiceUser.id || voiceUsername || index}`}
                        type="button"
                        onClick={() => {
                          if (isOwnVoiceSlot) {
                            setActiveMobileVoiceMenuUsername((current) =>
                              current === voiceUsername ? null : voiceUsername,
                            );
                            return;
                          }

                          handleOpenMobileVoiceProfile(voiceUser);
                        }}
                        className="flex min-w-0 cursor-pointer flex-col items-center gap-1 text-white"
                        aria-label={
                          isOwnVoiceSlot
                            ? "Mikrofon seçenekleri"
                            : `${displayName || voiceUsername} profilini aç`
                        }
                        title={
                          isOwnVoiceSlot
                            ? "Mikrofon seçenekleri"
                            : `${displayName || voiceUsername} profilini aç`
                        }
                      >
                        <span
                          className={`relative flex h-12 w-12 items-center justify-center rounded-full transition-transform active:scale-95 ${mobileSoftButtonFrame} ${
                            isSpeaking && !isVoiceMuted
                              ? "ring-2 ring-emerald-300"
                              : ""
                          }`}
                        >
                          <span className="relative z-10 flex h-full w-full overflow-hidden rounded-full bg-[var(--chat-mobile-control-bg)] text-[var(--chat-mobile-control-text)] backdrop-blur-md">
                            {avatarUrl ? (
                              <img
                                src={avatarUrl}
                                alt={displayName}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span className="flex h-full w-full items-center justify-center bg-zinc-800 text-sm font-bold uppercase text-white">
                                {fallbackInitial}
                              </span>
                            )}
                          </span>
                          {frameUrl ? (
                            <img
                              src={frameUrl}
                              alt=""
                              aria-hidden="true"
                              className="pointer-events-none absolute inset-0 z-20 h-full w-full scale-125 object-contain"
                            />
                          ) : null}
                          <span
                            className={`absolute -bottom-1 -right-1 z-30 flex h-5 w-5 items-center justify-center rounded-full shadow-[0_1px_4px_rgba(0,0,0,0.35)] ring-2 ring-white ${
                              isVoiceMuted
                                ? "bg-red-500 text-white"
                                : "bg-emerald-500 text-white"
                            }`}
                          >
                            {isVoiceMuted ? (
                              <MicOff className="h-3 w-3 stroke-[2.75]" />
                            ) : (
                              <Mic className="h-3 w-3 stroke-[2.75]" />
                            )}
                          </span>
                        </span>
                        <span className="w-full truncate text-center text-[10px] font-medium text-white drop-shadow-sm">
                          {displayName || voiceUsername}
                        </span>
                      </button>
                      );
                    })}
                  </>
                ) : null
              }
            />
          </div>

          {/* Scrollable Messages container */}
          <div
            className={`flex-1 overflow-x-hidden overflow-y-auto p-3 pb-24 sm:p-6 md:pb-6 ${chatMessagesPanelClassName}`}
          >
            <div className="relative z-10 flex justify-center">
              <span className="text-xs text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-3 py-1 rounded-full">
                Bugün
              </span>
            </div>

            {/* Messages */}
            <div className="relative z-10 mt-3 space-y-3 sm:mt-4 sm:space-y-4">
              {chatMessages.map(renderVisibleMessage)}
              {/* Invisible element to scroll to */}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-24 right-3 z-30 flex flex-col items-center gap-2.5 md:hidden">
          <button
            type="button"
            onClick={() => {
              setCloseMobileSidebarOnProfileClose(false);
              setMobileInitialSelectedUser(null);
              setMobileSidebarTab("room");
              setIsMobileSidebarOpen(true);
            }}
            className={`pointer-events-auto relative flex h-10 w-10 items-center justify-center rounded-full ${mobileSoftButtonFrame}`}
            aria-label="Oda kişilerini aç"
          >
            <span className={mobileSoftButtonInner}>
              <User className="h-[18px] w-[18px] fill-white stroke-[2.5]" />
            </span>
            {!shouldHideInitialMobileSidebarCount ? (
              <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-[#0a84ff] px-1 text-[13px] font-bold leading-none text-white">
                {effectiveMobileSidebarRoomUsersCount}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => setShowMobileMessages(true)}
            className={`pointer-events-auto relative flex h-10 w-10 items-center justify-center rounded-full ${mobileSoftButtonFrame}`}
            aria-label="Özel mesajları aç"
          >
            <span className={mobileSoftButtonInner}>
              <MessageSquare className="h-[18px] w-[18px] stroke-[2.5]" />
            </span>
            {dmUnreadCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-red-500 px-1 text-[13px] font-bold leading-none text-white">
                {dmUnreadCount > 99 ? "99+" : dmUnreadCount}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => setShowMobileSettings(true)}
            className={`pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full ${mobileSoftButtonFrame}`}
            aria-label="Kullanıcı ayarlarını aç"
          >
            <span className={mobileSoftButtonInner}>
              <Settings className="h-[18px] w-[18px] stroke-[2.5]" />
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (isInVoiceChat) {
                localStorage.setItem("voiceChatOptOut", "true");
                leaveVoiceChat();
                return;
              }

              localStorage.removeItem("voiceChatOptOut");
              void joinVoiceChat();
            }}
            className={`pointer-events-auto relative flex h-10 w-10 items-center justify-center rounded-full ${mobileSoftButtonFrame}`}
            aria-label={isInVoiceChat ? "Canlı yayından ayrıl" : "Canlı yayına katıl"}
            title={isInVoiceChat ? "Canlı yayından ayrıl" : "Canlı yayına katıl"}
          >
            <span className={mobileSoftButtonInner}>
              <Volume2 className="h-[18px] w-[18px] fill-white/20 stroke-[2.5]" />
            </span>
            {!isInVoiceChat ? (
              <span className="pointer-events-none absolute h-[2px] w-5 rotate-[-38deg] rounded-full bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.45)]" />
            ) : null}
          </button>
        </div>

        <div
          className={`kingmobile-chat-input-shell shrink-0 pb-[env(safe-area-inset-bottom)] md:bg-[var(--chat-input-shell-bg)] ${mobileInputShellClassName}`}
        >
          <ChatInput
            socket={socket}
            roomId={roomId || roomName}
            roomName={roomName}
            forbiddenWords={forbiddenWords}
            isHandRaised={isHandRaised}
            onToggleHand={onToggleHand}
            firstMessageDelayRemaining={firstMessageDelayRemaining}
            chatPermissions={chatPermissions}
            micDisabled={micDisabled}
            micDisabledReason={micDisabledReason}
            micWaitRemainingSeconds={micWaitRemainingSeconds}
            initialCameraBanned={initialCameraBanned}
            writingDisabled={writingDisabled}
            writingDisabledReason={writingDisabledReason}
            radioLink={radioLink}
            radioRequestLink={radioRequestLink}
            roomRadioPanelLink={roomDetail?.radioPanelLink ?? null}
            roomRadioRequestLink={roomDetail?.radioRequestLink ?? null}
            replyTo={replyTo}
            onCancelReply={handleCancelReply}
            onMessageSent={onMessageSent}
            isOnRoof={isOnRoof}
            currentUserIcon={currentUserIcon}
            currentUserGender={currentUserGender}
            currentUserFontColor={chatFontColor}
            currentUserStarCount={userStarCount}
            roomOwnerName={roomDetail?.owner?.username}
            onClearScreen={handleClearScreen}
            onDeleteHistory={handleDeleteHistory}
            onDeleteRoomMessages={handleDeleteRoomMessagesForEveryone}
            onManageRoom={handleManageRoom}
            canDeleteRoomMessages={canDeleteRoomMessages}
            currentUserPermissions={currentUserPermissions}
            currentRolePermissions={currentRolePermissions}
            addSystemMessage={addSystemMessage}
          />
        </div>
      </main>

      {/* Context Menu */}
      {contextMenu && (
        <ChatContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onClearScreen={handleClearScreen}
          onDeleteHistory={handleDeleteHistory}
          onSafeExit={handleSafeExit}
          starCount={userStarCount}
          canAccessAdminPanel={canAccessAdminPanel}
          canAccessMeetingRoom={canAccessMeetingRoom}
          canDeleteRoomMessages={canDeleteRoomMessages}
          onOpenAdminPanel={openAdminPanel}
          onGoMeetingRoom={onGoMeetingRoom}
          onManageRoom={handleManageRoom}
          onDeleteRoomMessages={handleDeleteRoomMessagesForEveryone}
          onClearBannedUsers={handleClearBannedUsers}
          onClearBlockedUsers={handleClearBlockedUsers}
          onClearRoomBlocks={handleClearRoomBlocks}
          onClearGlobalMutes={handleClearGlobalMutes}
        />
      )}

      <ChatRoomManageModal
        isOpen={showManageModal}
        onClose={() => setShowManageModal(false)}
        roomName={roomName}
        canManageRadio={canManageRadio}
        socket={socket}
      />

      <ConfirmationModal
        isOpen={showClearHistoryModal}
        onClose={() => setShowClearHistoryModal(false)}
        onConfirm={confirmDeleteHistory}
        title="Geçmişi Temizle"
        message="Bütün mesaj geçmişini silmek istediğinize emin misiniz? Bu işlem geri alınamaz."
        confirmText="Evet, Temizle"
        cancelText="Vazgeç"
        variant="danger"
      />

      {showMobileSafeExitModal ? (
        <div className="fixed inset-0 z-[260] flex items-center justify-center bg-black/55 px-8 md:hidden">
          <div className="w-full max-w-[312px] overflow-hidden rounded-[16px] bg-white shadow-2xl">
            <div className="px-6 pb-3.5 pt-5 text-center">
              <h3 className="text-[20px] font-bold text-black">
                Emin misiniz?
              </h3>
              <p className="mt-2.5 text-[15.5px] leading-snug text-black">
                Güvenli Çıkış yaptığınızda; giriş sayfasında yeniden rumuz ve
                -varsa- şifre sorulacaktır. Emin misiniz?
              </p>
            </div>

            <div className="border-y border-zinc-100 bg-white">
              <label className="flex h-12 items-center justify-between px-5 text-[14px] text-black">
                <span>Özel yazışmaları sil</span>
                <button
                  type="button"
                  onClick={() =>
                    setMobileSafeExitClearDirect((value) => !value)
                  }
                  className={`relative h-9 w-16 rounded-full border transition ${
                    mobileSafeExitClearDirect
                      ? "border-[#0a84ff] bg-[#0a84ff]"
                      : "border-zinc-200 bg-zinc-100"
                  }`}
                  aria-pressed={mobileSafeExitClearDirect}
                  aria-label="Özel yazışmaları sil"
                >
                  <span
                    className={`absolute top-0.5 h-8 w-8 rounded-full bg-white shadow-md transition ${
                      mobileSafeExitClearDirect ? "left-[30px]" : "left-0.5"
                    }`}
                  />
                </button>
              </label>
              <label className="flex h-12 items-center justify-between border-t border-zinc-100 px-5 text-[14px] text-black">
                <span>Oda yazışmalarını sil</span>
                <button
                  type="button"
                  onClick={() => setMobileSafeExitClearRoom((value) => !value)}
                  className={`relative h-9 w-16 rounded-full border transition ${
                    mobileSafeExitClearRoom
                      ? "border-[#0a84ff] bg-[#0a84ff]"
                      : "border-zinc-200 bg-zinc-100"
                  }`}
                  aria-pressed={mobileSafeExitClearRoom}
                  aria-label="Oda yazışmalarını sil"
                >
                  <span
                    className={`absolute top-0.5 h-8 w-8 rounded-full bg-white shadow-md transition ${
                      mobileSafeExitClearRoom ? "left-[30px]" : "left-0.5"
                    }`}
                  />
                </button>
              </label>
            </div>

            <div className="grid grid-cols-2 border-t border-zinc-200">
              <button
                type="button"
                onClick={() => {
                  setShowMobileSafeExitModal(false);
                  void handleSafeExit({
                    skipConfirm: true,
                    clearDirectHistory: mobileSafeExitClearDirect,
                    clearRoomHistory: mobileSafeExitClearRoom,
                  });
                }}
                className="h-12 border-r border-zinc-200 text-[17px] font-medium text-[#0a84ff] active:bg-zinc-100"
              >
                Evet
              </button>
              <button
                type="button"
                onClick={() => setShowMobileSafeExitModal(false)}
                className="h-12 text-[17px] font-medium text-[#0a84ff] active:bg-zinc-100"
              >
                Hayır
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showMobileRoomDesignPicker ? (
        <div
          className="fixed inset-0 z-[240] flex items-end bg-black/45 md:hidden"
          onClick={() => setShowMobileRoomDesignPicker(false)}
        >
          <div
            className="flex h-[min(58svh,430px)] w-full flex-col rounded-t-[20px] bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
              <div>
                <h3 className="text-base font-bold text-zinc-950">
                  Kişisel oda dizaynı
                </h3>
                <p className="text-xs font-medium text-zinc-500">
                  Sohbet alanı arka planı
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowMobileRoomDesignPicker(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-base font-semibold text-zinc-500 active:bg-zinc-200"
                aria-label="Kapat"
              >
                X
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
              <div className="grid grid-cols-4 gap-2.5">
                {personalRoomDesignImages.map((file) => {
                  const path = `/images/${file}`;
                  const isActive = chatBackground === path;
                  const isCustomPhoto =
                    file ===
                    "456712280_17999227514656648_949295733479667370_n.jpg";
                  const objectPosition = isCustomPhoto ? "center 42%" : "center";

                  return (
                    <button
                      key={file}
                      type="button"
                      onClick={() => applyMobileRoomDesign(path)}
                      className={`relative aspect-[4/5] overflow-hidden rounded-lg border bg-zinc-100 shadow-sm transition active:scale-[0.98] ${
                        isActive
                          ? "border-[#0a84ff] ring-2 ring-[#0a84ff]/25"
                          : "border-zinc-200"
                      }`}
                      style={{
                        backgroundImage: `url('${path}')`,
                        backgroundPosition: objectPosition,
                        backgroundSize: "cover",
                        backgroundRepeat: "no-repeat",
                      }}
                      aria-label={`${file} dizaynını seç`}
                    >
                      {isActive ? (
                        <span className="absolute bottom-1.5 right-1.5 rounded-full bg-[#0a84ff] px-1.5 py-0.5 text-[9px] font-bold text-white shadow">
                          Seçili
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="sticky bottom-0 shrink-0 border-t border-zinc-100 bg-white px-3 py-2.5">
              <button
                type="button"
                onClick={() => applyMobileRoomDesign(null)}
                className="h-10 w-full rounded-full bg-zinc-900 text-sm font-semibold text-white active:bg-zinc-800"
              >
                Özel dizaynı kaldır
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <SettingsModal
        isOpen={showMobileSettings}
        onClose={() => setShowMobileSettings(false)}
        socket={socket}
        currentUserStarCount={userStarCount}
        canUseRoof={canUseRoofForSettings}
        canAccessAdminPanel={canAccessAdminPanel}
        onOpenAdminPanel={openAdminPanel}
        onWhatsAppShare={handleWhatsAppShare}
        onSafeExit={handleOpenMobileSafeExitModal}
      />

      <DirectMessagesModal
        isOpen={showMobileMessages}
        onClose={() => setShowMobileMessages(false)}
        socket={socket}
        currentUserStarCount={userStarCount}
        currentUserGender={currentUserGender}
        communicationPermissions={communicationPermissions}
        chatPermissions={chatPermissions}
        currentUserPermissions={currentUserPermissions}
        currentRolePermissions={currentRolePermissions}
        onlineUsernames={roomUsers.map((user) => user.username)}
        onUnreadCountChange={handleDmUnreadCountChange}
        unreadTotalCount={dmUnreadCount}
        pendingConversationCounts={pendingDmConversationCounts}
        onConversationSeen={(conversationId, lastMessageId) => {
          if (lastMessageId != null) {
            dmLocallyReadLastMessageIdsRef.current = {
              ...dmLocallyReadLastMessageIdsRef.current,
              [conversationId]: String(lastMessageId),
            };
          }
          setDmUnreadCount(0);
          setPendingDmConversationCounts((prev) => {
            const next = { ...prev };
            delete next[conversationId];
            pendingDmConversationCountsRef.current = next;
            return next;
          });
          window.setTimeout(() => {
            void refreshDmUnreadCount();
          }, 0);
        }}
        onStartVoiceCall={startVoiceCall}
        onStartVideoCall={startVideoCall}
      />

      {/* Admin Panel Modal */}
      <AdminPanelModal
        isOpen={isAdminPanelOpen}
        onClose={() => {
          setIsAdminPanelOpen(false);
          setAdminInitialView(null);
          setAdminInitialRoomName(null);
        }}
        initialView={adminInitialView}
        initialRoomName={adminInitialRoomName}
        socket={socket}
        currentUserStarCount={userStarCount}
        currentUserPermissions={currentUserPermissions}
        currentRolePermissions={currentRolePermissions}
        onForbiddenWordsChange={onForbiddenWordsChange}
      />
    </div>
  );
}

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.name as string;
  const decodedSlug = (() => {
    try {
      return decodeURIComponent(slug);
    } catch {
      return slug;
    }
  })();
  const roomDisplayName = decodedSlug.replace(/-/g, " ");
  const [socket, setSocket] = useState<Socket | null>(null);
  const [roomUsers, setRoomUsers] = useState<RoomUser[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeGlobalAnnouncement, setActiveGlobalAnnouncement] = useState<{
    message: string;
    timestamp: string;
  } | null>(null);
  const globalAnnouncementTimerRef = useRef<number | null>(null);
  const [roomJoinRevision, setRoomJoinRevision] = useState(0);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [userStarCount, setUserStarCount] = useState<number>(0);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [forbiddenWords, setForbiddenWords] = useState<
    Array<{ forbiddenWord: string; replacementWord?: string | null }>
  >([]);
  const [chatBackground, setChatBackground] = useState<string | null>(null);
  const [chatFontSize, setChatFontSize] = useState<string>("16px");
  const [chatFontColor, setChatFontColor] = useState<string | null>(null);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const roomSnapshotKeysRef = useRef({
    activeRoomId: null as string | null,
    roomId: null as string | null,
    roomDisplayName,
  });
  const transitioningUsersRef = useRef<Record<string, boolean>>({});
  const [userRoleName, setUserRoleName] = useState<string | null>(null);
  const [currentUserRoleSnapshot, setCurrentUserRoleSnapshot] =
    useState<RoleSnapshot | null>(null);
  const [currentUserRoleReady, setCurrentUserRoleReady] = useState(false);
  const [currentUserPermissions, setCurrentUserPermissions] = useState<
    string[]
  >([]);
  const [currentRolePermissions, setCurrentRolePermissions] = useState<
    Record<string, unknown> | null
  >(null);
  const [userGender, setUserGender] = useState<string | null>(null);
  const [currentUserIcon, setCurrentUserIcon] = useState<string | null>(null);
  const [firstMessageDelayRemaining, setFirstMessageDelayRemaining] =
    useState<number>(0);
  const [guestWaitRemaining, setGuestWaitRemaining] = useState<number>(0);
  const [settingsRefreshTick, setSettingsRefreshTick] = useState(0);
  const [chatPermissions, setChatPermissions] =
    useState<ChatPermissionsSettings | null>(null);
  const [communicationPermissions, setCommunicationPermissions] =
    useState<CommunicationPermissions | null>(null);
  const [micWaitRemainingSeconds, setMicWaitRemainingSeconds] = useState(0);
  const [micDisabled, setMicDisabled] = useState(true);
  const [micDisabledReason, setMicDisabledReason] = useState<string | null>(
    "Güvenlik ayarları yükleniyor...",
  );
  const [writingDisabled, setWritingDisabled] = useState(false);
  const [writingDisabledReason, setWritingDisabledReason] = useState<
    string | null
  >(null);
  const [isOnRoof, setIsOnRoof] = useState(false);
  const [isInitialRoofResolving, setIsInitialRoofResolving] = useState(false);
  const [radioSettings, setRadioSettings] = useState<RadioSettings | null>(
    null,
  );
  const [isUserDataLoaded, setIsUserDataLoaded] = useState(false);
  const [initialMicBanned, setInitialMicBanned] = useState(false);
  const [initialCameraBanned, setInitialCameraBanned] = useState(false);
  const [roomMuted, setRoomMuted] = useState(false);
  const [globalMuted, setGlobalMuted] = useState(false);
  const [mutedRoomName, setMutedRoomName] = useState<string | null>(null);
  const [welcomeMessageTemplate, setWelcomeMessageTemplate] = useState("");
  const [systemResetCountdown, setSystemResetCountdown] = useState<number | null>(
    null,
  );
  const [systemResetMessage, setSystemResetMessage] = useState(
    "Sistem resetleniyor",
  );
  const systemResetActiveRef = useRef(false);
  const systemResetIntervalRef = useRef<number | null>(null);
  const systemResetDeadlineAtRef = useRef<number | null>(null);
  const systemResetAudioRef = useRef<HTMLAudioElement | null>(null);
  const roomUsersRef = useRef<RoomUser[]>([]);
  const welcomeMessageTemplateRef = useRef("");
  const pendingLeaveTimersRef = useRef<Record<string, number>>({});
  const roomUserPresenceGraceUntilRef = useRef<Map<string, number>>(new Map());
  const roomUserPresenceGraceTimersRef = useRef<Record<string, number>>({});
  const latestRoomUsersSnapshotKeysRef = useRef<Set<string>>(new Set());
  const pendingRoofExitJoinEffectTimersRef = useRef<Record<string, number>>(
    {},
  );
  const userGenderRef = useRef<string | null>(null);
  const userRoleNameRef = useRef<string | null>(null);
  const userRoleStarColorRef = useRef<string | null>(null);
  const userRoleStarCountRef = useRef<number | null>(null);
  const userRoleIconRef = useRef<string | null>(null);
  const authoritativeRoleByUsernameRef = useRef<Map<string, RoleSnapshot>>(
    new Map(),
  );
  const profileFrameRef = useRef<string | null>(null);
  const profileIconRef = useRef<string | null>(null);
  const [roomDetail, setRoomDetail] = useState<Room | null>(null);
  const roomDetailRef = useRef<Room | null>(null);

  const playSystemResetSound = useCallback((startOffsetMs = 0) => {
    if (typeof window === "undefined") return;

    try {
      const audio =
        systemResetAudioRef.current ??
        new Audio("/sounds/gorusuruz.mp3");
      systemResetAudioRef.current = audio;
      const startOffsetSeconds = Math.max(0, startOffsetMs / 1000);
      const applyStartOffset = () => {
        const maxOffsetSeconds =
          Number.isFinite(audio.duration) && audio.duration > 0
            ? Math.max(0, audio.duration - 0.25)
            : startOffsetSeconds;
        audio.currentTime = Math.min(startOffsetSeconds, maxOffsetSeconds);
      };
      if (audio.readyState >= 1) {
        applyStartOffset();
      } else {
        audio.addEventListener("loadedmetadata", applyStartOffset, {
          once: true,
        });
      }
      audio.muted = false;
      audio.volume = 0.85;
      void audio.play().catch(() => {});
    } catch {
      // Audio is a best-effort reset cue; countdown and logout must continue.
    }
  }, []);

  useEffect(() => {
    const fetchWelcomeMessageTemplate = async () => {
      try {
        const settings = await apiClient.systemSettings.getMaintenanceMode();
        setWelcomeMessageTemplate(settings.welcomeMessageTemplate ?? "");
      } catch (error) {
        console.error("Failed to fetch welcome message template:", error);
      }
    };

    fetchWelcomeMessageTemplate();
  }, []);

  useEffect(() => {
    const handleWelcomeMessageTemplateUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ template?: string | null }>).detail;
      setWelcomeMessageTemplate(
        typeof detail?.template === "string" ? detail.template : "",
      );
    };

    window.addEventListener(
      "welcomeMessageTemplateUpdated",
      handleWelcomeMessageTemplateUpdated as EventListener,
    );

    return () => {
      window.removeEventListener(
        "welcomeMessageTemplateUpdated",
        handleWelcomeMessageTemplateUpdated as EventListener,
      );
    };
  }, []);

  useEffect(() => {
    welcomeMessageTemplateRef.current = welcomeMessageTemplate;
  }, [welcomeMessageTemplate]);

  const isWelcomeMessageContent = useCallback((content?: string | null) => {
    const normalizedContent = (content || "").trim();
    const template = (welcomeMessageTemplateRef.current || "").trim();

    if (!normalizedContent || !template || !template.includes("[username]")) {
      return false;
    }

    const escapedTemplate = template.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&",
    );
    const pattern = new RegExp(
      `^${escapedTemplate.replace(/\\\[username\\\]/gi, "(.+?)")}$`,
      "i",
    );

    return pattern.test(normalizedContent);
  }, []);

  useEffect(() => {
    const normalizeSlugValue = (value: string) => {
      const decoded = (() => {
        try {
          return decodeURIComponent(value);
        } catch {
          return value;
        }
      })();

      return decoded
        .trim()
        .toLocaleLowerCase("tr-TR")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");
    };

    const rawPayload = sessionStorage.getItem(PENDING_TELEPORT_TOAST_KEY);
    if (!rawPayload) return;

    let parsedPayload: PendingTeleportToastPayload | null = null;
    try {
      const candidate = JSON.parse(rawPayload) as PendingTeleportToastPayload;
      if (
        typeof candidate?.toRoom === "string" &&
        candidate.toRoom.trim() &&
        typeof candidate?.byWhom === "string" &&
        candidate.byWhom.trim()
      ) {
        parsedPayload = {
          toRoom: candidate.toRoom.trim(),
          byWhom: candidate.byWhom.trim(),
          targetSlug:
            typeof candidate.targetSlug === "string" &&
            candidate.targetSlug.trim()
              ? candidate.targetSlug.trim()
              : undefined,
          createdAt:
            typeof candidate.createdAt === "number"
              ? candidate.createdAt
              : undefined,
        };
      }
    } catch {
      sessionStorage.removeItem(PENDING_TELEPORT_TOAST_KEY);
      return;
    }

    if (!parsedPayload) {
      sessionStorage.removeItem(PENDING_TELEPORT_TOAST_KEY);
      return;
    }

    if (
      typeof parsedPayload.createdAt === "number" &&
      Date.now() - parsedPayload.createdAt > 2 * 60 * 1000
    ) {
      sessionStorage.removeItem(PENDING_TELEPORT_TOAST_KEY);
      return;
    }

    const currentSlug = normalizeSlugValue(String(slug || ""));
    const targetSlug = normalizeSlugValue(
      parsedPayload.targetSlug || parsedPayload.toRoom,
    );

    if (!currentSlug || !targetSlug || currentSlug !== targetSlug) {
      return;
    }

    // Match bulunduğu anda tüket, tekrar gösterilmesin.
    sessionStorage.removeItem(PENDING_TELEPORT_TOAST_KEY);

    window.setTimeout(() => {
      toast.info(
        `${parsedPayload.byWhom} tarafından ${parsedPayload.toRoom} odasına ışınlandınız.`,
        {
          duration: 7000,
        },
      );
    }, 6000);
  }, [roomDisplayName, slug]);

  useEffect(() => {
    const normalizeSlugValue = (value: string) => {
      const decoded = (() => {
        try {
          return decodeURIComponent(value);
        } catch {
          return value;
        }
      })();

      return decoded
        .trim()
        .toLocaleLowerCase("tr-TR")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");
    };

    const rawPayload = sessionStorage.getItem(
      PENDING_ROOM_ACCESS_DENIED_TOAST_KEY,
    );
    if (!rawPayload) return;

    let parsedPayload: PendingRoomAccessDeniedToastPayload | null = null;
    try {
      const candidate = JSON.parse(
        rawPayload,
      ) as PendingRoomAccessDeniedToastPayload;
      if (typeof candidate?.fromRoom === "string" && candidate.fromRoom.trim()) {
        parsedPayload = {
          fromRoom: candidate.fromRoom.trim(),
          targetSlug:
            typeof candidate.targetSlug === "string" &&
            candidate.targetSlug.trim()
              ? candidate.targetSlug.trim()
              : undefined,
          createdAt:
            typeof candidate.createdAt === "number"
              ? candidate.createdAt
              : undefined,
        };
      }
    } catch {
      sessionStorage.removeItem(PENDING_ROOM_ACCESS_DENIED_TOAST_KEY);
      return;
    }

    if (!parsedPayload) {
      sessionStorage.removeItem(PENDING_ROOM_ACCESS_DENIED_TOAST_KEY);
      return;
    }

    if (
      typeof parsedPayload.createdAt === "number" &&
      Date.now() - parsedPayload.createdAt > 2 * 60 * 1000
    ) {
      sessionStorage.removeItem(PENDING_ROOM_ACCESS_DENIED_TOAST_KEY);
      return;
    }

    const currentSlug = normalizeSlugValue(String(slug || ""));
    const targetSlug = normalizeSlugValue(parsedPayload.targetSlug || "lobby");

    if (!currentSlug || !targetSlug || currentSlug !== targetSlug) {
      return;
    }

    sessionStorage.removeItem(PENDING_ROOM_ACCESS_DENIED_TOAST_KEY);

    window.setTimeout(() => {
      toast.error(
        `${parsedPayload.fromRoom} odasına giriş yetkiniz olmadığı için lobby odasına yönlendirildiniz.`,
        {
          duration: 7000,
        },
      );
    }, 800);
  }, [slug]);

  useEffect(() => {
    roomDetailRef.current = roomDetail;
  }, [roomDetail]);

  const getRoomImageUrl = useCallback((
    roomImg: string | null | undefined,
    updatedAt?: string | Date | null,
  ): string | null => {
    if (!roomImg) return null;
    const imageBase =
      process.env.NEXT_PUBLIC_IMAGE_ACCESS_URL?.replace(/\/$/, "") || "";
    const normalizedPath = roomImg.replace(/^\/+/, "");
    const baseUrl =
      normalizedPath && imageBase ? `${imageBase}/${normalizedPath}` : normalizedPath;

    if (!baseUrl) return null;

    const cacheKey = updatedAt ? new Date(updatedAt).getTime() : NaN;
    if (!Number.isFinite(cacheKey)) {
      return baseUrl;
    }

    const separator = baseUrl.includes("?") ? "&" : "?";
    return `${baseUrl}${separator}v=${cacheKey}`;
  }, []);

  const resolveEffectiveChatBackground = useCallback(
    (
      room: Room | null | undefined = roomDetailRef.current,
      options: { includeFallback?: boolean } = {},
    ) => {
      const includeFallback = options.includeFallback ?? true;
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem("chatBackground")?.trim();
        if (saved) return saved;
      }

      const roomUrl = getRoomImageUrl(room?.roomImage, room?.updatedAt);
      if (roomUrl) return roomUrl;

      return includeFallback ? FALLBACK_CHAT_BACKGROUND : null;
    },
    [getRoomImageUrl],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!roomDetail) return;
    setChatBackground(
      resolveEffectiveChatBackground(roomDetail, { includeFallback: true }),
    );
  }, [roomDetail, resolveEffectiveChatBackground]);

  const apiClientRef = useRef(getClientApiClient());
  const isGuestSession = isGuestSessionFromStorage();
  const currentUsername = isGuestSession
    ? localStorage.getItem("guestUsername")
    : localStorage.getItem("username");

  const currentUsernameRef = useRef(currentUsername);
  useEffect(() => {
    currentUsernameRef.current = currentUsername;
  }, [currentUsername]);

  const [showJoinLeaveEventsEnabled, setShowJoinLeaveEventsEnabled] =
    useState(false);
  const [hideGeneralMessagesEnabled, setHideGeneralMessagesEnabled] =
    useState(false);
  const [disableJoinEffectsEnabled, setDisableJoinEffectsEnabled] =
    useState(false);
  const [keepRoomChatHistoryEnabled, setKeepRoomChatHistoryEnabled] =
    useState(true);
  const disableJoinEffectsRef = useRef(false);
  const [joinEffectQueue, setJoinEffectQueue] = useState<JoinEffectBanner[]>(
    [],
  );
  const [activeJoinEffect, setActiveJoinEffect] =
    useState<JoinEffectBanner | null>(null);
  const activeJoinEffectRef = useRef<JoinEffectBanner | null>(null);
  const [isMobileJoinEffectMode, setIsMobileJoinEffectMode] = useState(false);
  const isMobileJoinEffectModeRef = useRef(false);
  const joinEffectDedupRef = useRef<Map<string, number>>(new Map());
  const mobileJoinEffectPresencePrimedRef = useRef(false);
  const mobileJoinEffectPresenceRef = useRef<
    Map<
      string,
      {
        joinEffect: string | null;
        statusModeName: string | null;
      }
    >
  >(new Map());

  useEffect(() => {
    const syncJoinLeavePreference = () => {
      const preferences = readChatPreferencesFromStorage();
      setShowJoinLeaveEventsEnabled(preferences.showJoinLeaveEvents === true);
    };

    syncJoinLeavePreference();
    window.addEventListener("chatPreferencesChanged", syncJoinLeavePreference);
    return () =>
      window.removeEventListener(
        "chatPreferencesChanged",
        syncJoinLeavePreference,
      );
  }, []);

  useEffect(() => {
    const syncJoinEffectPreference = () => {
      const preferences = readChatPreferencesFromStorage();
      setDisableJoinEffectsEnabled(preferences.disableJoinEffects === true);
    };

    syncJoinEffectPreference();
    window.addEventListener(
      "chatPreferencesChanged",
      syncJoinEffectPreference,
    );
    return () =>
      window.removeEventListener(
        "chatPreferencesChanged",
        syncJoinEffectPreference,
      );
  }, []);

  useEffect(() => {
    let timeoutId: number | undefined;
    const syncHideGeneralPreference = () => {
      const preferences = readChatPreferencesFromStorage();
      const nextValue = preferences.hideGeneralMessages === true;
      setHideGeneralMessagesEnabled((prev) =>
        prev === nextValue ? prev : nextValue,
      );
    };

    syncHideGeneralPreference();
    const onPreferencesChanged = () => {
      timeoutId = window.setTimeout(syncHideGeneralPreference, 0);
    };
    window.addEventListener("chatPreferencesChanged", onPreferencesChanged);
    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      window.removeEventListener("chatPreferencesChanged", onPreferencesChanged);
    };
  }, []);

  useEffect(() => {
    let timeoutId: number | undefined;
    const syncRoomHistoryPreference = () => {
      const preferences = readChatPreferencesFromStorage();
      const nextValue = preferences.keepRoomChatHistory === true;
      setKeepRoomChatHistoryEnabled((prev) =>
        prev === nextValue ? prev : nextValue,
      );
    };

    syncRoomHistoryPreference();
    const onPreferencesChanged = () => {
      timeoutId = window.setTimeout(syncRoomHistoryPreference, 0);
    };
    window.addEventListener("chatPreferencesChanged", onPreferencesChanged);
    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      window.removeEventListener("chatPreferencesChanged", onPreferencesChanged);
    };
  }, []);

  useEffect(() => {
    disableJoinEffectsRef.current = disableJoinEffectsEnabled;
  }, [disableJoinEffectsEnabled]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(max-width: 768px)");
    const syncMobileJoinEffectMode = () => {
      const next = mediaQuery.matches;
      isMobileJoinEffectModeRef.current = next;
      setIsMobileJoinEffectMode(next);
    };

    syncMobileJoinEffectMode();
    mediaQuery.addEventListener("change", syncMobileJoinEffectMode);
    return () => {
      mediaQuery.removeEventListener("change", syncMobileJoinEffectMode);
    };
  }, []);

  useEffect(() => {
    activeJoinEffectRef.current = activeJoinEffect;
  }, [activeJoinEffect]);

  useEffect(() => {
    if (!disableJoinEffectsEnabled) return;
    setJoinEffectQueue([]);
    setActiveJoinEffect(null);
  }, [disableJoinEffectsEnabled]);

  useEffect(() => {
    if (!activeJoinEffect && joinEffectQueue.length > 0) {
      const [next, ...rest] = joinEffectQueue;
      setActiveJoinEffect(next);
      setJoinEffectQueue(rest);
    }
  }, [activeJoinEffect, joinEffectQueue]);

  useEffect(() => {
    if (!activeJoinEffect) return;
    const timer = window.setTimeout(() => {
      setActiveJoinEffect(null);
    }, isMobileJoinEffectMode ? 3400 : 5000);
    return () => window.clearTimeout(timer);
  }, [activeJoinEffect, isMobileJoinEffectMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isGuest = localStorage.getItem("isGuest") === "true";
    if (isGuest) {
      localStorage.removeItem("profileIcon");
      localStorage.removeItem("profileIconOwner");
      return;
    }
    const owner = localStorage.getItem("profileIconOwner");
    const username = localStorage.getItem("username");
    if (owner && username && owner !== username) {
      localStorage.removeItem("profileIcon");
      localStorage.removeItem("profileIconOwner");
    }
  }, []);

  const ownerAvatar = roomDetail?.owner?.icon
    ? calculateAvatar(roomDetail.owner.icon)
    : roomDetail?.owner?.gender === "female"
      ? "/avatarlar/8.png"
      : "/avatarlar/7.png";
  const canAccessAdminPanel = useMemo(
    () =>
      hasEffectivePermission({
        permissionLabel: PERMISSION_LABELS.ADMIN_PANEL,
        userPermissions: currentUserPermissions,
        rolePermissions: currentRolePermissions,
      }),
    [currentRolePermissions, currentUserPermissions],
  );
  const canAccessMeetingRoom = useMemo(
    () =>
      hasEffectivePermission({
        permissionLabel: PERMISSION_LABELS.MEETING_ROOM,
        userPermissions: currentUserPermissions,
        rolePermissions: currentRolePermissions,
      }),
    [currentUserPermissions, currentRolePermissions],
  );
  const canUseRoofMode = useMemo(
    () =>
      userStarCount >= 1 &&
      hasEffectivePermission({
        permissionLabel: PERMISSION_LABELS.ROOF_ACCESS,
        userPermissions: currentUserPermissions,
        rolePermissions: currentRolePermissions,
      }),
    [currentRolePermissions, currentUserPermissions, userStarCount],
  );
  const goToMeetingRoom = useCallback(() => {
    if (!canAccessMeetingRoom) {
      toast.error("Toplantı odasına giriş yetkiniz yok.");
      return;
    }
    const meetingSlug = "Toplantı Odası".trim().replace(/\s+/g, "-");
    setRoomNavigationIntent("meeting");
    router.push(`/chat/${meetingSlug}`);
  }, [canAccessMeetingRoom, router]);

  const markAsRead = useCallback((id?: number) => {
    if (!id) return;
    apiClientRef.current
      .post("/messages/read", { messageIds: [id] })
      .catch((err) => console.error("Error marking message as read:", err));
  }, []);

  useEffect(() => {
    socketRef.current = socket;
  }, [socket]);

  useEffect(() => {
    roomSnapshotKeysRef.current = {
      activeRoomId,
      roomId,
      roomDisplayName,
    };
  }, [activeRoomId, roomId, roomDisplayName]);

  const hasLeftRoomRef = useRef(false);
  const hasShownSiteJoinEffectRef = useRef(false);
  const hasAppliedInitialRoofModeRef = useRef(false);
  const normalizeUserKey = useCallback(
    (value?: string | null) =>
      (value || "").trim().toLocaleLowerCase("tr-TR"),
    [],
  );
  const requestRoomUsersSnapshot = useCallback(
    (roomKey?: string | null, targetSocket?: Socket | null) => {
      const snapshotSocket = targetSocket ?? socketRef.current;
      if (!snapshotSocket?.connected) return;

      const snapshotKeys = roomSnapshotKeysRef.current;
      const effectiveRoom =
        (typeof roomKey === "string" && roomKey.trim()) ||
        snapshotKeys.activeRoomId ||
        snapshotKeys.roomId ||
        snapshotKeys.roomDisplayName;
      if (!effectiveRoom) return;

      snapshotSocket.emit("room:getUsers", { room: effectiveRoom });
    },
    [],
  );
  const hasRoomUserPresenceGrace = useCallback(
    (username: string | null | undefined) => {
      const key = normalizeUserKey(username);
      if (!key) return false;
      const expiresAt = roomUserPresenceGraceUntilRef.current.get(key);
      if (!expiresAt) return false;
      if (expiresAt <= Date.now()) {
        roomUserPresenceGraceUntilRef.current.delete(key);
        return false;
      }
      return true;
    },
    [normalizeUserKey],
  );
  const armRoomUserPresenceGrace = useCallback(
    (username: string | null | undefined) => {
      const key = normalizeUserKey(username);
      if (!key) return;

      roomUserPresenceGraceUntilRef.current.set(
        key,
        Date.now() + ROOM_USER_PRESENCE_GRACE_MS,
      );

      const existingTimer = roomUserPresenceGraceTimersRef.current[key];
      if (existingTimer) {
        window.clearTimeout(existingTimer);
      }

      roomUserPresenceGraceTimersRef.current[key] = window.setTimeout(() => {
        delete roomUserPresenceGraceTimersRef.current[key];
        const expiresAt = roomUserPresenceGraceUntilRef.current.get(key);
        if (!expiresAt || expiresAt > Date.now()) return;

        roomUserPresenceGraceUntilRef.current.delete(key);
        if (latestRoomUsersSnapshotKeysRef.current.has(key)) return;

        setRoomUsers((prev) =>
          prev.filter((user) => normalizeUserKey(user.username) !== key),
        );
      }, ROOM_USER_PRESENCE_GRACE_MS + 100);
    },
    [normalizeUserKey],
  );
  const rememberAuthoritativeRole = useCallback(
    (username: string | null | undefined, role: RoleSnapshot | null) => {
      const normalized = normalizeUserKey(username);
      if (!normalized) return;

      if (!role) {
        authoritativeRoleByUsernameRef.current.delete(normalized);
        return;
      }

      authoritativeRoleByUsernameRef.current.set(normalized, role);
    },
    [normalizeUserKey],
  );
  const getAuthoritativeRole = useCallback(
    (username: string | null | undefined): RoleSnapshot | null => {
      const normalized = normalizeUserKey(username);
      if (!normalized) return null;
      return authoritativeRoleByUsernameRef.current.get(normalized) ?? null;
    },
    [normalizeUserKey],
  );
  const getCurrentUsername = useCallback(
    () =>
      isGuestSessionFromStorage()
        ? localStorage.getItem("guestUsername")
        : localStorage.getItem("username"),
    [],
  );
  useEffect(() => {
    return () => {
      Object.values(roomUserPresenceGraceTimersRef.current).forEach((timerId) =>
        window.clearTimeout(timerId),
      );
      roomUserPresenceGraceTimersRef.current = {};
    };
  }, []);
  const canCurrentViewerSeeMessage = useCallback(
    (message: Pick<Message, "targetGroup" | "originalUsername" | "username">) => {
      const currentUser = getCurrentUsername();
      const originalUsername = message.originalUsername || message.username;
      const isOwnMessage = Boolean(currentUser && originalUsername === currentUser);
      const target = normalizeTargetGroup(message.targetGroup);

      if (!target || target === "everyone" || isOwnMessage) {
        return true;
      }

      const isGuest = isGuestSessionFromStorage();
      if (target === "members" && isGuest) return false;
      if (target === "staff" && (userRoleStarCountRef.current || 0) < 1) {
        return false;
      }

      return true;
    },
    [getCurrentUsername],
  );
  const appendMessageDeduped = useCallback(
    (message: Message) => {
      if (!canCurrentViewerSeeMessage(message)) return;
      if (message.id) markAsRead(message.id);

      setMessages((prev) => {
        const duplicateIndex = prev.findIndex((existing) =>
          areMessagesEquivalent(existing, message),
        );

        if (duplicateIndex === -1) {
          return [...prev, message];
        }

        const existing = prev[duplicateIndex];
        const updated = [...prev];
        updated[duplicateIndex] = {
          ...existing,
          ...message,
          avatar: message.avatar ?? existing.avatar,
          replyToMessage: message.replyToMessage ?? existing.replyToMessage,
          fontColor: message.fontColor ?? existing.fontColor ?? null,
          flashNick: message.flashNick ?? existing.flashNick ?? null,
          fontName: message.fontName ?? existing.fontName ?? null,
          granite: message.granite ?? existing.granite ?? null,
          userGif: message.userGif ?? existing.userGif ?? null,
          targetGroup: message.targetGroup ?? existing.targetGroup ?? null,
        };
        return updated;
      });
    },
    [canCurrentViewerSeeMessage, markAsRead],
  );
  const buildMessageFromApiRecord = useCallback(
    (record: ApiMessageRecord): Message => {
      const botId =
        typeof record.botId === "number"
          ? record.botId
          : record.botId
            ? Number(record.botId)
            : null;
      const isBotMessage = Boolean(botId);
      const isAgentMessage = Boolean(record.user?.agentNickname);
      const username =
        isBotMessage
          ? record.botUsername || record.user?.username || "Bot"
          : resolveViewerAwareDisplayName(
              {
                username: record.user?.username,
                displayUsername: record.user?.displayUsername,
                agentNickname: record.user?.agentNickname,
                roleStarCount: record.user?.role?.starCount ?? null,
              },
              Number(userRoleStarCountRef.current ?? 0),
            ) || "Bilinmeyen";
      const originalUsername =
        record.botUsername || record.user?.username || username;
      const profileUsername = record.user?.agentNickname || originalUsername;
      const isAiWelcomeMessage =
        isBotMessage &&
        Boolean(record.botId) &&
        !record.botSpeakerUsername &&
        !record.botSpeakerDisplayName;
      return {
        id: record.id,
        room: roomId || roomDisplayName || "",
        username,
        originalUsername,
        profileUsername,
        message: record.content ?? "",
        gender: (record.user?.gender as "male" | "female") ?? "male",
        isGuest: record.user?.isGuest === true || isAgentMessage,
        timestamp: normalizeMessageTimestamp(record.createdAt),
        image: record.image ?? undefined,
        audio: record.audio ?? undefined,
        audioFileName: record.audioFileName ?? undefined,
        avatar: isAgentMessage ? null : calculateAvatar(record.user?.icon),
        fontColor: record.fontColor ?? null,
        targetGroup: normalizeTargetGroup(record.targetGroup),
        replyToMessage: record.replyToMessage ?? null,
        isBot: isBotMessage,
        botId,
        botSpeakerUsername: record.botSpeakerUsername ?? null,
        botSpeakerDisplayName:
          record.botSpeakerDisplayName ?? record.botSpeakerUsername ?? null,
        flashNick: record.user?.flashNick ?? null,
        fontName: record.user?.fontName ?? null,
        granite: record.user?.granite ?? null,
        nickColor: record.user?.nickColor ?? null,
        isWelcomeMessage:
          isWelcomeMessageContent(record.content) || isAiWelcomeMessage,
        isAiWelcomeMessage,
      };
    },
    [isWelcomeMessageContent, roomDisplayName, roomId],
  );
  const buildMessageFromSocketPayload = useCallback(
    (data: Message & {
      user?: {
        username?: string;
        icon?: string | null;
        fontName?: string | null;
        granite?: string | null;
        nickColor?: string | null;
        flashNick?: string | null;
      };
      icon?: string | null;
      displayUsername?: string;
      originalUsername?: string;
      messageId?: number;
      time?: string;
      content?: string | null;
      isBot?: boolean;
      botId?: number | null;
      botSpeakerUsername?: string | null;
      botSpeakerDisplayName?: string | null;
      fontName?: string | null;
      granite?: string | null;
      nickColor?: string | null;
      flashNick?: string | null;
    }): Message => {
      const userObj = data?.user;
      const rawIcon = data?.icon ?? userObj?.icon ?? null;
      const normalizedMessageText =
        typeof data?.message === "string"
          ? data.message
          : typeof data?.content === "string"
            ? data.content
            : "";
      const originalUsername =
        data?.originalUsername || data?.username || userObj?.username || "Bilinmeyen";
      const normalizedOriginal = originalUsername.trim().toLowerCase();
      const roomUserInfo = roomUsersRef.current.find(
        (user) => user.username.trim().toLowerCase() === normalizedOriginal,
      );
      const username =
        resolveViewerAwareDisplayName(
          {
            username: originalUsername,
            displayUsername: data?.displayUsername,
            agentNickname: roomUserInfo?.agentNickname ?? null,
            roleStarCount:
              roomUserInfo?.roleStarCount ??
              (typeof data?.roleStarCount === "number" ? data.roleStarCount : null),
          },
          Number(userRoleStarCountRef.current ?? 0),
        ) || originalUsername;
      const isAgentMessage = Boolean(roomUserInfo?.agentNickname);
      const profileUsername = roomUserInfo?.agentNickname || originalUsername;
      const currentUser = getCurrentUsername();
      const isOwnMessage = Boolean(currentUser && originalUsername === currentUser);
      const roomUserIconKey = roomUserInfo?.icon
        ? roomUserInfo.icon
            .replace(/^\/avatarlar\//, "")
            .replace(/\.(png|gif)$/, "")
        : null;
      const icon = isAgentMessage
        ? null
        : isOwnMessage
        ? rawIcon || profileIconRef.current
        : rawIcon || roomUserIconKey;

      const isAiWelcomeMessage =
        data?.isBot === true &&
        Boolean(data?.botId) &&
        !data?.botSpeakerUsername &&
        !data?.botSpeakerDisplayName;
      return {
        ...data,
        id: data?.id ?? data?.messageId,
        room: data?.room || roomId || roomDisplayName || "",
        username,
        originalUsername,
        profileUsername,
        message: normalizedMessageText,
        timestamp: normalizeMessageTimestamp(
          data?.timestamp ?? data?.time ?? new Date().toISOString(),
        ),
        avatar: isAgentMessage ? null : calculateAvatar(icon),
        fontColor: data?.fontColor ?? null,
        targetGroup: normalizeTargetGroup(data?.targetGroup),
        isBot: data?.isBot === true,
        botId:
          typeof data?.botId === "number"
            ? data.botId
            : data?.botId
              ? Number(data.botId)
              : null,
        botSpeakerUsername: data?.botSpeakerUsername ?? null,
        botSpeakerDisplayName: data?.botSpeakerDisplayName ?? null,
        roleStarCount:
          roomUserInfo?.roleStarCount ??
          (typeof data?.roleStarCount === "number" ? data.roleStarCount : null),
        replyToMessage: data?.replyToMessage ?? null,
        flashNick: data?.flashNick ?? userObj?.flashNick ?? roomUserInfo?.flashNick ?? null,
        fontName: data?.fontName ?? userObj?.fontName ?? roomUserInfo?.fontName ?? null,
        granite: data?.granite ?? userObj?.granite ?? roomUserInfo?.granite ?? null,
        nickColor: data?.nickColor ?? userObj?.nickColor ?? roomUserInfo?.nickColor ?? null,
        userGif: roomUserInfo?.userGif ?? null,
        isWelcomeMessage:
          isWelcomeMessageContent(normalizedMessageText) || isAiWelcomeMessage,
        isAiWelcomeMessage,
      };
    },
    [getCurrentUsername, isWelcomeMessageContent, roomDisplayName, roomId],
  );
  const buildMessageFromImmediateSend = useCallback(
    (messageData: ImmediateSentMessage): Message => {
      const activeAgentNickname = localStorage.getItem("agentNickname") || null;
      const isAgentMessage = Boolean(activeAgentNickname);
      const roomUserInfo = roomUsersRef.current.find(
        (user) =>
          user.username.trim().toLocaleLowerCase("tr-TR") ===
          messageData.originalUsername.trim().toLocaleLowerCase("tr-TR"),
      );

      return {
        id: messageData.id,
        room: roomId || roomDisplayName || "",
        username: messageData.displayUsername || messageData.username,
        originalUsername: messageData.originalUsername || messageData.username,
        profileUsername:
          activeAgentNickname || messageData.originalUsername || messageData.username,
        message: messageData.finalContent,
        gender: messageData.gender,
        isGuest: messageData.isGuest,
        timestamp: normalizeMessageTimestamp(messageData.createdAt),
        image: messageData.image ?? undefined,
        audio: messageData.audio ?? undefined,
        audioFileName: messageData.audioFileName ?? undefined,
        avatar: isAgentMessage ? null : calculateAvatar(messageData.icon),
        fontColor: messageData.fontColor ?? null,
        targetGroup: normalizeTargetGroup(messageData.targetGroup),
        replyToMessage: messageData.replyToMessage ?? null,
        flashNick: roomUserInfo?.flashNick ?? null,
        fontName: roomUserInfo?.fontName ?? null,
        granite: roomUserInfo?.granite ?? null,
        nickColor: roomUserInfo?.nickColor ?? null,
        userGif: roomUserInfo?.userGif ?? null,
        isWelcomeMessage:
          messageData.isWelcomeMessage === true ||
          isWelcomeMessageContent(messageData.finalContent),
      };
    },
    [isWelcomeMessageContent, roomDisplayName, roomId],
  );
  const handleMessageSent = useCallback(
    (messageData: ImmediateSentMessage) => {
      appendMessageDeduped(buildMessageFromImmediateSend(messageData));
    },
    [appendMessageDeduped, buildMessageFromImmediateSend],
  );
  const enqueueWelcomePrompt = useCallback(
    ({
      room,
      joinedUsername,
      welcomeDisplayName,
    }: {
      room: string;
      joinedUsername: string;
      welcomeDisplayName: string;
    }) => {
      const template = (welcomeMessageTemplateRef.current || "").trim();
      const resolvedWelcomeContent = template
        ? template.replace(/\[username\]/gi, welcomeDisplayName)
        : "";
      const currentUser = currentUsernameRef.current;
      const currentUserKey = normalizeUserKey(currentUser);
      const joinedUserKeyForPrompt = normalizeUserKey(joinedUsername);
      const viewerStarCount = Number(userRoleStarCountRef.current ?? 0);
      const shouldShowWelcomePrompt =
        Boolean(resolvedWelcomeContent) &&
        Boolean(currentUserKey) &&
        Boolean(joinedUserKeyForPrompt) &&
        currentUserKey !== joinedUserKeyForPrompt &&
        viewerStarCount > 0;

      if (!shouldShowWelcomePrompt) {
        return;
      }

      const promptKey = `${room}:${joinedUserKeyForPrompt}`;
      const welcomePromptMessage: Message = {
        room,
        username: "Sistem",
        message: `✨ ${welcomeDisplayName} için hoşgeldin mesajı göndermek için tıkla 👋`,
        gender: "male",
        isGuest: false,
        timestamp: new Date().toISOString(),
        isSystemMessage: true,
        isClickable: true,
        systemAction: "sendWelcomeMessage",
        welcomeTargetUsername: joinedUsername,
        welcomeTargetDisplayName: welcomeDisplayName,
        welcomeMessageContent: resolvedWelcomeContent,
        welcomePromptKey: promptKey,
      };

      setMessages((prev) => {
        const now = Date.now();
        const isDuplicatePrompt = prev.some((msg) => {
          if (msg.systemAction !== "sendWelcomeMessage") return false;
          if (msg.welcomePromptKey !== promptKey) return false;
          const ts = msg.timestamp ? new Date(msg.timestamp).getTime() : 0;
          return ts && now - ts < 5000;
        });
        if (isDuplicatePrompt) return prev;
        return [...prev, welcomePromptMessage];
      });
    },
    [normalizeUserKey, setMessages],
  );
  const refreshCurrentUserAuthState = useCallback(async () => {
    const userData = await apiClient.auth.me();
    const starCount = userData.role?.starCount || 0;
    setUserStarCount(starCount);

    if (userData.statusMode?.id) {
      localStorage.setItem("statusModeId", String(userData.statusMode.id));
    }
    if (userData.statusMode?.name) {
      localStorage.setItem("statusModeName", userData.statusMode.name);
    }

    const frameKey = userData.frame ?? null;
    profileFrameRef.current = frameKey;
    const framePath = resolveFrameUrl(frameKey);
    const iconKey = userData.icon ?? null;
    profileIconRef.current = iconKey;
    const resolvedIcon = calculateAvatar(iconKey);
    setCurrentUserIcon(resolvedIcon);

    if (typeof window !== "undefined") {
      if (framePath) {
        localStorage.setItem("profileFrame", framePath);
      } else {
        localStorage.removeItem("profileFrame");
      }

      if (resolvedIcon) {
        localStorage.setItem("profileIcon", resolvedIcon);
        localStorage.setItem("profileIconOwner", userData.username);
      } else {
        localStorage.removeItem("profileIcon");
        localStorage.removeItem("profileIconOwner");
      }
    }

    if (userData.gender) {
      setUserGender(userData.gender);
      userGenderRef.current = userData.gender;
    }
    const roleName =
      userData.role?.name ??
      (userData as { roleName?: string | null; role_title?: string | null })
        .roleName ??
      (userData as { roleName?: string | null; role_title?: string | null })
        .role_title ??
      null;
    setUserRoleName(roleName);
    userRoleNameRef.current = roleName;

    const roleIcon = userData.role?.icon?.trim?.() || null;
    userRoleIconRef.current = roleIcon || null;
    const roleStarColor = userData.role?.starColor || null;
    userRoleStarColorRef.current = roleStarColor;
    const roleStarCount = Number.isFinite(userData.role?.starCount)
      ? (userData.role?.starCount as number)
      : null;
    userRoleStarCountRef.current = roleStarCount;

    const roleSnapshot: RoleSnapshot = {
      roleName,
      roleIcon,
      roleStarColor,
      roleStarCount,
    };
    setCurrentUserRoleSnapshot(roleSnapshot);
    setCurrentUserRoleReady(true);
    rememberAuthoritativeRole(userData.username, roleSnapshot);

    setCurrentUserPermissions(userData.permissions || []);
    setCurrentRolePermissions(
      (userData.role?.permissions as Record<string, unknown> | null) ?? null,
    );

    if (isJoinEffectId(userData.joinEffect)) {
      localStorage.setItem("profileJoinEffect", userData.joinEffect as JoinEffectId);
    } else {
      localStorage.removeItem("profileJoinEffect");
    }

    setInitialMicBanned(userData.micBanned || false);
    setInitialCameraBanned(userData.cameraBanned || false);
    setGlobalMuted(userData.globalMuted || false);

    return { starCount, roleName };
  }, [rememberAuthoritativeRole]);
  const emitLeaveOnce = useCallback(
    (
      socketInstance: Socket | null | undefined,
      room: string | null | undefined,
      username: string | null | undefined,
    ) => {
      if (hasLeftRoomRef.current) return;
      if (!socketInstance || !room) return;
      hasLeftRoomRef.current = true;
      try {
        socketInstance.emit("leaveRoom", {
          room,
          username: username ?? undefined,
        });
      } catch (error) {
        console.error("leaveRoom emit failed:", error);
      }
    },
    [],
  );

  const buildCurrentRoomDescriptionMessages = useCallback((): Message[] => {
    const currentRoom = roomDetailRef.current;
    const roomDescription =
      currentRoom?.description?.trim() ||
      currentRoom?.name?.trim() ||
      roomDisplayName?.trim();

    if (!roomDescription) return [];

    return [
      createRoomDescriptionMessage(
        activeRoomId || roomId || roomDisplayName,
        roomDescription,
      ),
    ];
  }, [activeRoomId, roomId, roomDisplayName]);

  const addSystemMessage = useCallback(
    (
      message: string,
      room?: string,
      skipDuplicateCheck?: boolean,
      isClickable?: boolean,
      isRoomDescription?: boolean,
    ) => {
      setMessages((prev) => {
        if (isRoomDescription) {
          const roomDescriptionMessage = createRoomDescriptionMessage(
            room || activeRoomId || roomDisplayName,
            message,
          );
          return pinRoomDescriptionMessage(prev, [roomDescriptionMessage]);
        }

        // Mikrofon sırası mesajları için duplicate kontrolü atla
        if (!skipDuplicateCheck) {
          const now = Date.now();
          const exists = prev.some((msg) => {
            if (msg.username !== "Sistem") return false;
            if (msg.message !== message) return false;
            const ts = msg.timestamp ? new Date(msg.timestamp).getTime() : 0;
            return ts && now - ts < 5000;
          });
          if (exists) return prev;
        }
        return [
          ...prev,
          {
            room: room || activeRoomId || roomDisplayName,
            username: "Sistem",
            message,
            gender: "male",
            isGuest: false,
            timestamp: new Date().toISOString(),
            isSystemMessage: true,
            isClickable: isClickable || false,
            isRoomDescription: false,
          } as Message,
        ];
      });
    },
    [activeRoomId, roomDisplayName],
  );

  const enqueueJoinEffect = useCallback(
    (
      user: RoomUser,
      source: "site" | "room" = "room",
      options?: { force?: boolean },
    ) => {
      if (disableJoinEffectsRef.current) return;
      if (user.isGuest) return;
      if (user.agentNickname) return;
      if (!options?.force && user.statusModeName === "Çatıda") {
        return;
      }
      if (
        !user.joinEffect ||
        !isJoinEffectId(user.joinEffect)
      ) {
        return;
      }

      const dedupKey = `${(user.username || "").toLocaleLowerCase("tr-TR")}:${
        user.joinEffect
      }:${source}`;
      const now = Date.now();
      const lastShown = joinEffectDedupRef.current.get(dedupKey) ?? 0;
      if (!options?.force && now - lastShown < 5000) return;

      joinEffectDedupRef.current.set(dedupKey, now);
      for (const [key, ts] of joinEffectDedupRef.current.entries()) {
        if (now - ts > 20000) {
          joinEffectDedupRef.current.delete(key);
        }
      }

      setJoinEffectQueue((prev) => {
        const nextQueue = [
          ...prev,
          {
          key: `${dedupKey}:${now}`,
          username: user.username,
          loginHistoryId: user.loginHistoryId ?? null,
          joinEffect: user.joinEffect as JoinEffectId,
          source,
          icon: user.icon ?? null,
          roleIcon: user.roleIcon ?? null,
          roleStarColor: user.roleStarColor ?? null,
          roleStarCount: user.roleStarCount ?? null,
          agentNickname: user.agentNickname ?? null,
          },
        ];
        return isMobileJoinEffectModeRef.current
          ? nextQueue.slice(-2)
          : nextQueue;
      });
    },
    [],
  );

  const triggerRemoteJoinEffect = useCallback((banner: JoinEffectBanner, options?: { force?: boolean }) => {
    if (disableJoinEffectsRef.current) {
      logJoinEffectClientDebug("drop:disabled", {
        username: banner.username,
        joinEffect: banner.joinEffect,
        source: banner.source,
      });
      return;
    }
    if (banner.agentNickname) {
      logJoinEffectClientDebug("drop:agent", {
        username: banner.username,
        agentNickname: banner.agentNickname,
        joinEffect: banner.joinEffect,
        source: banner.source,
      });
      return;
    }

    const normalizedBanner: JoinEffectBanner = {
      ...banner,
      key: banner.key || `${banner.username.toLocaleLowerCase("tr-TR")}:${banner.joinEffect}:${Date.now()}`,
      source: banner.source ?? "room",
    };

    const normalizedEntryType =
      normalizedBanner.entryType ?? normalizedBanner.source ?? "room";
    const mobileEventInstance =
      normalizedBanner.socketId ||
      normalizedBanner.loginHistoryId ||
      "no-instance";
    const dedupKey = isMobileJoinEffectModeRef.current
      ? `${normalizedBanner.username.toLocaleLowerCase("tr-TR")}:${
          normalizedBanner.joinEffect
        }:${normalizedEntryType}:${mobileEventInstance}`
      : `${normalizedBanner.username.toLocaleLowerCase("tr-TR")}:${
          normalizedBanner.joinEffect
        }`;
    const now = Date.now();
    const lastShown = joinEffectDedupRef.current.get(dedupKey) ?? 0;
    if (!options?.force && now - lastShown < 5000) {
      logJoinEffectClientDebug("drop:dedup", {
        username: normalizedBanner.username,
        joinEffect: normalizedBanner.joinEffect,
        source: normalizedBanner.source,
        entryType: normalizedBanner.entryType,
        dedupKey,
        ageMs: now - lastShown,
      });
      return;
    }
    joinEffectDedupRef.current.set(dedupKey, now);

    if (!activeJoinEffectRef.current) {
      logJoinEffectClientDebug("show:active", {
        username: normalizedBanner.username,
        joinEffect: normalizedBanner.joinEffect,
        source: normalizedBanner.source,
        entryType: normalizedBanner.entryType,
      });
      activeJoinEffectRef.current = normalizedBanner;
      setActiveJoinEffect(normalizedBanner);
      return;
    }

    logJoinEffectClientDebug("show:queued", {
      username: normalizedBanner.username,
      joinEffect: normalizedBanner.joinEffect,
      source: normalizedBanner.source,
      entryType: normalizedBanner.entryType,
    });
    setJoinEffectQueue((prev) => {
      const nextQueue = [...prev, normalizedBanner];
      return isMobileJoinEffectModeRef.current
        ? nextQueue.slice(-4)
        : nextQueue;
    });
  }, []);

  useEffect(() => {
    const nextPresence = new Map<
      string,
      { joinEffect: string | null; statusModeName: string | null }
    >();
    const normalizedCurrentUsername = String(currentUsername || "")
      .trim()
      .toLocaleLowerCase("tr-TR");

    for (const user of roomUsers) {
      const normalizedUsername = String(user.username || "")
        .trim()
        .toLocaleLowerCase("tr-TR");
      if (!normalizedUsername) continue;

      const presenceKey = `${normalizedUsername}:${
        user.loginHistoryId ?? "no-login"
      }`;
      const joinEffect =
        typeof user.joinEffect === "string" && isJoinEffectId(user.joinEffect)
          ? user.joinEffect
          : null;
      const statusModeName = user.statusModeName ?? null;

      nextPresence.set(presenceKey, {
        joinEffect,
        statusModeName,
      });

      if (!isMobileJoinEffectModeRef.current) {
        continue;
      }
      if (!mobileJoinEffectPresencePrimedRef.current) {
        continue;
      }
      if (!joinEffect || user.isBot || user.isGuest || user.agentNickname) {
        continue;
      }
      if (
        normalizedCurrentUsername &&
        normalizedUsername === normalizedCurrentUsername
      ) {
        continue;
      }

      const previousPresence =
        mobileJoinEffectPresenceRef.current.get(presenceKey) ?? null;
      const isNewPresence = !previousPresence;
      const joinEffectChanged =
        previousPresence?.joinEffect !== joinEffect;
      const exitedRoof =
        previousPresence?.statusModeName === "Çatıda" &&
        statusModeName !== "Çatıda";

      if (!isNewPresence && !joinEffectChanged && !exitedRoof) {
        continue;
      }

      logJoinEffectClientDebug("fallback:roomUsers-presence", {
        username: user.username,
        joinEffect,
        statusModeName,
        previousStatusModeName: previousPresence?.statusModeName ?? null,
        loginHistoryId: user.loginHistoryId ?? null,
      });

      triggerRemoteJoinEffect({
        key: `${normalizedUsername}:${joinEffect}:presence:${Date.now()}`,
        username: user.username,
        loginHistoryId: user.loginHistoryId ?? null,
        joinEffect,
        source: statusModeName === "Çatıda" ? "site" : "room",
        icon: user.icon ?? null,
        roleIcon: user.roleIcon ?? null,
        roleStarColor: user.roleStarColor ?? null,
        roleStarCount: user.roleStarCount ?? null,
        roleName: user.roleName ?? null,
        agentNickname: user.agentNickname ?? null,
        entryType: statusModeName === "Çatıda" ? "site" : "room",
      });
    }

    mobileJoinEffectPresenceRef.current = nextPresence;
    if (!mobileJoinEffectPresencePrimedRef.current) {
      mobileJoinEffectPresencePrimedRef.current = true;
    }
  }, [roomUsers, currentUsername, triggerRemoteJoinEffect]);




  const fetchSecuritySettings = useCallback(async () => {
    try {
      const response =
        await apiClientRef.current.get<SecuritySettings>("/security-settings");
      const data = response?.data ?? {};
      const membersMicDisabled = Boolean(data?.membersMicrophoneDisabled);
      const guestsWritingDisabled = Boolean(data?.guestsWritingDisabled);
      const guestsMicDisabled = Boolean(data?.guestsMicrophoneDisabled);
      const starCount = (userRoleStarCountRef.current ??
        userStarCount ??
        0) as number;
      const isGuest = isGuestSessionFromStorage();

      const shouldDisableMic =
        (membersMicDisabled && starCount < 3) || (isGuest && guestsMicDisabled);
      const shouldDisableWriting = isGuest && guestsWritingDisabled;

      setMicDisabled(shouldDisableMic);
      setMicDisabledReason(
        shouldDisableMic
          ? isGuest && guestsMicDisabled
            ? "Misafirler mikrofonu kullanamaz."
            : "Yıldız sayınız 3'ten küçük olduğu için mikrofonu açamazsınız."
          : null,
      );

      setWritingDisabled(shouldDisableWriting);
      setWritingDisabledReason(
        shouldDisableWriting ? "Misafirler için mesaj gönderme kapalı." : null,
      );

      if (shouldDisableMic && !(isGuest && guestsMicDisabled)) {
        addSystemMessage(
          "Yıldız sayınız 3'ten küçük olduğu için mikrofonunuz devre dışı bırakıldı.",
        );
      }
    } catch (error) {
      const apiErr = error as ApiError & { status?: number; message?: string };
      const isAccessDenied =
        apiErr?.status === 403 ||
        (apiErr?.message || "").toLowerCase().includes("access denied");
      const isUnauthorized = apiErr?.status === 401;

      if (isUnauthorized) {
        setWritingDisabled(true);
        setWritingDisabledReason("Mesaj göndermek için giriş yapmalısınız.");
        return;
      }
      if (isAccessDenied) {
        // Backend is enforcing the rule; silently disable mic for low-star users
        setMicDisabled(true);
        setMicDisabledReason(
          "Yıldız sayınız 3'ten küçük olduğu için mikrofonu açamazsınız.",
        );
        return;
      }

      console.error("Failed to fetch security settings:", error);
      setMicDisabled(false);
      setMicDisabledReason(null);
      setWritingDisabled(false);
      setWritingDisabledReason(null);
    }
  }, [userStarCount, addSystemMessage]);

  const isCurrentUserHandRaised = useMemo(() => {
    const username = getCurrentUsername();
    if (!username) return false;
    return !!roomUsers.find((u) => u.username === username)?.isHandRaised;
  }, [roomUsers]);

  useEffect(() => {
    const username = getCurrentUsername();
    if (!username) {
      setRoomMuted(false);
      setGlobalMuted(false);
      setMutedRoomName(null);
      return;
    }

    const meInRoom = roomUsers.find((u) => u.username === username);
    const nextRoomMuted = meInRoom?.roomMuted === true;
    const nextGlobalMuted = meInRoom
      ? meInRoom.globalMuted === true
      : globalMuted;

    setRoomMuted(nextRoomMuted);
    setGlobalMuted(nextGlobalMuted);
    if (nextRoomMuted || nextGlobalMuted) {
      setMutedRoomName(roomDetail?.name || roomDisplayName);
    } else {
      setMutedRoomName(null);
    }
  }, [roomUsers, roomDetail?.name, roomDisplayName, globalMuted]);

  const updateCurrentUserFrame = useCallback((framePath: string | null) => {
    const username = getCurrentUsername();
    if (!username) return;
    setRoomUsers((prev) =>
      prev.map((user) =>
        user.username === username ? { ...user, frame: framePath } : user,
      ),
    );
  }, [getCurrentUsername]);

  const updateCurrentUserIcon = useCallback((iconPath: string | null) => {
    const username = getCurrentUsername();
    if (!username) return;
    setRoomUsers((prev) =>
      prev.map((user) =>
        user.username === username ? { ...user, icon: iconPath } : user,
      ),
    );
  }, [getCurrentUsername]);

  const handleToggleHand = useCallback(
    (next?: boolean) => {
      if (!socket) return;
      const username = getCurrentUsername();
      if (!username) return;
      const roomKey = activeRoomId || roomDisplayName;
      const desiredState = next ?? !isCurrentUserHandRaised;

      setRoomUsers((prev) =>
        prev.map((user) =>
          user.username === username
            ? {
                ...user,
                isHandRaised: desiredState,
                handRaisedAt: desiredState ? Date.now() : null,
              }
            : user,
        ),
      );

      socket.emit("hand:update", {
        room: roomKey,
        username,
        isRaised: desiredState,
      });

      if (desiredState && !isCurrentUserHandRaised) {
        addSystemMessage(
          `${username} mikrofon sırasına girdi 🎤`,
          roomKey,
          true,
        );
      } else if (!desiredState && isCurrentUserHandRaised) {
        addSystemMessage(
          `${username} mikrofon sırasından çıktı 🎤`,
          roomKey,
          true,
        );
      }
    },
    [
      socket,
      activeRoomId,
      roomDisplayName,
      isCurrentUserHandRaised,
      addSystemMessage,
    ],
  );

  // Fetch user data from /me endpoint
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const isGuest = isGuestSessionFromStorage();

        // Only fetch user data for logged-in users, not guests
        if (!isGuest) {
          const { starCount } = await refreshCurrentUserAuthState();
          setIsUserDataLoaded(true);
          return;
        }

        // Misafir kullanıcılar için gender bilgisini localStorage'dan al
        const guestGender = localStorage.getItem("guestGender") || "male";
        setUserGender(guestGender);
        userGenderRef.current = guestGender;
        // Misafirler için icon null kalır, calculateAvatar gender'a göre default avatar döndürecek
        setCurrentUserIcon(null);
        profileIconRef.current = null;
        setCurrentUserPermissions([]);
        setCurrentRolePermissions(null);
        setCurrentUserRoleSnapshot(null);
        setCurrentUserRoleReady(true);

        setIsUserDataLoaded(true);
      } catch (error) {
        console.error("Failed to fetch user data:", error);
        setUserRoleName(null);
        userRoleNameRef.current = null;
        userRoleIconRef.current = null;
        userRoleStarColorRef.current = null;
        userRoleStarCountRef.current = null;
        userGenderRef.current = null;
        setCurrentUserPermissions([]);
        setCurrentRolePermissions(null);
        // If fetching fails, keep default star count of 0
      } finally {
        setIsUserDataLoaded(true);
      }
    };

    fetchUserData();
  }, [refreshCurrentUserAuthState]);

  // roomUsers değiştiğinde ref'i güncelle (socket event handler'lardan erişim için)
  useEffect(() => {
    roomUsersRef.current = roomUsers;
  }, [roomUsers]);

  useEffect(() => {
    if (!socket) return;

    const handleVoiceUserStateChanged = (data: {
      room?: string;
      username?: string;
      isInVoiceChat?: boolean;
      isMuted?: boolean;
      isInVoiceSeat?: boolean;
      voiceSeatJoinedAt?: number | null;
      voiceSeatIndex?: number | null;
    }) => {
      const normalizedUsername = normalizeUserKey(data.username);
      if (!normalizedUsername) return;

      const normalizedEventRoom = String(data.room || "")
        .trim()
        .toLocaleLowerCase("tr-TR");
      const currentRoomKeys = [activeRoomId, roomId, roomDisplayName]
        .map((value) =>
          String(value || "")
            .trim()
            .toLocaleLowerCase("tr-TR"),
        )
        .filter(Boolean);

      if (
        normalizedEventRoom &&
        currentRoomKeys.length > 0 &&
        !currentRoomKeys.includes(normalizedEventRoom)
      ) {
        return;
      }

      const hasKnownUser = roomUsersRef.current.some(
        (user) => normalizeUserKey(user.username) === normalizedUsername,
      );
      if (!hasKnownUser) {
        requestRoomUsersSnapshot(data.room);
      }

      setRoomUsers((prevUsers) =>
        prevUsers.map((user) => {
          if (normalizeUserKey(user.username) !== normalizedUsername) {
            return user;
          }

          return {
            ...user,
            isInVoiceChat:
              data.isInVoiceChat !== undefined
                ? data.isInVoiceChat
                : user.isInVoiceChat,
            isMuted: data.isMuted !== undefined ? data.isMuted : user.isMuted,
            isInVoiceSeat:
              data.isInVoiceSeat !== undefined
                ? data.isInVoiceSeat
                : user.isInVoiceSeat,
            voiceSeatJoinedAt:
              data.voiceSeatJoinedAt !== undefined
                ? data.voiceSeatJoinedAt
                : user.voiceSeatJoinedAt,
            voiceSeatIndex:
              data.voiceSeatIndex !== undefined
                ? data.voiceSeatIndex
                : user.voiceSeatIndex,
          };
        }),
      );

    };

    const handleVoiceSeatChanged = (data: {
      room?: string;
      username?: string;
      isInVoiceChat?: boolean;
      isMuted?: boolean;
      isInVoiceSeat?: boolean;
      voiceSeatJoinedAt?: number | null;
      voiceSeatIndex?: number | null;
    }) => {
      const normalizedUsername = normalizeUserKey(data.username);
      if (!normalizedUsername) return;

      const normalizedEventRoom = String(data.room || "")
        .trim()
        .toLocaleLowerCase("tr-TR");
      const currentRoomKeys = [activeRoomId, roomId, roomDisplayName]
        .map((value) =>
          String(value || "")
            .trim()
            .toLocaleLowerCase("tr-TR"),
        )
        .filter(Boolean);

      if (
        normalizedEventRoom &&
        currentRoomKeys.length > 0 &&
        !currentRoomKeys.includes(normalizedEventRoom)
      ) {
        return;
      }

      const hasKnownUser = roomUsersRef.current.some(
        (user) => normalizeUserKey(user.username) === normalizedUsername,
      );
      if (!hasKnownUser) {
        requestRoomUsersSnapshot(data.room);
      }

      setRoomUsers((prevUsers) =>
        prevUsers.map((user) => {
          if (normalizeUserKey(user.username) !== normalizedUsername) {
            return user;
          }

          return {
            ...user,
            isInVoiceChat:
              data.isInVoiceChat !== undefined
                ? data.isInVoiceChat
                : data.isInVoiceSeat === true
                  ? true
                  : user.isInVoiceChat,
            isMuted: data.isMuted !== undefined ? data.isMuted : user.isMuted,
            isInVoiceSeat:
              data.isInVoiceSeat !== undefined
                ? data.isInVoiceSeat
                : user.isInVoiceSeat,
            voiceSeatJoinedAt:
              data.voiceSeatJoinedAt !== undefined
                ? data.voiceSeatJoinedAt
                : user.voiceSeatJoinedAt,
            voiceSeatIndex:
              data.voiceSeatIndex !== undefined
                ? data.voiceSeatIndex
                : user.voiceSeatIndex,
          };
        }),
      );

    };

    socket.on("voice:userStateChanged", handleVoiceUserStateChanged);
    socket.on("voice:seatChanged", handleVoiceSeatChanged);

    return () => {
      socket.off("voice:userStateChanged", handleVoiceUserStateChanged);
      socket.off("voice:seatChanged", handleVoiceSeatChanged);
    };
  }, [
    socket,
    activeRoomId,
    roomId,
    roomDisplayName,
    normalizeUserKey,
    requestRoomUsersSnapshot,
  ]);

  const refreshForbiddenWords = useCallback(async () => {
    try {
      const res = await apiClientRef.current.get("/forbidden-words");
      setForbiddenWords(res?.data ?? []);
    } catch (error) {
      console.error("Forbidden words fetch failed", error);
    }
  }, []);

  // Fetch forbidden words for client-side replacement
  useEffect(() => {
    refreshForbiddenWords();
  }, [refreshForbiddenWords]);

  useEffect(() => {
    setRoomJoinRevision(0);
  }, [roomDisplayName]);

  // Fetch existing messages when room is ready
  useEffect(() => {
    if (!roomDisplayName) return;
    if (roomJoinRevision === 0) return;

    const fetchMessages = async () => {
      try {
        // Backend oda için kullanıcının görebileceği geçmişi döner.
        const res = await apiClientRef.current.get(
          `/messages?roomName=${encodeURIComponent(roomDisplayName)}`,
          { timeout: 30000 },
        );
        const apiMessages = res?.data ?? [];

        // API'den gelen mesajları Message formatına çevir
        const formattedMessages: Message[] = apiMessages.map((msg: ApiMessageRecord) =>
          buildMessageFromApiRecord({
            ...msg,
            replyToMessage: msg.replyToMessage
              ? {
                  id: msg.replyToMessage.id,
                  content: msg.replyToMessage.content ?? "",
                  username:
                    (msg.replyToMessage as { user?: { username?: string | null } | null })
                      .user?.username ?? "Bilinmeyen",
                  createdAt: msg.replyToMessage.createdAt ?? "",
                }
              : null,
          }),
        );

        const filteredMessages = formattedMessages.filter(canCurrentViewerSeeMessage);

        // En eski mesajlar önce olacak şekilde sırala
        filteredMessages.reverse();

        console.log("[ROOM_MESSAGES_FETCHED]", {
          roomDisplayName,
          roomId,
          apiCount: Array.isArray(apiMessages) ? apiMessages.length : 0,
          formattedCount: formattedMessages.length,
          visibleCount: filteredMessages.length,
          firstMessage: filteredMessages[0]?.message ?? null,
          lastMessage: filteredMessages[filteredMessages.length - 1]?.message ?? null,
        });

        setMessages((prev) => {
          const roomDescriptionMessages = prev.filter((msg) => msg.isRoomDescription);
          const flowSystemMessages = prev.filter(
            (msg) =>
              !msg.isRoomDescription &&
              msg.isSystemMessage &&
              !msg.id &&
              (msg.systemAction === "exitRoof" ||
                msg.systemAction === "sendWelcomeMessage" ||
                msg.message.includes("Çatıdan indiniz")),
          );
          const liveMessages = prev.filter(
            (msg) =>
              !msg.isRoomDescription &&
              !msg.isSystemMessage &&
              !msg.id &&
              !filteredMessages.some((existing) =>
                areMessagesEquivalent(existing, msg),
              ),
          );

          return pinRoomDescriptionMessage(
            [
              ...filteredMessages,
              ...liveMessages,
              ...flowSystemMessages,
            ],
            roomDescriptionMessages.length > 0
              ? roomDescriptionMessages
              : buildCurrentRoomDescriptionMessages(),
          );
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message.toLowerCase() : "";
        if (message.includes("timeout")) {
          return;
        }
        console.error("Failed to fetch messages:", error);
      }
    };

    fetchMessages();
  }, [
    buildCurrentRoomDescriptionMessages,
    buildMessageFromApiRecord,
    canCurrentViewerSeeMessage,
    keepRoomChatHistoryEnabled,
    roomDisplayName,
    roomId,
    roomJoinRevision,
    setMessages,
  ]);

  // Fetch first message delay settings and apply on first entry per user
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    const getDelayIdentityKey = (delayVersion: string) => {
      const tenant = env.tenantId || "master";
      const isGuest = isGuestSessionFromStorage();
      const identityType = isGuest ? "guest" : "member";
      const identity =
        (isGuest
          ? localStorage.getItem("guestUsername")
          : localStorage.getItem("username")) || currentUsername || "user";
      return `firstMessageDelayUnlockAt:${tenant}:${identityType}:${identity.toLowerCase()}:${delayVersion}`;
    };

    const fetchFirstMessageDelay = async () => {
      try {
        const settings = await apiClient.systemSettings.getFirstMessageDelay();
        const delaySeconds = Number(settings.firstMessageDelaySeconds) || 0;

        if (!settings.firstMessageDelayEnabled || delaySeconds <= 0) {
          setFirstMessageDelayRemaining(0);
          return;
        }

        const delayVersion =
          settings.firstMessageDelayUpdatedAt || `seconds:${delaySeconds}`;
        const storageKey = getDelayIdentityKey(delayVersion);
        const now = Date.now();
        const storedUnlockAt = Number(localStorage.getItem(storageKey) || "0");
        const hasValidStoredUnlockAt =
          Number.isFinite(storedUnlockAt) && storedUnlockAt > 0;
        const unlockAt = hasValidStoredUnlockAt
          ? storedUnlockAt
          : now + delaySeconds * 1000;

        if (!hasValidStoredUnlockAt) {
          localStorage.setItem(storageKey, String(unlockAt));
        }

        const updateRemaining = () => {
          const remaining = Math.max(
            0,
            Math.ceil((unlockAt - Date.now()) / 1000),
          );
          setFirstMessageDelayRemaining(remaining);
          if (remaining <= 0 && interval) {
            clearInterval(interval);
            interval = null;
          }
        };

        updateRemaining();

        if (unlockAt > Date.now()) {
          interval = setInterval(updateRemaining, 1000);
        }
      } catch (error) {
        console.error("Failed to fetch first message delay settings:", error);
      }
    };

    fetchFirstMessageDelay();

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [currentUsername, settingsRefreshTick]);

  // Guest wait countdown (Misafir bekleme sn)
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    const isGuest = localStorage.getItem("isGuest") === "true";

    if (!isGuest) {
      setGuestWaitRemaining(0);
      return;
    }

    const fetchGuestWait = async () => {
      try {
        const settings = await apiClient.systemSettings.getGuestWait();
        const waitSeconds = Number(settings.guestWaitSeconds) || 0;

        if (waitSeconds <= 0) {
          setGuestWaitRemaining(0);
          return;
        }

        const tenant = env.tenantId || "master";
        const guestUsername = localStorage.getItem("guestUsername") || "guest";
        const waitVersion = settings.guestWaitUpdatedAt || `seconds:${waitSeconds}`;
        const storageKey = `guestWaitUnlockAt:${tenant}:${guestUsername.toLowerCase()}:${waitVersion}:seconds:${waitSeconds}`;
        const now = Date.now();
        const storedUnlockAt = Number(localStorage.getItem(storageKey) || "0");
        const hasValidStoredUnlockAt =
          Number.isFinite(storedUnlockAt) && storedUnlockAt > 0;
        const unlockAt = hasValidStoredUnlockAt
          ? storedUnlockAt
          : now + waitSeconds * 1000;

        if (!hasValidStoredUnlockAt) {
          localStorage.setItem(storageKey, String(unlockAt));
        }

        const updateRemaining = () => {
          const remaining = Math.max(
            0,
            Math.ceil((unlockAt - Date.now()) / 1000),
          );
          setGuestWaitRemaining(remaining);
          if (remaining <= 0 && interval) {
            clearInterval(interval);
            interval = null;
          }
        };

        updateRemaining();

        if (unlockAt > Date.now()) {
          interval = setInterval(updateRemaining, 1000);
        }
      } catch (error) {
        console.error("Failed to fetch guest wait settings:", error);
        setGuestWaitRemaining(0);
      }
    };

    fetchGuestWait();

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [settingsRefreshTick]);

  // Fetch chat permissions
  useEffect(() => {
    const fetchChatPermissions = async () => {
      try {
        const permissions = await apiClient.systemSettings.getChatPermissions();
        setChatPermissions(permissions);
      } catch (error) {
        console.error("Failed to fetch chat permissions:", error);
      }
    };

    fetchChatPermissions();

    // Listen for chat permissions updates
    const handlePermissionsUpdate = () => {
      fetchChatPermissions();
    };

    window.addEventListener("chatPermissionsUpdated", handlePermissionsUpdate);

    return () => {
      window.removeEventListener(
        "chatPermissionsUpdated",
        handlePermissionsUpdate,
      );
    };
  }, []);

  const fetchCommunicationPermissions = useCallback(async () => {
    try {
      const permissions =
        await apiClient.systemSettings.getCommunicationPermissions();
      setCommunicationPermissions(permissions);
    } catch (error) {
      console.error("Failed to fetch communication permissions:", error);
    }
  }, []);

  useEffect(() => {
    fetchCommunicationPermissions();

    const applyCommunicationPermissionsPayload = (
      permissions?: Partial<CommunicationPermissions> | null,
    ) => {
      if (!permissions) return;
      setCommunicationPermissions((prev) => ({
        guestCanWrite:
          typeof permissions.guestCanWrite === "boolean"
            ? permissions.guestCanWrite
            : prev?.guestCanWrite ?? true,
        memberAndGuestMicDurationSeconds:
          typeof permissions.memberAndGuestMicDurationSeconds === "number"
            ? permissions.memberAndGuestMicDurationSeconds
            : prev?.memberAndGuestMicDurationSeconds ?? 0,
        membersPrivateMessageEnabled:
          typeof permissions.membersPrivateMessageEnabled === "boolean"
            ? permissions.membersPrivateMessageEnabled
            : prev?.membersPrivateMessageEnabled ?? true,
        membersVoiceCallEnabled:
          typeof permissions.membersVoiceCallEnabled === "boolean"
            ? permissions.membersVoiceCallEnabled
            : prev?.membersVoiceCallEnabled ?? true,
        guestPrivateMessageEnabled:
          typeof permissions.guestPrivateMessageEnabled === "boolean"
            ? permissions.guestPrivateMessageEnabled
            : prev?.guestPrivateMessageEnabled ?? true,
        guestVoiceCallEnabled:
          typeof permissions.guestVoiceCallEnabled === "boolean"
            ? permissions.guestVoiceCallEnabled
            : prev?.guestVoiceCallEnabled ?? true,
        showMicrophonesOnMobile:
          typeof permissions.showMicrophonesOnMobile === "boolean"
            ? permissions.showMicrophonesOnMobile
            : prev?.showMicrophonesOnMobile ?? true,
      }));
    };

    const applyCommunicationPermissionsHint = (event?: Event) => {
      const detail = (event as CustomEvent<{
        communicationPermissions?: Partial<CommunicationPermissions>;
        showMicrophonesOnMobile?: boolean;
      }> | undefined)?.detail;
      applyCommunicationPermissionsPayload(detail?.communicationPermissions);
      if (typeof detail?.showMicrophonesOnMobile !== "boolean") return;
      const showMicrophonesOnMobile = detail.showMicrophonesOnMobile;

      setCommunicationPermissions((prev) =>
        prev
          ? {
              ...prev,
              showMicrophonesOnMobile,
            }
          : prev,
      );
    };

    const handleCommunicationPermissionsUpdate = (event: Event) => {
      applyCommunicationPermissionsHint(event);
      fetchCommunicationPermissions();
    };

    window.addEventListener(
      "communicationPermissionsUpdated",
      handleCommunicationPermissionsUpdate,
    );

    return () => {
      window.removeEventListener(
        "communicationPermissionsUpdated",
        handleCommunicationPermissionsUpdate,
      );
    };
  }, [fetchCommunicationPermissions]);

  useEffect(() => {
    if (!socket) return;

    const handleTenantSettingsUpdated = (payload?: {
      communicationPermissions?: Partial<CommunicationPermissions>;
      showMicrophonesOnMobile?: boolean;
    }) => {
      if (payload?.communicationPermissions) {
        setCommunicationPermissions((prev) => ({
          guestCanWrite:
            typeof payload.communicationPermissions?.guestCanWrite === "boolean"
              ? payload.communicationPermissions.guestCanWrite
              : prev?.guestCanWrite ?? true,
          memberAndGuestMicDurationSeconds:
            typeof payload.communicationPermissions
              ?.memberAndGuestMicDurationSeconds === "number"
              ? payload.communicationPermissions.memberAndGuestMicDurationSeconds
              : prev?.memberAndGuestMicDurationSeconds ?? 0,
          membersPrivateMessageEnabled:
            typeof payload.communicationPermissions
              ?.membersPrivateMessageEnabled === "boolean"
              ? payload.communicationPermissions.membersPrivateMessageEnabled
              : prev?.membersPrivateMessageEnabled ?? true,
          membersVoiceCallEnabled:
            typeof payload.communicationPermissions?.membersVoiceCallEnabled ===
            "boolean"
              ? payload.communicationPermissions.membersVoiceCallEnabled
              : prev?.membersVoiceCallEnabled ?? true,
          guestPrivateMessageEnabled:
            typeof payload.communicationPermissions?.guestPrivateMessageEnabled ===
            "boolean"
              ? payload.communicationPermissions.guestPrivateMessageEnabled
              : prev?.guestPrivateMessageEnabled ?? true,
          guestVoiceCallEnabled:
            typeof payload.communicationPermissions?.guestVoiceCallEnabled ===
            "boolean"
              ? payload.communicationPermissions.guestVoiceCallEnabled
              : prev?.guestVoiceCallEnabled ?? true,
          showMicrophonesOnMobile:
            typeof payload.communicationPermissions?.showMicrophonesOnMobile ===
            "boolean"
              ? payload.communicationPermissions.showMicrophonesOnMobile
              : prev?.showMicrophonesOnMobile ?? true,
        }));
      }
      if (typeof payload?.showMicrophonesOnMobile === "boolean") {
        const showMicrophonesOnMobile = payload.showMicrophonesOnMobile;
        setCommunicationPermissions((prev) =>
          prev
            ? {
                ...prev,
                showMicrophonesOnMobile,
              }
            : prev,
        );
      }
      void fetchSecuritySettings();
      void fetchCommunicationPermissions();
      setSettingsRefreshTick((value) => value + 1);
    };

    socket.on("tenant:settingsUpdated", handleTenantSettingsUpdated);

    return () => {
      socket.off("tenant:settingsUpdated", handleTenantSettingsUpdated);
    };
  }, [socket, fetchSecuritySettings, fetchCommunicationPermissions]);

  // Member/Guest mic wait countdown (minutes from system setting)
  useEffect(() => {
    if (!communicationPermissions) {
      setMicWaitRemainingSeconds(0);
      return;
    }

    const durationMinutes = Number(
      communicationPermissions.memberAndGuestMicDurationSeconds,
    );
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      setMicWaitRemainingSeconds(0);
      return;
    }

    const tenant = env.tenantId || "master";
    const isGuest = localStorage.getItem("isGuest") === "true";
    const identity = isGuest
      ? localStorage.getItem("guestUsername") || "guest"
      : localStorage.getItem("userId") || localStorage.getItem("username") || "member";
    const storageKey = `micWaitUnlockAt:${tenant}:${String(identity).toLowerCase()}`;

    const now = Date.now();
    const storedUnlockAt = Number(sessionStorage.getItem(storageKey) || "0");
    const hasValidStoredUnlockAt =
      Number.isFinite(storedUnlockAt) && storedUnlockAt > 0;
    const unlockAt = hasValidStoredUnlockAt
      ? storedUnlockAt
      : now + durationMinutes * 60 * 1000;

    if (!hasValidStoredUnlockAt) {
      sessionStorage.setItem(storageKey, String(unlockAt));
    }

    const updateRemaining = () => {
      const remaining = Math.max(0, Math.ceil((unlockAt - Date.now()) / 1000));
      setMicWaitRemainingSeconds(remaining);
      return remaining;
    };

    let interval: ReturnType<typeof setInterval> | null = null;
    const initial = updateRemaining();
    if (initial > 0) {
      interval = setInterval(() => {
        const current = updateRemaining();
        if (current <= 0 && interval) {
          clearInterval(interval);
          interval = null;
        }
      }, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [communicationPermissions]);

  useEffect(() => {
    const fetchRadioSettings = async () => {
      try {
        const response =
          await apiClientRef.current.get<RadioSettings>("/radio-settings");
        const data = response?.data;
        setRadioSettings({
          id: data?.id,
          radioLink:
            typeof data?.radioLink === "string" ? data.radioLink : null,
          radioRequestLink:
            typeof data?.radioRequestLink === "string"
              ? data.radioRequestLink
              : null,
        });
      } catch (error) {
        console.error("Radyo ayarları alınamadı:", error);
        setRadioSettings(null);
      }
    };

    fetchRadioSettings();
  }, []);

  useEffect(() => {
    if (!isUserDataLoaded) return;
    fetchSecuritySettings();
  }, [isUserDataLoaded, fetchSecuritySettings]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setChatBackground(
      resolveEffectiveChatBackground(roomDetailRef.current, {
        includeFallback: false,
      }),
    );
    const savedFont = localStorage.getItem("chatFontSize");
    if (savedFont) setChatFontSize(savedFont);
    const savedColor = localStorage.getItem("chatFontColor");
    if (savedColor) setChatFontColor(savedColor);

    const handleBackgroundChange = (event: Event) => {
      const detail = (event as CustomEvent<string | null>).detail;
        if (detail !== undefined) {
          if (detail) {
            setChatBackground(detail);
          } else {
            setChatBackground(
              resolveEffectiveChatBackground(roomDetailRef.current, {
                includeFallback: true,
              }),
            );
          }
        }
    };

    const handleFontChange = (event: Event) => {
      const detail = (event as CustomEvent<string | null>).detail;
      if (detail !== undefined) {
        setChatFontSize(detail || "16px");
      }
    };

    const handleFontColorChange = (event: Event) => {
      const detail = (event as CustomEvent<string | null>).detail;
      if (detail !== undefined) {
        setChatFontColor(detail || null);
      }
    };

    const handleFrameChange = (event: Event) => {
      const detail = (
        event as CustomEvent<{ path: string | null; key: string | null }>
      ).detail;
      if (detail !== undefined) {
        const framePath = detail.path || null;
        const frameKey = detail.key || null;

        profileFrameRef.current = frameKey;
        updateCurrentUserFrame(framePath);

        // Socket'e hemen gönder
        if (socket && socket.connected) {
          const username = getCurrentUsername();
          if (username) {
            socket.emit("frame:update", {
              room: activeRoomId || roomDisplayName,
              username,
              frame: frameKey,
            });
          }
        }
      }
    };

    const handleIconChange = (event: Event) => {
      const detail = (
        event as CustomEvent<{ path: string | null; key: string | null }>
      ).detail;
      if (detail !== undefined) {
        const iconPath = detail.path || null;
        const iconKey = detail.key || null;

        profileIconRef.current = iconKey;
        updateCurrentUserIcon(iconPath);

        // Socket'e hemen gönder
        if (socket && socket.connected) {
          const username = getCurrentUsername();
          if (username) {
            socket.emit("icon:update", {
              room: activeRoomId || roomDisplayName,
              username,
              icon: iconKey,
            });
          }
        }
      }
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "chatBackground") {
        if (e.newValue) {
          setChatBackground(e.newValue);
        } else {
          setChatBackground(
            resolveEffectiveChatBackground(roomDetailRef.current, {
              includeFallback: true,
            }),
          );
        }
      } else if (e.key === "chatFontSize") {
        setChatFontSize(e.newValue || "16px");
      } else if (e.key === "chatFontColor") {
        setChatFontColor(e.newValue || null);
      }
    };

    window.addEventListener(
      "chatBackgroundChanged",
      handleBackgroundChange as EventListener,
    );
    window.addEventListener(
      "chatFontSizeChanged",
      handleFontChange as EventListener,
    );
    window.addEventListener(
      "chatFontColorChanged",
      handleFontColorChange as EventListener,
    );
    window.addEventListener(
      "profileFrameChanged",
      handleFrameChange as EventListener,
    );
    window.addEventListener(
      "profileIconChanged",
      handleIconChange as EventListener,
    );
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(
        "chatBackgroundChanged",
        handleBackgroundChange as EventListener,
      );
      window.removeEventListener(
        "chatFontSizeChanged",
        handleFontChange as EventListener,
      );
      window.removeEventListener(
        "chatFontColorChanged",
        handleFontColorChange as EventListener,
      );
      window.removeEventListener(
        "profileFrameChanged",
        handleFrameChange as EventListener,
      );
      window.removeEventListener(
        "profileIconChanged",
        handleIconChange as EventListener,
      );
      window.removeEventListener("storage", handleStorage);
    };
  }, [
    socket,
    activeRoomId,
    roomDisplayName,
    getCurrentUsername,
    resolveEffectiveChatBackground,
    updateCurrentUserFrame,
    updateCurrentUserIcon,
  ]);

  useEffect(() => {
    hasLeftRoomRef.current = false;

    // 1. Socket bağlantısı kur
    let activeRoom = roomDisplayName;
    const socketUrl =
      process.env.NEXT_PUBLIC_SOCKET_URL || "https://king.akdenizbirlik.com";
    const socketInstance: Socket = io(socketUrl, {
      transports: ["websocket", "polling"], // WebSocket öncelikli, fallback olarak polling (Windows uyumluluğu için)
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10,
      timeout: 60000, // 60 saniye timeout (büyük dosyalar için)
      // Prevent disconnection during large uploads
      forceNew: false,
      // Allow larger payloads on client side
      // @ts-expect-error - socket.io client option
      maxPayload: 30 * 1024 * 1024, // 30MB
    });
    const connectTimeoutId = window.setTimeout(() => {
      socketInstance.connect();
    }, 0);

    setSocket(socketInstance);

    const isCurrentRoomEvent = (room?: string | null) => {
      const normalizedRoom = normalizeUserKey(room);
      if (!normalizedRoom) return false;

      return [activeRoom, activeRoomId, roomId, roomDisplayName].some(
        (candidate) => normalizeUserKey(candidate) === normalizedRoom,
      );
    };

    const findCurrentRoomUser = (username?: string | null) => {
      const normalizedUsername = normalizeUserKey(username);
      if (!normalizedUsername) return null;

      return (
        roomUsersRef.current.find(
          (user) => normalizeUserKey(user.username) === normalizedUsername,
        ) ?? null
      );
    };

    const upsertRoomUserFromJoinEffectEvent = (
      data: JoinEffectEventPayload,
    ) => {
      if (!isCurrentRoomEvent(data.room)) {
        return;
      }

      const normalizedUsername = normalizeUserKey(data.username);
      if (!normalizedUsername) {
        return;
      }

      if (data.statusModeName === "Çatıda") {
        return;
      }

      armRoomUserPresenceGrace(data.username);

      const nextIcon = calculateAvatar(data.icon);
      const nextJoinEffect =
        typeof data.joinEffect === "string" && isJoinEffectId(data.joinEffect)
          ? (data.joinEffect as JoinEffectId)
          : null;

      setRoomUsers((prevUsers) => {
        const existingIndex = prevUsers.findIndex(
          (user) => normalizeUserKey(user.username) === normalizedUsername,
        );

        if (existingIndex >= 0) {
          return prevUsers.map((user, index) =>
            index !== existingIndex
              ? user
              : {
                  ...user,
                  loginHistoryId:
                    data.loginHistoryId ?? user.loginHistoryId ?? null,
                  displayUsername:
                    data.displayUsername ?? user.displayUsername ?? user.username,
                  gender: data.gender ?? user.gender,
                  isGuest: data.isGuest ?? user.isGuest ?? false,
                  statusModeId: data.statusModeId ?? user.statusModeId ?? null,
                  statusModeName:
                    data.statusModeName ?? user.statusModeName ?? null,
                  icon: nextIcon ?? user.icon ?? null,
                  roleIcon: data.roleIcon ?? user.roleIcon ?? null,
                  roleStarColor:
                    data.roleStarColor ?? user.roleStarColor ?? null,
                  roleStarCount:
                    data.roleStarCount ?? user.roleStarCount ?? null,
                  roleName:
                    data.roleName ??
                    data.role_title ??
                    user.roleName ??
                    user.role_title ??
                    null,
                  role_title:
                    data.role_title ??
                    data.roleName ??
                    user.role_title ??
                    user.roleName ??
                    null,
                  role_data: data.role_data ?? user.role_data ?? null,
                  agentNickname:
                    data.agentNickname ?? user.agentNickname ?? null,
                  deviceType: data.deviceType ?? user.deviceType ?? null,
                  device: data.device ?? user.device ?? null,
                  clientType: data.clientType ?? user.clientType ?? null,
                  joinEffect: nextJoinEffect ?? user.joinEffect ?? null,
                },
          );
        }

        const provisionalUser: RoomUser = {
          id: `presence:${normalizedUsername}:${data.loginHistoryId ?? Date.now()}`,
          username: data.username,
          loginHistoryId: data.loginHistoryId ?? null,
          displayUsername: data.displayUsername ?? data.username,
          gender: data.gender ?? "male",
          isGuest: data.isGuest ?? false,
          statusModeId: data.statusModeId ?? null,
          statusModeName: data.statusModeName ?? null,
          isInVoiceChat: false,
          isMuted: false,
          isCameraOn: false,
          frame: null,
          icon: nextIcon,
          deviceType: data.deviceType ?? null,
          device: data.device ?? null,
          clientType: data.clientType ?? null,
          isHandRaised: false,
          handRaisedAt: null,
          agentNickname: data.agentNickname ?? null,
          roleName: data.roleName ?? data.role_title ?? null,
          role_title: data.role_title ?? data.roleName ?? null,
          role: null,
          role_data: data.role_data ?? null,
          roleIcon: data.roleIcon ?? null,
          roleStarColor: data.roleStarColor ?? null,
          roleStarCount: data.roleStarCount ?? null,
          joinEffect: nextJoinEffect,
          micBanned: false,
          micBannedByStarCount: null,
          cameraBanned: false,
          cameraBannedByStarCount: null,
          roomMuted: false,
          roomMutedByStarCount: null,
          globalMuted: false,
          globalMutedByStarCount: null,
        };

        return [...prevUsers, provisionalUser];
      });
    };

    const scheduleRoofExitJoinEffectRecovery = (username?: string | null) => {
      const normalizedUsername = normalizeUserKey(username);
      if (!normalizedUsername) return;

      const existingTimer =
        pendingRoofExitJoinEffectTimersRef.current[normalizedUsername];
      if (existingTimer) {
        window.clearTimeout(existingTimer);
      }

      pendingRoofExitJoinEffectTimersRef.current[normalizedUsername] =
        window.setTimeout(() => {
          delete pendingRoofExitJoinEffectTimersRef.current[normalizedUsername];

          const syncedUser = findCurrentRoomUser(username);
          if (
            !syncedUser ||
            syncedUser.isGuest ||
            syncedUser.agentNickname ||
            syncedUser.statusModeName === "Çatıda" ||
            !syncedUser.joinEffect ||
            !isJoinEffectId(syncedUser.joinEffect)
          ) {
            return;
          }

          triggerRemoteJoinEffect({
            key: `${normalizedUsername}:${syncedUser.joinEffect}:roof-exit-recovery:${Date.now()}`,
            username: syncedUser.username,
            loginHistoryId: syncedUser.loginHistoryId ?? null,
            joinEffect: syncedUser.joinEffect,
            source: "room",
            icon: syncedUser.icon ?? null,
            roleIcon: syncedUser.roleIcon ?? null,
            roleStarColor: syncedUser.roleStarColor ?? null,
            roleStarCount: syncedUser.roleStarCount ?? null,
            agentNickname: syncedUser.agentNickname ?? null,
          });
        }, 150);
    };

    const startSystemResetCountdown = (data?: {
      countdownSeconds?: number;
      remainingDurationMs?: number;
      message?: string;
    }) => {
      if (systemResetActiveRef.current) return;

      const countdownSeconds = Number(data?.countdownSeconds ?? 10);
      const safeCountdown =
        Number.isFinite(countdownSeconds) && countdownSeconds > 0
          ? Math.floor(countdownSeconds)
          : 10;

      systemResetActiveRef.current = true;
      setSystemResetMessage(
        String(data?.message || "").trim() || "Sistem resetleniyor",
      );
      setSystemResetCountdown(safeCountdown);
      setMessages(buildCurrentRoomDescriptionMessages());
      localStorage.removeItem(`chat-history-${roomDisplayName}`);

      if (systemResetIntervalRef.current !== null) {
        window.clearInterval(systemResetIntervalRef.current);
      }

      const resetSoundDurationMs = 30_000;
      const remainingDurationMs = Number(data?.remainingDurationMs ?? 30_000);
      const safeRemainingDurationMs =
        Number.isFinite(remainingDurationMs) && remainingDurationMs > 0
          ? remainingDurationMs
          : 30_000;
      const audioStartOffsetMs = Math.max(
        0,
        resetSoundDurationMs - safeRemainingDurationMs,
      );
      playSystemResetSound(audioStartOffsetMs);

      const countdownStepMs = Math.ceil(
        safeRemainingDurationMs / safeCountdown,
      );
      const resetDeadlineAt = Date.now() + safeRemainingDurationMs;
      systemResetDeadlineAtRef.current = resetDeadlineAt;

      const finishSystemReset = () => {
        if (systemResetIntervalRef.current !== null) {
          window.clearInterval(systemResetIntervalRef.current);
          systemResetIntervalRef.current = null;
        }
        systemResetDeadlineAtRef.current = null;
        if (systemResetAudioRef.current) {
          systemResetAudioRef.current.pause();
          systemResetAudioRef.current.currentTime = 0;
          systemResetAudioRef.current = null;
        }
        setSystemResetCountdown(0);
        clearAuthSession();
        emitLeaveOnce(socketInstance, activeRoom, getCurrentUsername());
        socketInstance.disconnect();
        window.location.href = "/";
      };

      systemResetIntervalRef.current = window.setInterval(() => {
        const deadlineAt = systemResetDeadlineAtRef.current ?? resetDeadlineAt;
        const remainingMs = deadlineAt - Date.now();
        if (remainingMs <= 0) {
          finishSystemReset();
          return;
        }

        setSystemResetCountdown(
          Math.max(1, Math.min(safeCountdown, Math.ceil(remainingMs / countdownStepMs))),
        );
      }, 250);
    };

    const checkActiveSystemReset = async () => {
      if (systemResetActiveRef.current) return;

      try {
        const status = await apiClient.systemSettings.getSystemResetStatus();
        if (!status.active) return;

        startSystemResetCountdown({
          countdownSeconds: status.countdownSeconds,
          remainingDurationMs: status.remainingDurationMs,
          message: status.message,
        });
      } catch {
        // Socket events remain the primary reset path; HTTP status is a fallback.
      }
    };

    const handleAdminSystemResetStarted = (event: Event) => {
      const detail = (event as CustomEvent<SystemResetStartData>).detail;
      startSystemResetCountdown({
        countdownSeconds: detail?.countdownSeconds,
        remainingDurationMs: detail?.remainingDurationMs,
        message: detail?.message || "Sistem resetleniyor",
      });
    };

    const handleSystemResetVisibilityCheck = () => {
      if (document.visibilityState === "visible") {
        void checkActiveSystemReset();
      }
    };

    window.addEventListener(
      "kingmobile:system-reset-started",
      handleAdminSystemResetStarted,
    );
    document.addEventListener(
      "visibilitychange",
      handleSystemResetVisibilityCheck,
    );
    void checkActiveSystemReset();

    // 2. Bağlantı olaylarını dinle
    socketInstance.on("connect", () => {
      // Bağlantı kurulur kurulmaz odaya katıl
      // StrictMode yarışlarını aynı tick dışına al, fakat mobil join görünürlüğünü bekletme.
      setTimeout(() => {
        if (!socketInstance.connected) return;

        (async () => {
          const isGuest = localStorage.getItem("isGuest") === "true";
          const username = isGuest
            ? localStorage.getItem("guestUsername")
            : localStorage.getItem("username");
          let resolvedRoomDetail: Room | null = null;

          if (!username) {
            console.error("❌ Username is missing!");
            setJoinError("Kullanıcı bilgisi bulunamadı.");
            return;
          }

          try {
            let roomCheck = await withJoinFastFallback(
              apiClient.rooms.checkRoomExists(roomDisplayName),
              1500,
            );
            // Mobil URL slug'ında tire/boşluk dönüşümü gerçek oda adını bozabiliyor.
            // İlk eşleşme bulunamazsa URL'deki decode edilmiş adı da dene.
            if (roomCheck && roomCheck.exists === false && decodedSlug && decodedSlug !== roomDisplayName) {
              roomCheck = await withJoinFastFallback(
                apiClient.rooms.checkRoomExists(decodedSlug),
                1500,
              );
            }
            const exists = roomCheck?.exists ?? true;
            const voiceRoomId = roomCheck?.voiceId || roomDisplayName;

            if (!exists) {
              // Socket join yine de canonical oda anahtarını çözebilsin; erken yönlendirme yapma.
              console.warn("Oda HTTP kontrolünde bulunamadı, socket çözümlemesi deneniyor:", roomDisplayName);
            }
            activeRoom = voiceRoomId;
            setRoomId(voiceRoomId);
            setActiveRoomId(voiceRoomId);

            if (!roomCheck) {
              console.warn(
                "Oda kontrolü hızlı giriş süresini aştı; socket girişi oda adıyla devam ediyor.",
              );
            }

            // Oda detaylarını al; mobilde presence/joinRoom bunu beklemesin diye listeyi hızlıca kontrol ediyoruz.
            try {
              const rooms = await apiClient.rooms.getRooms();
              const target = rooms.find((room) => {
                const roomNameMatch =
                  room.name?.toLowerCase() === roomDisplayName.toLowerCase();
                const voiceMatch =
                  (room.voiceId &&
                    voiceRoomId &&
                    String(room.voiceId) === String(voiceRoomId));
                return roomNameMatch || voiceMatch;
              });

              if (target) {
                resolvedRoomDetail = target;
                setRoomDetail(target);

                // URL slug/oda adı farklılaşsa bile socket'e backend'in gerçek oda adını gönder.
                const canonicalRoomName =
                  typeof target.name === "string" && target.name.trim()
                    ? target.name.trim()
                    : roomDisplayName;
                const canonicalVoiceRoomId =
                  target.voiceId != null && String(target.voiceId).trim()
                    ? String(target.voiceId).trim()
                    : canonicalRoomName;
                activeRoom = canonicalVoiceRoomId;
                setRoomId(canonicalVoiceRoomId);
                setActiveRoomId(canonicalVoiceRoomId);
                
                // Oda detaylarını (açıklama vb.) arkada al; bu daha yavaş olabilir.
                void (async () => {
                  try {
                    const detail = await apiClient.rooms.getRoom(target.id);
                    setRoomDetail(detail);

                    // Oda açıklamasını sistem mesajı olarak göster
                    const roomDescription = detail?.description;
                    if (roomDescription) {
                      addSystemMessage(
                        `${roomDescription}`,
                        activeRoom,
                        false,
                        false,
                        true, // isRoomDescription flag
                      );
                    }
                  } catch (detailError) {
                    console.error("Oda detayları (arkada) alınamadı:", detailError);
                  }
                })();
              }
            } catch (roomsError) {
              console.error("Odalar listesi alınamadı:", roomsError);
              setChatBackground(
                resolveEffectiveChatBackground(null, { includeFallback: true }),
              );
            }
          } catch (error) {
            if (isTimeoutError(error)) {
              console.warn(
                "Oda kontrolü zaman aşımına uğradı; socket girişi oda adıyla devam ediyor:",
                error,
              );
              activeRoom = roomDisplayName;
              setRoomId(roomDisplayName);
              setActiveRoomId(roomDisplayName);
            } else {
            console.error("Oda kontrolü sırasında hata:", error);
            setJoinError("Oda doğrulanamadı");
            return;
            }
          }

          try {
            const accessCheck = await withJoinFastFallback(
              apiClient.rooms.checkRoomAccess({
                roomId: resolvedRoomDetail?.id
                  ? String(resolvedRoomDetail.id)
                  : undefined,
                room: activeRoom,
                roomName: roomDisplayName,
              }),
              1200,
            );

            if (!accessCheck) {
              console.warn(
                "Oda erişim kontrolü hızlı giriş süresini aştı; mobil giriş gecikmesin diye bağlantı korunuyor.",
              );
            } else if (!accessCheck.allowed) {

              sessionStorage.setItem(
                PENDING_ROOM_ACCESS_DENIED_TOAST_KEY,
                JSON.stringify({
                  fromRoom: accessCheck.roomName || roomDisplayName,
                  targetSlug: accessCheck.redirectRoomSlug || "lobby",
                  createdAt: Date.now(),
                } satisfies PendingRoomAccessDeniedToastPayload),
              );
              socketInstance.disconnect();
              router.replace(`/chat/${accessCheck.redirectRoomSlug || "lobby"}`);
              return;
            }
          } catch (error) {
            if (isTimeoutError(error)) {
              console.warn(
                "Oda erişim kontrolü zaman aşımına uğradı, mevcut oda bağlantısı korunuyor:",
                error,
              );
            } else {
              console.error("Oda erişim kontrolü sırasında hata:", error);
              setJoinError("Oda erişimi doğrulanamadı");
              socketInstance.disconnect();
              router.replace("/chat/lobby");
              return;
            }
          }
          // Font, granite, nickColor, userGif ve micBanned bilgilerini al (üye ise /me endpoint'inden)
          let fontName: string | null = null;
          let granite: string | null = null;
          let nickColor: string | null = null;
          let userGif: string | null = null;
          let flashNick: string | null = null;
          let joinEffect: JoinEffectId | null = null;
          let micBannedFromMe = false;
          let cameraBannedFromMe = false;
          let globalMutedFromMe = false;
          let rejectIncomingCallsFromMe = false;
          let rejectRoomInvitesFromMe = false;
          let meData: {
            frame?: string | null;
            icon?: string | null;
            fontName?: string | null;
            granite?: string | null;
            nickColor?: string | null;
            userGif?: string | null;
            flashNick?: string | null;
            permissions?: string[] | null;
            joinEffect?: string | null;
            micBanned?: boolean;
            cameraBanned?: boolean;
            globalMuted?: boolean;
            chatPreferences?: {
              rejectIncomingCalls?: boolean;
              rejectRoomInvites?: boolean;
            } | null;
            role?: {
              name?: string | null;
              starCount?: number | null;
              starColor?: string | null;
              icon?: string | null;
              permissions?: Record<string, unknown> | null;
            } | null;
          } | null = null;
          const roomNavigation = getRoomNavigationIntent({ consume: false });
          const isRoomNavigation = roomNavigation.isRoomChange;
          logJoinEffectClientDebug("joinRoom:navigation-intent", {
            roomDisplayName,
            source: roomNavigation.source ?? null,
            isRoomNavigation,
          });
          const shouldAutoRoofOnInitialEntry =
            !isGuest &&
            !isRoomNavigation &&
            !hasAppliedInitialRoofModeRef.current;
          setIsInitialRoofResolving(shouldAutoRoofOnInitialEntry);

          if (!isGuest) {
            try {
              const apiClientInstance = getClientApiClient();
              const meRequest = apiClientInstance.get("/auth/me", {
                params: { _ts: Date.now() },
              });
              const meRes = await withJoinFastFallback(
                meRequest,
                1200,
              );
              if (!meRes) {
                console.warn(
                  "Me endpoint hızlı giriş süresini aştı; kullanıcı odaya mevcut local bilgilerle alınacak.",
                );
                void meRequest
                  .then((lateMeRes) => {
                    const lateMeData = lateMeRes?.data;
                    if (!lateMeData || !shouldAutoRoofOnInitialEntry) return;
                    const latestRoofStatus = localStorage.getItem("roofStatus");
                    const normalizedLateUsername = normalizeUserKey(username);
                    const currentSelfUser = roomUsersRef.current.find(
                      (user) =>
                        normalizeUserKey(user.username) === normalizedLateUsername,
                    );
                    if (
                      (isRoomNavigation && latestRoofStatus === "false") ||
                      currentSelfUser?.isInVoiceSeat === true ||
                      currentSelfUser?.isInVoiceChat === true
                    ) {
                      return;
                    }
                    const lateStarCount = Number(lateMeData?.role?.starCount ?? 0);
                    const lateCanUseRoof =
                      lateStarCount >= 1 &&
                      hasEffectivePermission({
                        permissionLabel: PERMISSION_LABELS.ROOF_ACCESS,
                        userPermissions:
                          (lateMeData?.permissions as string[] | undefined) ?? [],
                        rolePermissions:
                          (lateMeData?.role?.permissions as
                            | Record<string, unknown>
                            | null) ?? null,
                      });
                    if (!lateCanUseRoof) return;

                    setUserStarCount(lateStarCount);
                    setCurrentUserPermissions(lateMeData?.permissions || []);
                    setCurrentRolePermissions(
                      (lateMeData?.role?.permissions as
                        | Record<string, unknown>
                        | null) ?? null,
                    );
                    setIsOnRoof(true);
                    localStorage.setItem("roofStatus", "true");
                    localStorage.setItem("statusModeName", "Çatıda");
                    const lateJoinEffect = isJoinEffectId(lateMeData?.joinEffect)
                      ? (lateMeData.joinEffect as JoinEffectId)
                      : undefined;
                    socketInstance.emit("statusMode:update", {
                      room: activeRoom,
                      username,
                      statusModeName: "Çatıda",
                      joinEffect: lateJoinEffect,
                    });
                  })
                  .catch((lateError) => {
                    if (isTimeoutError(lateError)) {
                      console.warn("Geç auth/me çatı kontrolü zaman aşımı:", lateError);
                    } else {
                      console.error("Geç auth/me çatı kontrolü alınamadı:", lateError);
                    }
                  })
                  .finally(() => {
                    setIsInitialRoofResolving(false);
                  });
              }
              meData = meRes?.data ?? null;
              if (meData) {
                const apiFrameKey = meData.frame ?? null;
                const apiFramePath = resolveFrameUrl(apiFrameKey);
                const apiIconKey = meData.icon ?? null;
                const apiIconPath = calculateAvatar(apiIconKey);
                profileFrameRef.current = apiFrameKey;
                profileIconRef.current = apiIconKey;
                setCurrentUserIcon(apiIconPath);
                if (apiFramePath) {
                  localStorage.setItem("profileFrame", apiFramePath);
                } else {
                  localStorage.removeItem("profileFrame");
                }
                if (apiIconPath) {
                  localStorage.setItem("profileIcon", apiIconPath);
                  localStorage.setItem("profileIconOwner", username);
                } else {
                  localStorage.removeItem("profileIcon");
                  localStorage.removeItem("profileIconOwner");
                }
                fontName = meData.fontName || null;
                granite = meData.granite || null;
                nickColor = meData.nickColor || null;
                userGif = meData.userGif || null;
                flashNick = meData.flashNick || null;
                if (isJoinEffectId(meData.joinEffect)) {
                  joinEffect = meData.joinEffect as JoinEffectId;
                  localStorage.setItem("profileJoinEffect", joinEffect);
                } else {
                  joinEffect = null;
                  localStorage.removeItem("profileJoinEffect");
                }
                micBannedFromMe = meData.micBanned || false;
                cameraBannedFromMe = meData.cameraBanned || false;
                globalMutedFromMe = meData.globalMuted || false;
                rejectIncomingCallsFromMe =
                  meData.chatPreferences?.rejectIncomingCalls === true;
                rejectRoomInvitesFromMe =
                  meData.chatPreferences?.rejectRoomInvites === true;
              }
            } catch (error) {
              if (isTimeoutError(error)) {
                console.warn(
                  "Font/granite/nickColor/userGif bilgileri zaman aşımına uğradı:",
                  error,
                );
              } else {
                console.error(
                  "Font/granite/nickColor/userGif bilgileri alınamadı:",
                  error,
                );
              }
            }
          }

          // Çatı erişimini kontrol et: sadece 1 yıldız ve üzeri üyeler otomatik/manüel çatıya çıkabilir.
          let statusModeName = "Çevrimiçi";
          if (!isGuest) {
            if (shouldAutoRoofOnInitialEntry && !meData) {
              statusModeName = "Çatıda";
              setIsOnRoof(true);
              localStorage.setItem("roofStatus", "true");
              localStorage.setItem("statusModeName", "Çatıda");
              hasAppliedInitialRoofModeRef.current = true;
            } else {
            const memberStarCount = Number(
              meData?.role?.starCount ??
                userRoleStarCountRef.current ??
                userStarCount ??
                0,
            );
            const hasRoofPermission = hasEffectivePermission({
              permissionLabel: PERMISSION_LABELS.ROOF_ACCESS,
              userPermissions:
                (meData?.permissions as string[] | undefined) ??
                currentUserPermissions,
              rolePermissions:
                (meData?.role?.permissions as Record<string, unknown> | null) ??
                currentRolePermissions,
            });
            const canUseRoof = memberStarCount >= 1 && hasRoofPermission;

            if (canUseRoof) {
              const storedRoofStatus = localStorage.getItem("roofStatus");
              // Sayfa yenilendiğinde üyeyi otomatik çatıya al.
              // Oda değiştirirken (navigasyon) kullanıcının mevcut durumunu koru.
              if (
                isRoomNavigation ||
                hasAppliedInitialRoofModeRef.current
              ) {
                if (storedRoofStatus === "true") {
                  statusModeName = "Çatıda";
                  setIsOnRoof(true);
                } else {
                  statusModeName = "Çevrimiçi";
                  setIsOnRoof(false);
                }
              } else {
                statusModeName = "Çatıda";
                setIsOnRoof(true);
                localStorage.setItem("roofStatus", "true");
                toast.success("Girişte otomatik çatıya alındınız.");
              }
              hasAppliedInitialRoofModeRef.current = true;
            } else {
              statusModeName = "Çevrimiçi";
              setIsOnRoof(false);
              localStorage.setItem("roofStatus", "false");
              localStorage.setItem("statusModeName", "Çevrimiçi");
            }
            if (meData) {
              setIsInitialRoofResolving(false);
            }
            }
          } else {
            const guestStatus = getGuestStatusFromStorage();
            statusModeName = guestStatus || "Çevrimiçi";
            setIsInitialRoofResolving(false);
          }

          // Agent nickname'ı localStorage'dan al
          const agentNickname = localStorage.getItem("agentNickname") || null;

          if (isGuest) {
            joinEffect = null;
          } else if (!joinEffect) {
            const cachedJoinEffect = localStorage.getItem("profileJoinEffect");
            if (isJoinEffectId(cachedJoinEffect)) {
              joinEffect = cachedJoinEffect as JoinEffectId;
            }
          }

          const resolvedMemberRoleName =
            typeof meData?.role?.name === "string"
              ? meData.role.name.trim() || undefined
              : undefined;
          const resolvedMemberRoleIcon =
            typeof meData?.role?.icon === "string"
              ? meData.role.icon.trim() || null
              : null;
          const resolvedMemberRoleStarColor =
            typeof meData?.role?.starColor === "string"
              ? meData.role.starColor || undefined
              : undefined;
          const resolvedMemberRoleStarCount = Number.isFinite(
            meData?.role?.starCount,
          )
            ? Number(meData?.role?.starCount)
            : undefined;
          const resolvedRoleName = isGuest
            ? userRoleNameRef.current || userRoleName || undefined
            : resolvedMemberRoleName ??
              userRoleNameRef.current ??
              userRoleName ??
              undefined;
          const resolvedRoleIcon = isGuest
            ? userRoleIconRef.current || null
            : resolvedMemberRoleIcon ?? userRoleIconRef.current ?? null;
          const resolvedRoleStarColor = isGuest
            ? userRoleStarColorRef.current || undefined
            : resolvedMemberRoleStarColor ??
              userRoleStarColorRef.current ??
              undefined;
          const resolvedRoleStarCount = isGuest
            ? (userRoleStarCountRef.current ?? undefined)
            : resolvedMemberRoleStarCount ??
              (userRoleStarCountRef.current ?? undefined);

          const isAgentSession = Boolean(agentNickname);
          const currentDeviceType = resolveCurrentDeviceType();
          const payload = {
            room: activeRoom,
            roomId: resolvedRoomDetail?.id
              ? String(resolvedRoomDetail.id)
              : undefined,
            roomName:
              resolvedRoomDetail?.name?.trim() || roomDisplayName,
            username,
            loginHistoryId:
              Number(localStorage.getItem("loginHistoryId")) || undefined,
            guest: isGuest,
            gender: isGuest
              ? localStorage.getItem("guestGender") || "male"
              : userGenderRef.current || userGender || "male",
            statusModeName,
            tenantId: env.tenantId
              ? `tenant_${env.tenantId}`
              : "tenant_master",
            frame: profileFrameRef.current || null,
            icon: profileIconRef.current || null,
            roleName: resolvedRoleName,
            roleIcon: resolvedRoleIcon,
            roleStarColor: resolvedRoleStarColor,
            roleStarCount: resolvedRoleStarCount,
            agentNickname,
            fontName: fontName,
            granite: granite,
            nickColor: nickColor,
            userGif: userGif,
            flashNick: flashNick,
            joinEffect: joinEffect,
            micBanned: micBannedFromMe,
            cameraBanned: cameraBannedFromMe,
            globalMuted: globalMutedFromMe,
            rejectIncomingCalls: rejectIncomingCallsFromMe,
            rejectRoomInvites: rejectRoomInvitesFromMe,
            deviceType: currentDeviceType,
            device: currentDeviceType,
            clientType: currentDeviceType,
            isTeleport: isRoomNavigation,
          };

          logJoinEffectClientDebug("joinRoom:emit", {
            room: payload.room,
            roomName: payload.roomName,
            username: payload.username,
            joinEffect: payload.joinEffect,
            statusModeName: payload.statusModeName,
            isTeleport: payload.isTeleport,
          });

          socketInstance.emit("joinRoom", payload, (response: JoinRoomAck | null | undefined) => {
            try {
              // Acknowledgment callback - backend'den dönen yanıt
              if (!response) {
                console.error("❌ Response is null or undefined");
                setJoinError("Sunucudan yanıt alınamadı.");
                // Redirect logic...
                setTimeout(() => {
                  localStorage.removeItem("isGuest");
                  localStorage.removeItem("guestUsername");
                  localStorage.removeItem("guestGender");
                  localStorage.removeItem("guestStatusModeId");
                  localStorage.removeItem("guestStatusModeName");
                  localStorage.removeItem("guestStatusModeExpiresAt");
                  localStorage.removeItem("accessToken");
                  localStorage.removeItem("loginHistoryId");
                  window.location.href = "/";
                }, 3000);
                return;
              }

              if (!response.success && response.status !== "ok") {
                if (response.message === "reset_in_progress") {
                  startSystemResetCountdown({
                    countdownSeconds: response.countdownSeconds,
                    remainingDurationMs: response.remainingDurationMs,
                    message: response.detail || "Sistem resetleniyor",
                  });
                  return;
                }

                const errorMessage = getJoinRoomErrorMessage(response);
                console.error("Odaya katılma hatası (ACK):", response?.message);
                setJoinError(errorMessage);

                // Always redirect on error after 3 seconds
                setTimeout(() => {
                  localStorage.removeItem("isGuest");
                  localStorage.removeItem("guestUsername");
                  localStorage.removeItem("guestGender");
                  localStorage.removeItem("guestStatusModeId");
                  localStorage.removeItem("guestStatusModeName");
                  localStorage.removeItem("guestStatusModeExpiresAt");
                  localStorage.removeItem("accessToken");
                  localStorage.removeItem("loginHistoryId");
                  window.location.href = "/";
              }, 3000);
              } else {
                clearRoomNavigationIntent();
                setJoinError(null);
                const acknowledgedRoom =
                  typeof response.room === "string" && response.room.trim()
                    ? response.room.trim()
                    : activeRoom;

                activeRoom = acknowledgedRoom;
                setRoomId(acknowledgedRoom);
                setActiveRoomId(acknowledgedRoom);
                setRoomJoinRevision((revision) => revision + 1);
                requestRoomUsersSnapshotBurst(socketInstance, acknowledgedRoom);

                window.dispatchEvent(
                  new CustomEvent<RoomSocketJoinedEventDetail>(
                    ROOM_SOCKET_JOINED_EVENT,
                    {
                      detail: { room: acknowledgedRoom },
                    },
                  ),
                );

                // Oda açıklamasını sistem mesajı olarak göster
                const roomDescription = roomDetail?.description;
                if (roomDescription) {
                  addSystemMessage(
                    `${roomDescription}`,
                    roomId || activeRoomId || roomDisplayName,
                    false,
                    false,
                    true, // isRoomDescription flag
                  );
                }
              }
            } catch (ackError) {
              console.error("joinRoom ACK işlenirken hata oluştu:", ackError);
            }
          });
        })();
      }, 0);
    });

    socketInstance.on("disconnect", (reason) => {
      const logDisconnect =
        reason === "ping timeout" ? console.warn : console.error;

      logDisconnect("🔴 Socket bağlantısı kesildi!");
      logDisconnect("Sebep:", reason);
      logDisconnect("Detaylar:", {
        wasConnected: socketInstance.connected,
        transport: socketInstance.io?.engine?.transport?.name,
        readyState: socketInstance.io?.engine?.readyState,
      });

      // "transport close" veya "transport error" ise büyük payload sorunu olabilir
      if (reason === "transport close" || reason === "transport error") {
        console.error(
          "⚠️ Transport hatası - büyük veri gönderimi sırasında bağlantı kopmuş olabilir",
        );
      }
    });

    socketInstance.on("connect_error", (error) => {
      console.error("Socket bağlantı hatası:", error.message);
      console.error("Bağlantı detayları:", {
        socketUrl,
        transport: socketInstance.io.engine?.transport?.name,
        readyState: socketInstance.io.engine?.readyState,
      });
    });

    socketInstance.on("connect_timeout", () => {
      console.error("Socket bağlantı zaman aşımı");
    });

    socketInstance.on("system:accessRevoked", (data?: { reason?: string }) => {
      const reason = String(data?.reason || "").trim();
      const message =
        reason === "guest_entries_disabled"
          ? "Misafir girişleri kapatıldı."
          : reason === "desktop_entries_disabled"
            ? "Masaüstü girişleri kapatıldı."
            : reason === "mobile_entries_disabled"
              ? "Mobil girişleri kapatıldı."
              : "Site girişleri kapatıldı.";

      setJoinError(message);
      toast.error(message);
      clearAuthSession();
      socketInstance.disconnect();
      window.location.href = "/";
    });

    socketInstance.on("reconnect_attempt", () => undefined);

    socketInstance.on("reconnect_failed", () => {
      console.error("Yeniden bağlanma başarısız oldu");
      setJoinError(
        "Sunucuya bağlanılamıyor. Lütfen internet bağlantınızı kontrol edin.",
      );
    });

    // 3. Oda kullanıcı listesini dinle ve kullanıcı değişikliklerini tespit et
    socketInstance.on(
      "room:users",
      (data: { room: string; users: RoomUser[] }) => {
        setRoomUsers((prevUsers) => {
          let newUsers: RoomUser[] = (data.users || []).map((u) => {
            const incomingUserKey = normalizeUserKey(u.username);
            const prev =
              prevUsers.find((p) => p.id === u.id) ??
              prevUsers.find(
                (p) =>
                  incomingUserKey &&
                  normalizeUserKey(p.username) === incomingUserKey,
              );
            const rawFrame = u.frame;
            const rawIcon = u.icon;
            const hasFrame = Object.prototype.hasOwnProperty.call(u, "frame");
            const hasIcon = Object.prototype.hasOwnProperty.call(u, "icon");
            const hasHand =
              Object.prototype.hasOwnProperty.call(u, "isHandRaised") ||
              Object.prototype.hasOwnProperty.call(u, "handRaised");
            const hasHandRaisedAt = Object.prototype.hasOwnProperty.call(
              u,
              "handRaisedAt",
            );
            const hasVoiceState = Object.prototype.hasOwnProperty.call(
              u,
              "isInVoiceChat",
            );
            const hasMuteState = Object.prototype.hasOwnProperty.call(
              u,
              "isMuted",
            );
            const hasVoiceSeatState = Object.prototype.hasOwnProperty.call(
              u,
              "isInVoiceSeat",
            );
            const hasVoiceSeatJoinedAt = Object.prototype.hasOwnProperty.call(
              u,
              "voiceSeatJoinedAt",
            );
            const hasVoiceSeatIndex = Object.prototype.hasOwnProperty.call(
              u,
              "voiceSeatIndex",
            );
            const hasCameraState = Object.prototype.hasOwnProperty.call(
              u,
              "isCameraOn",
            );
            const rawHand =
              u.isHandRaised ?? u.handRaised ?? null;
            const prevHandRaised = prev?.isHandRaised ?? false;
            const rawRole = u.role;
            const rawRoleIcon = u.roleIcon;
            const rawRoleStarColor = u.roleStarColor;
            const rawRoleStarCount = u.roleStarCount;
            const rawJoinEffect = u.joinEffect;
            const isBot = u.isBot === true || prev?.isBot === true;
            const cachedRole = getAuthoritativeRole(u.username);
            const hasRoleName =
              rawRole?.name !== undefined ||
              Object.prototype.hasOwnProperty.call(u, "roleName") ||
              Object.prototype.hasOwnProperty.call(u, "role_title");
            const hasRoleIcon =
              rawRole?.icon !== undefined ||
              Object.prototype.hasOwnProperty.call(u, "roleIcon");
            const hasRoleStarColor =
              rawRole?.starColor !== undefined ||
              Object.prototype.hasOwnProperty.call(u, "roleStarColor");
            const hasRoleStarCount =
              rawRole?.starCount !== undefined ||
              Object.prototype.hasOwnProperty.call(u, "roleStarCount");

            const frame = hasFrame
              ? rawFrame
                ? `/cerceveler/${rawFrame}.png`
                : null
              : (prev?.frame ?? null);
            const icon = hasIcon ? calculateAvatar(rawIcon) : (prev?.icon ?? null);
            const isHandRaised = hasHand
              ? Boolean(rawHand)
              : (prevHandRaised ?? false);
            const handRaisedAt =
              hasHandRaisedAt
                ? (u.handRaisedAt ?? null)
                : hasHand && isHandRaised && !prevHandRaised
                ? Date.now()
                : hasHand && !isHandRaised
                  ? null
                  : (prev?.handRaisedAt ?? null);

            const roleIconRaw =
              hasRoleIcon
                ? rawRole?.icon ?? rawRoleIcon ?? null
                : cachedRole?.roleIcon ?? prev?.roleIcon ?? null;
            const roleIcon =
              typeof roleIconRaw === "string"
                ? roleIconRaw.trim() || null
                : roleIconRaw;
            const roleStarColor =
              hasRoleStarColor
                ? rawRole?.starColor ?? rawRoleStarColor ?? null
                : cachedRole?.roleStarColor ?? prev?.roleStarColor ?? null;
            const roleStarCount =
              hasRoleStarCount
                ? rawRole?.starCount ?? rawRoleStarCount ?? null
                : cachedRole?.roleStarCount ?? prev?.roleStarCount ?? null;

            const roleName =
              hasRoleName
                ? u.role?.name ??
                  u.roleName ??
                  u.role_title ??
                  null
                : cachedRole?.roleName ?? prev?.roleName ?? null;

            return {
              ...u,
              isGuest:
                u.isGuest === true ||
                u.guest === true ||
                prev?.isGuest === true,
              displayUsername: u.displayUsername ?? prev?.displayUsername,
              guestAlias: u.guestAlias ?? prev?.guestAlias ?? null,
              guestAliasReleased:
                u.guestAliasReleased ?? prev?.guestAliasReleased ?? null,
              statusModeName:
                u.statusMode?.name ??
                u.statusModeName ??
                prev?.statusModeName ??
                null,
              statusModeId:
                u.statusMode?.id ??
                u.statusModeId ??
                prev?.statusModeId ??
                null,
              frame,
              icon,
              roleName,
              roleIcon,
              roleStarColor,
              roleStarCount,
              isInVoiceChat: hasVoiceState
                ? (u.isInVoiceChat ?? false)
                : (prev?.isInVoiceChat ?? false),
              isMuted: hasMuteState
                ? (u.isMuted ?? false)
                : (prev?.isMuted ?? false),
              isInVoiceSeat: hasVoiceSeatState
                ? (u.isInVoiceSeat ?? false)
                : (prev?.isInVoiceSeat ?? false),
              voiceSeatJoinedAt: hasVoiceSeatJoinedAt
                ? (u.voiceSeatJoinedAt ?? null)
                : (prev?.voiceSeatJoinedAt ?? null),
              voiceSeatIndex: hasVoiceSeatIndex
                ? (u.voiceSeatIndex ?? null)
                : (prev?.voiceSeatIndex ?? null),
              isHandRaised,
              isCameraOn: hasCameraState
                ? (u.isCameraOn ?? false)
                : (prev?.isCameraOn ?? false),
              handRaisedAt,
              role: rawRole ?? null,
              isBot,
              deviceType: u.deviceType ?? prev?.deviceType ?? null,
              device: u.device ?? prev?.device ?? null,
              clientType: u.clientType ?? prev?.clientType ?? null,
              agentNickname:
                isBot ? null : (u.agentNickname ?? prev?.agentNickname ?? null),
              fontName:
                !isBot && (u.agentNickname ?? prev?.agentNickname)
                  ? null
                  : (u.fontName ?? prev?.fontName ?? null),
              granite:
                !isBot && (u.agentNickname ?? prev?.agentNickname)
                  ? null
                  : (u.granite ?? prev?.granite ?? null),
              nickColor:
                !isBot && (u.agentNickname ?? prev?.agentNickname)
                  ? null
                  : (u.nickColor ?? prev?.nickColor ?? null),
              userGif:
                !isBot && (u.agentNickname ?? prev?.agentNickname)
                  ? null
                  : (u.userGif ?? prev?.userGif ?? null),
              flashNick:
                !isBot && (u.agentNickname ?? prev?.agentNickname)
                  ? null
                  : u.flashNick !== undefined
                    ? u.flashNick
                    : prev?.flashNick ?? null,
              joinEffect:
                !isBot && (u.agentNickname ?? prev?.agentNickname)
                  ? null
                  : isJoinEffectId(rawJoinEffect)
                    ? (rawJoinEffect as JoinEffectId)
                    : (prev?.joinEffect ?? null),
              micBanned: u.micBanned ?? prev?.micBanned ?? false,
              micBannedByStarCount:
                u.micBannedByStarCount ??
                prev?.micBannedByStarCount ??
                null,
              cameraBanned:
                u.cameraBanned ?? prev?.cameraBanned ?? false,
              cameraBannedByStarCount:
                u.cameraBannedByStarCount ??
                prev?.cameraBannedByStarCount ??
                null,
              roomMuted: u.roomMuted ?? prev?.roomMuted ?? false,
              roomMutedByStarCount:
                u.roomMutedByStarCount ??
                prev?.roomMutedByStarCount ??
                null,
              globalMuted:
                u.globalMuted ?? prev?.globalMuted ?? false,
              globalMutedByStarCount:
                u.globalMutedByStarCount ??
                prev?.globalMutedByStarCount ??
                null,
            };
          });

          const uniqueUsersByKey = new Map<string, RoomUser>();
          newUsers.forEach((user) => {
            const key = normalizeUserKey(user.username) || user.id;
            uniqueUsersByKey.set(key, user);
          });
          newUsers = Array.from(uniqueUsersByKey.values());

          const snapshotUserKeys = new Set(
            newUsers
              .map((user) => normalizeUserKey(user.username))
              .filter(Boolean),
          );
          latestRoomUsersSnapshotKeysRef.current = snapshotUserKeys;

          if (newUsers.length === 0 && prevUsers.length > 0) {
            return prevUsers;
          }

          const hasIncomingHumanUsers = newUsers.some((user) => !user.isBot);
          const previousHumanUsers = prevUsers.filter((user) => !user.isBot);
          if (!hasIncomingHumanUsers && previousHumanUsers.length > 0) {
            const incomingBotsByKey = new Map(
              newUsers
                .filter((user) => user.isBot)
                .map((user) => [normalizeUserKey(user.username) || user.id, user]),
            );
            const preservedBots = prevUsers.filter((user) => {
              if (!user.isBot) return false;
              const key = normalizeUserKey(user.username) || user.id;
              return !incomingBotsByKey.has(key);
            });

            newUsers = [
              ...previousHumanUsers,
              ...preservedBots,
              ...incomingBotsByKey.values(),
            ];
          }

          const preservedUsers = prevUsers.filter((prevUser) => {
            const key = normalizeUserKey(prevUser.username);
            return (
              key &&
              !snapshotUserKeys.has(key) &&
              hasRoomUserPresenceGrace(prevUser.username)
            );
          });

          if (preservedUsers.length > 0) {
            newUsers = [...newUsers, ...preservedUsers];
          }

          // İlk yüklemede (prevUsers boş) sistem mesajı ekleme
          if (prevUsers.length === 0) {
            return newUsers;
          }

          // Yeni eklenen kullanıcıları bul
          const addedUsers = newUsers.filter(
            (newUser) =>
              !prevUsers.some(
                (prevUser) =>
                  (normalizeUserKey(prevUser.username) ||
                    prevUser.id) ===
                  (normalizeUserKey(newUser.username) || newUser.id),
              ),
          );

          // Ayrılan kullanıcıları bul
          const removedUsers = prevUsers.filter(
            (prevUser) =>
              !newUsers.some(
                (newUser) =>
                  (normalizeUserKey(newUser.username) || newUser.id) ===
                  (normalizeUserKey(prevUser.username) || prevUser.id),
              ),
          );

          // Yeni kullanıcılar için sistem mesajı
          addedUsers.forEach((user) => {
            if (user.isBot) {
              return;
            }
            const selfUsername = getCurrentUsername();
            const joinedUserKey = normalizeUserKey(user.username);
            if (joinedUserKey && pendingLeaveTimersRef.current[joinedUserKey]) {
              window.clearTimeout(pendingLeaveTimersRef.current[joinedUserKey]);
              delete pendingLeaveTimersRef.current[joinedUserKey];
            }

            const viewerStarCount = Number(userRoleStarCountRef.current ?? 0);
            const joinedUserStarCount = Number(user.roleStarCount ?? 0);
            const joinedOnRoof = user.statusModeName === "Çatıda";

            if (joinedOnRoof && viewerStarCount <= joinedUserStarCount) {
              return;
            }

            // Ajan girişi varsa ajan adını kullan
            const displayName = resolveViewerAwareDisplayName(
              user,
              Number(userRoleStarCountRef.current ?? 0),
            );
            const currentUserName = selfUsername;
            const currentAgentNickname = localStorage.getItem("agentNickname");
            if (
              isSelfJoinLeaveSystemMessage(
                `${displayName} odaya katıldı! 👋`,
                currentUserName,
                currentAgentNickname,
              )
            ) {
              return;
            }

            const systemMessage: Message = {
              room: data.room,
              username: "Sistem",
              message: `${displayName} odaya katıldı! 👋`,
              gender: "male",
              isGuest: false,
              timestamp: new Date().toISOString(),
              isSystemMessage: true,
              loginHistoryId: user.loginHistoryId ?? null,
              loginTargetStarCount: user.roleStarCount ?? 0,
            };

            setMessages((prev) => {
              const isDuplicate = prev.some(
                (msg) =>
                  msg.message === systemMessage.message &&
                  msg.username === systemMessage.username &&
                  new Date(msg.timestamp).getTime() > Date.now() - 5000,
              );
              if (isDuplicate) return prev;
              return [...prev, systemMessage];
            });

            if (joinedOnRoof) {
              return;
            }
          });

          const currentUsernameNormalized = getCurrentUsername()
            ?.trim()
            .toLocaleLowerCase("tr-TR");

          newUsers.forEach((user) => {
            if (user.isBot) {
              return;
            }
            if (!user.joinEffect || !isJoinEffectId(user.joinEffect)) {
              return;
            }

            const normalizedUsername = user.username
              .trim()
              .toLocaleLowerCase("tr-TR");
            const previousUser = prevUsers.find(
              (prevUser) =>
                prevUser.username.trim().toLocaleLowerCase("tr-TR") ===
                normalizedUsername,
            );
            const becameVisible =
              previousUser?.statusModeName === "Çatıda" &&
              user.statusModeName !== "Çatıda";
            const newlyJoinedVisible =
              !previousUser && user.statusModeName !== "Çatıda";

            if (!becameVisible && !newlyJoinedVisible) {
              return;
            }

            // Join effect'leri artık dedike socket event'leri (room:userJoinEffectTriggered)
            // üzerinden hallediyoruz. Bu bloktaki manuel tespitleri kaldırıyoruz.
          });

          // Ayrılan kullanıcılar için sistem mesajı
          removedUsers.forEach((user) => {
            if (user.isBot) {
              return;
            }
            const leftUserKey = normalizeUserKey(user.username);
            if (!leftUserKey) return;
            if (pendingLeaveTimersRef.current[leftUserKey]) {
              window.clearTimeout(pendingLeaveTimersRef.current[leftUserKey]);
              delete pendingLeaveTimersRef.current[leftUserKey];
            }

            // Yarım saniye bekle ki eğer oda değiştiriyorsa transition mesajı gelsin
            const timeoutId = window.setTimeout(() => {
              delete pendingLeaveTimersRef.current[leftUserKey];

              const userRejoined = roomUsersRef.current.some(
                (roomUser) => normalizeUserKey(roomUser.username) === leftUserKey,
              );
              if (userRejoined) {
                return;
              }

              const isTransitioning =
                transitioningUsersRef.current[user.username];

              // Odaya geçiş yaptığına dair özel mesaj geldiyse, "odadan ayrıldı" mesajını geç
              if (isTransitioning) {
                // Flag'i hemen silmiyoruz, TTL silsin veya başka bir oda değişikliğinde kullanılsın
                return;
              }

              // Ajan girişi varsa ajan adını kullan
              const displayName = resolveViewerAwareDisplayName(
                user,
                Number(userRoleStarCountRef.current ?? 0),
              );
              const isOnRoof = user.statusModeName === "Çatıda";
              const viewerStarCount = Number(userRoleStarCountRef.current ?? 0);
              const leftUserStarCount = Number(user.roleStarCount ?? 0);

              if (isOnRoof && viewerStarCount < leftUserStarCount) {
                return;
              }

              const leaveMessage = isOnRoof
                ? `${displayName} ➔ siteden çıkış yaptı (çatıdaydı)`
                : `${displayName} siteden çıkış yaptı! 👋`;
              const currentUserName = getCurrentUsername();
              const currentAgentNickname = localStorage.getItem("agentNickname");
              if (
                isSelfJoinLeaveSystemMessage(
                  leaveMessage,
                  currentUserName,
                  currentAgentNickname,
                )
              ) {
                return;
              }

              const systemMessage: Message = {
                room: data.room,
                username: "Sistem",
                message: leaveMessage,
                gender: "male",
                isGuest: false,
                timestamp: new Date().toISOString(),
                isSystemMessage: true,
              };

              setMessages((prev) => {
                const now = Date.now();
                const recentFriendOfflineMessage = prev.some((msg) => {
                  if (msg.username !== "Sistem") return false;
                  if (
                    !msg.message.startsWith(
                      `${displayName} ➔ Arkadaşın siteden çıkış yaptı`,
                    )
                  ) {
                    return false;
                  }
                  const ts = msg.timestamp ? new Date(msg.timestamp).getTime() : 0;
                  return ts && now - ts < 8000;
                });
                if (recentFriendOfflineMessage) return prev;

                const isDuplicate = prev.some(
                  (msg) =>
                    msg.message === systemMessage.message &&
                    msg.username === systemMessage.username &&
                    new Date(msg.timestamp).getTime() > now - 5000,
                );
                if (isDuplicate) return prev;
                return [...prev, systemMessage];
              });
            }, 1000); // 1s gecikmeli kontrol (geçiş mesajı gelmesi için yeterli süre)

            pendingLeaveTimersRef.current[leftUserKey] = timeoutId;
          });

          return newUsers;
        });
      },
    );

    const getCurrentRoomKeys = () =>
      [activeRoomId, activeRoom, roomId, roomDisplayName]
        .map((value) =>
          String(value || "")
            .trim()
            .toLocaleLowerCase("tr-TR"),
        )
        .filter(Boolean);

    const isCurrentBotRoomEvent = (room?: string | null) => {
      const normalizedEventRoom = String(room || "")
        .trim()
        .toLocaleLowerCase("tr-TR");
      const currentRoomKeys = getCurrentRoomKeys();

      return (
        !normalizedEventRoom ||
        currentRoomKeys.length === 0 ||
        currentRoomKeys.includes(normalizedEventRoom)
      );
    };

    const normalizeIncomingBotUser = (bot: RoomUser): RoomUser => ({
      ...bot,
      isBot: true,
      isGuest: false,
      isInVoiceChat: bot.isInVoiceChat ?? false,
      isMuted: bot.isMuted ?? false,
      isHandRaised: bot.isHandRaised ?? false,
      isCameraOn: bot.isCameraOn ?? false,
      displayUsername: bot.displayUsername ?? bot.username,
      agentNickname: null,
    });

    socketInstance.on(
      "room:botUsers",
      (data: { room: string; users: RoomUser[] }) => {
        if (!isCurrentBotRoomEvent(data.room)) {
          return;
        }

        const incomingBots = (data.users || []).map(normalizeIncomingBotUser);

        setRoomUsers((prevUsers) => {
          const humans = prevUsers.filter((user) => !user.isBot);
          const previousBotsByKey = new Map(
            prevUsers
              .filter((user) => user.isBot)
              .map((user) => [normalizeUserKey(user.username) || user.id, user]),
          );

          const mergedBots = incomingBots.map((bot) => {
            const key = normalizeUserKey(bot.username) || bot.id;
            const previousBot = previousBotsByKey.get(key);
            return {
              ...(previousBot ?? {}),
              ...bot,
              isBot: true,
              agentNickname: null,
            };
          });

          return [...humans, ...mergedBots];
        });
      },
    );

    socketInstance.on(
      "room:botUserChanged",
      (data: {
        room: string;
        action: "upsert" | "remove";
        username: string;
        user?: RoomUser | null;
      }) => {
        if (!isCurrentBotRoomEvent(data.room)) {
          return;
        }

        const normalizedUsername = normalizeUserKey(data.username);
        if (!normalizedUsername) return;

        setRoomUsers((prevUsers) => {
          if (data.action === "remove") {
            return prevUsers.filter(
              (user) =>
                !user.isBot ||
                normalizeUserKey(user.username) !== normalizedUsername,
            );
          }

          if (!data.user) {
            return prevUsers;
          }

          const nextBot = normalizeIncomingBotUser(data.user);

          const existingIndex = prevUsers.findIndex(
            (user) =>
              user.isBot &&
              normalizeUserKey(user.username) === normalizedUsername,
          );
          if (existingIndex === -1) {
            return [...prevUsers, nextBot];
          }

          return prevUsers.map((user, index) =>
            index === existingIndex ? { ...user, ...nextBot } : user,
          );
        });
      },
    );

    socketInstance.on(
      "room:botStateUpdate",
      (data: {
        room?: string;
        username: string;
        isInVoiceChat?: boolean;
        isMuted?: boolean;
        isCameraOn?: boolean;
        isHandRaised?: boolean;
        handRaisedAt?: number | null;
      }) => {
        const normalizedEventRoom = String(data.room || "")
          .trim()
          .toLocaleLowerCase("tr-TR");
        const currentRoomKeys = [
          activeRoomId,
          activeRoom,
          roomId,
          roomDisplayName,
        ]
          .map((value) =>
            String(value || "")
              .trim()
              .toLocaleLowerCase("tr-TR"),
          )
          .filter(Boolean);

        if (
          normalizedEventRoom &&
          currentRoomKeys.length > 0 &&
          !currentRoomKeys.includes(normalizedEventRoom)
        ) {
          return;
        }

        const normalizedUsername = normalizeUserKey(data.username);
        if (!normalizedUsername) return;

        setRoomUsers((prevUsers) =>
          prevUsers.map((user) => {
            if (
              !user.isBot ||
              normalizeUserKey(user.username) !== normalizedUsername
            ) {
              return user;
            }

            return {
              ...user,
              isInVoiceChat: data.isInVoiceChat ?? user.isInVoiceChat,
              isMuted: data.isMuted ?? user.isMuted,
              isCameraOn: data.isCameraOn ?? user.isCameraOn,
              isHandRaised: data.isHandRaised ?? user.isHandRaised,
              handRaisedAt:
                data.handRaisedAt !== undefined
                  ? data.handRaisedAt
                  : user.handRaisedAt,
            };
          }),
        );
      },
    );

    const enqueueWelcomePromptFromJoinData = (data: JoinEffectEventPayload) => {
      if (data.isBot) {
        return;
      }
      if ((data.entryType ?? "site") !== "site") {
        return;
      }
      if (!isLobbyRoomLike(data.room) && !isLobbyRoomLike(roomDisplayName)) {
        return;
      }

      enqueueWelcomePrompt({
        room: data.room,
        joinedUsername: data.username,
        welcomeDisplayName: resolveWelcomeTargetDisplayName({
          username: data.username,
          displayUsername: data.displayUsername,
          agentNickname: data.agentNickname ?? null,
        }),
      });
    };

    socketInstance.on(
      "room:welcomePromptRequested",
      (data: JoinEffectEventPayload) => {
        enqueueWelcomePromptFromJoinData(data);
      },
    );

    socketInstance.on(
      "room:userJoined",
      (data: JoinEffectEventPayload) => {
        if (data.isBot) {
          return;
        }
        const selfUsername = getCurrentUsername();
        const normalizedSelfUsername = (selfUsername || "")
          .trim()
          .toLocaleLowerCase("tr-TR");
        const normalizedEventUsername = String(data.username || "")
          .trim()
          .toLocaleLowerCase("tr-TR");
        if (
          (data.socketId && data.socketId === socketInstance.id) ||
          (normalizedSelfUsername &&
            normalizedEventUsername === normalizedSelfUsername)
        ) {
          logJoinEffectClientDebug("drop:room:userJoined:self", {
            socketId: socketInstance.id,
            payload: data,
          });
          return;
        }
        if (!data.joinEffect || !isJoinEffectId(data.joinEffect)) {
          return;
        }

        upsertRoomUserFromJoinEffectEvent(data);

        const shouldAllowMobileJoinEffect =
          isMobileJoinEffectModeRef.current;
        if (
          !shouldAllowMobileJoinEffect &&
          (!data.statusModeName || data.statusModeName === "Çatıda")
        ) {
          return;
        }

        triggerRemoteJoinEffect({
          key: `${data.username.toLocaleLowerCase("tr-TR")}:${data.joinEffect}:${Date.now()}`,
          socketId: data.socketId ?? null,
          username: data.username,
          loginHistoryId: data.loginHistoryId ?? null,
          joinEffect: data.joinEffect as JoinEffectId,
          source: data.entryType === "site" ? "site" : "room",
          icon: data.icon ?? null,
          roleIcon: data.roleIcon ?? null,
          roleStarColor: data.roleStarColor ?? null,
          roleStarCount: data.roleStarCount ?? null,
          roleName: data.roleName ?? data.role_title ?? null,
          role_data: data.role_data ?? null,
          agentNickname: data.agentNickname ?? null,
          entryType: data.entryType || "room",
        });
      },
    );

    socketInstance.on(
      "room:userStatusModeChanged",
      (data: {
        room: string;
        socketId?: string;
        username: string;
        displayUsername?: string;
        previousStatusModeId?: number | null;
        previousStatusModeName?: string | null;
        statusModeId?: number | null;
        statusModeName?: string | null;
        joinEffect?: string | null;
        isBot?: boolean;
      }) => {
        if (data.isBot) {
          return;
        }
        // Çatıdan inen kullanıcıyı yakala (Eski statusu Çatıda, yenisi değilse)
        const user = findCurrentRoomUser(data.username);
        const wasOnRoof =
          data.previousStatusModeName === "Çatıda" ||
          user?.statusModeName === "Çatıda";
        const isNowActive = data.statusModeName !== "Çatıda";
        const hasJoinEffectFromEvent =
          typeof data.joinEffect === "string" && isJoinEffectId(data.joinEffect);
        const isSelfSocketEvent =
          Boolean(data.socketId) && data.socketId === socketInstance.id;

        if ((wasOnRoof && isNowActive) || (isNowActive && hasJoinEffectFromEvent)) {
          // Ajan girişi varsa ajan adını kullan
          const displayName = resolveViewerAwareDisplayName(
            {
              username: data.username,
              displayUsername: data.displayUsername,
              agentNickname: user?.agentNickname ?? null,
              roleStarCount: user?.roleStarCount ?? null,
            },
            Number(userRoleStarCountRef.current ?? 0),
          );
          const currentUserName = getCurrentUsername();
          const currentAgentNickname = localStorage.getItem("agentNickname");
          const viewerStarCount = Number(userRoleStarCountRef.current ?? 0);
          const targetStarCount = Number(user?.roleStarCount ?? 0);
          const isSelfEvent = isSelfJoinLeaveSystemMessage(
            `${displayName} odaya katıldı! 👋`,
            currentUserName,
            currentAgentNickname,
          );

          if (!isSelfEvent && viewerStarCount <= targetStarCount) {
            const systemMessage: Message = {
              room: data.room,
              username: "Sistem",
              message: `${displayName} odaya katıldı! 👋`,
              gender: "male",
              isGuest: false,
              timestamp: new Date().toISOString(),
              isSystemMessage: true,
              loginHistoryId: user?.loginHistoryId ?? null,
              loginTargetStarCount: user?.roleStarCount ?? 0,
            };
            setMessages((prev) => [...prev, systemMessage]);
          }

          // Çatıdan inişte giriş efekti dedike event'ler (room:userJoinEffectTriggered) 
          // tarafından halledileceği için burada manuel tetikleme yapmıyoruz.
          if (wasOnRoof && isNowActive && !hasJoinEffectFromEvent) {
            scheduleRoofExitJoinEffectRecovery(data.username);
          }
        }

        setRoomUsers((prev) =>
          prev.map((user) =>
            normalizeUserKey(user.username) === normalizeUserKey(data.username)
              ? {
                  ...user,
                  statusModeId: data.statusModeId ?? null,
                  statusModeName: data.statusModeName ?? null,
                  joinEffect:
                    data.joinEffect && isJoinEffectId(data.joinEffect)
                      ? (data.joinEffect as JoinEffectId)
                      : user.joinEffect ?? null,
                }
              : user,
          ),
        );
      },
    );

    socketInstance.on(
      "room:userJoinEffectTriggered",
      (data: {
        room: string;
        socketId?: string;
        username: string;
        loginHistoryId?: number | null;
        gender: "male" | "female";
        isGuest: boolean;
        statusModeId?: number | null;
        statusModeName?: string | null;
        icon?: string | null;
        roleIcon?: string | null;
        roleStarColor?: string | null;
        roleStarCount?: number | null;
        roleName?: string | null;
        role_title?: string | null;
        role_data?: Record<string, unknown> | null;
        agentNickname?: string | null;
        entryType?: "site" | "room";
        joinEffect?: string | null;
      }) => {
        logJoinEffectClientDebug("event:room:userJoinEffectTriggered", {
          socketId: socketInstance.id,
          currentRooms: [activeRoom, activeRoomId, roomId, roomDisplayName].filter(Boolean),
          payload: data,
        });
        const selfUsername = getCurrentUsername();
        const normalizedSelfUsername = (selfUsername || "")
          .trim()
          .toLocaleLowerCase("tr-TR");
        const normalizedEventUsername = String(data.username || "")
          .trim()
          .toLocaleLowerCase("tr-TR");
        if (
          (data.socketId && data.socketId === socketInstance.id) ||
          (normalizedSelfUsername &&
            normalizedEventUsername === normalizedSelfUsername)
        ) {
          logJoinEffectClientDebug("drop:room:userJoinEffectTriggered:self", {
            socketId: socketInstance.id,
            payload: data,
          });
          return;
        }
        if (!data.joinEffect || !isJoinEffectId(data.joinEffect)) {
          logJoinEffectClientDebug("drop:room:invalid-effect", {
            joinEffect: data.joinEffect,
            username: data.username,
          });
          return;
        }
        upsertRoomUserFromJoinEffectEvent(data);
        if (data.agentNickname) {
          logJoinEffectClientDebug("drop:room:agent", {
            username: data.username,
            agentNickname: data.agentNickname,
          });
          return;
        }

        const currentRoomUser = findCurrentRoomUser(data.username);
        const shouldAllowMobileJoinEffect =
          isMobileJoinEffectModeRef.current;
        if (
          (data.statusModeName === "Çatıda" ||
            currentRoomUser?.statusModeName === "Çatıda") &&
          !shouldAllowMobileJoinEffect
        ) {
          logJoinEffectClientDebug("drop:room:roof", {
            username: data.username,
            eventStatusModeName: data.statusModeName,
            currentStatusModeName: currentRoomUser?.statusModeName ?? null,
            entryType: data.entryType ?? null,
            isMobileJoinEffectMode: isMobileJoinEffectModeRef.current,
          });
          return;
        }

        triggerRemoteJoinEffect({
          key: `${data.username.toLocaleLowerCase("tr-TR")}:${data.joinEffect}:${Date.now()}`,
          socketId: data.socketId ?? null,
          username: data.username,
          loginHistoryId:
            data.loginHistoryId ?? currentRoomUser?.loginHistoryId ?? null,
          joinEffect: data.joinEffect as JoinEffectId,
          source: data.entryType === "site" ? "site" : "room",
          icon: data.icon ?? currentRoomUser?.icon ?? null,
          roleIcon: data.roleIcon ?? currentRoomUser?.roleIcon ?? null,
          roleStarColor:
            data.roleStarColor ?? currentRoomUser?.roleStarColor ?? null,
          roleStarCount:
            data.roleStarCount ?? currentRoomUser?.roleStarCount ?? null,
          roleName:
            data.roleName ?? data.role_title ?? currentRoomUser?.roleName ?? null,
          role_data: data.role_data ?? null,
          agentNickname:
            data.agentNickname ?? currentRoomUser?.agentNickname ?? null,
          entryType: data.entryType || "room",
        });
      },
    );

    socketInstance.on(
      "tenant:joinEffectTriggered",
      (data: {
        room: string;
        socketId?: string;
        username: string;
        loginHistoryId?: number | null;
        gender: "male" | "female";
        isGuest: boolean;
        statusModeId?: number | null;
        statusModeName?: string | null;
        icon?: string | null;
        roleIcon?: string | null;
        roleStarColor?: string | null;
        roleStarCount?: number | null;
        roleName?: string | null;
        role_title?: string | null;
        role_data?: Record<string, unknown> | null;
        agentNickname?: string | null;
        entryType?: "site" | "room";
        joinEffect?: string | null;
      }) => {
        const isSameRoomTenantEvent = isCurrentRoomEvent(data.room);
        logJoinEffectClientDebug("event:tenant:joinEffectTriggered", {
          socketId: socketInstance.id,
          currentRooms: [activeRoom, activeRoomId, roomId, roomDisplayName].filter(Boolean),
          isSameRoomTenantEvent,
          payload: data,
        });
        if (data.entryType !== "site") {
          logJoinEffectClientDebug("drop:tenant:non-site-entry", {
            username: data.username,
            entryType: data.entryType ?? null,
            room: data.room,
          });
          return;
        }
        const selfUsername = getCurrentUsername();
        const normalizedSelfUsername = (selfUsername || "")
          .trim()
          .toLocaleLowerCase("tr-TR");
        const normalizedEventUsername = String(data.username || "")
          .trim()
          .toLocaleLowerCase("tr-TR");
        if (
          (data.socketId && data.socketId === socketInstance.id) ||
          (normalizedSelfUsername &&
            normalizedEventUsername === normalizedSelfUsername)
        ) {
          logJoinEffectClientDebug("drop:tenant:self", {
            socketId: socketInstance.id,
            payload: data,
          });
          return;
        }
        if (!data.joinEffect || !isJoinEffectId(data.joinEffect)) {
          logJoinEffectClientDebug("drop:tenant:invalid-effect", {
            joinEffect: data.joinEffect,
            username: data.username,
          });
          return;
        }
        if (isSameRoomTenantEvent) {
          upsertRoomUserFromJoinEffectEvent(data);
        }
        if (data.agentNickname) {
          logJoinEffectClientDebug("drop:tenant:agent", {
            username: data.username,
            agentNickname: data.agentNickname,
          });
          return;
        }

        if (
          data.statusModeName === "Çatıda" &&
          data.entryType !== "site" &&
          !isMobileJoinEffectModeRef.current
        ) {
          logJoinEffectClientDebug("drop:tenant:roof", {
            username: data.username,
            eventStatusModeName: data.statusModeName,
            entryType: data.entryType ?? null,
          });
          return;
        }



        triggerRemoteJoinEffect({
          key: `${data.username.toLocaleLowerCase("tr-TR")}:${data.joinEffect}:${Date.now()}`,
          socketId: data.socketId ?? null,
          username: data.username,
          loginHistoryId: data.loginHistoryId ?? null,
          joinEffect: data.joinEffect as JoinEffectId,
          source: "site",
          icon: data.icon ?? null,
          roleIcon: data.roleIcon ?? null,
          roleStarColor: data.roleStarColor ?? null,
          roleStarCount: data.roleStarCount ?? null,
          roleName: data.roleName ?? data.role_title ?? null,
          role_data: data.role_data ?? null,
          agentNickname: data.agentNickname ?? null,
          entryType: data.entryType || "site",
        });
      },
    );

    socketInstance.on(
      "room:userFrameChanged",
      (data: { room: string; username: string; frame?: string | null }) => {
        armRoomUserPresenceGrace(data.username);
        const framePath = data.frame ? `/cerceveler/${data.frame}.png` : null;
        setRoomUsers((prev) =>
          prev.map((user) =>
            user.username === data.username
              ? {
                  ...user,
                  frame: framePath,
                }
              : user,
          ),
        );
        const currentUser =
          localStorage.getItem("isGuest") === "true"
            ? localStorage.getItem("guestUsername")
            : localStorage.getItem("username");
        if (data.username === currentUser) {
          profileFrameRef.current = data.frame || null;
          if (typeof window !== "undefined") {
            if (framePath) {
              localStorage.setItem("profileFrame", framePath);
            } else {
              localStorage.removeItem("profileFrame");
            }
          }
        }
      },
    );

    socketInstance.on(
      "userStyleUpdate",
      (data: {
        room: string;
        username: string;
        fontName?: string | null;
        granite?: string | null;
        nickColor?: string | null;
        userGif?: string | null;
        flashNick?: string | null;
      }) => {
        armRoomUserPresenceGrace(data.username);
        const normalized = data.username.trim().toLowerCase();
        setRoomUsers((prev) =>
          prev.map((user) =>
            user.username.trim().toLowerCase() === normalized
              ? {
                  ...user,
                  fontName: data.fontName !== undefined ? data.fontName : user.fontName,
                  granite: data.granite !== undefined ? data.granite : user.granite,
                  nickColor: data.nickColor !== undefined ? data.nickColor : user.nickColor,
                  userGif: data.userGif !== undefined ? data.userGif : user.userGif,
                  flashNick: data.flashNick !== undefined ? data.flashNick : user.flashNick,
                }
              : user,
          ),
        );
      },
    );

    socketInstance.on(
      "tenant:userStyleUpdate",
      (data: {
        username: string;
        fontName?: string | null;
        granite?: string | null;
        nickColor?: string | null;
        userGif?: string | null;
        flashNick?: string | null;
      }) => {
        armRoomUserPresenceGrace(data.username);
        const normalized = data.username.trim().toLowerCase();
        setRoomUsers((prev) =>
          prev.map((user) =>
            user.username.trim().toLowerCase() === normalized
              ? {
                  ...user,
                  fontName: data.fontName !== undefined ? data.fontName : user.fontName,
                  granite: data.granite !== undefined ? data.granite : user.granite,
                  nickColor: data.nickColor !== undefined ? data.nickColor : user.nickColor,
                  userGif: data.userGif !== undefined ? data.userGif : user.userGif,
                  flashNick: data.flashNick !== undefined ? data.flashNick : user.flashNick,
                }
              : user,
          ),
        );
      },
    );

    socketInstance.on(
      "room:userFlashNickChanged",
      (data: {
        room: string;
        username: string;
        flashNick?: string | null;
      }) => {
        armRoomUserPresenceGrace(data.username);
        const normalized = data.username.trim().toLowerCase();
        setRoomUsers((prev) =>
          prev.map((user) =>
            user.username.trim().toLowerCase() === normalized
              ? {
                  ...user,
                  flashNick: data.flashNick ?? null,
                }
              : user,
          ),
        );
      },
    );

    socketInstance.on(
      "room:userIconChanged",
      (data: { room: string; username: string; icon?: string | null }) => {
        armRoomUserPresenceGrace(data.username);
        const iconPath = calculateAvatar(data.icon);
        setRoomUsers((prev) =>
          prev.map((user) =>
            user.username === data.username
              ? {
                  ...user,
                  icon: iconPath,
                }
              : user,
          ),
        );
        const currentUser =
          localStorage.getItem("isGuest") === "true"
            ? localStorage.getItem("guestUsername")
            : localStorage.getItem("username");
        if (data.username === currentUser) {
          profileIconRef.current = data.icon || null;
          const localIcon =
            typeof window !== "undefined"
              ? localStorage.getItem("profileIcon")
              : null;
          const iconOwner =
            typeof window !== "undefined"
              ? localStorage.getItem("profileIconOwner")
              : null;
          const resolved =
            iconOwner && iconOwner === data.username
              ? localIcon || data.icon || null
              : data.icon || null;
          setCurrentUserIcon(resolved);
          if (typeof window !== "undefined") {
            if (iconPath) {
              localStorage.setItem("profileIcon", iconPath);
            } else {
              localStorage.removeItem("profileIcon");
            }
          }
        }
      },
    );

    socketInstance.on(
      "room:userHandChanged",
      (data: {
        room: string;
        username: string;
        isRaised?: boolean | number | string;
        handRaisedAt?: number | string | null;
      }) => {
        const normalizedRaised =
          data.isRaised === true ||
          data.isRaised === "true" ||
          data.isRaised === 1 ||
          data.isRaised === "1";
        let wasRaised = false;
        setRoomUsers((prev) => {
          let found = false;
          const next = prev.map((user) => {
            if (user.username === data.username) {
              found = true;
              wasRaised = !!user.isHandRaised;
              return {
                ...user,
                isHandRaised: normalizedRaised,
                handRaisedAt: normalizedRaised
                  ? Number(data.handRaisedAt) || Date.now()
                  : null,
              };
            }
            return user;
          });

          if (!found) {
            next.push({
              id: data.username,
              username: data.username,
              gender: "male",
              isGuest: false,
              isHandRaised: normalizedRaised,
              handRaisedAt: normalizedRaised
                ? Number(data.handRaisedAt) || Date.now()
                : null,
            });
          }

          return next;
        });

        // Kendi kullanıcımız için mesaj ekleme (handleToggleHand'de zaten ekleniyor)
        const currentUser = getCurrentUsername();
        if (data.username !== currentUser) {
          const roomName = data.room || activeRoomId || roomDisplayName;
          if (normalizedRaised) {
            addSystemMessage(
              `${data.username} mikrofon sırasına girdi 🎤`,
              roomName,
              true,
            );
          } else {
            addSystemMessage(
              `${data.username} mikrofon sırasından çıktı 🎤`,
              roomName,
              true,
            );
          }
        }
      },
    );

    socketInstance.on(
      "room:userCameraChanged",
      (data: {
        room: string;
        username: string;
        isCameraOn: boolean;
      }) => {
        const normalizedCameraOn = data.isCameraOn === true;

        setRoomUsers((prev) =>
          prev.map((user) =>
            user.username === data.username
              ? { ...user, isCameraOn: normalizedCameraOn }
              : user,
          ),
        );

        const currentUser = getCurrentUsername();
        if (data.username !== currentUser) {
          const roomName = data.room || activeRoomId || roomDisplayName;
          addSystemMessage(
            normalizedCameraOn
              ? `${data.username} kamerayı açtı 📹`
              : `${data.username} kamerayı kapattı 📹`,
            roomName,
            true,
          );
        }
      },
    );

    socketInstance.on(
      "voice:userMuted",
      (data: {
        room: string;
        username: string;
        displayUsername?: string | null;
        isMuted: boolean;
      }) => {
        const normalizedEventRoom = String(data.room || "")
          .trim()
          .toLocaleLowerCase("tr-TR");
        const currentRoomKeys = getCurrentRoomKeys();
        if (
          normalizedEventRoom &&
          currentRoomKeys.length > 0 &&
          !currentRoomKeys.includes(normalizedEventRoom)
        ) {
          return;
        }

        const normalizedUsername = normalizeUserKey(data.username);
        if (!normalizedUsername) return;

        const user = roomUsersRef.current.find(
          (u) => normalizeUserKey(u.username) === normalizedUsername,
        );
        if (!user) {
          requestRoomUsersSnapshot(data.room, socketInstance);
        }

        setRoomUsers((prevUsers) => {
          let didUpdate = false;
          const nextUsers = prevUsers.map((roomUser) => {
            if (normalizeUserKey(roomUser.username) !== normalizedUsername) {
              return roomUser;
            }

            didUpdate = true;
            return {
              ...roomUser,
              isInVoiceChat: true,
              isMuted: data.isMuted,
            };
          });

          return didUpdate ? nextUsers : prevUsers;
        });

        const displayName =
          user?.displayUsername ||
          user?.agentNickname ||
          data.displayUsername ||
          data.username;
        const currentUser = getCurrentUsername();
        const normalizedCurrentUser = normalizeUserKey(currentUser);

        // Kendi kullanıcımız hariç diğerleri için sistem mesajı göster
        if (normalizedUsername !== normalizedCurrentUser) {
          const roomName = data.room || activeRoomId || roomDisplayName;
          const messageText = data.isMuted
            ? `${displayName} mikrofonu kapattı 🔇`
            : `${displayName} mikrofonu aldı 🎤`;

          addSystemMessage(messageText, roomName, true);
        }
      },
    );

    socketInstance.on("moderation:userBanned", (ban: ModerationBanEvent) => {
      const normalizedUserId =
        ban?.userId ?? ban?.user?.id ?? ban?.user_id ?? null;
      const normalizedUsername =
        ban?.username ?? ban?.user?.username ?? ban?.user_name ?? null;
      const bannedBy =
        ban?.bannedByUsername ??
        ban?.bannedById ??
        ban?.banned_by ??
        ban?.banned_by_id ??
        null;
      const reason = ban?.reason ?? null;
      const expiresAt = ban?.expiresAt ?? ban?.expires_at ?? null;
      const createdAt =
        ban?.createdAt ?? ban?.created_at ?? new Date().toISOString();
      const bannedUserIsGuest = ban?.isGuest ?? ban?.guest ?? false;

      const detailParts: string[] = [];
      if (reason) detailParts.push(`Sebep: ${reason}`);
      if (bannedBy) detailParts.push(`Yetkili: ${bannedBy}`);

      const targetLabel =
        normalizedUsername ||
        (normalizedUserId !== null && normalizedUserId !== undefined
          ? `ID ${normalizedUserId}`
          : "Kullanıcı");

      const banMessage = `${targetLabel} banlandı.${
        detailParts.length ? ` ${detailParts.join(" | ")}` : ""
      }`;

      setMessages((prev) => [
        ...prev,
        {
          room: activeRoomId || activeRoom || roomDisplayName,
          username: "Sistem",
          message: banMessage,
          gender: "male",
          isGuest: bannedUserIsGuest,
          timestamp: new Date(createdAt).toISOString(),
          isSystemMessage: true,
        },
      ]);

      setRoomUsers((prev) =>
        prev.filter((user) => {
          const matchesId =
            normalizedUserId !== null && normalizedUserId !== undefined
              ? String(user.id) === String(normalizedUserId)
              : false;
          const matchesUsername =
            normalizedUsername && user.username === normalizedUsername;
          return !(matchesId || matchesUsername);
        }),
      );

      const currentUserId = localStorage.getItem("userId");
      const currentUserName = getCurrentUsername();
      const normalizedCurrentName = currentUserName
        ? currentUserName.toLowerCase()
        : null;
      const normalizedBannedName = normalizedUsername
        ? normalizedUsername.toLowerCase()
        : null;
      const normalizedIdString =
        normalizedUserId !== null && normalizedUserId !== undefined
          ? String(normalizedUserId)
          : null;

      const isCurrentUserBanned =
        (normalizedIdString && currentUserId === normalizedIdString) ||
        (normalizedCurrentName &&
          normalizedBannedName &&
          normalizedBannedName === normalizedCurrentName);

      if (isCurrentUserBanned) {
        clearAuthSession();
        emitLeaveOnce(socketInstance, activeRoom, getCurrentUsername());
        socketInstance.disconnect();
        window.location.href = "/";
      }
    });

    socketInstance.on(
      "moderation:micBanToggled",
      (data: { username: string; micBanned: boolean }) => {
        setRoomUsers((prev) =>
          prev.map((user) =>
            user.username === data.username
              ? { ...user, micBanned: data.micBanned }
              : user,
          ),
        );
      },
    );

    socketInstance.on(
      "moderation:cameraBanToggled",
      (data: { username: string; cameraBanned: boolean }) => {
        setRoomUsers((prev) =>
          prev.map((user) =>
            user.username === data.username
              ? { ...user, cameraBanned: data.cameraBanned }
              : user,
          ),
        );

        const currentUser = getCurrentUsername();
        if (
          currentUser &&
          String(data.username).toLowerCase() === currentUser.toLowerCase()
        ) {
          setInitialCameraBanned(data.cameraBanned === true);
        }
      },
    );

    socketInstance.on(
      "moderation:muteStateChanged",
      (data: {
        username: string;
        scope: "room" | "global";
        room?: string;
        roomName?: string;
        roomMuted?: boolean;
        globalMuted?: boolean;
      }) => {
        setRoomUsers((prev) =>
          prev.map((user) => {
            if (
              user.username.toLowerCase() !== String(data.username).toLowerCase()
            ) {
              return user;
            }
            if (data.scope === "global") {
              return { ...user, globalMuted: data.globalMuted === true };
            }

            const activeRoomKey = String(activeRoom || "").trim().toLowerCase();
            const payloadRoomKey = String(data.room || "").trim().toLowerCase();
            if (
              activeRoomKey &&
              payloadRoomKey &&
              activeRoomKey === payloadRoomKey
            ) {
              return { ...user, roomMuted: data.roomMuted === true };
            }
            return user;
          }),
        );

        const currentUser = getCurrentUsername();
        if (
          currentUser &&
          String(data.username).toLowerCase() === currentUser.toLowerCase()
        ) {
          if (data.scope === "global") {
            setGlobalMuted(data.globalMuted === true);
            if (data.globalMuted) {
              setMutedRoomName(data.roomName || roomDisplayName);
            }
          } else {
            setRoomMuted(data.roomMuted === true);
            if (data.roomMuted) {
              setMutedRoomName(data.roomName || roomDisplayName);
            } else if (!globalMuted) {
              setMutedRoomName(null);
            }
          }
        }
      },
    );

    socketInstance.on(
      "moderation:muteActionDenied",
      (data: {
        username?: string;
        reason: "room_muted" | "global_muted";
        roomName?: string;
      }) => {
        const currentUser = getCurrentUsername();
        if (
          data.username &&
          currentUser &&
          String(data.username).toLowerCase() !== currentUser.toLowerCase()
        ) {
          return;
        }
        const displayRoom = data.roomName || roomDisplayName;
        toast.error(`${displayRoom} odasında susturuldunuz`);
      },
    );

    socketInstance.on(
      "tenant:systemMessage",
      (data: {
        message?: string;
        timestamp?: string;
        isSystemMessage?: boolean;
      }) => {
        const message = String(data?.message || "").trim();
        if (!message) return;

        if (globalAnnouncementTimerRef.current !== null) {
          window.clearTimeout(globalAnnouncementTimerRef.current);
        }
        setActiveGlobalAnnouncement({
          message,
          timestamp: data?.timestamp || new Date().toISOString(),
        });
        globalAnnouncementTimerRef.current = window.setTimeout(() => {
          setActiveGlobalAnnouncement(null);
          globalAnnouncementTimerRef.current = null;
        }, 10000);

        // ChatsON global duyurusu normal sohbet geçmişine eklenmez.
        // Sistem mesajı satırından bağımsız, yalnızca üst duyuru bandında gösterilir.
      },
    );

    socketInstance.on(
      "system:resetStarted",
      (data: {
        countdownSeconds?: number;
        remainingDurationMs?: number;
        message?: string;
      }) => {
        startSystemResetCountdown(data);
      },
    );

    socketInstance.on(
      "room:historyCleared",
      (data: { room?: string; roomName?: string }) => {
        if (!isCurrentRoomEvent(data?.room) && !isCurrentRoomEvent(data?.roomName)) {
          return;
        }

        setMessages(buildCurrentRoomDescriptionMessages());
        localStorage.removeItem(`chat-history-${roomDisplayName}`);
        toast.info("Oda yazıları temizlendi.");
      },
    );

    // 5. Oda katılma hatalarını dinle (event-based)
    socketInstance.on("room:joinError", (data: JoinRoomErrorData) => {
      const hasJoinErrorPayload =
        typeof data === "string"
          ? data.trim().length > 0
          : Boolean(data?.message || data?.detail);
      if (!hasJoinErrorPayload) return;

      console.warn("Odaya katılma hatası (EVENT):", data);
      if (
        typeof data !== "string" &&
        data?.message === "reset_in_progress"
      ) {
        startSystemResetCountdown({
          countdownSeconds: data.countdownSeconds,
          remainingDurationMs: data.remainingDurationMs,
          message: data.detail || "Sistem resetleniyor",
        });
        return;
      }

      setJoinError(getJoinRoomErrorMessage(data));

      // Always redirect on error after 3 seconds
      setTimeout(() => {
        clearAuthSession();
        window.location.href = "/";
      }, 3000);
    });

    // 6. Mesajları dinle
    socketInstance.on(
      "room:message",
      (
        data: Message & {
          messageId?: number;
          replyToMessage?: ReplyToMessage | null;
        },
      ) => {
        console.log("[ROOM_MESSAGE_IN]", {
          eventRoom: data?.room,
          activeRoom,
          activeRoomId,
          roomDisplayName,
          username: data?.username,
          message: data?.message,
          messageId: data?.messageId ?? data?.id,
        });

        const normalizedMessage = buildMessageFromSocketPayload(data);
        const username = normalizedMessage.username;

        // Eğer mesaj mevcut kullanıcıya aitse, local değerleri tercih et
        const currentUser = getCurrentUsername();
        const isOwnMessage = normalizedMessage.originalUsername === currentUser;

        const msgId = normalizedMessage.id;
        if (msgId) {
          markAsRead(msgId);
        }

        // Geçiş mesajı kontrolü (Sidebar'dan gönderilen özel format)
        if (
          data.message &&
          typeof data.message === "string" &&
          (data.message.startsWith("__TRANSITION__:") ||
            data.message.startsWith("__TELEPORT__:"))
        ) {
          const isTeleport = data.message.startsWith("__TELEPORT__:");
          const parts = data.message.split(":");
          const transitioningUser = parts[1] || username;
          const targetRoomName = parts[parts.length - 1];
          const matchedUser = roomUsersRef.current.find(
            (u) =>
              u.username === transitioningUser ||
              (u.agentNickname || "").trim() === transitioningUser,
          );
          const transitionKeys = new Set<string>([
            transitioningUser,
            matchedUser?.username || "",
            matchedUser?.agentNickname || "",
          ]);

          const transitionMsg = isTeleport
            ? `${transitioningUser} ➔ ${targetRoomName} odasına ışınlandı`
            : `${transitioningUser} ➔ ${targetRoomName} odasına gitti`;

          // Kullanıcıyı geçiş yapıyor olarak işaretle (ayrılma mesajını engellemek için)
          for (const key of transitionKeys) {
            if (!key) continue;
            transitioningUsersRef.current[key] = true;
          }

          // Güvenlik: 15 saniye sonra bayrağı temizle
          setTimeout(() => {
            for (const key of transitionKeys) {
              if (!key || !transitioningUsersRef.current[key]) continue;
              delete transitioningUsersRef.current[key];
            }
          }, 15000);

          // Normal mesaj yerine sistem mesajı olarak ekle
          addSystemMessage(transitionMsg, data.room);
          return;
        }

        appendMessageDeduped({
          ...normalizedMessage,
          replyToMessage: normalizedMessage.replyToMessage ?? null,
        });
      },
    );

    // 7. Resim mesajlarını dinle
    socketInstance.on("room:image", (data: Message) => {
      appendMessageDeduped(buildMessageFromSocketPayload(data));
    });

    // 8. Ses dosyalarını dinle
    socketInstance.on("room:audio", (data: Message & { time?: string }) => {
      appendMessageDeduped(buildMessageFromSocketPayload(data));
    });

    // 9. YouTube videolarını dinle
    socketInstance.on("room:youtube", (data: Message) => {
      appendMessageDeduped(buildMessageFromSocketPayload(data));
    });

    // Listen for role changes
    socketInstance.on(
      "user:roleChanged",
      async (data: {
        userId: number;
        username: string;
        tenantId?: string;
        roleId: number | null;
        role: {
          id: number;
          name: string;
          starCount: number;
          starColor: string | null;
          icon: string;
        } | null;
      }) => {
        const currentTenantId = (env.tenantId || "master")
          .trim()
          .replace(/^tenant_/, "");
        const eventTenantId = String(data.tenantId || "")
          .trim()
          .replace(/^tenant_/, "");
        if (eventTenantId && eventTenantId !== currentTenantId) {
          return;
        }

        const authoritativeRole: RoleSnapshot = {
          roleName: data.role?.name ?? null,
          roleIcon: data.role?.icon || null,
          roleStarColor: data.role?.starColor ?? null,
          roleStarCount: data.role?.starCount ?? null,
        };
        rememberAuthoritativeRole(data.username, authoritativeRole);
        armRoomUserPresenceGrace(data.username);

        // Update room users list with new role information
        setRoomUsers((prev) =>
          prev.map((user) =>
            user.username.trim().toLowerCase() ===
            (data.username || "").trim().toLowerCase()
              ? {
                  ...user,
                  roleName: data.role?.name || null,
                  roleIcon: data.role?.icon || null,
                  roleStarColor: data.role?.starColor || null,
                  roleStarCount: data.role?.starCount || null,
                }
              : user,
          ),
        );

        // Check if the role change is for the current user
        const currentUser = getCurrentUsername();
        const isGuest = localStorage.getItem("isGuest") === "true";
        const currentUserId = localStorage.getItem("userId");
        const normalizedCurrentUser = (currentUser || "").trim().toLowerCase();
        const normalizedEventUser = (data.username || "").trim().toLowerCase();
        const isCurrentUserById =
          currentUserId !== null &&
          data.userId !== null &&
          data.userId !== undefined &&
          currentUserId === String(data.userId);
        const isCurrentUserByUsername =
          normalizedCurrentUser.length > 0 &&
          normalizedEventUser.length > 0 &&
          normalizedCurrentUser === normalizedEventUser;

        if (!isGuest && (isCurrentUserById || isCurrentUserByUsername)) {
          // Apply immediate role/permission state from socket payload.
          const instantStarCount = data.role?.starCount ?? 0;
          const instantRoleName = data.role?.name ?? null;
          const instantRoleIcon = data.role?.icon?.trim?.() || null;
          const instantRoleStarColor = data.role?.starColor ?? null;
          const instantRoleStarCount = data.role?.starCount ?? null;

          setUserStarCount(instantStarCount);
          setUserRoleName(instantRoleName);
          userRoleNameRef.current = instantRoleName;
          userRoleIconRef.current = instantRoleIcon;
          userRoleStarColorRef.current = instantRoleStarColor;
          userRoleStarCountRef.current = instantRoleStarCount;
          setCurrentUserRoleSnapshot(authoritativeRole);
          setCurrentUserRoleReady(true);

          toast.success(
            `Yetkiniz güncellendi: ${
              instantRoleName || "Yetki yok"
            } (${instantStarCount} yıldız)`,
          );

          // Refresh user data so permission-based UI updates instantly.
          try {
            await refreshCurrentUserAuthState();
          } catch (error) {
            console.error(
              "Failed to refresh user data after role change:",
              error,
            );
          }
        }
      },
    );

    socketInstance.on(
      "tenant:roleUpdate",
      async (data: {
        id: number;
        name: string;
        previousName?: string;
        starColor?: string | null;
        starCount?: number | null;
        icon?: string | null;
      }) => {
        const isGuest = localStorage.getItem("isGuest") === "true";
        if (isGuest) return;

        const normalizedCurrentRole = (userRoleNameRef.current || "")
          .trim()
          .toLocaleLowerCase("tr-TR");
        if (!normalizedCurrentRole) return;

        const normalizedUpdatedRole = (data.name || "")
          .trim()
          .toLocaleLowerCase("tr-TR");
        const normalizedPreviousRole = (data.previousName || "")
          .trim()
          .toLocaleLowerCase("tr-TR");

        const currentRoleMatched =
          (normalizedUpdatedRole &&
            normalizedCurrentRole === normalizedUpdatedRole) ||
          (normalizedPreviousRole &&
            normalizedCurrentRole === normalizedPreviousRole);

        if (!currentRoleMatched) return;

        try {
          await refreshCurrentUserAuthState();
        } catch (error) {
          console.error(
            "Failed to refresh user data after tenant role update:",
            error,
          );
        }
      },
    );

    // Listen for room updates from admin panel
    socketInstance.on(
      "room:updated",
      async (data: { roomId: number; roomName: string }) => {
        const currentRoom = roomDetailRef.current;

        // Check if the updated room is the current room
        if (currentRoom && Number(currentRoom.id) === Number(data.roomId)) {
          try {
            // Fetch updated room details
            const updatedRoom = await apiClient.rooms.getRoom(data.roomId);
            setRoomDetail(updatedRoom);

            if (typeof window !== "undefined") {
              const userHasCustomBackground = Boolean(
                localStorage.getItem("chatBackground"),
              );
              if (!userHasCustomBackground) {
                setChatBackground(
                  resolveEffectiveChatBackground(updatedRoom, {
                    includeFallback: true,
                  }),
                );
              }
            }

            // Show system message about room update
            addSystemMessage(
              `Oda bilgileri yönetici tarafından güncellendi.`,
              activeRoom,
              false,
              false,
              false,
            );
          } catch (error) {
            console.error("Failed to fetch updated room details:", error);
          }
        }
      },
    );

    socketInstance.on("radio-settings:updated", async () => {
      try {
        const response =
          await apiClientRef.current.get<RadioSettings>("/radio-settings");
        const data = response?.data;
        setRadioSettings({
          id: data?.id,
          radioLink:
            typeof data?.radioLink === "string" ? data.radioLink : null,
          radioRequestLink:
            typeof data?.radioRequestLink === "string"
              ? data.radioRequestLink
              : null,
        });
      } catch (error) {
        console.error("Radyo ayarları güncellenemedi:", error);
      }
    });

    socketInstance.on(
      "forbidden-words:updated",
      async (data: { type: "created" | "deleted"; forbiddenWordId?: number }) => {
        await refreshForbiddenWords();
      },
    );

    // Cleanup: Component unmount olduğunda odadan ayrıl ve bağlantıyı kes
    return () => {
      window.removeEventListener(
        "kingmobile:system-reset-started",
        handleAdminSystemResetStarted,
      );
      document.removeEventListener(
        "visibilitychange",
        handleSystemResetVisibilityCheck,
      );
      socketInstance.removeAllListeners();
      if (!systemResetActiveRef.current && systemResetIntervalRef.current !== null) {
        window.clearInterval(systemResetIntervalRef.current);
        systemResetIntervalRef.current = null;
      }
      if (!systemResetActiveRef.current && systemResetAudioRef.current) {
        systemResetAudioRef.current.pause();
        systemResetAudioRef.current.currentTime = 0;
        systemResetAudioRef.current = null;
      }
      window.clearTimeout(connectTimeoutId);
      for (const timeoutId of Object.values(pendingLeaveTimersRef.current)) {
        window.clearTimeout(timeoutId);
      }
      pendingLeaveTimersRef.current = {};
      if (socketInstance.connected) {
        emitLeaveOnce(socketInstance, activeRoom, getCurrentUsername());
      }
      socketInstance.disconnect();
    };
  }, [
    roomDisplayName,
    roomId,
    activeRoomId,
    armRoomUserPresenceGrace,
    emitLeaveOnce,
    getAuthoritativeRole,
    getCurrentUsername,
    hasRoomUserPresenceGrace,
    normalizeUserKey,
    playSystemResetSound,
    rememberAuthoritativeRole,
    requestRoomUsersSnapshot,
    refreshForbiddenWords,
    refreshCurrentUserAuthState,
    resolveEffectiveChatBackground,
  ]);

  useEffect(() => {
    if (!socket) return;

    const handleIdentityUpgrade = (event: Event) => {
      const customEvent = event as CustomEvent<{
        previousGuestUsername?: string | null;
      }>;
      const previousUsername =
        customEvent.detail?.previousGuestUsername || getCurrentUsername();

      if (!previousUsername) return;

      setRoomUsers((prev) =>
        prev.filter(
          (user) =>
            user.username.toLocaleLowerCase("tr-TR") !==
            previousUsername.toLocaleLowerCase("tr-TR"),
        ),
      );
      emitLeaveOnce(socket, roomId ?? roomDisplayName, previousUsername);
      socket.disconnect();
    };

    const handleWindowExit = () => {
      const username =
        localStorage.getItem("isGuest") === "true"
          ? localStorage.getItem("guestUsername")
          : localStorage.getItem("username");
      emitLeaveOnce(socket, roomId ?? roomDisplayName, username);
      socket.disconnect();
    };

    window.addEventListener(
      "auth:identity-upgrading",
      handleIdentityUpgrade as EventListener,
    );
    window.addEventListener("pagehide", handleWindowExit);
    window.addEventListener("beforeunload", handleWindowExit);

    return () => {
      window.removeEventListener(
        "auth:identity-upgrading",
        handleIdentityUpgrade as EventListener,
      );
      window.removeEventListener("pagehide", handleWindowExit);
      window.removeEventListener("beforeunload", handleWindowExit);
    };
  }, [socket, roomId, roomDisplayName, emitLeaveOnce, getCurrentUsername]);

  const fetchRoomDetail = useCallback(async () => {
    try {
      const rooms = await apiClient.rooms.getRooms();
      const target = rooms.find((room) => {
        const roomNameMatch =
          room.name?.toLowerCase() === roomDisplayName.toLowerCase();
        const voiceMatch =
          (room.voiceId && roomId && String(room.voiceId) === String(roomId)) ||
          (room.voiceId &&
            activeRoomId &&
            String(room.voiceId) === String(activeRoomId));
        return roomNameMatch || voiceMatch;
      });

      if (!target) {
        console.warn("Oda bilgisi bulunamadı");
        setChatBackground(
          resolveEffectiveChatBackground(null, { includeFallback: true }),
        );
        return;
      }

      setRoomDetail(target);
      const detail = await apiClient.rooms.getRoom(target.id);
      setRoomDetail(detail);
    } catch (error) {
      console.error("Oda detayları alınamadı", error);
      setChatBackground(
        resolveEffectiveChatBackground(null, { includeFallback: true }),
      );
    }
  }, [roomDisplayName, roomId, activeRoomId, resolveEffectiveChatBackground]);

  useEffect(() => {
    fetchRoomDetail();
  }, [fetchRoomDetail]);

  useEffect(() => {
    const normalizedCurrentUsername = (currentUsername || "")
      .trim()
      .toLocaleLowerCase("tr-TR");
    if (!normalizedCurrentUsername || roomUsers.length === 0) {
      return;
    }

    const selfRoomUser = roomUsers.find(
      (user) =>
        (user.username || "").trim().toLocaleLowerCase("tr-TR") ===
        normalizedCurrentUsername,
    );

    if (!selfRoomUser || !selfRoomUser.statusModeName) {
      return;
    }

    const isRoofStatus = selfRoomUser.statusModeName === "Çatıda";

    setIsOnRoof((prev) => (prev === isRoofStatus ? prev : isRoofStatus));
    localStorage.setItem("roofStatus", isRoofStatus ? "true" : "false");
    localStorage.setItem("statusModeName", selfRoomUser.statusModeName);

    if (
      typeof selfRoomUser.statusModeId === "number" &&
      Number.isFinite(selfRoomUser.statusModeId)
    ) {
      localStorage.setItem("statusModeId", String(selfRoomUser.statusModeId));
    }
  }, [currentUsername, roomUsers]);

  useEffect(() => {
    const handleStatusModeUpdated = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          statusModeId?: number | null;
          statusModeName?: string | null;
          skipSocketEmit?: boolean;
        }>
      ).detail;
      if (!detail) return;

      const username =
        localStorage.getItem("isGuest") === "true"
          ? localStorage.getItem("guestUsername")
          : localStorage.getItem("username");
      if (!username) return;

      if (detail.statusModeName === "Çatıda" && !canUseRoofMode) {
        setIsOnRoof(false);
        localStorage.setItem("roofStatus", "false");
        localStorage.setItem("statusModeName", "Çevrimiçi");
        toast.error("Çatıya geçiş yetkiniz yok.");
        return;
      }

      // Çatıda durumunu güncelle ve localStorage'a kaydet
      if (detail.statusModeName === "Çatıda") {
        setIsOnRoof(true);
        localStorage.setItem("roofStatus", "true");
      } else {
        setIsOnRoof(false);
        localStorage.setItem("roofStatus", "false");
      }
      if (detail.statusModeName) {
        localStorage.setItem("statusModeName", detail.statusModeName);
      }

      setRoomUsers((prev) =>
        prev.map((user) =>
          user.username === username
            ? {
                ...user,
                statusModeId: detail.statusModeId ?? null,
                statusModeName: detail.statusModeName ?? null,
              }
            : user,
        ),
      );

      if (detail.skipSocketEmit === true) return;
      if (!socket || !socket.connected) return;

      const storedJoinEffect =
        typeof window !== "undefined"
          ? localStorage.getItem("profileJoinEffect")
          : null;
      const normalizedJoinEffect =
        storedJoinEffect && isJoinEffectId(storedJoinEffect)
          ? storedJoinEffect
          : undefined;

      const roomCandidates = Array.from(
        new Set(
          [activeRoomId, roomId, roomDisplayName]
            .map((value) => (typeof value === "string" ? value.trim() : ""))
            .filter((value): value is string => value.length > 0),
        ),
      );

      const tryStatusModeUpdate = (index: number) => {
        const targetRoom = roomCandidates[index];
        if (!targetRoom) {
          console.error("Durum güncellemesi için geçerli oda bulunamadı", {
            username,
            detail,
            roomCandidates,
          });
          return;
        }

        socket.emit(
          "statusMode:update",
          {
            room: targetRoom,
            username,
            statusModeId: detail.statusModeId ?? undefined,
            statusModeName: detail.statusModeName ?? undefined,
            joinEffect: normalizedJoinEffect,
          },
          (response?: { status?: string; message?: string }) => {
            if (response?.status !== "ok") {
              const shouldRetry =
                response?.message === "not_in_room" &&
                index < roomCandidates.length - 1;
              if (shouldRetry) {
                tryStatusModeUpdate(index + 1);
                return;
              }

              console.warn("Durum güncellemesi reddedildi", {
                room: targetRoom,
                username,
                response,
              });
              return;
            }


          },
        );
      };

      tryStatusModeUpdate(0);
    };

    window.addEventListener(
      "statusModeUpdated",
      handleStatusModeUpdated as EventListener,
    );

    return () => {
      window.removeEventListener(
        "statusModeUpdated",
        handleStatusModeUpdated as EventListener,
      );
    };
  }, [socket, activeRoomId, roomId, roomDisplayName, canUseRoofMode]);

  // Font/Granite güncelleme event'ini dinle ve socket'e gönder
  useEffect(() => {
    if (!socket) return;

    const handleUserStyleUpdated = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      const currentUsername =
        localStorage.getItem("isGuest") === "true"
          ? localStorage.getItem("guestUsername")
          : localStorage.getItem("username");
      const currentAgentNickname = localStorage.getItem("agentNickname") || null;

      const normalizedSelf = currentUsername?.trim().toLowerCase();
      if (!normalizedSelf) return;
      if (currentAgentNickname) {
        return;
      }
      const hasNonFlashNickStyleChange =
        detail.fontName !== undefined ||
        detail.granite !== undefined ||
        detail.nickColor !== undefined ||
        detail.userGif !== undefined;
      const hasFlashNickChange = detail.flashNick !== undefined;

      if (hasNonFlashNickStyleChange) {
        socket.emit("userStyleUpdate", {
          room: activeRoomId || roomDisplayName,
          username: currentUsername,
          fontName:
            detail.fontName !== undefined ? detail.fontName : undefined,
          granite:
            detail.granite !== undefined ? detail.granite : undefined,
          nickColor:
            detail.nickColor !== undefined ? detail.nickColor : undefined,
          userGif:
            detail.userGif !== undefined ? detail.userGif : undefined,
          flashNick:
            detail.flashNick !== undefined ? detail.flashNick : undefined,
        });
      }

      if (hasFlashNickChange) {
        socket.emit("flashNick:update", {
          room: activeRoomId || roomDisplayName,
          username: currentUsername,
          flashNick: detail.flashNick,
        });
      }

      // Backend'den broadcast dönene kadar local state'i güncelle
      setRoomUsers((prev) =>
        prev.map((user) => {
          if (!currentUsername) return user;
          const normalizedU = user.username.trim().toLowerCase();
          const normalizedSelf = currentUsername.trim().toLowerCase();
          return normalizedU === normalizedSelf
            ? {
                ...user,
                fontName: detail.fontName !== undefined ? detail.fontName : user.fontName,
                granite: detail.granite !== undefined ? detail.granite : user.granite,
                nickColor: detail.nickColor !== undefined ? detail.nickColor : user.nickColor,
                userGif: detail.userGif !== undefined ? detail.userGif : user.userGif,
                flashNick: detail.flashNick !== undefined ? detail.flashNick : user.flashNick,
              }
            : user;
        }),
      );

    };

    window.addEventListener(
      "userStyleUpdated",
      handleUserStyleUpdated as EventListener,
    );

    return () => {
      window.removeEventListener(
        "userStyleUpdated",
        handleUserStyleUpdated as EventListener,
      );
    };
  }, [socket, activeRoomId, roomDisplayName]);

  const moderationMuted = roomMuted || globalMuted;
  const moderationMutedReason = `${
    mutedRoomName || roomDisplayName
  } odasında susturuldunuz`;
  const isGuestUser = isGuestSessionFromStorage();
  const guestWriteDisabledBySystem =
    isGuestUser && communicationPermissions?.guestCanWrite === false;
  const guestWaitWriteBlocked = isGuestUser && guestWaitRemaining > 0;
  const effectiveMicDisabled = moderationMuted ? true : micDisabled;
  const effectiveMicDisabledReason = moderationMuted
    ? moderationMutedReason
    : micDisabledReason;
  const effectiveWritingDisabled = moderationMuted
    ? true
    : writingDisabled ||
      isInitialRoofResolving ||
      guestWriteDisabledBySystem ||
      guestWaitWriteBlocked;
  const effectiveWritingDisabledReason = moderationMuted
    ? moderationMutedReason
    : isInitialRoofResolving
      ? null
    : guestWriteDisabledBySystem
      ? "Misafirler için mesaj gönderme kapalı."
      : guestWaitWriteBlocked
        ? `Misafir bekleme süresi: ${guestWaitRemaining} sn`
      : writingDisabledReason;

  return (
    <>
      {activeGlobalAnnouncement ? (
        <div className="pointer-events-none fixed inset-x-3 top-3 z-[160] flex justify-center md:top-[104px]">
          <div className="pointer-events-auto relative w-full max-w-[860px] overflow-hidden rounded-[22px] border-2 border-fuchsia-300/40 bg-[linear-gradient(105deg,rgba(34,8,67,0.98),rgba(14,42,74,0.98),rgba(8,73,72,0.98))] px-4 py-3.5 shadow-[0_20px_60px_rgba(0,0,0,0.44),0_0_42px_rgba(168,85,247,0.18)] backdrop-blur-xl">
            <div className="absolute inset-y-0 -left-1/3 w-1/3 animate-[pulse_2s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <div className="relative flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-fuchsia-200/35 bg-fuchsia-300/12 text-fuchsia-100 shadow-[0_0_24px_rgba(217,70,239,0.20)]">
                <Megaphone className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[9px] font-black uppercase tracking-[0.24em] text-cyan-200/85">ChatsON Duyurusu</div>
                <div className="mt-0.5 text-sm font-black leading-5 text-white sm:text-[15px]">{activeGlobalAnnouncement.message}</div>
              </div>
              <button
                type="button"
                onClick={() => setActiveGlobalAnnouncement(null)}
                className="pointer-events-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                aria-label="Duyuruyu kapat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <VoiceChatProvider
        socket={socket}
        roomName={roomId}
        currentUsername={currentUsername}
        initialMicBanned={initialMicBanned}
        initialGlobalMuted={globalMuted}
      >
        <CallVoiceProvider>
          <ChatPageContent
            socket={socket}
            roomName={roomDisplayName}
            roomId={roomId}
            roomUsers={roomUsers}
            setRoomUsers={setRoomUsers}
            messages={messages}
            setMessages={setMessages}
            joinError={joinError}
            currentUsername={currentUsername}
            userStarCount={userStarCount}
            currentUserRoleReady={currentUserRoleReady}
            currentUserRoleSnapshot={currentUserRoleSnapshot}
            forbiddenWords={forbiddenWords}
            chatBackground={chatBackground}
            chatFontSize={chatFontSize}
            chatFontColor={chatFontColor}
            roomDetail={roomDetail}
            ownerAvatar={ownerAvatar}
            onToggleHand={handleToggleHand}
            isHandRaised={isCurrentUserHandRaised}
            onGoMeetingRoom={goToMeetingRoom}
            firstMessageDelayRemaining={firstMessageDelayRemaining}
            chatPermissions={chatPermissions}
            communicationPermissions={communicationPermissions}
            currentUserPermissions={currentUserPermissions}
            currentRolePermissions={currentRolePermissions}
            micDisabled={effectiveMicDisabled}
            micDisabledReason={effectiveMicDisabledReason}
            micWaitRemainingSeconds={micWaitRemainingSeconds}
            initialCameraBanned={initialCameraBanned}
            writingDisabled={effectiveWritingDisabled}
            writingDisabledReason={effectiveWritingDisabledReason}
            radioLink={radioSettings?.radioLink ?? null}
            radioRequestLink={radioSettings?.radioRequestLink ?? null}
            isOnRoof={isOnRoof}
            currentUserIcon={currentUserIcon}
            currentUserGender={userGender}
            addSystemMessage={addSystemMessage}
            onMessageSent={handleMessageSent}
            onForbiddenWordsChange={setForbiddenWords}
            onTriggerJoinEffect={triggerRemoteJoinEffect}
            activeJoinEffect={activeJoinEffect}
            showJoinLeaveEventsEnabled={showJoinLeaveEventsEnabled}
            hideGeneralMessagesEnabled={hideGeneralMessagesEnabled}
            disableJoinEffectsEnabled={disableJoinEffectsEnabled}
            isMobileJoinEffectMode={isMobileJoinEffectMode}
            welcomeMessageTemplate={welcomeMessageTemplate}
            canAccessMeetingRoom={canAccessMeetingRoom}
          />
        </CallVoiceProvider>
      </VoiceChatProvider>

      {systemResetCountdown !== null && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/90 px-6 text-white backdrop-blur-sm">
          <div className="flex flex-col items-center gap-5 text-center">
            <div className="flex h-28 w-28 items-center justify-center rounded-full border-4 border-red-400 bg-red-500/20 text-5xl font-bold shadow-[0_0_40px_rgba(248,113,113,0.35)]">
              {systemResetCountdown}
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold sm:text-3xl">
                {systemResetMessage}
              </h1>
              <p className="text-sm font-medium text-slate-200 sm:text-base">
                Lütfen bekleyin, oturumunuz güvenli şekilde kapatılacak.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
