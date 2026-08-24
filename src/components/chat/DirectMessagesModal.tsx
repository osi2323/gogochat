"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronRight,
  MessageSquare,
  MoreVertical,
  Phone,
  Reply,
  Search,
  Video,
  X,
} from "lucide-react";
import type { Socket } from "socket.io-client";
import { apiClient } from "@/services/apiClient";
import {
  DirectMessageInput,
  type DirectMessageMenuAction,
} from "./DirectMessageInput";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import {
  ChatPreferences,
  defaultChatPreferences,
  mergeChatPreferences,
  readChatPreferencesFromStorage,
  writeChatPreferencesToStorage,
} from "@/lib/chatPreferences";
import { formatAgentDisplayName } from "@/lib/agentDisplay";
import { resolveAvatarUrl } from "@/lib/avatarUrl";
import type { FriendRelationState } from "@/services/friendsService";
import type {
  ChatPermission,
  ChatPermissionsSettings,
} from "@/services/systemSettingsService";
import {
  hasEffectivePermission,
  PERMISSION_LABELS,
} from "@/lib/permissions";

type DirectMessagesModalProps = {
  isOpen: boolean;
  onClose: () => void;
  socket?: Socket | null;
  initialTargetUsername?: string | null;
  initialTargetAgentNickname?: string | null;
  onUnreadCountChange?: (count: number) => void;
  unreadTotalCount?: number;
  pendingConversationCounts?: Record<number, number>;
  onConversationSeen?: (
    conversationId: number,
    lastMessageId?: number | string | null,
  ) => void;
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
  onlineUsernames?: string[];
  currentUserStarCount?: number;
  currentUserIsGuest?: boolean;
  currentUserGender?: string | null;
  communicationPermissions?: {
    membersPrivateMessageEnabled: boolean;
    membersVoiceCallEnabled: boolean;
    guestPrivateMessageEnabled: boolean;
    guestVoiceCallEnabled: boolean;
  } | null;
  currentUserPermissions?: string[];
  currentRolePermissions?: Record<string, unknown> | null;
  chatPermissions?: Pick<
    ChatPermissionsSettings,
    "chatVoiceRecordSendPermission"
  > | null;
};

type Conversation = {
  id: number;
  otherUser: {
    id: number;
    username: string;
    displayUsername?: string;
    gender: "male" | "female";
    icon?: string | null;
    roleName?: string | null;
    isGuest?: boolean;
    agentNickname?: string | null;
    roleStarCount?: number | null;
    isOnline?: boolean;
  };
  lastMessage: {
    id: number;
    content?: string | null;
    image?: string | null;
    audio?: string | null;
    audioFileName?: string | null;
    replyToMessage?: ReplyToMessage | null;
    senderId: number;
    createdAt: string;
  } | null;
  lastMessageAt?: string | null;
  unreadCount: number;
  isBlocked?: boolean;
  canCurrentUserSendMessage?: boolean;
};

type Message = {
  id: number;
  content?: string | null;
  image?: string | null;
  audio?: string | null;
  audioFileName?: string | null;
  replyToMessage?: ReplyToMessage | null;
  senderId: number;
  sender: {
    id: number;
    username: string;
    displayUsername?: string;
    gender: "male" | "female";
    icon?: string | null;
    agentNickname?: string | null;
    roleStarCount?: number | null;
  };
  createdAt: string;
};

type ReplyToMessage = {
  id: number;
  content: string;
  sender?: {
    id?: number;
    username?: string | null;
    displayUsername?: string | null;
    agentNickname?: string | null;
  } | null;
  createdAt?: string | null;
};

type DirectMessageSocketPayload = {
  conversationId?: number;
  sender: Message["sender"];
  message: Omit<Message, "sender">;
  unreadCount?: number;
};

type DirectMessageBuzzPayload = {
  conversationId?: number | string;
  fromDisplayUsername?: string | null;
};

const normalizeGender = (value?: string | null): "male" | "female" | null => {
  if (value === "male" || value === "female") return value;
  return null;
};

const mergeUniqueMessages = (messages: Message[]) => {
  const byId = new Map<string, Message>();
  messages.forEach((message) => {
    byId.set(String(message.id), message);
  });
  return Array.from(byId.values()).sort(
    (left, right) =>
      new Date(left.createdAt || 0).getTime() -
      new Date(right.createdAt || 0).getTime(),
  );
};

const resolveIcon = (icon?: string | null) => {
  return resolveAvatarUrl(icon);
};

const isGifImageSource = (value?: string | null): boolean => {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  if (normalized.startsWith("data:image/gif")) return true;
  const withoutQueryHash = normalized.split(/[?#]/, 1)[0];
  return withoutQueryHash.endsWith(".gif");
};

const resolveAnimationImageSrc = (
  value?: string | null,
  cacheKey?: string | number | null,
) => {
  if (!value?.includes("/animasyonlar/")) {
    return value ?? "";
  }

  const version = cacheKey != null ? String(cacheKey) : "animation";
  return `${value}${value.includes("?") ? "&" : "?"}v=${encodeURIComponent(version)}`;
};

const getPreview = (message: Conversation["lastMessage"]) => {
  if (!message) return "";
  if (message.audio) return "🎤 Sesli mesaj";
  if (message.image?.includes("/animasyonlar/")) return "✨ Animasyon";
  if (message.image?.includes("/emom/")) return "😀 Emoji";
  if (isGifImageSource(message.image)) return "🎞️ GIF";
  if (message.image) return "📷 Gorsel";
  return message.content || "";
};

const parseServerDateParts = (value?: string | null) => {
  if (!value) return null;
  const match = value
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: match[4],
    minute: match[5],
    second: match[6] || "00",
  };
};

const getDisplayDateFromServerValue = (value?: string | null) => {
  const serverParts = parseServerDateParts(value);
  if (!serverParts) return null;

  return new Date(
    serverParts.year,
    serverParts.month - 1,
    serverParts.day,
    Number(serverParts.hour),
    Number(serverParts.minute),
    Number(serverParts.second),
  );
};

const formatConversationDate = (value?: string | null) => {
  if (!value) return "";
  try {
    const displayDate = getDisplayDateFromServerValue(value);
    if (displayDate) {
      return new Intl.DateTimeFormat("tr-TR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(displayDate);
    }
    return new Intl.DateTimeFormat("tr-TR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(value));
  } catch {
    return "";
  }
};

const formatMessageTime = (value: string) => {
  try {
    const displayDate = getDisplayDateFromServerValue(value);
    if (displayDate) {
      return new Intl.DateTimeFormat("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(displayDate);
    }
    return new Intl.DateTimeFormat("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "";
  }
};

const renderEmojiContent = (text: string) => {
  if (!text) return null;
  const parts = text.split(/(\[e\d+\])/g);
  return parts.map((part, index) => {
    const match = part.match(/^\[(e\d+)\]$/);
    if (match) {
      const emojiCode = match[1];
      return (
        <img
          key={`emoji-${index}`}
          src={`/emom/${emojiCode}.gif`}
          alt={emojiCode}
          className="inline-block w-[18px] h-[18px] align-middle mx-0.5 object-contain"
        />
      );
    }
    return <span key={`text-${index}`}>{part}</span>;
  });
};

export const DirectMessagesModal = ({
  isOpen,
  onClose,
  socket,
  initialTargetUsername,
  initialTargetAgentNickname,
  onUnreadCountChange,
  unreadTotalCount = 0,
  pendingConversationCounts = {},
  onConversationSeen,
  onStartVoiceCall,
  onStartVideoCall,
  onlineUsernames = [],
  currentUserStarCount = 0,
  currentUserIsGuest = false,
  currentUserGender = null,
  communicationPermissions = null,
  currentUserPermissions = [],
  currentRolePermissions = null,
  chatPermissions = null,
}: DirectMessagesModalProps) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [showListMobile, setShowListMobile] = useState(true);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(
    null,
  );
  const dragStateRef = useRef<{
    offsetX: number;
    offsetY: number;
    dragging: boolean;
  }>({ offsetX: 0, offsetY: 0, dragging: false });
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [search, setSearch] = useState("");
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [chatPreferences, setChatPreferences] = useState<ChatPreferences>(
    defaultChatPreferences,
  );
  const [activeConversationRelation, setActiveConversationRelation] =
    useState<FriendRelationState | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [oldestMessageId, setOldestMessageId] = useState<number | null>(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [mobileCallFeedback, setMobileCallFeedback] = useState<
    "voice" | "video" | null
  >(null);
  const [buzzActive, setBuzzActive] = useState(false);
  const [replyTo, setReplyTo] = useState<{
    id: number;
    senderName: string;
    content: string;
  } | null>(null);
  const [openMessageMenuId, setOpenMessageMenuId] = useState<number | null>(null);
  const [loadedCurrentUserGender, setLoadedCurrentUserGender] = useState<
    "male" | "female" | null
  >(normalizeGender(currentUserGender));
  const [locallyReadLastMessageIds, setLocallyReadLastMessageIds] = useState<
    Record<number, string>
  >({});
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const mobileCallFeedbackTimeoutRef = useRef<number | null>(null);
  const buzzTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const updateViewport = () => {
      setIsMobileViewport(window.innerWidth < 768);
    };
    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  useEffect(
    () => () => {
      if (mobileCallFeedbackTimeoutRef.current != null) {
        window.clearTimeout(mobileCallFeedbackTimeoutRef.current);
      }
      if (buzzTimeoutRef.current != null) {
        window.clearTimeout(buzzTimeoutRef.current);
      }
    },
    [],
  );
  const selectedImageIsGif = isGifImageSource(selectedImage);

  const getDisplayName = (user: {
    username: string;
    displayUsername?: string | null;
    agentNickname?: string | null;
    roleStarCount?: number | null;
  }) =>
    formatAgentDisplayName(
      {
        username: user.username,
        displayUsername: user.displayUsername,
        agentNickname: user.agentNickname,
        roleStarCount: user.roleStarCount,
      },
      currentUserStarCount,
    );
  const getDisplayRoleName = (user: {
    roleName?: string | null;
    agentNickname?: string | null;
  }) => (user.agentNickname ? "Misafir" : user.roleName || "Web Consol ®");
  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) =>
      getDisplayName(c.otherUser).toLowerCase().includes(q),
    );
  }, [conversations, search, currentUserStarCount]);

  const activeConversation = conversations.find(
    (c) => c.id === activeConversationId,
  );
  const storedGuestGender =
    typeof window !== "undefined"
      ? localStorage.getItem("guestGender")
      : null;
  const effectiveCurrentUserGender =
    normalizeGender(currentUserGender) ??
    loadedCurrentUserGender ??
    normalizeGender(storedGuestGender) ??
    "male";
  const activeConversationBackgroundImage =
    effectiveCurrentUserGender === "female"
      ? "/images/kadin.png"
      : "/images/erkek.png";
  const incomingMessageBubbleStyle =
    effectiveCurrentUserGender === "female"
      ? "bg-linear-to-br from-[#f2a9c5] via-[#e98ab0] to-[#d197d7] text-slate-800 shadow-[0_2px_10px_rgba(148,85,120,0.28)]"
      : "bg-linear-to-br from-[#b3d4f6] via-[#83b8ea] to-[#5fa5df] text-slate-800 shadow-[0_2px_10px_rgba(59,130,180,0.28)]";

  useEffect(() => {
    const normalized = normalizeGender(currentUserGender);
    if (normalized) {
      setLoadedCurrentUserGender(normalized);
    }
  }, [currentUserGender]);
  const inferredUnreadCount = useMemo(
    () =>
      conversations.reduce((total, conversation) => {
        const lastMessageId =
          conversation.lastMessage?.id == null
            ? null
            : String(conversation.lastMessage.id);
        const isLocallyRead =
          lastMessageId != null &&
          locallyReadLastMessageIds[conversation.id] === lastMessageId;
        if (isLocallyRead) return total;
        const pendingUnreadCount =
          pendingConversationCounts[conversation.id] ?? 0;
        const effectiveUnreadCount = Math.max(
          conversation.unreadCount ?? 0,
          pendingUnreadCount,
        );
        return total + effectiveUnreadCount;
      }, 0),
    [conversations, locallyReadLastMessageIds, pendingConversationCounts],
  );
  const isActiveConversationBlocked = activeConversation?.isBlocked === true;
  const storedGuestUsername =
    typeof window !== "undefined"
      ? (localStorage.getItem("guestUsername") || "").trim()
      : "";
  const isGuestUser =
    typeof window !== "undefined" &&
    (currentUserIsGuest ||
      localStorage.getItem("isGuest") === "true" ||
      !!storedGuestUsername);
  const currentUsername =
    typeof window !== "undefined"
      ? isGuestUser
        ? storedGuestUsername || localStorage.getItem("guestUsername")
        : localStorage.getItem("username")
      : null;
  const currentAgentNickname =
    typeof window !== "undefined"
      ? (localStorage.getItem("agentNickname") || "").trim()
      : "";

  const hasAccessLevel = (permission: ChatPermission) => {
    if (permission === "EVERYONE") return true;
    if (permission === "MEMBERS") return !isGuestUser;
    return false;
  };

  const isPrivateMessageEnabledForUser = (isGuest: boolean) => {
    if (!communicationPermissions) return true;
    return isGuest
      ? communicationPermissions.guestPrivateMessageEnabled
      : communicationPermissions.membersPrivateMessageEnabled;
  };

  const isVoiceCallEnabledForUser = (isGuest: boolean) => {
    if (!communicationPermissions) return true;
    return isGuest
      ? communicationPermissions.guestVoiceCallEnabled
      : communicationPermissions.membersVoiceCallEnabled;
  };

  const isConversationUserGuest = (
    user?: Pick<Conversation["otherUser"], "isGuest" | "agentNickname"> | null,
  ) => user?.isGuest === true || Boolean(user?.agentNickname);

  const hasBlockPermission = hasEffectivePermission({
    permissionLabel: PERMISSION_LABELS.BLOCK_USER,
    userPermissions: currentUserPermissions,
    rolePermissions: currentRolePermissions,
  });
  const onlineUserSet = useMemo(
    () => new Set(onlineUsernames.map((username) => username.toLowerCase())),
    [onlineUsernames],
  );
  const canCurrentUserPrivateMessage = isPrivateMessageEnabledForUser(isGuestUser);
  const shouldBlockEmptyPrivateMessageEntry =
    isGuestUser && !canCurrentUserPrivateMessage;
  const hasIncomingPrivateMessageNotification = useCallback(
    (conversation: Conversation) => {
      const lastMessageId =
        conversation.lastMessage?.id == null
          ? null
          : String(conversation.lastMessage.id);
      const isLocallyRead =
        lastMessageId != null &&
        locallyReadLastMessageIds[conversation.id] === lastMessageId;
      if (isLocallyRead) return false;

      return (
        Math.max(
          conversation.unreadCount ?? 0,
          pendingConversationCounts[conversation.id] ?? 0,
        ) > 0
      );
    },
    [locallyReadLastMessageIds, pendingConversationCounts],
  );
  const activeConversationTargetIsGuest = isConversationUserGuest(
    activeConversation?.otherUser,
  );
  const canActiveConversationVoiceCall =
    !activeConversation ||
    isVoiceCallEnabledForUser(isGuestUser);
  const activeConversationIsOnline =
    !!activeConversation &&
    (activeConversation.otherUser.isOnline === true ||
      (activeConversation.otherUser.isOnline == null &&
        onlineUserSet.has(activeConversation.otherUser.username.toLowerCase())));
  const canCallActiveConversation =
    !!activeConversation &&
    activeConversationIsOnline &&
    !isActiveConversationBlocked &&
    canActiveConversationVoiceCall &&
    currentUsername !== activeConversation.otherUser.username;
  const isAuthority = currentUserStarCount > 0;
  const canCurrentUserSendVoiceMessage = isAuthority || hasAccessLevel(
    chatPermissions?.chatVoiceRecordSendPermission || "EVERYONE",
  );
  const audioDisabledReason = isGuestUser
    ? "Misafirlere sesli mesaj kapalı."
    : "Üyelere sesli mesaj kapalı.";
  const canSendInActiveConversation =
    activeConversation?.canCurrentUserSendMessage !== false;
  const isBlockedByMe = activeConversationRelation?.isBlockedByMe === true;

  const getPrivateMessageDeniedReason = () => {
    return isGuestUser
      ? "Misafirlere özel mesaj kapalı."
      : "Üyelere özel mesaj kapalı.";
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  };

  const handleScrollToReply = (messageId?: number | null) => {
    if (!messageId) return;
    const element = document.getElementById(`dm-message-${messageId}`);
    if (!element) return;
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    element.classList.add("ring-2", "ring-blue-400", "ring-offset-2");
    window.setTimeout(() => {
      element.classList.remove("ring-2", "ring-blue-400", "ring-offset-2");
    }, 1800);
  };

  const getMessageReplyContent = (message: Message) => {
    const content = (message.content || "").trim();
    if (content) return content;
    if (message.image) return "📷 Görsel";
    if (message.audio) return "🎤 Sesli Mesaj";
    return "...";
  };

  const getReplySenderName = (reply: ReplyToMessage) =>
    reply.sender?.displayUsername?.trim() ||
    reply.sender?.agentNickname?.trim() ||
    reply.sender?.username?.trim() ||
    "Kullanıcı";

  const handleReplyToMessage = (message: Message) => {
    setReplyTo({
      id: message.id,
      senderName: getDisplayName(message.sender),
      content: getMessageReplyContent(message),
    });
    setOpenMessageMenuId(null);
  };

  const markConversationLocallyRead = useCallback((conversationId: number) => {
    setConversations((currentConversations) => {
      const conversation = currentConversations.find(
        (item) => item.id === conversationId,
      );
      const lastMessageId = conversation?.lastMessage?.id;
      if (lastMessageId != null) {
        setLocallyReadLastMessageIds((prev) => ({
          ...prev,
          [conversationId]: String(lastMessageId),
        }));
      }
      return currentConversations;
    });
  }, []);

  const refreshUnread = async () => {
    try {
      const result = await apiClient.directMessages.getUnreadCount();
      onUnreadCountChange?.(result?.unreadCount ?? 0);
    } catch (error) {
      const message =
        error instanceof Error ? error.message.toLowerCase() : "";
      if (!message.includes("timeout")) {
        console.warn("Unread direct message count fetch failed.", error);
      }
    }
  };

  const loadConversations = async () => {
    setLoadingConversations(true);
    try {
      const data = await apiClient.directMessages.listConversations();
      setConversations(data);
      return data as Conversation[];
    } catch (error) {
      const message =
        error instanceof Error ? error.message.toLowerCase() : "";
      if (!message.includes("timeout")) {
        console.warn("Direct conversations fetch failed.", error);
      }
      toast.error("Konuşmalar yüklenemedi. Birazdan tekrar deneyin.");
      setConversations([]);
      return [];
    } finally {
      setLoadingConversations(false);
    }
  };

  useEffect(() => {
    void loadConversations();
    void refreshUnread();
  }, []);

  const selectConversation = async (conversationId: number) => {
    const selectedConversation = conversations.find(
      (conversation) => conversation.id === conversationId,
    );
    const optimisticLastMessage =
      selectedConversation?.lastMessage != null
        ? {
            ...selectedConversation.lastMessage,
            sender:
              selectedConversation.lastMessage.senderId ===
              selectedConversation.otherUser.id
                ? selectedConversation.otherUser
                : {
                    id: 0,
	                    username: currentUsername || "",
	                    displayUsername: currentAgentNickname || currentUsername || "",
	                    gender: "male" as const,
	                    icon: null,
	                    agentNickname: currentAgentNickname || null,
	                    roleStarCount: currentUserStarCount,
                  },
          }
        : null;
    onConversationSeen?.(
      conversationId,
      selectedConversation?.lastMessage?.id ?? null,
    );
    setReplyTo(null);
    setOpenMessageMenuId(null);
    setActiveConversationId(conversationId);
    setShowListMobile(false);
    setMessages(optimisticLastMessage ? [optimisticLastMessage] : []);
    setLoadingMessages(true);
    try {
      const data = await apiClient.directMessages.getMessages(conversationId, {
        limit: 30,
      }, {
        timeout: 30000,
      });
      const ordered = [...data].reverse();
      setMessages((prev) => mergeUniqueMessages([...prev, ...ordered]));
      const conversation = conversations.find((c) => c.id === conversationId);
      const senderIcon = conversation?.otherUser.icon
        ? null
        : ordered.find((message) => message.senderId === conversation?.otherUser.id)
            ?.sender?.icon;
      if (senderIcon) {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === conversationId
              ? { ...c, otherUser: { ...c.otherUser, icon: senderIcon } }
              : c,
          ),
        );
      }
      setOldestMessageId(ordered.length ? ordered[0].id : null);
      setHasMore(data.length === 30);
    } catch (error) {
      const message =
        error instanceof Error ? error.message.toLowerCase() : "";
      if (!message.includes("timeout")) {
        console.warn("Direct messages fetch failed.", error);
      }
      toast.error("Özel mesajlar yüklenemedi. Birazdan tekrar deneyin.");
      setMessages([]);
      setOldestMessageId(null);
      setHasMore(false);
    } finally {
      setLoadingMessages(false);
    }

    try {
      await apiClient.directMessages.markRead(conversationId);
      await refreshUnread();
      markConversationLocallyRead(conversationId);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId ? { ...c, unreadCount: 0 } : c,
        ),
      );
    } catch (error) {
      console.warn("Direct message read state update failed.", error);
    }
    scrollToBottom();
  };

  const loadMore = async () => {
    if (!activeConversationId || !oldestMessageId) return;
    try {
      const data = await apiClient.directMessages.getMessages(
        activeConversationId,
        { limit: 30, beforeId: oldestMessageId },
        { timeout: 30000 },
      );
      if (!data.length) {
        setHasMore(false);
        return;
      }
      const ordered = [...data].reverse();
      setMessages((prev) => mergeUniqueMessages([...ordered, ...prev]));
      setOldestMessageId(ordered[0].id);
      setHasMore(data.length === 30);
    } catch (error) {
      const message =
        error instanceof Error ? error.message.toLowerCase() : "";
      if (!message.includes("timeout")) {
        console.warn("Older direct messages fetch failed.", error);
      }
      toast.error("Eski mesajlar yüklenemedi.");
    }
  };

  const handleSend = async (payload: {
    content?: string;
    image?: string;
    audio?: string;
    audioFileName?: string;
    replyToMessageId?: number;
  }) => {
    if (!activeConversationId || sending) return;
    if (!canSendInActiveConversation) {
      toast.error(getPrivateMessageDeniedReason());
      return;
    }
    if (isActiveConversationBlocked) {
      toast.error("Bu kullanıcıyla özel iletişim engelli.");
      return;
    }

    setSending(true);
    try {
      const data = await apiClient.directMessages.sendMessage(
        activeConversationId,
        payload,
      );
      setMessages((prev) => mergeUniqueMessages([...prev, data]));
      setConversations((prev) => {
        const updated = prev.map((c) =>
          c.id === activeConversationId
            ? {
                ...c,
                lastMessage: {
                  id: data.id,
                  content: data.content,
                  image: data.image,
                  audio: data.audio,
                  audioFileName: data.audioFileName,
                  replyToMessage: data.replyToMessage ?? null,
                  senderId: data.senderId,
                  createdAt: data.createdAt,
                },
                lastMessageAt: data.createdAt,
              }
            : c,
        );
        return [...updated].sort(
          (a, b) =>
            new Date(b.lastMessageAt || 0).getTime() -
            new Date(a.lastMessageAt || 0).getTime(),
        );
      });
      setReplyTo(null);
      scrollToBottom();
    } catch (error) {
      if (error instanceof ApiError && error.status === 403 && error.message) {
        toast.error(error.message);
        return;
      }

      toast.error("Mesaj gonderilirken bir hata olustu.");
    } finally {
      setSending(false);
    }
  };

  const handleCreateConversation = async (username: string, agentNickname?: string | null) => {
    const trimmed = username.trim();
    if (!trimmed) return;
    if (!canCurrentUserPrivateMessage) {
      toast.error(getPrivateMessageDeniedReason());
      return;
    }
    try {
      const data = await apiClient.directMessages.createConversation(trimmed, agentNickname);
      await loadConversations();
      const created = data?.conversationId;
      if (created) {
        await selectConversation(created);
      }
    } catch (error) {
      if (error instanceof ApiError && error.message?.trim()) {
        toast.error(error.message);
        return;
      }
      toast.error("Konuşma başlatılamadı.");
    }
  };

  const showMobileCallFeedback = (type: "voice" | "video") => {
    setMobileCallFeedback(type);
    if (mobileCallFeedbackTimeoutRef.current != null) {
      window.clearTimeout(mobileCallFeedbackTimeoutRef.current);
    }
    mobileCallFeedbackTimeoutRef.current = window.setTimeout(() => {
      setMobileCallFeedback(null);
      mobileCallFeedbackTimeoutRef.current = null;
    }, 2200);
  };

  const triggerBuzzAnimation = () => {
    if (buzzTimeoutRef.current != null) {
      window.clearTimeout(buzzTimeoutRef.current);
    }
    setBuzzActive(false);
    window.requestAnimationFrame(() => {
      setBuzzActive(true);
      buzzTimeoutRef.current = window.setTimeout(() => {
        setBuzzActive(false);
        buzzTimeoutRef.current = null;
      }, 900);
    });
  };

  const startDirectCall = (type: "voice" | "video") => {
    if (!activeConversation) return;
    if (!canCallActiveConversation) {
      toast.error("Bu kullanıcıyla arama başlatılamıyor.");
      return;
    }

    const callTarget = {
      username: activeConversation.otherUser.username,
      displayUsername: getDisplayName(activeConversation.otherUser),
      gender: activeConversation.otherUser.gender,
      icon: activeConversation.otherUser.icon ?? null,
      roleName: getDisplayRoleName(activeConversation.otherUser),
      isGuest: activeConversationTargetIsGuest,
      agentNickname: activeConversation.otherUser.agentNickname ?? null,
      roleStarCount: activeConversation.otherUser.roleStarCount ?? null,
    };

    showMobileCallFeedback(type);
    toast.info(
      type === "voice"
        ? `${callTarget.displayUsername} sesli aranıyor...`
        : `${callTarget.displayUsername} görüntülü aranıyor...`,
    );

    if (type === "voice") {
      onStartVoiceCall?.(callTarget);
      return;
    }
    onStartVideoCall?.(callTarget);
  };

  const loadActiveConversationRelation = async (
    username?: string | null,
    agentNickname?: string | null,
  ): Promise<FriendRelationState | null> => {
    const trimmedUsername = username?.trim();
    if (!trimmedUsername) {
      setActiveConversationRelation(null);
      return null;
    }
    try {
      const relation = await apiClient.friends.getRelation(
        trimmedUsername,
        agentNickname,
      );
      setActiveConversationRelation(relation);
      return relation;
    } catch {
      setActiveConversationRelation(null);
      return null;
    }
  };

  const handleMenuAction = async (action: DirectMessageMenuAction) => {
    if (!activeConversationId || !activeConversation) return;

    if (action === "image") return;

    if (action === "buzz") {
      triggerBuzzAnimation();
      try {
        await apiClient.directMessages.buzzConversation(activeConversationId);
      } catch (error) {
        const message =
          error instanceof ApiError && error.message?.trim()
            ? error.message
            : "Titret gönderilemedi.";
        toast.error(message);
      }
      return;
    }

    if (action === "clear") {
      try {
        await apiClient.directMessages.clearConversation(activeConversationId);
        setMessages([]);
        setConversations((prev) =>
          prev.map((conversation) =>
            conversation.id === activeConversationId
              ? { ...conversation, lastMessage: null, lastMessageAt: null, unreadCount: 0 }
              : conversation,
          ),
        );
        await refreshUnread();
        toast.success("Konuşma ekranı temizlendi.");
      } catch (error) {
        const message =
          error instanceof ApiError && error.message?.trim()
            ? error.message
            : "Ekran temizlenirken bir hata oluştu.";
        toast.error(message);
      }
      return;
    }

    if (action === "delete") {
      try {
        await apiClient.directMessages.deleteConversation(activeConversationId);

        let nextConversationId: number | null = null;
        setConversations((prev) => {
          const filtered = prev.filter(
            (conversation) => conversation.id !== activeConversationId,
          );
          nextConversationId = filtered[0]?.id ?? null;
          return filtered;
        });

        if (nextConversationId) {
          await selectConversation(nextConversationId);
        } else {
          setActiveConversationId(null);
          setMessages([]);
          setShowListMobile(true);
        }

        await refreshUnread();
        toast.success("Konuşma silindi.");
      } catch (error) {
        const message =
          error instanceof ApiError && error.message?.trim()
            ? error.message
            : "Konuşma silinirken bir hata oluştu.";
        toast.error(message);
      }
      return;
    }

    if (action === "block") {
      if (!hasBlockPermission) {
        toast.error("Engel yetkiniz yok.");
        return;
      }
      const targetUsername = activeConversation.otherUser.username?.trim();
      if (!targetUsername) return;

      if (targetUsername === currentUsername) {
        toast.error("Kendinizi engelleyemezsiniz.");
        return;
      }

      try {
        const relation =
	          activeConversationRelation ??
	          (await apiClient.friends.getRelation(
	            targetUsername,
	            activeConversation.otherUser.agentNickname,
	          ));
        if (relation?.isBlockedByMe) {
          await apiClient.friends.unblockUser(targetUsername);
          toast.success("Kullanıcının engeli kaldırıldı.");
        } else {
	          await apiClient.friends.blockUser(
	            targetUsername,
	            activeConversation.otherUser.agentNickname,
	          );
          toast.success("Kullanıcı engellendi.");
        }

        await Promise.all([
	          loadActiveConversationRelation(
	            targetUsername,
	            activeConversation.otherUser.agentNickname,
	          ),
          loadConversations(),
        ]);
      } catch (error) {
        const message =
          error instanceof ApiError && error.message?.trim()
            ? error.message
            : "İşlem başarısız oldu.";
        toast.error(message);
      }
    }
  };

  const handleClearAllConversations = async () => {
    const confirmed = window.confirm(
      "Tüm özel mesaj geçmişini bu cihazdan temizlemek istiyor musunuz?",
    );
    if (!confirmed) return;

    try {
      await apiClient.directMessages.clearHistory();
      setConversations([]);
      setActiveConversationId(null);
      setMessages([]);
      setShowListMobile(true);
      await refreshUnread();
      toast.success("Özel mesaj listesi temizlendi.");
    } catch (error) {
      const message =
        error instanceof ApiError && error.message?.trim()
          ? error.message
          : "Mesajlar temizlenirken bir hata oluştu.";
      toast.error(message);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const guestMode =
      typeof window !== "undefined" &&
      localStorage.getItem("isGuest") === "true";
    const fromStorage = readChatPreferencesFromStorage();
    setChatPreferences(fromStorage);
    const storedGender =
      typeof window !== "undefined"
        ? normalizeGender(localStorage.getItem("guestGender"))
        : null;
    if (storedGender) {
      setLoadedCurrentUserGender(storedGender);
    }

    if (!guestMode) {
      apiClient.auth
        .me()
        .then((me) => {
          const merged = mergeChatPreferences(me?.chatPreferences);
          setChatPreferences(merged);
          writeChatPreferencesToStorage(merged);
          const meGender = normalizeGender(me?.gender);
          if (meGender) {
            setLoadedCurrentUserGender(meGender);
          }
        })
        .catch((error) => {
          console.error("DM preferences /auth/me yuklenemedi", error);
        });
    }

    setShowListMobile(true);
    setActiveConversationId(null);
    setMessages([]);
    setReplyTo(null);
    setOpenMessageMenuId(null);
    setOldestMessageId(null);
    setHasMore(false);
    setActiveConversationRelation(null);
    if (typeof window !== "undefined") {
      const width = 820;
      const height = 620;
      const x = Math.max(20, Math.round((window.innerWidth - width) * 0.52));
      const y = Math.max(12, Math.round((window.innerHeight - height) / 3));
      setPosition({ x, y });
    }
    loadConversations().then(async (data) => {
      const allowedNotificationConversations = data.filter(
        hasIncomingPrivateMessageNotification,
      );

      if (initialTargetUsername) {
        if (shouldBlockEmptyPrivateMessageEntry) {
          const normalizedTarget = initialTargetUsername
            .trim()
            .toLocaleLowerCase("tr-TR");
          const existingConversation = allowedNotificationConversations.find(
            (conversation) =>
              conversation.otherUser.username
                .trim()
                .toLocaleLowerCase("tr-TR") === normalizedTarget &&
              (initialTargetAgentNickname
                ? (conversation.otherUser.agentNickname || "")
                    .trim()
                    .toLocaleLowerCase("tr-TR") ===
                  initialTargetAgentNickname.trim().toLocaleLowerCase("tr-TR")
                : true),
          );

          if (existingConversation) {
            await selectConversation(existingConversation.id);
            return;
          }

          toast.error(getPrivateMessageDeniedReason());
          onClose();
          return;
        }
        await handleCreateConversation(initialTargetUsername, initialTargetAgentNickname);
        return;
      }

      if (shouldBlockEmptyPrivateMessageEntry) {
        if (allowedNotificationConversations.length === 0) {
          toast.error(getPrivateMessageDeniedReason());
          onClose();
          return;
        }
        setConversations(allowedNotificationConversations);
      }
    });
    refreshUnread();
  }, [isOpen, initialTargetUsername]);

  useEffect(() => {
    if (!isOpen || inferredUnreadCount <= 0) return;
    const nextUnreadCount = Math.max(unreadTotalCount, inferredUnreadCount);
    console.log("[DM_MOBILE_UNREAD_INFERRED]", {
      unreadTotalCount,
      inferredUnreadCount,
      nextUnreadCount,
      conversations: conversations.map((conversation) => ({
        id: conversation.id,
        otherUsername: conversation.otherUser.username,
        lastMessageId: conversation.lastMessage?.id ?? null,
        lastMessageAt: conversation.lastMessageAt || conversation.lastMessage?.createdAt || null,
        lastMessageSenderId: conversation.lastMessage?.senderId ?? null,
        otherUserId: conversation.otherUser.id,
        apiUnreadCount: conversation.unreadCount ?? 0,
        pendingUnreadCount: pendingConversationCounts[conversation.id] ?? 0,
        locallyReadLastMessageId:
          locallyReadLastMessageIds[conversation.id] ?? null,
      })),
    });
    onUnreadCountChange?.(nextUnreadCount);
  }, [
    conversations,
    inferredUnreadCount,
    isOpen,
    locallyReadLastMessageIds,
    onUnreadCountChange,
    pendingConversationCounts,
    unreadTotalCount,
  ]);

  useEffect(() => {
    if (!isOpen) return;

    const refreshConversations = () => {
      if (document.visibilityState !== "visible") return;
      void loadConversations();
      void refreshUnread();
    };

    const delayedRefreshId = window.setTimeout(refreshConversations, 1200);
    const pollingRefreshId = window.setInterval(refreshConversations, 4000);

    return () => {
      window.clearTimeout(delayedRefreshId);
      window.clearInterval(pollingRefreshId);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!socket || !isOpen) return;
    const handleNewMessage = (payload: DirectMessageSocketPayload) => {
      const conversationId = payload?.conversationId;
      if (!conversationId) return;

      setConversations((prev) => {
        const existing = prev.find((c) => c.id === conversationId);
        if (!existing) {
          loadConversations().then((conversations) => {
            const incomingConversation = conversations.find(
              (conversation) => conversation.id === conversationId,
            );

            if (incomingConversation && activeConversationId == null) {
              void selectConversation(conversationId);
              return;
            }

            if (incomingConversation) {
              setConversations(conversations);
            }
            void refreshUnread();
          });
          return prev;
        }

        const updated = prev.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                otherUser:
                  payload?.sender?.id === c.otherUser.id
                    ? {
                        ...c.otherUser,
                        displayUsername:
                          payload?.sender?.displayUsername ||
                          c.otherUser.displayUsername,
                        agentNickname:
                          payload?.sender?.agentNickname === undefined
                            ? c.otherUser.agentNickname
                            : payload?.sender?.agentNickname,
                        roleStarCount:
                          payload?.sender?.roleStarCount === undefined
                            ? c.otherUser.roleStarCount
                            : payload?.sender?.roleStarCount,
                        icon:
                          payload?.sender?.icon === undefined
                            ? c.otherUser.icon
                            : payload?.sender?.icon,
                      }
                    : c.otherUser,
                lastMessage: {
                  id: payload.message?.id,
                  content: payload.message?.content,
                  image: payload.message?.image,
                  audio: payload.message?.audio,
                  audioFileName: payload.message?.audioFileName,
                  replyToMessage: payload.message?.replyToMessage ?? null,
                  senderId: payload.message?.senderId,
                  createdAt: payload.message?.createdAt,
                },
                lastMessageAt: payload.message?.createdAt,
                unreadCount:
                  c.id === activeConversationId ? 0 : payload.unreadCount ?? c.unreadCount + 1,
                canCurrentUserSendMessage:
                  payload?.message?.senderId === c.otherUser.id
                    ? true
                    : c.canCurrentUserSendMessage,
              }
            : c,
        );
        return [...updated].sort(
          (a, b) =>
            new Date(b.lastMessageAt || 0).getTime() -
            new Date(a.lastMessageAt || 0).getTime(),
        );
      });

      if (conversationId === activeConversationId) {
        setMessages((prev) =>
          mergeUniqueMessages([
            ...prev,
            {
              id: payload.message?.id,
              content: payload.message?.content,
              image: payload.message?.image,
              audio: payload.message?.audio,
              audioFileName: payload.message?.audioFileName,
              replyToMessage: payload.message?.replyToMessage ?? null,
              senderId: payload.message?.senderId,
              sender: payload.sender,
              createdAt: payload.message?.createdAt,
            },
          ]),
        );
        apiClient.directMessages.markRead(conversationId).then(refreshUnread);
        scrollToBottom();
      } else {
        void refreshUnread();
      }
    };

    socket.on("dm:newMessage", handleNewMessage);
    return () => {
      socket.off("dm:newMessage", handleNewMessage);
    };
  }, [socket, isOpen, activeConversationId]);

  useEffect(() => {
    if (!socket || !isOpen) return;

    const handleBuzz = (payload: DirectMessageBuzzPayload) => {
      const conversationId = payload?.conversationId;
      if (!conversationId) return;

      if (String(conversationId) === String(activeConversationId)) {
        triggerBuzzAnimation();
      }
    };

    socket.on("dm:buzz", handleBuzz);
    return () => {
      socket.off("dm:buzz", handleBuzz);
    };
  }, [socket, isOpen, activeConversationId]);

  useEffect(() => {
    if (!activeConversation?.otherUser?.username) {
      setActiveConversationRelation(null);
      return;
    }
    void loadActiveConversationRelation(
      activeConversation.otherUser.username,
      activeConversation.otherUser.agentNickname,
    );
  }, [
    activeConversation?.otherUser?.username,
    activeConversation?.otherUser?.agentNickname,
  ]);

  useEffect(() => {
    if (!isImageModalOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setIsImageModalOpen(false);
      setSelectedImage(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isImageModalOpen]);

  if (!isOpen) return null;

  const isMobileConversationView =
    isMobileViewport && !showListMobile && Boolean(activeConversation);

  return (
    <div
      className={`fixed inset-0 z-[1200] ${
        isMobileViewport ? "pointer-events-auto bg-black/45" : "pointer-events-none"
      }`}
      onClick={(event) => {
        if (!isMobileViewport || isMobileConversationView) return;
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={containerRef}
        className={`pointer-events-auto fixed flex flex-col overflow-hidden border border-[color-mix(in_srgb,var(--chat-accent)_30%,#dbeafe)] bg-white shadow-[0_24px_70px_rgba(2,8,23,0.26)] ring-1 ring-white/70 ${
          isMobileConversationView
            ? "inset-0 h-[100svh] w-full rounded-none"
            : isMobileViewport
              ? "inset-x-0 bottom-0 h-[min(62svh,460px)] w-full rounded-t-[20px]"
              : "inset-x-3 top-6 h-[min(76dvh,620px)] max-h-[calc(100dvh-48px)] rounded-2xl md:rounded-[18px] md:w-[82vw] md:max-w-[760px] md:h-[68vh] md:max-h-[600px]"
        }`}
        style={
          isMobileViewport
            ? undefined
            : position
            ? { left: position.x, top: position.y, position: "absolute" }
            : { right: 24, top: 80, position: "absolute" }
        }
      >
        <div
          className={`relative z-10 flex shrink-0 select-none items-center justify-between border-b border-zinc-200 px-4 md:cursor-move md:px-5 ${
            isMobileViewport
              ? "h-[62px] bg-white text-zinc-950"
              : "h-12 bg-white text-zinc-950 shadow-[0_1px_0_rgba(255,255,255,0.8)_inset]"
          }`}
          onMouseDown={(event) => {
            if (isMobileViewport) return;
            const target = containerRef.current;
            if (!target) return;
            const rect = target.getBoundingClientRect();
            dragStateRef.current = {
              offsetX: event.clientX - rect.left,
              offsetY: event.clientY - rect.top,
              dragging: true,
            };
            const handleMove = (moveEvent: MouseEvent) => {
              if (!dragStateRef.current.dragging) return;
              setPosition({
                x: Math.max(8, moveEvent.clientX - dragStateRef.current.offsetX),
                y: Math.max(8, moveEvent.clientY - dragStateRef.current.offsetY),
              });
            };
            const handleUp = () => {
              dragStateRef.current.dragging = false;
              window.removeEventListener("mousemove", handleMove);
              window.removeEventListener("mouseup", handleUp);
            };
            window.addEventListener("mousemove", handleMove);
            window.addEventListener("mouseup", handleUp);
          }}
        >
          {!isMobileViewport && (
            <span className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-[var(--chat-accent)]" />
          )}
          {isMobileConversationView && activeConversation ? (
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <button
                type="button"
                onClick={() => setShowListMobile(true)}
                className="flex h-10 w-8 shrink-0 items-center justify-center text-[#0a84ff]"
                aria-label="Mesaj listesine dön"
              >
                <ArrowLeft className="h-7 w-7" />
              </button>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-200 font-semibold text-white">
                {(() => {
                  const icon = resolveIcon(activeConversation.otherUser.icon || null);
                  const displayName = getDisplayName(activeConversation.otherUser);
                  return icon ? (
                    <img src={icon} alt="icon" className="h-full w-full object-cover" />
                  ) : (
                    displayName.charAt(0).toUpperCase()
                  );
                })()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[20px] font-bold leading-tight text-black">
                  {getDisplayName(activeConversation.otherUser)}
                </p>
                <p className="truncate text-[16px] leading-tight text-zinc-500">
                  {getDisplayRoleName(activeConversation.otherUser)}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex min-w-0 items-center gap-3">
              {!isMobileViewport && (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[var(--chat-accent)] shadow-sm ring-1 ring-[color-mix(in_srgb,var(--chat-accent)_26%,#e5e7eb)]">
                  <MessageSquare className="h-4 w-4" />
                </div>
              )}
              <div className="flex min-w-0 flex-col">
                <p
                  className={`truncate font-bold leading-none ${
                    isMobileViewport ? "text-[23px] text-black" : "text-[18px] text-zinc-950"
                  }`}
                >
                  {isMobileViewport ? "Mesajlar" : "Özel Mesajlar"}
                </p>
                {!isMobileViewport && (
                  <p className="mt-0.5 truncate text-[12px] leading-none text-zinc-500">
                    Anlık ve güvenli sohbet
                  </p>
                )}
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            {isMobileConversationView ? (
              <>
                <button
                  type="button"
                  onClick={() => startDirectCall("voice")}
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-[#0a84ff] transition ${
                    mobileCallFeedback === "voice"
                      ? "bg-[#0a84ff] text-white shadow-[0_4px_12px_rgba(10,132,255,0.32)]"
                      : "active:bg-blue-50"
                  }`}
                  aria-label="Sesli ara"
                >
                  <Phone
                    className={`h-6 w-6 ${
                      mobileCallFeedback === "voice" ? "fill-white/15" : "fill-[#0a84ff]/10"
                    }`}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => startDirectCall("video")}
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-[#0a84ff] transition ${
                    mobileCallFeedback === "video"
                      ? "bg-[#0a84ff] text-white shadow-[0_4px_12px_rgba(10,132,255,0.32)]"
                      : "active:bg-blue-50"
                  }`}
                  aria-label="Görüntülü ara"
                >
                  <Video className="h-6 w-6" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowOptionsMenu((prev) => !prev)}
                  className="flex h-10 w-8 items-center justify-center rounded-full text-[#0a84ff]"
                  aria-label="Özel mesaj seçenekleri"
                >
                  <MoreVertical className="h-6 w-6" />
                </button>
              </>
            ) : (
              <button
                onClick={onClose}
                className={`rounded-full p-2 ${
                  isMobileViewport
                    ? "text-zinc-400 hover:bg-zinc-100"
                    : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950"
                }`}
                aria-label="Özel mesajları kapat"
              >
                <X className={isMobileViewport ? "h-7 w-7" : "h-4.5 w-4.5"} />
              </button>
            )}
          </div>
        </div>

        {isMobileConversationView && mobileCallFeedback && activeConversation && (
          <div className="pointer-events-none absolute left-1/2 top-[82px] z-30 -translate-x-1/2 rounded-full bg-black/82 px-4 py-2 text-[13px] font-semibold text-white shadow-lg">
            {mobileCallFeedback === "voice" ? "Sesli aranıyor..." : "Görüntülü aranıyor..."}
          </div>
        )}

        {isMobileConversationView && showOptionsMenu && (
          <>
            <button
              type="button"
              className="absolute inset-0 z-20 bg-black/35"
              aria-label="Özel mesaj menüsünü kapat"
              onClick={() => setShowOptionsMenu(false)}
            />
            <div className="absolute right-4 top-[72px] z-30 w-[220px] overflow-visible rounded-[12px] bg-white text-center shadow-2xl">
              <span className="absolute -top-3 right-8 h-0 w-0 border-x-[12px] border-b-[12px] border-x-transparent border-b-white" />
              {[
                { label: "Ekran Temizle", action: "clear" as DirectMessageMenuAction },
                { label: "Sohbeti Sil", action: "delete" as DirectMessageMenuAction },
                {
                  label: isBlockedByMe ? "Engel aç" : "Engelle / Engel aç",
                  action: "block" as DirectMessageMenuAction,
                },
                { label: "Titret", action: "buzz" as DirectMessageMenuAction },
              ].map((item, index) => (
                <button
                  key={item.action}
                  type="button"
                  onClick={() => {
                    setShowOptionsMenu(false);
                    void handleMenuAction(item.action);
                  }}
                  className={`block h-12 w-full text-[18px] font-normal text-[#0a84ff] ${
                    index > 0 ? "border-t border-zinc-200" : ""
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="flex min-h-0 flex-1">
          <div
            className={`w-full min-w-0 border-r border-zinc-200 bg-[#f6f8fb] md:w-[34%] ${
              showListMobile ? "block" : "hidden md:block"
            } flex flex-col min-h-0`}
          >
            <div className="shrink-0 p-2 md:p-3">
              <div className="flex items-center gap-2">
                <div className="relative min-w-0 flex-1">
                  <Search
                    className={`absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 ${
                      isMobileViewport ? "h-4.5 w-4.5" : "h-4 w-4"
                    }`}
                  />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={
                      isMobileViewport
                        ? "Mesaj kişilerinde ara..."
                        : "Kişi ara..."
                    }
                    className={`w-full border border-zinc-200 bg-white text-zinc-900 outline-none transition focus:border-[var(--chat-accent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--chat-accent)_18%,transparent)] ${
                      isMobileViewport
                        ? "h-9 rounded-[9px] px-9 text-[14px] placeholder:text-zinc-400"
                        : "rounded-xl px-8 py-2 text-[13px] placeholder:text-zinc-400"
                    }`}
                  />
                </div>
                {isMobileViewport && filteredConversations.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAllConversations}
                    className="h-9 shrink-0 rounded-[9px] bg-[#ff3b30] px-3 text-[13px] font-semibold text-white active:bg-red-600"
                  >
                    Tümünü Sil
                  </button>
                )}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2.5">
              {loadingConversations && conversations.length === 0 ? (
                <div className="py-10 text-center text-sm text-zinc-500">
                  Yukleniyor...
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="py-10 text-center text-sm text-zinc-500">
                  Hiç mesaj bulunamadı
                </div>
              ) : (
                <div className={isMobileViewport ? "space-y-0 bg-white" : "space-y-2"}>
                  {filteredConversations.map((c) => {
                    const icon = resolveIcon(c.otherUser.icon || null);
                    const displayName = getDisplayName(c.otherUser);
                    const isActive = c.id === activeConversationId;
                    const pendingUnreadCount = pendingConversationCounts[c.id] ?? 0;
                    const lastMessageId =
                      c.lastMessage?.id == null ? null : String(c.lastMessage.id);
                    const isLocallyRead =
                      lastMessageId != null &&
                      locallyReadLastMessageIds[c.id] === lastMessageId;
                    const effectiveUnreadCount = isLocallyRead
                      ? 0
                      : Math.max(
                          c.unreadCount ?? 0,
                          pendingUnreadCount,
                        );
                    const hasPendingUnread = effectiveUnreadCount > 0;
                    return (
                      <button
                        key={c.id}
                        onClick={() => selectConversation(c.id)}
                        className={
                          isMobileViewport
                            ? `flex w-full items-center gap-2.5 border-b px-2.5 py-2 text-left transition ${
                                hasPendingUnread
                                  ? "border-red-200 bg-red-50 active:bg-red-100"
                                  : "border-zinc-200 bg-white active:bg-zinc-50"
                              }`
                            : `flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition ${
                                isActive
                                  ? "border-[color-mix(in_srgb,var(--chat-accent)_42%,#bfdbfe)] bg-white shadow-[0_10px_26px_rgba(15,23,42,0.08)] ring-1 ring-[color-mix(in_srgb,var(--chat-accent)_14%,transparent)]"
                                  : hasPendingUnread
                                    ? "border-red-200 bg-red-50 hover:border-red-300 hover:bg-white"
                                    : "border-transparent hover:border-zinc-200 hover:bg-white"
                              }`
                        }
                      >
                        <div
                          className={`flex items-center justify-center overflow-hidden rounded-full font-semibold text-white ${
                            isMobileViewport ? "h-10 w-10" : "h-9 w-9 text-[13px]"
                          } ${
                            c.otherUser.gender === "male"
                              ? "bg-linear-to-br from-blue-500 to-blue-600"
                              : "bg-linear-to-br from-pink-500 to-pink-600"
                          }`}
                        >
                          {icon ? (
                            <img src={icon} alt="icon" className="h-full w-full object-cover" />
                          ) : (
                            displayName.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`truncate ${
                                isMobileViewport ? "text-[16px]" : "text-[13px]"
                              } ${
                                hasPendingUnread
                                  ? isMobileViewport
                                    ? "font-bold text-red-600"
                                    : "font-bold text-zinc-950"
                                  : "font-semibold text-zinc-900"
                              }`}
                            >
                              {displayName}
                            </span>
                            {isMobileViewport && (
                              <span className="shrink-0 text-[12px] text-zinc-400">
                                {formatConversationDate(c.lastMessageAt || c.lastMessage?.createdAt)}
                              </span>
                            )}
                            {hasPendingUnread && !isMobileViewport && (
                              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-2 text-[10px] font-bold text-white">
                                {effectiveUnreadCount}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <p
                              className={`truncate ${
                                isMobileViewport ? "text-[14px]" : "text-[11px]"
                              } ${
                                hasPendingUnread
                                  ? "font-semibold text-red-600"
                                  : "text-zinc-500"
                              }`}
                            >
                              {getPreview(c.lastMessage)}
                            </p>
                            {hasPendingUnread && isMobileViewport && (
                              <span className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-[#0a84ff] px-1.5 text-[12px] font-bold text-white">
                                {effectiveUnreadCount}
                              </span>
                            )}
                          </div>
                        </div>
                        {isMobileViewport && (
                          <ChevronRight className="h-6 w-6 shrink-0 text-zinc-300" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div
            className={`min-h-0 min-w-0 flex-1 flex-col ${
              showListMobile ? "hidden md:flex" : "flex"
            }`}
          >
            {activeConversation ? (
              <>
                <div className="hidden shrink-0 border-b border-zinc-200 bg-white px-3 py-3 md:block md:px-4 md:py-3">
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => setShowListMobile(true)}
                      className="rounded-full px-2 py-1 text-xs font-semibold text-zinc-500 hover:bg-zinc-100 md:hidden"
                    >
                      Liste
                    </button>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-linear-to-br from-blue-500 to-purple-600 text-[13px] font-semibold text-white">
                      {(() => {
                        const icon = resolveIcon(
                          activeConversation.otherUser.icon || null,
                        );
                        const displayName = getDisplayName(
                          activeConversation.otherUser,
                        );
                        return icon ? (
                          <img
                            src={icon}
                            alt="icon"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          displayName.charAt(0).toUpperCase()
                        );
                      })()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-semibold text-zinc-900">
                        {getDisplayName(activeConversation.otherUser)}
                      </p>
                      <p className="text-[11px] text-zinc-500">Aktif sohbet</p>
                    </div>
                  </div>
                </div>

                <div
                  className={`min-h-0 overflow-y-auto overscroll-contain px-3 py-4 md:flex-1 md:px-4 md:py-3 ${
                    isMobileConversationView
                      ? "h-[calc(100svh-76px-58px)] shrink-0 pb-4"
                      : "flex-1"
                  } ${buzzActive ? "dm-buzz-wave" : ""}`}
                  style={{
                    backgroundColor: "#f3eef4",
                    backgroundImage: `url("${activeConversationBackgroundImage}")`,
                    backgroundPosition: "center",
                    backgroundRepeat: "no-repeat",
                    backgroundSize: "cover",
                  }}
                >
                  {loadingMessages && messages.length === 0 ? (
                    <div className="py-10 text-center text-sm text-zinc-500">
                      Yukleniyor...
                    </div>
                  ) : (
                    <>
                      {loadingMessages && messages.length > 0 && (
                        <div className="mb-3 text-center text-[11px] font-medium text-zinc-500">
                          Geçmiş yükleniyor...
                        </div>
                      )}
                      {isActiveConversationBlocked && (
                        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-800">
                          Bu kullanıcıyla özel iletişim engellendi. Mesaj gönderemez ve özel arama başlatamazsınız.
                        </div>
                      )}
                      {!canSendInActiveConversation && (
                        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-800">
                          {getPrivateMessageDeniedReason()}
                        </div>
                      )}
                      {!canActiveConversationVoiceCall && (
                        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-800">
                          {activeConversationTargetIsGuest
                            ? "Misafirlere sesli/görüntülü arama kapalı."
                            : "Üyelere sesli/görüntülü arama kapalı."}
                        </div>
                      )}
                      {hasMore && (
                        <div className="mb-4 flex justify-center">
                          <button
                            onClick={loadMore}
                            className="rounded-full border border-zinc-200 bg-white px-4 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-100"
                          >
                            Daha eski mesajlar
                          </button>
                        </div>
                      )}
                      <div className={`space-y-2.5 ${buzzActive ? "dm-buzz-wave" : ""}`}>
                        {messages.map((m) => {
                          const isMe = m.senderId !== activeConversation.otherUser.id;
                          const isGifDmImage = isGifImageSource(m.image);
                          const hasStandaloneImage =
                            Boolean(m.image) &&
                            !m.content &&
                            !m.audio &&
                            !m.image?.includes("/animasyonlar/") &&
                            !m.image?.includes("/emom/");
                          const messageTimeClass = isMe
                            ? "text-zinc-500"
                            : "text-slate-500";
                          const messageBubbleStyle = hasStandaloneImage
                            ? "bg-transparent shadow-none"
                            : isMe
                              ? "bg-white text-zinc-900 shadow-[0_2px_8px_rgba(15,23,42,0.16)]"
                              : incomingMessageBubbleStyle;
                          return (
                            <div
                              key={m.id}
                              id={`dm-message-${m.id}`}
                              className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                            >
                              {isMe && (
                                <div className="relative mt-1.5 self-start">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setOpenMessageMenuId((current) =>
                                        current === m.id ? null : m.id,
                                      )
                                    }
                                    className="mr-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white/70 text-zinc-500 shadow-sm hover:bg-white hover:text-zinc-800"
                                    aria-label="Mesaj seçenekleri"
                                  >
                                    <MoreVertical className="h-3 w-3" />
                                  </button>
                                  {openMessageMenuId === m.id && (
                                    <div className="absolute left-0 top-full z-40 mt-1 w-40 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-xl">
                                      <button
                                        type="button"
                                        onClick={() => handleReplyToMessage(m)}
                                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                                      >
                                        <Reply className="h-3.5 w-3.5 text-zinc-500" />
                                        Alıntı ile cevapla
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                              <div
                                className={`w-fit max-w-[86%] text-sm shadow-sm md:max-w-[70%] ${
                                  isMobileConversationView
                                    ? `rounded-[16px] text-[16px] leading-snug ${messageBubbleStyle} ${
                                        isMe ? "rounded-br-[6px]" : "rounded-bl-[6px]"
                                      }`
                                    : isMe
                                      ? "rounded-xl bg-white px-3 py-1.5 text-[13px] text-zinc-900 shadow-[0_2px_8px_rgba(15,23,42,0.16)] md:px-3 md:py-1.5"
                                      : `rounded-xl px-3 py-1.5 text-[13px] md:px-3 md:py-1.5 ${incomingMessageBubbleStyle}`
                                }`}
                              >
                                {m.replyToMessage && (
                                  <button
                                    type="button"
                                    onClick={() => handleScrollToReply(m.replyToMessage?.id)}
                                    className={`mb-1 block max-w-[170px] rounded-md border-l-4 px-2 py-1 text-left leading-tight transition hover:opacity-85 ${
                                      isMe
                                        ? "border-blue-400 bg-blue-50/90"
                                        : "border-slate-400 bg-white/55"
                                    }`}
                                  >
                                    <span className="block truncate text-[11px] font-semibold text-blue-700">
                                      {getReplySenderName(m.replyToMessage)}
                                    </span>
                                    <span className="block truncate text-[11px] text-zinc-600">
                                      {renderEmojiContent(m.replyToMessage.content || "...")}
                                    </span>
                                  </button>
                                )}
                                {m.content && (
                                  <p
                                    className={`flow-root whitespace-pre-wrap ${
                                      isMobileConversationView
                                        ? "px-3 py-2"
                                        : ""
                                    }`}
                                  >
                                    {renderEmojiContent(m.content)}
                                    {!hasStandaloneImage && (
                                      <span
                                        className={`float-right ml-2 mt-1 whitespace-nowrap text-[12px] leading-none ${messageTimeClass}`}
                                      >
                                        {formatMessageTime(m.createdAt)}
                                      </span>
                                    )}
                                  </p>
                                )}
                                {!hasStandaloneImage && !m.content && (
                                  <p
                                    className={`text-right leading-none ${
                                      isMobileConversationView
                                        ? `px-3 pb-2 text-[12px] ${messageTimeClass}`
                                        : `mt-0.5 text-[11px] ${messageTimeClass}`
                                    }`}
                                  >
                                    {formatMessageTime(m.createdAt)}
                                  </p>
                                )}
                                {m.image && (
                                  <>
                                    {m.image.includes("/animasyonlar/") ? (
                                      <img
                                        src={resolveAnimationImageSrc(m.image, m.id)}
                                        alt="animation"
                                        className="mt-2 h-[71px] w-[100px] object-contain"
                                      />
                                    ) : m.image.includes("/emom/") ? (
                                      <img
                                        src={m.image}
                                        alt="emoji"
                                        className="mt-2 h-16 w-16 object-contain"
                                      />
                                    ) : (
                                      <div
                                        className={
                                          isMobileConversationView
                                            ? `relative inline-block overflow-hidden rounded-[15px] bg-white p-1 shadow-[0_4px_12px_rgba(0,0,0,0.16)] ring-1 ring-black/5 ${
                                                m.content ? "mt-2" : ""
                                              }`
                                            : "relative mt-2 inline-block overflow-hidden rounded-[15px] bg-white p-1 shadow-[0_4px_12px_rgba(0,0,0,0.16)] ring-1 ring-black/5"
                                        }
                                      >
                                        <img
                                          src={m.image}
                                          alt="dm"
                                          className="aspect-square h-[180px] w-[180px] cursor-pointer rounded-[11px] object-cover transition-opacity hover:opacity-90"
                                          onClick={() => {
                                            setSelectedImage(m.image ?? null);
                                            setIsImageModalOpen(true);
                                          }}
                                        />
                                        <div className="pointer-events-none absolute inset-x-1 bottom-1 flex items-end justify-end rounded-b-[11px] bg-linear-to-t from-black/45 to-transparent px-2 pb-1 pt-8">
                                          <span className="text-[11px] font-medium text-white/80">
                                            {formatMessageTime(m.createdAt)}
                                          </span>
                                        </div>
                                        {isGifDmImage && (
                                          <span className="absolute right-3 top-3 rounded bg-black/75 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white">
                                            GIF
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </>
                                )}
                                {m.audio && (
                                  <div
                                    className={`mt-2 min-w-0 rounded-xl border px-3 py-2 md:min-w-[240px] ${
                                      isMe
                                        ? "border-white/20 bg-white/10"
                                        : "border-zinc-200 bg-zinc-50"
                                    }`}
                                  >
                                    {m.audioFileName && (
                                      <p
                                        className={`mb-1 truncate text-xs font-medium ${
                                          isMe ? "text-white/80" : "text-zinc-700"
                                        }`}
                                      >
                                        {m.audioFileName}
                                      </p>
                                    )}
                                    <audio controls className="block w-full max-w-xs">
                                      <source src={m.audio} />
                                    </audio>
                                  </div>
                                )}
                              </div>
                              {!isMe && (
                                <div className="relative mt-1.5 self-start">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setOpenMessageMenuId((current) =>
                                        current === m.id ? null : m.id,
                                      )
                                    }
                                    className="ml-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white/70 text-zinc-500 shadow-sm hover:bg-white hover:text-zinc-800"
                                    aria-label="Mesaj seçenekleri"
                                  >
                                    <MoreVertical className="h-3 w-3" />
                                  </button>
                                  {openMessageMenuId === m.id && (
                                    <div className="absolute right-0 top-full z-40 mt-1 w-40 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-xl">
                                      <button
                                        type="button"
                                        onClick={() => handleReplyToMessage(m)}
                                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                                      >
                                        <Reply className="h-3.5 w-3.5 text-zinc-500" />
                                        Alıntı ile cevapla
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        <div ref={messagesEndRef} />
                      </div>
                    </>
                  )}
                </div>

                <DirectMessageInput
                  onSend={handleSend}
                  disabled={
                    sending ||
                    isActiveConversationBlocked ||
                    !canSendInActiveConversation
                  }
                  onOpenMenu={() => setShowOptionsMenu((prev) => !prev)}
                  showMenu={!isMobileConversationView && showOptionsMenu}
                  onCloseMenu={() => setShowOptionsMenu(false)}
                  onMenuAction={handleMenuAction}
                  blockMenuLabel={isBlockedByMe ? "Engeli kaldir" : "Engelle"}
                  isBlockedByMe={isBlockedByMe}
                  onVoiceCall={
                    canCallActiveConversation
                      ? () => startDirectCall("voice")
                      : undefined
                  }
                  onVideoCall={
                    canCallActiveConversation
                      ? () => startDirectCall("video")
                      : undefined
                  }
                  canVoiceCall={canCallActiveConversation}
                  canVideoCall={canCallActiveConversation}
                  canSendAudio={canCurrentUserSendVoiceMessage}
                  canRecordVoice={canCurrentUserSendVoiceMessage}
                  audioDisabledReason={audioDisabledReason}
                  replyTo={replyTo}
                  onCancelReply={() => setReplyTo(null)}
                />
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
                Bir konusma secin
              </div>
            )}
          </div>
        </div>

        {isImageModalOpen && selectedImage && (
          <div
            className="fixed inset-0 z-[20000] flex items-center justify-center bg-black/92 p-4 backdrop-blur-sm animate-in fade-in duration-200 pointer-events-auto"
            onClick={() => {
              setIsImageModalOpen(false);
              setSelectedImage(null);
            }}
          >
            <button
              type="button"
              className="fixed right-4 top-4 z-[20002] flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-white shadow-2xl ring-1 ring-white/20 transition-colors hover:bg-white/25 hover:text-zinc-100 active:scale-95"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setIsImageModalOpen(false);
                setSelectedImage(null);
              }}
              aria-label="Gorsel onizlemesini kapat"
            >
              <X className="h-8 w-8" />
            </button>
            <div
              className="relative z-[20001] flex h-full max-h-[90vh] w-full max-w-5xl items-center justify-center"
              onClick={(event) => event.stopPropagation()}
            >
              <img
                src={selectedImage}
                alt="Tam boyut gorsel"
                className="max-h-full max-w-full rounded-xl object-contain shadow-2xl animate-in zoom-in-95 duration-300"
              />
              {selectedImageIsGif && (
                <span className="absolute right-3 top-3 rounded bg-black/75 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-white">
                  GIF
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
