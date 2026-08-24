"use client";
import { useState, useRef, useEffect, useMemo } from "react";
import { Socket } from "socket.io-client";
import { Room, RoomEvent, LocalVideoTrack, Track } from "livekit-client";
import {
  Paperclip,
  Hand,
  Star,
  Trash2,
  History,
  Fan,
  Settings,
  MoreVertical,
  Play,
  MicOff,
  Video,
  Volume2,
  Send,
  Smile,
  Bookmark,
  FileText,
  Volume,
  Mic,
  Radio,
  Youtube,
  Circle,
  Image,
  ChevronUp,
  Users,
  ShieldCheck,
  Globe,
  X,
  Plus,
} from "lucide-react";
import { useVoiceChat } from "@/contexts/VoiceChatContext";
import { MsnEmojiPicker } from "./MsnEmojiPicker";
import { AnimationPicker } from "./AnimationPicker";
import { getClientApiClient } from "@/lib/api/clientApi";
import { createMessagesService } from "@/services/messagesService";
import { readChatPreferencesFromStorage } from "@/lib/chatPreferences";
import { toast } from "sonner";
import { hasEffectivePermission, PERMISSION_LABELS } from "@/lib/permissions";

type ForbiddenWord = { forbiddenWord: string; replacementWord?: string | null };

const isPermissionDismissedError = (error: unknown) =>
  error instanceof Error &&
  (error.name === "NotAllowedError" ||
    error.message.toLowerCase().includes("permission dismissed"));

type ReplyInfo = {
  sender: string;
  content: string;
  messageId?: number;
} | null;

type SentReplyToMessage = {
  id: number;
  content: string;
  username: string;
  createdAt: string;
} | null;

type SentMessagePayload = {
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
  replyToMessage?: SentReplyToMessage;
};

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
const MEDIA_MESSAGE_TIMEOUT_MS = 60_000;

const extractRemainingSeconds = (value: string): number | null => {
  const match = value.match(/(\d+)\s*(?:sn|saniye)/i);
  if (!match) return null;
  const seconds = Number(match[1]);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
};

type ChatInputProps = {
  socket: Socket | null;
  roomId: string | null;
  roomName?: string | null;
  forbiddenWords?: ForbiddenWord[];
  isHandRaised?: boolean;
  onToggleHand?: (next?: boolean) => void;
  firstMessageDelayRemaining?: number;
  chatPermissions?: {
    chatImageSendPermission: string;
    chatVoiceSendPermission: string;
    chatVoiceRecordSendPermission: string;
    chatYoutubeSendPermission: string;
  } | null;
  micDisabled?: boolean;
  micDisabledReason?: string | null;
  micWaitRemainingSeconds?: number;
  initialCameraBanned?: boolean;
  writingDisabled?: boolean;
  writingDisabledReason?: string | null;
  radioLink?: string | null;
  radioRequestLink?: string | null;
  roomRadioPanelLink?: string | null;
  roomRadioRequestLink?: string | null;
  replyTo?: ReplyInfo;
  onCancelReply?: () => void;
  onMessageSent?: (messageData: {
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
    replyToMessage?: {
      id: number;
      content: string;
      username: string;
      createdAt: string;
    } | null;
  }) => void;
  isOnRoof?: boolean;
  currentUserIcon?: string | null;
  currentUserGender?: string | null;
  currentUserFontColor?: string | null;
  currentUserStarCount?: number;
  roomOwnerName?: string | null;
  onClearScreen?: () => void;
  onDeleteHistory?: () => void;
  onDeleteRoomMessages?: () => void;
  onManageRoom?: () => void;
  canDeleteRoomMessages?: boolean;
  currentUserPermissions?: string[];
  currentRolePermissions?: Record<string, unknown> | null;
  addSystemMessage?: (
    message: string,
    room?: string,
    skipDuplicateCheck?: boolean,
  ) => void;
};

export const ChatInput = ({
  socket,
  roomId,
  roomName = null,
  forbiddenWords = [],
  isHandRaised = false,
  onToggleHand,
  firstMessageDelayRemaining = 0,
  chatPermissions = null,
  micDisabled = false,
  micDisabledReason = null,
  micWaitRemainingSeconds = 0,
  initialCameraBanned = false,
  writingDisabled = false,
  writingDisabledReason = null,
  radioLink = null,
  radioRequestLink = null,
  roomRadioPanelLink = null,
  roomRadioRequestLink = null,
  replyTo = null,
  onCancelReply,
  onMessageSent,
  isOnRoof = false,
  currentUserIcon = null,
  currentUserGender = null,
  currentUserFontColor = null,
  currentUserStarCount = 0,
  roomOwnerName = null,
  onClearScreen,
  onDeleteHistory,
  onDeleteRoomMessages,
  onManageRoom,
  canDeleteRoomMessages = false,
  currentUserPermissions = [],
  currentRolePermissions = null,
  addSystemMessage,
}: ChatInputProps) => {
  const [message, setMessage] = useState("");
  const [sendBlockedReason, setSendBlockedReason] = useState<string | null>(
    null,
  );
  const [sendBlockedRemaining, setSendBlockedRemaining] = useState(0);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageCaption, setImageCaption] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [showAudioPreview, setShowAudioPreview] = useState(false);
  const [selectedAudio, setSelectedAudio] = useState<string | null>(null);
  const [audioFileName, setAudioFileName] = useState("");
  const [audioCaption, setAudioCaption] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [recorderStatus, setRecorderStatus] = useState<
    "idle" | "recording" | "recorded"
  >("idle");
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [recordedAudioBase64, setRecordedAudioBase64] = useState<string | null>(
    null,
  );
  const [showYouTubeModal, setShowYouTubeModal] = useState(false);
  const [youtubeSearchQuery, setYoutubeSearchQuery] = useState("");
  const [youtubeResults, setYoutubeResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<any>(null);
  const [fallbackForbidden, setFallbackForbidden] = useState<ForbiddenWord[]>(
    [],
  );
  const [isRadioPlaying, setIsRadioPlaying] = useState(false);
  const [showAnimationPicker, setShowAnimationPicker] = useState(false);
  const [showRadioRequestModal, setShowRadioRequestModal] = useState(false);
  const [radioRequestUrl, setRadioRequestUrl] = useState<string | null>(null);
  const [isRadioRequestIframeError, setIsRadioRequestIframeError] =
    useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [showTypingIndicatorsEnabled, setShowTypingIndicatorsEnabled] =
    useState(true);
  const [showTargetGroupMenu, setShowTargetGroupMenu] = useState(false);
  const [showMobileRadioMenu, setShowMobileRadioMenu] = useState(false);
  const [showMobilePlusMenu, setShowMobilePlusMenu] = useState(false);
  const [showMobileTargetMenu, setShowMobileTargetMenu] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraBanned, setCameraBanned] = useState(initialCameraBanned);
  const [showCameraPreview, setShowCameraPreview] = useState(false);
  const [cameraPreviewPos, setCameraPreviewPos] = useState({ x: 0, y: 0 });
  const [isDraggingCameraPreview, setIsDraggingCameraPreview] = useState(false);
  const [targetGroup, setTargetGroup] = useState<
    "everyone" | "members" | "staff" | null
  >(null);
  const [floodCooldown, setFloodCooldown] = useState(0);
  const [isTargetGroupFixed, setIsTargetGroupFixed] = useState(false);
  const isSelfTypingRef = useRef(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messageTimestampsRef = useRef<number[]>([]);
  const apiClientRef = useRef(getClientApiClient());
  const messagesService = useMemo(
    () => createMessagesService(apiClientRef.current),
    [],
  );
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const attachmentMenuRef = useRef<HTMLDivElement>(null);
  const attachmentButtonRef = useRef<HTMLButtonElement>(null);
  const animationPickerRef = useRef<HTMLDivElement>(null);
  const animationButtonRef = useRef<HTMLButtonElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement>(null);
  const radioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const targetGroupButtonRef = useRef<HTMLButtonElement>(null);
  const targetGroupMenuRef = useRef<HTMLDivElement>(null);
  const mobileRadioButtonRef = useRef<HTMLButtonElement>(null);
  const mobileRadioMenuRef = useRef<HTMLDivElement>(null);
  const mobilePlusButtonRef = useRef<HTMLButtonElement>(null);
  const mobilePlusMenuRef = useRef<HTMLDivElement>(null);
  const mobileTargetButtonRef = useRef<HTMLButtonElement>(null);
  const mobileTargetMenuRef = useRef<HTMLDivElement>(null);
  const cameraPreviewContainerRef = useRef<HTMLDivElement | null>(null);
  const cameraRoomRef = useRef<Room | null>(null);
  const cameraTrackRef = useRef<LocalVideoTrack | null>(null);
  const cameraToggleBusyRef = useRef(false);
  const cameraPreviewDragStartRef = useRef({ x: 0, y: 0 });
  const sendInFlightRef = useRef(false);

  // Voice chat hook
  const {
    isInVoiceChat,
    isMuted,
    isDeafened,
    joinVoiceChat,
    leaveVoiceChat,
    toggleMute,
    toggleDeafen,
    micBanned,
  } = useVoiceChat();
  const isMicOpen = isInVoiceChat && !isMuted;
  const isHandDisabled = isMicOpen || isOnRoof;
  const canUseGeneralBroadcast = useMemo(
    () => {
      if (currentUserStarCount > 0) {
        return true;
      }

      return hasEffectivePermission({
        permissionLabel: PERMISSION_LABELS.GENERAL_BROADCAST,
        userPermissions: currentUserPermissions,
        rolePermissions: currentRolePermissions,
      });
    },
    [currentRolePermissions, currentUserPermissions, currentUserStarCount],
  );

  useEffect(() => {
    setCameraBanned(initialCameraBanned === true);
  }, [initialCameraBanned]);

  const formatMessageContent = (text: string) => {
    if (!text) return null;

    // Regex for [e1]...[e72] pattern
    const parts = text.split(/(\[e\d+\])/g);

    return parts.map((part, index) => {
      const match = part.match(/^\[(e\d+)\]$/);
      if (match) {
        const emojiCode = match[1];
        return (
          <img
            key={index}
            src={`/emom/${emojiCode}.gif`}
            alt={emojiCode}
            className="inline-block w-[18px] h-[18px] align-middle mx-0.5 object-contain"
          />
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  const isGifImageSource = (value?: string | null): boolean => {
    if (!value) return false;
    const normalized = value.trim().toLowerCase();
    if (normalized.startsWith("data:image/gif")) return true;
    const withoutQueryHash = normalized.split(/[?#]/, 1)[0];
    return withoutQueryHash.endsWith(".gif");
  };

  // Helper function to check if user has permission for a feature
  const hasPermission = (permission: string): boolean => {
    // YETKİLİLER İÇİN HER ZAMAN TRUE (Yıldızı olanlar yetkilidir)
    if (currentUserStarCount > 0) return true;

    if (!chatPermissions) return true; // Allow if permissions not loaded yet

    const isGuest = localStorage.getItem("isGuest") === "true";

    if (permission === "EVERYONE") return true;
    if (permission === "NONE") return false;
    if (permission === "MEMBERS") return !isGuest;

    return true; // Default to allow
  };

  useEffect(() => {
    if (isMicOpen && isHandRaised) {
      onToggleHand?.(false);
    }
  }, [isMicOpen, isHandRaised, onToggleHand]);

  useEffect(() => {
    if (!isDraggingCameraPreview) return;

    const handleMove = (event: MouseEvent) => {
      const dx = event.clientX - cameraPreviewDragStartRef.current.x;
      const dy = event.clientY - cameraPreviewDragStartRef.current.y;
      cameraPreviewDragStartRef.current = { x: event.clientX, y: event.clientY };
      setCameraPreviewPos((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
    };

    const handleUp = () => setIsDraggingCameraPreview(false);

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [isDraggingCameraPreview]);

  useEffect(() => {
    if (!showCameraPreview) return;

    let cancelled = false;
    let attachedEl: HTMLVideoElement | null = null;
    let attempts = 0;

    const attachPreview = () => {
      if (cancelled) return;

      const container = cameraPreviewContainerRef.current;
      const track = cameraTrackRef.current;
      if (container && track) {
        container.innerHTML = "";
        const el = track.attach() as HTMLVideoElement;
        el.style.width = "100%";
        el.style.height = "100%";
        el.style.objectFit = "cover";
        el.style.transform = "scaleX(-1)";
        container.appendChild(el);
        attachedEl = el;
        return;
      }

      attempts += 1;
      if (attempts < 20) {
        window.setTimeout(attachPreview, 50);
      }
    };

    attachPreview();
    return () => {
      cancelled = true;
      if (attachedEl) {
        cameraTrackRef.current?.detach(attachedEl);
        attachedEl.remove();
        attachedEl = null;
      }
    };
  }, [showCameraPreview, isCameraOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setShowEmojiPicker(false);
      }
      if (
        attachmentMenuRef.current &&
        !attachmentMenuRef.current.contains(event.target as Node) &&
        attachmentButtonRef.current &&
        !attachmentButtonRef.current.contains(event.target as Node)
      ) {
        setShowAttachmentMenu(false);
      }
      if (
        animationPickerRef.current &&
        !animationPickerRef.current.contains(event.target as Node) &&
        animationButtonRef.current &&
        !animationButtonRef.current.contains(event.target as Node)
      ) {
        setShowAnimationPicker(false);
      }
      if (
        targetGroupMenuRef.current &&
        !targetGroupMenuRef.current.contains(event.target as Node) &&
        targetGroupButtonRef.current &&
        !targetGroupButtonRef.current.contains(event.target as Node)
      ) {
        setShowTargetGroupMenu(false);
      }
      if (
        mobileRadioMenuRef.current &&
        !mobileRadioMenuRef.current.contains(event.target as Node) &&
        mobileRadioButtonRef.current &&
        !mobileRadioButtonRef.current.contains(event.target as Node)
      ) {
        setShowMobileRadioMenu(false);
      }
      if (
        mobilePlusMenuRef.current &&
        !mobilePlusMenuRef.current.contains(event.target as Node) &&
        mobilePlusButtonRef.current &&
        !mobilePlusButtonRef.current.contains(event.target as Node)
      ) {
        setShowMobilePlusMenu(false);
      }
      if (
        mobileTargetMenuRef.current &&
        !mobileTargetMenuRef.current.contains(event.target as Node) &&
        mobileTargetButtonRef.current &&
        !mobileTargetButtonRef.current.contains(event.target as Node)
      ) {
        setShowMobileTargetMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    return () => {
      void stopCameraBroadcast({ emitState: true, showToast: false });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!message.trim()) {
      setShowMobileTargetMenu(false);
      return;
    }

    setShowAttachmentMenu(false);
    setShowMobileRadioMenu(false);
    setShowMobilePlusMenu(false);
  }, [message]);

  useEffect(() => {
    if (!isCameraOpen) return;
    void stopCameraBroadcast({ emitState: true, showToast: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  useEffect(() => {
    if (!socket || !roomId) return;

    const handleRoomTyping = ({
      username,
      isTyping,
    }: {
      username: string;
      isTyping: boolean;
    }) => {
      setTypingUsers((prev) => {
        if (isTyping) {
          if (!prev.includes(username)) return [...prev, username];
          return prev;
        } else {
          return prev.filter((u) => u !== username);
        }
      });
    };

    socket.on("room:typing", handleRoomTyping);

    return () => {
      socket.off("room:typing", handleRoomTyping);
    };
  }, [socket, roomId]);

  useEffect(() => {
    if (!socket) return;

    const handleCameraBanToggled = (data: {
      username: string;
      cameraBanned: boolean;
    }) => {
      const currentUsername =
        localStorage.getItem("isGuest") === "true"
          ? localStorage.getItem("guestUsername")
          : localStorage.getItem("username");

      if (
        String(data.username).toLowerCase() !==
        String(currentUsername || "").toLowerCase()
      ) {
        return;
      }

      setCameraBanned(data.cameraBanned === true);
      if (data.cameraBanned) {
        if (isCameraOpen) {
          void stopCameraBroadcast({ emitState: true, showToast: false });
        }
        toast.error(
          "Kameranız bir yetkili tarafından yasaklandı. Yasağı kaldırılmadan açılamaz.",
        );
      } else {
        toast.success("Kamera yasağınız kaldırıldı.");
      }
    };

    const handleCameraError = (data: { message?: string }) => {
      if (data?.message === "camera_banned") {
        setCameraBanned(true);
        toast.error("Kamera açma yetkiniz yok. Kameranız yasaklı.");
      }
    };

    socket.on("moderation:cameraBanToggled", handleCameraBanToggled);
    socket.on("camera:error", handleCameraError);
    return () => {
      socket.off("moderation:cameraBanToggled", handleCameraBanToggled);
      socket.off("camera:error", handleCameraError);
    };
  }, [socket, isCameraOpen]);

  useEffect(() => {
    let timeoutId: number | undefined;
    const syncTypingPreference = () => {
      const preferences = readChatPreferencesFromStorage();
      const nextValue = preferences.showTypingIndicators === true;
      setShowTypingIndicatorsEnabled((prev) =>
        prev === nextValue ? prev : nextValue,
      );
      if (!nextValue) {
        setTypingUsers([]);
      }
    };

    syncTypingPreference();
    const onPreferencesChanged = () => {
      timeoutId = window.setTimeout(syncTypingPreference, 0);
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
    if (sendBlockedRemaining <= 0) {
      return;
    }

    const interval = window.setInterval(() => {
      setSendBlockedRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [sendBlockedRemaining]);

  useEffect(() => {
    if (
      sendBlockedRemaining === 0 &&
      sendBlockedReason &&
      extractRemainingSeconds(sendBlockedReason) !== null
    ) {
      setSendBlockedReason(null);
    }
  }, [sendBlockedReason, sendBlockedRemaining]);

  const handleMessageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    setMessage(newVal);
    if (sendBlockedReason && sendBlockedRemaining <= 0) {
      setSendBlockedReason(null);
    }

    if (!socket || !roomId) return;

    const username =
      localStorage.getItem("isGuest") === "true"
        ? localStorage.getItem("guestUsername")
        : localStorage.getItem("username");

    if (!username) return;

    // Typing Start
    if (!isSelfTypingRef.current && newVal.trim().length > 0) {
      isSelfTypingRef.current = true;
      socket.emit("typing:start", { room: roomId, username });
    }

    // Clear Timeout
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    // Set Timeout for Stop
    if (newVal.trim().length === 0) {
      // Hemen durdur
      isSelfTypingRef.current = false;
      socket.emit("typing:stop", { room: roomId, username });
    } else {
      // 2 saniye sonra durdur
      typingTimeoutRef.current = setTimeout(() => {
        isSelfTypingRef.current = false;
        socket.emit("typing:stop", { room: roomId, username });
      }, 2000);
    }
  };

  useEffect(() => {
    return () => {
      if (radioPlayerRef.current) {
        radioPlayerRef.current.pause();
        radioPlayerRef.current = null;
      }
    };
  }, []);

  const cleanOptionalLink = (value?: string | null) => value?.trim() || null;

  const effectiveRadioLink =
    cleanOptionalLink(roomRadioPanelLink) || cleanOptionalLink(radioLink);
  const effectiveRadioRequestLink =
    cleanOptionalLink(roomRadioRequestLink) ||
    cleanOptionalLink(radioRequestLink);

  useEffect(() => {
    if (!effectiveRadioLink) {
      if (radioPlayerRef.current) {
        radioPlayerRef.current.pause();
        radioPlayerRef.current = null;
      }
      setIsRadioPlaying(false);
      return;
    }

    if (radioPlayerRef.current) {
      const wasPlaying = !radioPlayerRef.current.paused;
      radioPlayerRef.current.src = effectiveRadioLink;
      if (wasPlaying) {
        radioPlayerRef.current.play().catch((error) => {
          console.error("Radyo çalınamadı:", error);
          setIsRadioPlaying(false);
        });
      }
    }
    // isRadioPlaying intentionally excluded: using paused property to avoid
    // re-setting src on every play-state change (causes disconnect loop)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveRadioLink]);

  // Fallback fetch if üstten gelmezse
  useEffect(() => {
    if (forbiddenWords.length > 0 || fallbackForbidden.length > 0) return;
    const fetchForbidden = async () => {
      try {
        const res = await apiClientRef.current.get("/forbidden-words");
        setFallbackForbidden(res?.data ?? []);
      } catch {
        // sessiz geç
      }
    };
    fetchForbidden();
  }, [forbiddenWords, fallbackForbidden.length]);

  const mergedForbidden = useMemo(
    () => (forbiddenWords.length ? forbiddenWords : fallbackForbidden),
    [forbiddenWords, fallbackForbidden],
  );

  const applyForbiddenFilter = (text: string, words: ForbiddenWord[] = mergedForbidden) => {
    if (!text || !words.length) return text;
    return words.reduce((acc, fw) => {
      if (!fw?.forbiddenWord) return acc;
      const pattern = fw.forbiddenWord.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(pattern, "gi");
      const replacement = fw.replacementWord ?? "";
      return acc.replace(regex, replacement);
    }, text);
  };

  const normalizeReplyToMessage = (
    replyToMessage: any,
  ): SentReplyToMessage => {
    if (!replyToMessage) return null;
    return {
      id: replyToMessage.id,
      content: replyToMessage.content ?? "",
      username: replyToMessage.user?.username ?? "Bilinmeyen",
      createdAt: replyToMessage.createdAt ?? "",
    };
  };

  const emitSentMessage = (params: SentMessagePayload) => {
    onMessageSent?.({
      ...params,
      targetGroup: params.targetGroup ?? null,
      replyToMessage: params.replyToMessage ?? null,
      image: params.image ?? null,
      audio: params.audio ?? null,
      audioFileName: params.audioFileName ?? null,
    });
  };

  const handleSendMessage = async (
    e?: React.FormEvent,
    targetOverride?: "everyone" | "members" | "staff",
  ) => {
    if (e) {
      e.preventDefault();
    }

    // Check if message is delayed for guests
    if (firstMessageDelayRemaining > 0) {
      return;
    }

    if (sendBlocked) {
      return;
    }

    // Writing blocked (e.g., guest writing disabled)
    if (writingDisabled) {
      if (writingDisabledReason?.includes("odasında susturuldunuz")) {
        toast.error(writingDisabledReason);
      }
      return;
    }

    // Çatıda iken mesaj gönderme engeli - sadece kullanıcıya uyarı göster
    const finalTarget = targetOverride || targetGroup;
    const isTargetFixed = targetOverride ? true : isTargetGroupFixed;

    if (finalTarget && !canUseGeneralBroadcast) {
      toast.error("Genel atma yetkiniz yok.");
      return;
    }

    if (isOnRoof && !isTargetFixed) {
      if (!canUseGeneralBroadcast) {
        toast.error("Genel atma yetkiniz yok.");
        return;
      }
      setShowTargetGroupMenu(true);
      toast.warning(
        "Çatıdayken mesaj yazamazsın. Lütfen sağdaki ok simgesinden bir gönderim hedefi seçin.",
      );
      return;
    }

    // Flood control check
    if (floodCooldown > 0) {
      toast.warning(`Lütfen ${floodCooldown} saniye bekleyin.`);
      return;
    }

    const rawMessage = message.trim();

    if (!rawMessage || !socket || !roomId) {
      return;
    }

    // Flood protection: Check message frequency
    const now = Date.now();
    const recentMessages = messageTimestampsRef.current.filter(
      (timestamp) => now - timestamp < 10000, // Son 10 saniyedeki mesajlar
    );

    // 10 saniyede 5'ten fazla mesaj gönderilmişse flood korumasını etkinleştir
    if (recentMessages.length >= 5) {
      setFloodCooldown(5);
      const interval = setInterval(() => {
        setFloodCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      toast.error("Çok fazla mesaj gönderiyorsunuz! 5 saniye bekleyin.");
      return;
    }

    if (sendInFlightRef.current) {
      return;
    }
    sendInFlightRef.current = true;

    // Add current timestamp to the list
    messageTimestampsRef.current = [...recentMessages, now];

    const isGuest = localStorage.getItem("isGuest") === "true";
    const username = isGuest
      ? localStorage.getItem("guestUsername")
      : localStorage.getItem("username");
    const gender = localStorage.getItem("guestGender") || "male";

    if (!username) {
      console.error("Username not found");
      return;
    }

    let latestForbiddenWords = mergedForbidden;
    try {
      const res = await apiClientRef.current.get("/forbidden-words");
      latestForbiddenWords = res?.data ?? [];
      setFallbackForbidden(latestForbiddenWords);
    } catch {
      // Socket/event senkronu kaçtıysa bile mevcut state ile devam et
    }

    const filteredMessage = applyForbiddenFilter(rawMessage, latestForbiddenWords);

    const getTargetPrefix = (group: string | null | undefined) => {
      if (group === "everyone") return "HERKESE: ";
      if (group === "members") return "ÜYELERE: ";
      if (group === "staff") return "ADMİN: ";
      return "";
    };

    const finalContent = getTargetPrefix(finalTarget) + filteredMessage;

    // Send via POST /messages API
    try {
      // Reply mesajı için replyTo varsa ve messageId varsa reply olarak gönder
      const hasReplyTarget = replyTo !== null;
      const hasValidMessageId =
        hasReplyTarget && replyTo.messageId !== undefined;

      const payload: {
        content: string;
        type: "normal" | "reply";
        roomName: string;
        replyToMessageId?: number;
        fontColor?: string | null;
        targetGroup?: string;
      } = {
        content: finalContent,
        type: hasValidMessageId ? "reply" : "normal",
        roomName: roomName || roomId || "",
        fontColor: currentUserFontColor,
        targetGroup: finalTarget || undefined,
      };

      if (hasValidMessageId) {
        payload.replyToMessageId = replyTo.messageId;
      }

      if (hasValidMessageId) {
        payload.replyToMessageId = replyTo.messageId;
      }

      setMessage("");
      setSendBlockedReason(null);
      setSendBlockedRemaining(0);
      onCancelReply?.();
      setTargetGroup(null);
      setIsTargetGroupFixed(false);

      const responseData = await messagesService.sendMessage(payload);
      const effectiveGender =
        (responseData?.user?.gender as "male" | "female") ||
        (currentUserGender as "male" | "female" | null) ||
        (gender as "male" | "female");
      const effectiveIcon = responseData?.user?.icon || currentUserIcon || null;

      // Notify parent about the new message with its ID
      if (responseData?.id) {
        emitSentMessage({
          id: responseData.id,
          content: filteredMessage,
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
          fontColor: responseData.fontColor ?? currentUserFontColor,
          targetGroup:
            (responseData.targetGroup as "everyone" | "members" | "staff" | null) ??
            finalTarget ??
            null,
          icon: responseData.user?.icon ?? effectiveIcon,
          replyToMessage: normalizeReplyToMessage(responseData.replyToMessage),
        });

        if (socket.connected) {
          socket.emit("sendMessage", {
            room: roomId,
            username,
            message: finalContent,
            messageId: responseData.id,
            type: hasValidMessageId ? "reply" : "normal",
            replyTo: hasValidMessageId
              ? {
                  messageId: replyTo.messageId,
                  content: replyTo.content,
                  sender: replyTo.sender,
                }
              : undefined,
            fontColor: responseData.fontColor ?? currentUserFontColor,
            targetGroup: finalTarget || undefined,
          });
        } else {
          socket.connect();
        }
      }

    } catch (error) {
      const apiErrorMessage =
        (error as any)?.response?.data?.message ||
        (error as any)?.message ||
        "";
      const deniedByGeneralBroadcast =
        String(apiErrorMessage).toLocaleLowerCase("tr-TR").includes("genel atma");
      if (finalTarget && deniedByGeneralBroadcast) {
        toast.error("Genel atma yetkiniz yok.");
        return;
      }
      if (
        String(apiErrorMessage).toLowerCase().includes("sustur") ||
        String(apiErrorMessage).toLowerCase().includes("global_muted") ||
        String(apiErrorMessage).toLowerCase().includes("room_muted")
      ) {
        toast.error(`${roomName || roomId || "Bu"} odasında susturuldunuz`);
        return;
      }
      if (apiErrorMessage) {
        const normalizedMessage = String(apiErrorMessage);
        const remainingSeconds = extractRemainingSeconds(normalizedMessage);
        setSendBlockedReason(normalizedMessage);
        setSendBlockedRemaining(remainingSeconds ?? 0);
        return;
      }
      if (finalTarget) {
        toast.error("Mesaj gönderilemedi.");
        return;
      }
      toast.error("Mesaj kaydedilemedi. Lütfen tekrar deneyin.");
    } finally {
      sendInFlightRef.current = false;
      // Ensure typing status is reset after sending a message
      if (isSelfTypingRef.current && socket && roomId) {
        const username =
          localStorage.getItem("isGuest") === "true"
            ? localStorage.getItem("guestUsername")
            : localStorage.getItem("username");
        if (username) {
          socket.emit("typing:stop", { room: roomId, username });
          isSelfTypingRef.current = false;
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        }
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();

      if (isOnRoof) {
        if (!canUseGeneralBroadcast) {
          toast.error("Genel atma yetkiniz yok.");
          return;
        }
        setShowTargetGroupMenu(true);
        toast.info("Lütfen bir gönderim hedefi seçin");
        return;
      }

      handleSendMessage();
    }
  };
  const handleMicClick = () => {
    if (micDisabled) {
      if (micDisabledReason?.includes("odasında susturuldunuz")) {
        toast.error(micDisabledReason);
      }
      return;
    }

    if (!isInVoiceChat) {
      setShowWarningModal(true);
    } else {
      if (micWaitRemainingSeconds > 0 && isMuted) {
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
      toggleMute();
      if (addSystemMessage) {
        addSystemMessage(
          isMuted ? "mikrofonu aldınız 🎤" : "mikrofonu bıraktınız 🔇",
          roomName || roomId || undefined,
          true,
        );
      }
    }
  };

  const getCurrentUsername = () =>
    localStorage.getItem("isGuest") === "true" &&
    !localStorage.getItem("accessToken") &&
    !localStorage.getItem("username")
      ? localStorage.getItem("guestUsername")
      : localStorage.getItem("username");

  const getCameraChannelName = (room: string, username: string) =>
    `camera_${room.trim().toLowerCase()}_${username.trim().toLowerCase()}`;

  const stopCameraBroadcast = async (
    options: { emitState?: boolean; showToast?: boolean } = {},
  ) => {
    const { emitState = true, showToast = true } = options;
    const cameraRoom = cameraRoomRef.current;

    cameraRoomRef.current = null;
    cameraTrackRef.current = null;

    if (cameraRoom && cameraRoom.state !== "disconnected") {
      try {
        await cameraRoom.disconnect();
      } catch (error) {
        console.error("Kamera kanalından çıkılamadı:", error);
      }
    }

    if (cameraPreviewContainerRef.current) {
      cameraPreviewContainerRef.current.innerHTML = "";
    }

    setIsCameraOpen(false);
    setShowCameraPreview(false);

    if (emitState && socket && roomId) {
      const username = getCurrentUsername();
      if (username) {
        socket.emit("camera:toggle", {
          room: roomId,
          username,
          isCameraOn: false,
        });
      }
    }

    if (showToast) {
      toast.info("Kamerayı kapattınız");
    }
  };

  const handleCameraClick = async () => {
    if (cameraToggleBusyRef.current) return;

    if (isCameraOpen) {
      cameraToggleBusyRef.current = true;
      try {
        await stopCameraBroadcast();
      } finally {
        cameraToggleBusyRef.current = false;
      }
      return;
    }

    if (cameraBanned) {
      toast.error("Kamera açma yetkiniz yok. Kameranız yasaklı.");
      return;
    }

    if (!socket || !socket.connected) {
      toast.error("Sunucu bağlantısı yok.");
      return;
    }
    if (!roomId) {
      toast.error("Aktif oda bilgisi bulunamadı.");
      return;
    }
    const username = getCurrentUsername();
    if (!username) {
      toast.error("Kullanıcı bilgisi bulunamadı.");
      return;
    }

    cameraToggleBusyRef.current = true;
    try {
      try {
        const permissionStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
        permissionStream.getTracks().forEach((track) => track.stop());
      } catch (error) {
        if (!isPermissionDismissedError(error)) {
          console.error("Kamera izni alınamadı:", error);
        }
        toast.error("Kamera izni verilmedi.");
        return;
      }

      const channelName = getCameraChannelName(roomId, username);
      const token = await fetchLivekitToken(channelName, true);

      const cameraRoom = new Room();
      cameraRoomRef.current = cameraRoom;

      await cameraRoom.connect(LIVEKIT_URL, token);
      await cameraRoom.localParticipant.setCameraEnabled(true);

      const pub = [...cameraRoom.localParticipant.videoTrackPublications.values()].find(
        (p) => p.source === Track.Source.Camera,
      );
      cameraTrackRef.current = (pub?.track as LocalVideoTrack) ?? null;

      setIsCameraOpen(true);
      setShowCameraPreview(true);

      socket.emit("camera:toggle", {
        room: roomId,
        username,
        isCameraOn: true,
      });
      toast.success("Kamerayı açtınız");
    } catch (error) {
      if (!isPermissionDismissedError(error)) {
        console.error("Kamera açılırken hata:", error);
      }
      await stopCameraBroadcast({ emitState: false, showToast: false });
      toast.error(
        isPermissionDismissedError(error)
          ? "Kamera izni verilmedi."
          : "Kamera açılamadı.",
      );
    } finally {
      cameraToggleBusyRef.current = false;
    }
  };

  const handleToggleRadio = async () => {
    if (!effectiveRadioLink) return;

    try {
      if (!radioPlayerRef.current) {
        radioPlayerRef.current = new Audio(effectiveRadioLink);
        radioPlayerRef.current.loop = true;
        radioPlayerRef.current.addEventListener("ended", () =>
          setIsRadioPlaying(false),
        );
        radioPlayerRef.current.addEventListener("pause", () =>
          setIsRadioPlaying(false),
        );
      } else if (radioPlayerRef.current.src !== effectiveRadioLink) {
        radioPlayerRef.current.src = effectiveRadioLink;
      }

      if (isRadioPlaying) {
        radioPlayerRef.current.pause();
        radioPlayerRef.current.currentTime = 0;
        setIsRadioPlaying(false);
        toast.info("Radyo yayınından ayrıldınız");
        return;
      }

      await radioPlayerRef.current.play();
      setIsRadioPlaying(true);
      toast.success("Radyo yayınına bağlandınız");
    } catch (error) {
      console.error("Radyo çalınamadı:", error);
      setIsRadioPlaying(false);
      toast.error("Radyo yayınına bağlanılamadı");
    }
  };

  const getValidRadioRequestUrl = (): string | null => {
    const requestLink = effectiveRadioRequestLink;
    if (!requestLink) return null;

    try {
      const parsedUrl = new URL(requestLink);
      if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        return null;
      }
      return parsedUrl.toString();
    } catch {
      return null;
    }
  };

  const handleOpenRadioRequestModal = () => {
    setShowAttachmentMenu(false);
    const validUrl = getValidRadioRequestUrl();

    if (!validUrl) {
      if (!effectiveRadioRequestLink) {
        toast.error("Bu oda için aktif bir istek paneli bulunamadı");
      } else {
        toast.error("Radyo istek linki geçersiz.");
      }
      return;
    }

    setRadioRequestUrl(validUrl);
    setIsRadioRequestIframeError(false);
    setShowRadioRequestModal(true);
  };

  const handleCloseRadioRequestModal = () => {
    setShowRadioRequestModal(false);
    setIsRadioRequestIframeError(false);
    setRadioRequestUrl(null);
  };

  const handleOpenRadioRequestInNewTab = () => {
    if (!radioRequestUrl) return;
    window.open(radioRequestUrl, "_blank", "noopener,noreferrer");
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !socket) return;

    // Check file type
    if (!file.type.startsWith("image/")) {
      toast.error("Lütfen sadece resim dosyası seçin.");
      return;
    }

    // Check file size (max 25MB)
    if (file.size > 25 * 1024 * 1024) {
      toast.error("Resim boyutu 25MB'dan küçük olmalıdır.");
      return;
    }

    setShowAttachmentMenu(false);

    const fileName = file.name?.toLowerCase() ?? "";
    const isGifFile = file.type === "image/gif" || fileName.endsWith(".gif");

    const readFileAsDataUrl = (targetFile: File): Promise<string> =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(targetFile);
      });

    if (isGifFile) {
      try {
        const gifDataUrl = await readFileAsDataUrl(file);
        setSelectedImage(gifDataUrl);
        setShowImagePreview(true);
      } catch (error) {
        console.error("❌ GIF read failed:", error);
        toast.error("GIF işlenemedi. Lütfen farklı bir dosya deneyin.");
      }
      return;
    }

    // Compress large images before converting to base64.
    // Keep reasonable visual quality while staying comfortably under socket/API limits.
    const compressImage = (
      file: File,
      maxWidth = 1920,
      quality = 0.82,
      targetSizeKB = 6 * 1024,
    ): Promise<string> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = document.createElement("img");
          img.onload = () => {
            const canvas = document.createElement("canvas");
            let { width, height } = img;

            // Scale down if too large
            if (width > maxWidth) {
              height = (height * maxWidth) / width;
              width = maxWidth;
            }

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext("2d");
            if (!ctx) {
              reject(new Error("Canvas context not available"));
              return;
            }

            ctx.drawImage(img, 0, 0, width, height);

            // Always use JPEG for better compression on uploaded photos
            let compressedBase64 = canvas.toDataURL("image/jpeg", quality);

            // If still too large, reduce quality further
            let currentQuality = quality;
            while (
              compressedBase64.length > targetSizeKB * 1024 &&
              currentQuality > 0.4
            ) {
              currentQuality -= 0.08;
              compressedBase64 = canvas.toDataURL("image/jpeg", currentQuality);
            }

            // If still too large after quality reduction, reduce dimensions
            if (compressedBase64.length > targetSizeKB * 1024) {
              const scale = Math.sqrt(
                (targetSizeKB * 1024) / compressedBase64.length,
              );
              canvas.width = Math.floor(width * scale);
              canvas.height = Math.floor(height * scale);
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              compressedBase64 = canvas.toDataURL(
                "image/jpeg",
                Math.max(currentQuality, 0.55),
              );
            }

            resolve(compressedBase64);
          };
          img.onerror = () => reject(new Error("Failed to load image"));
          img.src = event.target?.result as string;
        };
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });
    };

    try {
      const originalBase64 = await readFileAsDataUrl(file);
      const processedBase64 =
        originalBase64.length > 8 * 1024 * 1024
          ? await compressImage(file)
          : originalBase64;

      // Final check - if still too large, reject
      if (processedBase64.length > 20 * 1024 * 1024) {
        toast.error(
          "Resim hâlâ çok büyük. Lütfen biraz daha küçük bir resim seçin.",
        );
        return;
      }

      setSelectedImage(processedBase64);
      setShowImagePreview(true);
    } catch (error) {
      console.error("❌ Image compression failed:", error);
      toast.error("Resim işlenemedi. Lütfen farklı bir resim deneyin.");
    }
  };

  const handleSendImage = async () => {
    if (!selectedImage || !socket || !roomId) {
      console.error("❌ No image or socket");
      return;
    }

    const isGuest = localStorage.getItem("isGuest") === "true";
    const username = isGuest
      ? localStorage.getItem("guestUsername")
      : localStorage.getItem("username");
    const gender = localStorage.getItem("guestGender") || "male";

    if (!username) {
      console.error("❌ Username not found");
      return;
    }

    // Check if socket is still connected
    if (!socket.connected) {
      console.error("❌ Socket disconnected, attempting to reconnect...");
      socket.connect();
      toast.error("Bağlantı koptu, yeniden bağlanılıyor...");
      return;
    }

    setIsUploading(true);

    // Check if image is large for socket transport
    if (
      selectedImage.startsWith("data:image/") &&
      selectedImage.length > 8 * 1024 * 1024
    ) {
      console.warn("⚠️ Large image detected, may cause connection issues");
    }

    const getTargetPrefix = (group: string | null | undefined) => {
      if (group === "everyone") return "HERKESE: ";
      if (group === "members") return "ÜYELERE: ";
      if (group === "staff") return "ADMİN: ";
      return "";
    };

    const finalImageContent =
      getTargetPrefix(targetGroup) + (imageCaption.trim() || "");

    if (targetGroup && !canUseGeneralBroadcast) {
      setIsUploading(false);
      toast.error("Genel atma yetkiniz yok.");
      return;
    }

    const imageData = selectedImage;
    const payload = {
      room: roomId,
      username,
      image: imageData,
      message: finalImageContent,
      gender,
      isGuest,
      targetGroup: targetGroup || undefined,
    };

    emitSentMessage({
      id: 0,
      content: imageCaption.trim() || "📷 Görsel",
      finalContent: finalImageContent,
      username,
      originalUsername: username,
      displayUsername: username,
      gender:
        (currentUserGender as "male" | "female" | null) ||
        (gender as "male" | "female") ||
        "male",
      isGuest,
      createdAt: new Date().toISOString(),
      fontColor: currentUserFontColor,
      targetGroup: targetGroup ?? null,
      icon: currentUserIcon,
      image: imageData,
      replyToMessage: null,
    });

    // Send image via socket immediately for real-time delivery.
    socket.emit("sendImage", payload);
    resetAfterSend();

    // Persist in the background; do not block mobile UI/send speed on DB latency.
    void (async () => {
      const apiPayload = {
        content: finalImageContent,
        type: "image" as const,
        roomName: roomName || roomId || "",
        image: imageData,
        fontColor: currentUserFontColor,
        targetGroup: targetGroup || undefined,
      };

      try {
        await apiClientRef.current.post("/messages", apiPayload, {
          timeout: MEDIA_MESSAGE_TIMEOUT_MS,
        });
      } catch (apiError) {
        console.error("❌ Failed to save image to database:", apiError);
        toast.error("Görsel gönderildi ama geçmişe kaydedilemedi.");
      }
    })();

    function resetAfterSend() {
      setShowImagePreview(false);
      setSelectedImage(null);
      setImageCaption("");
      setIsUploading(false);
      if (imageInputRef.current) {
        imageInputRef.current.value = "";
      }
    }
  };

  const handleCancelImage = () => {
    setShowImagePreview(false);
    setSelectedImage(null);
    setImageCaption("");
    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  };

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !socket) return;

    // Check file type (audio only)
    if (!file.type.startsWith("audio/")) {
      toast.error("Lütfen sadece ses dosyası seçin.");
      return;
    }

    // Check file size (max 10MB original)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Ses dosyası 10MB'dan küçük olmalıdır.");
      return;
    }

    setShowAttachmentMenu(false);
    toast.loading("Ses dosyası işleniyor...", { id: "audio-processing" });

    try {
      const arrayBuffer = await file.arrayBuffer();
      const audioContext = new (
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext
      )();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      const duration = audioBuffer.duration;

      // Max 5 minutes
      if (duration > 300) {
        toast.dismiss("audio-processing");
        toast.error("Ses dosyası maksimum 5 dakika olabilir.");
        await audioContext.close();
        return;
      }

      // Calculate sample rate to fit in ~350KB base64 (~260KB raw)
      // For 8-bit mono: rawBytes = sampleRate * duration
      // We want: sampleRate * duration = 260KB
      // But we need minimum quality, so use adaptive approach
      const targetRawBytes = 350 * 1024; // More generous target
      let sampleRate = Math.floor(targetRawBytes / duration);

      // Clamp: minimum 3000Hz (browser limit), maximum 16000Hz (good quality)
      sampleRate = Math.max(3000, Math.min(16000, sampleRate));

      // Resample audio
      const offlineCtx = new OfflineAudioContext(
        1,
        Math.ceil(duration * sampleRate),
        sampleRate,
      );
      const source = offlineCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(offlineCtx.destination);
      source.start(0);

      const renderedBuffer = await offlineCtx.startRendering();
      const samples = renderedBuffer.getChannelData(0);

      // Create WAV file (8-bit for smaller size)
      const wavHeader = 44;
      const wavBuffer = new ArrayBuffer(wavHeader + samples.length);
      const view = new DataView(wavBuffer);

      // WAV header
      const writeStr = (offset: number, str: string) => {
        for (let i = 0; i < str.length; i++)
          view.setUint8(offset + i, str.charCodeAt(i));
      };
      writeStr(0, "RIFF");
      view.setUint32(4, 36 + samples.length, true);
      writeStr(8, "WAVE");
      writeStr(12, "fmt ");
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true); // PCM
      view.setUint16(22, 1, true); // mono
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate, true); // byte rate
      view.setUint16(32, 1, true); // block align
      view.setUint16(34, 8, true); // bits per sample
      writeStr(36, "data");
      view.setUint32(40, samples.length, true);

      // Write 8-bit audio samples
      for (let i = 0; i < samples.length; i++) {
        const sample = Math.max(-1, Math.min(1, samples[i]));
        view.setUint8(wavHeader + i, Math.floor((sample + 1) * 127.5));
      }

      // Convert to base64
      const blob = new Blob([wavBuffer], { type: "audio/wav" });
      const reader = new FileReader();

      reader.onloadend = () => {
        const base64 = reader.result as string;
        const sizeKB = Math.round(base64.length / 1024);

        toast.dismiss("audio-processing");

        // Just log if large, but allow it
        if (base64.length > 500 * 1024) {
          console.warn(
            `⚠️ Large audio: ${sizeKB}KB - may have connection issues`,
          );
        }

        setSelectedAudio(base64);
        setAudioFileName(file.name);
        setShowAudioPreview(true);
      };

      reader.readAsDataURL(blob);
      await audioContext.close();
    } catch (error) {
      console.error("Audio processing error:", error);
      toast.dismiss("audio-processing");
      toast.error("Ses dosyası işlenemedi. Farklı bir format deneyin.");
    }
  };

  const emitAudioPayload = async (
    audioData: string,
    fileName: string,
    caption: string,
  ) => {
    if (!audioData || !socket || !roomId) {
      console.error("❌ No audio or socket");
      return;
    }

    const isGuest = localStorage.getItem("isGuest") === "true";
    const username = isGuest
      ? localStorage.getItem("guestUsername")
      : localStorage.getItem("username");
    const gender = localStorage.getItem("guestGender") || "male";

    if (!username) {
      console.error("❌ Username not found");
      return;
    }

    // Check if socket is still connected
    if (!socket.connected) {
      console.error("❌ Socket disconnected, attempting to reconnect...");
      socket.connect();
      toast.error("Bağlantı koptu, yeniden bağlanılıyor...");
      return;
    }

    setIsUploading(true);

    // Warn if audio is large
    if (audioData.length > 500 * 1024) {
      console.warn("⚠️ Large audio detected, may cause connection issues");
    }

    const getTargetPrefix = (group: string | null | undefined) => {
      if (group === "everyone") return "HERKESE: ";
      if (group === "members") return "ÜYELERE: ";
      if (group === "staff") return "ADMİN: ";
      return "";
    };

    const finalAudioContent =
      getTargetPrefix(targetGroup) + (caption.trim() || "");

    if (targetGroup && !canUseGeneralBroadcast) {
      setIsUploading(false);
      toast.error("Genel atma yetkiniz yok.");
      return;
    }

    const payload = {
      room: roomId,
      username,
      audio: audioData,
      audioFileName: fileName,
      message: finalAudioContent,
      gender: (currentUserGender as "male" | "female" | null) || gender,
      icon: currentUserIcon,
      fontColor: currentUserFontColor,
      isGuest,
      targetGroup: targetGroup || undefined,
    };

    emitSentMessage({
      id: 0,
      content: caption.trim() || "🎤 Sesli Mesaj",
      finalContent: finalAudioContent,
      username,
      originalUsername: username,
      displayUsername: username,
      gender:
        (currentUserGender as "male" | "female" | null) ||
        (gender as "male" | "female") ||
        "male",
      isGuest,
      createdAt: new Date().toISOString(),
      fontColor: currentUserFontColor,
      targetGroup: targetGroup ?? null,
      icon: currentUserIcon,
      audio: audioData,
      audioFileName: fileName,
      replyToMessage: null,
    });

    // Send audio via socket immediately for real-time delivery.
    socket.emit("sendAudio", payload);
    resetAfterSend();

    // Persist in the background; do not block mobile UI/send speed on DB latency.
    void (async () => {
      const apiPayload = {
        content: finalAudioContent,
        type: "audio" as const,
        roomName: roomName || roomId || "",
        audio: audioData,
        audioFileName: fileName,
        fontColor: currentUserFontColor,
        targetGroup: targetGroup || undefined,
      };

      try {
        await apiClientRef.current.post("/messages", apiPayload, {
          timeout: MEDIA_MESSAGE_TIMEOUT_MS,
        });
      } catch (apiError) {
        console.error("❌ Failed to save audio to database:", apiError);
        toast.error("Ses gönderildi ama geçmişe kaydedilemedi.");
      }
    })();

    function resetAfterSend() {
      setShowAudioPreview(false);
      setSelectedAudio(null);
      setAudioFileName("");
      setAudioCaption("");
      setRecordedAudioBase64(null);
      setRecordedAudioUrl(null);
      setRecorderStatus("idle");
      setShowVoiceRecorder(false);
      resetRecordingState();
      setIsUploading(false);

      if (audioInputRef.current) {
        audioInputRef.current.value = "";
      }
    }
  };

  const handleSendAudio = () => {
    if (!selectedAudio) {
      console.error("❌ No audio selected");
      return;
    }
    emitAudioPayload(
      selectedAudio,
      audioFileName || "audio-file",
      audioCaption,
    );
  };

  const handleCancelAudio = () => {
    setShowAudioPreview(false);
    setSelectedAudio(null);
    setAudioFileName("");
    setAudioCaption("");
    resetRecordingState();
    stopRecordingStream();
    clearRecordingTimer();
    if (audioInputRef.current) {
      audioInputRef.current.value = "";
    }
  };

  const clearRecordingTimer = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const stopRecordingStream = () => {
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    recordingStreamRef.current = null;
  };

  const resetRecordingState = () => {
    setIsRecording(false);
    setRecordingTime(0);
    setRecorderStatus("idle");
    if (recordedAudioUrl) {
      URL.revokeObjectURL(recordedAudioUrl);
    }
    setRecordedAudioUrl(null);
    setRecordedAudioBase64(null);
    recordingChunksRef.current = [];
    clearRecordingTimer();
    stopRecordingStream();
  };

  const startVoiceRecording = async () => {
    if (isRecording || isUploading) return;
    if (typeof window === "undefined" || !("MediaRecorder" in window)) {
      alert("Tarayıcınız ses kaydını desteklemiyor.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      recordingChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordingChunksRef.current, {
          type: "audio/webm",
        });
        const objectUrl = URL.createObjectURL(blob);
        setRecordedAudioUrl(objectUrl);
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result as string;
          setRecordedAudioBase64(base64String);
          setAudioFileName("voice-message.webm");
          setRecorderStatus("recorded");
        };
        reader.readAsDataURL(blob);
        setIsRecording(false);
        clearRecordingTimer();
        stopRecordingStream();
        recordingChunksRef.current = [];
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecorderStatus("recording");
      setRecordingTime(0);
      clearRecordingTimer();
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      if (!isPermissionDismissedError(error)) {
        console.error("❌ Mikrofon izni reddedildi veya hata oluştu", error);
      }
      alert("Mikrofon izni gerekli. Lütfen izin verin.");
      resetRecordingState();
    }
  };

  const stopVoiceRecording = () => {
    if (!isRecording) return;
    clearRecordingTimer();
    try {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    } catch (error) {
      console.error("❌ Kayıt durdurulamadı", error);
      resetRecordingState();
    }
  };

  const handleSendRecordedVoice = () => {
    if (!recordedAudioBase64) return;
    const fileName = audioFileName || `voice-${Date.now()}.webm`;
    emitAudioPayload(recordedAudioBase64, fileName, audioCaption);
  };

  const handleCloseRecorder = () => {
    setShowVoiceRecorder(false);
    resetRecordingState();
  };

  const handleYouTubeSearch = async () => {
    if (!youtubeSearchQuery.trim()) {
      alert("Lütfen arama terimi girin.");
      return;
    }

    setIsSearching(true);

    try {
      const API_KEY = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;

      if (!API_KEY) {
        alert("YouTube API anahtarı yapılandırılmamış.");
        setIsSearching(false);
        return;
      }

      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=10&q=${encodeURIComponent(
          youtubeSearchQuery,
        )}&type=video&key=${API_KEY}`,
      );

      if (!response.ok) {
        throw new Error("YouTube API isteği başarısız oldu");
      }

      const data = await response.json();
      setYoutubeResults(data.items || []);
    } catch (error) {
      console.error("❌ YouTube search error:", error);
      alert("YouTube araması sırasında bir hata oluştu.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectVideo = (video: any) => {
    setSelectedVideo(video);
  };

  const handleSendYouTube = () => {
    if (!selectedVideo || !socket || !roomId) {
      console.error("❌ No video selected or socket missing");
      return;
    }

    const isGuest = localStorage.getItem("isGuest") === "true";
    const username = isGuest
      ? localStorage.getItem("guestUsername")
      : localStorage.getItem("username");
    const gender = localStorage.getItem("guestGender") || "male";

    if (!username) {
      console.error("❌ Username not found");
      return;
    }

    const videoId = selectedVideo.id.videoId;
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const videoTitle = selectedVideo.snippet.title;
    const videoThumbnail = selectedVideo.snippet.thumbnails.medium.url;

    if (targetGroup && !canUseGeneralBroadcast) {
      toast.error("Genel atma yetkiniz yok.");
      return;
    }

    const payload = {
      room: roomId,
      username,
      videoUrl,
      videoTitle,
      videoThumbnail,
      videoId,
      gender: (currentUserGender as "male" | "female" | null) || gender,
      icon: currentUserIcon,
      fontColor: currentUserFontColor,
      isGuest,
      targetGroup: targetGroup || undefined,
    };

    try {
      socket.emit("sendYouTube", payload);

      // Close modal and reset
      setShowYouTubeModal(false);
      setYoutubeSearchQuery("");
      setYoutubeResults([]);
      setSelectedVideo(null);
      setShowAttachmentMenu(false);
      setTargetGroup(null);
      setIsTargetGroupFixed(false);
    } catch (error) {
      console.error("❌ Error sending YouTube video:", error);
      alert("Video gönderilirken bir hata oluştu.");
    }
  };

  const handleCancelYouTube = () => {
    setShowYouTubeModal(false);
    setYoutubeSearchQuery("");
    setYoutubeResults([]);
    setSelectedVideo(null);
  };

  const handleAnimationSelect = async (animationUrl: string) => {
    if (!socket || !roomId) {
      console.error("❌ No socket or roomId");
      return;
    }

    const isGuest = localStorage.getItem("isGuest") === "true";
    const username = isGuest
      ? localStorage.getItem("guestUsername")
      : localStorage.getItem("username");
    const gender = localStorage.getItem("guestGender") || "male";

    if (!username) {
      console.error("❌ Username not found");
      return;
    }

    if (targetGroup && !canUseGeneralBroadcast) {
      toast.error("Genel atma yetkiniz yok.");
      return;
    }

    // Close pickers
    setShowAnimationPicker(false);
    setShowEmojiPicker(false);
    setShowAttachmentMenu(false);

    // Emoji GIF kontrolü - Text olarak ekle
    if (animationUrl.includes("/emom/")) {
      const match = animationUrl.match(/\/emom\/(e\d+)\.gif/);
      if (match) {
        const emojiCode = match[1];
        setMessage((prev) => prev + (prev ? " " : "") + `[${emojiCode}]`);
        return;
      }
    }

    const getTargetPrefix = (group: string | null | undefined) => {
      if (group === "everyone") return "HERKESE: ";
      if (group === "members") return "ÜYELERE: ";
      if (group === "staff") return "ADMİN: ";
      return "";
    };

    let messageId: number | undefined = undefined;
    const finalImageContent = getTargetPrefix(targetGroup);

    try {
      const apiPayload = {
        content: finalImageContent,
        type: "image" as const,
        roomName: roomName || roomId || "",
        image: animationUrl,
        fontColor: currentUserFontColor,
        targetGroup: targetGroup || undefined,
      };

      const response = await apiClientRef.current.post("/messages", apiPayload);
      const responseData = response?.data;

      if (responseData?.id) {
        messageId = responseData.id;
        emitSentMessage({
          id: responseData.id,
          content: "✨ Animasyon",
          finalContent: finalImageContent,
          username: responseData.user?.username ?? username,
          originalUsername: responseData.user?.username ?? username,
          displayUsername:
            responseData.user?.displayUsername ??
            responseData.user?.agentNickname ??
            username,
          gender:
            (responseData.user?.gender as "male" | "female") ||
            (currentUserGender as "male" | "female" | null) ||
            (gender as "male" | "female"),
          isGuest,
          createdAt: responseData.createdAt ?? new Date().toISOString(),
          fontColor: responseData.fontColor ?? currentUserFontColor,
          targetGroup:
            (responseData.targetGroup as "everyone" | "members" | "staff" | null) ??
            targetGroup ??
            null,
          icon: responseData.user?.icon ?? currentUserIcon,
          image: responseData.image ?? animationUrl,
          replyToMessage: normalizeReplyToMessage(responseData.replyToMessage),
        });
      }
    } catch (apiError) {
      console.error("❌ Failed to save animation to database:", apiError);
      const apiErrorMessage =
        (apiError as any)?.response?.data?.message ||
        (apiError as any)?.message ||
        "";
      const deniedByGeneralBroadcast =
        String(apiErrorMessage)
          .toLocaleLowerCase("tr-TR")
          .includes("genel atma");

      toast.error(
        deniedByGeneralBroadcast
          ? "Genel atma yetkiniz yok."
          : "Animasyon gönderilemedi.",
      );
      return;
    }

    const payload = {
      room: roomId,
      username,
      image: animationUrl,
      message: finalImageContent,
      gender: (currentUserGender as "male" | "female" | null) || gender,
      icon: currentUserIcon,
      fontColor: currentUserFontColor,
      isGuest,
      targetGroup: targetGroup || undefined,
      messageId,
    };

    socket.emit("sendImage", payload);

    setTargetGroup(null);
    setIsTargetGroupFixed(false);
  };

  const selectedImageIsGif = isGifImageSource(selectedImage);
  const isMobileTypingMode = message.trim().length > 0;
  const sendBlockedPlaceholder =
    sendBlockedRemaining > 0
      ? sendBlockedReason?.toLocaleLowerCase("tr-TR").includes("misafir")
        ? `Misafir bekleme süresi: ${sendBlockedRemaining} sn`
        : `${sendBlockedRemaining} saniye sonra mesaj gönderebilirsiniz...`
      : sendBlockedReason;
  const sendBlockedReasonLower =
    sendBlockedReason?.toLocaleLowerCase("tr-TR") ?? "";
  const sendBlocked =
    sendBlockedRemaining > 0 ||
    sendBlockedReasonLower.includes("kapalı") ||
    sendBlockedReasonLower.includes("bekleme") ||
    sendBlockedReasonLower.includes("sonra");

  return (
    <div className="chat-theme-input absolute inset-x-0 bottom-0 z-[90] border-t-0 bg-black/90 px-2 py-1 pb-[calc(env(safe-area-inset-bottom)+0.25rem)] md:relative md:inset-auto md:z-[80] md:border-t md:border-zinc-200 md:bg-white md:px-4 md:py-3">
      {/* Reply Preview */}
      {replyTo && (
        <div className="mb-2 flex items-center gap-2 rounded-lg bg-blue-50 border-l-4 border-blue-500 px-3 py-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 text-xs text-blue-600 font-medium">
              <svg
                className="h-3 w-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                />
              </svg>
              <span>{replyTo.sender} kullanıcısına yanıt</span>
            </div>
            <p className="text-sm text-zinc-600 truncate mt-0.5 line-clamp-2">
              {formatMessageContent(replyTo.content)}
            </p>
          </div>
          <button
            onClick={onCancelReply}
            className="shrink-0 p-1 rounded-full hover:bg-blue-100 text-blue-500 hover:text-blue-700 transition-colors"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      )}
      {/* Image Preview Modal */}
      {showImagePreview && selectedImage && (
        <div className="fixed inset-0 z-[140] flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-8 sm:py-12">
          <div className="mt-6 w-full max-w-xl rounded-lg bg-white shadow-2xl max-h-[82vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-200">
              <h3 className="text-lg font-semibold text-zinc-900">
                Resim Önizleme
              </h3>
              <button
                onClick={handleCancelImage}
                className="text-zinc-500 hover:text-zinc-700 transition-colors"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Image Preview */}
            <div className="p-4">
              <div className="relative mx-auto max-w-[420px]">
                <img
                  src={selectedImage}
                  alt="Preview"
                  className="w-full rounded-lg bg-black"
                  style={{ maxHeight: "360px", objectFit: "contain" }}
                />
                {selectedImageIsGif && (
                  <span className="absolute right-3 top-3 rounded bg-black/75 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-white">
                    GIF
                  </span>
                )}
              </div>
            </div>

            {/* Caption Input */}
            <div className="p-4 border-t border-zinc-200">
              <input
                type="text"
                value={imageCaption}
                onChange={(e) => setImageCaption(e.target.value)}
                placeholder="Açıklama ekle (opsiyonel)..."
                className="w-full rounded-lg bg-zinc-100 px-4 py-2 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 p-4 border-t border-zinc-200">
              <button
                onClick={handleCancelImage}
                disabled={isUploading}
                className="px-4 py-2 rounded-lg text-zinc-700 hover:bg-zinc-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                İptal
              </button>
              <button
                onClick={handleSendImage}
                disabled={isUploading}
                className="px-6 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? "Gönderiliyor..." : "Gönder"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audio Preview Modal */}
      {showAudioPreview && selectedAudio && (
        <div className="fixed inset-0 bg-opacity-50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-200">
              <h3 className="text-lg font-semibold text-zinc-900">
                Ses Dosyası Önizleme
              </h3>
              <button
                onClick={handleCancelAudio}
                className="text-zinc-500 hover:text-zinc-700 transition-colors"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Audio Preview */}
            <div className="p-4">
              <div className="flex items-center gap-3 p-4 bg-zinc-50 rounded-lg">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-blue-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                    />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-900 truncate">
                    {audioFileName}
                  </p>
                  <audio controls className="w-full mt-2">
                    <source src={selectedAudio} />
                  </audio>
                </div>
              </div>
            </div>

            {/* Caption Input */}
            <div className="p-4 border-t border-zinc-200">
              <input
                type="text"
                value={audioCaption}
                onChange={(e) => setAudioCaption(e.target.value)}
                placeholder="Açıklama ekle (opsiyonel)..."
                className="w-full rounded-lg bg-zinc-100 px-4 py-2.5 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 p-4 border-t border-zinc-200">
              <button
                onClick={handleCancelAudio}
                disabled={isUploading}
                className="px-4 py-2 rounded-lg text-zinc-700 hover:bg-zinc-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                İptal
              </button>
              <button
                onClick={handleSendAudio}
                disabled={isUploading}
                className="px-6 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? "Gönderiliyor..." : "Gönder"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* YouTube Search Modal */}
      {showYouTubeModal && (
        <div className="fixed inset-0  bg-opacity-50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-200">
              <h3 className="text-lg font-semibold text-zinc-900">
                YouTube Video Ara
              </h3>
              <button
                onClick={handleCancelYouTube}
                className="text-zinc-500 hover:text-zinc-700 transition-colors"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Search Input */}
            <div className="p-4 border-b border-zinc-200">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={youtubeSearchQuery}
                  onChange={(e) => setYoutubeSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleYouTubeSearch();
                    }
                  }}
                  placeholder="Video ara..."
                  className="flex-1 rounded-lg bg-zinc-100 px-4 py-2.5 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
                <button
                  onClick={handleYouTubeSearch}
                  disabled={isSearching}
                  className="px-6 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSearching ? "Aranıyor..." : "Ara"}
                </button>
              </div>
            </div>

            {/* Search Results */}
            <div className="flex-1 overflow-y-auto p-4">
              {youtubeResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-zinc-400">
                  <svg
                    className="w-16 h-16 mb-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <p className="text-sm">
                    Video aramak için yukarıdaki arama kutusunu kullanın
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {youtubeResults.map((video) => (
                    <div
                      key={video.id.videoId}
                      onClick={() => handleSelectVideo(video)}
                      className={`cursor-pointer rounded-lg border-2 transition-all overflow-hidden flex gap-3 ${
                        selectedVideo?.id.videoId === video.id.videoId
                          ? "border-red-500 bg-red-50"
                          : "border-zinc-200 hover:border-red-300"
                      }`}
                    >
                      <div className="w-40 sm:w-48 flex-shrink-0">
                        <img
                          src={video.snippet.thumbnails.medium.url}
                          alt={video.snippet.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-3 pr-4 flex-1 flex flex-col justify-center">
                        <h4 className="font-medium text-sm text-zinc-900 line-clamp-2">
                          {video.snippet.title}
                        </h4>
                        <p className="text-xs text-zinc-500 mt-1">
                          {video.snippet.channelTitle}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            {selectedVideo && (
              <div className="flex items-center justify-between gap-3 p-4 border-t border-zinc-200 bg-zinc-50">
                <div className="flex items-center gap-3 min-w-0 max-w-[70%]">
                  <div className="w-20 h-12 rounded overflow-hidden flex-shrink-0">
                    <img
                      src={selectedVideo.snippet.thumbnails.default.url}
                      alt={selectedVideo.snippet.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-900 truncate">
                      {selectedVideo.snippet.title}
                    </p>
                    <p className="text-xs text-zinc-500 truncate">
                      {selectedVideo.snippet.channelTitle}
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 shrink-0">
                  <button
                    onClick={handleCancelYouTube}
                    className="px-4 py-2 rounded-lg text-zinc-700 hover:bg-zinc-200 transition-colors"
                  >
                    İptal
                  </button>
                  <button
                    onClick={handleSendYouTube}
                    className="px-6 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition-colors"
                  >
                    Gönder
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showRadioRequestModal && radioRequestUrl && (
        <div className="fixed inset-0 bg-opacity-50 flex items-center justify-center z-[100] p-4">
          <div
            className="bg-white rounded-lg w-full max-w-4xl h-[80vh] overflow-hidden flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-labelledby="radio-request-modal-title"
          >
            <div className="flex items-center justify-between p-4 border-b border-zinc-200">
              <h3
                id="radio-request-modal-title"
                className="text-lg font-semibold text-zinc-900"
              >
                Radyo İstek Paneli
              </h3>
              <button
                onClick={handleCloseRadioRequestModal}
                className="text-zinc-500 hover:text-zinc-700 transition-colors"
                aria-label="Radyo istek modalını kapat"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="flex-1 bg-zinc-50">
              <iframe
                src={radioRequestUrl}
                title="Radyo İstek Formu"
                className="w-full h-full border-0"
                onLoad={() => setIsRadioRequestIframeError(false)}
                onError={() => setIsRadioRequestIframeError(true)}
              />
            </div>

            <div className="p-4 border-t border-zinc-200 bg-white flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {isRadioRequestIframeError ? (
                <p className="text-sm text-zinc-600">
                  İstek paneli burada görüntülenemedi. Yeni sekmede açarak
                  devam edebilirsiniz.
                </p>
              ) : (
                <p className="text-sm text-zinc-500">
                  Form görünmezse veya çalışmazsa yeni sekmede açabilirsiniz.
                </p>
              )}
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  onClick={handleCloseRadioRequestModal}
                  className="px-4 py-2 rounded-lg text-zinc-700 hover:bg-zinc-100 transition-colors"
                >
                  Kapat
                </button>
                <button
                  onClick={handleOpenRadioRequestInNewTab}
                  className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium transition-colors"
                >
                  Yeni sekmede aç
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Warning Modal */}
      {showWarningModal && (
        <div className="fixed inset-0  bg-opacity-50 flex items-center justify-center z-[100]">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-4 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-orange-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-zinc-900 mb-2">
                  Uyarı
                </h3>
                <p className="text-sm text-zinc-600 mb-4">
                  Sesli sohbete katılmadan mikrofonu açamazsınız. Lütfen önce
                  sesli sohbete katılın.
                </p>
                <button
                  onClick={() => setShowWarningModal(false)}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Tamam
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Animation Picker */}
      {showAnimationPicker && (
        <div
          ref={animationPickerRef}
          className="absolute bottom-full left-2 mb-1.5 z-50 md:left-4 md:mb-2"
        >
          <AnimationPicker onAnimationSelect={handleAnimationSelect} />
        </div>
      )}

      {showEmojiPicker && (
        <div
          ref={emojiPickerRef}
          className="absolute bottom-full left-2 mb-1.5 z-50 md:left-4 md:mb-2"
        >
          <MsnEmojiPicker
            onEmojiSelect={(emojiUrl) => {
              // Send emoji as image
              handleAnimationSelect(emojiUrl);
              setShowEmojiPicker(false);
            }}
          />
        </div>
      )}
      <div className="chat-theme-toolbar flex h-10 items-center gap-1.5 md:h-auto md:flex-wrap md:gap-2">
        {/* Sol taraf - Dosya ve Emoji */}
        <button
          ref={animationButtonRef}
          type="button"
          onClick={() => setShowAnimationPicker(!showAnimationPicker)}
          className={`order-3 h-7 w-7 shrink-0 items-center justify-center text-white transition-colors hover:text-white/80 md:order-none md:flex md:h-10 md:w-10 md:rounded-lg md:bg-blue-500 md:hover:bg-blue-600 ${
            isMobileTypingMode ? "hidden" : "flex"
          } ${
            showAnimationPicker ? "text-white md:ring-2 md:ring-blue-300" : ""
          }`}
          title="Gif atma"
        >
          <Bookmark className="h-6 w-6 stroke-[1.8] md:hidden" />
          <FileText className="hidden h-5 w-5 md:block" />
        </button>
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          className={`order-1 flex h-7 w-7 shrink-0 items-center justify-center text-white transition-colors hover:text-white/80 md:order-none md:h-10 md:w-10 md:text-zinc-600 md:hover:text-zinc-900 ${
            showEmojiPicker
              ? "text-white md:rounded-lg md:bg-zinc-100 md:text-zinc-900"
              : ""
          }`}
          title="Emojiler"
        >
          <Smile className="h-6 w-6 stroke-[1.8] md:h-6 md:w-6 md:stroke-2" />
        </button>

        {/* Mesaj Input */}
        <div className="relative order-2 min-w-0 flex-1 md:order-none md:basis-auto">
          {showTypingIndicatorsEnabled && typingUsers.length > 0 && (
            <div className="absolute bottom-full left-0 mb-2 z-50 animate-in fade-in slide-in-from-bottom-1 duration-300">
              <div className="bg-white shadow-md border border-zinc-300 pl-2.5 pr-4 py-1.5 rounded-full flex items-center gap-2">
                <div className="flex gap-0.5 pt-0.5">
                  <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce"></div>
                </div>
                <span className="text-[11px] font-medium text-zinc-500">
                  <span className="font-bold text-zinc-800">
                    {typingUsers.join(", ")}
                  </span>{" "}
                  {typingUsers.length > 1 ? "yazıyorlar..." : "yazıyor..."}
                </span>
              </div>
            </div>
          )}
          <input
            type="text"
            value={message}
            onChange={handleMessageChange}
            onKeyDown={handleKeyDown}
            className="w-full bg-transparent py-0.5 pl-1 pr-1 text-[24px] font-light leading-none text-white placeholder-white/90 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 md:rounded-lg md:bg-zinc-100 md:py-2.5 md:pl-4 md:pr-10 md:text-base md:font-normal md:leading-normal md:text-zinc-900 md:placeholder-zinc-400"
            placeholder={
              floodCooldown > 0
                ? `Flood koruması aktif! ${floodCooldown} saniye bekleyin...`
                : firstMessageDelayRemaining > 0
                  ? `${firstMessageDelayRemaining} saniye sonra mesaj gönderebilirsiniz...`
                  : sendBlockedPlaceholder
                    ? sendBlockedPlaceholder
                  : writingDisabled
                    ? writingDisabledReason || "Mesaj..."
                    : "Mesaj..."
            }
            disabled={
              floodCooldown > 0 ||
              firstMessageDelayRemaining > 0 ||
              sendBlocked ||
              writingDisabled
            }
          />

          {canUseGeneralBroadcast && (
            <div className="absolute right-2 top-1/2 hidden -translate-y-1/2 items-center md:flex">
              <button
                ref={targetGroupButtonRef}
                type="button"
                onClick={() => setShowTargetGroupMenu(!showTargetGroupMenu)}
                className={`p-1 rounded-md transition-all ${
                  !isTargetGroupFixed && isOnRoof
                    ? "text-red-500 animate-pulse bg-red-50"
                    : targetGroup === "everyone"
                      ? "text-zinc-400 hover:text-blue-500 hover:bg-blue-50"
                      : targetGroup === "members"
                        ? "text-blue-500 bg-blue-50"
                        : "text-green-500 bg-green-50"
                }`}
                title={
                  targetGroup === "everyone"
                    ? "Herkese Gönder"
                    : targetGroup === "members"
                      ? "Sadece Üyelere Gönder"
                      : "Sadece Yetkililere Gönder"
                }
              >
                <ChevronUp
                  className={`h-5 w-5 transition-transform duration-200 ${
                    showTargetGroupMenu ? "rotate-180" : ""
                  }`}
                />
              </button>

              {showTargetGroupMenu && (
                <div
                  ref={targetGroupMenuRef}
                  className="absolute bottom-full right-0 z-[500] mb-2 w-56 max-w-[calc(100vw-32px)] overflow-hidden rounded-xl border border-zinc-100 bg-white py-2 shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200 md:w-48"
                >
                  <div className="px-3 py-1.5 mb-1">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                      GÖNDERİM HEDEFİ
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setTargetGroup("everyone");
                      setIsTargetGroupFixed(true);
                      setShowTargetGroupMenu(false);
                      void handleSendMessage(undefined, "everyone");
                    }}
                    className={`flex w-full items-center gap-3 px-4 py-2 text-sm transition-colors ${
                      targetGroup === "everyone" && isTargetGroupFixed
                        ? "bg-blue-50 text-blue-600 font-medium"
                        : "text-zinc-600 hover:bg-zinc-50"
                    }`}
                  >
                    <Globe className="h-4 w-4" />
                    <span>Herkese Gönder</span>
                  </button>
                  <button
                    onClick={() => {
                      setTargetGroup("members");
                      setIsTargetGroupFixed(true);
                      setShowTargetGroupMenu(false);
                      void handleSendMessage(undefined, "members");
                    }}
                    className={`flex w-full items-center gap-3 px-4 py-2 text-sm transition-colors ${
                      targetGroup === "members" && isTargetGroupFixed
                        ? "bg-blue-50 text-blue-600 font-medium"
                        : "text-zinc-600 hover:bg-zinc-50"
                    }`}
                  >
                    <Users className="h-4 w-4" />
                    <span>Üyelere Gönder</span>
                  </button>
                  <button
                    onClick={() => {
                      setTargetGroup("staff");
                      setIsTargetGroupFixed(true);
                      setShowTargetGroupMenu(false);
                      void handleSendMessage(undefined, "staff");
                    }}
                    className={`flex w-full items-center gap-3 px-4 py-2 text-sm transition-colors ${
                      targetGroup === "staff" && isTargetGroupFixed
                        ? "bg-green-50 text-green-600 font-medium"
                        : "text-zinc-600 hover:bg-zinc-50"
                    }`}
                  >
                    <ShieldCheck className="h-4 w-4" />
                    <span>Yetkililere Gönder</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sağ taraf - Aksiyon butonları */}
        <div className="chat-theme-mobile-actions order-4 flex min-w-0 shrink-0 items-center justify-end gap-0.5 md:order-none md:flex-none md:gap-1 md:overflow-visible">
          <button
            type="button"
            onClick={handleSendMessage}
            disabled={
              !message.trim() ||
              !socket ||
              floodCooldown > 0 ||
              firstMessageDelayRemaining > 0 ||
              sendBlocked ||
              writingDisabled
            }
            className={`h-7 w-7 shrink-0 items-center justify-center text-white transition-colors hover:text-white/80 disabled:opacity-40 md:hidden ${
              isMobileTypingMode ? "flex" : "hidden"
            }`}
            aria-label="Mesaj gönder"
          >
            <Play className="h-6 w-6 fill-white stroke-[1.8]" />
          </button>
          <div className={`relative md:hidden ${isMobileTypingMode ? "block" : "hidden"}`}>
            <button
              ref={mobileTargetButtonRef}
              type="button"
              onClick={() => {
                setShowMobileTargetMenu((current) => !current);
                setShowMobileRadioMenu(false);
                setShowMobilePlusMenu(false);
                setShowAttachmentMenu(false);
              }}
              className="flex h-7 w-7 shrink-0 items-center justify-center text-white transition-colors hover:text-white/80"
              aria-label="Gönderim hedefi"
            >
              <MoreVertical className="h-6 w-6 stroke-[1.8]" />
            </button>
            {showMobileTargetMenu && (
              <div
                ref={mobileTargetMenuRef}
                className="fixed right-2 bottom-[50px] z-[500] w-[128px] overflow-hidden rounded-[14px] bg-white/95 text-[14px] text-[#007aff] shadow-sm md:hidden"
              >
                <button
                  type="button"
                  onClick={() => {
                    setTargetGroup("everyone");
                    setIsTargetGroupFixed(true);
                    setShowMobileTargetMenu(false);
                    void handleSendMessage(undefined, "everyone");
                  }}
                  className="flex h-9 w-full items-center justify-center border-b border-zinc-200/80"
                >
                  Herkese
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTargetGroup("staff");
                    setIsTargetGroupFixed(true);
                    setShowMobileTargetMenu(false);
                    void handleSendMessage(undefined, "staff");
                  }}
                  className="flex h-9 w-full items-center justify-center border-b border-zinc-200/80"
                >
                  Yetkililere
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTargetGroup("members");
                    setIsTargetGroupFixed(true);
                    setShowMobileTargetMenu(false);
                    void handleSendMessage(undefined, "members");
                  }}
                  className="flex h-9 w-full items-center justify-center border-b border-zinc-200/80"
                >
                  Üyelere
                </button>
              </div>
            )}
          </div>
          <div className="relative">
            <button
              ref={attachmentButtonRef}
              type="button"
              onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
              className={`h-7 w-7 shrink-0 items-center justify-center text-white transition-colors hover:text-white/80 md:flex md:h-9 md:w-9 md:text-zinc-500 md:hover:text-zinc-700 ${
                isMobileTypingMode ? "hidden" : "flex"
              } ${
                showAttachmentMenu ? "text-white md:text-zinc-900" : ""
              }`}
              title="Ataç işareti"
            >
              <Paperclip className="h-6 w-6 stroke-[1.8] md:h-5 md:w-5 md:stroke-2" />
            </button>

            {showAttachmentMenu && (
              <div
                ref={attachmentMenuRef}
                className="fixed bottom-[50px] right-2 z-[500] w-[min(calc(100vw-16px),286px)] max-h-[min(58dvh,282px)] space-y-1.5 overflow-y-auto rounded-none border-0 bg-transparent p-0 text-[14px] shadow-none md:absolute md:inset-x-auto md:bottom-full md:right-0 md:mb-2 md:max-h-none md:w-48 md:space-y-0 md:overflow-visible md:rounded-xl md:border md:border-zinc-100 md:bg-white md:py-2 md:text-sm md:shadow-2xl"
              >
                <div className="flex h-8 items-center justify-center rounded-[12px] bg-white/95 px-3 text-center text-[13px] text-zinc-400 shadow-sm md:hidden">
                  Ses veya Fotoğraf Gönderme...
                </div>
                <button
                  onClick={() => {
                    if (isInVoiceChat) {
                      localStorage.setItem("voiceChatOptOut", "true");
                      leaveVoiceChat();
                    } else {
                      localStorage.removeItem("voiceChatOptOut");
                      joinVoiceChat();
                    }
                  }}
                  className="hidden w-full items-center gap-2 px-3 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 md:flex"
                  title={
                    isOnRoof
                      ? "Çatıdayken sadece dinleyici olarak bağlanabilirsiniz"
                      : micDisabled
                        ? micDisabledReason ||
                          "Mikrofon açma kısıtlı, ancak dinleyici olarak bağlanabilirsiniz."
                        : undefined
                  }
                >
                  <Volume
                    className={`h-5 w-5 ${
                      isOnRoof && currentUserStarCount < 1
                        ? "text-zinc-400"
                        : isInVoiceChat
                          ? "text-green-500"
                          : "text-red-500"
                    }`}
                  />
                  <span>
                    {isOnRoof
                      ? "Sesli Sohbet Kapalı"
                      : isInVoiceChat
                        ? "Sesli Sohbeti Kapat"
                        : "Sesli Sohbeti Aç"}
                  </span>
                </button>
                {hasPermission(
                  chatPermissions?.chatImageSendPermission || "EVERYONE",
                ) && (
                  <button
                    onClick={() => imageInputRef.current?.click()}
                    disabled={isUploading}
                    className="flex h-9 w-full items-center gap-2 rounded-[12px] bg-white/95 px-3 text-[14px] text-[#007aff] shadow-sm hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 md:h-auto md:gap-2 md:rounded-none md:bg-transparent md:px-3 md:py-2.5 md:text-sm md:text-zinc-700 md:shadow-none md:hover:bg-zinc-50"
                  >
                    <Image className="h-5 w-5 text-[#007aff] md:h-5 md:w-5 md:text-zinc-500" />
                    <span>{isUploading ? "Yükleniyor..." : "Fotoğraf Gönder..."}</span>
                  </button>
                )}
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                {hasPermission(
                  chatPermissions?.chatVoiceSendPermission || "EVERYONE",
                ) && (
                  <button
                    onClick={() => audioInputRef.current?.click()}
                    disabled={isUploading}
                    className="flex h-9 w-full items-center gap-2 rounded-t-[12px] bg-white/95 px-3 text-[14px] text-[#007aff] shadow-sm hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 md:h-auto md:gap-2 md:rounded-none md:bg-transparent md:px-3 md:py-2.5 md:text-sm md:text-zinc-700 md:shadow-none md:hover:bg-zinc-50"
                  >
                    <Radio className="h-5 w-5 text-[#007aff] md:h-5 md:w-5 md:text-zinc-500" />
                    <span>{isUploading ? "Yükleniyor..." : "Mp3 Gönder..."}</span>
                  </button>
                )}
                <input
                  ref={audioInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={handleAudioUpload}
                  className="hidden"
                />
                <button
                  onClick={() => {
                    setShowAttachmentMenu(false);
                    setShowVoiceRecorder(true);
                    resetRecordingState();
                  }}
                  className="flex h-9 w-full items-center gap-2 border-t border-zinc-200/80 bg-white/95 px-3 text-[14px] text-[#007aff] shadow-sm hover:bg-white md:hidden"
                >
                  <Mic className="h-5 w-5 text-[#007aff]" />
                  <span>Sesli Mesaj</span>
                </button>
                <button
                  onClick={handleOpenRadioRequestModal}
                  className="hidden w-full items-center gap-2 px-3 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 md:flex"
                >
                  <Radio className="h-5 w-5 text-zinc-500" />
                  <span>Radyo istek yap</span>
                </button>
                {hasPermission(
                  chatPermissions?.chatYoutubeSendPermission || "EVERYONE",
                ) && (
                  <button
                    onClick={() => {
                      setShowAttachmentMenu(false);
                      setShowYouTubeModal(true);
                    }}
                    className="flex h-9 w-full items-center gap-2 rounded-[12px] bg-white/95 px-3 text-[14px] text-[#007aff] shadow-sm hover:bg-white md:h-auto md:gap-2 md:rounded-none md:bg-transparent md:px-3 md:py-2.5 md:text-sm md:text-zinc-700 md:shadow-none md:hover:bg-zinc-50"
                  >
                    <Youtube className="h-5 w-5 text-[#007aff] md:h-5 md:w-5 md:text-zinc-500" />
                    <span>YouTube</span>
                  </button>
                )}
                {hasPermission(
                  chatPermissions?.chatVoiceRecordSendPermission || "EVERYONE",
                ) && (
                  <button
                    onClick={() => {
                      setShowAttachmentMenu(false);
                      setShowVoiceRecorder(true);
                      resetRecordingState();
                    }}
                    className="hidden w-full items-center gap-2 px-3 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 md:flex"
                  >
                    <Circle className="h-4 w-4 fill-red-500 text-red-500" />
                    <span>Sesli mesaj</span>
                  </button>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              if (isHandDisabled) return;
              onToggleHand?.();
            }}
            className={`hidden h-9 w-9 shrink-0 items-center justify-center md:flex ${
              isHandDisabled
                ? "text-zinc-300 cursor-not-allowed"
                : isHandRaised
                  ? "text-amber-600 hover:text-amber-700"
                  : "text-zinc-500 hover:text-zinc-700"
            }`}
            aria-pressed={isHandRaised}
            title={
              isHandDisabled
                ? isMicOpen
                  ? "Mikrofon açıkken el kaldırılamaz"
                  : "El kaldırma şu an kullanılamaz"
                : isHandRaised
                  ? "Elini indir"
                  : "El kaldır"
            }
          >
            <Hand className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={handleMicClick}
            className={`hidden md:flex h-9 w-9 shrink-0 items-center justify-center ${
              micDisabled
                ? "text-zinc-300 cursor-not-allowed"
                : !isInVoiceChat
                  ? "text-zinc-400 cursor-pointer"
                  : isMuted
                    ? "text-red-500 hover:text-red-600"
                    : "text-green-500 hover:text-green-600"
            }`}
            title={
              micDisabled
                ? micDisabledReason ||
                  "Mikrofon kullanımı güvenlik ayarları nedeniyle kısıtlı."
                : micWaitRemainingSeconds > 0 && isInVoiceChat && isMuted
                  ? `Mikrofonu açmak için ${micWaitRemainingSeconds} sn bekleyin`
                : isOnRoof
                  ? "Çatıdayken mikrofon kullanılamaz"
                  : !isInVoiceChat
                    ? "Önce sesli sohbete katılın"
                    : isMuted
                      ? "Mikrofonu aç"
                      : "Mikrofonu kapat"
            }
          >
            {isMuted ? (
              <MicOff className="h-5 w-5" />
            ) : (
              <Mic className="h-5 w-5" />
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              void handleCameraClick();
            }}
            className={`hidden h-9 w-9 shrink-0 items-center justify-center md:flex ${
              isCameraOpen
                ? "text-green-500 hover:text-green-600"
                : "text-blue-500 hover:text-blue-600"
            }`}
            title={isCameraOpen ? "Kamerayı kapat" : "Kamerayı aç"}
            aria-pressed={isCameraOpen}
          >
            <Video className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={toggleDeafen}
            disabled={!isInVoiceChat}
            className={`hidden md:flex h-9 w-9 shrink-0 items-center justify-center ${
              !isInVoiceChat
                ? "text-zinc-300 cursor-not-allowed"
                : isDeafened
                  ? "text-red-500 hover:text-red-600"
                  : "text-zinc-500 hover:text-zinc-700"
            }`}
            title={
              !isInVoiceChat
                ? "Sesli sohbete katılmadan kullanamazsınız"
                : isDeafened
                  ? "Sesi aç (diğerlerini duy)"
                  : "Sesi kapat (diğerlerini duyma)"
            }
          >
            <Volume2 className="h-5 w-5" />
          </button>
          <button
            type="button"
            ref={mobileRadioButtonRef}
            onClick={() => {
              if (window.innerWidth < 768) {
                setShowMobileRadioMenu((current) => !current);
                setShowMobilePlusMenu(false);
                setShowAttachmentMenu(false);
                return;
              }
              void handleToggleRadio();
            }}
            className={`h-7 w-7 shrink-0 items-center justify-center md:flex md:order-none md:h-9 md:w-9 ${
              isMobileTypingMode ? "hidden" : "flex"
            } ${
              isRadioPlaying
                ? "text-white hover:text-white/80 md:text-green-600 md:hover:text-green-700"
                : "text-white hover:text-white/80 md:text-orange-500 md:hover:text-orange-600"
            } ${!effectiveRadioLink ? "cursor-not-allowed opacity-60" : ""}`}
            title={
              effectiveRadioLink
                ? isRadioPlaying
                  ? "Radyoyu durdur"
                  : "Radyoyu başlat"
                : "Radyo bağlantısı bulunamadı"
            }
            aria-pressed={isRadioPlaying}
          >
            <svg
              className="h-6 w-6 radyo md:h-5 md:w-5"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M20 6H8.3l8.26-3.34L15.88 1 3.24 6.15C2.51 6.43 2 7.17 2 8v12c0 1.1.89 2 2 2h16c1.11 0 2-.9 2-2V8c0-1.11-.89-2-2-2zM7 20c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm13-8h-2v-2h-2v2H4V8h16v4z" />
            </svg>
          </button>
          {showMobileRadioMenu && (
            <div
              ref={mobileRadioMenuRef}
              className="fixed bottom-[50px] right-2 z-[500] w-[min(calc(100vw-16px),260px)] overflow-hidden rounded-[12px] bg-white/95 text-[14px] text-[#007aff] shadow-sm md:hidden"
            >
              <button
                type="button"
                onClick={() => {
                  setShowMobileRadioMenu(false);
                  if (isInVoiceChat) {
                    toggleDeafen();
                  } else {
                    void joinVoiceChat();
                  }
                }}
                className="flex h-9 w-full items-center gap-2 border-b border-zinc-200/80 px-3 text-left"
              >
                <span className="relative flex h-5 w-5 items-center justify-center">
                  <Volume2 className="h-5 w-5" />
                  {(!isInVoiceChat || isDeafened) && (
                    <span className="pointer-events-none absolute h-[2px] w-6 rotate-[-38deg] rounded-full bg-[#007aff] shadow-[0_0_0_1px_rgba(255,255,255,0.75)]" />
                  )}
                </span>
                <span className="flex-1">Ses</span>
                <span
                  className={`relative h-7 w-12 rounded-full transition-colors ${
                    isInVoiceChat && !isDeafened ? "bg-[#007aff]" : "bg-zinc-300"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-md transition-transform ${
                      isInVoiceChat && !isDeafened
                        ? "translate-x-5"
                        : "translate-x-0.5"
                    }`}
                  />
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowMobileRadioMenu(false);
                  void handleToggleRadio();
                }}
                className="flex h-9 w-full items-center gap-2 border-b border-zinc-200/80 px-3 text-left"
              >
                <Radio className="h-5 w-5" />
                <span>{isRadioPlaying ? "Radyo Kapat" : "Radyo Aç"}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowMobileRadioMenu(false);
                  handleOpenRadioRequestModal();
                }}
                className="flex h-9 w-full items-center gap-2 px-3 text-left"
              >
                <FileText className="h-5 w-5" />
                <span>Radyo istek yap</span>
              </button>
            </div>
          )}
          <button
            type="button"
            ref={mobilePlusButtonRef}
            onClick={() => {
              setShowMobilePlusMenu((current) => !current);
              setShowMobileRadioMenu(false);
              setShowAttachmentMenu(false);
            }}
            className={`h-6 w-6 shrink-0 items-center justify-center text-white transition-colors hover:text-white/80 md:hidden ${
              isMobileTypingMode ? "hidden" : "flex"
            }`}
            title="Artı işareti"
          >
            <Plus className="h-5 w-5 stroke-[1.9]" />
          </button>
          {showMobilePlusMenu && (
            <div
              ref={mobilePlusMenuRef}
              className="fixed bottom-[46px] right-2 z-[500] max-h-[min(46dvh,260px)] w-[min(calc(100vw-24px),218px)] overflow-y-auto rounded-[10px] bg-white/95 text-[13px] text-black shadow-sm md:hidden"
            >
              <button
                type="button"
                onClick={() => {
                  setShowMobilePlusMenu(false);
                  onManageRoom?.();
                }}
                disabled={currentUserStarCount < 1 || !onManageRoom}
                className="flex h-7 w-full items-center gap-1.5 border-b border-zinc-200/80 px-2.5 text-left text-[#007aff] disabled:text-zinc-500 disabled:opacity-50"
              >
                <Settings className="h-4.5 w-4.5 text-zinc-500" />
                <span>Bu odayı yönet...</span>
              </button>
              <div className="flex h-7 w-full items-center gap-1.5 border-b border-zinc-200/80 px-2.5">
                <Star className="h-4.5 w-4.5 fill-zinc-500 text-zinc-500" />
                <span className="font-semibold">Sahip:</span>
                <span>{roomOwnerName || "ROOT"}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowMobilePlusMenu(false);
                  if (isInVoiceChat) {
                    localStorage.setItem("voiceChatOptOut", "true");
                    leaveVoiceChat();
                  } else {
                    localStorage.removeItem("voiceChatOptOut");
                    void joinVoiceChat();
                  }
                }}
                className="flex h-8 w-full items-center gap-1.5 border-b border-zinc-200/80 px-2.5 text-left"
              >
                <Volume className="h-4.5 w-4.5 text-zinc-500" />
                <span className="flex-1">Canlı Yayın</span>
                <span
                  className={`relative h-6 w-10 rounded-full transition-colors ${
                    isInVoiceChat ? "bg-[#007aff]" : "bg-zinc-300"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-transform ${
                      isInVoiceChat ? "translate-x-4" : "translate-x-0.5"
                    }`}
                  />
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowMobilePlusMenu(false);
                  void handleCameraClick();
                }}
                className="flex h-7 w-full items-center gap-1.5 border-b border-zinc-200/80 px-2.5 text-left"
              >
                <Video className="h-4.5 w-4.5 text-zinc-500" />
                <span>Kamera aç</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowMobilePlusMenu(false);
                  handleMicClick();
                }}
                className="flex h-7 w-full items-center gap-1.5 border-b border-zinc-200/80 px-2.5 text-left"
              >
                {isInVoiceChat && !isMuted ? (
                  <MicOff className="h-4.5 w-4.5 text-zinc-500" />
                ) : (
                  <Mic className="h-4.5 w-4.5 text-zinc-500" />
                )}
                <span>
                  {isInVoiceChat && !isMuted ? "Mikrofon bırak" : "Mikrofon al"}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowMobilePlusMenu(false);
                  toggleDeafen();
                }}
                disabled={!isInVoiceChat}
                className="flex h-7 w-full items-center gap-1.5 border-b border-zinc-200/80 px-2.5 text-left disabled:opacity-50"
              >
                <Volume2 className="h-4.5 w-4.5 text-zinc-500" />
                <span>Hoparlör kapat</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (isHandDisabled) return;
                  setShowMobilePlusMenu(false);
                  onToggleHand?.();
                }}
                disabled={isHandDisabled}
                className="flex h-7 w-full items-center gap-1.5 border-b border-zinc-200/80 px-2.5 text-left disabled:opacity-50"
              >
                <Hand className="h-4.5 w-4.5 text-zinc-500" />
                <span>El kaldır</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowMobilePlusMenu(false);
                  onDeleteRoomMessages?.();
                }}
                disabled={!canDeleteRoomMessages || !onDeleteRoomMessages}
                className="flex h-7 w-full items-center gap-1.5 border-b border-zinc-200/80 px-2.5 text-left disabled:opacity-50"
              >
                <Trash2 className="h-4.5 w-4.5 text-zinc-500" />
                <span>Oda yazılarını sil</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowMobilePlusMenu(false);
                  onDeleteHistory?.();
                }}
                disabled={!onDeleteHistory}
                className="flex h-7 w-full items-center gap-1.5 border-b border-zinc-200/80 px-2.5 text-left disabled:opacity-50"
              >
                <History className="h-4.5 w-4.5 text-zinc-500" />
                <span>Geçmiş kaydı</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowMobilePlusMenu(false);
                  onClearScreen?.();
                }}
                disabled={!onClearScreen}
                className="flex h-7 w-full items-center gap-1.5 px-2.5 text-left disabled:opacity-50"
              >
                <Fan className="h-4.5 w-4.5 text-zinc-500" />
                <span>Ekran Temizle</span>
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={handleSendMessage}
            disabled={
              !message.trim() ||
              !socket ||
              floodCooldown > 0 ||
              firstMessageDelayRemaining > 0 ||
              sendBlocked ||
              writingDisabled
            }
            className="ml-1 hidden h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-white hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 md:flex"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
        {isRecording && (
          <div className="absolute left-4 bottom-full mb-1 flex items-center gap-2 text-sm text-red-600">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            <span>Kayıt {recordingTime}s</span>
          </div>
        )}
      </div>

      {showCameraPreview && (
        <div
          className="fixed bottom-24 right-4 z-[70] w-[250px] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl sm:w-[280px]"
          style={{
            transform: `translate(${cameraPreviewPos.x}px, ${cameraPreviewPos.y}px)`,
          }}
        >
            <div
              className="flex cursor-move select-none items-center justify-between border-b border-zinc-200 px-3 py-2"
              onMouseDown={(event) => {
                const target = event.target as HTMLElement;
                if (target.closest("button")) return;
                event.preventDefault();
                cameraPreviewDragStartRef.current = {
                  x: event.clientX,
                  y: event.clientY,
                };
                setIsDraggingCameraPreview(true);
              }}
            >
              <h3 className="text-sm font-semibold text-zinc-900">Kameranız</h3>
              <button
                type="button"
                onClick={() => {
                  void handleCameraClick();
                }}
                className="rounded-full p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
                aria-label="Kamerayı kapat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-3">
              <div
                ref={cameraPreviewContainerRef}
                className="h-40 w-full rounded-lg bg-zinc-100"
              />
            </div>
        </div>
      )}

      {showVoiceRecorder && (
        <div className="absolute left-4 right-4 bottom-16 sm:bottom-20 sm:right-auto sm:w-[350px] z-40">
          <div className="rounded-xl border border-zinc-200 bg-white shadow-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-zinc-900">
                  Sesli Mesaj
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    recorderStatus === "recording"
                      ? "bg-red-100 text-red-700"
                      : recorderStatus === "recorded"
                        ? "bg-green-100 text-green-700"
                        : "bg-zinc-100 text-zinc-600"
                  }`}
                >
                  {recorderStatus === "recording"
                    ? "Kayıtta"
                    : recorderStatus === "recorded"
                      ? "Hazır"
                      : "Hazırda"}
                </span>
              </div>
              <button
                onClick={handleCloseRecorder}
                className="text-zinc-500 hover:text-zinc-700 transition-colors"
                aria-label="Kapat"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center gap-2 text-sm text-zinc-600">
              <span
                className={`h-2 w-2 rounded-full ${
                  recorderStatus === "recording"
                    ? "bg-red-500 animate-pulse"
                    : recorderStatus === "recorded"
                      ? "bg-green-500"
                      : "bg-zinc-300"
                }`}
              />
              <span>
                {recorderStatus === "recording"
                  ? `Kayıt ${recordingTime}s`
                  : recorderStatus === "recorded"
                    ? "Kayıt hazır, dinleyip gönderebilirsin."
                    : "Hazırda bekliyor"}
              </span>
            </div>

            {recordedAudioUrl && (
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <audio ref={audioPlayerRef} controls className="w-full">
                  <source src={recordedAudioUrl} />
                </audio>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                onClick={() => {
                  resetRecordingState();
                  setShowVoiceRecorder(true);
                  startVoiceRecording();
                }}
                disabled={isRecording || isUploading}
                className="w-full rounded-lg bg-blue-500 text-white text-sm py-2 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Başlat
              </button>
              <button
                onClick={stopVoiceRecording}
                disabled={!isRecording}
                className="w-full rounded-lg bg-red-500 text-white text-sm py-2 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Durdur
              </button>
              <button
                onClick={() => resetRecordingState()}
                className="w-full rounded-lg bg-zinc-100 text-sm py-2 text-zinc-700 hover:bg-zinc-200"
              >
                Sıfırla
              </button>
              <button
                onClick={() => {
                  resetRecordingState();
                  startVoiceRecording();
                }}
                className="w-full rounded-lg bg-zinc-100 text-sm py-2 text-zinc-700 hover:bg-zinc-200"
              >
                Tekrar kaydet
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-zinc-500">
                Açıklama (opsiyonel)
              </label>
              <input
                type="text"
                value={audioCaption}
                onChange={(e) => setAudioCaption(e.target.value)}
                className="w-full rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Not ekle..."
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={handleCloseRecorder}
                className="px-4 py-2 text-sm rounded-lg text-zinc-700 hover:bg-zinc-100"
              >
                İptal
              </button>
              <button
                onClick={handleSendRecordedVoice}
                disabled={isRecording || !recordedAudioBase64 || isUploading}
                className="px-5 py-2 text-sm rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Gönder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
