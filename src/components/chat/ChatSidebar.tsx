"use client";

import {
  memo,
  type MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { SidebarNav } from "./SidebarNav";
import {
  Mars,
  Venus,
  MessageSquare,
  Monitor,
  PhoneIncoming,
  PhoneMissed,
  PhoneOutgoing,
  Smartphone,
  UserRound,
  Heart,
  Wifi,
  Hand,
  X,
  Phone,
  Video,
  EyeOff,
  Eye,
  Ban,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Mic,
  MicOff,
  VideoOff,
  Star,
  Lock,
  Trash2,
  Home,
  ArrowLeft,
  Camera,
  Send,
} from "lucide-react";
import { apiClient } from "@/services/apiClient";
import { WallPostModal } from "./WallPostModal";
import { DirectMessagesModal } from "./DirectMessagesModal";
import { RegisterModal } from "../auth/RegisterModal";
import type {
  WallPost,
  WallPostComment,
  WallPostView,
} from "@/services/wallPostsService";
import { Room } from "@/services/roomService";
import { type FriendRelationState, type FriendRequest } from "@/services/friendsService";
import { io, Socket } from "socket.io-client";
import { Room as LiveKitRoom, RoomEvent, Track } from "livekit-client";
import { formatRoleLabel } from "@/lib/roleLabels";
import { getClientApiClient } from "@/lib/api/clientApi";
import { env } from "@/config/env";
import { resolveAvatarUrl } from "@/lib/avatarUrl";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { toast } from "sonner";
import { ApiError, toApiError } from "@/lib/api/errors";
import type { ProfileComment } from "@/services/profileCommentsService";
import {
  readChatPreferencesFromStorage,
  writeChatPreferencesToStorage,
} from "@/lib/chatPreferences";
import { setRoomNavigationIntent } from "@/lib/chatNavigation";
import { getChatFontFamily, getChatFontSize } from "@/lib/chatFonts";
import { formatAgentDisplayName } from "@/lib/agentDisplay";
import type { ChatPermissionsSettings } from "@/services/systemSettingsService";
import {
  hasEffectivePermission,
  PERMISSION_LABELS,
} from "@/lib/permissions";
import { isJoinEffectId, type JoinEffectId } from "@/lib/joinEffects";
import { playFriendRequestSound } from "@/lib/notificationSounds";

const ACTION_NOT_ALLOWED_MESSAGE = "Bu işlemi yapmaya hakkınız yok.";

// Emoji code point'lerini Twemoji URL'ine çevir
const getEmojiCodePoint = (emoji: string): string => {
  const codePoints: string[] = [];
  for (const char of emoji) {
    const cp = char.codePointAt(0);
    if (cp && cp !== 0xfe0f) {
      codePoints.push(cp.toString(16));
    }
  }
  return codePoints.join("-");
};

// Rol bilgilerini render et (emoji destekli)
const renderEmojiAsImages = (text: string) => {
  if (!text) return null;

  // Emoji regex pattern
  const emojiRegex = /(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)/gu;
  const parts = text.split(emojiRegex);

  if (parts.length === 1 && !emojiRegex.test(text)) {
    return <span className="role-icon-symbol">{text}</span>;
  }

  return (
    <>
      {parts.map((part, idx) => {
        if (!part) return null;

        // Reset regex lastIndex
        emojiRegex.lastIndex = 0;

        if (emojiRegex.test(part)) {
          const codePoint = getEmojiCodePoint(part);
          return (
            <img
              key={idx}
              src={`https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/${codePoint}.png`}
              alt={part}
              className="inline-block w-4 h-4 align-middle"
              draggable={false}
            />
          );
        }
        return <span key={idx}>{part}</span>;
      })}
    </>
  );
};

export type RoomUser = {
  id: string;
  socketId?: string | null;
  loginHistoryId?: number | null;
  username: string;
  displayUsername?: string;
  gender: "male" | "female";
  isGuest: boolean;
  guest?: boolean;
  guestAlias?: string | null;
  guestAliasReleased?: boolean | null;
  statusModeName?: string | null;
  statusModeId?: number | null;
  isInVoiceChat?: boolean;
  isMuted?: boolean;
  isCameraOn?: boolean;
  frame?: string | null;
  icon?: string | null;
  roleName?: string | null;
  roleIcon?: string | null;
  roleStarColor?: string | null;
  roleStarCount?: number | null;
  role?: {
    name?: string | null;
    icon?: string | null;
    starCount?: number | null;
    star_count?: number | null;
    starColor?: string | null;
    star_color?: string | null;
  } | null;
  role_title?: string | null;
  roleStar?: number | null;
  role_star_count?: number | null;
  role_star?: number | null;
  role_star_color?: string | null;
  deviceType?: string | null;
  device?: string | null;
  clientType?: string | null;
  isBot?: boolean;
  isAI?: boolean;
  isHandRaised?: boolean;
  handRaisedAt?: number | null;
  agentNickname?: string | null;
  rooms?: Array<{ roomKey: string; roomName: string }>;
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
};

type SocketAck = {
  status?: "ok" | "error";
  code?: string;
  message?: string;
  data?: unknown;
};

type ApiErrorLike = {
  response?: {
    data?: {
      message?: string;
    };
  };
  message?: string;
};

type NickStyleData = {
  nick_raw: string;
  nick_style: string;
};

type TenantRoomSummary = {
  roomKey?: string | null;
  roomName?: string | null;
};

type TenantRawUser = Partial<
  Omit<RoomUser, "id" | "gender" | "rooms">
> & {
  socketId?: string | null;
  username: string;
  gender: "male" | "female";
  guest?: boolean;
  rooms?: TenantRoomSummary[];
  frame?: string | null;
  icon?: string | null;
};

type BotMutePreference = {
  botId: number;
  username?: string;
  roomKey: string | null;
  muted: boolean;
  scope: "room" | "global";
};

const getRoomUserBotNumericId = (user?: Partial<RoomUser> | null): number | null => {
  if (!user) return null;
  const candidates = [user.socketId, user.id];
  for (const candidate of candidates) {
    const rawId = String(candidate || "");
    const match = rawId.match(/^bot_(\d+)$/);
    if (!match) continue;
    const numericId = Number(match[1]);
    if (Number.isFinite(numericId)) {
      return numericId;
    }
  }
  return null;
};

type RoleFieldPatch = {
  roleName?: string | null;
  roleIcon?: string | null;
  roleStarCount?: number | null;
  roleStarColor?: string | null;
};

type RoleBadgeViewProps =
  | {
      variant: "icon";
      text: string;
      color: string | null;
    }
  | {
      variant: "stars";
      starCount: number;
      color: string;
    }
  | {
      variant: "text";
      text: string;
    };

const ROLE_UPDATE_GRACE_MS = 800;
const SELF_PRESENCE_GRACE_MS = 6000;
const ROLE_PATCH_STORAGE_KEY = "kingmobile:sidebarRolePatches:v1";
const ROLE_PATCH_STORAGE_TTL_MS = 30 * 60 * 1000;

const RoleBadgeView = memo(function RoleBadgeView(
  props: RoleBadgeViewProps,
) {
  return (
    <span className="inline-flex max-w-full flex-wrap items-center gap-1 break-words text-sm text-zinc-500">
      {props.variant === "icon" ? (
        <span
          className="font-semibold inline-flex items-center"
          style={props.color ? { color: props.color } : undefined}
        >
          {renderEmojiAsImages(props.text)}
        </span>
      ) : props.variant === "stars" ? (
        <span
          className={`inline-flex items-center ${
            props.starCount >= 14 && props.starCount <= 16 ? "gap-0" : "gap-px"
          }`}
        >
          {Array.from({ length: props.starCount }).map((_, idx) => (
            <Star
              key={idx}
              className={
                props.starCount >= 14 && props.starCount <= 16
                  ? "h-[9px] w-[9px]"
                  : "h-2.5 w-2.5"
              }
              style={{ color: props.color }}
              fill="currentColor"
            />
          ))}
        </span>
      ) : (
        props.text
      )}
    </span>
  );
});

const normalizeUsername = (value?: string | null) =>
  (value || "").trim().toLowerCase();

const toFriendRequestIdSet = (requests: FriendRequest[]) =>
  new Set(requests.map((request) => request.id));

const isRootUsername = (value?: string | null) =>
  normalizeUsername(value) === "root";

const isPresencePlaceholderUser = (user?: Pick<RoomUser, "id"> | null) =>
  typeof user?.id === "string" && user.id.startsWith("presence:");

type StoredRolePatch = {
  patch: RoleFieldPatch;
  updatedAt: number;
};

const normalizeStoredRolePatch = (
  patch?: RoleFieldPatch | null,
): RoleFieldPatch => ({
  roleName: patch?.roleName ?? null,
  roleIcon: patch?.roleIcon ?? null,
  roleStarCount: patch?.roleStarCount ?? null,
  roleStarColor: patch?.roleStarColor ?? null,
});

const readStoredRolePatches = (): Record<string, StoredRolePatch> => {
  if (typeof window === "undefined") return {};

  try {
    const rawValue = window.localStorage.getItem(ROLE_PATCH_STORAGE_KEY);
    if (!rawValue) return {};
    const parsed = JSON.parse(rawValue);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const writeStoredRolePatches = (
  patches: Record<string, StoredRolePatch>,
) => {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      ROLE_PATCH_STORAGE_KEY,
      JSON.stringify(patches),
    );
  } catch {
    // Storage can be unavailable in private mode; in-memory cache still works.
  }
};

const getStoredRolePatch = (username?: string | null): RoleFieldPatch | null => {
  const normalized = normalizeUsername(username);
  if (!normalized) return null;

  const patches = readStoredRolePatches();
  const stored = patches[normalized];
  if (!stored) return null;

  if (Date.now() - stored.updatedAt > ROLE_PATCH_STORAGE_TTL_MS) {
    delete patches[normalized];
    writeStoredRolePatches(patches);
    return null;
  }

  return normalizeStoredRolePatch(stored.patch);
};

const setStoredRolePatch = (
  username?: string | null,
  patch?: RoleFieldPatch | null,
) => {
  const normalized = normalizeUsername(username);
  if (!normalized) return;

  const patches = readStoredRolePatches();
  patches[normalized] = {
    patch: normalizeStoredRolePatch(patch),
    updatedAt: Date.now(),
  };
  writeStoredRolePatches(patches);
};

const getUserRenderKey = (user: Pick<RoomUser, "username" | "id">) =>
  normalizeUsername(user.username) || user.id;

const areRoomListsEqual = (
  left?: Array<{ roomKey: string; roomName: string }>,
  right?: Array<{ roomKey: string; roomName: string }>,
) => {
  const leftList = Array.isArray(left) ? left : [];
  const rightList = Array.isArray(right) ? right : [];

  if (leftList.length !== rightList.length) return false;

  return leftList.every((room, index) => {
    const candidate = rightList[index];
    return (
      candidate?.roomKey === room.roomKey &&
      candidate?.roomName === room.roomName
    );
  });
};

const areRoomUsersEquivalent = (left: RoomUser, right: RoomUser) =>
  left.id === right.id &&
  (left.socketId ?? null) === (right.socketId ?? null) &&
  left.username === right.username &&
  left.displayUsername === right.displayUsername &&
  left.gender === right.gender &&
  left.isGuest === right.isGuest &&
  left.statusModeName === right.statusModeName &&
  (left.statusModeId ?? null) === (right.statusModeId ?? null) &&
  (left.isInVoiceChat ?? false) === (right.isInVoiceChat ?? false) &&
  (left.isMuted ?? false) === (right.isMuted ?? false) &&
  (left.isCameraOn ?? false) === (right.isCameraOn ?? false) &&
  (left.frame ?? null) === (right.frame ?? null) &&
  (left.icon ?? null) === (right.icon ?? null) &&
  (left.roleName ?? null) === (right.roleName ?? null) &&
  (left.roleIcon ?? null) === (right.roleIcon ?? null) &&
  (left.roleStarColor ?? null) === (right.roleStarColor ?? null) &&
  (left.roleStarCount ?? null) === (right.roleStarCount ?? null) &&
  (left.deviceType ?? null) === (right.deviceType ?? null) &&
  (left.device ?? null) === (right.device ?? null) &&
  (left.clientType ?? null) === (right.clientType ?? null) &&
  (left.isHandRaised ?? false) === (right.isHandRaised ?? false) &&
  (left.handRaisedAt ?? null) === (right.handRaisedAt ?? null) &&
  (left.agentNickname ?? null) === (right.agentNickname ?? null) &&
  (left.fontName ?? null) === (right.fontName ?? null) &&
  (left.granite ?? null) === (right.granite ?? null) &&
  (left.nickColor ?? null) === (right.nickColor ?? null) &&
  (left.userGif ?? null) === (right.userGif ?? null) &&
  (left.flashNick ?? null) === (right.flashNick ?? null) &&
  (left.joinEffect ?? null) === (right.joinEffect ?? null) &&
  (left.micBanned ?? false) === (right.micBanned ?? false) &&
  (left.micBannedByStarCount ?? null) ===
    (right.micBannedByStarCount ?? null) &&
  (left.cameraBanned ?? false) === (right.cameraBanned ?? false) &&
  (left.cameraBannedByStarCount ?? null) ===
    (right.cameraBannedByStarCount ?? null) &&
  (left.roomMuted ?? false) === (right.roomMuted ?? false) &&
  (left.roomMutedByStarCount ?? null) ===
    (right.roomMutedByStarCount ?? null) &&
  (left.globalMuted ?? false) === (right.globalMuted ?? false) &&
  (left.globalMutedByStarCount ?? null) ===
    (right.globalMutedByStarCount ?? null) &&
  areRoomListsEqual(left.rooms, right.rooms);

const normalizeRoleValue = (value?: string | null) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeRoleLookupKey = (value?: string | null) =>
  (value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const buildRolePatch = (user?: Partial<RoomUser> | null): RoleFieldPatch => ({
  roleName:
    user?.roleName !== undefined ? normalizeRoleValue(user.roleName) : undefined,
  roleIcon:
    user?.roleIcon !== undefined ? normalizeRoleValue(user.roleIcon) : undefined,
  roleStarCount:
    user?.roleStarCount !== undefined ? user.roleStarCount ?? null : undefined,
  roleStarColor:
    user?.roleStarColor !== undefined
      ? normalizeRoleValue(user.roleStarColor)
      : undefined,
});

const isNonEmptyRoleValue = (value: string | number | null | undefined) =>
  value !== undefined &&
  value !== null &&
  (typeof value !== "string" || value.trim().length > 0);

const mergeRoleFields = (
  baseUser: RoomUser,
  incoming: RoleFieldPatch,
  options?: {
    allowExplicitClear?: boolean;
    pendingPatch?: RoleFieldPatch | null;
  },
): RoleFieldPatch => {
  const pendingPatch = options?.pendingPatch ?? null;
  const allowExplicitClear = options?.allowExplicitClear === true;

  const resolveField = <K extends keyof RoleFieldPatch>(field: K) => {
    const incomingValue = incoming[field];
    const pendingValue = pendingPatch?.[field];
    const baseValue = baseUser[field] ?? null;

    if (incomingValue !== undefined) {
      if (isNonEmptyRoleValue(incomingValue)) {
        return incomingValue;
      }

      if (allowExplicitClear) {
        return null;
      }

      if (pendingValue !== undefined) {
        return pendingValue ?? baseValue;
      }

      return baseValue;
    }

    if (pendingValue !== undefined) {
      return pendingValue;
    }

    return baseValue;
  };

  return {
    roleName: resolveField("roleName"),
    roleIcon: resolveField("roleIcon"),
    roleStarCount: resolveField("roleStarCount"),
    roleStarColor: resolveField("roleStarColor"),
  };
};

const reconcileTenantUsers = (prev: RoomUser[], next: RoomUser[]) => {
  const prevByKey = new Map<string, RoomUser>();
  prev.forEach((user) => {
    prevByKey.set(getUserRenderKey(user), user);
  });

  let changed = prev.length !== next.length;

  const reconciled = next.map((user, index) => {
    const existing = prevByKey.get(getUserRenderKey(user));
    if (!existing) {
      changed = true;
      return user;
    }

    if (!changed && prev[index] !== existing) {
      changed = true;
    }

    if (areRoomUsersEquivalent(existing, user)) {
      return existing;
    }

    changed = true;
    return {
      ...existing,
      ...user,
    };
  });

  return changed ? reconciled : prev;
};

type RoomCountsEvent =
  | Array<{ room: string; count: number }>
  | Record<string, number>;

export type FriendActivityEvent = {
  type: "friend_online" | "friend_offline" | "friend_room_changed";
  username: string;
  rawUsername?: string;
  wasOnRoof?: boolean;
  fromRoomName?: string | null;
  toRoomName?: string | null;
  timestamp: string;
};

export type TenantJoinEffectEvent = {
  username: string;
  gender: "male" | "female";
  isGuest: boolean;
  icon?: string | null;
  roleIcon?: string | null;
  roleStarColor?: string | null;
  roleStarCount?: number | null;
  agentNickname?: string | null;
  joinEffect: JoinEffectId;
};

type RoomInviteReceivedPayload = {
  inviteId: string;
  fromUsername: string;
  roomName: string;
};

type RoomInviteResultPayload = {
  status: "sent" | "accepted" | "rejected" | "error";
  code?: string;
  targetUsername?: string;
  roomName?: string;
  inviteId?: string;
};

type ModerationUserInfoData = {
  username: string;
  roleName: string;
  roleStarCount: number;
  statusModeName?: string | null;
  ipAddress: string;
};

type ModerationWarnPayload = {
  fromUsername: string;
  message: string;
  createdAt: number;
};

type ModerationMicInviteReceivedPayload = {
  inviteId: string;
  fromUsername: string;
  room: string;
  roomName?: string;
};

type ModerationMicInviteResultPayload = {
  status: "sent" | "accepted" | "rejected" | "error";
  code?: string;
  inviteId?: string;
  targetUsername?: string;
};

type RoleCatalogItem = {
  id: number;
  name: string;
  microphoneDuration: number;
  starColor: string | null;
  starCount: number | null;
  icon: string | null;
};

type ChatSidebarProps = {
  users: RoomUser[];
  onBotUserPatch?: (username: string, patch: Partial<RoomUser>) => void;
  onCountsChange?: (counts: { roomUsersCount: number; allUsersCount: number }) => void;
  onActiveTenantUsersChange?: (users: RoomUser[]) => void;
  hideRoomsNavButton?: boolean;
  defaultTab?: "room" | "all" | "rooms" | "calls" | "friends" | "wall";
  forceVisible?: boolean;
  mobileRoomOnly?: boolean;
  mobileAllUsersFullscreen?: boolean;
  mobileRoomsFullscreen?: boolean;
  onMobileRoomClose?: () => void;
  currentUserStarCount?: number;
  currentUserIsGuest?: boolean;
  currentUserRoleReady?: boolean;
  currentUserRoleSnapshot?: RoleFieldPatch | null;
  currentUserPermissions?: string[];
  currentRolePermissions?: Record<string, unknown> | null;
  speakingUsers?: Set<string>;
  socket?: Socket | null;
  currentRoomId?: string | null;
  currentRoomName?: string | null;
  profileOpenRequest?: {
    username: string;
    id: number;
    fallbackUser?: RoomUser | null;
  } | null;
  onProfileOpenHandled?: () => void;
  initialSelectedUser?: RoomUser | null;
  closeMobileRoomOnProfileClose?: boolean;
  onStartVoiceCall?: (user: {
    username: string;
    displayUsername?: string;
    gender: "male" | "female";
    icon?: string | null;
    roleName?: string | null;
    isGuest?: boolean;
    agentNickname?: string | null;
    roleStarCount?: number | null;
  }) => void;
  onStartVideoCall?: (user: {
    username: string;
    displayUsername?: string;
    gender: "male" | "female";
    icon?: string | null;
    roleName?: string | null;
    isGuest?: boolean;
    agentNickname?: string | null;
    roleStarCount?: number | null;
  }) => void;
  onFriendActivity?: (event: FriendActivityEvent) => void;
  onTenantJoinEffect?: (event: TenantJoinEffectEvent) => void;
  communicationPermissions?: {
    membersPrivateMessageEnabled: boolean;
    membersVoiceCallEnabled: boolean;
    guestPrivateMessageEnabled: boolean;
    guestVoiceCallEnabled: boolean;
  } | null;
  chatPermissions?: ChatPermissionsSettings | null;
  onMicInviteAccepted?: (payload: {
    fromUsername: string;
    room: string;
    roomName?: string;
  }) => void | Promise<void>;
  callHistory?: Array<{
    id: number;
    callId: string;
    peerName: string;
    direction: "incoming" | "outgoing";
    status: "missed" | "completed" | "rejected" | "canceled";
    startedAt: number;
    endedAt?: number;
    durationSec?: number;
  }>;
  onDeleteCallHistory?: (id: number) => void | Promise<void>;
};

const TEMP_OPERATOR_STAR_COLOR = "#000000";
const LIVEKIT_URL =
  process.env.NEXT_PUBLIC_LIVEKIT_URL || "ws://localhost:7880";

const fetchLivekitToken = async (
  room: string,
  canPublish = true,
): Promise<string> => {
  const api = getClientApiClient();
  const params = new URLSearchParams({ room, canPublish: String(canPublish) });
  const res = await api.get<{ token: string }>(
    `/rooms/livekit-token?${params}`,
  );
  return res.data.token;
};
const tempOperatorUsers = new Set<string>();
const normalizeTempOperatorUsername = (value?: string | null) =>
  (value || "").trim().toLowerCase();
const isTempOperator = (username?: string | null) =>
  tempOperatorUsers.has(normalizeTempOperatorUsername(username));
const shouldShowGuestBadge = (user?: {
  isGuest?: boolean;
  agentNickname?: string | null;
  isBot?: boolean;
  username?: string;
}) => {
  if (!user) return false;
  if (user.isBot) return false;
  return Boolean((user.isGuest || user.agentNickname) && !isTempOperator(user.username));
};

export const ChatSidebar = ({
  users = [],
  onBotUserPatch,
  onCountsChange,
  onActiveTenantUsersChange,
  hideRoomsNavButton = false,
  defaultTab,
  forceVisible = false,
  mobileRoomOnly = false,
  mobileAllUsersFullscreen = false,
  mobileRoomsFullscreen = false,
  onMobileRoomClose,
  currentUserStarCount = 0,
  currentUserIsGuest = false,
  currentUserRoleReady = true,
  currentUserRoleSnapshot = null,
  currentUserPermissions = [],
  currentRolePermissions = null,
  speakingUsers = new Set(),
  socket,
  currentRoomId,
  currentRoomName,
  profileOpenRequest,
  onProfileOpenHandled,
  initialSelectedUser,
  closeMobileRoomOnProfileClose = false,
  onStartVoiceCall,
  onStartVideoCall,
  onFriendActivity,
  onTenantJoinEffect,
  communicationPermissions,
  chatPermissions,
  onMicInviteAccepted,
  callHistory = [],
  onDeleteCallHistory,
}: ChatSidebarProps) => {
  // Mevcut kullanıcı adını al
  const storedGuestUsername =
    typeof window !== "undefined"
      ? (localStorage.getItem("guestUsername") || "").trim()
      : "";
  const isGuestUser =
    typeof window !== "undefined"
      ? currentUserIsGuest ||
        localStorage.getItem("isGuest") === "true" ||
        !!storedGuestUsername
      : false;
  const currentUsername =
    typeof window !== "undefined"
      ? isGuestUser
        ? storedGuestUsername || localStorage.getItem("guestUsername")
        : localStorage.getItem("username")
      : null;
  const currentUserId =
    typeof window !== "undefined"
      ? Number(localStorage.getItem("userId")) || null
      : null;
  const storedAgentNickname =
    typeof window !== "undefined"
      ? (localStorage.getItem("agentNickname") || "").trim()
      : "";
  const currentUserAgentNickname =
    users.find((u) => u.username === currentUsername)?.agentNickname?.trim() ||
    "";
  const effectiveAgentNickname =
    storedAgentNickname || currentUserAgentNickname;
  const isAgentLogin = !!effectiveAgentNickname;
  const canCurrentUserPrivateMessage = isGuestUser
    ? communicationPermissions?.guestPrivateMessageEnabled !== false
    : communicationPermissions?.membersPrivateMessageEnabled !== false;
  const shouldBlockGuestPrivateMessages =
    isGuestUser && !canCurrentUserPrivateMessage;
  const canModerateMicrophone = hasEffectivePermission({
    permissionLabel: PERMISSION_LABELS.MICROPHONE_MODERATION,
    userPermissions: currentUserPermissions,
    rolePermissions: currentRolePermissions,
  });
  const canModerateCamera = hasEffectivePermission({
    permissionLabel: PERMISSION_LABELS.CAMERA_MODERATION,
    userPermissions: currentUserPermissions,
    rolePermissions: currentRolePermissions,
  });
  const canInviteMicrophone = hasEffectivePermission({
    permissionLabel: PERMISSION_LABELS.MICROPHONE_INVITE,
    userPermissions: currentUserPermissions,
    rolePermissions: currentRolePermissions,
  });
  const canGrantTempOperator = hasEffectivePermission({
    permissionLabel: PERMISSION_LABELS.TEMP_OPERATOR_GRANT,
    userPermissions: currentUserPermissions,
    rolePermissions: currentRolePermissions,
  });
  const canDeleteStories = hasEffectivePermission({
    permissionLabel: PERMISSION_LABELS.STORY_DELETE,
    userPermissions: currentUserPermissions,
    rolePermissions: currentRolePermissions,
  });
  const canDeleteWallUserContent = (targetStarCount: number | null | undefined) => {
    const normalizedUsername = String(currentUsername || "")
      .trim()
      .toLocaleLowerCase("tr-TR");
    if (normalizedUsername === "root") return true;
    return canDeleteStories && currentUserStarCount > Number(targetStarCount || 0);
  };
  const canKickFromSite = hasEffectivePermission({
    permissionLabel: PERMISSION_LABELS.SITE_KICK,
    userPermissions: currentUserPermissions,
    rolePermissions: currentRolePermissions,
  });
  const canBlockUsers = hasEffectivePermission({
    permissionLabel: PERMISSION_LABELS.BLOCK_USER,
    userPermissions: currentUserPermissions,
    rolePermissions: currentRolePermissions,
  });
  const canManageBan = hasEffectivePermission({
    permissionLabel: PERMISSION_LABELS.BAN_MANAGEMENT,
    userPermissions: currentUserPermissions,
    rolePermissions: currentRolePermissions,
  });
  const canManageBots = hasEffectivePermission({
    permissionLabel: PERMISSION_LABELS.BOT_MANAGEMENT,
    userPermissions: currentUserPermissions,
    rolePermissions: currentRolePermissions,
  });
  const canViewIp = hasEffectivePermission({
    permissionLabel: PERMISSION_LABELS.IP_VIEW,
    userPermissions: currentUserPermissions,
    rolePermissions: currentRolePermissions,
  });
  const canUseRoof =
    currentUserStarCount >= 1 &&
    hasEffectivePermission({
      permissionLabel: PERMISSION_LABELS.ROOF_ACCESS,
      userPermissions: currentUserPermissions,
      rolePermissions: currentRolePermissions,
    });

  // Kullanıcı ismini display için formatla (ajan rumuzu varsa göster)
  const getDisplayUsername = (user: RoomUser) => {
    const myAgentNickname = effectiveAgentNickname || null;
    const isSelfByRealUsername = Boolean(
      currentUsername && user.username === currentUsername,
    );
    const isSelfByAgentUsername = Boolean(
      myAgentNickname && user.username === myAgentNickname,
    );

    if (!user.agentNickname && myAgentNickname && (isSelfByRealUsername || isSelfByAgentUsername)) {
      return myAgentNickname;
    }

    return formatAgentDisplayName(
      {
        username: user.username,
        displayUsername: user.displayUsername,
        agentNickname: user.agentNickname,
        roleStarCount: user.roleStarCount,
      },
      currentUserStarCount,
    );
  };

  const isAgentMaskedUser = (user?: RoomUser | null) => {
    if (!user) return false;
    if (user.isBot) return false;
    if (user.agentNickname) return true;
    const selfAgentNickname = effectiveAgentNickname || null;
    return Boolean(
      isAgentLogin &&
        ((currentUsername && user.username === currentUsername) ||
          (selfAgentNickname && user.username === selfAgentNickname)),
    );
  };

  const resolveUserDevice = (user: RoomUser) => {
    const rawDevice =
      user.deviceType ?? user.device ?? user.clientType ?? "";
    const normalized = String(rawDevice).toLocaleLowerCase("tr-TR");
    const isMobile =
      normalized.includes("mobile") ||
      normalized.includes("mobil") ||
      normalized.includes("android") ||
      normalized.includes("ios");

    return {
      Icon: isMobile ? Smartphone : Monitor,
      title: isMobile ? "Mobil" : "Bilgisayar",
    };
  };

  const getCallDisplayUsername = (user: RoomUser) => {
    return getDisplayUsername(user);
  };

  // Avatar harfi: ajan girişinde ajan nickinin ilk harfini kullan
  const getAvatarInitial = (user: RoomUser) => {
    const displayName = getDisplayUsername(user)?.trim();
    if (!displayName) return "?";
    return displayName.charAt(0).toUpperCase();
  };

  // Kullanıcı adını stil ile render et (font ve granite ile)
  const resolveFlashNickSource = (value?: string | null) => {
    const normalized = (value || "").trim();
    if (!normalized) return null;
    
    // Base64 data URL desteği
    if (normalized.startsWith("data:image/")) return normalized;
    
    // Tam URL veya yol desteği (API'den gelen veriler için)
    if (normalized.startsWith("/") || normalized.startsWith("http") || normalized.includes(".")) {
      return resolveMediaUrl(normalized) || normalized;
    }
    
    return null;
  };

  const getEffectiveFlashNick = (user: RoomUser) => {
    const normalized = user.username.trim().toLowerCase();
    const globalUser = activeTenantUsers.find(
      (u) => u.username.trim().toLowerCase() === normalized,
    );

    const roomFlashNick = user.flashNick;
    const globalFlashNick = globalUser?.flashNick;

    // Eğer her ikisi de farklı verilerse (undefined olmayan), global olanı (en güncel) al.
    // Ama eğer biri null/undefined diğeri doluysa, dolu olanı (resmi) tercih et.
    let val = globalFlashNick !== undefined ? globalFlashNick : roomFlashNick;

    if (roomFlashNick && !globalFlashNick) {
      val = roomFlashNick;
    } else if (!roomFlashNick && globalFlashNick) {
      val = globalFlashNick;
    }

    return resolveFlashNickSource(val || null);
  };

  const renderStyledUsername = (user: RoomUser) => {
    const displayName = getDisplayUsername(user);
    const isRootUser = isRootUsername(user.username);

    // Ajan girişi yapan kullanıcılar için özel stillendirme uygulanmaz
    // Herkes tarafından normal stille görülmeli
    if (isAgentMaskedUser(user) && !isRootUser) {
      return <span className="inline-block relative">{displayName}</span>;
    }

    const flashNickSource = getEffectiveFlashNick(user);
    if (flashNickSource && !isRootUser) {
      return (
        <img
          src={flashNickSource}
          alt={displayName}
          className="inline-block h-6 max-w-[180px] object-contain object-left align-middle"
        />
      );
    }

    const normalized = user.username.trim().toLowerCase();
    const globalUser = activeTenantUsers.find(
      (u) => u.username.trim().toLowerCase() === normalized,
    );

    // Global (tenant) listedeki en güncel stili al, yoksa passed user'dan al
    const fontName = globalUser && globalUser.fontName !== undefined ? globalUser.fontName : user.fontName;
    const granite = globalUser && globalUser.granite !== undefined ? globalUser.granite : user.granite;
    const nickColor = globalUser && globalUser.nickColor !== undefined ? globalUser.nickColor : user.nickColor;

    // Font style oluştur
    const fontStyle: React.CSSProperties = {
      display: "inline-block",
      lineHeight: "1",
    };

    if (fontName) {
      fontStyle.fontFamily = getChatFontFamily(fontName) || undefined;
      fontStyle.fontSize = getChatFontSize(fontName);
    }
    if (nickColor) {
      fontStyle.color = nickColor;
    }
    if (isRootUser) {
      fontStyle.fontSize = "1.35em";
      fontStyle.fontWeight = 900;
    }

    // Granite class ve font style'ı birleştir
    return (
      <span
        className={`inline-block relative ${granite || ""}`}
        style={fontStyle}
      >
        {displayName}
      </span>
    );
  };

  const renderProfileHeaderUsername = (user: RoomUser) => {
    const isRootUser = isRootUsername(user.username);

    if (isAgentMaskedUser(user) && !isRootUser) {
      return (
        <span className="block truncate font-semibold text-zinc-900">
          {getDisplayUsername(user)}
        </span>
      );
    }

    const flashNickSource = getEffectiveFlashNick(user);
    if (flashNickSource && !isRootUser) {
      return (
        <img
          src={flashNickSource}
          alt={getDisplayUsername(user)}
          className="block h-6 max-w-[200px] object-contain object-left"
        />
      );
    }

    return (
      <span className="block truncate font-semibold text-zinc-900">
        {renderStyledUsername(user)}
      </span>
    );
  };

  const getImmediateSelfIcon = () => {
    if (typeof window === "undefined") return null;
    const isGuest = localStorage.getItem("isGuest") === "true";
    if (isGuest) return null;
    const agentNickname = (localStorage.getItem("agentNickname") || "").trim();
    if (agentNickname) return null;
    const current = localStorage.getItem("username");
    const iconOwner = localStorage.getItem("profileIconOwner");
    if (!iconOwner || !current || iconOwner !== current) return null;
    const icon = localStorage.getItem("profileIcon");
    if (!icon || !icon.startsWith("data:")) return null;
    return icon;
  };

  const router = useRouter();
  const [activeTab, setActiveTab] = useState<
    "room" | "all" | "rooms" | "calls" | "friends" | "wall"
  >(
    mobileRoomOnly
      ? "room"
      : mobileAllUsersFullscreen
        ? "all"
        : mobileRoomsFullscreen
          ? "rooms"
        : defaultTab || "room",
  );
  const [mobileRoomsDirectoryTab, setMobileRoomsDirectoryTab] = useState<
    "rooms" | "wall" | "friends" | "calls"
  >("rooms");
  const [mobileFriendPresenceTab, setMobileFriendPresenceTab] = useState<
    "online" | "offline" | "incoming" | "outgoing"
  >("online");
  const [showMessagesModal, setShowMessagesModal] = useState(false);
  const [dmTargetUsername, setDmTargetUsername] = useState<string | null>(null);
  const [dmTargetAgentNickname, setDmTargetAgentNickname] = useState<string | null>(null);
  const [dmUnreadCount, setDmUnreadCount] = useState(0);
  const [pendingDmConversationCounts, setPendingDmConversationCounts] = useState<
    Record<number, number>
  >({});
  const pendingDmConversationCountsRef = useRef<Record<number, number>>({});
  const [hideDmUnreadBadge, setHideDmUnreadBadge] = useState(false);
  const [selectedUser, setSelectedUser] = useState<RoomUser | null>(initialSelectedUser ?? null);
  const [selectedProfileImage, setSelectedProfileImage] = useState<string | null>(
    null,
  );
  const [isProfileImageModalOpen, setIsProfileImageModalOpen] = useState(false);
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const adminMenuRef = useRef<HTMLDivElement>(null);
  const apiClientRef = useRef(getClientApiClient());
  const botSpeakInFlightRef = useRef(false);
  const [adminActionLoading, setAdminActionLoading] = useState(false);
  const [passwordModalRoom, setPasswordModalRoom] = useState<Room | null>(null);
  const [roomPassword, setRoomPassword] = useState("");
  const [roomPasswordError, setRoomPasswordError] = useState<string | null>(
    null,
  );
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);
  const [showTeleportModal, setShowTeleportModal] = useState(false);
  const [teleportTargetUser, setTeleportTargetUser] = useState<RoomUser | null>(
    null,
  );
  const [showBotSpeakModal, setShowBotSpeakModal] = useState(false);
  const [botSpeakTarget, setBotSpeakTarget] = useState<RoomUser | null>(null);
  const [botSpeakMessage, setBotSpeakMessage] = useState("");
  const [botMutePreferences, setBotMutePreferences] = useState<
    BotMutePreference[]
  >([]);
  const [pendingRoomInvite, setPendingRoomInvite] =
    useState<RoomInviteReceivedPayload | null>(null);
  const [showUserInfoModal, setShowUserInfoModal] = useState(false);
  const [userInfoData, setUserInfoData] = useState<ModerationUserInfoData | null>(
    null,
  );
  const [incomingWarnModal, setIncomingWarnModal] =
    useState<ModerationWarnPayload | null>(null);
  const [incomingMicInvite, setIncomingMicInvite] =
    useState<ModerationMicInviteReceivedPayload | null>(null);

  const refreshBotMutePreferences = useCallback(async () => {
    if (!canManageBots) {
      setBotMutePreferences([]);
      return;
    }
    try {
      const response =
        await apiClientRef.current.get<BotMutePreference[]>("/bot/preferences");
      const preferences = Array.isArray(response.data)
        ? response.data
        : Array.isArray(response)
          ? response
          : [];
      setBotMutePreferences(preferences.filter((item) => item.muted === true));
    } catch (error) {
      console.error("Bot susturma tercihleri alınamadı:", error);
    }
  }, [canManageBots]);

  useEffect(() => {
    void refreshBotMutePreferences();
  }, [refreshBotMutePreferences]);
  const [cameraViewerUser, setCameraViewerUser] = useState<RoomUser | null>(
    null,
  );
  const [cameraViewerError, setCameraViewerError] = useState<string | null>(
    null,
  );
  const [cameraViewerPos, setCameraViewerPos] = useState({ x: 0, y: 0 });
  const [isDraggingCameraViewer, setIsDraggingCameraViewer] = useState(false);
  const cameraViewerContainerRef = useRef<HTMLDivElement | null>(null);
  const cameraViewerRoomRef = useRef<LiveKitRoom | null>(null);
  const cameraViewerOpeningRef = useRef(false);
  const cameraViewerDragStartRef = useRef({ x: 0, y: 0 });

  // Check if current user has admin privileges (1+ stars)
  const hasAdminPrivileges = currentUserStarCount >= 1;

  const hasActiveGuestAlias = useCallback((user?: RoomUser | null) => {
    const guestAlias = (user?.guestAlias || "").trim();
    if (!user?.isGuest || !guestAlias || user.guestAliasReleased === true) {
      return false;
    }

    const displayName = (user.displayUsername || guestAlias).trim();
    return /^guest\d+$/i.test(displayName);
  }, []);

  // Update activeTab when defaultTab prop changes
  useEffect(() => {
    if (mobileRoomOnly) {
      setActiveTab("room");
      return;
    }
    if (mobileAllUsersFullscreen) {
      setActiveTab((current) => (current === "friends" ? "friends" : "all"));
      return;
    }
    if (mobileRoomsFullscreen) {
      setActiveTab("rooms");
      return;
    }
    if (defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab, mobileRoomOnly, mobileAllUsersFullscreen, mobileRoomsFullscreen]);

  useEffect(() => {
    let timeoutId: number | undefined;
    const syncFromStorage = () => {
      const preferences = readChatPreferencesFromStorage();
      const nextValue = preferences.hideDirectMessageAlerts === true;
      setHideDmUnreadBadge((prev) => (prev === nextValue ? prev : nextValue));
    };

    syncFromStorage();
    const onPreferencesChanged = () => {
      // Defer to the next tick to avoid setState during another component render.
      timeoutId = window.setTimeout(syncFromStorage, 0);
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
    const syncIgnoredFromStorage = () => {
      const preferences = readChatPreferencesFromStorage();
      const nextIgnored = new Set(
        (preferences.ignoredUsernames ?? [])
          .map((username) => normalizeUsername(username))
          .filter(Boolean),
      );
      setIgnoredUsernames(nextIgnored);
    };

    syncIgnoredFromStorage();
    const onPreferencesChanged = () => {
      timeoutId = window.setTimeout(syncIgnoredFromStorage, 0);
    };
    window.addEventListener("chatPreferencesChanged", onPreferencesChanged);
    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      window.removeEventListener("chatPreferencesChanged", onPreferencesChanged);
    };
  }, []);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [filteredRooms, setFilteredRooms] = useState<Room[]>([]);
  const [roomCounts, setRoomCounts] = useState<Record<string, number>>({});
  const [roomCountsLoaded, setRoomCountsLoaded] = useState(false);
  const countsSocketRef = useRef<Socket | null>(null);
  const roomDisplayNameByKey = useMemo(() => {
    const map = new Map<string, string>();
    const addRoomAlias = (value?: string | null, label?: string | null) => {
      const normalized = value?.trim().toLowerCase();
      const displayLabel = label?.trim();
      if (normalized && displayLabel) {
        map.set(normalized, displayLabel);
      }
    };

    rooms.forEach((room) => {
      addRoomAlias(room.name, room.name);
      addRoomAlias(
        room.voiceId !== undefined && room.voiceId !== null
          ? String(room.voiceId)
          : null,
        room.name,
      );
    });
    addRoomAlias(currentRoomId, currentRoomName || currentRoomId);
    addRoomAlias(currentRoomName, currentRoomName);

    return map;
  }, [rooms, currentRoomId, currentRoomName]);
  const resolveRoomDisplayName = useCallback(
    (roomKey?: string | null, roomName?: string | null) => {
      const normalizedKey = roomKey?.trim().toLowerCase();
      const normalizedName = roomName?.trim().toLowerCase();
      const knownName =
        (normalizedKey ? roomDisplayNameByKey.get(normalizedKey) : undefined) ||
        (normalizedName ? roomDisplayNameByKey.get(normalizedName) : undefined);
      if (knownName) return knownName;

      const cleanRoomName = roomName?.trim();
      if (cleanRoomName && !cleanRoomName.toLowerCase().startsWith("voice_")) {
        return cleanRoomName;
      }

      return roomKey?.trim() || cleanRoomName || "";
    },
    [roomDisplayNameByKey],
  );
  const [callFilter, setCallFilter] = useState<
    "all" | "missed" | "outgoing" | "incoming"
  >("all");
  const [friendFilter, setFriendFilter] = useState<
    "friends" | "incoming" | "outgoing"
  >("friends");
  const [friends, setFriends] = useState<FriendRequest[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
  const incomingRequestIdsRef = useRef<Set<number>>(new Set());
  const [selectedUserRelation, setSelectedUserRelation] =
    useState<FriendRelationState | null>(null);
  const [fakeBotOutgoingFriendRequests, setFakeBotOutgoingFriendRequests] =
    useState<Set<string>>(new Set());
  const [fakeBotBlockedUsernames, setFakeBotBlockedUsernames] = useState<
    Set<string>
  >(new Set());

  useEffect(() => {
    if (!mobileRoomsFullscreen) return;
    if (
      defaultTab === "rooms" ||
      defaultTab === "wall" ||
      defaultTab === "friends" ||
      defaultTab === "calls"
    ) {
      setMobileRoomsDirectoryTab(defaultTab);
    }
  }, [defaultTab, mobileRoomsFullscreen]);

  useEffect(() => {
    if (!mobileRoomsFullscreen) return;
    setSearchQuery("");
    if (mobileRoomsDirectoryTab !== "calls") {
      setCallFilter("all");
    }
  }, [mobileRoomsDirectoryTab, mobileRoomsFullscreen]);
  const [fakeBotIgnoredUsernames, setFakeBotIgnoredUsernames] = useState<
    Set<string>
  >(new Set());
  const [ignoredUsernames, setIgnoredUsernames] = useState<Set<string>>(
    new Set(),
  );
  const [relationLoading, setRelationLoading] = useState(false);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [friendsError, setFriendsError] = useState<string | null>(null);
  const [friendToRemove, setFriendToRemove] = useState<{
    id: number;
    username: string;
    agentNickname?: string | null;
    displayName: string;
  } | null>(null);
  const [activeTenantUserCount, setActiveTenantUserCount] = useState<number>(0);
  const [activeTenantUsers, setActiveTenantUsers] = useState<RoomUser[]>([]);

  useEffect(() => {
    onActiveTenantUsersChange?.(activeTenantUsers);
  }, [activeTenantUsers, onActiveTenantUsersChange]);
  const [hasReceivedTenantSnapshot, setHasReceivedTenantSnapshot] =
    useState(false);
  const [roleCatalog, setRoleCatalog] = useState<RoleCatalogItem[]>([]);
  const [moderationOverrides, setModerationOverrides] = useState<
    Record<
      string,
      Partial<
        Pick<
          RoomUser,
          | "roomMuted"
          | "roomMutedByStarCount"
          | "globalMuted"
          | "globalMutedByStarCount"
          | "micBanned"
          | "micBannedByStarCount"
          | "cameraBanned"
          | "cameraBannedByStarCount"
        >
      >
    >
  >({});
  const [tenantPresenceReady, setTenantPresenceReady] = useState(false);
  const tenantSocketRef = useRef<Socket | null>(null);
  const onTenantJoinEffectRef = useRef(onTenantJoinEffect);
  const usersRef = useRef<RoomUser[]>(users);
  const pendingRoleUpdateRef = useRef<
    Map<string, { expiresAt: number; patch: RoleFieldPatch | null }>
  >(new Map());
  const authoritativeRoleByUsernameRef = useRef<Map<string, RoleFieldPatch>>(
    new Map(),
  );
  const selfPresenceGraceUntilRef = useRef(0);
  const userPresenceGraceUntilRef = useRef<Map<string, number>>(new Map());
  const lastSearchKeyRef = useRef<string | null>(null);
  const friendPresenceInitializedRef = useRef(false);
  const tenantJoinPresenceInitializedRef = useRef(false);
  const tenantJoinPresenceRef = useRef<Map<string, string>>(new Map());
  const tenantJoinStateRef = useRef<
    Map<
      string,
      {
        sessionId: string;
        statusModeName: string | null;
        joinEffect: JoinEffectId | null;
      }
    >
  >(new Map());
  const friendPresenceRef = useRef<
    Map<
      string,
      {
        username: string;
        isOnline: boolean;
        roomName: string | null;
        agentNickname: string | null;
        roleStarCount: number;
        statusModeName: string | null;
      }
    >
  >(new Map());
  const recentFriendOfflineRef = useRef<
    Map<
      string,
      {
        username: string;
        roomName: string | null;
        agentNickname: string | null;
        roleStarCount: number;
        statusModeName: string | null;
        timestamp: number;
      }
    >
  >(new Map());
  const roomTabUsersRef = useRef<RoomUser[]>([]);
  const allTabUsersRef = useRef<RoomUser[]>([]);

  useEffect(() => {
    onTenantJoinEffectRef.current = onTenantJoinEffect;
  }, [onTenantJoinEffect]);

  const activeTenantUsernameSet = useMemo(() => {
    const usernames = activeTenantUsers.map((user) =>
      user.username.trim().toLowerCase(),
    );
    return new Set(usernames);
  }, [activeTenantUsers]);

  const getPendingRolePatch = useCallback((username?: string | null) => {
    const normalized = normalizeUsername(username);
    if (!normalized) return null;
    const pending = pendingRoleUpdateRef.current.get(normalized);
    if (!pending) return null;
    if (pending.expiresAt <= Date.now()) {
      pendingRoleUpdateRef.current.delete(normalized);
      return null;
    }
    return pending.patch;
  }, []);

  const setPendingRolePatch = useCallback(
    (username?: string | null, patch?: RoleFieldPatch | null) => {
      const normalized = normalizeUsername(username);
      if (!normalized) return;
      pendingRoleUpdateRef.current.set(normalized, {
        expiresAt: Date.now() + ROLE_UPDATE_GRACE_MS,
        patch: patch ?? null,
      });
    },
    [],
  );

  const normalizeAuthoritativeRolePatch = useCallback(
    (patch?: RoleFieldPatch | null): RoleFieldPatch => ({
      roleName: patch?.roleName ?? null,
      roleIcon: patch?.roleIcon ?? null,
      roleStarCount: patch?.roleStarCount ?? null,
      roleStarColor: patch?.roleStarColor ?? null,
    }),
    [],
  );

  const rememberAuthoritativeRolePatch = useCallback(
    (username?: string | null, patch?: RoleFieldPatch | null) => {
      const normalized = normalizeUsername(username);
      if (!normalized) return;
      const normalizedPatch = normalizeAuthoritativeRolePatch(patch);
      authoritativeRoleByUsernameRef.current.set(
        normalized,
        normalizedPatch,
      );
      setStoredRolePatch(username, normalizedPatch);
    },
    [normalizeAuthoritativeRolePatch],
  );

  const getAuthoritativeRolePatch = useCallback(
    (username?: string | null): RoleFieldPatch | null => {
      const normalized = normalizeUsername(username);
      if (!normalized) return null;
      const inMemoryPatch = authoritativeRoleByUsernameRef.current.get(normalized);
      if (inMemoryPatch) return inMemoryPatch;

      const storedPatch = getStoredRolePatch(username);
      if (storedPatch) {
        authoritativeRoleByUsernameRef.current.set(normalized, storedPatch);
      }
      return storedPatch;
    },
    [],
  );

  const getStableRolePatch = useCallback(
    (username?: string | null): RoleFieldPatch | null =>
      getPendingRolePatch(username) ?? getAuthoritativeRolePatch(username),
    [getAuthoritativeRolePatch, getPendingRolePatch],
  );

  useEffect(() => {
    if (!currentUserRoleReady || !currentUsername) {
      return;
    }

    rememberAuthoritativeRolePatch(
      currentUsername,
      currentUserRoleSnapshot ?? null,
    );
  }, [
    currentUsername,
    currentUserRoleReady,
    currentUserRoleSnapshot,
    rememberAuthoritativeRolePatch,
  ]);

  const armSelfPresenceGrace = useCallback(() => {
    selfPresenceGraceUntilRef.current = Date.now() + SELF_PRESENCE_GRACE_MS;
  }, []);

  const armUserPresenceGrace = useCallback((username?: string | null) => {
    const normalized = normalizeUsername(username);
    if (!normalized) return;
    userPresenceGraceUntilRef.current.set(
      normalized,
      Date.now() + SELF_PRESENCE_GRACE_MS,
    );
  }, []);

  const hasActiveUserPresenceGrace = useCallback((username?: string | null) => {
    const normalized = normalizeUsername(username);
    if (!normalized) return false;
    const expiresAt = userPresenceGraceUntilRef.current.get(normalized);
    if (!expiresAt) return false;
    if (expiresAt <= Date.now()) {
      userPresenceGraceUntilRef.current.delete(normalized);
      return false;
    }
    return true;
  }, []);

  const roleCatalogByStarCount = useMemo(() => {
    const next = new Map<number, RoleCatalogItem>();
    for (const role of roleCatalog) {
      const starCount = Number(role.starCount);
      if (Number.isFinite(starCount)) {
        next.set(starCount, role);
      }
    }
    return next;
  }, [roleCatalog]);

  const roleCatalogByName = useMemo(() => {
    const next = new Map<string, RoleCatalogItem>();
    for (const role of roleCatalog) {
      const keys = [
        normalizeRoleLookupKey(role.name),
        normalizeRoleLookupKey(formatRoleLabel(role.name)),
      ].filter(Boolean);
      keys.forEach((key) => next.set(key, role));
    }
    return next;
  }, [roleCatalog]);

  const getModerationOverride = (username?: string | null) =>
    moderationOverrides[normalizeUsername(username)] ?? null;

  const updateModerationOverride = (
    username: string,
    patch: Partial<
      Pick<
        RoomUser,
        | "roomMuted"
        | "roomMutedByStarCount"
        | "globalMuted"
        | "globalMutedByStarCount"
        | "micBanned"
        | "micBannedByStarCount"
        | "cameraBanned"
        | "cameraBannedByStarCount"
      >
    >,
  ) => {
    const normalized = normalizeUsername(username);
    if (!normalized) return;
    setModerationOverrides((prev) => ({
      ...prev,
      [normalized]: {
        ...(prev[normalized] || {}),
        ...patch,
      },
    }));
  };

  // "Oda Kişileri" için oda socket snapshot'ı kaynak kabul edilir.
  // Tenant presence mobilde geç/eksik gelebilir; burada filtrelemek gerçek oda
  // kullanıcılarını 0 gösterebiliyor.
  const visibleUsers = useMemo(() => {
    const normalizedCurrentUsername = normalizeUsername(currentUsername);
    return users.filter((user) => {
      const globalUser = activeTenantUsers.find(
        (candidate) =>
          normalizeUsername(candidate.username) === normalizeUsername(user.username),
      );
      const effectiveStatusModeName = isPresencePlaceholderUser(user)
        ? user.statusModeName && user.statusModeName !== "Çatıda"
          ? user.statusModeName
          : (globalUser?.statusModeName ?? user.statusModeName)
        : user.statusModeName;
      const effectiveRoleStarCount = isPresencePlaceholderUser(user)
        ? Number(globalUser?.roleStarCount ?? user.roleStarCount ?? 0)
        : Number(user.roleStarCount ?? 0);
      const isCurrentUser =
        normalizeUsername(user.username) === normalizedCurrentUsername;

      if (
        effectiveStatusModeName === "Çatıda" &&
        !user.isBot &&
        !isCurrentUser
      ) {
        return currentUserStarCount >= effectiveRoleStarCount;
      }

      return true;
    });
  }, [
    users,
    activeTenantUsers,
    currentUsername,
    currentUserStarCount,
  ]);

  const mergeModerationState = (
    baseUser: RoomUser,
    overlayUser?: Partial<RoomUser> | null,
    overrideUser?: Partial<RoomUser> | null,
  ) => ({
    roomMuted:
      overrideUser?.roomMuted ?? !!(overlayUser?.roomMuted || baseUser.roomMuted),
    roomMutedByStarCount:
      overrideUser?.roomMutedByStarCount ??
      overlayUser?.roomMutedByStarCount ??
      baseUser.roomMutedByStarCount ??
      null,
    globalMuted:
      overrideUser?.globalMuted ?? !!(overlayUser?.globalMuted || baseUser.globalMuted),
    globalMutedByStarCount:
      overrideUser?.globalMutedByStarCount ??
      overlayUser?.globalMutedByStarCount ??
      baseUser.globalMutedByStarCount ??
      null,
    micBanned:
      overrideUser?.micBanned ?? !!(overlayUser?.micBanned || baseUser.micBanned),
    micBannedByStarCount:
      overrideUser?.micBannedByStarCount ??
      overlayUser?.micBannedByStarCount ??
      baseUser.micBannedByStarCount ??
      null,
    cameraBanned:
      overrideUser?.cameraBanned ?? !!(overlayUser?.cameraBanned || baseUser.cameraBanned),
    cameraBannedByStarCount:
      overrideUser?.cameraBannedByStarCount ??
      overlayUser?.cameraBannedByStarCount ??
      baseUser.cameraBannedByStarCount ??
      null,
  });

  const visibleRoomUsers = useMemo(() => {
    const roomKeys = new Set(
      [currentRoomId, currentRoomName]
        .map((room) => room?.trim().toLowerCase())
        .filter((room): room is string => Boolean(room)),
    );
    const normalizedCurrentUsername = normalizeUsername(currentUsername);
    const visibleUsernames = new Set(
      visibleUsers.map((user) => normalizeUsername(user.username)),
    );
    const activeRoomTenantUsersVisible =
      roomKeys.size > 0
        ? activeTenantUsers.filter((user) => {
            const normalizedUsername = normalizeUsername(user.username);
            if (!normalizedUsername) return false;
            if (visibleUsernames.has(normalizedUsername)) {
              return false;
            }
            const isInCurrentRoom = (user.rooms || []).some((room) => {
              const roomKey = room.roomKey?.trim().toLowerCase();
              const roomName = room.roomName?.trim().toLowerCase();
              return (
                (roomKey && roomKeys.has(roomKey)) ||
                (roomName && roomKeys.has(roomName))
              );
            });
            if (!isInCurrentRoom) {
              return false;
            }
            if (
              user.statusModeName === "Çatıda" &&
              !user.isBot &&
              normalizedUsername !== normalizedCurrentUsername
            ) {
              const userStarCountValue = Number(user.roleStarCount || 0);
              return Number(currentUserStarCount || 0) >= userStarCountValue;
            }
            return true;
          })
        : [];

    const nextUsers = [...visibleUsers, ...activeRoomTenantUsersVisible].map((user) => {
      const normalized = normalizeUsername(user.username);
      const globalUser = activeTenantUsers.find(
        (u) => normalizeUsername(u.username) === normalized,
      );
      const moderationOverride = getModerationOverride(user.username);
      const shouldPreferGlobalPresence = isPresencePlaceholderUser(user);
      const resolvedStatusModeName = shouldPreferGlobalPresence
        ? user.statusModeName && user.statusModeName !== "Çatıda"
          ? user.statusModeName
          : (globalUser?.statusModeName ?? user.statusModeName ?? null)
        : (user.statusModeName ?? globalUser?.statusModeName ?? null);
      return {
        ...user,
        statusModeId: shouldPreferGlobalPresence
          ? (globalUser?.statusModeId ?? user.statusModeId ?? null)
          : (user.statusModeId ?? globalUser?.statusModeId ?? null),
        statusModeName: resolvedStatusModeName,
        roleStarCount: shouldPreferGlobalPresence
          ? (globalUser?.roleStarCount ?? user.roleStarCount ?? null)
          : (user.roleStarCount ?? globalUser?.roleStarCount ?? null),
        ...mergeModerationState(user, globalUser, moderationOverride),
      };
    });

    const reconciled = reconcileTenantUsers(roomTabUsersRef.current, nextUsers);
    roomTabUsersRef.current = reconciled;
    return reconciled;
  }, [
    visibleUsers,
    activeTenantUsers,
    currentRoomId,
    currentRoomName,
    moderationOverrides,
  ]);

  const effectiveSelectedUser = useMemo(() => {
    if (!selectedUser) return null;
    const normalized = selectedUser.username.trim().toLowerCase();
    const globalUser = activeTenantUsers.find(
      (u) => u.username.trim().toLowerCase() === normalized,
    );
    const roomUser = users.find((u) => u.username.trim().toLowerCase() === normalized);
    const moderationOverride = getModerationOverride(selectedUser.username);

    const mergedUser = {
      ...selectedUser,
      ...mergeModerationState(
        roomUser ?? selectedUser,
        globalUser ?? selectedUser,
        moderationOverride,
      ),
    };
    if (!mergedUser.isBot) {
      return mergedUser;
    }

    const botId = getRoomUserBotNumericId(mergedUser);
    const targetRoomKey =
      mergedUser.rooms?.[0]?.roomKey || currentRoomId || currentRoomName || null;
    const normalizedTargetRoom = (targetRoomKey || "")
      .trim()
      .toLocaleLowerCase("tr-TR");
    const botPreferences = botMutePreferences.filter(
      (preference) => preference.botId === botId && preference.muted,
    );
    const globalMuted =
      mergedUser.globalMuted === true ||
      botPreferences.some((preference) => !preference.roomKey);
    const roomMuted =
      mergedUser.roomMuted === true ||
      (normalizedTargetRoom.length > 0 &&
        botPreferences.some(
          (preference) =>
            preference.roomKey?.trim().toLocaleLowerCase("tr-TR") ===
            normalizedTargetRoom,
        ));

    return {
      ...mergedUser,
      globalMuted,
      roomMuted,
    };
  }, [
    selectedUser,
    activeTenantUsers,
    users,
    moderationOverrides,
    botMutePreferences,
    currentRoomId,
    currentRoomName,
  ]);

  // "Tüm Kişiler" listesini (oda stilleriyle birleştirilmiş ve filtrelenmiş) hesapla
  const visibleAllUsers = useMemo(() => {
    const merged = activeTenantUsers.map((u) => {
      const normalized = u.username.trim().toLowerCase();
      const inRoom = users.find((ru) => ru.username.trim().toLowerCase() === normalized);
      const moderationOverride = getModerationOverride(u.username);
      if (inRoom) {
        const shouldPreferTenantPresence = isPresencePlaceholderUser(inRoom);
        const moderationState = mergeModerationState(
          inRoom,
          u,
          moderationOverride,
        );
        const resolvedStatusModeName = shouldPreferTenantPresence
          ? inRoom.statusModeName && inRoom.statusModeName !== "Çatıda"
            ? inRoom.statusModeName
            : (u.statusModeName ?? inRoom.statusModeName ?? null)
          : (inRoom.statusModeName ?? u.statusModeName);
        return {
          ...u,
          isGuest:
            u.isGuest === true ||
            u.guest === true ||
            inRoom.isGuest === true,
          fontName: inRoom.fontName,
          granite: inRoom.granite,
          statusModeId: shouldPreferTenantPresence
            ? (u.statusModeId ?? inRoom.statusModeId ?? null)
            : (inRoom.statusModeId ?? u.statusModeId ?? null),
          statusModeName: resolvedStatusModeName,
          roleName: u.roleName ?? null,
          roleStarCount: u.roleStarCount ?? null,
          roleStarColor: u.roleStarColor ?? null,
          roleIcon: u.roleIcon ?? null,
          isInVoiceChat: u.isBot
            ? (u.isInVoiceChat ?? inRoom.isInVoiceChat)
            : inRoom.isInVoiceChat,
          isMuted: u.isBot ? (u.isMuted ?? inRoom.isMuted) : inRoom.isMuted,
          isCameraOn: u.isBot
            ? (u.isCameraOn ?? inRoom.isCameraOn)
            : inRoom.isCameraOn,
          isHandRaised: u.isBot
            ? (u.isHandRaised ?? inRoom.isHandRaised)
            : inRoom.isHandRaised,
          handRaisedAt: u.isBot
            ? (u.handRaisedAt ?? inRoom.handRaisedAt)
            : inRoom.handRaisedAt,
          ...moderationState,
        };
      }
      return {
        ...u,
        ...mergeModerationState(u, u, moderationOverride),
      };
    });
    const activeUsernames = new Set(
      activeTenantUsers.map((user) => user.username.trim().toLowerCase()),
    );
      const roomUsersMissingFromTenant = users
      .filter((user) => {
        const normalizedUsername = normalizeUsername(user.username);
        if (!normalizedUsername) return false;
        if (activeUsernames.has(normalizedUsername)) return false;
        return true;
      })
      .map((user) => ({
        ...user,
        rooms:
          user.rooms && user.rooms.length > 0
            ? user.rooms
            : currentRoomId
              ? [{ roomKey: currentRoomId, roomName: currentRoomName || currentRoomId }]
              : [],
      }));
    const mergedWithRoomUsers = [...merged, ...roomUsersMissingFromTenant];

    const sortedUsers = mergedWithRoomUsers
      .filter((user) => {
        if (
          user.statusModeName === "Çatıda" &&
          !user.isBot &&
          user.username !== currentUsername
        ) {
          const userStarCount = user.roleStarCount || 0;
          return currentUserStarCount >= userStarCount;
        }
        return true;
      })
      .sort((a, b) => {
        // 1. Mikrofonu açık olanlar her zaman üstte
        const aMicOpen = a.isInVoiceChat && !a.isMuted;
        const bMicOpen = b.isInVoiceChat && !b.isMuted;
        if (aMicOpen && !bMicOpen) return -1;
        if (!aMicOpen && bMicOpen) return 1;

        // 2. Mikrofonu kapalı olanlar arasında el kaldıranlar üste
        if (!aMicOpen && !bMicOpen) {
          if (a.isHandRaised && !b.isHandRaised) return -1;
          if (!a.isHandRaised && b.isHandRaised) return 1;
          if (a.isHandRaised && b.isHandRaised) {
            return (
              (a.handRaisedAt ?? 0) - (b.handRaisedAt ?? 0) ||
              a.username.localeCompare(b.username)
            );
          }
        }

        // 3. Alfabetik
        return a.username.localeCompare(b.username);
      });

    const reconciled = reconcileTenantUsers(allTabUsersRef.current, sortedUsers);
    allTabUsersRef.current = reconciled;
    return reconciled;
  }, [
    activeTenantUsers,
    users,
    currentUsername,
    currentUserStarCount,
    currentRoomId,
    currentRoomName,
    moderationOverrides,
  ]);
  const currentRoomKeys = useMemo(
    () =>
      [currentRoomId, currentRoomName]
        .map((room) => room?.trim().toLowerCase())
        .filter((room): room is string => Boolean(room)),
    [currentRoomId, currentRoomName],
  );

  const fallbackVisibleRoomUsers = useMemo(() => {
    const roomKeySet = new Set(currentRoomKeys);
    const normalizedCurrentUsername = normalizeUsername(currentUsername);

    if (roomKeySet.size === 0) {
      return visibleAllUsers.filter(
        (user) => normalizeUsername(user.username) === normalizedCurrentUsername,
      );
    }

    return visibleAllUsers.filter((user) => {
      const normalizedUsername = normalizeUsername(user.username);
      if (
        normalizedCurrentUsername &&
        normalizedUsername === normalizedCurrentUsername
      ) {
        return true;
      }

      return (user.rooms || []).some((room) => {
        const roomKey = room.roomKey?.trim().toLowerCase();
        const roomName = room.roomName?.trim().toLowerCase();
        return (
          (roomKey && roomKeySet.has(roomKey)) ||
          (roomName && roomKeySet.has(roomName))
        );
      });
    });
  }, [visibleAllUsers, currentRoomKeys, currentUsername]);

  const resolvedVisibleRoomUsers = useMemo(
    () =>
      visibleRoomUsers.length > 0
        ? visibleRoomUsers
        : fallbackVisibleRoomUsers,
    [visibleRoomUsers, fallbackVisibleRoomUsers],
  );

  const roomCountDiagnostics = useMemo(() => {
    const roomKeySet = new Set(currentRoomKeys);
    const activeRoomTenantUsers =
      roomKeySet.size > 0
        ? activeTenantUsers.filter((user) =>
            (user.rooms || []).some((room) => {
              const roomKey = room.roomKey?.trim().toLowerCase();
              const roomName = room.roomName?.trim().toLowerCase();
              return (
                (roomKey && roomKeySet.has(roomKey)) ||
                (roomName && roomKeySet.has(roomName))
              );
            }),
          ).length
        : 0;

    return {
      visibleCount: resolvedVisibleRoomUsers.length,
      socketCount: users.length,
      tenantRoomCount: activeRoomTenantUsers,
      visibleUsers: resolvedVisibleRoomUsers.map((user) => ({
        username: user.username,
        statusModeName: user.statusModeName ?? null,
        roleStarCount: user.roleStarCount ?? null,
        isBot: user.isBot === true,
      })),
      socketUsers: users.map((user) => ({
        username: user.username,
        statusModeName: user.statusModeName ?? null,
        roleStarCount: user.roleStarCount ?? null,
        isBot: user.isBot === true,
      })),
    };
  }, [
    currentRoomKeys,
    activeTenantUsers,
    resolvedVisibleRoomUsers,
    users,
  ]);

  const currentRoomLiveCount = useMemo(() => {
    for (const roomKey of currentRoomKeys) {
      const liveCount = getLiveCount(roomKey);
      if (liveCount.value !== null) {
        return liveCount.value;
      }
    }

    return null;
  }, [currentRoomKeys, roomCounts, roomCountsLoaded]);

  const roomUsersCount =
    roomCountDiagnostics.visibleCount > 0
      ? roomCountDiagnostics.visibleCount
      : roomCountDiagnostics.socketCount > 0
        ? roomCountDiagnostics.socketCount
        : currentRoomLiveCount ?? 0;

  const allUsersCount =
    visibleAllUsers.length > 0
      ? visibleAllUsers.length
      : activeTenantUserCount > 0
        ? activeTenantUserCount
        : currentRoomLiveCount ?? 0;

  useEffect(() => {
    onCountsChange?.({ roomUsersCount, allUsersCount });
  }, [onCountsChange, roomUsersCount, allUsersCount]);

  const findUserByUsername = useCallback(
    (username: string) => {
      const normalized = username.toLocaleLowerCase("tr-TR");
      const fromTenant = activeTenantUsers.find(
        (user) =>
          user.username.toLocaleLowerCase("tr-TR") === normalized ||
          (user.agentNickname || "").toLocaleLowerCase("tr-TR") === normalized,
      );
      if (fromTenant) return fromTenant;
      return (
        users.find(
          (user) =>
            user.username.toLocaleLowerCase("tr-TR") === normalized ||
            (user.agentNickname || "").toLocaleLowerCase("tr-TR") === normalized,
        ) || null
      );
    },
    [activeTenantUsers, users],
  );

  const mapFriendToRoomUser = useCallback(
    (
      item: FriendRequest,
      options: { includeLivePresence?: boolean } = {},
    ): RoomUser => {
      const includeLivePresence = options.includeLivePresence !== false;
      const liveUser = findUserByUsername(item.user.username);
      const friendStarCount = Number(
        liveUser?.roleStarCount ?? item.user.roleStarCount ?? 0,
      );
      const viewerStarCount = Number(currentUserStarCount || 0);
      const isSelf =
        currentUsername?.toLocaleLowerCase("tr-TR") ===
        item.user.username.toLocaleLowerCase("tr-TR");
      const isHiddenRoofPresence =
        liveUser?.statusModeName === "Çatıda" &&
        !liveUser.isBot &&
        !isSelf &&
        viewerStarCount < friendStarCount;
      const isHiddenAgentPresence =
        Boolean((liveUser?.agentNickname || "").trim()) &&
        !isSelf &&
        viewerStarCount < friendStarCount;
      const presenceUser =
        includeLivePresence && !isHiddenRoofPresence && !isHiddenAgentPresence
          ? liveUser
          : null;
      const friendUserGif = item.user.userGif;
      return {
        id: String(item.user.id),
        username: item.user.username,
        gender: item.user.gender,
        isGuest: false,
        icon: resolveFriendIcon(item.user.icon) || presenceUser?.icon || null,
        frame: resolveFriendFrame(item.user.frame) || presenceUser?.frame || null,
        userGif:
          resolveUserGifPath(friendUserGif || null) ||
          presenceUser?.userGif ||
          null,
        roleName: liveUser?.roleName ?? item.user.roleName ?? null,
        roleIcon: liveUser?.roleIcon ?? item.user.roleIcon ?? null,
        roleStarColor:
          liveUser?.roleStarColor ?? item.user.roleStarColor ?? null,
        roleStarCount: friendStarCount || null,
        statusModeName: presenceUser?.statusModeName ?? null,
        statusModeId: presenceUser?.statusModeId ?? null,
        displayUsername: presenceUser?.displayUsername,
        agentNickname: presenceUser?.agentNickname ?? null,
        fontName: presenceUser?.fontName ?? null,
        granite: presenceUser?.granite ?? null,
        nickColor: presenceUser?.nickColor ?? null,
        flashNick: presenceUser?.flashNick ?? null,
      };
    },
    [currentUsername, currentUserStarCount, findUserByUsername],
  );

  const filteredFriends = useMemo(() => {
    if (!searchQuery.trim()) return friends;
    const q = searchQuery.toLowerCase();
    return friends.filter((item) => {
      const mappedUser = mapFriendToRoomUser(item);
      const displayName = getDisplayUsername(mappedUser).toLowerCase();
      return (
        item.user.username.toLowerCase().includes(q) ||
        displayName.includes(q) ||
        (mappedUser.agentNickname || "").toLowerCase().includes(q)
      );
    });
  }, [friends, searchQuery, mapFriendToRoomUser, currentUserStarCount]);

  const filteredIncoming = useMemo(() => {
    if (!searchQuery.trim()) return incomingRequests;
    const q = searchQuery.toLowerCase();
    return incomingRequests.filter((item) => {
      const mappedUser = mapFriendToRoomUser(item);
      const displayName = getDisplayUsername(mappedUser).toLowerCase();
      return (
        item.user.username.toLowerCase().includes(q) ||
        displayName.includes(q) ||
        (mappedUser.agentNickname || "").toLowerCase().includes(q)
      );
    });
  }, [incomingRequests, searchQuery, mapFriendToRoomUser, currentUserStarCount]);

  const filteredOutgoing = useMemo(() => {
    if (!searchQuery.trim()) return outgoingRequests;
    const q = searchQuery.toLowerCase();
    return outgoingRequests.filter((item) => {
      const mappedUser = mapFriendToRoomUser(item);
      const displayName = getDisplayUsername(mappedUser).toLowerCase();
      return (
        item.user.username.toLowerCase().includes(q) ||
        displayName.includes(q) ||
        (mappedUser.agentNickname || "").toLowerCase().includes(q)
      );
    });
  }, [outgoingRequests, searchQuery, mapFriendToRoomUser, currentUserStarCount]);

  useEffect(() => {
    if (!tenantPresenceReady) {
      tenantJoinPresenceRef.current = new Map();
      tenantJoinPresenceInitializedRef.current = false;
      tenantJoinStateRef.current = new Map();
      return;
    }

    const nextMap = new Map<string, string>();
    const nextStateMap = new Map<
      string,
      {
        sessionId: string;
        statusModeName: string | null;
        joinEffect: JoinEffectId | null;
      }
    >();
    for (const user of activeTenantUsers) {
      const normalizedUsername = normalizeUsername(user.username);
      if (!normalizedUsername) continue;
      const sessionId = String(user.socketId || user.id || "");
      nextMap.set(normalizedUsername, sessionId);
      nextStateMap.set(normalizedUsername, {
        sessionId,
        statusModeName: user.statusModeName || null,
        joinEffect:
          user.joinEffect && isJoinEffectId(user.joinEffect)
            ? user.joinEffect
            : null,
      });
    }

    const previousPresenceMap =
      tenantJoinPresenceRef.current instanceof Map
        ? tenantJoinPresenceRef.current
        : new Map<string, string>();
    const previousStateMap =
      tenantJoinStateRef.current instanceof Map
        ? tenantJoinStateRef.current
        : new Map<
            string,
            {
              sessionId: string;
              statusModeName: string | null;
              joinEffect: JoinEffectId | null;
            }
          >();

    if (tenantJoinPresenceInitializedRef.current) {
      for (const user of activeTenantUsers) {
        const normalizedUsername = normalizeUsername(user.username);
        if (!normalizedUsername) {
          continue;
        }

        const previousPresenceId =
          previousPresenceMap.get(normalizedUsername) ?? null;
        const previousState = previousStateMap.get(normalizedUsername) ?? null;
        const currentPresenceId = String(user.socketId || user.id || "");
        const isNewSession =
          !previousPresenceId ||
          (currentPresenceId && previousPresenceId !== currentPresenceId);
        const isVisibleNow = user.statusModeName !== "Çatıda";
        const becameVisible =
          previousState?.statusModeName === "Çatıda" && isVisibleNow;
        const shouldTrigger = (isNewSession && isVisibleNow) || becameVisible;
        if (!shouldTrigger) continue;

        if (
          !user.joinEffect ||
          !isJoinEffectId(user.joinEffect) ||
          user.isGuest === true
        ) {
        }
      }
    }

    tenantJoinPresenceRef.current = nextMap;
    tenantJoinStateRef.current = nextStateMap;
    tenantJoinPresenceInitializedRef.current = true;
  }, [activeTenantUsers, onTenantJoinEffect, tenantPresenceReady]);

  useEffect(() => {
    if (isGuestUser || !onFriendActivity) {
      friendPresenceRef.current = new Map();
      friendPresenceInitializedRef.current = false;
      return;
    }
    if (!tenantPresenceReady) {
      friendPresenceRef.current = new Map();
      friendPresenceInitializedRef.current = false;
      return;
    }

    const normalize = (value: string | null | undefined) =>
      (value || "").trim().toLowerCase();
    const friendMap = new Map<string, string>();
    for (const friend of friends) {
      if (friend.status !== "ACCEPTED") continue;
      const normalizedUsername = normalize(friend.user?.username);
      if (!normalizedUsername) continue;
      friendMap.set(normalizedUsername, friend.user.username);
    }

    if (friendMap.size === 0) {
      friendPresenceRef.current = new Map();
      friendPresenceInitializedRef.current = false;
      return;
    }

    const onlineFriendMap = new Map<
      string,
      {
        username: string;
        roomName: string | null;
        agentNickname: string | null;
        roleStarCount: number;
        statusModeName: string | null;
      }
    >();
    for (const user of activeTenantUsers) {
      const normalizedUsername = normalize(user.username);
      if (!normalizedUsername || !friendMap.has(normalizedUsername)) continue;
      const roomName = user.rooms?.[0]?.roomName?.trim() || null;
      onlineFriendMap.set(normalizedUsername, {
        username: user.username,
        roomName,
        agentNickname: (user.agentNickname || "").trim() || null,
        roleStarCount: user.roleStarCount || 0,
        statusModeName: (user.statusModeName || "").trim() || null,
      });
    }

    const prevMap = friendPresenceRef.current;
    const nextMap = new Map<
      string,
      {
        username: string;
        isOnline: boolean;
        roomName: string | null;
        agentNickname: string | null;
        roleStarCount: number;
        statusModeName: string | null;
      }
    >();

    for (const [normalizedUsername, fallbackUsername] of friendMap.entries()) {
      const onlineData = onlineFriendMap.get(normalizedUsername);
      const prevState = prevMap.get(normalizedUsername) ?? {
        username: fallbackUsername,
        isOnline: false,
        roomName: null,
        agentNickname: null,
        roleStarCount: 0,
        statusModeName: null,
      };
      const nextState = {
        username: onlineData?.username || fallbackUsername,
        isOnline: Boolean(onlineData),
        roomName: onlineData?.roomName || null,
        agentNickname: onlineData?.agentNickname || prevState.agentNickname || null,
        roleStarCount: onlineData?.roleStarCount ?? prevState.roleStarCount ?? 0,
        statusModeName: onlineData?.statusModeName || null,
      };
      nextMap.set(normalizedUsername, nextState);

      if (!friendPresenceInitializedRef.current) continue;

      const prevRoom = normalize(prevState.roomName);
      const nextRoom = normalize(nextState.roomName);
      const canViewerSeeFriendActivity = (state: {
        username: string;
        roomName: string | null;
        agentNickname: string | null;
        roleStarCount: number;
      }) => {
        if (!state.agentNickname) return true;
        return currentUserStarCount >= (state.roleStarCount || 0);
      };
      const getEventUsername = (state: {
        username: string;
        roomName: string | null;
        agentNickname: string | null;
        roleStarCount: number;
      }) =>
        formatAgentDisplayName(
          {
            username: state.username,
            agentNickname: state.agentNickname,
            roleStarCount: state.roleStarCount,
          },
          currentUserStarCount,
        );

      const recentOffline = recentFriendOfflineRef.current.get(normalizedUsername);
      const isRecentOffline =
        recentOffline && Date.now() - recentOffline.timestamp < 12000;

      if (!prevState.isOnline && nextState.isOnline) {
        if (!canViewerSeeFriendActivity(nextState)) continue;
        if (isRecentOffline) {
          recentFriendOfflineRef.current.delete(normalizedUsername);
          onFriendActivity({
            type: "friend_room_changed",
            username: getEventUsername(nextState),
            rawUsername: nextState.username,
            fromRoomName: recentOffline.roomName,
            toRoomName: nextState.roomName,
            timestamp: new Date().toISOString(),
          });
          continue;
        }
        onFriendActivity({
          type: "friend_online",
          username: getEventUsername(nextState),
          rawUsername: nextState.username,
          fromRoomName: null,
          toRoomName: nextState.roomName,
          timestamp: new Date().toISOString(),
        });
        continue;
      }

      if (prevState.isOnline && !nextState.isOnline) {
        if (!canViewerSeeFriendActivity(prevState)) continue;
        recentFriendOfflineRef.current.set(normalizedUsername, {
          username: prevState.username,
          roomName: prevState.roomName,
          agentNickname: prevState.agentNickname,
          roleStarCount: prevState.roleStarCount,
          statusModeName: prevState.statusModeName,
          timestamp: Date.now(),
        });
        onFriendActivity({
          type: "friend_offline",
          username: getEventUsername(prevState),
          rawUsername: prevState.username,
          wasOnRoof: prevState.statusModeName === "Çatıda",
          fromRoomName: prevState.roomName,
          toRoomName: null,
          timestamp: new Date().toISOString(),
        });
        continue;
      }

      if (
        prevState.isOnline &&
        nextState.isOnline &&
        prevRoom !== nextRoom &&
        nextRoom
      ) {
        if (!canViewerSeeFriendActivity(nextState)) continue;
        onFriendActivity({
          type: "friend_room_changed",
          username: getEventUsername(nextState),
          rawUsername: nextState.username,
          fromRoomName: prevState.roomName,
          toRoomName: nextState.roomName,
          timestamp: new Date().toISOString(),
        });
      }
    }

    for (const [username, offlineState] of recentFriendOfflineRef.current.entries()) {
      if (Date.now() - offlineState.timestamp > 20000) {
        recentFriendOfflineRef.current.delete(username);
      }
    }

    friendPresenceRef.current = nextMap;
    friendPresenceInitializedRef.current = true;
  }, [
    activeTenantUsers,
    currentUserStarCount,
    friends,
    isGuestUser,
    onFriendActivity,
    tenantPresenceReady,
  ]);

  const filteredAllUsers = useMemo(() => {
    if (!searchQuery.trim()) return visibleAllUsers;
    const q = searchQuery.toLowerCase();
    return visibleAllUsers.filter(
      (user) =>
        user.username.toLowerCase().includes(q) ||
        (user.agentNickname && user.agentNickname.toLowerCase().includes(q)),
    );
  }, [visibleAllUsers, searchQuery]);

  // JSON string'i parse edip nick_raw ve nick_style kontrolü yapar
  const parseNickStyleData = (
    data: unknown,
  ): NickStyleData | null => {
    let obj = data;

    // String ise JSON parse et
    if (typeof obj === "string") {
      // nick_raw içeriyorsa JSON olabilir
      if (obj.includes("nick_raw") && obj.includes("nick_style")) {
        try {
          obj = JSON.parse(obj);
        } catch {
          return null;
        }
      } else {
        return null;
      }
    }

    // Object ve nick_raw/nick_style varsa döndür
    if (
      obj &&
      typeof obj === "object" &&
      "nick_raw" in obj &&
      "nick_style" in obj &&
      typeof (obj as NickStyleData).nick_raw === "string" &&
      typeof (obj as NickStyleData).nick_style === "string"
    ) {
      const nickStyle = obj as NickStyleData;
      return {
        nick_raw: nickStyle.nick_raw,
        nick_style: nickStyle.nick_style,
      };
    }

    return null;
  };

  const isCurrentUserCard = (user?: Pick<RoomUser, "username"> | null) =>
    Boolean(
      user?.username &&
        currentUsername &&
        normalizeUsername(user.username) === normalizeUsername(currentUsername),
    );

  const shouldHideRoleForUser = (user?: Pick<RoomUser, "username"> | null) =>
    isCurrentUserCard(user) && !currentUserRoleReady;

  const isHiddenRoofStatusForUser = (user: RoomUser) =>
    user.statusModeName === "Çatıda" &&
    !user.isBot &&
    user.username?.toLocaleLowerCase("tr-TR") !==
      currentUsername?.toLocaleLowerCase("tr-TR") &&
    Number(currentUserStarCount || 0) < Number(user.roleStarCount || 0);

  const getRoleDisplayUser = (user: RoomUser): RoomUser => {
    if (!isCurrentUserCard(user)) {
      const stableRolePatch = getAuthoritativeRolePatch(user.username);
      return stableRolePatch
        ? {
            ...user,
            ...stableRolePatch,
          }
        : user;
    }

    if (!currentUserRoleReady) {
      return {
        ...user,
        roleName: null,
        roleIcon: null,
        roleStarColor: null,
        roleStarCount: null,
        role: null,
      };
    }

    if (!currentUserRoleSnapshot) {
      return user;
    }

    return {
      ...user,
      roleName: currentUserRoleSnapshot.roleName ?? null,
      roleIcon: currentUserRoleSnapshot.roleIcon ?? null,
      roleStarColor: currentUserRoleSnapshot.roleStarColor ?? null,
      roleStarCount: currentUserRoleSnapshot.roleStarCount ?? null,
      role: null,
    };
  };

  const renderRoleBadge = (
    user: RoomUser | null,
    currentUserStarCount: number = 0,
  ) => {
    if (!user) return null;

    if (user.agentNickname) {
      return null;
    }

    if (isTempOperator(user.username)) {
      return (
        <span className="inline-flex max-w-full flex-wrap items-center gap-1 break-words text-sm text-zinc-500">
          <span className="inline-flex items-center gap-0.5">
            <Star
              className="h-3.5 w-3.5"
              style={{ color: TEMP_OPERATOR_STAR_COLOR }}
              fill="currentColor"
            />
          </span>
        </span>
      );
    }

    // Tüm olası alanlarda nick_raw/nick_style formatını ara
    const roleData = user.role;
    const roleNameData = user.roleName;
    const roleTitleData = user.role_title;

    // Önce role objesini kontrol et
    let nickStyleData = parseNickStyleData(roleData);

    // role'da bulunamadıysa roleName'i kontrol et
    if (!nickStyleData) {
      nickStyleData = parseNickStyleData(roleNameData);
    }

    // roleName'de de bulunamadıysa role_title'ı kontrol et
    if (!nickStyleData) {
      nickStyleData = parseNickStyleData(roleTitleData);
    }

    // nick_raw ve nick_style bulunduysa render et
    if (nickStyleData) {
      const renderedText = nickStyleData.nick_style.replace(
        "{TEXT}",
        nickStyleData.nick_raw,
      );
      const rootNickClass = isRootUsername(user.username)
        ? "text-[18px] font-extrabold leading-none text-zinc-900"
        : "text-sm text-zinc-500";
      return (
        <span
          className={`inline-flex max-w-full flex-wrap items-center gap-1 break-words ${rootNickClass}`}
        >
          <span
            className={`inline-flex items-center ${
              isRootUsername(user.username) ? "font-extrabold" : "font-semibold"
            }`}
          >
            {renderedText}
          </span>
        </span>
      );
    }

    // Eski format için (geriye uyumluluk)
    const rawRoleIcon =
      user.roleIcon ?? user.role?.icon ?? null;
    const rawRoleStarCount =
      user.roleStarCount ??
      user.roleStar ??
      user.role_star_count ??
      user.role_star ??
      user.role?.starCount ??
      user.role?.star_count ??
      null;
    const numericStarCount = Number(rawRoleStarCount);
    const rawRoleName =
      typeof roleNameData === "string"
        ? roleNameData
        : typeof roleData?.name === "string"
          ? roleData.name
          : typeof roleTitleData === "string"
            ? roleTitleData
            : null;
    const roleCatalogMatchByName = rawRoleName
      ? roleCatalogByName.get(normalizeRoleLookupKey(rawRoleName))
      : null;
    const rawRoleStarCountValue = Number.isFinite(numericStarCount)
      ? Math.max(0, Math.floor(numericStarCount))
      : 0;
    const roleCatalogMatchByStarCount =
      rawRoleStarCountValue > 0
        ? roleCatalogByStarCount.get(rawRoleStarCountValue)
        : null;
    const roleCatalogMatch =
      roleCatalogMatchByStarCount ?? roleCatalogMatchByName ?? null;
    const catalogStarCount = Number(roleCatalogMatch?.starCount);
    const roleStarCount =
      rawRoleStarCountValue > 0
        ? rawRoleStarCountValue
        : Number.isFinite(catalogStarCount)
          ? Math.max(0, Math.floor(catalogStarCount))
          : 0;
    const roleIcon =
      typeof rawRoleIcon === "string" && rawRoleIcon.trim().length > 0
        ? rawRoleIcon.trim()
        : roleCatalogMatch?.icon?.trim() || null;

    // roleName JSON değilse normal string olarak al
    let roleName: string | null = null;
    if (
      typeof roleNameData === "string" &&
      !roleNameData.includes("nick_raw")
    ) {
      roleName = formatRoleLabel(roleNameData);
    } else if (typeof roleData?.name === "string") {
      roleName = formatRoleLabel(roleData.name);
    } else if (
      typeof roleTitleData === "string" &&
      !roleTitleData.includes("nick_raw")
    ) {
      roleName = formatRoleLabel(roleTitleData);
    }
    if ((!roleName || !roleName.trim()) && roleCatalogMatch?.name) {
      roleName = formatRoleLabel(roleCatalogMatch.name);
    }
    const roleStarColor =
      user.roleStarColor ??
      user.role?.starColor ??
      user.role?.star_color ??
      user.role_star_color ??
      roleCatalogMatch?.starColor ??
      null;
    const shouldPreferStarDisplay =
      !roleIcon && roleStarCount >= 1 && roleStarCount <= 25;
    const shouldShowStars =
      (shouldPreferStarDisplay || (!roleIcon && !roleName)) &&
      roleStarCount > 0;

    if (!roleIcon && !shouldShowStars && !roleName) {
      return null;
    }

    const hasRoleColor =
      typeof roleStarColor === "string" && roleStarColor.trim().length > 0;
    const resolvedStarColor = hasRoleColor
      ? (roleStarColor as string).trim()
      : "#FFD700";

    if (roleIcon) {
      return (
        <RoleBadgeView
          variant="icon"
          text={roleIcon}
          color={hasRoleColor ? resolvedStarColor : null}
        />
      );
    }

    if (shouldShowStars) {
      return (
        <RoleBadgeView
          variant="stars"
          starCount={roleStarCount}
          color={resolvedStarColor}
        />
      );
    }

    if (!roleName) {
      return null;
    }

    return <RoleBadgeView variant="text" text={roleName} />;
  };

  useEffect(() => {
    let cancelled = false;

    const fetchRoles = async () => {
      try {
        const response = await apiClientRef.current.get("/roles");
        if (!cancelled) {
          setRoleCatalog(Array.isArray(response.data) ? response.data : []);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Role catalog could not be loaded for sidebar:", error);
        }
      }
    };

    void fetchRoles();

    return () => {
      cancelled = true;
    };
  }, []);

  const [wallPosts, setWallPosts] = useState<WallPost[]>([]);
  const [wallLoading, setWallLoading] = useState(false);
  const [wallError, setWallError] = useState<string | null>(null);
  const [showWallModal, setShowWallModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [selectedStoryPost, setSelectedStoryPost] = useState<WallPost | null>(
    null,
  );
  const [selectedStoryViews, setSelectedStoryViews] = useState<WallPostView[]>(
    [],
  );
  const [storyViewCount, setStoryViewCount] = useState(0);
  const [storyViewersOpen, setStoryViewersOpen] = useState(false);
  const [selectedStoryPanel, setSelectedStoryPanel] = useState<
    "comments" | "views" | null
  >(null);
  const [selectedStoryGroupPosts, setSelectedStoryGroupPosts] = useState<
    WallPost[]
  >([]);
  const [selectedStoryIndex, setSelectedStoryIndex] = useState(0);
  const [storyPanelTouchStartY, setStoryPanelTouchStartY] = useState<
    number | null
  >(null);
  const [openWallComments, setOpenWallComments] = useState<Set<number>>(
    new Set(),
  );
  const [wallComments, setWallComments] = useState<
    Record<number, WallPostComment[]>
  >({});
  const [wallCommentsLoading, setWallCommentsLoading] = useState<
    Record<number, boolean>
  >({});
  const [wallCommentInputs, setWallCommentInputs] = useState<
    Record<number, string>
  >({});
  const [profileComments, setProfileComments] = useState<ProfileComment[]>([]);
  const [pendingProfileComments, setPendingProfileComments] = useState<
    ProfileComment[]
  >([]);
  const [myPendingProfileComments, setMyPendingProfileComments] = useState<
    ProfileComment[]
  >([]);
  const [profileCommentsLoading, setProfileCommentsLoading] = useState(false);
  const [pendingProfileCommentsLoading, setPendingProfileCommentsLoading] =
    useState(false);
  const [myPendingProfileCommentsLoading, setMyPendingProfileCommentsLoading] =
    useState(false);
  const [profileCommentInput, setProfileCommentInput] = useState("");
  const [profileCommentSubmitting, setProfileCommentSubmitting] = useState(false);
  const [profileCommentApprovingId, setProfileCommentApprovingId] = useState<
    number | null
  >(null);
  const [profileCommentDeletingId, setProfileCommentDeletingId] = useState<
    number | null
  >(null);
  const wallPostsSignatureRef = useRef("");
  const viewedWallPostIdsRef = useRef<Set<number>>(new Set());
  const wallCommentsSignatureRef = useRef<Record<number, string>>({});

  const callsForDisplay = callHistory.map((call) => {
    const date = new Date(call.startedAt);
    const time = Number.isFinite(date.getTime())
      ? date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
      : "";
    const type =
      call.status === "missed"
        ? ("missed" as const)
        : call.direction === "incoming"
          ? ("incoming" as const)
          : ("outgoing" as const);
    const duration =
      call.status === "completed" && call.durationSec !== undefined
        ? `${Math.floor(call.durationSec / 60)}:${String(
            call.durationSec % 60,
          ).padStart(2, "0")}`
        : null;
    return {
      id: call.id,
      callId: call.callId,
      name: call.peerName,
      time,
      duration,
      type,
    };
  });

  const formatWallTime = (value: string) => {
    const normalizeWallTimeValue = (rawValue: string) => {
      const trimmedValue = rawValue.trim();
      if (!trimmedValue) return trimmedValue;

      const hasExplicitTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(trimmedValue);
      if (hasExplicitTimezone) {
        return trimmedValue;
      }

      const match = trimmedValue.match(
        /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/,
      );
      if (!match) {
        return trimmedValue;
      }

      const [, year, month, day, hour, minute, second = "00", millisecond] =
        match;
      const normalizedMillisecond = (millisecond ?? "000").padEnd(3, "0");
      return `${year}-${month}-${day}T${hour}:${minute}:${second}.${normalizedMillisecond}Z`;
    };

    const normalizedValue =
      typeof value === "string" ? normalizeWallTimeValue(value) : value;
    const date = new Date(normalizedValue);
    if (!Number.isFinite(date.getTime())) return "";
    return date.toLocaleString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Europe/Istanbul",
    });
  };
  const wallTimestampClassName =
    "inline-flex items-center rounded-full bg-white/85 px-2 py-0.5 text-[11px] font-medium text-zinc-800 shadow-sm ring-1 ring-black/10 backdrop-blur-sm";
  const getWallCardTheme = (backgroundColor?: string | null) => {
    const fallbackTheme = {
      titleColor: "#111827",
      bodyColor: "#1f2937",
      mutedColor: "#4b5563",
      actionColor: "#4b5563",
      staffBadgeClassName:
        "inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600",
    };

    if (!backgroundColor) {
      return fallbackTheme;
    }

    const normalizedHex = backgroundColor.trim();
    const hexMatch = normalizedHex.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!hexMatch) {
      return fallbackTheme;
    }

    const hexValue =
      hexMatch[1].length === 3
        ? hexMatch[1]
            .split("")
            .map((char) => `${char}${char}`)
            .join("")
        : hexMatch[1];

    const red = Number.parseInt(hexValue.slice(0, 2), 16);
    const green = Number.parseInt(hexValue.slice(2, 4), 16);
    const blue = Number.parseInt(hexValue.slice(4, 6), 16);
    const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
    const isDarkBackground = luminance < 0.45;

    if (isDarkBackground) {
      return {
        titleColor: "#f8fafc",
        bodyColor: "#f8fafc",
        mutedColor: "rgba(255, 255, 255, 0.82)",
        actionColor: "rgba(255, 255, 255, 0.88)",
        staffBadgeClassName:
          "inline-flex items-center gap-1 rounded-full bg-white/12 px-2 py-0.5 text-[10px] font-semibold text-white ring-1 ring-white/20",
      };
    }

    return fallbackTheme;
  };
  const filteredCalls = callsForDisplay
    .filter((call) => (callFilter === "all" ? true : call.type === callFilter))
    .filter((call) =>
      searchQuery.trim()
        ? call.name.toLowerCase().includes(searchQuery.toLowerCase())
        : true,
    );

  const filteredWallPosts = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    if (!term) return wallPosts;
    return wallPosts.filter((post) => {
      const contentMatch = post.content?.toLowerCase().includes(term) ?? false;
      const userMatch = post.user.username.toLowerCase().includes(term);
      return contentMatch || userMatch;
    });
  }, [wallPosts, searchQuery]);

  // Room names are also needed by the "Tüm Kişiler" tab to resolve voice ids.
  useEffect(() => {
    fetchRooms();
  }, []);

  // Fetch rooms when "rooms" tab is active
  useEffect(() => {
    if (activeTab === "rooms") {
      fetchRooms();
    }
  }, [activeTab]);

  // Fetch friends data when "friends" tab is active
  useEffect(() => {
    if (activeTab === "friends") {
      fetchFriendsData();
    }
  }, [activeTab]);

  const selectedUserIsBot = selectedUser?.isBot === true;

  useEffect(() => {
    if (!socket) return;

    const handleRoomUpdated = async () => {
      try {
        const data = await apiClient.rooms.getRooms();
        setRooms(data);
      } catch (err) {
        console.error("Updated rooms could not be refreshed:", err);
      }
    };

    socket.on("room:updated", handleRoomUpdated);

    return () => {
      socket.off("room:updated", handleRoomUpdated);
    };
  }, [socket]);

  const getRoomLogoUrl = (
    logo: string | null | undefined,
    updatedAt?: string | Date | null,
  ) => {
    const imageBase =
      process.env.NEXT_PUBLIC_IMAGE_ACCESS_URL?.replace(/\/$/, "") || "";
    const assetPath = logo?.replace(/^\/+/, "") || "";

    if (!assetPath) {
      return null;
    }

    const baseUrl =
      assetPath && imageBase ? `${imageBase}/${assetPath}` : assetPath;
    const cacheKey = updatedAt ? new Date(updatedAt).getTime() : NaN;

    if (!Number.isFinite(cacheKey)) {
      return baseUrl;
    }

    const separator = baseUrl.includes("?") ? "&" : "?";
    return `${baseUrl}${separator}v=${cacheKey}`;
  };

  useEffect(() => {
    fetchFriendsData();
  }, []);

  // Filter rooms based on search query
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredRooms(rooms);
    } else {
      const filtered = rooms.filter((room) =>
        room.name.toLowerCase().includes(searchQuery.toLowerCase()),
      );
      setFilteredRooms(filtered);
    }
  }, [searchQuery, rooms]);

  useEffect(() => {
    if (isGuestUser) return;
    const trimmedQuery = searchQuery.trim();
    if (trimmedQuery.length < 2) return;

    const scope = activeTab;
    const searchKey = `${scope}:${trimmedQuery.toLowerCase()}`;
    if (lastSearchKeyRef.current === searchKey) return;

    const getResultsCount = () => {
      if (scope === "rooms") return filteredRooms.length;
      if (scope === "calls") return filteredCalls.length;
      if (scope === "friends") {
        if (friendFilter === "incoming") return filteredIncoming.length;
        if (friendFilter === "outgoing") return filteredOutgoing.length;
        return filteredFriends.length;
      }
      if (scope === "all") return filteredAllUsers.length;
      if (scope === "wall") return wallPosts.length;
      return visibleUsers.length;
    };

    const timer = setTimeout(async () => {
      try {
        await apiClient.searchHistory.createSearchHistory({
          query: trimmedQuery,
          scope,
          resultsCount: getResultsCount(),
        });
        lastSearchKeyRef.current = searchKey;
      } catch (error) {
        console.error("Search history log failed:", error);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [
    activeTab,
    searchQuery,
    isGuestUser,
    filteredRooms.length,
    filteredCalls.length,
    filteredFriends.length,
    filteredIncoming.length,
    filteredOutgoing.length,
    filteredAllUsers.length,
    friendFilter,
    visibleUsers.length,
    wallPosts.length,
  ]);

  const fetchRooms = async () => {
    try {
      setIsLoadingRooms(true);
      const data = await apiClient.rooms.getRooms();
      setRooms(data);
      setFilteredRooms(data);
    } catch (err) {
      console.error("Error fetching rooms:", err);
    } finally {
      setIsLoadingRooms(false);
    }
  };

  const fetchFriendsData = async (): Promise<FriendRequest[]> => {
    if (isGuestUser) {
      setFriends([]);
      setIncomingRequests([]);
      setOutgoingRequests([]);
      incomingRequestIdsRef.current = new Set();
      setIgnoredUsernames(new Set());
      const currentPreferences = readChatPreferencesFromStorage();
      writeChatPreferencesToStorage({
        ...currentPreferences,
        ignoredUsernames: [],
      });
      setFriendsLoading(false);
      setFriendsError(null);
      return [];
    }
    try {
      setFriendsLoading(true);
      setFriendsError(null);
      const [friendsRes, incomingRes, outgoingRes, ignoredRes] = await Promise.all([
        apiClient.friends.getFriends(),
        apiClient.friends.getIncomingRequests(),
        apiClient.friends.getOutgoingRequests(),
        apiClient.friends.getIgnoredUsers(),
      ]);
      setFriends(friendsRes);
      setIncomingRequests(incomingRes);
      incomingRequestIdsRef.current = toFriendRequestIdSet(incomingRes);
      setOutgoingRequests(outgoingRes);
      const normalizedIgnored = Array.from(
        new Set(ignoredRes.map((username) => normalizeUsername(username)).filter(Boolean)),
      );
      setIgnoredUsernames(new Set(normalizedIgnored));
      const currentPreferences = readChatPreferencesFromStorage();
      writeChatPreferencesToStorage({
        ...currentPreferences,
        ignoredUsernames: normalizedIgnored,
      });
      return incomingRes;
    } catch (err) {
      console.error("Friends fetch failed:", err);
      setFriendsError("Arkadaş listesi alınamadı.");
      return incomingRequests;
    } finally {
      setFriendsLoading(false);
    }
  };

  useEffect(() => {
    incomingRequestIdsRef.current = toFriendRequestIdSet(incomingRequests);
  }, [incomingRequests]);

  useEffect(() => {
    if (isGuestUser) {
      incomingRequestIdsRef.current = new Set();
      return;
    }

    let canceled = false;
    apiClient.friends
      .getIncomingRequests()
      .then((requests) => {
        if (canceled) return;
        setIncomingRequests(requests);
        incomingRequestIdsRef.current = toFriendRequestIdSet(requests);
      })
      .catch(() => {});

    return () => {
      canceled = true;
    };
  }, [isGuestUser]);

  const refreshDmUnreadCount = useCallback(async () => {
    try {
      const data = await apiClient.directMessages.getUnreadCount();
      const pendingCount = Object.values(
        pendingDmConversationCountsRef.current,
      ).reduce((sum, count) => sum + count, 0);
      const nextUnreadCount = Math.max(data?.unreadCount ?? 0, pendingCount);
      setDmUnreadCount(nextUnreadCount);
    } catch (error) {
      if (
        error instanceof ApiError &&
        /timeout/i.test(error.message || "")
      ) {
        return;
      }
      console.error("DM unread count fetch failed:", error);
    }
  }, [isGuestUser]);

  useEffect(() => {
    refreshDmUnreadCount();
  }, [refreshDmUnreadCount]);

  useEffect(() => {
    const delayedRefreshId = window.setTimeout(() => {
      void refreshDmUnreadCount();
    }, 1200);
    const pollingRefreshId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refreshDmUnreadCount();
      }
    }, 5000);

    const handleWindowFocus = () => {
      void refreshDmUnreadCount();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshDmUnreadCount();
      }
    };

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearTimeout(delayedRefreshId);
      window.clearInterval(pollingRefreshId);
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshDmUnreadCount]);

  const fetchWallPosts = async (options?: { silent?: boolean }) => {
    if (isGuestUser) {
      setWallPosts([]);
      setWallLoading(false);
      setWallError(null);
      wallPostsSignatureRef.current = "";
      return;
    }
    try {
      if (!options?.silent) {
        setWallLoading(true);
        setWallError(null);
      }
      const data = await apiClient.wallPosts.list({ limit: 50, offset: 0 });
      const nextSignature = JSON.stringify(data);
      if (wallPostsSignatureRef.current !== nextSignature) {
        wallPostsSignatureRef.current = nextSignature;
        setWallPosts(data);
      }
    } catch (err) {
      console.error("Wall posts fetch failed:", err);
      setWallError("Duvar yazıları alınamadı.");
    } finally {
      if (!options?.silent) {
        setWallLoading(false);
      }
    }
  };

  const fetchWallComments = async (
    postId: number,
    options?: { silent?: boolean },
  ) => {
    if (!options?.silent) {
      setWallCommentsLoading((prev) => ({ ...prev, [postId]: true }));
    }
    try {
      const data = await apiClient.wallPosts.listComments(postId);
      const nextSignature = JSON.stringify(data);
      if (wallCommentsSignatureRef.current[postId] !== nextSignature) {
        wallCommentsSignatureRef.current[postId] = nextSignature;
        setWallComments((prev) => ({ ...prev, [postId]: data }));
      }
    } catch (err) {
      console.error("Comments fetch failed:", err);
    } finally {
      if (!options?.silent) {
        setWallCommentsLoading((prev) => ({ ...prev, [postId]: false }));
      } else {
        setWallCommentsLoading((prev) => {
          if (!prev[postId]) return prev;
          return { ...prev, [postId]: false };
        });
      }
    }
  };

  useEffect(() => {
    if (
      (activeTab === "wall" ||
        (mobileRoomsFullscreen && mobileRoomsDirectoryTab === "wall")) &&
      !isGuestUser
    ) {
      fetchWallPosts();
    }
  }, [activeTab, isGuestUser, mobileRoomsDirectoryTab, mobileRoomsFullscreen]);

  useEffect(() => {
    if (
      !(
        activeTab === "wall" ||
        (mobileRoomsFullscreen && mobileRoomsDirectoryTab === "wall")
      ) ||
      isGuestUser
    ) {
      return;
    }

    const intervalId = window.setInterval(async () => {
      await fetchWallPosts({ silent: true });

      const openPostIds = Array.from(openWallComments);
      if (openPostIds.length > 0) {
        await Promise.all(
          openPostIds.map((postId) =>
            fetchWallComments(postId, { silent: true }),
          ),
        );
      }
    }, 1500);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [
    activeTab,
    isGuestUser,
    mobileRoomsDirectoryTab,
    mobileRoomsFullscreen,
    openWallComments,
  ]);

  useEffect(() => {
    if (!socket) return;

    const handleWallPostsUpdated = async (data?: {
      action?: string;
      postId?: number;
      commentId?: number;
    }) => {
      await fetchWallPosts({ silent: true });
      const openPostIds = Array.from(openWallComments);

      if (openPostIds.length > 0) {
        await Promise.all(
          openPostIds.map((postId) =>
            fetchWallComments(postId, { silent: true }),
          ),
        );
      }

      // API/db görünürlüğü birkaç yüz ms gecikirse ikinci kez senkronize ol.
      window.setTimeout(async () => {
        await fetchWallPosts({ silent: true });
        if (openPostIds.length > 0) {
          await Promise.all(
            openPostIds.map((postId) =>
              fetchWallComments(postId, { silent: true }),
            ),
          );
        }
      }, 300);
    };

    socket.on("wall-posts:updated", handleWallPostsUpdated);

    return () => {
      socket.off("wall-posts:updated", handleWallPostsUpdated);
    };
  }, [socket, isGuestUser, openWallComments]);

  const roomSlug = (room: Room) => room.name.trim().replace(/\s+/g, "-");

  function getLiveCount(roomKey: string | null | undefined) {
    if (!roomKey) return { value: roomCountsLoaded ? 0 : null, isReady: false };
    if (Object.prototype.hasOwnProperty.call(roomCounts, roomKey)) {
      return { value: roomCounts[roomKey], isReady: true };
    }
    if (roomCountsLoaded) {
      return { value: 0, isReady: true };
    }
    return { value: null, isReady: false };
  }

  const navigateToRoom = (room: Room) => {
    // Oda değiştirirken eski odaya sistem mesajı gönder
    if (
      socket &&
      currentUsername &&
      currentRoomId &&
      room.name !== currentRoomName
    ) {
      const isOnRoof = localStorage.getItem("roofStatus") === "true";

      // Çatıdayken veya aynı odaya geçerken mesaj atma
      if (!isOnRoof) {
        const transitionActor = effectiveAgentNickname || currentUsername;
        socket.emit("sendMessage", {
          room: currentRoomId,
          username: currentUsername,
          message: `__TRANSITION__:${transitionActor}:${room.name}`,
          // isSystemMessage: true'yu kaldırıyoruz çünkü bazı backend'ler
          // bu flag varsa username'i "Sistem" olarak eziyor.
        });
      }
    }

    // Mesajın iletilmesi için bekleme (navigasyon gecikmesi)
    setTimeout(() => {
      setRoomNavigationIntent("sidebar");
      router.push(`/chat/${roomSlug(room)}`);
    }, 500);
  };

  const handleCreateWallPost = async (payload: {
    content?: string;
    image?: string;
    backgroundColor?: string;
    visibility: "members" | "staff";
  }) => {
    const created = await apiClient.wallPosts.create(payload);
    await fetchWallPosts({ silent: true });
    socket?.emit("wall-posts:updated", {
      action: "created",
      postId: created.id,
    });
  };

  const handleToggleWallLike = async (postId: number) => {
    if (isGuestUser) return;
    try {
      const result = await apiClient.wallPosts.toggleLike(postId);
      setWallPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? { ...post, isLiked: result.liked, likeCount: result.likeCount }
            : post,
        ),
      );
      socket?.emit("wall-posts:updated", {
        action: "liked",
        postId,
      });
    } catch (err) {
      console.error("Like toggle failed:", err);
    }
  };

  const handleToggleComments = async (postId: number) => {
    setOpenWallComments((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) {
        next.delete(postId);
      } else {
        next.add(postId);
      }
      return next;
    });

    if (!wallComments[postId] && !wallCommentsLoading[postId]) {
      await fetchWallComments(postId);
    }
  };

  const handleSubmitComment = async (postId: number) => {
    if (isGuestUser) return;
    const value = (wallCommentInputs[postId] || "").trim();
    if (!value) return;

    try {
      const created = await apiClient.wallPosts.addComment(postId, value);
      setWallComments((prev) => ({
        ...prev,
        [postId]: [...(prev[postId] || []), created],
      }));
      setWallCommentInputs((prev) => ({ ...prev, [postId]: "" }));
      setWallPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? { ...post, commentCount: post.commentCount + 1 }
            : post,
        ),
      );
      setSelectedStoryPost((prev) =>
        prev?.id === postId
          ? { ...prev, commentCount: prev.commentCount + 1 }
          : prev,
      );
      socket?.emit("wall-posts:updated", {
        action: "comment_created",
        postId,
        commentId: created.id,
      });
    } catch (err) {
      console.error("Add comment failed:", err);
    }
  };

  const handleDeleteWallPost = async (postId: number) => {
    if (isGuestUser) return;
    const targetPost = wallPosts.find((post) => post.id === postId);
    if (!targetPost) return;
    const isOwnPost = targetPost.user.id === currentUserId;
    if (!isOwnPost && !canDeleteWallUserContent(targetPost.user.starCount)) {
      toast.error("Bu duvar yazısını silme yetkiniz yok.");
      return;
    }
    const confirmed = window.confirm("Bu duvar yazısını silmek istiyor musunuz?");
    if (!confirmed) return;

    try {
      await apiClient.wallPosts.deletePost(postId);
      setWallPosts((prev) => prev.filter((post) => post.id !== postId));
      setWallComments((prev) => {
        const next = { ...prev };
        delete next[postId];
        return next;
      });
      setWallCommentsLoading((prev) => {
        const next = { ...prev };
        delete next[postId];
        return next;
      });
      setWallCommentInputs((prev) => {
        const next = { ...prev };
        delete next[postId];
        return next;
      });
      setOpenWallComments((prev) => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });
      socket?.emit("wall-posts:updated", {
        action: "deleted",
        postId,
      });
      if (selectedStoryPost?.id === postId) {
        setSelectedStoryPost(null);
        setSelectedStoryViews([]);
        setStoryViewCount(0);
        setStoryViewersOpen(false);
        setSelectedStoryPanel(null);
        setSelectedStoryGroupPosts([]);
        setSelectedStoryIndex(0);
      }
    } catch (err) {
      console.error("Delete wall post failed:", err);
    }
  };

  const sortWallPostsOldestFirst = (posts: WallPost[]) =>
    [...posts].sort(
      (first, second) =>
        new Date(first.createdAt).getTime() -
        new Date(second.createdAt).getTime(),
    );

  const getStoryStartIndex = (
    groupPosts: WallPost[],
    requestedPost: WallPost,
    preserveRequestedPost = false,
  ) => {
    if (preserveRequestedPost) {
      return Math.max(
        0,
        groupPosts.findIndex((item) => item.id === requestedPost.id),
      );
    }

    const firstUnviewedIndex = groupPosts.findIndex((item) => !item.isViewed);
    if (firstUnviewedIndex >= 0) return firstUnviewedIndex;
    return Math.max(0, groupPosts.length - 1);
  };

  const openStoryPost = async (
    post: WallPost,
    panel: "comments" | "views" | null = null,
    options?: { preservePost?: boolean },
  ) => {
    const groupPosts = sortWallPostsOldestFirst(
      filteredWallPosts.filter((item) => item.user.id === post.user.id),
    );
    const groupIndex = getStoryStartIndex(
      groupPosts,
      post,
      options?.preservePost,
    );
    await showStoryPost(groupPosts[groupIndex] || post, panel, {
      groupPosts,
      groupIndex,
    });
  };

  const showStoryPost = async (
    post: WallPost,
    panel: "comments" | "views" | null = selectedStoryPanel,
    options?: { groupPosts?: WallPost[]; groupIndex?: number },
  ) => {
    const groupPosts = options?.groupPosts || selectedStoryGroupPosts;
    const groupIndex =
      options?.groupIndex ??
      Math.max(
        0,
        groupPosts.findIndex((item) => item.id === post.id),
      );

    setSelectedStoryPost(post);
    setSelectedStoryPanel(panel);
    setSelectedStoryGroupPosts(groupPosts);
    setSelectedStoryIndex(groupIndex);
    setStoryViewersOpen(panel === "views" && post.user.id === currentUserId);
    setSelectedStoryViews([]);
    setStoryViewCount(0);

    if (post.user.id !== currentUserId) {
      try {
        viewedWallPostIdsRef.current.add(post.id);
        await apiClient.wallPosts.markViewed(post.id);
        setWallPosts((prev) =>
          prev.map((item) =>
            item.id === post.id ? { ...item, isViewed: true } : item,
          ),
        );
        setSelectedStoryPost((prev) =>
          prev?.id === post.id ? { ...prev, isViewed: true } : prev,
        );
        setSelectedStoryGroupPosts((prev) =>
          prev.map((item) =>
            item.id === post.id ? { ...item, isViewed: true } : item,
          ),
        );
      } catch (err) {
        viewedWallPostIdsRef.current.delete(post.id);
        console.error("Story view mark failed:", err);
      }
    }

    if (
      panel === "comments" &&
      !wallComments[post.id] &&
      !wallCommentsLoading[post.id]
    ) {
      void fetchWallComments(post.id);
    }

    if (panel === "views" && post.user.id === currentUserId) {
      try {
        const views = await apiClient.wallPosts.listViews(post.id);
        setSelectedStoryViews(views);
        setStoryViewCount(views.length);
      } catch (err) {
        console.error("Story views fetch failed:", err);
      }
    }
  };

  const navigateSelectedStory = (direction: -1 | 1) => {
    if (!selectedStoryPost || selectedStoryGroupPosts.length <= 1) return;
    const nextIndex = selectedStoryIndex + direction;
    if (nextIndex < 0 || nextIndex >= selectedStoryGroupPosts.length) return;
    void showStoryPost(
      selectedStoryGroupPosts[nextIndex],
      selectedStoryPanel,
      {
        groupPosts: selectedStoryGroupPosts,
        groupIndex: nextIndex,
      },
    );
  };

  const closeStoryPanels = () => {
    setSelectedStoryPanel(null);
    setStoryViewersOpen(false);
  };

  const handleStoryPanelTouchEnd = (clientY: number) => {
    if (storyPanelTouchStartY === null) return;
    if (clientY - storyPanelTouchStartY > 50) {
      closeStoryPanels();
    }
    setStoryPanelTouchStartY(null);
  };

  const handleDeleteWallComment = async (postId: number, commentId: number) => {
    if (isGuestUser) return;
    const targetComment = (wallComments[postId] || []).find(
      (comment) => comment.id === commentId,
    );
    const isOwnComment = targetComment?.user.id === currentUserId;
    if (
      !isOwnComment &&
      !canDeleteWallUserContent(targetComment?.user.starCount)
    ) {
      toast.error("Bu yorumu silme yetkiniz yok.");
      return;
    }
    const confirmed = window.confirm("Bu yorumu silmek istiyor musunuz?");
    if (!confirmed) return;

    try {
      await apiClient.wallPosts.deleteComment(postId, commentId);
      setWallComments((prev) => ({
        ...prev,
        [postId]: (prev[postId] || []).filter((comment) => comment.id !== commentId),
      }));
      setWallPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? { ...post, commentCount: Math.max(0, post.commentCount - 1) }
            : post,
        ),
      );
      setSelectedStoryPost((prev) =>
        prev?.id === postId
          ? { ...prev, commentCount: Math.max(0, prev.commentCount - 1) }
          : prev,
      );
      socket?.emit("wall-posts:updated", {
        action: "comment_deleted",
        postId,
        commentId,
      });
    } catch (err) {
      console.error("Delete wall comment failed:", err);
    }
  };

  const handleRoomClick = (room: Room) => {
    if (room.isPrivate) {
      setPasswordModalRoom(room);
      setRoomPassword("");
      setRoomPasswordError(null);
      return;
    }
    navigateToRoom(room);
    onMobileRoomClose?.();
  };

  const submitRoomPassword = async () => {
    if (!passwordModalRoom) return;
    if (!roomPassword.trim()) {
      setRoomPasswordError("Şifre girin");
      return;
    }
    try {
      setIsVerifyingPassword(true);
      setRoomPasswordError(null);
      const res = await apiClientRef.current.post("/rooms/verify-password", {
        roomName: passwordModalRoom.name,
        password: roomPassword.trim(),
      });
      if (res?.data?.isValid) {
        navigateToRoom(passwordModalRoom);
        onMobileRoomClose?.();
        setPasswordModalRoom(null);
        setRoomPassword("");
      } else {
        setRoomPasswordError("Şifre hatalı");
      }
    } catch (err) {
      console.error("Room password verify failed", err);
      setRoomPasswordError("Şifre doğrulanamadı");
    } finally {
      setIsVerifyingPassword(false);
    }
  };

  // Socket ile oda kullanıcı sayılarını iste
  useEffect(() => {
    const socketUrl =
      process.env.NEXT_PUBLIC_SOCKET_URL || "https://king.akdenizbirlik.com";

    if (!countsSocketRef.current) {
      countsSocketRef.current = io(socketUrl, {
        transports: ["websocket", "polling"],
        autoConnect: false,
      });
    }

    const socket = countsSocketRef.current;
    const connectTimeoutId = window.setTimeout(() => {
      if (!socket.connected) {
        socket.connect();
      }
    }, 0);

    const handleRoomCounts = (data: RoomCountsEvent) => {
      // Desteklenen formatlar:
      // 1) [{ room: "voice_x", count: 3 }]
      // 2) { voice_x: 3 }
      // 3) { counts: { voice_x: 3 } }
      if (Array.isArray(data)) {
        setRoomCountsLoaded(true);
        setRoomCounts((prev) => {
          const next = { ...prev };
          data.forEach((item) => {
            if (item?.room) next[String(item.room)] = item.count ?? 0;
          });
          return next;
        });
      } else if (data && typeof data === "object") {
        setRoomCountsLoaded(true);
        const countsPayload =
          "counts" in data && data.counts && typeof data.counts === "object"
            ? data.counts
            : data;
        setRoomCounts((prev) => {
          const next = { ...prev };
          Object.entries(countsPayload).forEach(([key, value]) => {
            next[String(key)] = typeof value === "number" ? value : 0;
          });
          return next;
        });
      }
    };

    socket.on("room:counts", handleRoomCounts);

    const voiceIds = filteredRooms
      .map((room) => room.voiceId || room.name)
      .map((id) => String(id))
      .filter(Boolean);
    const currentRoomAliases = [currentRoomId, currentRoomName]
      .map((room) => String(room || "").trim())
      .filter(Boolean);
    const uniqueRoomIds = Array.from(new Set([...voiceIds, ...currentRoomAliases]));

    if (uniqueRoomIds.length) {
      socket.emit("room:getCounts", { rooms: uniqueRoomIds });
    }

    return () => {
      window.clearTimeout(connectTimeoutId);
      socket.off("room:counts", handleRoomCounts);
    };
  }, [filteredRooms, currentRoomId, currentRoomName]);

  // Cleanup socket on unmount
  useEffect(() => {
    return () => {
      countsSocketRef.current?.disconnect();
      countsSocketRef.current = null;
    };
  }, []);

  // Tenant kullanıcı verisini RoomUser formatına dönüştür
  const formatTenantUserList = useCallback(
    (rawUsers: TenantRawUser[], inRoomUsers: RoomUser[]): RoomUser[] => {
      return rawUsers.map((user) => {
        const normalizedSearch = normalizeUsername(user.username);
        const inRoomUser = inRoomUsers.find(
          (u) => normalizeUsername(u.username) === normalizedSearch,
        );
        return {
          id: normalizedSearch || String(user.socketId || user.username || ""),
          socketId: user.socketId ?? null,
          username: user.username,
          gender: user.gender,
          isGuest:
            user.isGuest === true ||
            user.guest === true ||
            inRoomUser?.isGuest === true,
          statusModeName: user.statusModeName || null,
          statusModeId: user.statusModeId || null,
          roleName: Object.prototype.hasOwnProperty.call(user, "roleName")
            ? user.roleName || null
            : undefined,
          roleIcon: Object.prototype.hasOwnProperty.call(user, "roleIcon")
            ? user.roleIcon || null
            : undefined,
          roleStarColor: Object.prototype.hasOwnProperty.call(user, "roleStarColor")
            ? user.roleStarColor || null
            : undefined,
          roleStarCount: Object.prototype.hasOwnProperty.call(user, "roleStarCount")
            ? user.roleStarCount ?? null
            : undefined,
          fontName:
            user.fontName !== undefined ? user.fontName : (inRoomUser?.fontName || null),
          granite:
            user.granite !== undefined ? user.granite : (inRoomUser?.granite || null),
          nickColor:
            user.nickColor !== undefined ? user.nickColor : (inRoomUser?.nickColor || null),
          userGif:
            user.userGif !== undefined ? user.userGif : (inRoomUser?.userGif || null),
          flashNick:
            user.flashNick !== undefined ? user.flashNick : (inRoomUser?.flashNick || null),
          joinEffect:
            isJoinEffectId(user.joinEffect)
              ? (user.joinEffect as JoinEffectId)
              : inRoomUser?.joinEffect ?? null,
          isBot: user.isBot === true || inRoomUser?.isBot === true,
          isAI: user.isAI === true || inRoomUser?.isAI === true,
          deviceType:
            user.deviceType !== undefined ? user.deviceType : (inRoomUser?.deviceType || null),
          device:
            user.device !== undefined ? user.device : (inRoomUser?.device || null),
          clientType:
            user.clientType !== undefined ? user.clientType : (inRoomUser?.clientType || null),
          frame: user.frame ? `/cerceveler/${user.frame}.png` : null,
          icon: resolveAvatarUrl(user.icon),
          agentNickname: user.agentNickname || null,
          rooms: Array.isArray(user.rooms)
            ? user.rooms.map((room: { roomKey?: string | null; roomName?: string | null }) => ({
                roomKey: room.roomKey || "",
                roomName: resolveRoomDisplayName(room.roomKey, room.roomName),
              }))
            : [],
          micBanned: user.micBanned || false,
          micBannedByStarCount: user.micBannedByStarCount || null,
          cameraBanned: user.cameraBanned || false,
          cameraBannedByStarCount: user.cameraBannedByStarCount || null,
          roomMuted: user.roomMuted || false,
          roomMutedByStarCount: user.roomMutedByStarCount || null,
          globalMuted: user.globalMuted || false,
          globalMutedByStarCount: user.globalMutedByStarCount || null,
          isInVoiceChat: user.isInVoiceChat ?? false,
          isMuted: user.isMuted ?? false,
          isCameraOn: user.isCameraOn ?? false,
          isHandRaised: user.isHandRaised ?? false,
          handRaisedAt: user.handRaisedAt ?? null,
        };
      });
    },
    [resolveRoomDisplayName],
  );

  const applyTenantSnapshot = useCallback(
    (data: {
      tenantId: string;
      count?: number;
      users?: TenantRawUser[];
    }) => {
      const expectedTenantId = env.tenantId
        ? `tenant_${env.tenantId}`
        : "tenant_master";
      const normalizedExpectedTenantId = expectedTenantId.replace(
        /^tenant_/,
        "",
      );
      const normalizedIncomingTenantId = String(data.tenantId || "").replace(
        /^tenant_/,
        "",
      );

      if (normalizedIncomingTenantId !== normalizedExpectedTenantId) {
        return;
      }

      setTenantPresenceReady(true);
      setHasReceivedTenantSnapshot(true);

      if (typeof data.count === "number") {
        setActiveTenantUserCount(data.count);
      }

      if (!Array.isArray(data.users)) {
        return;
      }

      const formattedUsers = formatTenantUserList(data.users, usersRef.current);

      setActiveTenantUsers((prev) => {
        if (formattedUsers.length === 0 && (data.count ?? 0) > 0 && prev.length > 0) {
          return prev;
        }

        const prevByUsername = new Map<string, RoomUser>();
        prev.forEach((candidate) => {
          prevByUsername.set(normalizeUsername(candidate.username), candidate);
        });

        const snapshotUsernames = new Set(
          formattedUsers.map((user) => normalizeUsername(user.username)),
        );
        const roomUsersByUsername = new Map<string, RoomUser>();
        usersRef.current.forEach((roomUser) => {
          const normalizedRoomUser = normalizeUsername(roomUser.username);
          if (normalizedRoomUser) {
            roomUsersByUsername.set(normalizedRoomUser, roomUser);
          }
        });

        const self = currentUsernameRef.current;
        const normalizedSelf = normalizeUsername(self);
        const prevSelf =
          normalizedSelf.length > 0 ? prevByUsername.get(normalizedSelf) ?? null : null;
        const snapshotHasSelf =
          normalizedSelf.length > 0 &&
          formattedUsers.some(
            (user) => normalizeUsername(user.username) === normalizedSelf,
          );
        const nextUsers = self
          ? formattedUsers.map((user) => {
              const normalizedUsername = normalizeUsername(user.username);
              const prevUser = prevByUsername.get(normalizedUsername);
              if (normalizeUsername(user.username) !== normalizeUsername(self)) {
                const stableRolePatch = getStableRolePatch(user.username);
                return {
                  ...user,
                  ...(stableRolePatch ?? {}),
                };
              }

              const currentUserLocal = prevUser;

              if (!currentUserLocal) {
                return user;
              }

              const nextUser = {
                ...user,
                fontName:
                  currentUserLocal.fontName !== undefined
                    ? currentUserLocal.fontName
                    : user.fontName,
                granite:
                  currentUserLocal.granite !== undefined
                    ? currentUserLocal.granite
                    : user.granite,
                nickColor:
                  currentUserLocal.nickColor !== undefined
                    ? currentUserLocal.nickColor
                    : user.nickColor,
                userGif:
                  currentUserLocal.userGif !== undefined
                    ? currentUserLocal.userGif
                    : user.userGif,
                flashNick:
                  currentUserLocal.flashNick !== undefined
                    ? currentUserLocal.flashNick
                    : user.flashNick,
                icon:
                  currentUserLocal.icon !== undefined
                    ? currentUserLocal.icon
                    : user.icon,
                frame:
                  currentUserLocal.frame !== undefined
                    ? currentUserLocal.frame
                    : user.frame,
              };
              const stableRolePatch = getStableRolePatch(user.username);
              return {
                ...nextUser,
                ...(stableRolePatch ?? {}),
              };
            })
          : formattedUsers.map((user) => {
              const stableRolePatch = getStableRolePatch(user.username);
              return {
                ...user,
                ...(stableRolePatch ?? {}),
              };
            });

        if (
          prevSelf &&
          !snapshotHasSelf &&
          ((data.count ?? 0) > 0 || Date.now() < selfPresenceGraceUntilRef.current)
        ) {
          nextUsers.push(prevSelf);
          armSelfPresenceGrace();
        }

        prev.forEach((candidate) => {
          const normalizedCandidate = normalizeUsername(candidate.username);
          if (!normalizedCandidate || snapshotUsernames.has(normalizedCandidate)) {
            return;
          }
          if (normalizedSelf && normalizedCandidate === normalizedSelf) {
            return;
          }
          if (
            (data.count ?? 0) > 0 &&
            (hasActiveUserPresenceGrace(candidate.username) ||
              roomUsersByUsername.has(normalizedCandidate))
          ) {
            const roomUser = roomUsersByUsername.get(normalizedCandidate);
            nextUsers.push(
              roomUser
                ? {
                    ...candidate,
                    ...roomUser,
                    rooms:
                      roomUser.rooms && roomUser.rooms.length > 0
                        ? roomUser.rooms
                        : candidate.rooms,
                  }
                : candidate,
            );
          }
        });

        return reconcileTenantUsers(prev, nextUsers);
      });
    },
    [
      armSelfPresenceGrace,
      formatTenantUserList,
      getStableRolePatch,
      hasActiveUserPresenceGrace,
    ],
  );

  const currentUsernameRef = useRef<string | null>(null);
  useEffect(() => {
    currentUsernameRef.current = currentUsername;
  });

  // Tenant aktif kullanıcı sayısını al (component mount olur olmaz başlat)
  useEffect(() => {
    const socketUrl =
      process.env.NEXT_PUBLIC_SOCKET_URL || "https://king.akdenizbirlik.com";

    // Socket bağlantısı oluştur
    const socket = io(socketUrl, {
      transports: ["websocket", "polling"],
      autoConnect: false,
    });
    const connectTimeoutId = window.setTimeout(() => {
      socket.connect();
    }, 0);

    tenantSocketRef.current = socket;

    // Tenant ID'yi hazırla (tenant_ öneki ile)
    const tenantId = env.tenantId ? `tenant_${env.tenantId}` : "tenant_master";
    const normalizedTenantId = tenantId.replace(/^tenant_/, "");

    // Aktif kullanıcı sayısını ve kullanıcı listesini dinle
    const handleActiveTenantUserCount = (data: {
      tenantId: string;
      count: number;
      users?: Array<{
        socketId: string;
        username: string;
        gender: "male" | "female";
        isGuest: boolean;
        rooms: Array<{ roomKey: string; roomName: string }>;
        statusModeId?: number | null;
        statusModeName?: string | null;
        roleName?: string | null;
        roleStarColor?: string | null;
        roleStarCount?: number | null;
        roleIcon?: string | null;
        fontName?: string | null;
        granite?: string | null;
        nickColor?: string | null;
        userGif?: string | null;
        flashNick?: string | null;
        frame?: string | null;
        icon?: string | null;
        agentNickname?: string | null;
        isInVoiceChat?: boolean;
        isMuted?: boolean;
        isCameraOn?: boolean;
        isHandRaised?: boolean;
        handRaisedAt?: number | null;
        micBanned?: boolean;
        micBannedByStarCount?: number | null;
        cameraBanned?: boolean;
        cameraBannedByStarCount?: number | null;
        roomMuted?: boolean;
        roomMutedByStarCount?: number | null;
        globalMuted?: boolean;
        globalMutedByStarCount?: number | null;
      }>;
    }) => {
      if (String(data.tenantId || "").replace(/^tenant_/, "") !== normalizedTenantId) {
        return;
      }
      applyTenantSnapshot(data);
    };

    const handleUserStyleUpdated = (data: {
      username: string;
      fontName?: string | null;
      granite?: string | null;
      nickColor?: string | null;
      userGif?: string | null;
      flashNick?: string | null;
    }) => {
      const normalized = data.username.trim().toLowerCase();
      armUserPresenceGrace(data.username);
      if (
        currentUsername &&
        normalizeUsername(currentUsername) === normalized
      ) {
        armSelfPresenceGrace();
      }
      setActiveTenantUsers((prev) =>
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
    };

    const handleUserIconChanged = (data: {
      username: string;
      icon?: string | null;
    }) => {
      const iconPath = resolveAvatarUrl(data.icon);

      const normalized = data.username.trim().toLowerCase();
      armUserPresenceGrace(data.username);
      if (
        currentUsername &&
        normalizeUsername(currentUsername) === normalized
      ) {
        armSelfPresenceGrace();
      }
      setActiveTenantUsers((prev) =>
        prev.map((user) =>
          user.username.trim().toLowerCase() === normalized
            ? { ...user, icon: iconPath }
            : user,
        ),
      );
    };

    const handleUserFlashNickChanged = (data: {
      username: string;
      flashNick?: string | null;
    }) => {
      const normalized = data.username.trim().toLowerCase();
      armUserPresenceGrace(data.username);
      if (
        currentUsername &&
        normalizeUsername(currentUsername) === normalized
      ) {
        armSelfPresenceGrace();
      }
      setActiveTenantUsers((prev) =>
        prev.map((user) =>
          user.username.trim().toLowerCase() === normalized
            ? {
                ...user,
                flashNick: data.flashNick ?? null,
              }
            : user,
        ),
      );
    };

    const handleRoleUpdate = (data: {
      id: number;
      name: string;
      previousName?: string;
      starColor?: string | null;
      starCount?: number | null;
      icon?: string | null;
    }) => {
      const rolePatch = buildRolePatch({
        roleName: data.name || undefined,
        roleStarColor: data.starColor,
        roleStarCount: data.starCount,
        roleIcon: data.icon,
      });
      const nextRoleName = normalizeRoleValue(data.name) ?? null;
      const previousRoleName = normalizeRoleValue(data.previousName) ?? null;
      const roleMatchesUpdate = (roleName?: string | null) => {
        const normalizedRoleName = normalizeRoleValue(roleName) ?? null;
        return (
          normalizedRoleName !== null &&
          (normalizedRoleName === nextRoleName ||
            normalizedRoleName === previousRoleName)
        );
      };

      setActiveTenantUsers((prev) =>
        prev.map((user) => {
          const authoritativeRolePatch = getAuthoritativeRolePatch(user.username);
          const effectiveRoleName = authoritativeRolePatch?.roleName ?? user.roleName;

          if (roleMatchesUpdate(effectiveRoleName)) {
            const pendingRolePatch = getPendingRolePatch(user.username);
            const mergedRolePatch = mergeRoleFields(
              {
                ...user,
                ...(authoritativeRolePatch ?? {}),
              },
              rolePatch,
              {
                allowExplicitClear: false,
                pendingPatch: pendingRolePatch,
              },
            );
            rememberAuthoritativeRolePatch(user.username, mergedRolePatch);
            return {
              ...user,
              ...mergedRolePatch,
            };
          }
          return user;
        }),
      );
    };

    const handleUserRoleChanged = (data: {
      userId: number;
      username: string;
      roleId: number | null;
      role: {
        id: number;
        name: string;
        starCount: number;
        starColor: string | null;
        icon: string;
      } | null;
    }) => {
      if (!data?.username) return;
      const normalized = data.username.trim().toLowerCase();
      if (!normalized) return;
      armUserPresenceGrace(data.username);
      if (
        currentUsername &&
        normalizeUsername(currentUsername) === normalized
      ) {
        armSelfPresenceGrace();
      }
      const rolePatch = buildRolePatch({
        roleName: data.role?.name ?? null,
        roleStarCount: data.role?.starCount ?? null,
        roleStarColor: data.role?.starColor ?? null,
        roleIcon: data.role?.icon || null,
      });
      setPendingRolePatch(data.username, rolePatch);
      rememberAuthoritativeRolePatch(data.username, rolePatch);

      setActiveTenantUsers((prev) =>
        prev.map((user) =>
          user.username.trim().toLowerCase() === normalized
            ? {
                ...user,
                ...mergeRoleFields(user, rolePatch, {
                  allowExplicitClear: true,
                  pendingPatch: rolePatch,
                }),
              }
            : user,
        ),
      );
    };

    const handleTenantUserStateUpdate = (data: {
      tenantId: string;
      username: string;
      statusModeId?: number | null;
      statusModeName?: string | null;
      joinEffect?: string | null;
      isInVoiceChat?: boolean;
      isMuted?: boolean;
      isCameraOn?: boolean;
      isHandRaised?: boolean;
      handRaisedAt?: number | null;
    }) => {
      const tenantId = env.tenantId
        ? `tenant_${env.tenantId}`
        : "tenant_master";
      const normalizedExpectedTenantId = tenantId.replace(/^tenant_/, "");
      const normalizedIncomingTenantId = String(data.tenantId || "").replace(
        /^tenant_/,
        "",
      );
      if (
        normalizedIncomingTenantId &&
        normalizedIncomingTenantId !== normalizedExpectedTenantId
      ) {
        return;
      }

      const normalizedUsername = data.username.trim().toLocaleLowerCase("tr-TR");

      setActiveTenantUsers((prev) =>
        prev.map((user) => {
          if (
            user.username.trim().toLocaleLowerCase("tr-TR") !==
            normalizedUsername
          ) {
            return user;
          }

          const nextStatusModeName =
            data.statusModeName ?? user.statusModeName ?? null;
          const nextJoinEffect =
            data.joinEffect && isJoinEffectId(data.joinEffect)
              ? (data.joinEffect as JoinEffectId)
              : user.joinEffect ?? null;

          return {
            ...user,
            statusModeId: data.statusModeId ?? user.statusModeId ?? null,
            statusModeName: nextStatusModeName,
            joinEffect: nextJoinEffect,
            isInVoiceChat: data.isInVoiceChat ?? user.isInVoiceChat,
            isMuted: data.isMuted ?? user.isMuted,
            isCameraOn: data.isCameraOn ?? user.isCameraOn,
            isHandRaised: data.isHandRaised ?? user.isHandRaised,
            handRaisedAt:
              data.handRaisedAt !== undefined
                ? data.handRaisedAt
                : user.handRaisedAt ?? null,
          };
        }),
      );
    };

    const handleTenantBotUserChanged = (data: {
      tenantId?: string;
      action: "upsert" | "remove";
      username: string;
      user?: (Partial<RoomUser> & { socketId?: string | null }) | null;
    }) => {
      const normalizedIncomingTenantId = String(data.tenantId || "").replace(
        /^tenant_/,
        "",
      );
      if (
        normalizedIncomingTenantId &&
        normalizedIncomingTenantId !== normalizedTenantId
      ) {
        return;
      }

      const normalizedUsername = data.username.trim().toLocaleLowerCase("tr-TR");
      setActiveTenantUsers((prev) => {
        if (data.action === "remove") {
          return prev.filter(
            (user) =>
              !user.isBot ||
              user.username.trim().toLocaleLowerCase("tr-TR") !==
                normalizedUsername,
          );
        }

        if (!data.user?.username) {
          return prev;
        }

        const nextBot: RoomUser = {
          id: data.user.id || data.user.socketId || `bot_${data.user.username}`,
          socketId: data.user.socketId ?? data.user.id ?? null,
          username: data.user.username,
          displayUsername: data.user.displayUsername ?? data.user.username,
          gender: data.user.gender ?? "female",
          isGuest: false,
          isBot: true,
          isAI: data.user.isAI === true,
          rooms: data.user.rooms ?? [],
          statusModeId: data.user.statusModeId ?? null,
          statusModeName: data.user.statusModeName ?? null,
          roleName: data.user.roleName ?? null,
          roleStarColor: data.user.roleStarColor ?? null,
          roleStarCount: data.user.roleStarCount ?? null,
          roleIcon: data.user.roleIcon ?? null,
          fontName: data.user.fontName ?? null,
          granite: data.user.granite ?? null,
          nickColor: data.user.nickColor ?? null,
          userGif: data.user.userGif ?? null,
          flashNick: data.user.flashNick ?? null,
          frame: data.user.frame ?? null,
          icon: data.user.icon ?? null,
          agentNickname: null,
          isInVoiceChat: data.user.isInVoiceChat ?? false,
          isMuted: data.user.isMuted ?? false,
          isCameraOn: data.user.isCameraOn ?? false,
          isHandRaised: data.user.isHandRaised ?? false,
          handRaisedAt: data.user.handRaisedAt ?? null,
          micBanned: data.user.micBanned ?? false,
          micBannedByStarCount: data.user.micBannedByStarCount ?? null,
          cameraBanned: data.user.cameraBanned ?? false,
          cameraBannedByStarCount: data.user.cameraBannedByStarCount ?? null,
          roomMuted: data.user.roomMuted ?? false,
          roomMutedByStarCount: data.user.roomMutedByStarCount ?? null,
          globalMuted: data.user.globalMuted ?? false,
          globalMutedByStarCount: data.user.globalMutedByStarCount ?? null,
        };

        const existingIndex = prev.findIndex(
          (user) =>
            user.isBot &&
            user.username.trim().toLocaleLowerCase("tr-TR") ===
              normalizedUsername,
        );
        if (existingIndex === -1) {
          return [...prev, nextBot];
        }

        return prev.map((user, index) =>
          index === existingIndex ? { ...user, ...nextBot } : user,
        );
      });
    };

    socket.on("tenant:activeUserCount", handleActiveTenantUserCount);
    socket.on("tenant:userStyleUpdate", handleUserStyleUpdated);
    socket.on("tenant:userIconChanged", handleUserIconChanged);
    socket.on("tenant:userFlashNickChanged", handleUserFlashNickChanged);
    socket.on("tenant:roleUpdate", handleRoleUpdate);
    socket.on("user:roleChanged", handleUserRoleChanged);
    socket.on("tenant:userStateUpdate", handleTenantUserStateUpdate);
    socket.on("room:botStateUpdate", handleTenantUserStateUpdate);
    socket.on("tenant:botUserChanged", handleTenantBotUserChanged);

    // Socket bağlandığında kısa bir süre bekle, sonra veri iste
    socket.on("connect", () => {
      setTimeout(() => {
        if (socket.connected) {
          socket.emit("tenant:getActiveUserCount", { tenantId });
        }
      }, 500);
    });

    // İlk yüklemede aktif kullanıcı sayısını iste (eğer zaten bağlıysa)
    if (socket.connected) {
      setTimeout(() => {
        if (socket.connected) {
          socket.emit("tenant:getActiveUserCount", { tenantId });
        }
      }, 500);
    }

    // Her 5 saniyede bir güncelle
    const interval = setInterval(() => {
      if (socket.connected) {
        socket.emit("tenant:getActiveUserCount", { tenantId });
      }
    }, 5000);

    return () => {
      socket.off("tenant:activeUserCount", handleActiveTenantUserCount);
      socket.off("tenant:userStyleUpdate", handleUserStyleUpdated);
      socket.off("tenant:userIconChanged", handleUserIconChanged);
      socket.off("tenant:userFlashNickChanged", handleUserFlashNickChanged);
      socket.off("tenant:roleUpdate", handleRoleUpdate);
      socket.off("user:roleChanged", handleUserRoleChanged);
      socket.off("tenant:userStateUpdate", handleTenantUserStateUpdate);
      socket.off("room:botStateUpdate", handleTenantUserStateUpdate);
      socket.off("tenant:botUserChanged", handleTenantBotUserChanged);
      socket.off("connect");
      clearTimeout(connectTimeoutId);
      clearInterval(interval);
      socket.disconnect();
    };
  }, [
    applyTenantSnapshot,
    armSelfPresenceGrace,
    armUserPresenceGrace,
    currentUsername,
    getAuthoritativeRolePatch,
    getPendingRolePatch,
    rememberAuthoritativeRolePatch,
    setPendingRolePatch,
  ]);

  // usersRef her render'da güncellensin ki socket handler'ları güncel veriyi görsün
  useEffect(() => {
    usersRef.current = users;
  });

  // Main socket üzerinde de tenant:activeUserCount dinle
  useEffect(() => {
    if (!socket) return;

    const handleMainSocketTenantData = (data: {
      tenantId: string;
      count: number;
      users?: TenantRawUser[];
    }) => {
      applyTenantSnapshot(data);
    };

    socket.on("tenant:activeUserCount", handleMainSocketTenantData);
    return () => {
      socket.off("tenant:activeUserCount", handleMainSocketTenantData);
    };
  }, [socket, applyTenantSnapshot]);

  useEffect(() => {
    if (!socket) return;

    const handleMicBanToggled = (data: {
      username: string;
      micBanned: boolean;
    }) => {
      updateModerationOverride(data.username, { micBanned: data.micBanned });
      const normalized = data.username.trim().toLowerCase();
      setActiveTenantUsers((prev) =>
        prev.map((u) =>
          u.username.trim().toLowerCase() === normalized
            ? { ...u, micBanned: data.micBanned }
            : u,
        ),
      );
      if (selectedUser?.username === data.username) {
        setSelectedUser((prev) =>
          prev ? { ...prev, micBanned: data.micBanned } : null,
        );
      }
    };

    const handleCameraBanToggled = (data: {
      username: string;
      cameraBanned: boolean;
    }) => {
      updateModerationOverride(data.username, {
        cameraBanned: data.cameraBanned,
      });
      setActiveTenantUsers((prev) =>
        prev.map((u) =>
          u.username === data.username
            ? { ...u, cameraBanned: data.cameraBanned }
            : u,
        ),
      );
      if (selectedUser?.username === data.username) {
        setSelectedUser((prev) =>
          prev ? { ...prev, cameraBanned: data.cameraBanned } : null,
        );
      }
    };

    const handleMuteStateChanged = (data: {
      username: string;
      scope: "room" | "global";
      room?: string;
      roomMuted?: boolean;
      globalMuted?: boolean;
    }) => {
      if (data.scope === "global") {
        updateModerationOverride(String(data.username), {
          globalMuted: data.globalMuted === true,
        });
      } else {
        updateModerationOverride(String(data.username), {
          roomMuted: data.roomMuted === true,
        });
      }

      setActiveTenantUsers((prev) =>
        prev.map((u) => {
          if (
            u.username.toLowerCase() !== String(data.username).toLowerCase()
          ) {
            return u;
          }
          if (data.scope === "global") {
            return { ...u, globalMuted: data.globalMuted === true };
          }
          const currentRoom = (currentRoomId || "").trim().toLowerCase();
          const payloadRoom = (data.room || "").trim().toLowerCase();
          if (!currentRoom || !payloadRoom || currentRoom !== payloadRoom) {
            return u;
          }
          return { ...u, roomMuted: data.roomMuted === true };
        }),
      );

      if (
        selectedUser?.username &&
        selectedUser.username.toLowerCase() ===
          String(data.username).toLowerCase()
      ) {
        setSelectedUser((prev) => {
          if (!prev) return prev;
          if (data.scope === "global") {
            return { ...prev, globalMuted: data.globalMuted === true };
          }
          const currentRoom = (currentRoomId || "").trim().toLowerCase();
          const payloadRoom = (data.room || "").trim().toLowerCase();
          if (!currentRoom || !payloadRoom || currentRoom !== payloadRoom) {
            return prev;
          }
          return { ...prev, roomMuted: data.roomMuted === true };
        });
      }
    };

    const handleUserStatusModeChanged = (data: {
      username: string;
      statusModeId?: number | null;
      statusModeName?: string | null;
    }) => {
      if (!data?.username) return;

      setActiveTenantUsers((prev) =>
        prev.map((u) =>
          u.username.trim().toLowerCase() === data.username.trim().toLowerCase()
            ? {
                ...u,
                statusModeId: data.statusModeId ?? null,
                statusModeName: data.statusModeName ?? null,
              }
            : u,
        ),
      );

      if (selectedUser?.username === data.username) {
        setSelectedUser((prev) =>
          prev
            ? {
                ...prev,
                statusModeId: data.statusModeId ?? null,
                statusModeName: data.statusModeName ?? null,
              }
            : null,
        );
      }
    };

    socket.on("moderation:micBanToggled", handleMicBanToggled);
    socket.on("moderation:cameraBanToggled", handleCameraBanToggled);
    socket.on("moderation:muteStateChanged", handleMuteStateChanged);
    socket.on("room:userStatusModeChanged", handleUserStatusModeChanged);
    return () => {
      socket.off("moderation:micBanToggled", handleMicBanToggled);
      socket.off("moderation:cameraBanToggled", handleCameraBanToggled);
      socket.off("moderation:muteStateChanged", handleMuteStateChanged);
      socket.off("room:userStatusModeChanged", handleUserStatusModeChanged);
    };
  }, [socket, selectedUser?.username, currentRoomId]);

  useEffect(() => {
    if (!socket) return;
    const refreshSelectedUserRelation = () => {
      if (selectedUser?.username && !selectedUserIsBot) {
        const targetAgentNickname =
          selectedUser.agentNickname?.trim() ||
          (currentUsername &&
          selectedUser.username.toLowerCase() === currentUsername.toLowerCase()
            ? effectiveAgentNickname || null
            : null);
        apiClient.friends
          .getRelation(selectedUser.username, targetAgentNickname)
          .then((relation) => setSelectedUserRelation(relation))
          .catch(() => setSelectedUserRelation(null));
      }
    };

    const handleFriendRequestCreated = async () => {
      const previousIncomingIds = incomingRequestIdsRef.current;
      const nextIncomingRequests = await fetchFriendsData();
      const hasNewIncomingRequest = nextIncomingRequests.some(
        (request) => !previousIncomingIds.has(request.id),
      );
      const preferences = readChatPreferencesFromStorage();
      if (
        hasNewIncomingRequest &&
        !preferences.rejectFriendRequests &&
        !preferences.muteFriendRequestSound &&
        !preferences.muteVibrationSounds
      ) {
        playFriendRequestSound();
      }
      refreshSelectedUserRelation();
    };

    const handleFriendsUpdate = () => {
      void fetchFriendsData();
      refreshSelectedUserRelation();
    };

    socket.on("friends:requestCreated", handleFriendRequestCreated);
    socket.on("friends:requestUpdated", handleFriendsUpdate);
    socket.on("friends:requestRemoved", handleFriendsUpdate);
    return () => {
      socket.off("friends:requestCreated", handleFriendRequestCreated);
      socket.off("friends:requestUpdated", handleFriendsUpdate);
      socket.off("friends:requestRemoved", handleFriendsUpdate);
    };
  }, [
    socket,
    currentUsername,
    effectiveAgentNickname,
    selectedUser?.agentNickname,
    selectedUser?.username,
    selectedUserIsBot,
  ]);

  useEffect(() => {
    if (!socket) return;

    const handleConnectRefresh = () => {
      void refreshDmUnreadCount();
    };

    const handleDmNewMessage = (payload?: {
      unreadCount?: number | null;
      conversationId?: number | null;
    }) => {
      const conversationId = Number(payload?.conversationId ?? 0);
      if (conversationId > 0) {
        setPendingDmConversationCounts((prev) => {
          const next = {
            ...prev,
            [conversationId]: (prev[conversationId] ?? 0) + 1,
          };
          pendingDmConversationCountsRef.current = next;
          return next;
        });
      }
      setDmUnreadCount((prev) => {
        const optimisticNext = Math.max(
          prev + 1,
          Number(payload?.unreadCount ?? 0),
          1,
        );
        return optimisticNext;
      });
      void refreshDmUnreadCount();
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
  }, [socket, isGuestUser, dmUnreadCount, refreshDmUnreadCount]);

  // Kendi yaptığımız değişiklikleri anında "Tüm Kişiler" listesinde de görmek için dinle
  // Ve diğer kullanıcıların (farklı odalarda olsa bile) görmesi için tenant socket'e bildir
  useEffect(() => {
    const handleLocalStyleUpdate = (
      event: CustomEvent<Partial<Pick<RoomUser, "fontName" | "granite" | "nickColor" | "userGif" | "flashNick">>>,
    ) => {
      const { fontName, granite, nickColor, userGif, flashNick } = event.detail;
      const hasNonFlashNickStyleChange =
        fontName !== undefined ||
        granite !== undefined ||
        nickColor !== undefined ||
        userGif !== undefined;

      if (currentUsername && event.detail) {
        const detail = event.detail;
        armSelfPresenceGrace();
        const normalizedSelf = currentUsername.trim().toLowerCase();
        
        // 1. Kendi listemizi yerelde hemen güncelle
        setActiveTenantUsers((prev) =>
          prev.map((u) => {
            const normalizedU = u.username.trim().toLowerCase();
            return normalizedU === normalizedSelf
              ? {
                    ...u,
                    fontName: detail.fontName !== undefined ? detail.fontName : u.fontName,
                    granite: detail.granite !== undefined ? detail.granite : u.granite,
                    nickColor: detail.nickColor !== undefined ? detail.nickColor : u.nickColor,
                    userGif: detail.userGif !== undefined ? detail.userGif : u.userGif,
                    flashNick: detail.flashNick !== undefined ? detail.flashNick : u.flashNick,
                  }
              : u;
          }),
        );

        // 2. Site genelindeki diğer kullanıcılara (farklı odadakiler dahil) bildir
        if (tenantSocketRef.current?.connected && hasNonFlashNickStyleChange) {
          const tenantId = env.tenantId
            ? `tenant_${env.tenantId}`
            : "tenant_master";
          tenantSocketRef.current.emit("tenant:userStyleUpdate", {
            tenantId,
            username: currentUsername,
            fontName: fontName !== undefined ? fontName : null,
            granite: granite !== undefined ? granite : null,
            nickColor: nickColor !== undefined ? nickColor : null,
            userGif: userGif !== undefined ? userGif : null,
            flashNick: flashNick !== undefined ? flashNick : null,
          });
        }
      }
    };

    const handleIconChange = (event: Event) => {
      const detail = (
        event as CustomEvent<{ path: string | null; key: string | null }>
      ).detail;
      if (detail !== undefined) {
        const iconKey = detail.key;

        if (currentUsername) {
          armSelfPresenceGrace();
          const iconPath = detail.path;
          // 1. Kendi listemizi yerelde hemen güncelle
          setActiveTenantUsers((prev) =>
            prev.map((u) =>
              u.username === currentUsername
                ? { ...u, icon: iconPath || null }
                : u,
            ),
          );

          // 2. Socket'e hemen gönder - diğer kullanıcıların görmesi için
          if (socket && socket.connected) {
            socket.emit("icon:update", {
              room: "global", // Global update için
              username: currentUsername,
              icon: iconKey,
            });
          }
        }
      }
    };

    const handleFrameChange = (event: Event) => {
      const detail = (
        event as CustomEvent<{ path: string | null; key: string | null }>
      ).detail;
      if (detail !== undefined) {
        const frameKey = detail.key;

        if (currentUsername) {
          armSelfPresenceGrace();
          const framePath = detail.path;
          // 1. Kendi listemizi yerelde hemen güncelle
          setActiveTenantUsers((prev) =>
            prev.map((u) =>
              u.username === currentUsername
                ? { ...u, frame: framePath || null }
                : u,
            ),
          );

          // 2. Socket'e hemen gönder - diğer kullanıcıların görmesi için
          if (socket && socket.connected) {
            socket.emit("frame:update", {
              room: "global", // Global update için
              username: currentUsername,
              frame: frameKey,
            });
          }
        }
      }
    };

    window.addEventListener("userStyleUpdated", handleLocalStyleUpdate as EventListener);
    window.addEventListener("profileIconChanged", handleIconChange);
    window.addEventListener("profileFrameChanged", handleFrameChange);
    return () => {
      window.removeEventListener("userStyleUpdated", handleLocalStyleUpdate as EventListener);
      window.removeEventListener("profileIconChanged", handleIconChange);
      window.removeEventListener("profileFrameChanged", handleFrameChange);
    };
  }, [currentUsername, socket]);

  // Listen for kick events
  useEffect(() => {
    if (!socket) return;

    const onKick = (payload: {
      username: string;
      kickedByUsername: string;
      reason?: string;
    }) => {
      if (currentUsername && payload.username === currentUsername) {
        alert(
          `Sistemden atıldınız!\nAtan Yetkili: ${payload.kickedByUsername}\nSebep: ${
            payload.reason || "Belirtilmedi"
          }`,
        );
        // Logout işlemi
        localStorage.clear();
        document.cookie.split(";").forEach(function (c) {
          document.cookie = c
            .replace(/^ +/, "")
            .replace(
              /=.*/,
              "=;expires=" + new Date().toUTCString() + ";path=/",
            );
        });
        window.location.href = "/";
      }
    };

    const onBan = (payload: {
      username: string;
      bannedByUsername: string;
      reason?: string;
    }) => {
      if (currentUsername && payload.username === currentUsername) {
        alert(
          `Sistemden yasaklandınız!\nYasaklayan Yetkili: ${
            payload.bannedByUsername || "Sistem"
          }\nSebep: ${payload.reason || "Belirtilmedi"}`,
        );
        // Logout işlemi
        localStorage.clear();
        document.cookie.split(";").forEach(function (c) {
          document.cookie = c
            .replace(/^ +/, "")
            .replace(
              /=.*/,
              "=;expires=" + new Date().toUTCString() + ";path=/",
            );
        });
        window.location.href = "/";
      }
    };

    socket.on("moderation:kick", onKick);
    socket.on("moderation:userBanned", onBan);

    socket.on(
      "room:teleport",
      (payload: { toRoom: string; byWhom: string }) => {
        const toRoom = String(payload?.toRoom || "").trim();
        if (!toRoom) return;
        const byWhom = String(payload?.byWhom || "Sistem").trim() || "Sistem";

        try {
          const targetSlug = toRoom.replace(/\s+/g, "-");
          sessionStorage.setItem(
            "pendingTeleportToast",
            JSON.stringify({
              toRoom,
              byWhom,
              targetSlug,
              createdAt: Date.now(),
            }),
          );
          // Teleport da oda değişimi olduğu için "navigasyon" akışını tetikle.
          // Böylece hedef odada girişe özel çatı toast'ı tekrar gösterilmez.
          setRoomNavigationIntent("teleport");
        } catch (error) {
          console.error("Teleport toast verisi saklanamadı:", error);
        }

        const slug = toRoom.replace(/\s+/g, "-");
        router.push(`/chat/${slug}`);
      },
    );

    const onRoomInviteReceived = (payload: RoomInviteReceivedPayload) => {
      if (!payload?.inviteId || !payload?.roomName) return;
      setPendingRoomInvite(payload);
      toast.info(
        `${payload.fromUsername} sizi ${payload.roomName} odasına davet etti.`,
      );
    };

    const onRoomInviteResult = (payload: RoomInviteResultPayload) => {
      const target = payload?.targetUsername || "Kullanıcı";
      if (payload?.status === "sent") {
        toast.success(`${target} kullanıcısına oda daveti gönderildi.`);
        return;
      }
      if (payload?.status === "accepted") {
        toast.success(`${target} daveti kabul etti.`);
        return;
      }
      if (payload?.status === "rejected") {
        toast.error(`${target} daveti reddetti.`);
        return;
      }

      if (payload?.status === "error") {
        const messageByCode: Record<string, string> = {
          invalid_payload: "Davet gönderilemedi. Geçersiz veri.",
          sender_not_found: "Davet gönderilemedi. Kullanıcı bilgisi bulunamadı.",
          insufficient_privileges: "Bu işlem için yetkiniz yok.",
          self_invite: "Kendinize oda daveti gönderemezsiniz.",
          target_not_found: "Kullanıcı çevrimiçi değil.",
          target_is_protected:
            "Bu kullanıcı korunuyor. Yalnızca korumayı açan yetkiliyle aynı yıldız veya daha üst yetkililer işlem yapabilir.",
          rejected_by_preference: "Kullanıcı oda davetlerini reddediyor.",
          already_in_room: "Kullanıcı zaten bu odada.",
          target_offline: "Kullanıcı çevrimdışı olduğu için davet iptal edildi.",
        };
        toast.error(
          messageByCode[payload.code || ""] ||
            "Oda daveti sırasında bir hata oluştu.",
        );
      }
    };

    const onWarnReceived = (payload: ModerationWarnPayload) => {
      if (!payload?.message) return;
      setIncomingWarnModal(payload);
    };

    const onMicInviteReceived = (payload: ModerationMicInviteReceivedPayload) => {
      if (!payload?.inviteId || !payload?.fromUsername || !payload?.room) return;
      setIncomingMicInvite(payload);
      toast.info(`${payload.fromUsername} sizi mikrofona davet etti.`);
    };

    const onMicInviteResult = (payload: ModerationMicInviteResultPayload) => {
      const target = payload?.targetUsername || "Kullanıcı";
      if (payload?.status === "sent") {
        toast.success(`${target} kullanıcısına mikrofon daveti gönderildi.`);
        return;
      }
      if (payload?.status === "accepted") {
        toast.success(`${target} mikrofon davetini kabul etti.`);
        return;
      }
      if (payload?.status === "rejected") {
        toast.error(`${target} mikrofon davetini reddetti.`);
        return;
      }
      if (payload?.status === "error") {
        const messageByCode: Record<string, string> = {
          target_offline: "Kullanıcı çevrimdışı olduğu için davet iptal edildi.",
        };
        toast.error(
          messageByCode[payload.code || ""] ||
            "Mikrofon daveti sırasında bir hata oluştu.",
        );
      }
    };

    const onTempOperatorUpdated = (payload: {
      tenantId?: string;
      username?: string;
      isTemporaryOperator?: boolean;
    }) => {
      const normalizeTenantId = (value?: string | null) =>
        String(value || "")
          .trim()
          .replace(/^tenant_/, "") || "master";
      const currentTenantId = normalizeTenantId(
        env.tenantId ? `tenant_${env.tenantId}` : "tenant_master",
      );
      const eventTenantId = normalizeTenantId(payload?.tenantId || "tenant_master");
      if (eventTenantId !== currentTenantId) return;
      const username = String(payload?.username || "").trim();
      if (!username) return;
      const normalized = normalizeTempOperatorUsername(username);
      const matchesUser = (value?: string | null) =>
        normalizeTempOperatorUsername(value) === normalized;
      const enabled = payload?.isTemporaryOperator === true;

      if (enabled) {
        tempOperatorUsers.add(normalized);
      } else {
        tempOperatorUsers.delete(normalized);
      }

      setSelectedUser((prev) => {
        if (!prev || !matchesUser(prev.username)) return prev;
        if (enabled) {
          return {
            ...prev,
            roleIcon: null,
            roleStarCount: 1,
            roleStarColor: TEMP_OPERATOR_STAR_COLOR,
          };
        }
        return {
          ...prev,
          roleIcon: prev.isGuest ? null : prev.roleIcon,
          roleStarCount: prev.isGuest ? 0 : prev.roleStarCount,
          roleStarColor: prev.isGuest ? null : prev.roleStarColor,
        };
      });

      setActiveTenantUsers((prev) =>
        prev.map((u) => {
          if (!matchesUser(u.username)) return u;
          if (enabled) {
            return {
              ...u,
              roleIcon: null,
              roleStarCount: 1,
              roleStarColor: TEMP_OPERATOR_STAR_COLOR,
            };
          }
          return {
            ...u,
            roleIcon: u.isGuest ? null : u.roleIcon,
            roleStarCount: u.isGuest ? 0 : u.roleStarCount,
            roleStarColor: u.isGuest ? null : u.roleStarColor,
          };
        }),
      );
    };

    socket.on("room:invite:received", onRoomInviteReceived);
    socket.on("room:invite:result", onRoomInviteResult);
    socket.on("moderation:warnReceived", onWarnReceived);
    socket.on("moderation:micInviteReceived", onMicInviteReceived);
    socket.on("moderation:micInviteResult", onMicInviteResult);
    socket.on("moderation:tempOperator:updated", onTempOperatorUpdated);

    return () => {
      socket.off("moderation:kick", onKick);
      socket.off("moderation:userBanned", onBan);
      socket.off("room:teleport");
      socket.off("room:invite:received", onRoomInviteReceived);
      socket.off("room:invite:result", onRoomInviteResult);
      socket.off("moderation:warnReceived", onWarnReceived);
      socket.off("moderation:micInviteReceived", onMicInviteReceived);
      socket.off("moderation:micInviteResult", onMicInviteResult);
      socket.off("moderation:tempOperator:updated", onTempOperatorUpdated);
    };
  }, [socket, currentUsername, router]);

  const requestTenantActiveUsers = useCallback(() => {
    const tenantId = env.tenantId
      ? `tenant_${env.tenantId}`
      : "tenant_master";

    if (tenantSocketRef.current?.connected) {
      tenantSocketRef.current.emit("tenant:getActiveUserCount", { tenantId });
    }

    if (socket?.connected) {
      socket.emit("tenant:getActiveUserCount", { tenantId });
    }
  }, [socket]);

  // "Tüm Kişiler" sekmesine geçildiğinde kullanıcı listesini çek
  useEffect(() => {
    if (activeTab === "all") {
      requestTenantActiveUsers();
    }
  }, [activeTab, requestTenantActiveUsers]);

  useEffect(() => {
    if (!mobileRoomOnly) return;
    requestTenantActiveUsers();

    const retryTimers = [250, 750, 1500].map((delay) =>
      window.setTimeout(requestTenantActiveUsers, delay),
    );

    return () => {
      retryTimers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [mobileRoomOnly, currentRoomId, currentRoomName, requestTenantActiveUsers]);

  // Close admin menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: Event) => {
      if (
        adminMenuRef.current &&
        !adminMenuRef.current.contains(event.target as Node)
      ) {
        setShowAdminMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleUserClick = (user: RoomUser) => {
    const selfIcon =
      user.username === currentUsername ? getImmediateSelfIcon() : null;
    if (selfIcon) {
      setSelectedUser({ ...user, icon: selfIcon });
      return;
    }
    setSelectedUser(user);
    setShowAdminMenu(false);
  };

  const getCameraChannelName = (room: string, username: string) => {
    const safeRoom = room.trim().toLowerCase();
    const safeUsername = username.trim().toLowerCase();
    return `camera_${safeRoom}_${safeUsername}`;
  };

  const closeCameraViewer = async () => {
    const viewerRoom = cameraViewerRoomRef.current;
    cameraViewerRoomRef.current = null;
    if (viewerRoom && viewerRoom.state !== "disconnected") {
      try {
        await viewerRoom.disconnect();
      } catch (error) {
        console.error("Kamera izleyici kapatılırken hata:", error);
      }
    }
    if (cameraViewerContainerRef.current) {
      cameraViewerContainerRef.current.innerHTML = "";
    }
    setCameraViewerUser(null);
    setCameraViewerError(null);
  };

  const openCameraViewer = async (user: RoomUser) => {
    if (cameraViewerOpeningRef.current) return;
    if (!currentRoomId) {
      toast.error("Aktif oda bilgisi bulunamadı.");
      return;
    }
    if (!user.isCameraOn) {
      toast.info("Bu kullanıcının kamerası kapalı.");
      return;
    }

    cameraViewerOpeningRef.current = true;
    setCameraViewerError(null);
    setCameraViewerUser(user);

    try {
      await closeCameraViewer();
      setCameraViewerUser(user);

      const channelName = getCameraChannelName(currentRoomId, user.username);
      const token = await fetchLivekitToken(channelName, false);

      const viewerRoom = new LiveKitRoom();
      cameraViewerRoomRef.current = viewerRoom;

      viewerRoom.on(RoomEvent.TrackSubscribed, (track, pub) => {
        if (pub.source === Track.Source.Camera && track.kind === "video") {
          const container = cameraViewerContainerRef.current;
          if (!container) return;
          container.innerHTML = "";
          const el = track.attach();
          el.style.width = "100%";
          el.style.height = "100%";
          el.style.objectFit = "cover";
          container.appendChild(el);
        }
      });

      viewerRoom.on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach();
        if (cameraViewerContainerRef.current) {
          cameraViewerContainerRef.current.innerHTML = "";
        }
      });

      viewerRoom.on(RoomEvent.ParticipantDisconnected, () => {
        if (cameraViewerContainerRef.current) {
          cameraViewerContainerRef.current.innerHTML = "";
        }
      });

      await viewerRoom.connect(LIVEKIT_URL, token);
    } catch (error) {
      console.error("Kamera izleyici açılırken hata:", error);
      setCameraViewerError("Kamera yayını açılamadı.");
    } finally {
      cameraViewerOpeningRef.current = false;
    }
  };

  useEffect(() => {
    if (!cameraViewerUser) return;
    const latest =
      users.find((u) => u.username === cameraViewerUser.username) ||
      activeTenantUsers.find((u) => u.username === cameraViewerUser.username);
    if (!latest?.isCameraOn) {
      void closeCameraViewer();
    }
  }, [cameraViewerUser, users, activeTenantUsers]);

  useEffect(() => {
    if (!isDraggingCameraViewer) return;

    const handleMove = (event: globalThis.MouseEvent) => {
      const dx = event.clientX - cameraViewerDragStartRef.current.x;
      const dy = event.clientY - cameraViewerDragStartRef.current.y;
      cameraViewerDragStartRef.current = { x: event.clientX, y: event.clientY };
      setCameraViewerPos((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
    };

    const handleUp = () => setIsDraggingCameraViewer(false);

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [isDraggingCameraViewer]);

  useEffect(() => {
    if (!selectedUser) return;
    const globalUser = activeTenantUsers.find(
      (u) => u.username === selectedUser.username,
    );
    const roomUser = users.find((u) => u.username === selectedUser.username);
    const resolvedIcon = resolveFriendIcon(globalUser?.icon || null);
    const resolvedUserGif = resolveUserGifPath(globalUser?.userGif || null);
    const resolvedFlashNick = resolveFlashNickSource(globalUser?.flashNick !== undefined ? globalUser.flashNick : null);
    const nextIcon = resolvedIcon || selectedUser.icon || null;
    const nextUserGif = resolvedUserGif || null;
    const nextFlashNick = resolvedFlashNick || null;
    const moderationState = mergeModerationState(
      roomUser ?? selectedUser,
      globalUser ?? selectedUser,
    );
    if (
      selectedUser.icon === nextIcon &&
      selectedUser.userGif === nextUserGif &&
      selectedUser.flashNick === nextFlashNick &&
      selectedUser.globalMuted === moderationState.globalMuted &&
      selectedUser.globalMutedByStarCount ===
        moderationState.globalMutedByStarCount &&
      selectedUser.roomMuted === moderationState.roomMuted &&
      selectedUser.roomMutedByStarCount ===
        moderationState.roomMutedByStarCount &&
      selectedUser.micBanned === moderationState.micBanned &&
      selectedUser.micBannedByStarCount ===
        moderationState.micBannedByStarCount &&
      selectedUser.cameraBanned === moderationState.cameraBanned &&
      selectedUser.cameraBannedByStarCount ===
        moderationState.cameraBannedByStarCount
    ) {
      return;
    }
    setSelectedUser({
      ...selectedUser,
      icon: nextIcon,
      userGif: nextUserGif,
      flashNick: nextFlashNick,
      ...moderationState,
    });
  }, [selectedUser, activeTenantUsers, users]);

  useEffect(() => {
    return () => {
      const viewerRoom = cameraViewerRoomRef.current;
      cameraViewerRoomRef.current = null;
      if (viewerRoom && viewerRoom.state !== "disconnected") {
        void viewerRoom.disconnect().catch(() => undefined);
      }
    };
  }, []);

  useEffect(() => {
    if (!profileOpenRequest?.username) return;
    const foundUser = findUserByUsername(profileOpenRequest.username);
    const fallbackUser = profileOpenRequest.fallbackUser || null;
    const user = foundUser
      ? {
          ...fallbackUser,
          ...foundUser,
          icon: foundUser.icon || fallbackUser?.icon || null,
          frame: foundUser.frame || fallbackUser?.frame || null,
        }
      : fallbackUser;
    if (user) {
      setSelectedUser(user);
      setShowAdminMenu(false);
    }
    onProfileOpenHandled?.();
  }, [
    profileOpenRequest?.id,
    profileOpenRequest?.username,
    profileOpenRequest?.fallbackUser,
    activeTenantUsers,
    users,
    onProfileOpenHandled,
  ]);

  const isSelectedProfileOwner =
    !!selectedUser?.username &&
    !!currentUsername &&
    selectedUser.username.toLowerCase() === currentUsername.toLowerCase() &&
    ((selectedUser.agentNickname || effectiveAgentNickname || "").trim() ||
      null) === ((effectiveAgentNickname || "").trim() || null);
  const selectedProfileAgentNickname =
    selectedUser?.agentNickname?.trim() ||
    (selectedUser?.username &&
    currentUsername &&
    selectedUser.username.toLowerCase() === currentUsername.toLowerCase()
      ? effectiveAgentNickname || null
      : null);

  const closeUserModal = (options: { closeMobileRoom?: boolean } = {}) => {
    const shouldCloseMobileRoom = options.closeMobileRoom ?? true;
    setSelectedUser(null);
    setSelectedUserRelation(null);
    setRelationLoading(false);
    setShowAdminMenu(false);
    setProfileComments([]);
    setPendingProfileComments([]);
    setMyPendingProfileComments([]);
    setProfileCommentInput("");
    setProfileCommentsLoading(false);
    setPendingProfileCommentsLoading(false);
    setMyPendingProfileCommentsLoading(false);
    setProfileCommentSubmitting(false);
    setProfileCommentApprovingId(null);
    setProfileCommentDeletingId(null);
    if (
      shouldCloseMobileRoom &&
      mobileRoomOnly &&
      closeMobileRoomOnProfileClose
    ) {
      onMobileRoomClose?.();
    }
  };

  useEffect(() => {
    if (!selectedUser?.username || selectedUserIsBot) {
      if (selectedUserIsBot && selectedUser?.username) {
        const normalizedUsername = normalizeUsername(selectedUser.username);
        setSelectedUserRelation({
          targetUsername: selectedUser.username,
          isFriend: false,
          hasIncomingRequest: false,
          hasOutgoingRequest: fakeBotOutgoingFriendRequests.has(normalizedUsername),
          isBlockedByMe: fakeBotBlockedUsernames.has(normalizedUsername),
          isBlockedByOther: false,
          isBlockedEitherWay: fakeBotBlockedUsernames.has(normalizedUsername),
        });
      } else {
        setSelectedUserRelation(null);
      }
      setRelationLoading(false);
      return;
    }

    let cancelled = false;
    setRelationLoading(true);
    apiClient.friends
      .getRelation(selectedUser.username, selectedProfileAgentNickname)
      .then((relation) => {
        if (cancelled) return;
        setSelectedUserRelation(relation);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("Friend relation fetch failed:", error);
        setSelectedUserRelation(null);
      })
      .finally(() => {
        if (cancelled) return;
        setRelationLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    selectedUser?.username,
    selectedProfileAgentNickname,
    selectedUserIsBot,
    fakeBotOutgoingFriendRequests,
    fakeBotBlockedUsernames,
  ]);

  useEffect(() => {
    if (!selectedUser?.username || selectedUserIsBot) {
      setProfileComments([]);
      setPendingProfileComments([]);
      setMyPendingProfileComments([]);
      setProfileCommentInput("");
      setProfileCommentsLoading(false);
      setPendingProfileCommentsLoading(false);
      setMyPendingProfileCommentsLoading(false);
      return;
    }

    let cancelled = false;
    setProfileCommentInput("");
    setProfileComments([]);
    setPendingProfileComments([]);
    setMyPendingProfileComments([]);
    setProfileCommentsLoading(true);
    setPendingProfileCommentsLoading(isSelectedProfileOwner);
    setMyPendingProfileCommentsLoading(!isSelectedProfileOwner);
    apiClient.profileComments
      .list(selectedUser.username, selectedProfileAgentNickname)
      .then((data) => {
        if (cancelled) return;
        setProfileComments(data);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("Profile comments fetch failed:", error);
        toast.error("Profil yorumları alınamadı.");
        setProfileComments([]);
      })
      .finally(() => {
        if (cancelled) return;
        setProfileCommentsLoading(false);
      });

    if (isSelectedProfileOwner) {
      apiClient.profileComments
        .listPending(selectedUser.username, selectedProfileAgentNickname)
        .then((data) => {
          if (cancelled) return;
          setPendingProfileComments(data);
        })
        .catch((error) => {
          if (cancelled) return;
          console.error("Pending profile comments fetch failed:", error);
          toast.error("Onay bekleyen yorumlar alınamadı.");
          setPendingProfileComments([]);
        })
        .finally(() => {
          if (cancelled) return;
          setPendingProfileCommentsLoading(false);
        });
      setMyPendingProfileCommentsLoading(false);
    } else {
      setPendingProfileCommentsLoading(false);
      apiClient.profileComments
        .listMinePending(selectedUser.username, selectedProfileAgentNickname)
        .then((data) => {
          if (cancelled) return;
          setMyPendingProfileComments(data);
        })
        .catch((error) => {
          if (cancelled) return;
          console.error("Own pending profile comments fetch failed:", error);
          toast.error("Bekleyen yorumlarınız alınamadı.");
          setMyPendingProfileComments([]);
        })
        .finally(() => {
          if (cancelled) return;
          setMyPendingProfileCommentsLoading(false);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [
    selectedUser?.username,
    selectedProfileAgentNickname,
    selectedUserIsBot,
    isSelectedProfileOwner,
  ]);

  const canDeleteProfileComment = (
    targetUser?: RoomUser | null,
  ) => {
    if (!targetUser) return false;
    return (
      !!currentUsername &&
      targetUser.username.toLowerCase() === currentUsername.toLowerCase() &&
      ((targetUser.agentNickname || effectiveAgentNickname || "").trim() ||
        null) === ((effectiveAgentNickname || "").trim() || null)
    );
  };

  const handleSubmitProfileComment = async () => {
    if (!selectedUser?.username || profileCommentSubmitting) return;
    const value = profileCommentInput.trim();
    if (!value) return;

    if (selectedUserIsBot) {
      toast.error("Bot profiline yorum yapılamaz.");
      return;
    }

    if (isGuestUser) {
      toast.error("Misafir kullanıcılar profil yorumu yapamaz.");
      return;
    }

    setProfileCommentSubmitting(true);
    try {
      const created = await apiClient.profileComments.create(
        selectedUser.username,
        value,
        selectedProfileAgentNickname,
      );
      setProfileCommentInput("");
      if (created.status === "approved") {
        setProfileComments((prev) => [...prev, created]);
        toast.success("Yorumunuz yayınlandı.");
      } else if (!isSelectedProfileOwner && created.status === "pending") {
        setMyPendingProfileComments((prev) => [...prev, created]);
        toast.success("Yorumunuz onay için gönderildi.");
      }
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.status === 403 &&
        error.message?.trim()
      ) {
        toast.error(error.message);
      } else if (
        error instanceof ApiError &&
        error.status === 400 &&
        error.message?.trim()
      ) {
        toast.error(error.message);
      } else {
        toast.error("Yorum gönderilemedi.");
      }
    } finally {
      setProfileCommentSubmitting(false);
    }
  };

  const handleApproveProfileComment = async (commentId: number) => {
    if (!selectedUser?.username || profileCommentApprovingId) return;
    if (!isSelectedProfileOwner) {
      toast.error("Sadece profil sahibi yorum onaylayabilir.");
      return;
    }
    setProfileCommentApprovingId(commentId);
    try {
      const approved = await apiClient.profileComments.approve(
        selectedUser.username,
        commentId,
        selectedProfileAgentNickname,
      );
      setPendingProfileComments((prev) =>
        prev.filter((comment) => comment.id !== commentId),
      );
      setMyPendingProfileComments((prev) =>
        prev.filter((comment) => comment.id !== commentId),
      );
      setProfileComments((prev) => [...prev, approved]);
    } catch (error) {
      if (error instanceof ApiError && error.message?.trim()) {
        toast.error(error.message);
      } else {
        toast.error("Yorum onaylanamadı.");
      }
    } finally {
      setProfileCommentApprovingId(null);
    }
  };

  const handleDeleteProfileComment = async (commentId: number) => {
    if (!selectedUser?.username || profileCommentDeletingId) return;
    if (!isSelectedProfileOwner) {
      toast.error("Sadece profil sahibi yorumu silebilir.");
      return;
    }
    const confirmed = window.confirm("Bu yorumu silmek istiyor musunuz?");
    if (!confirmed) return;

    setProfileCommentDeletingId(commentId);
    try {
      await apiClient.profileComments.delete(
        selectedUser.username,
        commentId,
        selectedProfileAgentNickname,
      );
      setProfileComments((prev) =>
        prev.filter((comment) => comment.id !== commentId),
      );
      setPendingProfileComments((prev) =>
        prev.filter((comment) => comment.id !== commentId),
      );
      setMyPendingProfileComments((prev) =>
        prev.filter((comment) => comment.id !== commentId),
      );
    } catch (error) {
      if (error instanceof ApiError && error.message?.trim()) {
        toast.error(error.message);
      } else {
        toast.error("Yorum silinemedi.");
      }
    } finally {
      setProfileCommentDeletingId(null);
    }
  };

  const isUserOnlineByUsername = (username?: string | null) => {
    if (!username) return false;
    return activeTenantUsers.some(
      (user) => user.username.toLowerCase() === username.toLowerCase(),
    );
  };

  const isVoiceCallEnabledForUser = (isGuest: boolean) => {
    if (!communicationPermissions) return true;
    return isGuest
      ? communicationPermissions.guestVoiceCallEnabled
      : communicationPermissions.membersVoiceCallEnabled;
  };

  const guardVoiceCallFlow = (targetIsGuest?: boolean) => {
    const guest = targetIsGuest ?? isGuestUser;
    if (!isVoiceCallEnabledForUser(guest)) {
      toast.error(
        guest
          ? "Misafir sesli/görüntülü arama kapalı."
          : "Üye sesli/görüntülü arama kapalı.",
      );
      return false;
    }
    return true;
  };

  const ensureMicrophoneModerationPermission = () => {
    if (canModerateMicrophone) return true;
    toast.error("Mikrofon işlemleri için yetkiniz yok.");
    return false;
  };

  const ensureCameraModerationPermission = () => {
    if (canModerateCamera) return true;
    toast.error("Kamera engelle yetkiniz yok.");
    return false;
  };

  const ensureMicrophoneInvitePermission = () => {
    if (canInviteMicrophone) return true;
    toast.error("Mikrofon daveti yetkiniz yok.");
    return false;
  };

  const ensureTempOperatorPermission = () => {
    if (canGrantTempOperator) return true;
    toast.error("Geçici operatörlük verme yetkiniz yok.");
    return false;
  };

  const ensureKickPermission = () => {
    if (canKickFromSite) return true;
    toast.error("Siteden atma yetkiniz yok.");
    return false;
  };

  const ensureBlockPermission = () => {
    if (canBlockUsers) return true;
    toast.error("Engel yetkiniz yok.");
    return false;
  };

  const ensureBanPermission = () => {
    if (canManageBan) return true;
    toast.error("Banlama yetkiniz yok.");
    return false;
  };

  const guardedStartVoiceCall = (user?: {
    username: string;
    displayUsername?: string;
    gender: "male" | "female";
    icon?: string | null;
    roleName?: string | null;
    isGuest?: boolean;
    agentNickname?: string | null;
    roleStarCount?: number | null;
  } | null) => {
    if (!user) return;
    if (!guardVoiceCallFlow()) return;
    if (!isUserOnlineByUsername(user.username)) {
      toast.error("Kullanıcı sitede değil.");
      return;
    }
    const callDisplayUsername =
      user.displayUsername ||
      (user.agentNickname
        ? currentUserStarCount >= (user.roleStarCount || 0)
          ? `${user.agentNickname} (${user.username})`
          : user.agentNickname
        : user.username);
    onStartVoiceCall?.({ ...user, displayUsername: callDisplayUsername });
  };

  const guardedStartVideoCall = (user?: {
    username: string;
    displayUsername?: string;
    gender: "male" | "female";
    icon?: string | null;
    roleName?: string | null;
    isGuest?: boolean;
    agentNickname?: string | null;
    roleStarCount?: number | null;
  } | null) => {
    if (!user) return;
    const targetIsGuest = user.isGuest === true || Boolean(user.agentNickname);
    if (!guardVoiceCallFlow(targetIsGuest)) return;
    if (!isUserOnlineByUsername(user.username)) {
      toast.error("Kullanıcı sitede değil.");
      return;
    }
    const callDisplayUsername =
      user.displayUsername ||
      (user.agentNickname
        ? currentUserStarCount >= (user.roleStarCount || 0)
          ? `${user.agentNickname} (${user.username})`
          : user.agentNickname
        : user.username);
    onStartVideoCall?.({ ...user, displayUsername: callDisplayUsername });
  };

  const findCallTargetUser = (peerName: string) => {
    const normalizedPeerName = normalizeUsername(peerName);
    const parenthesizedUsername =
      peerName.match(/\(([^)]+)\)\s*$/)?.[1]?.trim() || "";
    const normalizedParenthesizedUsername =
      normalizeUsername(parenthesizedUsername);
    const seenUsers = new Set<string>();
    const uniqueKnownUsers = [...activeTenantUsers, ...users].filter((user) => {
      const key = normalizeUsername(user.username);
      if (!key || seenUsers.has(key)) return false;
      seenUsers.add(key);
      return true;
    });

    return (
      uniqueKnownUsers.find((user) => {
        const candidates = [
          user.username,
          user.displayUsername,
          user.agentNickname,
        ].map((value) => normalizeUsername(value));

        return (
          candidates.includes(normalizedPeerName) ||
          (normalizedParenthesizedUsername
            ? candidates.includes(normalizedParenthesizedUsername)
            : false)
        );
      }) || null
    );
  };

  const handleCallBack = (
    call: { name: string },
    event?: MouseEvent<HTMLButtonElement | HTMLDivElement>,
  ) => {
    event?.stopPropagation();
    const targetUser = findCallTargetUser(call.name);
    if (!targetUser) {
      toast.error("Kullanıcı sitede değil.");
      return;
    }
    guardedStartVoiceCall(targetUser);
  };

  const handleDeleteCallHistory = (
    id: number,
    event?: MouseEvent<HTMLButtonElement>,
  ) => {
    event?.stopPropagation();
    void onDeleteCallHistory?.(id);
  };

  const MODERATION_WARNING_TEXT =
    "Yönetici size uyarı gönderdi! Lütfen, bundan sonra daha dikkatli olunuz.";

  const adminActions = useMemo(() => {
    const selectedIsTempOperator = isTempOperator(effectiveSelectedUser?.username);
    const selectedIsBot = effectiveSelectedUser?.isBot === true;
    const canReleaseGuestAlias =
      hasAdminPrivileges && hasActiveGuestAlias(effectiveSelectedUser);
    const destructiveApplyColor = "text-red-600";
    const neutralRevertColor = "text-zinc-700";
    const activeBotColor = "text-red-600 font-semibold";
    if (selectedIsBot) {
      if (!canManageBots) {
        return [];
      }
      return [
        {
          label: "Canlı yayına bağlansın",
          action: "botGoLive",
          color: effectiveSelectedUser?.isInVoiceChat
            ? activeBotColor
            : neutralRevertColor,
        },
        {
          label: effectiveSelectedUser?.isHandRaised
            ? "El indirsin"
            : "El kaldırsın",
          action: "botRaiseHand",
          color: effectiveSelectedUser?.isHandRaised
            ? activeBotColor
            : neutralRevertColor,
        },
        {
          label: "Botu konuştur",
          action: "botSpeak",
          color: neutralRevertColor,
        },
        ...(effectiveSelectedUser?.isAI
          ? []
          : [
              {
                label: "Odaya Işınla",
                action: "teleport",
                color: neutralRevertColor,
              },
            ]),
        {
          label: "Sistem Dışına At",
          action: "kick",
          color: destructiveApplyColor,
        },
        {
          label: effectiveSelectedUser?.roomMuted
            ? "Oda susturmasını kaldır"
            : "Odada Sustur",
          action: "muteRoom",
          color: effectiveSelectedUser?.roomMuted
            ? activeBotColor
            : destructiveApplyColor,
        },
        {
          label: effectiveSelectedUser?.globalMuted
            ? "Tüm odalarda susturmayı kaldır"
            : "Tüm Odalarda Sustur",
          action: "muteAll",
          color: effectiveSelectedUser?.globalMuted
            ? activeBotColor
            : destructiveApplyColor,
        },
      ];
    }

    const actions = [
      ...(canManageBan
        ? [
            { label: "Hesabı banla", action: "ban", color: neutralRevertColor },
            {
              label: "Cihaz banla",
              action: "deviceBan",
              color: destructiveApplyColor,
            },
          ]
        : []),
      ...(canKickFromSite
        ? [{ label: "Sistem Dışı At", action: "kick", color: neutralRevertColor }]
        : []),
      ...(canModerateMicrophone
        ? [
            {
              label: effectiveSelectedUser?.globalMuted
                ? "Tüm odalarda susturmayı kaldır"
                : "Tüm Odalarda Sustur",
              action: "muteAll",
              color: effectiveSelectedUser?.globalMuted
                ? neutralRevertColor
                : destructiveApplyColor,
            },
            {
              label: effectiveSelectedUser?.roomMuted
                ? "Oda susturmasını kaldır"
                : "Odada Sustur",
              action: "muteRoom",
              color: effectiveSelectedUser?.roomMuted
                ? neutralRevertColor
                : destructiveApplyColor,
            },
          ]
        : []),
      {
        label: "Kullanıcı Bilgileri",
        action: "userInfo",
        color: neutralRevertColor,
      },
      { label: "Uyarı gönder", action: "warn", color: neutralRevertColor },
      ...(canReleaseGuestAlias
        ? [
            {
              label: "Guestten çıkar",
              action: "guestAliasRelease",
              color: neutralRevertColor,
            },
          ]
        : []),
      ...(effectiveSelectedUser &&
      (effectiveSelectedUser.isGuest ||
        (effectiveSelectedUser.roleStarCount || 0) <= 0 ||
        selectedIsTempOperator) &&
      canGrantTempOperator
        ? [
            {
              label: selectedIsTempOperator
                ? "Geçici operatörlüğü al"
                : "Geçici Operatörlük Ver",
              action: selectedIsTempOperator ? "tempOpRevoke" : "tempOp",
              color: selectedIsTempOperator
                ? neutralRevertColor
                : destructiveApplyColor,
            },
          ]
        : []),
      ...(canModerateCamera
        ? [
            {
              label: effectiveSelectedUser?.cameraBanned
                ? "Kamera yasağını kaldır"
                : "Kamerasını yasakla",
              action: "banCamera",
              color: effectiveSelectedUser?.cameraBanned
                ? neutralRevertColor
                : destructiveApplyColor,
            },
          ]
        : []),
      ...(canModerateMicrophone
        ? [
            {
              label: effectiveSelectedUser?.micBanned
                ? "Mikrofon yasağını kaldır"
                : "Mikrofonunu yasakla",
              action: "banMic",
              color: effectiveSelectedUser?.micBanned
                ? neutralRevertColor
                : destructiveApplyColor,
            },
            {
              label: "Mikrofondan İndir",
              action: "dropMic",
              color: neutralRevertColor,
            },
          ]
        : []),
      ...(canInviteMicrophone
        ? [
            {
              label: "Mikrofona Davet Et",
              action: "inviteMic",
              color: neutralRevertColor,
            },
          ]
        : []),
      {
        label: "Odaya Davet Et",
        action: "inviteRoom",
        color: neutralRevertColor,
      },
      { label: "Odaya Işınla", action: "teleport", color: neutralRevertColor },
    ];
    return actions;
  }, [
    canManageBan,
    canModerateCamera,
    canGrantTempOperator,
    canKickFromSite,
    canInviteMicrophone,
    canModerateMicrophone,
    effectiveSelectedUser,
    hasActiveGuestAlias,
    hasAdminPrivileges,
  ]);

  const getBotNumericId = (user: RoomUser): number | null => {
    return getRoomUserBotNumericId(user);
  };

  const resolveBotNumericId = async (user: RoomUser): Promise<number | null> => {
    try {
      const response = await apiClientRef.current.get("/bot");
      const bots = Array.isArray(response.data) ? response.data : response;
      const normalizedUsername = user.username.trim().toLocaleLowerCase("tr-TR");
      const matchedBot = Array.isArray(bots)
        ? bots.find(
            (bot: { id?: unknown; username?: unknown }) =>
              String(bot.username || "")
                .trim()
                .toLocaleLowerCase("tr-TR") === normalizedUsername,
          )
        : null;
      const numericId = Number(matchedBot?.id);
      if (Number.isFinite(numericId)) {
        return numericId;
      }
    } catch (error) {
      console.error("Bot id bulunamadı:", error);
    }

    return getBotNumericId(user);
  };

  const patchBotUserState = (
    username: string,
    patch: Partial<RoomUser>,
  ) => {
    const normalizedUsername = username.trim().toLowerCase();
    setActiveTenantUsers((prev) =>
      prev.map((user) =>
        user.isBot && user.username.trim().toLowerCase() === normalizedUsername
          ? { ...user, ...patch }
          : user,
      ),
    );
    onBotUserPatch?.(username, patch);
    setSelectedUser((prev) =>
      prev?.isBot && prev.username.trim().toLowerCase() === normalizedUsername
        ? { ...prev, ...patch }
        : prev,
    );

    if (socket?.connected) {
      socket.emit("bot:stateUpdate", {
        username,
        isInVoiceChat: patch.isInVoiceChat,
        isMuted: patch.isMuted,
        isHandRaised: patch.isHandRaised,
        handRaisedAt: patch.handRaisedAt,
        isCameraOn: patch.isCameraOn,
      });
    }
  };

  const botToastOptions = { duration: 1200 };
  const botErrorToastOptions = { duration: 1600 };

  const handleRemoveBotFromSite = async (user: RoomUser) => {
    const botId = await resolveBotNumericId(user);
    if (botId === null) {
      toast.error("Bot bulunamadı", botErrorToastOptions);
      return;
    }

    try {
      setAdminActionLoading(true);
      await apiClientRef.current.patch(`/bot/${botId}`, { room: null });
      const normalizedUsername = user.username.trim().toLowerCase();
      setActiveTenantUsers((prev) =>
        prev.filter(
          (activeUser) =>
            activeUser.username.trim().toLowerCase() !== normalizedUsername,
        ),
      );
      onBotUserPatch?.(user.username, { rooms: [] });
      setSelectedUser(null);
      toast.success("Sistem dışına atıldı", botToastOptions);
    } catch (error) {
      console.error("Bot sistem dışına atılamadı:", error);
      toast.error("Atılamadı", botErrorToastOptions);
    } finally {
      setAdminActionLoading(false);
    }
  };

  const handleBotAdminAction = (action: string, user: RoomUser) => {
    if (action === "botGoLive") {
      const nextIsInVoiceChat = user.isInVoiceChat !== true;
      patchBotUserState(user.username, {
        isInVoiceChat: nextIsInVoiceChat,
        isMuted: true,
      });
      toast.success(
        nextIsInVoiceChat ? "Canlı yayına bağlandı" : "Kesildi",
        botToastOptions,
      );
      return;
    }

    if (action === "botRaiseHand") {
      const nextIsHandRaised = user.isHandRaised !== true;
      patchBotUserState(user.username, {
        isHandRaised: nextIsHandRaised,
        handRaisedAt: nextIsHandRaised ? Date.now() : null,
      });
      toast.success(
        nextIsHandRaised ? "El kaldırdı" : "El indirildi",
        botToastOptions,
      );
      return;
    }

    if (action === "botSpeak") {
      setBotSpeakTarget(user);
      setBotSpeakMessage("");
      setShowBotSpeakModal(true);
      return;
    }

    if (action === "teleport") {
      setTeleportTargetUser(user);
      setShowTeleportModal(true);
      fetchRooms();
      return;
    }

    if (action === "kick") {
      void handleRemoveBotFromSite(user);
      return;
    }

    if (action === "muteRoom") {
      void handleToggleBotRoomMute(user);
      return;
    }

    if (action === "muteAll") {
      void handleToggleBotGlobalMute(user);
      return;
    }

  };

  const handleSubmitBotSpeak = async () => {
    if (!botSpeakTarget) return;
    if (botSpeakInFlightRef.current) return;
    const message = botSpeakMessage.trim();
    if (!message) {
      toast.error("Mesaj boş", botErrorToastOptions);
      return;
    }

    const botId = await resolveBotNumericId(botSpeakTarget);
    if (botId === null) {
      toast.error("Bot bulunamadı", botErrorToastOptions);
      return;
    }

    try {
      botSpeakInFlightRef.current = true;
      setAdminActionLoading(true);
      await apiClientRef.current.post(`/bot/${botId}/speak`, { message });
      setShowBotSpeakModal(false);
      setBotSpeakTarget(null);
      setBotSpeakMessage("");
      setSelectedUser(null);
      toast.success("Gönderildi", botToastOptions);
    } catch (error) {
      const apiError = toApiError(error);
      toast.error(apiError.message || "Gönderilemedi", botErrorToastOptions);
    } finally {
      botSpeakInFlightRef.current = false;
      setAdminActionLoading(false);
    }
  };

  const handleToggleBotRoomMute = async (user: RoomUser) => {
    const botId = await resolveBotNumericId(user);
    const roomKey = resolveTargetRoomKey(user);
    if (botId === null || !roomKey) {
      toast.error("Bot bulunamadı", botErrorToastOptions);
      return;
    }

    try {
      setAdminActionLoading(true);
      const response = await apiClientRef.current.post(
        `/bot/${botId}/toggle-room-mute`,
        { roomKey },
      );
      await refreshBotMutePreferences();
      window.dispatchEvent(new Event("botMutePreferencesChanged"));
      const muted = response?.data?.muted === true;
      patchBotUserState(user.username, { roomMuted: muted });
      toast.success(muted ? "Susturuldu" : "Susturma kalktı", botToastOptions);
    } catch (error) {
      const apiError = toApiError(error);
      toast.error(apiError.message || "İşlem olmadı", botErrorToastOptions);
    } finally {
      setAdminActionLoading(false);
    }
  };

  const handleToggleBotGlobalMute = async (user: RoomUser) => {
    const botId = await resolveBotNumericId(user);
    if (botId === null) {
      toast.error("Bot bulunamadı", botErrorToastOptions);
      return;
    }

    try {
      setAdminActionLoading(true);
      const response = await apiClientRef.current.post(
        `/bot/${botId}/toggle-global-mute`,
      );
      await refreshBotMutePreferences();
      window.dispatchEvent(new Event("botMutePreferencesChanged"));
      const muted = response?.data?.muted === true;
      patchBotUserState(user.username, { globalMuted: muted });
      toast.success(muted ? "Susturuldu" : "Susturma kalktı", botToastOptions);
    } catch (error) {
      const apiError = toApiError(error);
      toast.error(apiError.message || "İşlem olmadı", botErrorToastOptions);
    } finally {
      setAdminActionLoading(false);
    }
  };

  const handleGrantTempOperator = async (user: RoomUser) => {
    if (!ensureTempOperatorPermission()) return;
    if (!user?.username) {
      toast.error("Kullanıcı adı bulunamadı.");
      return;
    }

    if (!(user.isGuest || (user.roleStarCount || 0) <= 0)) {
      toast.error("Geçici operatörlük sadece üye veya misafire verilebilir.");
      return;
    }

    if (!socket || !socket.connected) {
      toast.error("Sunucu bağlantısı yok.");
      return;
    }

    const ack = await new Promise<SocketAck>((resolve) => {
      socket.emit(
        "moderation:tempOperator:grant",
        { targetUsername: user.username },
        (response: SocketAck) => resolve(response),
      );
    });

    if (!ack || ack.status !== "ok") {
      const code = ack?.code;
      const messageByCode: Record<string, string> = {
        invalid_payload: "Geçici operatörlük verilemedi.",
        sender_not_found: "Kendi oturum bilgileriniz bulunamadı.",
        insufficient_privileges: "Bu işlem için yetkiniz yok.",
        insufficient_rank: ACTION_NOT_ALLOWED_MESSAGE,
        self_target: "Kendinize geçici operatörlük veremezsiniz.",
        target_not_found: "Kullanıcı çevrimdışı.",
        not_eligible: "Sadece üye veya misafire geçici operatörlük verilebilir.",
      };
      toast.error(
        messageByCode[code || ""] ||
          ack?.message ||
          "Geçici operatörlük verilemedi.",
      );
      return;
    }

    toast.success(`${user.username} kullanıcısına geçici operatörlük verildi.`);
  };

  const handleRevokeTempOperator = async (user: RoomUser) => {
    if (!ensureTempOperatorPermission()) return;
    if (!user?.username) {
      toast.error("Kullanıcı adı bulunamadı.");
      return;
    }

    if (!socket || !socket.connected) {
      toast.error("Sunucu bağlantısı yok.");
      return;
    }

    const ack = await new Promise<SocketAck>((resolve) => {
      socket.emit(
        "moderation:tempOperator:revoke",
        { targetUsername: user.username },
        (response: SocketAck) => resolve(response),
      );
    });

    if (!ack || ack.status !== "ok") {
      const code = ack?.code;
      const messageByCode: Record<string, string> = {
        invalid_payload: "Geçici operatörlük geri alınamadı.",
        sender_not_found: "Kendi oturum bilgileriniz bulunamadı.",
        insufficient_privileges: "Bu işlem için yetkiniz yok.",
        insufficient_rank: ACTION_NOT_ALLOWED_MESSAGE,
        self_target: "Kendinizden geçici operatörlük alamazsınız.",
        not_found: "Kullanıcıda geçici operatörlük aktif değil.",
      };
      toast.error(
        messageByCode[code || ""] ||
          ack?.message ||
          "Geçici operatörlük geri alınamadı.",
      );
      return;
    }

    toast.success(`${user.username} için geçici operatörlük kaldırıldı.`);
  };

  const handleShowUserInfo = async (user: RoomUser) => {
    if (!socket || !socket.connected) {
      toast.error("Sunucu bağlantısı yok.");
      return;
    }

    const ack = await new Promise<SocketAck>((resolve) => {
      socket.emit(
        "moderation:userInfo:request",
        { targetUsername: user.username },
        (response: SocketAck) => resolve(response),
      );
    });

    if (!ack || ack.status !== "ok" || !ack.data) {
      const code = ack?.code;
      const messageByCode: Record<string, string> = {
        invalid_payload: "Kullanıcı bilgisi alınamadı.",
        sender_not_found: "Kendi oturum bilgileriniz bulunamadı.",
        insufficient_privileges: "Bu işlem için yetkiniz yok.",
        insufficient_rank: ACTION_NOT_ALLOWED_MESSAGE,
        self_target: "Kendiniz için bu işlem kullanılamaz.",
        target_not_found: "Kullanıcı çevrimdışı.",
        ip_not_available: "Kullanıcının IP bilgisi bulunamadı.",
      };
      toast.error(
        messageByCode[code || ""] ||
          ack?.message ||
          "Kullanıcı bilgileri alınamadı.",
      );
      return;
    }

    setUserInfoData(ack.data as ModerationUserInfoData);
    setShowUserInfoModal(true);
  };

  const handleSendWarning = async (user: RoomUser) => {
    if (!socket || !socket.connected) {
      toast.error("Sunucu bağlantısı yok.");
      return;
    }

    const ack = await new Promise<SocketAck>((resolve) => {
      socket.emit(
        "moderation:warnUser",
        {
          targetUsername: user.username,
          message: MODERATION_WARNING_TEXT,
        },
        (response: SocketAck) => resolve(response),
      );
    });

    if (!ack || ack.status !== "ok") {
      const code = ack?.code;
      const messageByCode: Record<string, string> = {
        invalid_payload: "Uyarı gönderilemedi.",
        sender_not_found: "Kendi oturum bilgileriniz bulunamadı.",
        insufficient_privileges: "Bu işlem için yetkiniz yok.",
        insufficient_rank: ACTION_NOT_ALLOWED_MESSAGE,
        self_target: "Kendinize uyarı gönderemezsiniz.",
        target_not_found: "Kullanıcı çevrimdışı.",
      };
      toast.error(
        messageByCode[code || ""] || ack?.message || "Uyarı gönderilemedi.",
      );
      return;
    }

    toast.success(`${user.username} kullanıcısına uyarı gönderildi.`);
  };

  const handleInviteMic = async (user: RoomUser) => {
    if (!ensureMicrophoneInvitePermission()) return;
    if (!socket || !socket.connected) {
      toast.error("Sunucu bağlantısı yok.");
      return;
    }
    if (!currentRoomId) {
      toast.error("Aktif oda bilgisi bulunamadı.");
      return;
    }

    const ack = await new Promise<SocketAck>((resolve) => {
      socket.emit(
        "moderation:micInvite",
        {
          targetUsername: user.username,
          room: currentRoomId,
          roomName: currentRoomName || undefined,
        },
        (response: SocketAck) => resolve(response),
      );
    });

    if (!ack || ack.status !== "ok") {
      const code = ack?.code;
      const messageByCode: Record<string, string> = {
        invalid_payload: "Mikrofon daveti gönderilemedi.",
        sender_not_found: "Kendi oturum bilgileriniz bulunamadı.",
        insufficient_privileges: "Bu işlem için yetkiniz yok.",
        insufficient_rank: ACTION_NOT_ALLOWED_MESSAGE,
        self_target: "Kendinize davet gönderemezsiniz.",
        target_not_found: "Kullanıcı çevrimdışı.",
        target_is_protected:
          "Bu kullanıcı korunuyor. Yalnızca korumayı açan yetkiliyle aynı yıldız veya daha üst yetkililer işlem yapabilir.",
        not_same_room: "Mikrofon daveti yalnızca aynı odadaki kullanıcıya gönderilebilir.",
      };
      toast.error(
        messageByCode[code || ""] ||
          ack?.message ||
          "Mikrofon daveti gönderilemedi.",
      );
      return;
    }

    toast.success(`${user.username} kullanıcısına mikrofon daveti gönderildi.`);
  };

  const handleMicInviteResponse = async (accepted: boolean) => {
    if (!incomingMicInvite) return;
    if (!socket || !socket.connected) {
      toast.error("Sunucu bağlantısı yok.");
      return;
    }

    const invite = incomingMicInvite;
    const ack = await new Promise<SocketAck>((resolve) => {
      socket.emit(
        "moderation:micInviteRespond",
        { inviteId: invite.inviteId, accepted },
        (response: SocketAck) => resolve(response),
      );
    });

    if (!ack || ack.status !== "ok") {
      toast.error("Mikrofon daveti yanıtlanamadı.");
      return;
    }

    setIncomingMicInvite(null);

    if (accepted) {
      try {
        await Promise.resolve(
          onMicInviteAccepted?.({
            fromUsername: invite.fromUsername,
            room: invite.room,
            roomName: invite.roomName,
          }),
        );
      } catch (error) {
        console.error("Mic invite accept action failed:", error);
        toast.error("Mikrofona geçiş sırasında bir hata oluştu.");
      }
    }
  };

  const handleBanUser = async (user: RoomUser) => {
    if (!ensureBanPermission()) return;
    if (!user?.username) {
      toast.error("Kullanıcı adı bulunamadı.");
      return;
    }

    const payload = {
      username: user.username,
      reason: "Kurallara aykırı davranış",
      expiresAt: "2025-12-31T23:59:59.000Z",
    };

    try {
      setAdminActionLoading(true);
      await apiClientRef.current.post("/moderation/ban", payload);
      toast.success(`${user.username} hesabı başarıyla banlandı.`);
      setShowAdminMenu(false);
    } catch (error) {
      console.error("Hesap ban isteği başarısız:", error);
      const apiError = toApiError(error);
      toast.error(
        apiError.message ||
          "Hesap ban işlemi başarısız oldu. Lütfen tekrar deneyin.",
      );
    } finally {
      setAdminActionLoading(false);
    }
  };

  const handleDeviceBanUser = async (user: RoomUser) => {
    if (!ensureBanPermission()) return;
    if (!user?.username) {
      toast.error("Kullanıcı adı bulunamadı.");
      return;
    }

    const payload: { username: string; loginHistoryId?: number } = {
      username: user.username,
    };

    if (typeof user.loginHistoryId === "number" && Number.isFinite(user.loginHistoryId)) {
      payload.loginHistoryId = user.loginHistoryId;
    }

    try {
      setAdminActionLoading(true);
      await apiClientRef.current.post("/moderation/device-ban", payload);
      toast.success(`${user.username} cihazı başarıyla banlandı.`);
      setShowAdminMenu(false);
    } catch (error) {
      console.error("Cihaz ban isteği başarısız:", error);
      const apiError = toApiError(error);
      toast.error(
        apiError.message ||
          "Cihaz ban işlemi başarısız oldu. Lütfen tekrar deneyin.",
      );
    } finally {
      setAdminActionLoading(false);
    }
  };

  const handleInviteUserToRoom = (user: RoomUser) => {
    if (!user?.username) {
      toast.error("Kullanıcı adı bulunamadı.");
      return;
    }

    if (user.username === currentUsername) {
      toast.error("Kendinize oda daveti gönderemezsiniz.");
      return;
    }

    if (!socket || !socket.connected) {
      toast.error("Sunucu bağlantısı yok.");
      return;
    }

    const targetRoomName = currentRoomName?.trim();
    if (!targetRoomName) {
      toast.error("Aktif oda bilgisi alınamadı.");
      return;
    }

    socket.emit("room:invite", {
      targetUsername: user.username,
      roomName: targetRoomName,
    });
  };

  const handleReleaseGuestAlias = async (user: RoomUser) => {
    if (!hasActiveGuestAlias(user)) {
      toast.error("Bu kullanıcı guest görünümünde değil.");
      return;
    }

    const isRootUser = currentUsername?.toLocaleLowerCase("tr-TR") === "root";
    if (!isRootUser && Number(currentUserStarCount || 0) < 1) {
      toast.error(ACTION_NOT_ALLOWED_MESSAGE);
      return;
    }

    if (!socket || !socket.connected) {
      toast.error("Sunucu bağlantısı yok.");
      return;
    }

    const room = currentRoomId || currentRoomName;
    if (!room) {
      toast.error("Aktif oda bilgisi alınamadı.");
      return;
    }

    try {
      setAdminActionLoading(true);
      const ack = await new Promise<SocketAck>((resolve) => {
        socket.emit(
          "moderation:guestAlias:release",
          { room, targetUsername: user.username },
          (response: SocketAck) => resolve(response),
        );
      });

      if (!ack || ack.status !== "ok") {
        const messageByCode: Record<string, string> = {
          invalid_payload: "Guest görünümü kaldırılamadı.",
          sender_not_in_room: "Kendi oda bilgileriniz bulunamadı.",
          insufficient_privileges: ACTION_NOT_ALLOWED_MESSAGE,
          self_target: "Kendi guest görünümünüzü kaldıramazsınız.",
          target_not_found_in_room: "Kullanıcı odada bulunamadı.",
          target_not_guest: "Bu kullanıcı misafir değil.",
          alias_not_active: "Bu kullanıcı zaten gerçek nickiyle görünüyor.",
        };
        toast.error(
          messageByCode[ack?.code || ""] ||
            ack?.message ||
            "Guest görünümü kaldırılamadı.",
        );
        return;
      }

      toast.success(`${user.username} artık kendi nickiyle görünecek.`);
    } finally {
      setAdminActionLoading(false);
    }
  };

  const handleAdminAction = (action: string, user: RoomUser) => {
    setShowAdminMenu(false);
    if (user.isBot) {
      handleBotAdminAction(action, user);
      return;
    }

    const rankProtectedActions = new Set([
      "ban",
      "deviceBan",
      "kick",
      "tempOp",
      "tempOpRevoke",
      "userInfo",
      "warn",
      "inviteMic",
      "inviteRoom",
      "teleport",
      "banCamera",
      "banMic",
      "dropMic",
      "muteRoom",
      "muteAll",
    ]);
    const isRootUser = currentUsername?.toLocaleLowerCase("tr-TR") === "root";
    const targetStarCount = Number(user.roleStarCount || 0);
    if (
      rankProtectedActions.has(action) &&
      !isRootUser &&
      Number(currentUserStarCount || 0) <= targetStarCount
    ) {
      toast.error(ACTION_NOT_ALLOWED_MESSAGE);
      return;
    }

    if (
      ["banMic", "dropMic", "muteRoom", "muteAll"].includes(action) &&
      !ensureMicrophoneModerationPermission()
    ) {
      return;
    }
    if (
      ["tempOp", "tempOpRevoke"].includes(action) &&
      !ensureTempOperatorPermission()
    ) {
      return;
    }
    if (action === "kick" && !ensureKickPermission()) {
      return;
    }
    if ((action === "ban" || action === "deviceBan") && !ensureBanPermission()) {
      return;
    }
    if (action === "banCamera" && !ensureCameraModerationPermission()) {
      return;
    }
    if (action === "inviteMic" && !ensureMicrophoneInvitePermission()) {
      return;
    }
    if (action === "ban") {
      void handleBanUser(user);
    } else if (action === "deviceBan") {
      void handleDeviceBanUser(user);
    } else if (action === "kick") {
      void handleKickUser(user);
    } else if (action === "guestAliasRelease") {
      void handleReleaseGuestAlias(user);
    } else if (action === "tempOp") {
      void handleGrantTempOperator(user);
    } else if (action === "tempOpRevoke") {
      void handleRevokeTempOperator(user);
    } else if (action === "userInfo") {
      void handleShowUserInfo(user);
    } else if (action === "warn") {
      void handleSendWarning(user);
    } else if (action === "inviteMic") {
      void handleInviteMic(user);
    } else if (action === "inviteRoom") {
      handleInviteUserToRoom(user);
    } else if (action === "teleport") {
      const targetStarCount = user.roleStarCount || 0;
      if (
        currentUserStarCount <= targetStarCount &&
        currentUsername?.toLocaleLowerCase("tr-TR") !== "root"
      ) {
        alert(ACTION_NOT_ALLOWED_MESSAGE);
        return;
      }
      setTeleportTargetUser(user);
      setShowTeleportModal(true);
      fetchRooms(); // Odaların güncel olduğundan emin ol
    } else if (action === "banCamera") {
      void handleToggleCameraBan(user);
    } else if (action === "banMic") {
      void handleToggleMicBan(user);
    } else if (action === "dropMic") {
      void handleDropMic(user);
    } else if (action === "muteRoom") {
      void handleToggleRoomMute(user);
    } else if (action === "muteAll") {
      void handleToggleGlobalMute(user);
    }
  };

  const emitWithAckTimeout = <TResponse,>(
    eventName: string,
    payload: Record<string, unknown>,
    timeoutMs = 5000,
  ) => {
    if (!socket || !socket.connected) {
      return Promise.reject(new Error("Sunucu bağlantısı yok."));
    }

    return new Promise<TResponse>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        reject(new Error("Sunucudan yanıt alınamadı. Lütfen tekrar deneyin."));
      }, timeoutMs);

      socket.emit(eventName, payload, (ack: TResponse) => {
        window.clearTimeout(timeoutId);
        resolve(ack);
      });
    });
  };

  const resolveDisplayedMuteState = (
    user: RoomUser,
    globalUser?: RoomUser | null,
  ) => {
    const effectiveMicBanned =
      user.micBanned === true || globalUser?.micBanned === true;
    const effectiveGlobalMuted =
      user.globalMuted === true || globalUser?.globalMuted === true;

    return {
      showMicBannedIcon: effectiveMicBanned,
      showGlobalMutedIcon: effectiveGlobalMuted,
    };
  };

  const resolveTargetRoomKey = (user: RoomUser): string | null => {
    const userRooms = user.rooms || [];
    const normalizedCurrentRoomId = (currentRoomId || "").trim().toLowerCase();
    const normalizedCurrentRoomName = (currentRoomName || "")
      .trim()
      .toLowerCase();

    if (normalizedCurrentRoomId) {
      const exactRoomMatch = userRooms.find(
        (room) => room.roomKey?.trim().toLowerCase() === normalizedCurrentRoomId,
      );
      if (exactRoomMatch?.roomKey) {
        return exactRoomMatch.roomKey;
      }
    }

    if (normalizedCurrentRoomName) {
      const namedRoomMatch = userRooms.find(
        (room) =>
          room.roomName?.trim().toLowerCase() === normalizedCurrentRoomName,
      );
      if (namedRoomMatch?.roomKey) {
        return namedRoomMatch.roomKey;
      }
    }

    if (userRooms[0]?.roomKey) {
      return userRooms[0].roomKey;
    }

    return currentRoomId || null;
  };

  const handleDropMic = async (user: RoomUser) => {
    if (!ensureMicrophoneModerationPermission()) return;
    if (!user?.username) {
      toast.error("Kullanıcı adı bulunamadı.");
      return;
    }
    if (!currentRoomId) {
      toast.error("Aktif oda bilgisi bulunamadı.");
      return;
    }
    if (!socket || !socket.connected) {
      toast.error("Sunucu bağlantısı yok.");
      return;
    }

    try {
      setAdminActionLoading(true);
      const response = await emitWithAckTimeout<{
        status: "ok" | "error";
        message?: string;
        isMuted?: boolean;
      }>("moderation:dropFromMic", {
        room: currentRoomId,
        targetUsername: user.username,
      });

      if (!response || response.status !== "ok") {
        const code = response?.message || "unknown_error";
        const messageByCode: Record<string, string> = {
          invalid_payload: "Mikrofondan indirme işlemi başarısız oldu.",
          not_in_room: "Bu işlem için odada olmanız gerekiyor.",
          target_not_found_in_room: "Kullanıcı odada bulunamadı.",
          cannot_mute_self: "Kendinizi mikrofondan indiremezsiniz.",
          insufficient_star_for_force_mic_drop: ACTION_NOT_ALLOWED_MESSAGE,
          target_is_protected:
            "Bu kullanıcı korunuyor. Yalnızca korumayı açan yetkiliyle aynı yıldız veya daha üst yetkililer işlem yapabilir.",
          target_not_in_voice: "Kullanıcı sesli sohbette değil.",
        };
        throw new Error(
          messageByCode[code] || "Mikrofondan indirme işlemi başarısız oldu.",
        );
      }

      if (selectedUser?.username === user.username) {
        setSelectedUser((prev) => (prev ? { ...prev, isMuted: true } : prev));
      }

      setActiveTenantUsers((prev) =>
        prev.map((u) => (u.username === user.username ? { ...u, isMuted: true } : u)),
      );

      toast.success(`${user.username} mikrofondan indirildi.`);
      setShowAdminMenu(false);
    } catch (error) {
      const apiError = toApiError(error);
      const message =
        apiError.message || "Mikrofondan indirme işlemi başarısız oldu.";
      toast.error(message);
    } finally {
      setAdminActionLoading(false);
    }
  };

  const handleToggleMicBan = async (user: RoomUser) => {
    if (!ensureMicrophoneModerationPermission()) return;
    if (!user?.username) {
      toast.error("Kullanıcı adı bulunamadı.");
      return;
    }

    const adminStar = currentUserStarCount;
    const targetStar = user.roleStarCount || 0;

    if (adminStar <= targetStar && currentUsername?.toLowerCase() !== "root") {
      toast.error(ACTION_NOT_ALLOWED_MESSAGE);
      return;
    }

    try {
      setAdminActionLoading(true);
      const response = await apiClientRef.current.post(
        "/moderation/toggle-mic-ban",
        {
          username: user.username,
        },
      );

      const newStatus = response.data.micBanned;
      updateModerationOverride(user.username, { micBanned: newStatus });
      toast.success(
        `${user.username} kullanıcısının mikrofon yasak durumu: ${
          newStatus ? "Yasaklandı" : "Yasak Kaldırıldı"
        }`,
      );

      // Local state güncelleme (opsiyonel, socket zaten güncelleyecektir)
      if (selectedUser && selectedUser.username === user.username) {
        setSelectedUser({ ...selectedUser, micBanned: newStatus });
      }

      setShowAdminMenu(false);
    } catch (error) {
      console.error("Mic ban toggle failed:", error);
      const apiError = error as ApiErrorLike;
      const errorMessage =
        apiError.response?.data?.message || "İşlem başarısız oldu.";
      toast.error(errorMessage);
    } finally {
      setAdminActionLoading(false);
    }
  };

  const handleToggleCameraBan = async (user: RoomUser) => {
    if (!user?.username) {
      toast.error("Kullanıcı adı bulunamadı.");
      return;
    }

    const adminStar = currentUserStarCount;
    const targetStar = user.roleStarCount || 0;

    if (adminStar <= targetStar && currentUsername?.toLowerCase() !== "root") {
      toast.error(ACTION_NOT_ALLOWED_MESSAGE);
      return;
    }

    try {
      setAdminActionLoading(true);
      const response = await apiClientRef.current.post(
        "/moderation/toggle-camera-ban",
        {
          username: user.username,
        },
      );

      const newStatus = response.data.cameraBanned === true;
      updateModerationOverride(user.username, { cameraBanned: newStatus });
      toast.success(
        `${user.username} kullanıcısının kamera yasak durumu: ${
          newStatus ? "Yasaklandı" : "Yasak Kaldırıldı"
        }`,
      );

      if (selectedUser && selectedUser.username === user.username) {
        setSelectedUser({ ...selectedUser, cameraBanned: newStatus });
      }

      setShowAdminMenu(false);
    } catch (error) {
      console.error("Camera ban toggle failed:", error);
      const apiError = error as ApiErrorLike;
      const errorMessage =
        apiError.response?.data?.message || "İşlem başarısız oldu.";
      toast.error(errorMessage);
    } finally {
      setAdminActionLoading(false);
    }
  };

  const handleToggleRoomMute = async (user: RoomUser) => {
    if (!ensureMicrophoneModerationPermission()) return;
    if (!user?.username) {
      toast.error("Kullanıcı adı bulunamadı.");
      return;
    }
    const targetRoomKey = resolveTargetRoomKey(user);
    if (!targetRoomKey) {
      toast.error("Aktif oda bilgisi bulunamadı.");
      return;
    }

    try {
      setAdminActionLoading(true);
      const response = await emitWithAckTimeout<{
        status: "ok" | "error";
        roomMuted?: boolean;
        message?: string;
      }>(
        "moderation:toggleRoomMute",
        {
          room: targetRoomKey,
          targetUsername: user.username,
        },
      );

      if (!response || response.status !== "ok") {
        const messageByCode: Record<string, string> = {
          invalid_payload: "Odadaki susturma işlemi başarısız oldu.",
          not_in_room: "Bu işlem için odada olmanız gerekiyor.",
          target_not_found_in_room: "Kullanıcı odada bulunamadı.",
          cannot_mute_self: "Kendinizi odada susturamazsınız.",
          insufficient_star_for_room_mute: ACTION_NOT_ALLOWED_MESSAGE,
          insufficient_star_to_lift_room_mute: ACTION_NOT_ALLOWED_MESSAGE,
          target_is_protected:
            "Bu kullanıcı korunuyor. Yalnızca korumayı açan yetkiliyle aynı yıldız veya daha üst yetkililer işlem yapabilir.",
          unknown_error:
            "Sunucu tarafında bir hata oluştu. Lütfen tekrar deneyin.",
        };
        throw new Error(
          messageByCode[response?.message || ""] ||
            "Odadaki susturma işlemi başarısız oldu.",
        );
      }

      const roomMuted = response.roomMuted === true;
      updateModerationOverride(user.username, { roomMuted });
      if (selectedUser?.username === user.username) {
        setSelectedUser((prev) => (prev ? { ...prev, roomMuted } : prev));
      }
      setActiveTenantUsers((prev) =>
        prev.map((u) => (u.username === user.username ? { ...u, roomMuted } : u)),
      );
      toast.success(
        `${user.username} için odadaki susturma durumu: ${
          roomMuted ? "Aktif" : "Kaldırıldı"
        }`,
      );
      setShowAdminMenu(false);
    } catch (error) {
      const apiError = toApiError(error);
      const errorMessage =
        apiError.message || "Odadaki susturma işlemi başarısız oldu.";
      toast.error(errorMessage);
    } finally {
      setAdminActionLoading(false);
    }
  };

  const handleToggleGlobalMute = async (user: RoomUser) => {
    if (!ensureMicrophoneModerationPermission()) return;
    if (!user?.username) {
      toast.error("Kullanıcı adı bulunamadı.");
      return;
    }
    try {
      setAdminActionLoading(true);
      const response = await apiClientRef.current.post(
        "/moderation/toggle-global-mute",
        {
          username: user.username,
        },
      );
      const globalMuted = response?.data?.globalMuted === true;
      updateModerationOverride(user.username, { globalMuted });
      if (selectedUser?.username === user.username) {
        setSelectedUser((prev) => (prev ? { ...prev, globalMuted } : prev));
      }
      setActiveTenantUsers((prev) =>
        prev.map((u) =>
          u.username === user.username ? { ...u, globalMuted } : u,
        ),
      );
      toast.success(
        `${user.username} için tüm odalarda susturma durumu: ${
          globalMuted ? "Aktif" : "Kaldırıldı"
        }`,
      );
      setShowAdminMenu(false);
    } catch (error) {
      const apiError = error as ApiErrorLike;
      const errorMessage =
        apiError.response?.data?.message ===
        "Bu kullanıcı korunuyor. Yalnızca koruyan yetkiliden daha üstün veya eş değer bir yetkili tüm odalarda susturabilir."
          ? "Bu kullanıcı korunuyor. Yalnızca korumayı açan yetkiliyle aynı yıldız veya daha üst yetkililer işlem yapabilir."
          : apiError.response?.data?.message ||
            apiError.message ||
            "İşlem başarısız oldu.";
      toast.error(errorMessage);
    } finally {
      setAdminActionLoading(false);
    }
  };

  const handleRoomInviteResponse = (accepted: boolean) => {
    if (!pendingRoomInvite) return;
    if (socket && socket.connected) {
      socket.emit("room:invite:respond", {
        inviteId: pendingRoomInvite.inviteId,
        accepted,
      });
    }

    const roomName = pendingRoomInvite.roomName;
    setPendingRoomInvite(null);

    if (accepted) {
      const slug = roomName.trim().replace(/\s+/g, "-");
      setRoomNavigationIntent("invite");
      router.push(`/chat/${slug}`);
    }
  };

  const handleTeleportUser = async (roomOrName: Room | string) => {
    if (!teleportTargetUser || !socket) return;
    if (teleportTargetUser.isAI) {
      toast.error("Yapay zeka botu sadece Lobi odasında kalır.", botErrorToastOptions);
      setShowTeleportModal(false);
      setTeleportTargetUser(null);
      return;
    }

    const roomName =
      typeof roomOrName === "string" ? roomOrName : roomOrName.name;
    const botRoomKey =
      typeof roomOrName === "string"
        ? roomOrName
        : String(roomOrName.voiceId || roomOrName.name);
    const targetUsername = teleportTargetUser.username;

    if (teleportTargetUser.isBot) {
      const botId = await resolveBotNumericId(teleportTargetUser);
      if (botId === null) {
        toast.error("Bot bulunamadı", botErrorToastOptions);
        return;
      }

      try {
        setAdminActionLoading(true);
        await apiClientRef.current.patch(`/bot/${botId}`, {
          room: botRoomKey,
        });

        const nextRooms = [{ roomKey: botRoomKey, roomName }];
        const nextBotPatch: Partial<RoomUser> = {
          ...teleportTargetUser,
          rooms: nextRooms,
          isBot: true,
          isGuest: false,
        };
        patchBotUserState(targetUsername, nextBotPatch);
        setShowTeleportModal(false);
        setTeleportTargetUser(null);
        setShowAdminMenu(false);
        setSelectedUser(null);
        toast.success("Işınlandı", botToastOptions);
      } catch (error) {
        console.error("Bot ışınlama isteği başarısız:", error);
        toast.error("Işınlanamadı", botErrorToastOptions);
      } finally {
        setAdminActionLoading(false);
      }
      return;
    }

    const response = await new Promise<{
      status?: "ok" | "error";
      message?: string;
    }>((resolve) => {
      socket.emit(
        "room:teleport",
        {
          targetUsername,
          roomName: roomName,
        },
        (ack: SocketAck) => resolve(ack || {}),
      );
    });

    if (!response || response.status !== "ok") {
      const messageByCode: Record<string, string> = {
        target_is_protected:
          "Bu kullanıcı korunuyor. Yalnızca korumayı açan yetkiliyle aynı yıldız veya daha üst yetkililer işlem yapabilir.",
        target_not_found: "Kullanıcı bulunamadı.",
        sender_not_found: "Kendi oturum bilgileriniz bulunamadı.",
        insufficient_privileges: ACTION_NOT_ALLOWED_MESSAGE,
      };
      alert(
        messageByCode[response?.message || ""] ||
          "Işınlama işlemi başarısız oldu.",
      );
      return;
    }

    setShowTeleportModal(false);
    setTeleportTargetUser(null);
    setShowAdminMenu(false);
    setSelectedUser(null);
    alert(`${targetUsername} ${roomName} odasına ışınlandı.`);
  };

  const handleKickUser = async (user: RoomUser) => {
    if (!ensureKickPermission()) return;
    if (!user?.username) {
      toast.error("Kullanıcı adı bulunamadı.");
      return;
    }

    const payload = {
      username: user.username,
      reason: "Yönetici tarafından atıldı",
    };

    try {
      setAdminActionLoading(true);
      await apiClientRef.current.post("/moderation/kick", payload);
      toast.success(`${user.username} sistemden atıldı.`);
      setShowAdminMenu(false);
    } catch (error) {
      console.error("Sistemden atma isteği başarısız:", error);
      const apiError = error as ApiErrorLike;
      const errorMessage =
        apiError.response?.data?.message || "İşlem başarısız oldu.";
      toast.error(errorMessage);
    } finally {
      setAdminActionLoading(false);
    }
  };

  const handleSendFriendRequest = async (username: string) => {
    if (isGuestUser) {
      toast.error("Misafir kullanıcılar arkadaşlık isteği gönderemez.");
      return;
    }
    const normalizedUsername = normalizeUsername(username);
    const targetUser = users.find((u) => u.username === username);
    if (targetUser?.isBot || (selectedUserIsBot && selectedUser?.username === username)) {
      setFakeBotOutgoingFriendRequests((prev) => {
        const next = new Set(prev);
        next.add(normalizedUsername);
        return next;
      });
      setSelectedUserRelation({
        targetUsername: username,
        isFriend: false,
        hasIncomingRequest: false,
        hasOutgoingRequest: true,
        isBlockedByMe: false,
        isBlockedByOther: false,
        isBlockedEitherWay: false,
      });
      toast.success("Arkadaşlık isteği gönderildi.");
      return;
    }
    if (targetUser?.isGuest) {
      toast.error("Misafir kullanıcılara arkadaşlık isteği gönderilemez.");
      return;
    }
    try {
      const targetAgentNickname =
        selectedUser?.username === username
          ? selectedProfileAgentNickname
          : targetUser?.agentNickname || null;
      await apiClient.friends.sendRequest(username, targetAgentNickname);
      await fetchFriendsData();
    } catch (error) {
      console.error("Friend request failed:", error);
      const apiError = error as ApiErrorLike;
      const message =
        apiError.message || "Arkadaşlık isteği gönderilemedi. Tekrar deneyin.";
      toast.error(message);
    }
  };

  const handleAcceptFriendRequest = async (id: number) => {
    try {
      await apiClient.friends.acceptRequest(id);
      await fetchFriendsData();
    } catch (error) {
      console.error("Accept request failed:", error);
      alert("İstek kabul edilemedi.");
    }
  };

  const handleRejectFriendRequest = async (id: number) => {
    try {
      await apiClient.friends.rejectRequest(id);
      await fetchFriendsData();
    } catch (error) {
      console.error("Reject request failed:", error);
      alert("İstek reddedilemedi.");
    }
  };

  const handleCancelFriendRequest = async (id: number) => {
    if (id < 0 && selectedUserIsBot && selectedUser?.username) {
      const normalizedUsername = normalizeUsername(selectedUser.username);
      setFakeBotOutgoingFriendRequests((prev) => {
        const next = new Set(prev);
        next.delete(normalizedUsername);
        return next;
      });
      setSelectedUserRelation((prev) =>
        prev
          ? {
              ...prev,
              hasOutgoingRequest: false,
            }
          : prev,
      );
      toast.success("İstek iptal edildi.");
      return;
    }

    try {
      await apiClient.friends.cancelRequest(id);
      await fetchFriendsData();
    } catch (error) {
      console.error("Cancel request failed:", error);
      alert("İstek iptal edilemedi.");
    }
  };

  const openRemoveFriendConfirm = (
    id: number,
    username: string,
    agentNickname?: string | null,
    displayName?: string | null,
  ) => {
    setFriendToRemove({
      id,
      username,
      agentNickname: agentNickname?.trim() || null,
      displayName: displayName || username,
    });
  };

  const closeRemoveFriendConfirm = () => {
    setFriendToRemove(null);
  };

  const handleRemoveFriend = async () => {
    if (!friendToRemove) return;
    try {
      await apiClient.friends.removeFriend(friendToRemove.id);
      await fetchFriendsData();
      if (
        selectedUser?.username === friendToRemove.username &&
        ((selectedProfileAgentNickname || "").trim() || null) ===
          ((friendToRemove.agentNickname || "").trim() || null)
      ) {
        setSelectedUserRelation((prev) =>
          prev
            ? {
                ...prev,
                isFriend: false,
                hasIncomingRequest: false,
                hasOutgoingRequest: false,
              }
            : prev,
        );
      }
      closeRemoveFriendConfirm();
    } catch (error) {
      console.error("Remove friend failed:", error);
      alert("Arkadaşlıktan çıkarma başarısız.");
    }
  };

  const isBlockedByMe = selectedUserRelation?.isBlockedByMe === true;
  const isBlockedByOther = selectedUserRelation?.isBlockedByOther === true;
  const isBlockedEitherWay = selectedUserRelation?.isBlockedEitherWay === true;
  const isIgnoredUser = (username?: string | null) => {
    const normalizedUsername = normalizeUsername(username);
    return (
      ignoredUsernames.has(normalizedUsername) ||
      fakeBotIgnoredUsernames.has(normalizedUsername)
    );
  };

  const handleToggleBlockUser = async (username?: string | null) => {
    if (!ensureBlockPermission()) return;
    const trimmedUsername = username?.trim();
    if (!trimmedUsername) return;

    if (trimmedUsername === currentUsername) {
      toast.error("Kendinizi engelleyemezsiniz.");
      return;
    }

    const targetUser = users.find(
      (user) => normalizeUsername(user.username) === normalizeUsername(trimmedUsername),
    );
    if (targetUser?.isBot || (selectedUserIsBot && selectedUser?.username === trimmedUsername)) {
      const normalizedUsername = normalizeUsername(trimmedUsername);
      const currentlyBlocked = fakeBotBlockedUsernames.has(normalizedUsername);
      setFakeBotBlockedUsernames((prev) => {
        const next = new Set(prev);
        if (currentlyBlocked) {
          next.delete(normalizedUsername);
        } else {
          next.add(normalizedUsername);
        }
        return next;
      });
      setSelectedUserRelation((prev) => ({
        targetUsername: trimmedUsername,
        isFriend: false,
        hasIncomingRequest: false,
        hasOutgoingRequest: prev?.hasOutgoingRequest === true,
        isBlockedByMe: !currentlyBlocked,
        isBlockedByOther: false,
        isBlockedEitherWay: !currentlyBlocked,
      }));
      toast.success(currentlyBlocked ? "Engel kaldırıldı." : "Engellendi.");
      return;
    }

    const currentlyBlocked = selectedUserRelation?.isBlockedByMe === true;
    try {
      if (currentlyBlocked) {
        await apiClient.friends.unblockUser(trimmedUsername);
        toast.success("Kullanıcının engeli kaldırıldı.");
      } else {
        await apiClient.friends.blockUser(
          trimmedUsername,
          targetUser?.agentNickname ||
            (selectedUser?.username === trimmedUsername
              ? selectedProfileAgentNickname
              : null),
        );
        toast.success("Kullanıcı engellendi.");
      }
      await Promise.all([
        fetchFriendsData(),
        apiClient.friends.getRelation(
          trimmedUsername,
          targetUser?.agentNickname ||
            (selectedUser?.username === trimmedUsername
              ? selectedProfileAgentNickname
              : null),
        ),
      ])
        .then(([, relation]) => {
          setSelectedUserRelation(relation);
        });
    } catch (error) {
      const message =
        error instanceof ApiError && error.message?.trim()
          ? error.message
          : "İşlem başarısız oldu.";
      toast.error(message);
    }
  };

  const handleToggleIgnoreUser = async (username?: string | null) => {
    const trimmedUsername = username?.trim();
    if (!trimmedUsername) return;
    if (trimmedUsername === currentUsername) {
      toast.error("Kendinizi görmezden gelemezsiniz.");
      return;
    }

    const targetUser = users.find(
      (user) => normalizeUsername(user.username) === normalizeUsername(trimmedUsername),
    );
    if (targetUser?.isBot || (selectedUserIsBot && selectedUser?.username === trimmedUsername)) {
      const normalizedUsername = normalizeUsername(trimmedUsername);
      const currentlyIgnored = fakeBotIgnoredUsernames.has(normalizedUsername);
      setFakeBotIgnoredUsernames((prev) => {
        const next = new Set(prev);
        if (currentlyIgnored) {
          next.delete(normalizedUsername);
        } else {
          next.add(normalizedUsername);
        }
        return next;
      });
      toast.success(currentlyIgnored ? "Görünür." : "Görmezden gelindi.");
      return;
    }

    const currentlyIgnored = isIgnoredUser(trimmedUsername);
    try {
      if (currentlyIgnored) {
        await apiClient.friends.unignoreUser(trimmedUsername);
        toast.success("Kullanıcı artık görünür.");
      } else {
        await apiClient.friends.ignoreUser(trimmedUsername);
        toast.success("Kullanıcı görmezden gelindi.");
      }
      await fetchFriendsData();
    } catch (error) {
      const message =
        error instanceof ApiError && error.message?.trim()
          ? error.message
          : "İşlem başarısız oldu.";
      toast.error(message);
    }
  };

  const getFriendRelation = (
    username?: string | null,
    agentNickname?: string | null,
  ) => {
    if (!username) return { type: "none" as const };
    const normalizedAgent = (agentNickname || "").trim();
    const matchesIdentity = (request: FriendRequest) =>
      request.user.username === username &&
      ((request.user.agentNickname || "").trim() || null) ===
        (normalizedAgent || null);
    if (fakeBotOutgoingFriendRequests.has(normalizeUsername(username))) {
      return { type: "outgoing" as const, requestId: -1 };
    }
    const friend = friends.find(matchesIdentity);
    if (friend) return { type: "friends" as const, requestId: friend.id };
    const incoming = incomingRequests.find(matchesIdentity);
    if (incoming)
      return { type: "incoming" as const, requestId: incoming.id };
    const outgoing = outgoingRequests.find(matchesIdentity);
    if (outgoing)
      return { type: "outgoing" as const, requestId: outgoing.id };
    return { type: "none" as const };
  };

  const resolveFriendIcon = (icon?: string | null) => {
    return resolveAvatarUrl(icon);
  };

  const resolveFriendFrame = (frame?: string | null) => {
    if (!frame) return null;
    if (frame.startsWith("/")) return frame;
    return `/cerceveler/${frame}.png`;
  };

const legacyUserGifAliases: Record<string, string> = {
  "baris_guvercini.gif.gif": "kelebek.gif",
  "baris_guvercini_2.gif.gif": "kelebek.gif",
  "kalpler.gif.gif": "kalpler.gif",
  "sinek.gif.gif": "yılbasi.gif",
  "yaprak.gif": "yılbasi.gif",
  "yagin.gif.gif": "yangın.gif",
  "yangin.gif.gif": "yangın.gif",
};

  const resolveUserGifPath = (gif?: string | null) => {
    if (!gif) return null;
    const trimmed = gif.trim();
    if (!trimmed) return null;
    const fileName = trimmed.startsWith("/usergifler/")
      ? trimmed.replace("/usergifler/", "")
      : trimmed.replace(/^\/+/, "");
    const normalizedFileName = legacyUserGifAliases[fileName] ?? fileName;
    return `/usergifler/${normalizedFileName}`;
  };

  const isFlameUserGif = (gifPath?: string | null) => {
    const normalized = gifPath?.toLowerCase() ?? "";
    return (
      normalized.includes("/yagin.gif.gif") ||
      normalized.includes("/yangin.gif.gif") ||
      normalized.includes("/yangın.gif")
    );
  };
  const isFlagUserGif = (gifPath?: string | null) =>
    Boolean(gifPath?.toLowerCase().includes("/bayrak.gif.gif"));
  const isDoveUserGif = (gifPath?: string | null) => {
    const normalized = gifPath?.toLowerCase() ?? "";
    return (
      normalized.includes("/baris_guvercini.gif.gif") ||
      normalized.includes("/baris_guvercini_2.gif.gif") ||
      normalized.includes("/kelebek.gif")
    );
  };
  const isFlyUserGif = (gifPath?: string | null) =>
    Boolean(gifPath?.toLowerCase().includes("/sinek.gif.gif"));
  const isRoseUserGif = (gifPath?: string | null) =>
    Boolean(gifPath?.toLowerCase().includes("/gul.gif"));
  const isYearbasiUserGif = (gifPath?: string | null) =>
    Boolean(gifPath?.toLowerCase().includes("/yılbasi.gif"));
  const isHeartUserGif = (gifPath?: string | null) =>
    Boolean(gifPath?.toLowerCase().includes("/kalpler.gif"));
  const isBalloonUserGif = (gifPath?: string | null) =>
    Boolean(gifPath?.toLowerCase().includes("/balon.gif"));
  const flameRevealStyle = {
    WebkitMaskImage:
      "linear-gradient(to top, transparent 0%, transparent 18%, rgba(0,0,0,0.35) 36%, rgba(0,0,0,0.95) 58%, black 72%)",
    maskImage:
      "linear-gradient(to top, transparent 0%, transparent 18%, rgba(0,0,0,0.35) 36%, rgba(0,0,0,0.95) 58%, black 72%)",
  } as const;
  const renderWanderingButterflies = (
    gifPath?: string | null,
    size: "sm" | "md" = "sm",
  ) => {
    if (!gifPath) return null;
    const config =
      size === "md"
        ? {
            left: "8%",
            top: "-2%",
            width: 68,
            animationDuration: "7.2s",
          }
        : {
            left: "10%",
            top: "0%",
            width: 42,
            animationDuration: "6.4s",
          };

    return (
      <img
        key={`${gifPath}-${size}`}
        src={gifPath}
        alt="user gif"
        className="pointer-events-none absolute z-10 object-contain"
        style={{
          left: config.left,
          top: config.top,
          width: config.width,
          height: config.width,
          opacity: 0.98,
          filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.2))",
          animation: `butterfly-glide ${config.animationDuration} ease-in-out infinite`,
        }}
      />
    );
  };
  const renderFloatingBalloon = (
    gifPath?: string | null,
    size: "sm" | "md" = "sm",
  ) => {
    if (!gifPath) return null;

    const bouquets =
      size === "md"
        ? [
            {
              left: "14%",
              bottom: "8%",
              width: 56,
              duration: "17.2s",
              drift: -12,
              tilt: "-4deg",
              opacity: 0.58,
              delay: "0s",
              lift: "112px",
            },
            {
              left: "48%",
              bottom: "11%",
              width: 70,
              duration: "16.4s",
              drift: -14,
              tilt: "2deg",
              opacity: 0.84,
              delay: "-5.4s",
              lift: "124px",
            },
            {
              left: "82%",
              bottom: "9%",
              width: 58,
              duration: "17.8s",
              drift: -11,
              tilt: "4deg",
              opacity: 0.64,
              delay: "-11.1s",
              lift: "116px",
            },
          ]
        : [
            {
              left: "14%",
              bottom: "9%",
              width: 26,
              duration: "15.4s",
              drift: -8,
              tilt: "-4deg",
              opacity: 0.56,
              delay: "0s",
              lift: "68px",
            },
            {
              left: "48%",
              bottom: "11%",
              width: 34,
              duration: "14.6s",
              drift: -9,
              tilt: "2deg",
              opacity: 0.82,
              delay: "-4.8s",
              lift: "76px",
            },
            {
              left: "82%",
              bottom: "10%",
              width: 28,
              duration: "15.8s",
              drift: -8,
              tilt: "4deg",
              opacity: 0.62,
              delay: "-9.8s",
              lift: "70px",
            },
          ];

    const balloonInstances = bouquets.flatMap((bouquet, index) => {
      const durationValue = Number.parseFloat(bouquet.duration);
      const delayValue = Number.parseFloat(bouquet.delay);
      const leftValue = Number.parseFloat(bouquet.left);

      return [
        {
          ...bouquet,
          key: `${gifPath}-${size}-balloon-${index}-main`,
          left: `${leftValue}%`,
          delay: bouquet.delay,
          opacity: bouquet.opacity,
        },
        {
          ...bouquet,
          key: `${gifPath}-${size}-balloon-${index}-echo`,
          left: `${leftValue + (index === 1 ? -3 : 3)}%`,
          bottom: `${Number.parseFloat(bouquet.bottom) + (size === "md" ? 4 : 3)}%`,
          delay: `${delayValue - durationValue / 2}s`,
          opacity: Math.max(bouquet.opacity * 0.68, 0.24),
          width: Math.max(bouquet.width - (size === "md" ? 12 : 6), 18),
          lift: `${Math.max(Number.parseFloat(bouquet.lift) - (size === "md" ? 18 : 12), 36)}px`,
          drift: bouquet.drift * 0.8,
        },
      ];
    });

    return (
      <>
        {balloonInstances.map((balloon) => (
          <img
            key={balloon.key}
            src={gifPath}
            alt="user gif"
            className="pointer-events-none absolute z-10 object-contain"
            style={{
              left: balloon.left,
              bottom: balloon.bottom,
              width: balloon.width,
              height: balloon.width,
              opacity: balloon.opacity,
              filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.14))",
              transform: `rotate(${balloon.tilt})`,
              transformOrigin: "center bottom",
              animation: `balloon-rise ${balloon.duration} cubic-bezier(0.32, 0.02, 0.2, 1) infinite`,
              animationDelay: balloon.delay,
              ["--balloon-opacity" as string]: String(balloon.opacity),
              ["--balloon-drift" as string]: `${balloon.drift}px`,
              ["--balloon-tilt" as string]: balloon.tilt,
              ["--balloon-lift" as string]: balloon.lift,
            }}
          />
        ))}
      </>
    );
  };
  const renderYearbasiFrame = (
    gifPath?: string | null,
    variant: "card" | "avatar" = "card",
  ) => {
    if (!gifPath) return null;

    if (variant === "avatar") {
      return (
        <img
          key={`${gifPath}-${variant}-yearbasi`}
          src={gifPath}
          alt="user gif"
          className="pointer-events-none absolute inset-[-10%] z-30 h-[120%] w-[120%] max-w-none object-contain opacity-82"
        />
      );
    }

    return (
      <>
        <img
          key={`${gifPath}-${variant}-yearbasi-top`}
          src={gifPath}
          alt="user gif"
          className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[14%] w-full object-cover object-top opacity-82 mix-blend-multiply"
          style={{
            WebkitMaskImage:
              "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.96) 52%, transparent 100%)",
            maskImage:
              "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.96) 52%, transparent 100%)",
          }}
        />
        <img
          key={`${gifPath}-${variant}-yearbasi-bottom`}
          src={gifPath}
          alt="user gif"
          className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[14%] w-full object-cover object-bottom opacity-78 mix-blend-multiply"
          style={{
            WebkitMaskImage:
              "linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.94) 52%, transparent 100%)",
            maskImage:
              "linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.94) 52%, transparent 100%)",
          }}
        />
        <img
          key={`${gifPath}-${variant}-yearbasi-left`}
          src={gifPath}
          alt="user gif"
          className="pointer-events-none absolute inset-y-0 left-0 z-0 h-full w-[11%] object-cover object-left opacity-84 mix-blend-multiply"
          style={{
            WebkitMaskImage:
              "linear-gradient(to right, rgba(0,0,0,1) 0%, rgba(0,0,0,0.96) 52%, transparent 100%)",
            maskImage:
              "linear-gradient(to right, rgba(0,0,0,1) 0%, rgba(0,0,0,0.96) 52%, transparent 100%)",
          }}
        />
        <img
          key={`${gifPath}-${variant}-yearbasi-right`}
          src={gifPath}
          alt="user gif"
          className="pointer-events-none absolute inset-y-0 right-0 z-0 h-full w-[11%] object-cover object-right opacity-84 mix-blend-multiply"
          style={{
            WebkitMaskImage:
              "linear-gradient(to left, rgba(0,0,0,1) 0%, rgba(0,0,0,0.96) 52%, transparent 100%)",
            maskImage:
              "linear-gradient(to left, rgba(0,0,0,1) 0%, rgba(0,0,0,0.96) 52%, transparent 100%)",
          }}
        />
      </>
    );
  };
  const renderRoseShower = (
    gifPath?: string | null,
    size: "sm" | "md" = "sm",
  ) => {
    if (!gifPath) return null;

    const streams =
      size === "md"
        ? [
            {
              left: "10%",
              width: "22%",
              height: "194%",
              top: "-124%",
              duration: "22.4s",
              delay: "0s",
              drop: "280px",
              opacity: 0.13,
              blur: "0.4px",
            },
            {
              left: "28%",
              width: "22%",
              height: "194%",
              top: "-126%",
              duration: "22.4s",
              delay: "-7.4s",
              drop: "280px",
              opacity: 0.16,
              blur: "0px",
            },
            {
              left: "52%",
              width: "24%",
              height: "202%",
              top: "-130%",
              duration: "22.4s",
              delay: "-14.8s",
              drop: "286px",
              opacity: 0.18,
              blur: "0px",
            },
            {
              left: "76%",
              width: "24%",
              height: "202%",
              top: "-130%",
              duration: "22.4s",
              delay: "-11.2s",
              drop: "286px",
              opacity: 0.18,
              blur: "0px",
            },
            {
              left: "92%",
              width: "22%",
              height: "194%",
              top: "-126%",
              duration: "22.4s",
              delay: "-18.6s",
              drop: "280px",
              opacity: 0.16,
              blur: "0px",
            },
            {
              left: "110%",
              width: "22%",
              height: "194%",
              top: "-124%",
              duration: "22.4s",
              delay: "-3.7s",
              drop: "280px",
              opacity: 0.13,
              blur: "0.4px",
            },
          ]
        : [
            {
              left: "10%",
              width: "24%",
              height: "186%",
              top: "-122%",
              duration: "18.2s",
              delay: "0s",
              drop: "172px",
              opacity: 0.11,
              blur: "0.35px",
            },
            {
              left: "30%",
              width: "26%",
              height: "188%",
              top: "-124%",
              duration: "18.2s",
              delay: "-6.1s",
              drop: "172px",
              opacity: 0.13,
              blur: "0px",
            },
            {
              left: "54%",
              width: "28%",
              height: "194%",
              top: "-128%",
              duration: "18.2s",
              delay: "-12.2s",
              drop: "176px",
              opacity: 0.15,
              blur: "0px",
            },
            {
              left: "78%",
              width: "28%",
              height: "194%",
              top: "-128%",
              duration: "18.2s",
              delay: "-9.1s",
              drop: "176px",
              opacity: 0.15,
              blur: "0px",
            },
            {
              left: "108%",
              width: "24%",
              height: "186%",
              top: "-122%",
              duration: "18.2s",
              delay: "-3.0s",
              drop: "172px",
              opacity: 0.11,
              blur: "0.35px",
            },
          ];

    return (
      <>
        {streams.map((stream, index) => (
          <img
            key={`${gifPath}-${size}-rose-stream-${index}`}
            src={gifPath}
            alt="user gif"
            className="pointer-events-none absolute z-10 max-w-none -translate-x-1/2 object-fill mix-blend-normal"
            style={{
              left: stream.left,
              top: stream.top,
              width: stream.width,
              height: stream.height,
              opacity: stream.opacity,
              animation: `rose-stream-fall ${stream.duration} linear infinite`,
              animationDelay: stream.delay,
              filter: `blur(${stream.blur}) saturate(0.92)`,
              WebkitMaskImage:
                "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.95) 16%, rgba(0,0,0,0.95) 84%, transparent 100%)",
              maskImage:
                "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.95) 16%, rgba(0,0,0,0.95) 84%, transparent 100%)",
              ["--rose-stream-drop" as string]: stream.drop,
            }}
          />
        ))}
      </>
    );
  };

  const renderProfileCommentAvatar = (commentUser: ProfileComment["user"]) => {
    const commentUserIcon = commentUser.agentNickname
      ? null
      : resolveFriendIcon(commentUser.icon || null);
    const commentDisplayName = formatAgentDisplayName(
      {
        username: commentUser.username,
        displayUsername: commentUser.displayUsername,
        agentNickname: commentUser.agentNickname,
        roleStarCount: commentUser.starCount,
      },
      currentUserStarCount,
    );

    return (
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-semibold text-white ${
          commentUserIcon?.startsWith("data:")
            ? "bg-white"
            : commentUser.gender === "male"
              ? "bg-linear-to-br from-blue-500 to-blue-600"
              : "bg-linear-to-br from-pink-500 to-pink-600"
        }`}
      >
        {commentUserIcon ? (
          <img
	            src={commentUserIcon}
	            alt={`${commentDisplayName} avatar`}
            className="h-full w-full object-cover bg-white"
          />
        ) : (
	          commentDisplayName.charAt(0).toUpperCase()
        )}
      </div>
    );
	  };

  const getProfileCommentDisplayName = (commentUser: ProfileComment["user"]) =>
    formatAgentDisplayName(
      {
        username: commentUser.username,
        displayUsername: commentUser.displayUsername,
        agentNickname: commentUser.agentNickname,
        roleStarCount: commentUser.starCount,
      },
      currentUserStarCount,
    );

  const effectiveDmUnreadCount = Math.max(
    dmUnreadCount,
    Object.values(pendingDmConversationCounts).reduce(
      (sum, count) => sum + count,
      0,
    ),
  );

  const renderMobileDirectoryCard = (
    user: RoomUser,
    options?: {
      fallbackRoom?: boolean;
      statusLabel?: string;
      statusTone?: "online" | "offline" | "neutral";
      friendRequestId?: number;
      showFriendRemove?: boolean;
    },
  ) => {
    const isMale = user.gender === "male";
    const isMaskedUser = isAgentMaskedUser(user);
    const selfIcon = user.username === currentUsername ? getImmediateSelfIcon() : null;
    const resolvedIcon = resolveFriendIcon(selfIcon || user.icon || null);
    const frameUrl = user.frame?.replace(/\.png$/i, ".gif") || user.frame;
    const userGifPath = resolveUserGifPath(user.userGif || null);
    const isFlameGif = isFlameUserGif(userGifPath);
    const isFlagGif = isFlagUserGif(userGifPath);
    const isDoveGif = isDoveUserGif(userGifPath);
    const isRoseGif = isRoseUserGif(userGifPath);
    const isYearbasiGif = isYearbasiUserGif(userGifPath);
    const isHeartGif = isHeartUserGif(userGifPath);
    const isBalloonGif = isBalloonUserGif(userGifPath);
    const { Icon: DeviceIcon, title: deviceTitle } = resolveUserDevice(user);
    const rooms = Array.isArray(user.rooms) ? user.rooms : [];
    const roleDisplayUser = getRoleDisplayUser(user);
    const hideRoleFallback = shouldHideRoleForUser(user);
    const shouldUseFallbackRoom = options?.fallbackRoom ?? true;
    const visibleRooms =
      rooms.length > 0
        ? rooms
        : shouldUseFallbackRoom
          ? [{ roomKey: currentRoomId, roomName: currentRoomName }]
          : [];
    const statusToneClass =
      options?.statusTone === "online"
        ? "bg-emerald-50 text-emerald-700"
        : options?.statusTone === "offline"
          ? "bg-zinc-100 text-zinc-500"
          : "bg-blue-50 text-blue-600";
    const statusDotClass =
      options?.statusTone === "online"
        ? "bg-emerald-500"
        : options?.statusTone === "offline"
          ? "bg-zinc-400"
          : "bg-blue-500";
    const showGlobalMutedIcon = user.globalMuted === true;

    return (
      <div
        key={getUserRenderKey(user)}
        onClick={() => handleUserClick(user)}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleUserClick(user);
          }
        }}
        className="relative w-full overflow-hidden rounded-[10px] bg-white px-2.5 py-1.5 text-left shadow-[0_1px_0_rgba(15,23,42,0.05)] transition active:scale-[0.99]"
      >
        {userGifPath && isFlameGif && !isMaskedUser && (
          <img
            src={userGifPath}
            alt="user gif"
            className="pointer-events-none absolute inset-0 z-0 h-full w-full object-fill opacity-75 mix-blend-multiply"
          />
        )}
        {userGifPath && isDoveGif && !isMaskedUser && renderWanderingButterflies(userGifPath)}
        {userGifPath && isBalloonGif && !isMaskedUser && renderFloatingBalloon(userGifPath)}
        {userGifPath && isRoseGif && !isMaskedUser && renderRoseShower(userGifPath)}
        {userGifPath && isYearbasiGif && !isMaskedUser && renderYearbasiFrame(userGifPath)}

        <div className="relative z-10 flex items-start gap-2">
          <div className="relative mt-0.5 h-[42px] w-[42px] shrink-0">
            {frameUrl && !isMaskedUser && (
              <img
                src={frameUrl}
                alt="frame"
                className="pointer-events-none absolute inset-0 z-20 h-full w-full scale-110 object-contain"
              />
            )}
            <div
              className={`absolute inset-[4px] z-0 flex items-center justify-center overflow-hidden rounded-full text-base font-bold text-white ${
                !isMaskedUser && resolvedIcon?.startsWith("data:")
                  ? "bg-white"
                  : isMale
                    ? "bg-linear-to-br from-blue-500 to-blue-600"
                    : "bg-linear-to-br from-pink-500 to-pink-600"
              }`}
            >
              {resolvedIcon && !isMaskedUser ? (
                <img
                  src={resolvedIcon}
                  alt={`${getDisplayUsername(user)} avatar`}
                  className="h-full w-full bg-white object-cover"
                />
              ) : (
                getAvatarInitial(user)
              )}
            </div>
            {userGifPath && isFlagGif && !isMaskedUser && (
              <img
                src={userGifPath}
                alt="user gif"
                className="pointer-events-none absolute -right-1 -top-2 h-3.5 w-5.5 object-contain"
              />
            )}
            {userGifPath && isHeartGif && !isMaskedUser && (
              <img
                src={userGifPath}
                alt="user gif"
                className="pointer-events-none absolute left-1/2 -top-5 h-12 w-14 -translate-x-1/2 object-contain"
              />
            )}
            {showGlobalMutedIcon && (
              <Ban
                className="absolute left-0 -bottom-2 z-30 h-3.5 w-3.5 text-red-600 drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)]"
                aria-label="Tüm odalarda susturuldu"
                role="img"
              />
            )}
          </div>

          <div className="min-w-0 flex-1 pr-7">
            <div className="flex min-w-0 items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-extrabold leading-tight text-zinc-950">
                  {renderStyledUsername(user)}
                </div>
                <div className="mt-0.5 flex min-h-[15px] max-w-full items-center gap-1 overflow-hidden text-[10.5px] font-semibold text-zinc-500">
                  {shouldShowGuestBadge(user) ? (
                    <span>Misafir</span>
                  ) : (
                    renderRoleBadge(roleDisplayUser, currentUserStarCount) ??
                    (!hideRoleFallback ? <span>Üye</span> : null)
                  )}
                </div>
                {user.statusModeName && !isHiddenRoofStatusForUser(user) && (
                  <div className="mt-0.5 truncate text-[10.5px] font-medium text-zinc-500">
                    {user.statusModeName}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="absolute right-3 top-1.5 z-20 flex flex-col items-center gap-[1px] text-zinc-300">
          {options?.showFriendRemove && options.friendRequestId ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                openRemoveFriendConfirm(
                  options.friendRequestId as number,
                  user.username,
                  user.agentNickname,
                  getDisplayUsername(user),
                );
              }}
              className="inline-flex h-[15px] w-[15px] items-center justify-center text-red-500 transition-colors active:text-red-600"
              title="Arkadaşlıktan çıkar"
              aria-label="Arkadaşlıktan çıkar"
            >
              <Heart className="h-[14px] w-[14px] fill-current" />
            </button>
          ) : null}
          {isMale ? (
            <Mars className="h-[14px] w-[14px] shrink-0 text-blue-500" />
          ) : (
            <Venus className="h-[14px] w-[14px] shrink-0 text-pink-500" />
          )}
          <DeviceIcon
            className="h-[14px] w-[14px]"
            aria-label={deviceTitle}
            role="img"
          />
          {user.isCameraOn && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                void openCameraViewer(user);
              }}
              className="inline-flex h-[15px] w-[15px] items-center justify-center rounded-full bg-blue-50 text-blue-600 active:bg-blue-100"
              title={`${user.username} kamerasını izle`}
            >
              <Video className="h-[13px] w-[13px]" />
            </button>
          )}
          {user.isInVoiceChat && (
            <Wifi className="h-[14px] w-[14px] text-green-500" />
          )}
          {user.isInVoiceChat && !user.isMuted && (
            <Mic className={`h-[14px] w-[14px] ${isMale ? "text-blue-500" : "text-pink-500"}`} />
          )}
          {user.isInVoiceChat && user.isMuted && (
            <MicOff className={`h-[14px] w-[14px] ${isMale ? "text-blue-500" : "text-pink-500"}`} />
          )}
          {user.cameraBanned && (
            <VideoOff className="h-[14px] w-[14px] text-red-500" />
          )}
          {user.isHandRaised && (
            <Hand className="h-[14px] w-[14px] text-amber-700" />
          )}
        </div>

        {(visibleRooms.some((room) => room.roomKey || room.roomName) ||
          options?.statusLabel) && (
        <div className="relative z-10 mt-0.5 flex min-w-0 flex-wrap items-center gap-1 pl-[50px] pr-7">
          {visibleRooms
            .filter((room) => room.roomKey || room.roomName)
            .slice(0, 1)
            .map((room, index) => (
              <div
                key={`${getUserRenderKey(user)}-mobile-room-${index}`}
                className="flex h-4.5 max-w-full items-center rounded-md bg-blue-50 px-1.5 text-[9.5px] font-bold text-blue-600"
              >
                <span className="truncate">
                  {resolveRoomDisplayName(room.roomKey, room.roomName)}
                </span>
              </div>
            ))}
          {options?.statusLabel ? (
            <div
                className={`flex h-4.5 max-w-full items-center gap-1 rounded-md px-1.5 text-[9.5px] font-bold ${statusToneClass}`}
            >
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusDotClass}`} />
              <span className="truncate">{options.statusLabel}</span>
            </div>
          ) : null}
        </div>
        )}
      </div>
    );
  };

  const renderMobileRoomsDirectory = () => {
    const normalizeRoomName = (name: string | undefined | null) =>
      (name || "")
        .toLocaleLowerCase("tr-TR")
        .replace(/\s+/g, " ")
        .trim();
    const specialNames = new Set([
      "sorunlar",
      "sorunlar odası",
      "başvuru odası",
      "toplantı odası",
    ]);
    const specialRooms = filteredRooms.filter((room) =>
      specialNames.has(normalizeRoomName(room.name)),
    );
    const regularRooms = filteredRooms.filter(
      (room) => !specialNames.has(normalizeRoomName(room.name)),
    );

    const renderRoomImage = (_room: Room, className: string) => (
      <div className={`${className} flex items-center justify-center bg-zinc-100 text-zinc-500`}>
        <MessageSquare className="h-4 w-4" />
      </div>
    );
    const getMobileFriendPresence = (item: FriendRequest) => {
      const liveUser = activeTenantUsers.find(
        (user) =>
          user.username.toLocaleLowerCase("tr-TR") ===
          item.user.username.toLocaleLowerCase("tr-TR"),
      );
      if (!liveUser) {
        return { isVisibleOnline: false };
      }

      const friendStarCount = Number(
        liveUser.roleStarCount ?? item.user.roleStarCount ?? 0,
      );
      const viewerStarCount = Number(currentUserStarCount || 0);
      const isSelf =
        currentUsername?.toLocaleLowerCase("tr-TR") ===
        liveUser.username.toLocaleLowerCase("tr-TR");
      const isHiddenRoof =
        liveUser.statusModeName === "Çatıda" &&
        !liveUser.isBot &&
        !isSelf &&
        viewerStarCount < friendStarCount;
      const isHiddenAgent =
        Boolean((liveUser.agentNickname || "").trim()) &&
        !isSelf &&
        viewerStarCount < friendStarCount;

      return {
        isVisibleOnline: !isHiddenRoof && !isHiddenAgent,
      };
    };
    const mobileFriendPresence = new Map(
      filteredFriends.map((item) => [item.id, getMobileFriendPresence(item)]),
    );
    const onlineFriends = filteredFriends.filter(
      (item) => mobileFriendPresence.get(item.id)?.isVisibleOnline === true,
    );
    const offlineFriends = filteredFriends.filter(
      (item) => mobileFriendPresence.get(item.id)?.isVisibleOnline !== true,
    );
    const titleByTab: Record<typeof mobileRoomsDirectoryTab, string> = {
      rooms: "TUM ODALAR",
      wall: "Story",
      friends: "ARKADAŞLAR",
      calls: "ARAMALAR",
    };
    const currentStoryUser = users.find(
      (user) =>
        user.username.toLocaleLowerCase("tr-TR") ===
        (currentUsername || "").toLocaleLowerCase("tr-TR"),
    );
    const currentStoryIcon =
      getImmediateSelfIcon() ||
      resolveFriendIcon(currentStoryUser?.icon || "") ||
      currentStoryUser?.icon ||
      null;
    const storyRingGroups = Array.from(
      filteredWallPosts.reduce(
        (groups, post) => {
          const existing = groups.get(post.user.id);
          if (existing) {
            existing.count += 1;
            existing.hasUnviewed = existing.hasUnviewed || !post.isViewed;
            return groups;
          }
          groups.set(post.user.id, {
            post,
            count: 1,
            hasUnviewed: !post.isViewed,
          });
          return groups;
        },
        new Map<
          number,
          { post: WallPost; count: number; hasUnviewed: boolean }
        >(),
      ),
    ).map(([, group]) => group);
    const selectedMobileFriends =
      mobileFriendPresenceTab === "online" ? onlineFriends : offlineFriends;
    const selectedMobileFriendTitle =
      mobileFriendPresenceTab === "online" ? "Çevrimiçi" : "Çevrimdışı";
    const selectedMobileFriendTone =
      mobileFriendPresenceTab === "offline" ? "offline" : "online";
    const missedCallsCount = callsForDisplay.filter(
      (call) => call.type === "missed",
    ).length;
    const renderMobileFriendRequestCard = (
      item: FriendRequest,
      mode: "incoming" | "outgoing",
    ) => {
      const mappedUser = mapFriendToRoomUser(item, {
        includeLivePresence: false,
      });
      const displayName = getDisplayUsername(mappedUser);
      const resolvedIcon = resolveFriendIcon(item.user.icon);
      const isMale = item.user.gender === "male";

      return (
        <div
          key={`mobile-friend-request-${mode}-${item.id}`}
          className="flex min-h-[68px] items-center gap-3 rounded-[12px] bg-white px-3 py-2.5 shadow-[0_1px_0_rgba(15,23,42,0.05)]"
        >
          <button
            type="button"
            onClick={() => handleUserClick(mappedUser)}
            className={`flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full text-[15px] font-bold text-white ${
              resolvedIcon?.startsWith("data:")
                ? "bg-white"
                : isMale
                  ? "bg-linear-to-br from-blue-500 to-blue-600"
                  : "bg-linear-to-br from-pink-500 to-pink-600"
            }`}
            aria-label={`${displayName} profilini aç`}
          >
            {resolvedIcon ? (
              <img
                src={resolvedIcon}
                alt={displayName}
                className="h-full w-full object-cover"
              />
            ) : (
              getAvatarInitial(mappedUser)
            )}
          </button>
          <button
            type="button"
            onClick={() => handleUserClick(mappedUser)}
            className="min-w-0 flex-1 text-left"
          >
            <div className="truncate text-[15px] font-semibold text-zinc-950">
              {displayName}
            </div>
            <div className="text-[12px] font-medium text-zinc-500">
              {mode === "incoming" ? "Gelen arkadaşlık isteği" : "Bekleyen istek"}
            </div>
          </button>
          {mode === "incoming" ? (
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  handleAcceptFriendRequest(item.id);
                }}
                className="rounded-md bg-emerald-500 px-2.5 py-1.5 text-[12px] font-semibold text-white active:bg-emerald-600"
              >
                Kabul
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  handleRejectFriendRequest(item.id);
                }}
                className="rounded-md bg-zinc-200 px-2.5 py-1.5 text-[12px] font-semibold text-zinc-700 active:bg-zinc-300"
              >
                Reddet
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                handleCancelFriendRequest(item.id);
              }}
              className="shrink-0 rounded-md bg-zinc-200 px-2.5 py-1.5 text-[12px] font-semibold text-zinc-700 active:bg-zinc-300"
            >
              İptal
            </button>
          )}
        </div>
      );
    };
    const mobileCallEmptyTitle: Record<typeof callFilter, string> = {
      all: "ARAMALAR LİSTESİ BOŞ",
      missed: "CEVAPSIZ LİSTESİ BOŞ",
      outgoing: "GİDEN LİSTESİ BOŞ",
      incoming: "GELEN LİSTESİ BOŞ",
    };

    return (
      <div className="chat-theme-sidebar-content flex h-full flex-col bg-[#f4f4f6]">
        {mobileRoomsDirectoryTab === "wall" ? (
          <div className="flex h-[62px] shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-4">
            <button
              type="button"
              onClick={() => setMobileRoomsDirectoryTab("rooms")}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[#0a84ff] active:bg-blue-50"
              aria-label="Geri"
            >
              <ArrowLeft className="h-7 w-7" />
            </button>
            <h2 className="text-[20px] font-extrabold tracking-tight text-zinc-950">
              {titleByTab[mobileRoomsDirectoryTab]}
            </h2>
          </div>
        ) : (
          <>
            <div className="flex h-[62px] shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-4">
              <h2 className="text-[20px] font-extrabold tracking-wide text-[#0a84ff]">
                {titleByTab[mobileRoomsDirectoryTab]}
              </h2>
              <button
                type="button"
                onClick={onMobileRoomClose}
                className="inline-flex h-10 items-center gap-1.5 rounded-md bg-[#0a84ff] px-3 text-[16px] font-semibold text-white active:bg-[#0070dd]"
              >
                <Home className="h-4.5 w-4.5" />
                Geri Dön
              </button>
            </div>

            {mobileRoomsDirectoryTab === "calls" ? (
              <div className="shrink-0 bg-white px-6 pb-2 pt-4">
                <div className="grid grid-cols-4 overflow-hidden rounded-full border border-[#0a84ff] bg-white">
                  {[
                    { key: "all", label: "Tümü" },
                    { key: "missed", label: "Cevapsız" },
                    { key: "outgoing", label: "Giden" },
                    { key: "incoming", label: "Gelen" },
                  ].map((tab) => (
                    <button
                      key={`mobile-call-filter-${tab.key}`}
                      type="button"
                      onClick={() =>
                        setCallFilter(
                          tab.key as "all" | "missed" | "outgoing" | "incoming",
                        )
                      }
                      className={`h-9 border-r border-[#0a84ff] text-[14px] font-medium last:border-r-0 ${
                        callFilter === tab.key
                          ? "bg-[#0a84ff] text-white"
                          : "bg-white text-[#0a84ff]"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div
              className={`shrink-0 bg-white px-3 ${
                mobileRoomsDirectoryTab === "calls" ? "pb-2 pt-0" : "py-2"
              }`}
            >
              <div className="relative">
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder={
                    mobileRoomsDirectoryTab === "friends"
                      ? "Arkadaş ara..."
                      : mobileRoomsDirectoryTab === "calls"
                        ? "Tüm çağrılarda ara..."
                        : "Oda Ara..."
                  }
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className={`h-9 w-full border-none bg-[#e7e7ea] px-3 pl-9 text-[14px] font-medium text-zinc-800 placeholder:text-zinc-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0a84ff]/20 ${
                    mobileRoomsDirectoryTab === "calls"
                      ? "rounded-[10px] text-[16px] placeholder:text-zinc-400"
                      : "rounded-[12px]"
                  }`}
                />
                <svg
                  viewBox="0 0 24 24"
                  className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
              </div>
            </div>
          </>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto pb-[62px]">
          {mobileRoomsDirectoryTab === "wall" ? (
            <div className="min-h-full bg-white px-3.5 py-3 text-zinc-950">
              <div className="mb-2.5 flex items-center justify-between">
                <h3 className="text-[16px] font-extrabold">Durum</h3>
              </div>

              {isGuestUser && (
                <div className="mb-4 overflow-hidden rounded-[16px] bg-gradient-to-br from-[#0a84ff]/10 to-[#5856d6]/10 ring-1 ring-[#0a84ff]/20">
                  <div className="flex items-start gap-3 px-4 py-3.5">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0a84ff]">
                      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-white" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-zinc-800 leading-snug">
                        Story özelliği için üye olmanız gerekiyor
                      </p>
                      <p className="mt-0.5 text-[12px] text-zinc-500 leading-snug">
                        Durum paylaşmak ve arkadaşlarının durumlarını görmek için üye girişi yapın.
                      </p>
                    </div>
                  </div>
                  <div className="border-t border-[#0a84ff]/15 px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => setShowRegisterModal(true)}
                      className="w-full rounded-[10px] bg-[#0a84ff] py-2 text-[13px] font-bold text-white active:bg-[#0070dd]"
                    >
                      Ücretsiz Kayıt Ol
                    </button>
                  </div>
                </div>
              )}

              <div className="mb-4 flex gap-2.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {!isGuestUser && (
                  <button
                    type="button"
                    onClick={() => setShowWallModal(true)}
                    className="flex w-[78px] shrink-0 flex-col items-center gap-1.5 active:scale-[0.98]"
                  >
                    <span className="relative flex h-[68px] w-[68px] items-center justify-center">
                      <span className="flex h-[62px] w-[62px] items-center justify-center overflow-hidden rounded-full border-[3px] border-[#0a84ff] bg-zinc-200 text-[21px] font-black text-zinc-600">
                        {currentStoryIcon ? (
                          <img
                            src={currentStoryIcon}
                            alt={currentUsername || "Durum"}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          (currentUsername || "D").charAt(0).toUpperCase()
                        )}
                      </span>
                      <span className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-[#0a84ff] text-base font-black leading-none text-white shadow-sm">
                        +
                      </span>
                    </span>
                    <span className="line-clamp-2 text-center text-[11px] font-bold leading-tight text-zinc-700">
                      Durum ekle
                    </span>
                  </button>
                )}

                {storyRingGroups
                  .slice(0, 10)
                  .map(({ post, count, hasUnviewed }) => {
                  const postIcon =
                    resolveFriendIcon(post.user.icon || "") || post.user.icon;
                  return (
                    <div
                      key={`mobile-story-ring-${post.user.id}`}
                      className="flex w-[78px] shrink-0 flex-col items-center gap-1.5"
                    >
                      <button
                        type="button"
                        onClick={() => openStoryPost(post)}
                        className={`relative flex h-[62px] w-[62px] items-center justify-center rounded-full border-[3px] bg-zinc-200 text-[20px] font-black text-zinc-700 active:scale-[0.98] ${
                          hasUnviewed ? "border-emerald-500" : "border-zinc-300"
                        }`}
                        aria-label={`${post.user.username} durumunu aç`}
                      >
                        {postIcon ? (
                          <img
                            src={postIcon}
                            alt={post.user.username}
                            className="h-full w-full rounded-full object-cover"
                          />
                        ) : (
                          post.user.username.charAt(0).toUpperCase()
                        )}
                        {count > 1 ? (
                          <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-white bg-[#0a84ff] px-1.5 text-[11px] font-black leading-none text-white">
                            {count}
                          </span>
                        ) : null}
                      </button>
                      <span className="line-clamp-2 text-center text-[11px] font-bold leading-tight text-zinc-700">
                        {post.user.username}
                      </span>
                    </div>
                  );
                  })}
              </div>

              <h3 className="mb-3 text-[16px] font-extrabold">
                Duvar Yazıları
              </h3>

              {wallLoading ? (
                <div className="py-8 text-center text-sm font-medium text-zinc-500">
                  Duvar yazıları yükleniyor...
                </div>
              ) : filteredWallPosts.length === 0 ? (
                <div className="rounded-[14px] bg-[#f1f1f3] px-4 py-6 text-center text-sm font-semibold text-zinc-500">
                  Henüz duvar yazısı yok
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  {filteredWallPosts.map((post) => {
                    const postIcon =
                      resolveFriendIcon(post.user.icon || "") || post.user.icon;
                    const postImage = post.image ? resolveMediaUrl(post.image) : null;
                    const storyBackground =
                      post.backgroundColor || "linear-gradient(135deg, #111827, #2563eb)";
                    return (
                      <button
                        key={`mobile-wall-${post.id}`}
                        type="button"
                        onClick={() =>
                          openStoryPost(post, null, { preservePost: true })
                        }
                        className="relative h-[166px] overflow-hidden rounded-[14px] bg-zinc-900 text-left shadow-sm"
                        style={{
                          background: postImage ? undefined : storyBackground,
                        }}
                      >
                        {postImage ? (
                          <img
                            src={postImage}
                            alt={post.content || post.user.username}
                            className="absolute inset-0 h-full w-full object-cover"
                          />
                        ) : null}
                        <span className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/10 to-black/75" />
                        <span className="absolute left-2 top-2 flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border-2 border-[#0a84ff] bg-zinc-300 text-xs font-black text-zinc-700">
                          {postIcon ? (
                            <img
                              src={postIcon}
                              alt={post.user.username}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            post.user.username.charAt(0).toUpperCase()
                          )}
                        </span>
                        <span className="absolute bottom-2 left-2 right-2">
                          <span className="block truncate text-[12px] font-extrabold text-white">
                            {post.user.username}
                          </span>
                          <span className="mt-1 line-clamp-3 text-[13px] font-semibold leading-tight text-white">
                            {post.content || "Görsel paylaşımı"}
                          </span>
                          <span className="mt-1.5 block text-[10px] font-medium text-white/75">
                            {formatWallTime(post.createdAt)}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
              </div>
          ) : mobileRoomsDirectoryTab === "friends" ? (
            isGuestUser ? (
              <div className="flex flex-col items-center px-4 pt-10 pb-6">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
                  <svg viewBox="0 0 24 24" className="h-8 w-8 fill-amber-500" xmlns="http://www.w3.org/2000/svg">
                    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                  </svg>
                </div>
                <h3 className="text-[17px] font-extrabold text-zinc-900 text-center mb-1">
                  Arkadaşlar için üye olun
                </h3>
                <p className="text-[13px] text-zinc-500 text-center leading-relaxed mb-6 max-w-[240px]">
                  Arkadaş eklemek, arkadaşlık istekleri göndermek ve çevrimiçi arkadaşlarınızı takip etmek için üye girişi yapmanız gerekmektedir.
                </p>
                <div className="w-full space-y-2.5">
                  <button
                    type="button"
                    onClick={() => setShowRegisterModal(true)}
                    className="w-full rounded-[14px] bg-[#0a84ff] py-3 text-[15px] font-bold text-white shadow-sm active:bg-[#0070dd]"
                  >
                    Ücretsiz Kayıt Ol
                  </button>
                  <div className="flex items-center gap-2 rounded-[14px] bg-amber-50 px-4 py-3 ring-1 ring-amber-200">
                    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 fill-amber-500" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
                    </svg>
                    <span className="text-[12px] font-semibold text-amber-700">
                      Misafir hesabıyla arkadaşlar bölümüne erişilemez
                    </span>
                  </div>
                </div>
              </div>
            ) : friendsLoading ? (
              <div className="py-10 text-center text-sm font-medium text-zinc-500">
                Arkadaşlar yükleniyor...
              </div>
            ) : friendsError ? (
              <div className="py-10 text-center text-sm font-medium text-red-600">
                {friendsError}
              </div>
            ) : (
              <div className="space-y-3 px-3 py-3">
                <div className="grid grid-cols-4 overflow-hidden rounded-full border border-[#0a84ff] bg-white">
                  {[
                    {
                      key: "online" as const,
                      label: "Çevrimiçi",
                      count: onlineFriends.length,
                    },
                    {
                      key: "offline" as const,
                      label: "Çevrimdışı",
                      count: offlineFriends.length,
                    },
                    {
                      key: "incoming" as const,
                      label: "Gelen",
                      count: filteredIncoming.length,
                    },
                    {
                      key: "outgoing" as const,
                      label: "Giden",
                      count: filteredOutgoing.length,
                    },
                  ].map((tab) => {
                    const isSelected = mobileFriendPresenceTab === tab.key;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setMobileFriendPresenceTab(tab.key)}
                        className={`flex h-10 min-w-0 items-center justify-center gap-0.5 border-r border-[#0a84ff] px-0.5 text-center text-[10px] font-bold last:border-r-0 ${
                          isSelected
                            ? "bg-[#0a84ff] text-white"
                            : "bg-white text-[#0a84ff]"
                        }`}
                      >
                        <span className="whitespace-nowrap">
                          {tab.label}
                        </span>
                        <span
                          className={`flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1 text-[10px] font-black ${
                            isSelected
                              ? "bg-white/20 text-white"
                              : "bg-blue-50 text-[#0a84ff]"
                          }`}
                        >
                          {tab.count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="space-y-2">
                  {mobileFriendPresenceTab === "incoming" ? (
                    filteredIncoming.length > 0 ? (
                      filteredIncoming.map((item) =>
                        renderMobileFriendRequestCard(item, "incoming"),
                      )
                    ) : (
                      <div className="rounded-[16px] bg-white px-4 py-8 text-center text-[14px] font-semibold text-zinc-500 shadow-sm">
                        {searchQuery.trim()
                          ? "Eşleşen gelen istek yok"
                          : "Gelen arkadaşlık isteği yok"}
                      </div>
                    )
                  ) : mobileFriendPresenceTab === "outgoing" ? (
                    filteredOutgoing.length > 0 ? (
                      filteredOutgoing.map((item) =>
                        renderMobileFriendRequestCard(item, "outgoing"),
                      )
                    ) : (
                      <div className="rounded-[16px] bg-white px-4 py-8 text-center text-[14px] font-semibold text-zinc-500 shadow-sm">
                        {searchQuery.trim()
                          ? "Eşleşen giden istek yok"
                          : "Giden arkadaşlık isteği yok"}
                      </div>
                    )
                  ) : selectedMobileFriends.length > 0 ? (
                    selectedMobileFriends.map((item) =>
                      renderMobileDirectoryCard(
                        mapFriendToRoomUser(item, {
                          includeLivePresence:
                            selectedMobileFriendTone === "online",
                        }),
                        {
                          fallbackRoom: selectedMobileFriendTone === "online",
                          statusLabel: selectedMobileFriendTitle,
                          statusTone: selectedMobileFriendTone,
                          friendRequestId: item.id,
                          showFriendRemove: true,
                        },
                      ),
                    )
                  ) : (
                    <div className="rounded-[16px] bg-white px-4 py-8 text-center text-[14px] font-semibold text-zinc-500 shadow-sm">
                      {searchQuery.trim()
                        ? "Bu bölümde eşleşen arkadaş yok"
                        : selectedMobileFriendTone === "online"
                          ? "Çevrimiçi arkadaş yok"
                          : "Çevrimdışı arkadaş yok"}
                    </div>
                  )}
                </div>
              </div>
            )
          ) : mobileRoomsDirectoryTab === "calls" ? (
            filteredCalls.length === 0 ? (
              <div className="flex min-h-full flex-col items-center border-t border-zinc-200 bg-white px-6 pt-20 text-center">
                <Phone className="mb-10 h-24 w-24 fill-[#858585] text-[#858585]" strokeWidth={0} />
                <div className="text-[18px] font-medium uppercase text-[#77777c]">
                  {mobileCallEmptyTitle[callFilter]}
                </div>
              </div>
            ) : (
              <div className="min-h-full space-y-1 border-t border-zinc-200 bg-white">
                {filteredCalls.map((call) => {
                  const iconMap = {
                    missed: {
                      icon: PhoneMissed,
                      classes: "bg-red-100 text-red-500",
                    },
                    incoming: {
                      icon: PhoneIncoming,
                      classes: "bg-green-100 text-green-600",
                    },
                    outgoing: {
                      icon: PhoneOutgoing,
                      classes: "bg-blue-100 text-blue-600",
                    },
                  } as const;
                  const Icon = iconMap[call.type].icon;

                  return (
                    <div
                      key={`mobile-call-${call.id}`}
                      className="flex min-h-[66px] items-center gap-3 border-b border-zinc-100 px-4 py-3"
                    >
                      <div
                        className={`flex h-11 w-11 items-center justify-center rounded-full ${
                          iconMap[call.type].classes
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div
                          className={`truncate text-[16px] font-semibold ${
                            call.type === "missed"
                              ? "text-red-500"
                              : "text-zinc-950"
                          }`}
                        >
                          {call.name}
                        </div>
                        <div
                          className={`text-[13px] font-medium ${
                            call.type === "missed"
                              ? "text-red-400"
                              : "text-zinc-500"
                          }`}
                        >
                          {call.time}
                          {call.duration ? ` · ${call.duration}` : ""}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={(event) => handleCallBack(call, event)}
                          className={`flex h-9 w-9 items-center justify-center rounded-full active:bg-zinc-100 ${
                            call.type === "missed"
                              ? "text-red-500"
                              : "text-[#0a84ff]"
                          }`}
                          aria-label="Geri ara"
                          title="Geri ara"
                        >
                          <PhoneOutgoing className="h-5 w-5" />
                        </button>
                        <button
                          type="button"
                          onClick={(event) =>
                            handleDeleteCallHistory(call.id, event)
                          }
                          className="flex h-9 w-9 items-center justify-center rounded-full text-red-500 active:bg-red-50"
                          aria-label="Çağrı kaydını sil"
                          title="Sil"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : isLoadingRooms ? (
            <div className="py-10 text-center text-sm font-medium text-zinc-500">
              Odalar yükleniyor...
            </div>
          ) : filteredRooms.length === 0 ? (
            <div className="py-10 text-center text-sm font-medium text-zinc-500">
              Oda bulunamadı
            </div>
          ) : (
            <>
              {specialRooms.length > 0 && (
                <div className="grid grid-cols-3 gap-2 bg-white px-3 pb-2.5">
                  {specialRooms.slice(0, 3).map((room) => (
                    <button
                      key={`mobile-special-room-${room.id}`}
                      type="button"
                      onClick={() => handleRoomClick(room)}
                      className="flex flex-col items-center gap-1.5 rounded-xl bg-[#f4f4f6] pb-2 pt-2 active:scale-[0.98]"
                    >
                      <div className="h-[40px] w-[40px] overflow-hidden rounded-full border-2 border-white bg-white shadow-sm ring-1 ring-zinc-200">
                        {renderRoomImage(room, "h-full w-full object-cover")}
                      </div>
                      <span className="line-clamp-1 px-1 text-[11.5px] font-semibold text-[#0a84ff]">
                        {room.name}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <div className="space-y-1.5 px-3 py-2.5">
                {regularRooms.map((room) => {
                  const roomKey = String(room.voiceId || room.name);
                  const { value: liveCount } = getLiveCount(roomKey);
                  return (
                    <button
                      key={`mobile-room-${room.id}`}
                      type="button"
                      onClick={() => handleRoomClick(room)}
                      className="flex h-[76px] w-full overflow-hidden rounded-[12px] bg-white text-left shadow-[0_2px_8px_rgba(0,0,0,0.04)] ring-1 ring-black/5 active:scale-[0.99]"
                    >
                      <div className="h-[76px] w-[76px] shrink-0 overflow-hidden bg-zinc-100">
                        {renderRoomImage(room, "h-full w-full object-cover")}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col justify-center px-3 py-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <h3 className="truncate text-[15px] font-black leading-tight tracking-tight text-[#0a84ff]">
                              {room.name}
                            </h3>
                            <div className="mt-0.5">
                              <span className="inline-flex rounded-md bg-[#0a84ff] px-2 py-0.5 text-[10px] font-bold leading-tight text-white">
                                {room.isPrivate ? "Şifreli Oda" : "Herkese Açık"}
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex shrink-0 flex-col items-end gap-0.5 text-[#0a84ff]/40">
                            <div className="flex h-3.5 items-end gap-[1.5px]">
                              <span className="h-1 w-0.5 rounded-full bg-current" />
                              <span className="h-3 w-0.5 rounded-full bg-current" />
                              <span className="h-2.5 w-0.5 rounded-full bg-current" />
                            </div>
                            <div className="flex items-center gap-1 text-zinc-400">
                              <UserRound className="h-3.5 w-3.5" />
                              <span className="text-[14px] font-extrabold leading-none text-zinc-600">
                                {liveCount === null ? "0" : liveCount}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-0.5 min-w-0 overflow-hidden">
                          <p className="truncate text-[12px] font-medium leading-snug text-zinc-400">
                            {room.description || "eDepLe GeLeN HüRMeTLe GiDeRr..."}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="absolute bottom-0 left-0 right-0 grid h-[58px] grid-cols-4 border-t border-zinc-200 bg-white/95 pb-[env(safe-area-inset-bottom)]">
          {[
            { key: "rooms", label: "Tüm Odalar", icon: Home },
            { key: "wall", label: "Story", icon: MessageSquare },
            { key: "friends", label: "Arkadaşlar", icon: UserRound },
            { key: "calls", label: "Aramalar", icon: Phone },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = mobileRoomsDirectoryTab === item.key;
            return (
              <button
                key={item.label}
                type="button"
                onClick={() =>
                  setMobileRoomsDirectoryTab(
                    item.key as "rooms" | "wall" | "friends" | "calls",
                  )
                }
                className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
                  isActive ? "text-[#0a84ff]" : "text-zinc-400"
                }`}
              >
                <span className="relative">
                  <Icon className="h-5 w-5" />
                  {item.key === "friends" && incomingRequests.length > 0 ? (
                    <span className="absolute -right-2.5 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black leading-none text-white shadow-sm">
                      {incomingRequests.length > 99
                        ? "99+"
                        : incomingRequests.length}
                    </span>
                  ) : null}
                  {item.key === "calls" && missedCallsCount > 0 ? (
                    <span className="absolute -right-2.5 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black leading-none text-white shadow-sm">
                      {missedCallsCount > 99 ? "99+" : missedCallsCount}
                    </span>
                  ) : null}
                </span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <>
    <aside
      className={`chat-theme-sidebar relative shrink-0 flex-col overflow-hidden border-r border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-200 ${
        forceVisible
          ? mobileRoomsFullscreen
            ? "flex h-full w-full border-0 bg-[#f4f4f6] dark:bg-[#f4f4f6]"
            : mobileAllUsersFullscreen
            ? "flex h-full w-full border-0 bg-[#f4f4f6] dark:bg-[#f4f4f6]"
            : mobileRoomOnly
            ? "flex h-full w-full rounded-t-[24px] border-0 bg-[#f4f4f6] dark:bg-[#f4f4f6]"
            : "flex h-full w-full"
          : "hidden w-[350px] md:flex"
      }`}
    >
      {mobileRoomsFullscreen ? (
        renderMobileRoomsDirectory()
      ) : (
        <>
      <div
        className={
          mobileAllUsersFullscreen
            ? "chat-theme-sidebar-header relative flex h-[58px] shrink-0 items-center justify-center border-b border-zinc-200 bg-[#f7f7f8] px-4"
            : mobileRoomOnly
            ? "chat-theme-sidebar-header flex h-[56px] shrink-0 items-center justify-between border-b border-zinc-200 bg-[#f7f7f8] px-4"
            : "chat-theme-sidebar-header h-16 flex items-center border-b border-zinc-800 p-4 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-200"
        }
      >
        {mobileAllUsersFullscreen ? (
          <>
            <button
              type="button"
              onClick={onMobileRoomClose}
              className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-[#0a84ff] transition active:bg-zinc-200"
              aria-label="Tüm kullanıcılar panelini kapat"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-7 w-7"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M15 18 9 12l6-6" />
              </svg>
            </button>
            <h2 className="text-center text-[20px] font-extrabold text-black">
              Tüm Kullanıcılar
            </h2>
          </>
        ) : mobileRoomOnly ? (
          <>
            <h2 className="text-[19px] font-bold text-black">
              Oda kişileri ({roomUsersCount})
            </h2>
            <button
              type="button"
              onClick={onMobileRoomClose}
              className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-200 hover:text-zinc-600"
              aria-label="Oda kişileri panelini kapat"
            >
              <X className="h-7 w-7" />
            </button>
          </>
        ) : (
          <SidebarNav
            onTabChange={setActiveTab}
            onOpenMessages={() => {
              if (shouldBlockGuestPrivateMessages && effectiveDmUnreadCount <= 0) {
                toast.error(
                  "Misafir özel mesaj kapalı. Size yeni mesaj gelmeden bu bölüme giremezsiniz.",
                );
                return;
              }
              setShowMessagesModal(true);
              setDmTargetUsername(null);
            }}
            totalUserCount={allUsersCount}
            friendCounts={{ incoming: incomingRequests.length }}
            socket={socket}
            currentUserStarCount={currentUserStarCount}
            canUseRoof={canUseRoof}
            dmUnreadCount={effectiveDmUnreadCount}
            hideRoomsButton={hideRoomsNavButton}
          />
        )}
      </div>
      <div
        className={
          mobileAllUsersFullscreen
            ? "chat-theme-sidebar-content min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[#f4f4f6] px-2 pb-4 pt-2"
            : mobileRoomOnly
            ? "chat-theme-sidebar-content min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-2 py-1.5"
            : "chat-theme-sidebar-content flex-1 space-y-2 overflow-y-auto px-3 py-2"
        }
      >
        {mobileAllUsersFullscreen ? (
          <div className="space-y-2">
            <div className="relative">
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Tüm kişilerde ara..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="h-[38px] w-full rounded-[9px] border border-zinc-200 bg-[#e7e7ea] px-3 pl-9 text-[15px] font-normal text-zinc-800 placeholder:text-zinc-400 focus:border-[#0a84ff] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0a84ff]"
              />
              <button
                type="button"
                onClick={() => searchInputRef.current?.focus()}
                className="absolute left-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center text-zinc-500"
                aria-label="Aramayı aktif et"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-5.5 w-5.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
              </button>
            </div>

            <div className="mx-auto flex w-[72%] overflow-hidden rounded-full border-2 border-[#0a84ff] bg-white">
              <button
                type="button"
                onClick={() => setActiveTab("all")}
                className={`flex h-[30px] flex-1 items-center justify-center text-[13px] font-medium transition ${
                  activeTab === "all"
                    ? "bg-[#0a84ff] text-white"
                    : "bg-white text-[#0a84ff]"
                }`}
              >
                Herkes{" "}
                <span
                  className={`ml-1 text-[11px] ${
                    activeTab === "all" ? "text-white/75" : "text-[#0a84ff]/70"
                  }`}
                >
                  ({allUsersCount})
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("friends")}
                className={`flex h-[30px] flex-1 items-center justify-center text-[13px] font-medium transition ${
                  activeTab === "friends"
                    ? "bg-[#0a84ff] text-white"
                    : "bg-white text-[#0a84ff]"
                }`}
              >
                Arkadaşlar{" "}
                <span
                  className={`ml-1 text-[11px] ${
                    activeTab === "friends"
                      ? "text-white/75"
                      : "text-[#0a84ff]/70"
                  }`}
                >
                  ({friends.length})
                </span>
              </button>
            </div>

            <div className="space-y-1">
              {activeTab === "friends" ? (
                friendsLoading ? (
                  <div className="rounded-[14px] bg-white px-4 py-10 text-center text-sm font-medium text-zinc-500">
                    Yükleniyor...
                  </div>
                ) : filteredFriends.length === 0 ? (
                  <div className="rounded-[14px] bg-white px-4 py-10 text-center text-sm font-medium text-zinc-500">
                    {searchQuery.trim() ? "Arkadaş bulunamadı" : "Arkadaş listen boş"}
                  </div>
                ) : (
                  filteredFriends.map((item) =>
                    renderMobileDirectoryCard(mapFriendToRoomUser(item), {
                      friendRequestId: item.id,
                      showFriendRemove: true,
                    }),
                  )
                )
              ) : filteredAllUsers.length === 0 ? (
                <div className="rounded-[14px] bg-white px-4 py-10 text-center text-sm font-medium text-zinc-500">
                  {searchQuery.trim() ? "Kullanıcı bulunamadı" : "Aktif kullanıcı yok"}
                </div>
              ) : (
                filteredAllUsers.map((user) => {
                  const relation = getFriendRelation(
                    user.username,
                    user.agentNickname,
                  );
                  return renderMobileDirectoryCard(user, {
                    friendRequestId:
                      relation.type === "friends"
                        ? relation.requestId
                        : undefined,
                    showFriendRemove: relation.type === "friends",
                  });
                })
              )}
            </div>
          </div>
        ) : (
          <>
        {/* Search Input */}
        <div className="mt-1">
          <div className="relative">
            <input
              ref={searchInputRef}
              type="text"
              placeholder={
                activeTab === "rooms"
                  ? "Oda ara..."
                  : activeTab === "friends"
                    ? "Kişi ara..."
                    : activeTab === "wall"
                      ? "Duvar yazısı ara..."
                      : activeTab === "calls"
                        ? "Arama veya kişi ara..."
                        : "Kullanıcı ara..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full border border-zinc-200 bg-white px-4 pl-10 text-sm text-black placeholder-zinc-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 dark:border-zinc-700 dark:bg-white dark:text-black dark:placeholder-zinc-500 ${
                mobileRoomOnly
                  ? "h-9 rounded-[9px] bg-white text-[14px] placeholder:text-zinc-500"
                  : "rounded-lg py-2"
              }`}
            />
            <button
              type="button"
              onClick={() => searchInputRef.current?.focus()}
              className="absolute left-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center text-zinc-500"
              aria-label="Aramayı aktif et"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs - Only show when in room or all view */}
        {!mobileRoomOnly && (activeTab === "room" || activeTab === "all") && (
          <div className="mt-2 flex rounded-lg bg-zinc-100 p-1">
            <button
              onClick={() => setActiveTab("room")}
              className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                activeTab === "room"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-zinc-800 hover:text-zinc-900"
              }`}
            >
              Oda Kişileri{" "}
              <span
                className={`ml-1 text-xs ${
                  activeTab === "room" ? "text-white/90" : "text-zinc-700"
                }`}
              >
                {roomUsersCount}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("all")}
              className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                activeTab === "all"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-zinc-800 hover:text-zinc-900"
              }`}
            >
              Tüm Kişiler{" "}
              <span
                className={`ml-1 text-xs ${
                  activeTab === "all" ? "text-white/90" : "text-zinc-700"
                }`}
              >
                {allUsersCount}
              </span>
            </button>
          </div>
        )}

        {/* Content based on active tab */}
        <div className="mt-2 space-y-1">
          {activeTab === "calls" ? (
            <>
              <div className="flex gap-2 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-100">
                {[
                  { key: "all", label: "Tümü" },
                  { key: "missed", label: "Cevapsız" },
                  { key: "outgoing", label: "Giden" },
                  { key: "incoming", label: "Gelen" },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() =>
                      setCallFilter(
                        tab.key as "all" | "missed" | "outgoing" | "incoming",
                      )
                    }
                    className={`flex-1 rounded-md py-1.5 text-sm font-medium ${
                      callFilter === tab.key
                        ? "bg-white text-black shadow-sm dark:bg-white dark:text-black"
                        : "text-zinc-500 hover:text-black dark:text-zinc-500 dark:hover:text-black"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                {filteredCalls.length === 0 ? (
                  <div className="flex items-center justify-center py-12">
                    <p className="text-sm text-gray-500">Kayıt bulunamadı</p>
                  </div>
                ) : (
                  filteredCalls.map((call) => {
                    const iconMap = {
                      missed: {
                        icon: PhoneMissed,
                        classes: "bg-red-100 text-red-500",
                      },
                      incoming: {
                        icon: PhoneIncoming,
                        classes: "bg-green-100 text-green-600",
                      },
                      outgoing: {
                        icon: PhoneOutgoing,
                        classes: "bg-blue-100 text-blue-600",
                      },
                    } as const;
                    const Icon = iconMap[call.type].icon;

                    return (
                      <div
                        key={call.id}
                        className="flex items-center gap-3 rounded-lg p-3 hover:bg-zinc-50 cursor-pointer transition-colors"
                      >
                        <div
                          className={`h-10 w-10 rounded-full flex items-center justify-center ${
                            iconMap[call.type].classes
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
	                            <span
	                              className={`truncate text-sm font-medium ${
	                                call.type === "missed"
	                                  ? "text-red-500"
	                                  : "text-black"
	                              }`}
	                            >
	                              {call.name}
	                            </span>
	                            <div className="flex shrink-0 items-center gap-2">
	                              <button
	                                type="button"
	                                onClick={(event) => handleCallBack(call, event)}
	                                className={
	                                  call.type === "missed"
	                                    ? "text-red-500 hover:text-red-600"
	                                    : "text-zinc-400 hover:text-zinc-600"
	                                }
	                                aria-label="Geri ara"
	                                title="Geri ara"
	                              >
	                                <PhoneOutgoing className="h-5 w-5" />
	                              </button>
	                              <button
	                                type="button"
	                                onClick={(event) =>
	                                  handleDeleteCallHistory(call.id, event)
	                                }
	                                className="text-red-500 hover:text-red-600"
	                                aria-label="Çağrı kaydını sil"
	                                title="Sil"
	                              >
	                                <Trash2 className="h-5 w-5" />
	                              </button>
	                            </div>
	                          </div>
	                          <p
	                            className={`text-xs ${
	                              call.type === "missed"
	                                ? "text-red-400"
	                                : "text-gray-500"
	                            }`}
	                          >
	                            {call.time}
	                            {call.duration ? ` · ${call.duration}` : null}
	                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          ) : activeTab === "friends" ? (
            <div className="space-y-4">
              <div className="flex gap-2">
                {[
                  {
                    key: "friends",
                    label: "ARKADAŞLAR",
                    count: friends.length,
                  },
                  {
                    key: "incoming",
                    label: "GELEN",
                    count: incomingRequests.length,
                  },
                  {
                    key: "outgoing",
                    label: "GİDEN",
                    count: outgoingRequests.length,
                  },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() =>
                      setFriendFilter(
                        tab.key as "friends" | "incoming" | "outgoing",
                      )
                    }
                    className={`flex-1 rounded-full px-3 py-2 text-xs font-semibold transition ${
                      friendFilter === tab.key
                        ? "bg-blue-500 text-white"
                        : "bg-zinc-200 text-zinc-600"
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>{tab.label}</span>
                      <span
                        className={`flex h-5 min-w-[20px] items-center justify-center rounded-full border px-2 text-[11px] ${
                          friendFilter === tab.key
                            ? "border-white text-white"
                            : "border-zinc-400 text-zinc-600"
                        }`}
                      >
                        {tab.count}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
              {friendsLoading ? (
                <div className="flex items-center justify-center py-10 text-sm text-gray-500">
                  Yükleniyor...
                </div>
              ) : friendsError ? (
                <div className="flex items-center justify-center py-10 text-sm text-red-600">
                  {friendsError}
                </div>
              ) : (
                (() => {
                  const list =
                    friendFilter === "friends"
                      ? filteredFriends
                      : friendFilter === "incoming"
                        ? filteredIncoming
                        : filteredOutgoing;

                  if (list.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center py-10 text-sm text-gray-500">
                        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-zinc-200 text-zinc-600">
                          <UserRound className="h-5 w-5" />
                        </div>
                        <p>Liste boş</p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-2">
                      {list.map((item) => {
                        const user = item.user;
                        const isMale = user.gender === "male";
                        const mappedUser = mapFriendToRoomUser(item);
                        const displayName = getDisplayUsername(mappedUser);
                        const isMaskedUser = isAgentMaskedUser(mappedUser);
                        const resolvedFrame = resolveFriendFrame(user.frame);
                        const resolvedIcon = resolveFriendIcon(user.icon);
                        const friendUserGif = (user as { userGif?: string | null })
                          .userGif;
                        const userGifPath = resolveUserGifPath(
                          friendUserGif || null,
                        );
                        const isFlameGif = isFlameUserGif(userGifPath);
                        const isFlagGif = isFlagUserGif(userGifPath);
                        const isDoveGif = isDoveUserGif(userGifPath);
                        const isRoseGif = isRoseUserGif(userGifPath);
                        const isYearbasiGif = isYearbasiUserGif(userGifPath);
                        const isHeartGif = isHeartUserGif(userGifPath);
                        const isBalloonGif = isBalloonUserGif(userGifPath);
                        const isOnline = Boolean(
                          mappedUser.statusModeName ||
                            activeTenantUsers.some((u) => {
                              if (u.username !== user.username || u.agentNickname) {
                                return false;
                              }
                              const targetStarCount = Number(
                                u.roleStarCount ?? user.roleStarCount ?? 0,
                              );
                              return !(
                                u.statusModeName === "Çatıda" &&
                                Number(currentUserStarCount || 0) < targetStarCount
                              );
                            }),
                        );
                        return (
                          <div
                            key={item.id}
                            className="chat-theme-user-card chat-theme-user-card--theme-gif chat-theme-user-card--friends relative overflow-hidden flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-3 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all"
                            onClick={() => handleUserClick(mappedUser)}
                          >
                            {userGifPath && isFlameGif && !isMaskedUser && (
                              <img
                                src={userGifPath}
                                alt="user gif"
                                className="pointer-events-none absolute inset-0 z-0 h-full w-full object-fill mix-blend-multiply opacity-82 saturate-115 contrast-105"
                              />
                            )}
                            {userGifPath &&
                              isDoveGif &&
                              !isMaskedUser &&
                              renderWanderingButterflies(userGifPath)}
                            {userGifPath &&
                              isBalloonGif &&
                              !isMaskedUser &&
                              renderFloatingBalloon(userGifPath)}
                            {userGifPath &&
                              isRoseGif &&
                              !isMaskedUser &&
                              renderRoseShower(userGifPath)}
                            {userGifPath &&
                              isYearbasiGif &&
                              !isMaskedUser &&
                              renderYearbasiFrame(userGifPath)}
                            <div className="relative z-10 h-11 w-11 shrink-0">
                              {userGifPath &&
                                !isFlameGif &&
                                !isFlagGif &&
                                !isDoveGif &&
                                !isRoseGif &&
                                !isYearbasiGif &&
                                !isHeartGif &&
                                !isBalloonGif &&
                                !isMaskedUser && (
                                <img
                                  src={userGifPath}
                                  alt="user gif"
                                  className="pointer-events-none absolute inset-0 h-full w-full scale-[1.5] object-cover"
                                />
                              )}
                              {resolvedFrame && !isMaskedUser && (
                                <img
                                  src={resolvedFrame.replace(/\.png$/i, ".gif")}
                                  alt="frame"
                                  className="pointer-events-none absolute inset-0 z-20 h-full w-full object-contain scale-110"
                                />
                              )}
                              <div
                                className={`absolute inset-1 z-0 rounded-full flex items-center justify-center text-white font-semibold overflow-hidden ${
                                  resolvedIcon?.startsWith("data:")
                                    ? "bg-white"
                                    : isMale
                                      ? "bg-linear-to-br from-blue-500 to-blue-600"
                                      : "bg-linear-to-br from-pink-500 to-pink-600"
                                }`}
                              >
                                {resolvedIcon ? (
                                  <img
                                    src={resolvedIcon}
                                    alt="icon"
                                    className="h-full w-full object-cover bg-white"
                                  />
                                ) : (
                                  getAvatarInitial(mappedUser)
                                )}
                              </div>
                              {userGifPath && isFlagGif && !isMaskedUser && (
                                <img
                                  src={userGifPath}
                                  alt="user gif"
                                  className="pointer-events-none absolute -right-1 -top-3 h-4.5 w-6.5 object-contain"
                                />
                              )}
                              {userGifPath && isDoveGif && !isMaskedUser && (
                                <></>
                              )}
                              {userGifPath && isRoseGif && !isMaskedUser && <></>}
                              {userGifPath &&
                                isYearbasiGif &&
                                !isMaskedUser && <></>}
                              {userGifPath && isHeartGif && !isMaskedUser && (
                                <img
                                  src={userGifPath}
                                  alt="user gif"
                                  className="pointer-events-none absolute left-1/2 -top-8 h-18 w-20 -translate-x-1/2 object-contain opacity-95"
                                />
                              )}
                            </div>
                            <div className="relative z-10 flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-zinc-900 truncate">
                                  {displayName}
                                </span>
                                {isMale ? (
                                  <Mars className="h-4 w-4 text-blue-500" />
                                ) : (
                                  <Venus className="h-4 w-4 text-pink-500" />
                                )}
                              </div>
                              {friendFilter === "friends" && isOnline && (
                                <div className="text-xs font-semibold text-green-600">
                                  Çevrimiçi
                                </div>
                              )}
                            </div>
                            {friendFilter === "incoming" ? (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() =>
                                    handleAcceptFriendRequest(item.id)
                                  }
                                  className="rounded-md bg-green-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-green-600"
                                >
                                  Kabul
                                </button>
                                <button
                                  onClick={() =>
                                    handleRejectFriendRequest(item.id)
                                  }
                                  className="rounded-md bg-zinc-200 px-2.5 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-300"
                                >
                                  Reddet
                                </button>
                              </div>
                            ) : friendFilter === "outgoing" ? (
                              <button
                                onClick={() =>
                                  handleCancelFriendRequest(item.id)
                                }
                                className="rounded-md bg-zinc-200 px-2.5 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-300"
                              >
                                İptal
                              </button>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-zinc-500">
                                  Arkadaş
                                </span>
                                <button
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    openRemoveFriendConfirm(
                                      item.id,
                                      user.username,
                                      user.agentNickname,
                                      displayName,
                                    );
                                  }}
                                  className="inline-flex h-7 w-7 items-center justify-center text-red-500 transition-colors hover:text-red-600"
                                  title="Arkadaşlıktan çıkar"
                                >
                                  <Heart className="h-4 w-4 fill-current" />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              )}
            </div>
          ) : activeTab === "wall" ? (
            <div className="space-y-3">
              {isGuestUser ? (
                <div className="rounded-xl border border-zinc-200 bg-white p-5 text-center text-sm text-zinc-600">
                  Duvar yazılarını görebilmek için üye olmalısınız.
                </div>
              ) : (
                <>
                  {wallLoading && (
                    <div className="flex items-center justify-center py-8 text-sm text-zinc-500">
                      Yükleniyor...
                    </div>
                  )}
                  {wallError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
                      {wallError}
                    </div>
                  )}
                  {!wallLoading &&
                    !wallError &&
                    filteredWallPosts.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-10 text-sm text-zinc-500">
                        Henüz paylaşım yok
                      </div>
                    )}
                  <div className="space-y-3">
                    {filteredWallPosts.map((post) => {
                      const wallCardTheme = getWallCardTheme(
                        post.backgroundColor,
                      );

                      return (
                      <div
                        key={post.id}
                        className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
                        style={
                          post.backgroundColor
                            ? { backgroundColor: post.backgroundColor }
                            : undefined
                        }
                      >
                        {(() => {
                          const canDeletePost =
                            post.user.id === currentUserId ||
                            canDeleteWallUserContent(post.user.starCount);
                          return (
                            <div className="mb-2 flex items-center justify-end">
                              {canDeletePost && (
                                <button
                                  onClick={() => handleDeleteWallPost(post.id)}
                                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50"
                                  title="Duvar yazısını sil"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          );
                        })()}
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-orange-500 text-white font-semibold">
                            {(() => {
                              const postUserIcon = resolveFriendIcon(
                                post.user.icon || null,
                              );
                              if (postUserIcon) {
                                return (
                                  <img
                                    src={postUserIcon}
                                    alt="avatar"
                                    className="h-full w-full object-cover bg-white"
                                  />
                                );
                              }
                              return post.user.username.charAt(0).toUpperCase();
                            })()}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p
                                className="text-sm font-semibold"
                                style={{ color: wallCardTheme.titleColor }}
                              >
                                {post.user.username}
                              </p>
                              {post.visibility === "staff" && (
                                <span
                                  className={wallCardTheme.staffBadgeClassName}
                                >
                                  <Lock className="h-3 w-3" />
                                  Yetkililer
                                </span>
                              )}
                            </div>
                            <p>
                              <span className={wallTimestampClassName}>
                                {formatWallTime(post.createdAt)}
                              </span>
                            </p>
                          </div>
                        </div>
                        {post.content && (
                          <p
                            className="mt-3 whitespace-pre-wrap text-sm"
                            style={{
                              color: wallCardTheme.bodyColor,
                              textShadow:
                                wallCardTheme.bodyColor === "#f8fafc"
                                  ? "0 1px 2px rgba(0, 0, 0, 0.45)"
                                  : "none",
                            }}
                          >
                            {post.content}
                          </p>
                        )}
                        {post.image && (
                          <div className="mt-3 flex h-56 w-full items-center justify-center overflow-hidden rounded-xl border border-zinc-200 bg-zinc-950/[0.03] sm:h-64">
                            <img
                              src={post.image}
                              alt="Duvar görseli"
                              className="h-full w-full object-contain"
                            />
                          </div>
                        )}
                        <div
                          className="mt-3 flex items-center gap-3 text-xs"
                          style={{ color: wallCardTheme.actionColor }}
                        >
                          <button
                            onClick={() => handleToggleWallLike(post.id)}
                            className="flex items-center gap-1 transition-colors"
                            style={{
                              color: post.isLiked
                                ? "#dc2626"
                                : wallCardTheme.actionColor,
                            }}
                          >
                            <Heart
                              className="h-4 w-4"
                              fill={post.isLiked ? "currentColor" : "none"}
                            />
                            <span>{post.likeCount}</span>
                          </button>
                          <button
                            onClick={() => handleToggleComments(post.id)}
                            className="flex items-center gap-1 transition-colors"
                            style={{ color: wallCardTheme.actionColor }}
                          >
                            <MessageSquare
                              className="h-4 w-4"
                              style={{ color: wallCardTheme.mutedColor }}
                            />
                            <span>{post.commentCount}</span>
                          </button>
                        </div>
                        {openWallComments.has(post.id) && (
                          <div className="mt-3 space-y-3">
                            <div className="space-y-2 rounded-xl bg-zinc-50 p-3">
                              {wallCommentsLoading[post.id] ? (
                                <p className="text-xs text-zinc-500">
                                  Yorumlar yükleniyor...
                                </p>
                              ) : wallComments[post.id]?.length ? (
                                wallComments[post.id].map((comment) => (
                                  <div
                                    key={comment.id}
                                    className="flex items-start gap-2"
                                  >
                                    <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-zinc-200 text-[11px] font-semibold text-zinc-700">
                                      {(() => {
                                        const commentDisplayName =
                                          getProfileCommentDisplayName(comment.user);
                                        const commentUserIcon = comment.user.agentNickname
                                          ? null
                                          : resolveFriendIcon(
                                              comment.user.icon || null,
                                            );
                                        if (commentUserIcon) {
                                          return (
                                            <img
                                              src={commentUserIcon}
                                              alt={`${commentDisplayName} avatar`}
                                              className="h-full w-full object-cover bg-white"
                                            />
                                          );
                                        }
                                        return commentDisplayName.charAt(0).toUpperCase();
                                      })()}
                                    </div>
                                    <div className="flex-1">
                                      <div className="flex items-center justify-between gap-2 text-xs text-zinc-600">
                                        <div className="flex items-center gap-2">
                                          <span className="font-semibold text-zinc-800">
	                                      {getProfileCommentDisplayName(comment.user)}
                                          </span>
                                          <span
                                            className={wallTimestampClassName}
                                          >
                                            {formatWallTime(comment.createdAt)}
                                          </span>
                                        </div>
                                        {(comment.user.id === currentUserId ||
                                          canDeleteWallUserContent(
                                            comment.user.starCount,
                                          )) && (
                                          <button
                                            onClick={() =>
                                              handleDeleteWallComment(
                                                post.id,
                                                comment.id,
                                              )
                                            }
                                            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold text-red-600 hover:bg-red-100"
                                            title="Yorumu sil"
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </button>
                                        )}
                                      </div>
                                      <p className="text-sm text-zinc-700">
                                        {comment.content}
                                      </p>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <p className="text-xs text-zinc-500">
                                  Henüz yorum yok
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={wallCommentInputs[post.id] || ""}
                                onChange={(e) =>
                                  setWallCommentInputs((prev) => ({
                                    ...prev,
                                    [post.id]: e.target.value,
                                  }))
                                }
                                placeholder="Yorum yaz..."
                                className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                              />
                              <button
                                onClick={() => handleSubmitComment(post.id)}
                                className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                              >
                                Gönder
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                    })}
                  </div>
                </>
              )}
            </div>
          ) : activeTab === "all" ? (
            // Tüm Kişiler (Aktif Tenant Kullanıcıları)
            hasReceivedTenantSnapshot &&
            activeTenantUsers.length === 0 &&
            activeTenantUserCount === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-linear-to-br from-blue-500 to-purple-600 text-white shadow-lg">
                  <UserRound className="h-10 w-10" />
                </div>
                <h3 className="text-lg font-semibold text-zinc-900 mb-2">
                  Aktif Kullanıcılar
                </h3>
                <p className="text-3xl font-bold text-blue-600 mb-1">
                  {activeTenantUserCount}
                </p>
                <p className="text-sm text-zinc-500">
                  {env.tenantId ? `${env.tenantId} ` : ""}sitesinde aktif
                </p>
                <div className="mt-6 w-full max-w-xs">
                  <div className="flex items-center justify-between text-xs text-zinc-600 mb-2">
                    <span>Son güncelleme</span>
                    <span className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      Canlı
                    </span>
                  </div>
                  <div className="h-1 w-full bg-zinc-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-linear-to-r from-blue-500 to-purple-600 rounded-full animate-pulse"
                      style={{ width: "100%" }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              // Kullanıcı Listesi
              (() => {
                if (filteredAllUsers.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
                        <UserRound className="h-6 w-6" />
                      </div>
                      <p className="text-sm text-zinc-500">
                        {searchQuery.trim()
                          ? "Kullanıcı bulunamadı"
                          : "Aktif kullanıcı yok"}
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-1">
                    {filteredAllUsers.map((user) => {
                      const isMale = user.gender === "male";
                      const isMaskedUser = isAgentMaskedUser(user);
                      const selfIcon =
                        user.username === currentUsername
                          ? getImmediateSelfIcon()
                          : null;
                      const resolvedIcon = resolveFriendIcon(
                        selfIcon || user.icon || null,
                      );
                      const frameUrl =
                        user.frame?.replace(/\.png$/i, ".gif") || user.frame;
                      const userGifPath = resolveUserGifPath(user.userGif || null);
                      const isFlameGif = isFlameUserGif(userGifPath);
                      const isFlagGif = isFlagUserGif(userGifPath);
                      const isDoveGif = isDoveUserGif(userGifPath);
                      const isFlyGif = isFlyUserGif(userGifPath);
                      const isRoseGif = isRoseUserGif(userGifPath);
                      const isYearbasiGif = isYearbasiUserGif(userGifPath);
                      const isHeartGif = isHeartUserGif(userGifPath);
                      const isBalloonGif = isBalloonUserGif(userGifPath);
                      const isSpeaking = speakingUsers.has(user.username);
                      const speakingBorderClass = isSpeaking
                        ? isMale
                          ? "ring-2 ring-blue-500 ring-offset-1 animate-pulse"
                          : "ring-2 ring-pink-500 ring-offset-1 animate-pulse"
                        : "";
                      const { showGlobalMutedIcon, showMicBannedIcon } =
                        resolveDisplayedMuteState(user, user);
                      const selfMutedIconClass = isMale
                        ? "text-blue-500"
                        : "text-pink-500";
                      const roleDisplayUser = getRoleDisplayUser(user);
                      const hideRoleFallback = shouldHideRoleForUser(user);
                      const { Icon: DeviceIcon, title: deviceTitle } =
                        resolveUserDevice(user);
                      const relation = getFriendRelation(
                        user.username,
                        user.agentNickname,
                      );

                      return (
                        <div
                          key={getUserRenderKey(user)}
                          onClick={() => handleUserClick(user)}
                          className={`chat-theme-user-card chat-theme-user-card--all relative overflow-hidden flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-2 py-1.5 cursor-pointer transition-all hover:border-blue-300 hover:shadow-sm ${speakingBorderClass}`}
                        >
                          {userGifPath && isFlameGif && !isMaskedUser && (
                            <img
                              src={userGifPath}
                              alt="user gif"
                              className="pointer-events-none absolute inset-0 z-0 h-full w-full object-fill mix-blend-multiply opacity-82 saturate-115 contrast-105"
                            />
                          )}
                          {userGifPath &&
                            isDoveGif &&
                            !isMaskedUser &&
                            renderWanderingButterflies(userGifPath)}
                          {userGifPath &&
                            isBalloonGif &&
                            !isMaskedUser &&
                            renderFloatingBalloon(userGifPath)}
                          {userGifPath &&
                            isRoseGif &&
                            !isMaskedUser &&
                            renderRoseShower(userGifPath)}
                          {userGifPath &&
                            isYearbasiGif &&
                            !isMaskedUser &&
                            renderYearbasiFrame(userGifPath)}
                          <div className="relative z-10 h-12 w-12 shrink-0">
                            {userGifPath &&
                              !isFlameGif &&
                              !isFlagGif &&
                              !isDoveGif &&
                              !isFlyGif &&
                              !isRoseGif &&
                              !isYearbasiGif &&
                              !isHeartGif &&
                              !isBalloonGif &&
                              !isMaskedUser && (
                              <img
                                src={userGifPath}
                                alt="user gif"
                                className="pointer-events-none absolute inset-0 h-full w-full scale-[1.5] object-cover"
                              />
                            )}
                            {frameUrl && !isMaskedUser && (
                              <img
                                src={frameUrl}
                                alt="frame"
                                className="pointer-events-none absolute inset-0 z-20 h-full w-full object-contain scale-110"
                              />
                            )}
                            <div
                              className={`absolute inset-1 z-0 rounded-full flex items-center justify-center text-white font-semibold overflow-hidden ${
                                !isMaskedUser && resolvedIcon?.startsWith("data:")
                                  ? "bg-white"
                                  : isMale
                                    ? "bg-linear-to-br from-blue-500 to-blue-600"
                                    : "bg-linear-to-br from-pink-500 to-pink-600"
                              }`}
                            >
                              {resolvedIcon && !isMaskedUser ? (
                                <img
                                  src={resolvedIcon}
                                  alt="icon"
                                  className="h-full w-full object-cover bg-white"
                                />
                              ) : (
                                getAvatarInitial(user)
                              )}
                            </div>
                            {userGifPath && isFlagGif && !isMaskedUser && (
                              <img
                                src={userGifPath}
                                alt="user gif"
                                className="pointer-events-none absolute -right-1 -top-3 h-4.5 w-6.5 object-contain"
                              />
                            )}
                            {userGifPath && isDoveGif && !isMaskedUser && <></>}
                            {userGifPath && isRoseGif && !isMaskedUser && <></>}
                            {userGifPath &&
                              isYearbasiGif &&
                              !isMaskedUser && <></>}
                            {userGifPath && isHeartGif && !isMaskedUser && (
                              <img
                                src={userGifPath}
                                alt="user gif"
                                className="pointer-events-none absolute left-1/2 -top-8 h-18 w-20 -translate-x-1/2 object-contain opacity-95"
                              />
                            )}
                            {showGlobalMutedIcon && (
                              <Ban
                                className="absolute left-0 -bottom-2 z-30 h-3.5 w-3.5 text-red-600 drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)]"
                                aria-label="Tüm odalarda susturuldu"
                                role="img"
                              />
                            )}
                          </div>

                          <div className="relative z-10 min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-2 overflow-visible py-1">
                              <span className="text-[13px] font-semibold text-zinc-900">
                                {renderStyledUsername(user)}
                              </span>
                            </div>

                            {shouldShowGuestBadge(user) && (
                              <div className="flex items-center gap-1 text-xs text-zinc-600">
                                <span className="inline-flex items-center gap-1">
                                  Misafir
                                </span>
                              </div>
                            )}

                            <div className="relative flex flex-col gap-1 text-xs text-zinc-600">
                              {userGifPath && isFlyGif && !isMaskedUser && (
                                <img
                                  src={userGifPath}
                                  alt="user gif"
                                  className="pointer-events-none absolute left-10 -top-2 h-[60px] w-[60px] object-contain animate-bounce"
                                />
                              )}
                              {renderRoleBadge(roleDisplayUser, currentUserStarCount) ?? (
                                !hideRoleFallback && !shouldShowGuestBadge(user) ? (
                                  <span className="text-xs text-zinc-600">
                                    Üye
                                  </span>
                                ) : null
                              )}
                              {(showMicBannedIcon ||
                                (user.statusModeName &&
                                  !isHiddenRoofStatusForUser(user))) && (
                                <span className="relative inline-flex items-center text-xs text-zinc-500">
                                  {showMicBannedIcon && (
                                    <MicOff className="absolute -left-5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-red-500" />
                                  )}
                                  {user.statusModeName &&
                                  !isHiddenRoofStatusForUser(user)
                                    ? user.statusModeName
                                    : null}
                                </span>
                              )}
                            </div>
                          </div>

                          {user.rooms && user.rooms.length > 0 && (
                            <div className="absolute right-10 top-2 z-10 max-h-9 max-w-[96px] overflow-y-auto pr-0.5">
                              <div className="flex flex-wrap justify-end gap-0.5">
                                {user.rooms.map((room, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex max-w-full items-center rounded-full border border-[#b8dcf5] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(229,245,255,0.98)_100%)] px-2 py-px text-[10px] font-semibold leading-none text-[#236794] shadow-[0_3px_10px_rgba(113,180,214,0.18)]"
                                  >
                                    <span className="truncate">
                                      {resolveRoomDisplayName(
                                        room.roomKey,
                                        room.roomName,
                                      )}
                                    </span>
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="relative z-10 flex shrink-0 flex-col items-center gap-0.5 text-zinc-400">
                            {relation.type === "friends" && (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openRemoveFriendConfirm(
                                    relation.requestId,
                                    user.username,
                                    user.agentNickname,
                                    getDisplayUsername(user),
                                  );
                                }}
                                className="inline-flex h-5 w-5 items-center justify-center text-red-500 transition-colors hover:text-red-600"
                                title="Arkadaşlıktan çıkar"
                                aria-label="Arkadaşlıktan çıkar"
                              >
                                <Heart className="h-4 w-4 fill-current" />
                              </button>
                            )}
                            {isMale ? (
                              <Mars className="h-4 w-4 text-blue-500 shrink-0" />
                            ) : (
                              <Venus className="h-4 w-4 text-pink-500 shrink-0" />
                            )}
                            <DeviceIcon
                              className="h-4 w-4 text-zinc-400"
                              aria-label={deviceTitle}
                              role="img"
                            />
                            {user.isCameraOn && (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void openCameraViewer(user);
                                }}
                                className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100"
                                title={`${user.username} kamerasını izle`}
                              >
                                <Video className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {user.isInVoiceChat && !user.isMuted && (
                              <Mic
                                className={`h-4 w-4 ${
                                  isMale ? "text-blue-500" : "text-pink-500"
                                }`}
                              />
                            )}
                            {user.isInVoiceChat && (
                              <Wifi className="h-4 w-4 text-green-500" />
                            )}
                            {user.cameraBanned && (
                              <VideoOff className="h-4 w-4 text-red-500" />
                            )}
                            {user.isInVoiceChat &&
                              user.isMuted &&
                              !showMicBannedIcon && (
                                <MicOff
                                  className={`h-4 w-4 ${selfMutedIconClass}`}
                                />
                              )}
                            {user.isHandRaised && (
                              <Hand className="h-4 w-4 text-amber-700" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()
            )
          ) : activeTab === "rooms" ? (
            // Rooms List
            isLoadingRooms ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-gray-600">Odalar yükleniyor...</p>
                </div>
              </div>
            ) : filteredRooms.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-sm text-gray-500">
                  {searchQuery
                    ? "Arama sonucu bulunamadı"
                    : "Henüz oda bulunmamaktadır"}
                </p>
              </div>
            ) : (
              (() => {
                const normalize = (name: string | undefined | null) =>
                  (name || "")
                    .toLocaleLowerCase("tr-TR")
                    .replace(/\s+/g, " ")
                    .trim();
                const specialNames = new Set([
                  "sorunlar",
                  "sorunlar odası",
                  "toplantı odası",
                  "başvuru odası",
                ]);
                const specialRooms = filteredRooms.filter((room) =>
                  specialNames.has(normalize(room.name)),
                );
                const displayedRooms = filteredRooms.filter(
                  (room) => !specialNames.has(normalize(room.name)),
                );

                const renderRoomCard = (room: Room) => {
                  const roomKey = String(room.voiceId || room.name);
                  const roomImageUrl = getRoomLogoUrl(
                    room.logo,
                    room.updatedAt,
                  );
                  const { value: liveCount } = getLiveCount(roomKey);
                  return (
                    <div
                      key={room.id}
                      onClick={() => handleRoomClick(room)}
                      className="flex items-start gap-3 rounded-xl p-3 bg-white border border-zinc-200 hover:border-red-400 hover:shadow-sm cursor-pointer transition-all group"
                    >
                      {/* Room Avatar with initials */}
                      <div className="relative shrink-0">
                        <div className="w-10 h-10 rounded-lg bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                          {roomImageUrl ? (
                            <img
                              src={roomImageUrl}
                              alt={room.name}
                              className="w-full h-full object-cover rounded-lg"
                            />
                          ) : (
                            room.name.substring(0, 2).toUpperCase()
                          )}
                        </div>
                      </div>

                      {/* Room Info */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-gray-900 truncate">
                            {room.name}
                          </span>
                          <div className="flex items-center gap-1 text-xs text-gray-500 shrink-0">
                            <svg
                              className="w-3.5 h-3.5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                              />
                            </svg>
                            <span>{liveCount === null ? "—" : liveCount}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-gray-500 truncate">
                            {room.description || "Derya ile sohbet"}
                          </p>
                          {room.minStar > 0 && (
                            <div className="flex items-center gap-1 shrink-0">
                              <svg
                                className="w-3 h-3 text-yellow-500"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                              <span className="text-xs text-gray-600">
                                {room.minStar}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="text-[10px] font-bold uppercase tracking-tight flex items-center gap-1">
                          {room.isPrivate ? (
                            <span className="bg-red-600 text-white px-1.5 py-0.5 rounded inline-flex items-center gap-1">
                              Şifreli Oda
                              <Lock className="h-2.5 w-2.5 shrink-0" />
                            </span>
                          ) : (
                            <span className="bg-red-600 text-white px-1.5 py-0.5 rounded">
                              Herkese Açık
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-400">
                          Sahibi: {room.owner?.username || "ROOT"}
                        </div>
                      </div>
                    </div>
                  );
                };

                return (
                  <>
                    {specialRooms.length > 0 && (
                      <div className="mb-4 grid grid-cols-3 gap-3">
                        {["sorunlar", "başvuru odası", "toplantı odası"]
                          .map((key) =>
                            specialRooms.find((r) => normalize(r.name) === key),
                          )
                          .filter(Boolean)
                          .map((room) => {
                            const roomKey = String(room!.voiceId || room!.name);
                            const roomImageUrl = getRoomLogoUrl(
                              room!.logo,
                              room!.updatedAt,
                            );
                            const { value: liveCount } = getLiveCount(roomKey);
                            return (
                              <button
                                key={`special-${room!.id}`}
                                onClick={() => handleRoomClick(room!)}
                                className="flex w-full flex-col items-center gap-2 rounded-xl border border-zinc-200 bg-white py-4 px-2 text-center shadow-sm transition-all hover:border-red-400 hover:shadow-md hover:-translate-y-0.5 active:scale-95"
                              >
                                <div className="h-12 w-12 overflow-hidden rounded-full border border-zinc-200 shadow-sm shrink-0">
                                  {roomImageUrl ? (
                                    <img
                                      src={roomImageUrl}
                                      alt={room!.name}
                                      className="h-full w-full object-cover"
                                      onError={(e) => {
                                        const target =
                                          e.target as HTMLImageElement;
                                        target.style.display = "none";
                                        const parent = target.parentElement;
                                        if (parent) {
                                          parent.className =
                                            "flex h-12 w-12 items-center justify-center bg-linear-to-br from-blue-500 to-purple-600 text-white font-bold text-xs rounded-full border border-zinc-200 shadow-sm";
                                          parent.innerText = (
                                            room!.name || "??"
                                          )
                                            .substring(0, 2)
                                            .toUpperCase();
                                        }
                                      }}
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-blue-500 to-purple-600 text-white font-semibold text-xs text-center">
                                      {room!.name.substring(0, 2).toUpperCase()}
                                    </div>
                                  )}
                                </div>
                                <span className="text-[10px] font-bold text-zinc-900 line-clamp-1">
                                  {room!.name}
                                </span>
                                <span className="text-[9px] text-zinc-500">
                                  {liveCount === null ? "—" : liveCount} kişi
                                </span>
                              </button>
                            );
                          })}
                      </div>
                    )}
                    {displayedRooms.map(renderRoomCard)}
                  </>
                );
              })()
            )
          ) : (
            // User List (compact, aligned)
            (() => {
              const safeUsers =
                Array.isArray(resolvedVisibleRoomUsers) &&
                resolvedVisibleRoomUsers.length > 0
                  ? resolvedVisibleRoomUsers
                  : mobileRoomOnly && Array.isArray(users)
                    ? users
                    : [];
              const normalizedSearchQuery = searchQuery
                .trim()
                .toLocaleLowerCase("tr-TR");
              const searchableUsers = normalizedSearchQuery
                ? safeUsers.filter((user) => {
                    const guestAliasActive = hasActiveGuestAlias(user);
                    const username = guestAliasActive
                      ? ""
                      : String(user.username || "").toLocaleLowerCase("tr-TR");
                    const displayUsername = String(
                      user.displayUsername || "",
                    ).toLocaleLowerCase("tr-TR");
                    const agentNickname = String(
                      user.agentNickname || "",
                    ).toLocaleLowerCase("tr-TR");
                    return (
                      username.includes(normalizedSearchQuery) ||
                      displayUsername.includes(normalizedSearchQuery) ||
                      agentNickname.includes(normalizedSearchQuery)
                    );
                  })
                : safeUsers;
              const orderedUsers = [...searchableUsers].sort((a, b) => {
                // 1. Mikrofonu açık olanlar her zaman üstte
                const aMicOpen = a.isInVoiceChat && !a.isMuted;
                const bMicOpen = b.isInVoiceChat && !b.isMuted;

                if (aMicOpen && !bMicOpen) return -1;
                if (!aMicOpen && bMicOpen) return 1;

                // 2. Mikrofonu kapalı olanlar arasında el kaldıranlar üste
                if (!aMicOpen && !bMicOpen) {
                  if (a.isHandRaised && !b.isHandRaised) return -1;
                  if (!a.isHandRaised && b.isHandRaised) return 1;
                  if (a.isHandRaised && b.isHandRaised) {
                    return (
                      (a.handRaisedAt ?? 0) - (b.handRaisedAt ?? 0) ||
                      a.username.localeCompare(b.username)
                    );
                  }
                }

                // 3. Alfabetik sıralama (stabil)
                return a.username.localeCompare(b.username);
              });

              return (
                <>
                  {orderedUsers.length === 0 && (
                    <div className="flex items-center justify-center rounded-xl bg-white px-4 py-8 text-sm font-medium text-zinc-500">
                      {normalizedSearchQuery
                        ? "Kullanıcı bulunamadı"
                        : "Oda kişileri yükleniyor..."}
                    </div>
                  )}
                  {orderedUsers.map((user) => {
                    const isMale = user.gender === "male";
                    const isMaskedUser = isAgentMaskedUser(user);
                    const { Icon: DeviceIcon, title: deviceTitle } =
                      resolveUserDevice(user);
                    const frameUrl =
                      user.frame?.replace(/\.png$/i, ".gif") || user.frame;
                    // Küresel listeden en güncel ikonu/gif'i al
                    const globalUser = activeTenantUsers.find(
                      (u) => u.username === user.username,
                    );
                    const userGifPath = resolveUserGifPath(
                      globalUser?.userGif || user.userGif || null,
                    );
                    const isFlameGif = isFlameUserGif(userGifPath);
                    const isFlagGif = isFlagUserGif(userGifPath);
                    const isDoveGif = isDoveUserGif(userGifPath);
                    const isFlyGif = isFlyUserGif(userGifPath);
                    const isRoseGif = isRoseUserGif(userGifPath);
                    const isYearbasiGif = isYearbasiUserGif(userGifPath);
                    const isHeartGif = isHeartUserGif(userGifPath);
                    const isBalloonGif = isBalloonUserGif(userGifPath);
                    const isSpeaking = speakingUsers.has(user.username);
                    const speakingBorderClass = isSpeaking
                      ? isMale
                        ? "ring-2 ring-blue-500 ring-offset-1 animate-pulse"
                        : "ring-2 ring-pink-500 ring-offset-1 animate-pulse"
                      : "";
                    const selfIcon =
                      user.username === currentUsername
                        ? getImmediateSelfIcon()
                        : null;
                    const currentIcon = resolveFriendIcon(
                      selfIcon || globalUser?.icon || user.icon || null,
                    );
                    const moderationOverrideForIcon = getModerationOverride(
                      user.username,
                    );
                    const fallbackGlobalUser =
                      moderationOverrideForIcon?.globalMuted !== undefined
                        ? null
                        : globalUser;
                    const { showGlobalMutedIcon, showMicBannedIcon } =
                      resolveDisplayedMuteState(user, fallbackGlobalUser);
                    const selfMutedIconClass = isMale
                      ? "text-blue-500"
                      : "text-pink-500";
                    const roleDisplayUser = getRoleDisplayUser(user);
                    const hideRoleFallback = shouldHideRoleForUser(user);
                    return (
                      <div
                        key={getUserRenderKey(user)}
                        onClick={() => handleUserClick(user)}
                        className={`relative overflow-hidden flex items-center gap-1.5 border border-zinc-200 bg-white hover:border-blue-400 hover:shadow-sm transition-all cursor-pointer ${
                          mobileRoomOnly
                            ? "min-h-[56px] rounded-[10px] px-2 py-1"
                            : "rounded-xl py-1.5 px-2"
                        } ${speakingBorderClass}`}
                      >
                        {userGifPath && isFlameGif && !isMaskedUser && (
                          <img
                            src={userGifPath}
                            alt="user gif"
                            className="pointer-events-none absolute inset-0 z-0 h-full w-full object-fill mix-blend-multiply opacity-82 saturate-115 contrast-105"
                          />
                        )}
                        {userGifPath &&
                          isDoveGif &&
                          !isMaskedUser &&
                          renderWanderingButterflies(userGifPath)}
                        {userGifPath &&
                          isBalloonGif &&
                          !isMaskedUser &&
                          renderFloatingBalloon(userGifPath)}
                        {userGifPath &&
                          isRoseGif &&
                          !isMaskedUser &&
                          renderRoseShower(userGifPath)}
                        {userGifPath &&
                          isYearbasiGif &&
                          !isMaskedUser &&
                          renderYearbasiFrame(userGifPath)}
                        <div
                          className={`relative z-10 shrink-0 ${
                            mobileRoomOnly ? "h-9 w-9" : "h-12 w-12"
                          }`}
                        >
                          {userGifPath &&
                            !isFlameGif &&
                            !isFlagGif &&
                            !isDoveGif &&
                            !isFlyGif &&
                            !isRoseGif &&
                            !isYearbasiGif &&
                            !isHeartGif &&
                            !isBalloonGif &&
                            !isMaskedUser && (
                            <img
                              src={userGifPath}
                              alt="user gif"
                              className="pointer-events-none absolute inset-0 h-full w-full scale-[1.5] object-contain"
                            />
                          )}
                          {frameUrl && !isMaskedUser && (
                            <img
                              src={frameUrl}
                              alt="frame"
                              className="pointer-events-none absolute inset-0 z-20 h-full w-full object-contain scale-110"
                            />
                          )}
                          <div
                            className={`absolute inset-1 z-0 rounded-full flex items-center justify-center text-white font-semibold overflow-hidden ${
                              !isMaskedUser && currentIcon?.startsWith("data:")
                                ? "bg-white"
                                : isMale
                                  ? "bg-linear-to-br from-blue-500 to-blue-600"
                                  : "bg-linear-to-br from-pink-500 to-pink-600"
                            }`}
                          >
                            {currentIcon && !isMaskedUser ? (
                              <img
                                src={currentIcon}
                                alt="icon"
                                className="h-full w-full object-cover bg-white"
                              />
                            ) : (
                              getAvatarInitial(user)
                            )}
                          </div>
                          {userGifPath && isFlagGif && !isMaskedUser && (
                            <img
                              src={userGifPath}
                              alt="user gif"
                              className={`pointer-events-none absolute -right-1 object-contain ${
                                mobileRoomOnly
                                  ? "-top-2 h-3.5 w-5.5"
                                  : "-top-3 h-4.5 w-6.5"
                              }`}
                            />
                          )}
                          {userGifPath && isDoveGif && !isMaskedUser && <></>}
                          {userGifPath && isRoseGif && !isMaskedUser && <></>}
                          {userGifPath &&
                            isYearbasiGif &&
                            !isMaskedUser && <></>}
                          {userGifPath && isHeartGif && !isMaskedUser && (
                            <img
                              src={userGifPath}
                              alt="user gif"
                              className={`pointer-events-none absolute left-1/2 -translate-x-1/2 object-contain opacity-95 ${
                                mobileRoomOnly
                                  ? "-top-5 h-12 w-14"
                                  : "-top-8 h-18 w-20"
                              }`}
                            />
                          )}
                          {showGlobalMutedIcon && (
                            <Ban
                              className="absolute left-0 -bottom-2 z-30 h-3.5 w-3.5 text-red-600 drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)]"
                              aria-label="Tüm odalarda susturuldu"
                              role="img"
                            />
                          )}
                        </div>

                        <div
                          className={`relative z-10 flex-1 min-w-0 ${
                            mobileRoomOnly ? "space-y-0.5" : "space-y-1"
                          }`}
                        >
                          <div
                            className={`flex items-center gap-2 overflow-visible ${
                              mobileRoomOnly ? "py-0.5" : "py-1"
                            }`}
                          >
                            <span
                              className={`font-semibold text-zinc-900 ${
                                mobileRoomOnly ? "text-[14px]" : "text-[13px]"
                              }`}
                            >
                              {renderStyledUsername(user)}
                            </span>
                          </div>

                          {shouldShowGuestBadge(user) && (
                            <div className="flex items-center gap-1 text-xs text-zinc-600">
                              <span className="inline-flex items-center gap-1">
                                Misafir
                              </span>
                            </div>
                          )}

                          <div
                            className={`relative flex flex-col gap-1 text-zinc-600 ${
                              mobileRoomOnly ? "text-[12px]" : "text-xs"
                            }`}
                          >
                            {userGifPath && isFlyGif && !isMaskedUser && (
                              <img
                                src={userGifPath}
                                alt="user gif"
                                className="pointer-events-none absolute left-10 -top-2 h-[60px] w-[60px] object-contain animate-bounce"
                              />
                            )}
                            {renderRoleBadge(roleDisplayUser) ?? (
                              !hideRoleFallback && !shouldShowGuestBadge(user) ? (
                                <span className="text-xs text-zinc-600">
                                  Üye
                                </span>
                              ) : null
                            )}
                            {(showMicBannedIcon || user.statusModeName) && (
                                <span
                                  className={`relative inline-flex items-center text-zinc-500 ${
                                    mobileRoomOnly ? "text-[12px]" : "text-xs"
                                  }`}
                                >
                                {showMicBannedIcon && (
                                  <MicOff className="absolute -left-5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-red-500" />
                                )}
                                {user.statusModeName}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="relative z-10 flex shrink-0 flex-col items-center gap-0.5 text-zinc-400">
                          {isMale ? (
                            <Mars
                              className={`text-blue-500 shrink-0 ${
                                mobileRoomOnly ? "h-3.5 w-3.5" : "h-4 w-4"
                              }`}
                            />
                          ) : (
                            <Venus
                              className={`text-pink-500 shrink-0 ${
                                mobileRoomOnly ? "h-3.5 w-3.5" : "h-4 w-4"
                              }`}
                            />
                          )}
                          <DeviceIcon
                            className={mobileRoomOnly ? "h-3.5 w-3.5" : "h-4 w-4"}
                            aria-label={deviceTitle}
                            role="img"
                          />
                          {user.isCameraOn && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                void openCameraViewer(user);
                              }}
                              className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100"
                              title={`${user.username} kamerasını izle`}
                            >
                              <Video
                                className={
                                  mobileRoomOnly ? "h-3 w-3" : "h-3.5 w-3.5"
                                }
                              />
                            </button>
                          )}
                          {user.isInVoiceChat && !user.isMuted && (
                            <Mic
                              className={`${mobileRoomOnly ? "h-3.5 w-3.5" : "h-4 w-4"} ${
                                isMale ? "text-blue-500" : "text-pink-500"
                              }`}
                            />
                          )}
                          {user.isInVoiceChat && (
                            <Wifi
                              className={`text-green-500 ${
                                mobileRoomOnly ? "h-3.5 w-3.5" : "h-4 w-4"
                              }`}
                            />
                          )}
                          {user.cameraBanned && (
                            <VideoOff
                              className={`text-red-500 ${
                                mobileRoomOnly ? "h-3.5 w-3.5" : "h-4 w-4"
                              }`}
                            />
                          )}
                          {user.isInVoiceChat &&
                            user.isMuted &&
                            !showMicBannedIcon && (
                              <MicOff
                                className={`${mobileRoomOnly ? "h-3.5 w-3.5" : "h-4 w-4"} ${selfMutedIconClass}`}
                              />
                            )}
                          {user.isHandRaised && (
                            <Hand
                              className={`text-amber-700 ${
                                mobileRoomOnly ? "h-3.5 w-3.5" : "h-4 w-4"
                              }`}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </>
              );
            })()
          )}
        </div>
          </>
        )}
      </div>

      {activeTab === "wall" && !isGuestUser && (
        <div className="border-t border-zinc-200 bg-zinc-100 px-3 py-3">
          <button
            onClick={() => setShowWallModal(true)}
            className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-left text-sm text-zinc-500 shadow-sm hover:border-blue-300 hover:text-zinc-700"
          >
            Ne düşünüyorsun?
          </button>
        </div>
      )}
        </>
      )}

      {cameraViewerUser && (
        <div
          className="fixed bottom-24 right-4 z-[70] w-[250px] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl sm:w-[280px]"
          style={{
            transform: `translate(${cameraViewerPos.x}px, ${cameraViewerPos.y}px)`,
          }}
        >
            <div
              className="flex cursor-move select-none items-center justify-between border-b border-zinc-200 px-3 py-2"
              onMouseDown={(event) => {
                const target = event.target as HTMLElement;
                if (target.closest("button")) return;
                event.preventDefault();
                cameraViewerDragStartRef.current = {
                  x: event.clientX,
                  y: event.clientY,
                };
                setIsDraggingCameraViewer(true);
              }}
            >
              <h3 className="text-sm font-semibold text-zinc-900">
                {cameraViewerUser.username} - Kamera
              </h3>
              <button
                type="button"
                onClick={() => {
                  void closeCameraViewer();
                }}
                className="rounded-full p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
                aria-label="Kamera penceresini kapat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-3">
              <div
                ref={cameraViewerContainerRef}
                className="h-40 w-full rounded-lg bg-zinc-100"
              />
              {cameraViewerError && (
                <p className="mt-2 text-xs text-red-600">{cameraViewerError}</p>
              )}
            </div>
        </div>
      )}

      {selectedStoryPost && (
        <div className="fixed inset-0 z-[70] bg-black text-white">
          {(() => {
            const storyImage = selectedStoryPost.image
              ? resolveMediaUrl(selectedStoryPost.image)
              : null;
            const storyBackground =
              selectedStoryPost.backgroundColor ||
              "linear-gradient(135deg, #111827, #0f766e)";
            const storyOwnerIcon =
              resolveFriendIcon(selectedStoryPost.user.icon || "") ||
              selectedStoryPost.user.icon;
            const isOwnStory = selectedStoryPost.user.id === currentUserId;
            const storyComments = wallComments[selectedStoryPost.id] || [];
            const storyCommentsAreLoading =
              Boolean(wallCommentsLoading[selectedStoryPost.id]);
            const storyCommentInput =
              wallCommentInputs[selectedStoryPost.id] || "";

            return (
              <div
                className="relative flex h-full w-full flex-col overflow-hidden"
                style={{ background: storyImage ? "#000" : storyBackground }}
              >
                {storyImage ? (
                  <img
                    src={storyImage}
                    alt={selectedStoryPost.content || selectedStoryPost.user.username}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : null}
                <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/10 to-black/70" />

                <div className="relative z-10 flex shrink-0 items-center gap-3 px-4 pb-3 pt-[max(14px,env(safe-area-inset-top))]">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedStoryPost(null);
                      setSelectedStoryViews([]);
                      setStoryViewCount(0);
                      setStoryViewersOpen(false);
                      setSelectedStoryPanel(null);
                      setSelectedStoryGroupPosts([]);
                      setSelectedStoryIndex(0);
                    }}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-black/25 text-white active:bg-black/40"
                    aria-label="Story kapat"
                  >
                    <X className="h-6 w-6" />
                  </button>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white/80 bg-zinc-700 text-sm font-black">
                    {storyOwnerIcon ? (
                      <img
                        src={storyOwnerIcon}
                        alt={selectedStoryPost.user.username}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      selectedStoryPost.user.username.charAt(0).toUpperCase()
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[16px] font-extrabold">
                      {selectedStoryPost.user.username}
                    </div>
                    <div className="text-[12px] font-medium text-white/70">
                      {formatWallTime(selectedStoryPost.createdAt)}
                    </div>
                  </div>
                  {isOwnStory ||
                  canDeleteWallUserContent(selectedStoryPost.user.starCount) ? (
                    <button
                      type="button"
                      onClick={() => {
                        void handleDeleteWallPost(selectedStoryPost.id);
                      }}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/90 text-white active:bg-red-600"
                      aria-label="Durumu sil"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  ) : null}
                </div>

                <div className="relative z-10 flex shrink-0 gap-1 px-4 pb-2">
                  {(selectedStoryGroupPosts.length
                    ? selectedStoryGroupPosts
                    : [selectedStoryPost]
                  ).map((post, index) => (
                    <div
                      key={`story-progress-${post.id}`}
                      className="h-1 flex-1 overflow-hidden rounded-full bg-white/30"
                    >
                      <div
                        className={`h-full rounded-full ${
                          index <= selectedStoryIndex
                            ? "w-full bg-white"
                            : "w-0 bg-white"
                        }`}
                      />
                    </div>
                  ))}
                </div>

                <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center px-7 py-6">
                  {selectedStoryGroupPosts.length > 1 ? (
                    <>
                      <button
                        type="button"
                        onClick={() => navigateSelectedStory(-1)}
                        disabled={selectedStoryIndex === 0}
                        className="absolute inset-y-0 left-0 z-20 flex w-1/3 items-center justify-start pl-2 text-white disabled:pointer-events-none disabled:opacity-0"
                        aria-label="Önceki durum"
                      >
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/25 backdrop-blur-sm">
                          <ChevronLeft className="h-6 w-6" />
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => navigateSelectedStory(1)}
                        disabled={
                          selectedStoryIndex >=
                          selectedStoryGroupPosts.length - 1
                        }
                        className="absolute inset-y-0 right-0 z-20 flex w-1/3 items-center justify-end pr-2 text-white disabled:pointer-events-none disabled:opacity-0"
                        aria-label="Sonraki durum"
                      >
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/25 backdrop-blur-sm">
                          <ChevronRight className="h-6 w-6" />
                        </span>
                      </button>
                    </>
                  ) : null}
                  {storyImage ? (
                    selectedStoryPost.content ? (
                      <div className="max-h-full overflow-y-auto rounded-2xl bg-black/45 px-4 py-3 text-center text-[20px] font-bold leading-snug backdrop-blur-sm">
                        {selectedStoryPost.content}
                      </div>
                    ) : null
                  ) : (
                    <div className="max-h-full overflow-y-auto text-center text-[30px] font-extrabold leading-tight tracking-tight">
                      {selectedStoryPost.content || "Durum"}
                    </div>
                  )}
                </div>

                {selectedStoryPanel === null ? (
                  <div className="relative z-10 flex shrink-0 items-center justify-center gap-3 px-4 pb-[max(18px,env(safe-area-inset-bottom))]">
                    <button
                      type="button"
                      onClick={() =>
                        void showStoryPost(selectedStoryPost, "comments", {
                          groupPosts: selectedStoryGroupPosts,
                          groupIndex: selectedStoryIndex,
                        })
                      }
                      className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-zinc-800 shadow-lg backdrop-blur-md active:bg-white"
                      aria-label="Yorumları aç"
                    >
                      <MessageSquare className="h-5 w-5" />
                    </button>
                    {isOwnStory ? (
                      <button
                        type="button"
                        onClick={() =>
                          void showStoryPost(selectedStoryPost, "views", {
                            groupPosts: selectedStoryGroupPosts,
                            groupIndex: selectedStoryIndex,
                          })
                        }
                        className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-zinc-800 shadow-lg backdrop-blur-md active:bg-white"
                        aria-label="Görenleri aç"
                      >
                        <Eye className="h-5 w-5" />
                      </button>
                    ) : null}
                  </div>
                ) : null}

                {selectedStoryPanel === "comments" ? (
                <div
                  className="relative z-10 shrink-0 px-4 pb-[max(14px,env(safe-area-inset-bottom))]"
                  onTouchStart={(event) =>
                    setStoryPanelTouchStartY(event.touches[0]?.clientY ?? null)
                  }
                  onTouchEnd={(event) =>
                    handleStoryPanelTouchEnd(
                      event.changedTouches[0]?.clientY ?? 0,
                    )
                  }
                >
                  <div className="rounded-t-[24px] bg-white/95 p-3 text-zinc-950 shadow-2xl backdrop-blur-md">
                    <button
                      type="button"
                      onClick={closeStoryPanels}
                      className="mx-auto mb-2 flex h-9 w-14 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 active:bg-zinc-200 active:text-zinc-800"
                      aria-label="Yorum penceresini aşağı kapat"
                    >
                      <ChevronDown className="h-6 w-6" />
                    </button>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-[15px] font-extrabold">
                          Yorumlar
                        </h3>
                        <p className="text-[11px] font-semibold text-zinc-500">
                          {selectedStoryPost.commentCount} yorum
                        </p>
                      </div>
                      {isOwnStory ? (
                        <button
                          type="button"
                          onClick={() => setStoryViewersOpen((prev) => !prev)}
                          className="flex shrink-0 items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-2 text-[12px] font-bold text-zinc-700 active:bg-zinc-200"
                        >
                          <Eye className="h-4 w-4" />
                          {storyViewCount || selectedStoryViews.length}
                        </button>
                      ) : null}
                    </div>

                    <div className="max-h-[24vh] space-y-2 overflow-y-auto pr-1">
                      {storyCommentsAreLoading ? (
                        <div className="py-4 text-center text-xs font-semibold text-zinc-500">
                          Yorumlar yükleniyor...
                        </div>
                      ) : storyComments.length ? (
                        storyComments.map((comment) => {
                          const commentDisplayName =
                            getProfileCommentDisplayName(comment.user);
                          const commentIcon = comment.user.agentNickname
                            ? null
                            : resolveFriendIcon(comment.user.icon || "") ||
                              comment.user.icon;
                          return (
                            <div
                              key={`story-comment-${comment.id}`}
                              className="flex items-start gap-2 rounded-xl bg-zinc-50 px-2.5 py-2"
                            >
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-200 text-[11px] font-black text-zinc-700">
                                {commentIcon ? (
                                  <img
                                    src={commentIcon}
                                    alt={commentDisplayName}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  commentDisplayName.charAt(0).toUpperCase()
                                )}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="min-w-0">
                                    <span className="block truncate text-xs font-extrabold text-zinc-900">
	                                      {commentDisplayName}
                                    </span>
                                    <span className="text-[10px] font-semibold text-zinc-400">
                                      {formatWallTime(comment.createdAt)}
                                    </span>
                                  </div>
                                  {(comment.user.id === currentUserId ||
                                    canDeleteWallUserContent(
                                      comment.user.starCount,
                                    )) && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleDeleteWallComment(
                                          selectedStoryPost.id,
                                          comment.id,
                                        )
                                      }
                                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-red-500 active:bg-red-50"
                                      aria-label="Yorumu sil"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </div>
                                <p className="mt-1 whitespace-pre-wrap break-words text-[13px] font-medium leading-snug text-zinc-700">
                                  {comment.content}
                                </p>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="py-4 text-center text-xs font-semibold text-zinc-500">
                          Henüz yorum yok
                        </div>
                      )}
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <input
                        type="text"
                        value={storyCommentInput}
                        onChange={(event) =>
                          setWallCommentInputs((prev) => ({
                            ...prev,
                            [selectedStoryPost.id]: event.target.value,
                          }))
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            void handleSubmitComment(selectedStoryPost.id);
                          }
                        }}
                        placeholder="Yorum yaz..."
                        className="h-11 min-w-0 flex-1 rounded-full border border-zinc-200 bg-white px-4 text-[15px] font-medium text-zinc-900 outline-none focus:border-[#0a84ff] focus:ring-2 focus:ring-[#0a84ff]/15"
                      />
                      <button
                        type="button"
                        onClick={() => handleSubmitComment(selectedStoryPost.id)}
                        disabled={!storyCommentInput.trim()}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#0a84ff] text-white disabled:bg-zinc-300"
                        aria-label="Yorum gönder"
                      >
                        <Send className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
                ) : (
                  <div className="relative z-10 h-[max(14px,env(safe-area-inset-bottom))] shrink-0" />
                )}

                {storyViewersOpen && isOwnStory ? (
                  <div
                    className="absolute bottom-0 left-0 right-0 z-20 max-h-[46vh] rounded-t-[24px] bg-white px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-4 text-zinc-950 shadow-2xl"
                    onTouchStart={(event) =>
                      setStoryPanelTouchStartY(
                        event.touches[0]?.clientY ?? null,
                      )
                    }
                    onTouchEnd={(event) =>
                      handleStoryPanelTouchEnd(
                        event.changedTouches[0]?.clientY ?? 0,
                      )
                    }
                  >
                    <button
                      type="button"
                      onClick={closeStoryPanels}
                      className="mx-auto mb-3 flex h-9 w-14 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 active:bg-zinc-200 active:text-zinc-800"
                      aria-label="Görenler penceresini aşağı kapat"
                    >
                      <ChevronDown className="h-6 w-6" />
                    </button>
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-[17px] font-extrabold">
                        Görenler
                      </h3>
                      <span className="text-[13px] font-bold text-zinc-500">
                        {selectedStoryViews.length}
                      </span>
                    </div>
                    {selectedStoryViews.length === 0 ? (
                      <div className="py-6 text-center text-sm font-semibold text-zinc-500">
                        Henüz gören yok
                      </div>
                    ) : (
                      <div className="max-h-[32vh] space-y-2 overflow-y-auto">
	                        {selectedStoryViews.map((view) => {
	                          const viewerAgentNickname = String(
	                            view.user.agentNickname || "",
	                          ).trim();
	                          const viewerDisplayName = formatAgentDisplayName(
	                            {
	                              username: view.user.username,
	                              displayUsername: view.user.displayUsername,
	                              agentNickname: viewerAgentNickname || null,
	                              roleStarCount: view.user.starCount,
	                            },
	                            currentUserStarCount,
	                          );
	                          const viewerIcon = viewerAgentNickname
	                            ? null
	                            : resolveFriendIcon(view.user.icon || "") ||
	                              view.user.icon;
	                          return (
                            <div
                              key={`story-view-${view.id}`}
                              className="flex items-center gap-3 rounded-xl bg-zinc-50 px-3 py-2"
                            >
                              <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-zinc-200 text-sm font-black text-zinc-700">
                                {viewerIcon ? (
                                  <img
                                    src={viewerIcon}
	                                    alt={viewerDisplayName}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
	                                  viewerDisplayName.charAt(0).toUpperCase()
                                )}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-extrabold">
	                                  {viewerDisplayName}
                                </div>
                                <div className="text-xs font-medium text-zinc-500">
                                  {formatWallTime(view.createdAt)}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })()}
        </div>
      )}

      <DirectMessagesModal
        isOpen={showMessagesModal}
        onClose={() => {
          setShowMessagesModal(false);
          if (mobileRoomOnly && closeMobileRoomOnProfileClose) {
            onMobileRoomClose?.();
          }
        }}
        socket={socket}
        initialTargetUsername={dmTargetUsername}
        initialTargetAgentNickname={dmTargetAgentNickname}
        onUnreadCountChange={setDmUnreadCount}
        pendingConversationCounts={pendingDmConversationCounts}
        onConversationSeen={(conversationId) => {
          setPendingDmConversationCounts((prev) => {
            const next = { ...prev };
            delete next[conversationId];
            pendingDmConversationCountsRef.current = next;
            return next;
          });
        }}
        communicationPermissions={communicationPermissions}
        chatPermissions={chatPermissions}
        currentUserPermissions={currentUserPermissions}
        currentRolePermissions={currentRolePermissions}
        onlineUsernames={activeTenantUsers.map((u) => u.username)}
        currentUserStarCount={currentUserStarCount}
        currentUserIsGuest={isGuestUser}
        onStartVoiceCall={(user) => {
          if (!isUserOnlineByUsername(user.username)) {
            toast.error("Kullanıcı sitede değil.");
            return;
          }
          if (
            !guardVoiceCallFlow(
              user.isGuest === true || Boolean(user.agentNickname),
            )
          ) {
            return;
          }
          const roleName = activeTenantUsers.find(
            (u) => u.username === user.username,
          )?.roleName;
          guardedStartVoiceCall({
            ...user,
            roleName: roleName ?? user.roleName ?? null,
            displayUsername:
              "agentNickname" in user && user.agentNickname
                ? getCallDisplayUsername(user as RoomUser)
                : user.displayUsername,
          });
        }}
        onStartVideoCall={(user) => {
          if (!isUserOnlineByUsername(user.username)) {
            toast.error("Kullanıcı sitede değil.");
            return;
          }
          if (
            !guardVoiceCallFlow(
              user.isGuest === true || Boolean(user.agentNickname),
            )
          ) {
            return;
          }
          const roleName = activeTenantUsers.find(
            (u) => u.username === user.username,
          )?.roleName;
          guardedStartVideoCall({
            ...user,
            roleName: roleName ?? user.roleName ?? null,
            displayUsername:
              "agentNickname" in user && user.agentNickname
                ? getCallDisplayUsername(user as RoomUser)
                : user.displayUsername,
          });
        }}
      />

      <WallPostModal
        isOpen={showWallModal}
        onClose={() => setShowWallModal(false)}
        onSubmit={handleCreateWallPost}
        currentUserStarCount={currentUserStarCount}
      />

      <RegisterModal
        isOpen={showRegisterModal}
        onClose={() => setShowRegisterModal(false)}
      />

      {passwordModalRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200">
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  Özel Oda
                </p>
                <h3 className="text-sm font-semibold text-zinc-900">
                  {passwordModalRoom.name}
                </h3>
              </div>
              <button
                onClick={() => {
                  setPasswordModalRoom(null);
                  setRoomPassword("");
                  setRoomPasswordError(null);
                }}
                className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-zinc-100 text-zinc-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="space-y-1">
                <label className="text-sm font-medium text-zinc-700">
                  Oda Şifresi
                </label>
                <input
                  type="password"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  value={roomPassword}
                  onChange={(e) => setRoomPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitRoomPassword();
                  }}
                  placeholder="Şifre girin"
                  autoFocus
                />
                {roomPasswordError && (
                  <p className="text-xs text-red-600">{roomPasswordError}</p>
                )}
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => {
                    setPasswordModalRoom(null);
                    setRoomPassword("");
                    setRoomPasswordError(null);
                  }}
                  className="px-3 py-2 text-sm rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                >
                  İptal
                </button>
                <button
                  onClick={submitRoomPassword}
                  disabled={isVerifyingPassword}
                  className="px-3 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isVerifyingPassword ? "Kontrol ediliyor..." : "Gir"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {friendToRemove && (
        <div className="fixed inset-0 z-[105] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white shadow-xl">
            <div className="border-b border-zinc-200 px-4 py-3">
              <h3 className="text-sm font-semibold text-zinc-900">
                Arkadaşı kaldır
              </h3>
            </div>
            <div className="space-y-4 px-4 py-4">
              <p className="text-sm text-zinc-700">
	                <span className="font-semibold">
	                  {friendToRemove.displayName}
	                </span>{" "}
                arkadaş listenizden kaldırılsın mı?
              </p>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={closeRemoveFriendConfirm}
                  className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50"
                >
                  İptal
                </button>
                <button
                  onClick={() => void handleRemoveFriend()}
                  className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
                >
                  Evet, kaldır
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Profile Modal */}
      {selectedUser && (
        <div
          className={
            mobileRoomOnly
              ? "fixed inset-0 z-[140] flex items-end justify-center"
              : "fixed inset-0 z-[130] flex items-end justify-center sm:items-center sm:p-4 lg:absolute lg:inset-0 lg:z-30 lg:items-stretch lg:justify-start lg:p-0"
          }
        >
          <div
            className="absolute inset-0 bg-black/55 lg:hidden"
            onClick={() => closeUserModal()}
          />
          <div
            className={
              mobileRoomOnly
                ? "relative h-[min(66svh,500px)] w-full overflow-hidden"
                : "relative h-[min(72svh,580px)] w-full max-w-xl sm:h-[min(700px,86dvh)] lg:h-full lg:max-w-none"
            }
          >
            <div
              className={
                mobileRoomOnly
                  ? "flex h-full w-full flex-col overflow-hidden rounded-t-[24px] bg-white shadow-2xl"
                  : "flex h-full w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl lg:rounded-none lg:shadow-none"
              }
            >
              {/* Modal Header */}
              <div
                className={`relative z-[80] flex items-start justify-between gap-3 border-b border-zinc-200 bg-white px-4 py-2 sm:py-2.5 ${
                  hasAdminPrivileges && !isSelectedProfileOwner
                    ? "pr-40 sm:pr-44"
                    : ""
                }`}
              >
                <div className="flex min-w-0 flex-1 overflow-hidden items-start gap-3">
                  {selectedUser.gender === "male" ? (
                    <Mars className="mt-1 h-5 w-5 shrink-0 text-blue-500" />
                  ) : (
                    <Venus className="mt-1 h-5 w-5 shrink-0 text-pink-500" />
                  )}
                  <div className="min-w-0 flex-1 overflow-hidden space-y-1">
                    <div className="min-w-0">
                      {renderProfileHeaderUsername(selectedUser)}
                    </div>
                    <div className="min-w-0 max-w-full overflow-hidden truncate whitespace-nowrap text-sm leading-5 text-zinc-500 [&_*]:max-w-full [&_*]:align-middle">
                      {shouldShowGuestBadge(selectedUser) ? (
                        <span>Misafir</span>
                      ) : shouldHideRoleForUser(selectedUser) ? null : (
                        (renderRoleBadge(
                          getRoleDisplayUser(selectedUser),
                          currentUserStarCount,
                        ) ?? (
                          <span>Üye</span>
                        ))
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2 self-start pt-0">
	                  {isSelectedProfileOwner &&
	                    selectedUser.statusModeName && (
                      <div className="hidden rounded-lg bg-zinc-100 px-2.5 py-1.5 text-xs font-medium text-zinc-600 sm:block">
                        {selectedUser.statusModeName}
                      </div>
                    )}
                </div>
	                {hasAdminPrivileges &&
	                  !isSelectedProfileOwner && (
                    <div className="absolute right-[-1px] top-2 z-[90]" ref={adminMenuRef}>
                      <button
                        onClick={() => setShowAdminMenu(!showAdminMenu)}
                        className="relative inline-flex h-9 items-center gap-1 rounded-l-md bg-red-500 px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-red-600"
                      >
                        Admin...
                        <ChevronDown className="h-3.5 w-3.5" />
                        <span className="absolute bottom-[-8px] right-0 h-0 w-0 border-l-[8px] border-t-[8px] border-l-transparent border-t-red-700" />
                      </button>
                      {showAdminMenu && (
                        <div className="absolute right-0 top-full z-[100] mt-1 max-h-[min(60vh,360px)] w-56 overflow-y-auto rounded-xl border border-zinc-200 bg-white py-2 shadow-xl">
                          {adminActions.map((item) => (
                            <button
                              key={item.action}
                              onClick={() =>
                                handleAdminAction(item.action, selectedUser)
                              }
                              disabled={
                                adminActionLoading && item.action === "ban"
                              }
                              className={`w-full px-4 py-2 text-left text-sm transition-colors hover:bg-zinc-50 ${
                                item.color
                              } ${
                                adminActionLoading && item.action === "ban"
                                  ? "cursor-not-allowed opacity-50"
                                  : ""
                              }`}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
              </div>

              {/* Tab Navigation */}
              <div className="relative z-0 grid grid-cols-6 gap-0 overflow-visible border-b border-zinc-200 px-0 py-0">
                {(() => {
                  const selectedIsIgnored = isIgnoredUser(selectedUser.username);
                  const canInteractWithSelectedUser =
                    !!selectedUser &&
	                    !isSelectedProfileOwner &&
                    !isBlockedEitherWay &&
                    !relationLoading;

                  return [
                  {
                    key: "message",
                    icon: MessageSquare,
                    label: "Özel mesaj",
                    active: true,
                    color: "text-blue-500",
                  },
                  {
                    key: "voice-call",
                    icon: Phone,
                    label: "Sesli arama",
                    active: false,
                    color: "text-green-500",
                  },
                  {
                    key: "video-call",
                    icon: Video,
                    label: "Görüntülü arama",
                    active: false,
                    color: "text-green-500",
                  },
                  {
                    key: "ignore",
                    icon: EyeOff,
                    label: selectedIsIgnored
                      ? "Görmezden gelmeyi kaldır"
                      : "Görmezden gel",
                    active: false,
                    color: "text-red-500",
                  },
                  {
                    key: "block-toggle",
                    icon: Ban,
                    label: isBlockedByMe ? "Engeli kaldır" : "Engelle",
                    active: false,
                    color: "text-red-600",
                  },
                  {
                    key: "close",
                    icon: LogOut,
                    label: "Çıkış",
                    active: false,
                    color: "text-zinc-600",
                  },
                  ].map((tab, idx) => {
                  const isVoice = tab.key === "voice-call";
                  const isVideo = tab.key === "video-call";
                  const isMessage = tab.key === "message";
                  const isBlockToggle = tab.key === "block-toggle";
                  const isIgnoreToggle = tab.key === "ignore";
                  const isExit = tab.key === "close";
                  const isDisabled =
                    (!isExit && isBlockToggle && !canBlockUsers) ||
                    (isMessage || isVoice || isVideo) &&
                    !canInteractWithSelectedUser;
                  const title = isDisabled
                    ? relationLoading
                      ? "Durum kontrol ediliyor..."
                      : isBlockToggle && !canBlockUsers
                        ? "Engel yetkiniz yok."
                      : isBlockedByMe
                        ? "Bu kullanıcıyı engellediniz."
                        : isBlockedByOther
                          ? "Bu kullanıcı sizi engelledi."
                          : "Kendinizi arayamazsiniz"
                    : undefined;

                  return (
                    <button
                      key={idx}
                      disabled={isDisabled}
                      title={title}
                      onClick={() => {
                        if (isExit) {
                          closeUserModal();
                          return;
                        }
                        if (isBlockToggle && selectedUser) {
                          handleToggleBlockUser(selectedUser.username);
                          return;
                        }
                        if (isIgnoreToggle && selectedUser) {
                          handleToggleIgnoreUser(selectedUser.username);
                          return;
                        }
                        if (isVoice && canInteractWithSelectedUser && selectedUser) {
                          if (selectedUser.isBot) {
                            toast.success("Arama gönderildi.");
                            closeUserModal();
                            return;
                          }
                          guardedStartVoiceCall(selectedUser);
                          closeUserModal();
                        }
                        if (isVideo && canInteractWithSelectedUser && selectedUser) {
                          if (selectedUser.isBot) {
                            toast.success("Arama gönderildi.");
                            closeUserModal();
                            return;
                          }
                          guardedStartVideoCall(selectedUser);
                          closeUserModal();
                        }
                        if (isMessage && canInteractWithSelectedUser && selectedUser) {
                          if (shouldBlockGuestPrivateMessages) {
                            toast.error(
                              "Misafir özel mesaj kapalı. Sadece size gelen yeni özel mesaj bildiriminden cevap verebilirsiniz.",
                            );
                            return;
                          }
                          if (!canCurrentUserPrivateMessage) {
                            toast.error("Özel mesaj atma yetkiniz yok.");
                            return;
                          }
                          if (selectedUser.isBot) {
                            toast.success("Özel mesaj gönderildi.");
                            closeUserModal();
                            return;
                          }
                          setDmTargetUsername(selectedUser.username);
                          setDmTargetAgentNickname(selectedUser.agentNickname || null);
                          setShowMessagesModal(true);
                          closeUserModal({ closeMobileRoom: false });
                        }
                      }}
                      className={`group relative flex min-w-0 flex-col items-center justify-center gap-0 border-b-2 px-0 py-2.5 transition-colors sm:py-3 ${
                        tab.active
                          ? "border-blue-500 bg-white text-blue-500"
                          : "border-transparent bg-white hover:bg-zinc-50"
                      } ${
                        isDisabled ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                    >
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block transition-all duration-200">
                      <div className="relative bg-white border border-zinc-200 px-3 py-1.5 rounded-lg shadow-xl text-zinc-700 font-medium whitespace-nowrap text-[13px] z-50">
                        {tab.label}
                        {/* Arrow */}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-white border-b border-r border-zinc-200 rotate-45 -mt-1"></div>
                      </div>
                    </div>

                    <tab.icon className={`h-5 w-5 ${tab.color}`} />
                    <span className="sr-only">{tab.label}</span>
                  </button>
                  );
                });
                })()}
              </div>

              {/* Profile Content */}
              <div className="relative z-0 flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-3 sm:px-6 sm:py-5">
                {/* Profile Image */}
                <div className="relative mb-2 flex justify-center sm:mb-4">
                  <div className="relative">
                    {(() => {
                      const modalIcon = resolveFriendIcon(
                        selectedUser.icon || null,
                      );
                      const isMaskedUser = isAgentMaskedUser(selectedUser);
                      return (
                        <>
                    {selectedUser.frame && !isMaskedUser && (
                      <img
                        src={selectedUser.frame.replace(/\.png$/i, ".gif")}
                        alt="frame"
                        className="absolute inset-0 z-20 w-full h-full object-contain scale-125 pointer-events-none"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (!modalIcon || isMaskedUser) return;
                        setSelectedProfileImage(modalIcon);
                        setIsProfileImageModalOpen(true);
                      }}
                      disabled={!modalIcon || isMaskedUser}
                      className={`flex h-22 w-22 items-center justify-center overflow-hidden rounded-full text-3xl font-bold text-white transition-transform sm:h-36 sm:w-36 sm:text-4xl ${
                        modalIcon && !isMaskedUser
                          ? "cursor-zoom-in hover:scale-[1.02]"
                          : "cursor-default"
                      } ${
                        !isMaskedUser && modalIcon?.startsWith("data:")
                          ? "bg-white"
                          : selectedUser.gender === "male"
                            ? "bg-linear-to-br from-blue-500 to-blue-600"
                            : "bg-linear-to-br from-pink-500 to-pink-600"
                      }`}
                    >
                      {modalIcon && !isMaskedUser ? (
                        <img
                          src={modalIcon}
                          alt="avatar"
                          className="w-full h-full object-cover bg-white"
                        />
                      ) : (
                        getAvatarInitial(selectedUser)
                      )}
                    </button>
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Comments Section */}
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm text-zinc-500 sm:mb-4">
                  <div className="flex items-center gap-1">
                    <MessageSquare className="h-4 w-4" />
                    <span>{profileComments.length} yorum</span>
                  </div>
                  {(() => {
	                    if (isSelectedProfileOwner) {
                      return (
                        <span className="text-xs text-zinc-400">
                          Bu sensin
                        </span>
                      );
                    }
                    if (relationLoading) {
                      return (
                        <span className="text-xs text-zinc-400">
                          İlişki kontrol ediliyor...
                        </span>
                      );
                    }
                    if (isBlockedByMe) {
                      return (
                        <span className="text-xs text-red-600 font-semibold">
                          Bu kullanıcıyı engellediniz
                        </span>
                      );
                    }
                    if (isBlockedByOther) {
                      return (
                        <span className="text-xs text-red-600 font-semibold">
                          Bu kullanıcı sizi engelledi
                        </span>
                      );
                    }
	                    const relation = getFriendRelation(
	                      selectedUser.username,
	                      selectedProfileAgentNickname,
	                    );
                    if (relation.type === "friends") {
                      return (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-green-600 font-semibold">
                            Arkadaşsınız
                          </span>
                          <button
                            onClick={() =>
	                              openRemoveFriendConfirm(
	                                relation.requestId,
	                                selectedUser.username,
	                                selectedProfileAgentNickname,
	                                getDisplayUsername(selectedUser),
	                              )
                            }
                            className="rounded-md bg-zinc-200 px-2 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-300"
                          >
                            Arkadaşı çıkar
                          </button>
                        </div>
                      );
                    }
                    if (relation.type === "incoming") {
                      return (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              handleAcceptFriendRequest(relation.requestId)
                            }
                            className="rounded-md bg-green-500 px-2 py-1 text-xs font-semibold text-white hover:bg-green-600"
                          >
                            Kabul
                          </button>
                          <button
                            onClick={() =>
                              handleRejectFriendRequest(relation.requestId)
                            }
                            className="rounded-md bg-zinc-200 px-2 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-300"
                          >
                            Ret
                          </button>
                        </div>
                      );
                    }
                    if (relation.type === "outgoing") {
                      return (
                        <button
                          onClick={() =>
                            handleCancelFriendRequest(relation.requestId)
                          }
                          className="flex items-center gap-1 text-zinc-500 hover:text-red-500 transition-colors"
                        >
                          <Heart className="h-4 w-4" />
                          <span>İstek Gönderildi</span>
                        </button>
                      );
                    }
                    if (isGuestUser || selectedUser.isGuest) {
                      return null;
                    }
                    return (
                      <button
                        onClick={() =>
                          handleSendFriendRequest(selectedUser.username)
                        }
                        className="flex items-center gap-1 rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-600 transition-colors hover:text-red-500"
                      >
                        <Heart className="h-4 w-4" />
                        <span>Arkadaş Ekle</span>
                      </button>
                    );
                  })()}
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-zinc-200 pt-3 sm:pt-4">
                  {!selectedUser.isBot && isSelectedProfileOwner && (
                    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-xs font-semibold text-amber-800">
                          Onay bekleyen yorumlar ({pendingProfileComments.length})
                        </p>
                      </div>
                      {pendingProfileCommentsLoading ? (
                        <p className="text-xs text-amber-700">
                          Bekleyen yorumlar yükleniyor...
                        </p>
                      ) : pendingProfileComments.length > 0 ? (
                        <div className="space-y-2">
                          {pendingProfileComments.map((comment) => (
                            <div
                              key={comment.id}
                              className="rounded-lg border border-amber-200 bg-white px-3 py-2"
                            >
                              <div className="mb-1 flex items-start justify-between gap-2">
                                <div className="flex min-w-0 items-center gap-2">
                                  {renderProfileCommentAvatar(comment.user)}
                                  <div className="min-w-0">
                                    <p className="truncate text-xs font-semibold text-zinc-700">
	                                    {getProfileCommentDisplayName(comment.user)}
                                    </p>
                                    <p className="text-[11px] text-zinc-500">
                                      {formatWallTime(comment.createdAt)}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() =>
                                      void handleApproveProfileComment(comment.id)
                                    }
                                    disabled={
                                      profileCommentApprovingId === comment.id ||
                                      profileCommentDeletingId === comment.id
                                    }
                                    className="rounded-md px-2 py-1 text-xs text-green-700 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    Onayla
                                  </button>
                                  <button
                                    onClick={() =>
                                      void handleDeleteProfileComment(comment.id)
                                    }
                                    disabled={
                                      profileCommentApprovingId === comment.id ||
                                      profileCommentDeletingId === comment.id
                                    }
                                    className="rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    Sil
                                  </button>
                                </div>
                              </div>
                              <p className="break-words text-sm text-zinc-800">
                                {comment.content}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-amber-700">
                          Onay bekleyen yorum yok.
                        </p>
                      )}
                    </div>
                  )}
                  {!selectedUser.isBot &&
                    !isSelectedProfileOwner &&
                    myPendingProfileComments.length > 0 && (
                    <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
                      <p className="mb-2 text-xs font-semibold text-blue-800">
                        Onay bekleyen yorumlarım ({myPendingProfileComments.length})
                      </p>
                      {myPendingProfileCommentsLoading ? (
                        <p className="text-xs text-blue-700">
                          Bekleyen yorumlar yükleniyor...
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {myPendingProfileComments.map((comment) => (
                            <div
                              key={comment.id}
                              className="rounded-lg border border-blue-200 bg-white px-3 py-2"
                            >
                              <div className="mb-1 flex items-start justify-between gap-2">
                                <div className="flex min-w-0 items-center gap-2">
                                  {renderProfileCommentAvatar(comment.user)}
                                  <div className="min-w-0">
                                    <p className="truncate text-xs font-semibold text-zinc-700">
                                      {getProfileCommentDisplayName(comment.user)}
                                    </p>
                                    <p className="text-[11px] text-zinc-500">
                                      {formatWallTime(comment.createdAt)}
                                    </p>
                                  </div>
                                </div>
                              </div>
                              <p className="break-words text-sm text-zinc-800">
                                {comment.content}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {selectedUser.isBot ? null : profileCommentsLoading ? (
                    <p className="text-center text-zinc-400 text-sm py-12">
                      Yorumlar yükleniyor...
                    </p>
                  ) : profileComments.length > 0 ? (
                    <div className="space-y-3">
                      {profileComments.map((comment) => {
                        const canDelete = canDeleteProfileComment(selectedUser);
                        return (
                          <div
                            key={comment.id}
                            className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2"
                          >
                            <div className="mb-1 flex items-start justify-between gap-2">
                              <div className="flex min-w-0 items-center gap-2">
                                {renderProfileCommentAvatar(comment.user)}
                                <div className="min-w-0">
                                  <p className="truncate text-xs font-semibold text-zinc-700">
                                    {getProfileCommentDisplayName(comment.user)}
                                  </p>
                                  <p className="text-[11px] text-zinc-500">
                                    {formatWallTime(comment.createdAt)}
                                  </p>
                                </div>
                              </div>
                              {canDelete && (
                                <button
                                  onClick={() =>
                                    handleDeleteProfileComment(comment.id)
                                  }
                                  disabled={profileCommentDeletingId === comment.id}
                                  className="rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  Sil
                                </button>
                              )}
                            </div>
                            <p className="break-words text-sm text-zinc-800">
                              {comment.content}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-center text-zinc-400 text-sm py-12">
                      Henüz yorum yapılmamış
                    </p>
                  )}
                </div>
              </div>

              {/* Comment Input */}
              {!selectedUser.isBot && (
              <div className="border-t border-zinc-200 bg-white p-2.5 sm:p-4">
                  <div className="flex items-center gap-2 rounded-xl bg-zinc-100 px-3 py-2">
                    <MessageSquare className="h-5 w-5 text-zinc-400" />
                    <input
                      type="text"
                      placeholder="Ne düşünüyorsun..."
                      value={profileCommentInput}
                      onChange={(e) => setProfileCommentInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          void handleSubmitProfileComment();
                        }
                      }}
                      disabled={
                        profileCommentSubmitting ||
                        isGuestUser
                      }
                      className="min-w-0 flex-1 bg-transparent text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none"
                    />
                    <button
                      onClick={() => void handleSubmitProfileComment()}
                      disabled={
                        profileCommentSubmitting ||
                        !profileCommentInput.trim() ||
                        isGuestUser
                      }
                      className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {profileCommentSubmitting ? "..." : "Gönder"}
                    </button>
                  </div>
              </div>
              )}
            </div>
          </div>
        </div>
      )}
      {isProfileImageModalOpen && selectedProfileImage && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/95 p-4 backdrop-blur-md animate-in fade-in duration-300"
          onClick={() => {
            setIsProfileImageModalOpen(false);
            setSelectedProfileImage(null);
          }}
        >
          {/* Close Button */}
          <button
            type="button"
            className="absolute right-8 top-8 z-[10001] rounded-full bg-white/10 p-4 text-white transition-all hover:bg-white/20 hover:scale-110 active:scale-95"
            onClick={(event) => {
              event.stopPropagation();
              setIsProfileImageModalOpen(false);
              setSelectedProfileImage(null);
            }}
            aria-label="Profil gorselini kapat"
          >
            <X className="h-8 w-8" />
          </button>

          {/* Image Container */}
          <div
            className="relative flex items-center justify-center animate-in zoom-in-95 duration-300"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative group">
              <img
                src={selectedProfileImage}
                alt="Profil gorseli"
                className="w-[min(85vh,90vw)] h-[min(85vh,90vw)] rounded-full object-cover shadow-[0_0_50px_rgba(0,0,0,0.5)] border-4 border-white/20"
              />
              {/* Outer Glow Effect */}
              <div className="absolute inset-0 rounded-full shadow-[inset_0_0_20px_rgba(0,0,0,0.3)] pointer-events-none" />
            </div>
          </div>
        </div>
      )}
      {showUserInfoModal && userInfoData && (
        <div className="fixed inset-0 z-[170] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 bg-zinc-900 text-white">
              <h3 className="text-sm font-semibold">Kullanıcı Bilgileri</h3>
              <button
                onClick={() => setShowUserInfoModal(false)}
                className="hover:bg-white/20 rounded-full p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-2">
              <p className="text-sm text-zinc-800 font-semibold">
                {userInfoData.username}
              </p>
              <p className="text-sm text-zinc-700">
                Yetkisi:{" "}
                <span className="font-medium">
                  {userInfoData.roleName
                    ? formatRoleLabel(userInfoData.roleName)
                    : "-"}
                  {userInfoData.roleStarCount > 0
                    ? ` (${userInfoData.roleStarCount}★)`
                    : ""}
                </span>
              </p>
              <p className="text-sm text-zinc-700">
                IP Adresi:{" "}
                <span className="font-medium">
                  {canViewIp ? userInfoData.ipAddress : "Gizli"}
                </span>
              </p>
              <p className="text-sm text-zinc-700">
                Durum Modu:{" "}
                <span className="font-medium">
                  {userInfoData.statusModeName || "Yok"}
                </span>
              </p>
            </div>
            <div className="bg-zinc-50 px-4 py-3 flex justify-end">
              <button
                onClick={() => setShowUserInfoModal(false)}
                className="px-4 py-2 rounded-md bg-zinc-200 text-zinc-700 text-sm font-medium hover:bg-zinc-300"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
      {showBotSpeakModal && botSpeakTarget && (
        <div className="fixed inset-0 z-[170] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 bg-zinc-900 text-white">
              <h3 className="text-sm font-semibold">Botu Konuştur</h3>
              <button
                onClick={() => {
                  setShowBotSpeakModal(false);
                  setBotSpeakTarget(null);
                  setBotSpeakMessage("");
                }}
                className="hover:bg-white/20 rounded-full p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm text-zinc-700">
                <span className="font-semibold text-zinc-900">
                  {botSpeakTarget.username}
                </span>{" "}
                olduğu odada bu mesajı yazacak.
              </p>
              <textarea
                value={botSpeakMessage}
                onChange={(event) => setBotSpeakMessage(event.target.value)}
                rows={4}
                maxLength={500}
                className="w-full resize-none rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-blue-500"
                placeholder="Mesaj yaz..."
              />
            </div>
            <div className="bg-zinc-50 px-4 py-3 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowBotSpeakModal(false);
                  setBotSpeakTarget(null);
                  setBotSpeakMessage("");
                }}
                className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900"
              >
                İptal
              </button>
              <button
                onClick={() => void handleSubmitBotSpeak()}
                disabled={adminActionLoading || !botSpeakMessage.trim()}
                className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
              >
                Gönder
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Teleport Modal */}
      {showTeleportModal && (
        <div className="fixed inset-0 z-[170] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 bg-red-500 text-white">
              <div className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                <h3 className="text-sm font-semibold">Odaya Işınla</h3>
              </div>
              <button
                onClick={() => setShowTeleportModal(false)}
                className="hover:bg-white/20 rounded-full p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4">
              <p className="text-sm text-zinc-600 mb-3">
                <span className="font-bold text-zinc-900">
                  {teleportTargetUser?.username}
                </span>{" "}
                kullanıcısını hangi odaya ışınlamak istiyorsunuz?
              </p>
              <div className="max-h-[300px] overflow-y-auto space-y-1">
                {rooms.map((room) => (
                  <button
                    key={room.id}
                    onClick={() => handleTeleportUser(room)}
                    className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-zinc-100 transition-colors flex items-center justify-between border border-transparent hover:border-zinc-200"
                  >
                    <span className="text-sm font-medium text-zinc-900">
                      {room.name}
                    </span>
                    <span className="text-xs text-zinc-400">
                      {(() => {
                        const roomKey = String(room.voiceId || room.name);
                        const { value: liveCount } = getLiveCount(roomKey);
                        return liveCount === null ? "—" : liveCount;
                      })()}{" "}
                      kişi
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-zinc-50 px-4 py-3 flex justify-end">
              <button
                onClick={() => setShowTeleportModal(false)}
                className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900"
              >
                İptal
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{`
        @keyframes leaf-drift {
          0% {
            transform: translate3d(0, 0, 0) rotate(-8deg);
          }
          20% {
            transform: translate3d(52px, 10px, 0) rotate(12deg);
          }
          40% {
            transform: translate3d(116px, -2px, 0) rotate(-6deg);
          }
          60% {
            transform: translate3d(182px, 12px, 0) rotate(10deg);
          }
          80% {
            transform: translate3d(248px, 2px, 0) rotate(-8deg);
          }
          100% {
            transform: translate3d(316px, 10px, 0) rotate(6deg);
          }
        }
        @keyframes balloon-rise {
          0% {
            transform: translate3d(0, 14px, 0) rotate(calc(var(--balloon-tilt, -3deg) - 0.6deg)) scale(0.92);
            opacity: 0;
          }
          12% {
            opacity: calc(var(--balloon-opacity, 0.8) * 0.92);
          }
          20% {
            transform: translate3d(calc(var(--balloon-drift, -10px) * 0.14), calc(var(--balloon-lift, 64px) * -0.08), 0) rotate(var(--balloon-tilt, -3deg)) scale(0.98);
            opacity: var(--balloon-opacity, 0.8);
          }
          44% {
            transform: translate3d(calc(var(--balloon-drift, -10px) * 0.42), calc(var(--balloon-lift, 64px) * -0.38), 0) rotate(calc(var(--balloon-tilt, -3deg) + 1.4deg)) scale(1.01);
            opacity: var(--balloon-opacity, 0.8);
          }
          68% {
            transform: translate3d(calc(var(--balloon-drift, -10px) * 0.78), calc(var(--balloon-lift, 64px) * -0.7), 0) rotate(calc(var(--balloon-tilt, -3deg) - 1.1deg)) scale(1);
            opacity: calc(var(--balloon-opacity, 0.8) * 0.88);
          }
          84% {
            transform: translate3d(calc(var(--balloon-drift, -10px) * 0.7), calc(var(--balloon-lift, 64px) * -0.86), 0) rotate(calc(var(--balloon-tilt, -3deg) - 0.2deg)) scale(0.99);
            opacity: calc(var(--balloon-opacity, 0.8) * 0.44);
          }
          90% {
            transform: translate3d(calc(var(--balloon-drift, -10px) * 0.64), calc(var(--balloon-lift, 64px) * -0.93), 0) rotate(calc(var(--balloon-tilt, -3deg) + 0.1deg)) scale(0.985);
            opacity: calc(var(--balloon-opacity, 0.8) * 0.18);
          }
          100% {
            transform: translate3d(calc(var(--balloon-drift, -10px) * 0.58), calc(var(--balloon-lift, 64px) * -1.04), 0) rotate(calc(var(--balloon-tilt, -3deg) + 0.7deg)) scale(0.98);
            opacity: 0;
          }
        }
        @keyframes butterfly-glide {
          0% {
            transform: translate3d(0, 0, 0) rotate(-8deg) scale(1);
          }
          16% {
            transform: translate3d(54px, -12px, 0) rotate(6deg) scale(1.04);
          }
          33% {
            transform: translate3d(132px, -6px, 0) rotate(-4deg) scale(0.98);
          }
          50% {
            transform: translate3d(206px, 2px, 0) rotate(8deg) scale(1.03);
          }
          66% {
            transform: translate3d(246px, 12px, 0) rotate(-6deg) scale(0.98);
          }
          83% {
            transform: translate3d(286px, 6px, 0) rotate(5deg) scale(1.02);
          }
          100% {
            transform: translate3d(320px, 8px, 0) rotate(0deg) scale(1);
          }
        }
        @keyframes rose-stream-fall {
          0% {
            transform: translate3d(-50%, 0, 0);
            opacity: 0;
          }
          14% {
            opacity: 0.72;
          }
          50% {
            transform: translate3d(-50%, calc(var(--rose-stream-drop, 176px) * 0.5), 0);
            opacity: 0.76;
          }
          82% {
            opacity: 0.68;
          }
          100% {
            transform: translate3d(-50%, var(--rose-stream-drop, 176px), 0);
            opacity: 0;
          }
        }
      `}</style>
    </aside>
    {incomingWarnModal && (
      <div className="fixed inset-0 z-[170] flex items-center justify-center bg-black/45 p-4">
        <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200">
            <h3 className="text-[18px] font-semibold text-zinc-800">
              Yetkili Uyarısı...
            </h3>
            <button
              onClick={() => setIncomingWarnModal(null)}
              className="p-1 rounded-full hover:bg-zinc-100"
            >
              <X className="h-6 w-6 text-zinc-500" />
            </button>
          </div>
          <div className="px-5 py-8 border-b border-zinc-200">
            <p className="text-[17px] text-zinc-800">
              {incomingWarnModal.message}
            </p>
          </div>
          <div className="px-5 py-4 flex justify-end">
            <button
              onClick={() => setIncomingWarnModal(null)}
              className="px-6 py-2 rounded-md bg-red-500 text-white text-base font-semibold hover:bg-red-600"
            >
              Tamam
            </button>
          </div>
        </div>
      </div>
    )}
    {incomingMicInvite && (
      <div className="fixed inset-0 z-[170] flex items-center justify-center bg-black/45 p-4">
        <div className="w-full max-w-sm rounded-xl bg-white shadow-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 bg-emerald-600 text-white">
            <h3 className="text-sm font-semibold">Mikrofon Daveti</h3>
            <button
              onClick={() => void handleMicInviteResponse(false)}
              className="hover:bg-white/20 rounded-full p-1"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="p-4 space-y-4">
            <p className="text-sm text-zinc-700">
              <span className="font-semibold text-zinc-900">
                {incomingMicInvite.fromUsername}
              </span>{" "}
              sizi{" "}
              <span className="font-semibold text-zinc-900">
                {incomingMicInvite.roomName || incomingMicInvite.room}
              </span>{" "}
              odasında mikrofona davet etti.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => void handleMicInviteResponse(false)}
                className="px-3 py-2 rounded-md bg-zinc-100 text-zinc-700 text-sm font-medium hover:bg-zinc-200"
              >
                Reddet
              </button>
              <button
                onClick={() => void handleMicInviteResponse(true)}
                className="px-3 py-2 rounded-md bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700"
              >
                Mikrofonu Al
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    {pendingRoomInvite && (
      <div className="fixed inset-0 z-[170] flex items-center justify-center bg-black/45 p-4">
        <div className="w-full max-w-sm rounded-xl bg-white shadow-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 bg-blue-600 text-white">
            <h3 className="text-sm font-semibold">Oda Daveti</h3>
            <button
              onClick={() => handleRoomInviteResponse(false)}
              className="hover:bg-white/20 rounded-full p-1"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="p-4 space-y-4">
            <p className="text-sm text-zinc-700">
              <span className="font-semibold text-zinc-900">
                {pendingRoomInvite.fromUsername}
              </span>{" "}
              sizi{" "}
              <span className="font-semibold text-zinc-900">
                {pendingRoomInvite.roomName}
              </span>{" "}
              odasına davet etti.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => handleRoomInviteResponse(false)}
                className="px-3 py-2 rounded-md bg-zinc-100 text-zinc-700 text-sm font-medium hover:bg-zinc-200"
              >
                Reddet
              </button>
              <button
                onClick={() => handleRoomInviteResponse(true)}
                className="px-3 py-2 rounded-md bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
              >
                Kabul Et
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
};
