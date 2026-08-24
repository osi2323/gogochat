"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlignJustify,
  Bell,
  Brush,
  Check,
  ChevronDown,
  History,
  KeyRound,
  LogOut,
  Palette,
  Pencil,
  Share2,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Type,
  Upload,
  UserCircle,
  X,
} from "lucide-react";
import type { Socket } from "socket.io-client";
import { RegisterModal } from "../auth/RegisterModal";
import { JoinEffectModal } from "./JoinEffectModal";
import { clearClientAuthState, getClientApiClient } from "@/lib/api/clientApi";
import Image from "next/image";
import { toast } from "sonner";
import {
  ChatPreferences,
  defaultChatPreferences,
  mergeChatPreferences,
  readChatPreferencesFromStorage,
  writeChatPreferencesToStorage,
} from "@/lib/chatPreferences";
import {
  CHAT_FONT_GROUPS,
  getChatFontFamily,
  getChatFontPreviewClass,
} from "@/lib/chatFonts";
import {
  CHAT_GRANITE_GROUPS,
  getChatGraniteOption,
} from "@/lib/chatGranites";
import { isJoinEffectId, type JoinEffectId } from "@/lib/joinEffects";
import { hasEffectivePermission, PERMISSION_LABELS } from "@/lib/permissions";
import { formatRoleLabel } from "@/lib/roleLabels";
import { resolveAvatarUrl } from "@/lib/avatarUrl";
import "@/styles/granit-effects.css";
import "@/styles/join-effects.css";

const isTimeoutError = (error: unknown) =>
  error instanceof Error &&
  error.message.toLowerCase().includes("timeout");

type SettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  socket?: Socket | null;
  currentUserStarCount?: number;
  canUseRoof?: boolean;
  canAccessAdminPanel?: boolean;
  onOpenAdminPanel?: () => void;
  onWhatsAppShare?: () => void;
  onSafeExit?: () => void;
};

type BooleanChatPreferenceKey = Exclude<
  keyof ChatPreferences,
  "ignoredUsernames"
>;

type StatusModeOption = { id: number; name: string };
type SiteTheme = "default" | "dark" | "ocean" | "rose" | "emerald";
type MobileSettingsSection =
  | "home"
  | "roomDesign"
  | "writing"
  | "general"
  | "notifications"
  | "history"
  | "theme";

const siteThemeOptions: Array<{
  id: SiteTheme;
  label: string;
  previewClassName: string;
}> = [
  {
    id: "default",
    label: "Varsayılan",
    previewClassName: "bg-linear-to-br from-white via-zinc-100 to-sky-100",
  },
  {
    id: "dark",
    label: "Koyu",
    previewClassName: "bg-linear-to-br from-zinc-950 via-zinc-800 to-slate-700",
  },
  {
    id: "ocean",
    label: "Okyanus",
    previewClassName: "bg-linear-to-br from-cyan-200 via-sky-400 to-cyan-700",
  },
  {
    id: "rose",
    label: "Gül",
    previewClassName: "bg-linear-to-br from-rose-100 via-pink-400 to-rose-700",
  },
  {
    id: "emerald",
    label: "Zümrüt",
    previewClassName: "bg-linear-to-br from-emerald-100 via-emerald-400 to-teal-700",
  },
];

const readStoredSiteTheme = (): SiteTheme => {
  if (typeof window === "undefined") return "default";
  const stored = localStorage.getItem("chatSiteTheme");
  if (
    stored === "dark" ||
    stored === "ocean" ||
    stored === "rose" ||
    stored === "emerald"
  ) {
    return stored;
  }
  if (stored === "blue") return "ocean";
  return "default";
};

const resolveProfileIconSource = (icon?: string | null) => {
  return resolveAvatarUrl(icon);
};

const withImageVersion = (path?: string | null) => {
  if (!path) return null;
  if (path.startsWith("data:")) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}v=${Date.now()}`;
};

const resolveProfileFrameSource = (frame?: string | null) => {
  const normalized = frame?.trim();
  if (!normalized) return null;
  if (normalized.startsWith("/")) return normalized;
  if (normalized.startsWith("http")) return normalized;
  return `/cerceveler/${normalized.replace(/\.[^/.]+$/, "")}.gif`;
};

const parseStoredStatusId = (value: string | null): number | null => {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const resolveMemberStatusMode = (
  statusModes: StatusModeOption[],
  options?: {
    preferredId?: number | null;
    preferredName?: string | null;
    fallbackId?: number | null;
    fallbackName?: string | null;
    allowRoof?: boolean;
  },
): StatusModeOption | null => {
  const roofMode = statusModes.find((mode) => mode.name === "Çatıda") ?? null;
  const onlineMode =
    statusModes.find((mode) => mode.name === "Çevrimiçi") ?? null;
  const allowRoof = options?.allowRoof ?? true;
  const normalizeForRoofAccess = (
    mode: StatusModeOption | null,
  ): StatusModeOption | null => {
    if (!mode) return null;
    if (allowRoof || mode.name !== "Çatıda") return mode;
    return onlineMode ?? null;
  };

  if (options?.preferredName) {
    const preferredByName = statusModes.find(
      (mode) => mode.name === options.preferredName,
    );
    if (preferredByName) return normalizeForRoofAccess(preferredByName);
  }
  if (options?.preferredId !== undefined && options.preferredId !== null) {
    const preferredById = statusModes.find(
      (mode) => mode.id === options.preferredId,
    );
    if (preferredById) return normalizeForRoofAccess(preferredById);
  }

  if (typeof window !== "undefined") {
    const isOnRoof = localStorage.getItem("roofStatus") === "true";
    if (isOnRoof && roofMode) return normalizeForRoofAccess(roofMode);

    const storedId = parseStoredStatusId(localStorage.getItem("statusModeId"));
    if (storedId !== null) {
      const storedById = statusModes.find((mode) => mode.id === storedId);
      if (storedById) return normalizeForRoofAccess(storedById);
    }

    const storedName = localStorage.getItem("statusModeName");
    if (storedName) {
      const storedByName = statusModes.find((mode) => mode.name === storedName);
      if (storedByName) return normalizeForRoofAccess(storedByName);
    }
  }

  if (options?.fallbackId !== undefined && options.fallbackId !== null) {
    const fallbackById = statusModes.find(
      (mode) => mode.id === options.fallbackId,
    );
    if (fallbackById) return normalizeForRoofAccess(fallbackById);
  }
  if (options?.fallbackName) {
    const fallbackByName = statusModes.find(
      (mode) => mode.name === options.fallbackName,
    );
    if (fallbackByName) return normalizeForRoofAccess(fallbackByName);
  }

  return normalizeForRoofAccess(onlineMode);
};

const adjustHexColor = (hex: string, percent: number) => {
  const normalized = hex.replace("#", "");
  if (![3, 6].includes(normalized.length)) return hex;
  const full =
    normalized.length === 3
      ? normalized
          .split("")
          .map((c) => c + c)
          .join("")
      : normalized;

  const num = parseInt(full, 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  const adjust = (v: number) =>
    Math.min(255, Math.max(0, Math.round(v + (percent / 100) * 255)));
  const toHex = (v: number) => v.toString(16).padStart(2, "0");
  return `#${toHex(adjust(r))}${toHex(adjust(g))}${toHex(adjust(b))}`;
};

const generalSettingsItems: Array<{
  label: string;
  key: BooleanChatPreferenceKey;
}> = [
  { label: "Özel mesajları reddet", key: "rejectDirectMessages" },
  { label: "Gelen aramaları reddet", key: "rejectIncomingCalls" },
  {
    label: "Çevrimdışıyken mesaj yazılmasın",
    key: "blockDmWhenTargetOffline",
  },
  { label: "Oda davetlerini reddet", key: "rejectRoomInvites" },
  { label: "Profilime yorum yapılmasın", key: "blockProfileComments" },
  { label: "Arkadaşlık İsteklerini reddet", key: "rejectFriendRequests" },
];

const notificationSettingsItems: Array<{
  label: string;
  key: BooleanChatPreferenceKey;
}> = [
  { label: "Titreşim seslerini kapat", key: "muteVibrationSounds" },
  { label: "Özel mesaj uyarlarını gizle", key: "hideDirectMessageAlerts" },
  { label: "Arkadaşlık isteği sesini kapat", key: "muteFriendRequestSound" },
  { label: "Giriş ve çıkışları göster", key: "showJoinLeaveEvents" },
  { label: "Giriş efektlerini gösterme", key: "disableJoinEffects" },
  { label: "Atılan genelleri gizle", key: "hideGeneralMessages" },
  { label: '"Yazıyor..." iletilerini göster', key: "showTypingIndicators" },
  { label: "Arama zil sesini kapat", key: "muteCallRingtone" },
];

const historySettingsItems: Array<{
  label: string;
  key: BooleanChatPreferenceKey;
}> = [
  { label: "Oda yazışma geçmişi", key: "keepRoomChatHistory" },
  { label: "Özel yazışma geçmişi", key: "keepDirectChatHistory" },
];

const userGifOptions: Array<{ label: string; value: string }> = [
  { label: "Balon", value: "/usergifler/balon.gif" },
  { label: "Bayrak", value: "/usergifler/bayrak.gif.gif" },
  { label: "Gül", value: "/usergifler/gul.gif" },
  { label: "Kalpler", value: "/usergifler/kalpler.gif" },
  { label: "Kar", value: "/usergifler/kar.gif.gif" },
  { label: "Kelebek", value: "/usergifler/kelebek.gif" },
  { label: "Yangın", value: "/usergifler/yangın.gif" },
  { label: "Buz Çerçeve", value: "/usergifler/yılbasi.gif" },
];

const roomDesignFiles = [
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

export const SettingsModal = ({
  isOpen,
  onClose,
  socket,
  currentUserStarCount: currentUserStarCountProp = 0,
  canUseRoof: canUseRoofProp = false,
  canAccessAdminPanel = false,
  onOpenAdminPanel,
  onWhatsAppShare,
  onSafeExit,
}: SettingsModalProps) => {
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [statusModes, setStatusModes] = useState<StatusModeOption[]>([]);
  const [selectedStatusId, setSelectedStatusId] = useState<number | null>(null);
  const [selectedRoomDesign, setSelectedRoomDesign] = useState<string | null>(
    null,
  );
  const [selectedFontSize, setSelectedFontSize] = useState<string>("16px");
  const [selectedFontColor, setSelectedFontColor] = useState<string | null>(
    null,
  );
  const [selectedFontBaseColor, setSelectedFontBaseColor] = useState<
    string | null
  >(null);
  const [fontTonePercent, setFontTonePercent] = useState<number>(0);
  const [selectedFrame, setSelectedFrame] = useState<string | null>(null);
  const [showFrameModal, setShowFrameModal] = useState(false);
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null);
  const [selectedFlashNick, setSelectedFlashNick] = useState<string | null>(
    null,
  );
  const [showFlashNickModal, setShowFlashNickModal] = useState(false);
  const [pendingFlashNickPreview, setPendingFlashNickPreview] = useState<string | null>(null);
  const [pendingFlashNickFile, setPendingFlashNickFile] = useState<File | null>(null);
  const [isUploadingFlashNick, setIsUploadingFlashNick] = useState(false);
  const [isDeletingFlashNick, setIsDeletingFlashNick] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [newUsername, setNewUsername] = useState("");
  const [isChangingUsername, setIsChangingUsername] = useState(false);
  const [usernameMessage, setUsernameMessage] = useState<string | null>(null);
  const [isFreezingAccount, setIsFreezingAccount] = useState(false);
  const [freezeMessage, setFreezeMessage] = useState<string | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showJoinEffectModal, setShowJoinEffectModal] = useState(false);
  const [selectedJoinEffect, setSelectedJoinEffect] =
    useState<JoinEffectId | null>(null);
  const [joinEffectDraft, setJoinEffectDraft] = useState<JoinEffectId | null>(
    null,
  );
  const [isSavingJoinEffect, setIsSavingJoinEffect] = useState(false);
  const [isJoinEffectAuthorized, setIsJoinEffectAuthorized] = useState(false);
  const [isFlashNickAuthorized, setIsFlashNickAuthorized] = useState(false);
  const [selectedFont, setSelectedFont] = useState<string>("");
  const [selectedGranit, setSelectedGranit] = useState<string>("");
  const [selectedNickColor, setSelectedNickColor] = useState<string | null>(
    null,
  );
  const [selectedUserGif, setSelectedUserGif] = useState<string | null>(null);
  const [activeProfileTab, setActiveProfileTab] = useState<
    "profilim" | "sifre" | "rumuz" | "ikonlar" | "ek" | "dondur"
  >("profilim");
  const [activeMobileSettingsSection, setActiveMobileSettingsSection] =
    useState<MobileSettingsSection>("home");
  const [selectedSiteTheme, setSelectedSiteTheme] =
    useState<SiteTheme>("default");
  const [profilePos, setProfilePos] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [settingsPos, setSettingsPos] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [isDraggingProfile, setIsDraggingProfile] = useState(false);
  const [isDraggingSettings, setIsDraggingSettings] = useState(false);
  const [tempFont, setTempFont] = useState<string>("");
  const [tempGranite, setTempGranite] = useState<string>("");
  const [tempNickColor, setTempNickColor] = useState<string | null>(null);
  const [tempUserGif, setTempUserGif] = useState<string | null>(null);
  const [showNickColorPicker, setShowNickColorPicker] = useState(false);
  const [showFontPicker, setShowFontPicker] = useState(false);
  const [showGranitePicker, setShowGranitePicker] = useState(false);
  const [isSavingExtra, setIsSavingExtra] = useState(false);
  const [isNarrowProfileViewport, setIsNarrowProfileViewport] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const settingsDragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const apiClientRef = useRef(getClientApiClient());
  const profileIconInputRef = useRef<HTMLInputElement | null>(null);
  const flashNickInputRef = useRef<HTMLInputElement | null>(null);
  const fontPickerRef = useRef<HTMLDivElement | null>(null);
  const granitePickerRef = useRef<HTMLDivElement | null>(null);
  const [roleName, setRoleName] = useState<string>("");
  const [roleIcon, setRoleIcon] = useState<string | null>(null);
  const [currentUserStarCount, setCurrentUserStarCount] = useState<number>(0);
  const canUseRoof = Boolean(canUseRoofProp);

  useEffect(() => {
    if (!isOpen) {
      setShowProfileModal(false);
      setActiveMobileSettingsSection("home");
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedSiteTheme(readStoredSiteTheme());
  }, [isOpen]);
  const [chatPreferences, setChatPreferences] = useState<ChatPreferences>(
    defaultChatPreferences,
  );
  const [savingChatPreferences, setSavingChatPreferences] = useState<
    Record<BooleanChatPreferenceKey, boolean>
  >({
    rejectDirectMessages: false,
    rejectIncomingCalls: false,
    blockDmWhenTargetOffline: false,
    rejectRoomInvites: false,
    blockProfileComments: false,
    rejectFriendRequests: false,
    muteVibrationSounds: false,
    hideDirectMessageAlerts: false,
    muteFriendRequestSound: false,
    showJoinLeaveEvents: false,
    disableJoinEffects: false,
    hideGeneralMessages: false,
    showTypingIndicators: false,
    muteCallRingtone: false,
    keepRoomChatHistory: false,
    keepDirectChatHistory: false,
  });
  const defaultFontColor = "#18181b";
  const fontColorShades = useMemo(() => {
    if (!selectedFontBaseColor) return [];
    const steps = [-30, -15, 0, 15, 30];
    return steps.map((step) => adjustHexColor(selectedFontBaseColor, step));
  }, [selectedFontBaseColor]);
  const fontToneShade = useMemo(() => {
    if (!selectedFontBaseColor) return null;
    return adjustHexColor(selectedFontBaseColor, fontTonePercent);
  }, [selectedFontBaseColor, fontTonePercent]);
  const { username, isGuest } = useMemo(() => {
    if (typeof window === "undefined" || !isOpen) {
      return { username: "Misafir", isGuest: true };
    }

    const guestMode = localStorage.getItem("isGuest") === "true";
    const guestName = localStorage.getItem("guestUsername");
    const memberName = localStorage.getItem("username");

    if (guestMode) {
      return { username: guestName || "Misafir", isGuest: true };
    }

    if (memberName) {
      return { username: memberName, isGuest: false };
    }

    return { username: "Misafir", isGuest: true };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || isGuest) return;
    setCurrentUserStarCount(currentUserStarCountProp);
  }, [currentUserStarCountProp, isGuest, isOpen]);

  const profileInitials = useMemo(
    () => (username ? username.substring(0, 2).toUpperCase() : "KM"),
    [username],
  );
  const resolvedProfileIcon = useMemo(() => {
    return resolveProfileIconSource(selectedIcon);
  }, [selectedIcon]);

  useEffect(() => {
    if (!isOpen) return;

    const fetchStatusModes = async () => {
      try {
        const res = await apiClientRef.current.get("/status-modes");
        const apiStatusModes = res?.data ?? [];

        // "Çatıda" modunu API'den gelen modlara ekle (eğer yoksa)
        const hasRoofMode = apiStatusModes.some(
          (mode: StatusModeOption) => mode.name === "Çatıda",
        );
        let statusModesWithRoof = hasRoofMode
          ? apiStatusModes
          : [{ id: 999, name: "Çatıda" }, ...apiStatusModes];

        // Misafirler için "Çatıda" modunu listeden çıkar
        if (isGuest) {
          statusModesWithRoof = statusModesWithRoof.filter(
            (mode: StatusModeOption) => mode.name !== "Çatıda",
          );
        }

        setStatusModes(statusModesWithRoof);
      } catch (error) {
        if (isTimeoutError(error)) {
          console.warn("Durum modları zaman aşımına uğradı", error);
        } else {
          console.error("Durum modları alınamadı", error);
        }
        // Fallback olarak en azından Çevrimiçi'yi göster
        const fallback = [{ id: 1, name: "Çevrimiçi" }];
        if (!isGuest) {
          fallback.unshift({ id: 999, name: "Çatıda" });
        }
        setStatusModes(fallback);
      }
    };

    fetchStatusModes();
  }, [isGuest, isOpen]);

  useEffect(() => {
    if (!isOpen || isGuest) return;

    const fetchCurrentStatus = async () => {
      try {
        const res = await apiClientRef.current.get("/auth/me", {
          params: { _ts: Date.now() },
        });
        const currentStatusId = res?.data?.statusMode?.id;
        const currentStatusName = res?.data?.statusMode?.name;
        const currentRoleName = res?.data?.role?.name;
        const currentRoleIcon = res?.data?.role?.icon;
        const currentRoleStarCount = Number(res?.data?.role?.starCount ?? 0);
        setCurrentUserStarCount(currentRoleStarCount);
        const canUseRoofFromPermissions =
          currentRoleStarCount >= 1 &&
          hasEffectivePermission({
            permissionLabel: PERMISSION_LABELS.ROOF_ACCESS,
            userPermissions: (res?.data?.permissions as string[] | undefined) ?? [],
            rolePermissions:
              (res?.data?.role?.permissions as Record<string, unknown> | null) ??
              null,
          });
        const canSelectJoinEffectFromPermissions = hasEffectivePermission({
          permissionLabel: PERMISSION_LABELS.JOIN_EFFECT_SELECT,
          userPermissions: (res?.data?.permissions as string[] | undefined) ?? [],
          rolePermissions:
            (res?.data?.role?.permissions as Record<string, unknown> | null) ??
            null,
        });
        const canUseFlashNickFromPermissions = hasEffectivePermission({
          permissionLabel: PERMISSION_LABELS.FLASH_NICK_UPLOAD,
          userPermissions: (res?.data?.permissions as string[] | undefined) ?? [],
          rolePermissions:
            (res?.data?.role?.permissions as Record<string, unknown> | null) ??
            null,
        });
        const currentFontName = res?.data?.fontName;
        const currentGranite = res?.data?.granite;
        const currentNickColor = res?.data?.nickColor;
        const currentUserGif = res?.data?.userGif;
        const currentFlashNick = res?.data?.flashNick;
        const currentIcon = resolveProfileIconSource(res?.data?.icon ?? null);
        const currentFrame = resolveProfileFrameSource(res?.data?.frame ?? null);
        const currentJoinEffect = res?.data?.joinEffect;
        const currentChatPreferences = mergeChatPreferences(
          res?.data?.chatPreferences,
        );

        const resolvedStatusMode = resolveMemberStatusMode(statusModes, {
          fallbackId: currentStatusId ?? null,
          fallbackName: currentStatusName ?? null,
          allowRoof: canUseRoofFromPermissions,
        });
        if (resolvedStatusMode) {
          setSelectedStatusId(resolvedStatusMode.id);
          localStorage.setItem("statusModeId", String(resolvedStatusMode.id));
          localStorage.setItem("statusModeName", resolvedStatusMode.name);
          localStorage.setItem(
            "roofStatus",
            resolvedStatusMode.name === "Çatıda" ? "true" : "false",
          );
        }

        if (currentRoleName) {
          setRoleName(formatRoleLabel(currentRoleName));
        } else {
          setRoleName("Üye");
        }
        if (currentRoleIcon) {
          setRoleIcon(currentRoleIcon);
        }
        setIsJoinEffectAuthorized(canSelectJoinEffectFromPermissions);
        setIsFlashNickAuthorized(canUseFlashNickFromPermissions);

        // Font ve granite ayarlarını yükle
        if (currentFontName) {
          setSelectedFont(currentFontName);
        }
        if (currentGranite) {
          setSelectedGranit(currentGranite);
        }
        setSelectedNickColor(currentNickColor || null);
        setSelectedUserGif(currentUserGif || null);
        setSelectedFlashNick(currentFlashNick || null);
        setSelectedIcon(currentIcon || null);
        setSelectedFrame(currentFrame || null);

        // Temp state'leri de başlat (broadcast sırasında null gitmemesi için)
        setTempFont(currentFontName || "");
        setTempGranite(currentGranite || "");
        setTempNickColor(currentNickColor || null);
        setTempUserGif(currentUserGif || null);
        if (isJoinEffectId(currentJoinEffect)) {
          const normalized = currentJoinEffect as JoinEffectId;
          setSelectedJoinEffect(normalized);
          localStorage.setItem("profileJoinEffect", normalized);
        } else {
          setSelectedJoinEffect(null);
          localStorage.removeItem("profileJoinEffect");
        }

        setChatPreferences(currentChatPreferences);
        writeChatPreferencesToStorage(currentChatPreferences);

        if (typeof window !== "undefined") {
          if (currentIcon) {
            localStorage.setItem("profileIcon", currentIcon);
            if (res?.data?.username) {
              localStorage.setItem("profileIconOwner", res.data.username);
            }
          } else {
            localStorage.removeItem("profileIcon");
            localStorage.removeItem("profileIconOwner");
          }

          if (currentFrame) {
            localStorage.setItem("profileFrame", currentFrame);
          } else {
            localStorage.removeItem("profileFrame");
          }
        }
      } catch (error) {
        if (isTimeoutError(error)) {
          console.warn("Me endpoint zaman aşımına uğradı", error);
        } else {
          console.error("Me endpoint alınamadı", error);
        }
        setIsJoinEffectAuthorized(false);
        setIsFlashNickAuthorized(false);
      }
    };

    fetchCurrentStatus();
  }, [isGuest, isOpen, statusModes]);

  useEffect(() => {
    if (!isOpen || isGuest || statusModes.length === 0) return;

    const syncStatusSelection = (detail?: {
      statusModeId?: number | null;
      statusModeName?: string | null;
    }) => {
      const resolvedStatusMode = resolveMemberStatusMode(statusModes, {
        preferredId: detail?.statusModeId ?? null,
        preferredName: detail?.statusModeName ?? null,
        allowRoof: canUseRoof,
      });

      if (!resolvedStatusMode) return;

      setSelectedStatusId(resolvedStatusMode.id);
      localStorage.setItem("statusModeId", String(resolvedStatusMode.id));
      localStorage.setItem("statusModeName", resolvedStatusMode.name);
      localStorage.setItem(
        "roofStatus",
        resolvedStatusMode.name === "Çatıda" ? "true" : "false",
      );
    };

    syncStatusSelection();

    const handleStatusModeUpdated = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          statusModeId?: number | null;
          statusModeName?: string | null;
        }>
      ).detail;
      syncStatusSelection(detail);
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
  }, [canUseRoof, isGuest, isOpen, statusModes]);

  useEffect(() => {
    if (!isOpen || !isGuest || statusModes.length === 0) return;
    if (typeof window === "undefined") return;

    const expiresAt = localStorage.getItem("guestStatusModeExpiresAt");
    const expiresAtNum = expiresAt ? Number(expiresAt) : null;
    const isExpired =
      !expiresAtNum || Number.isNaN(expiresAtNum)
        ? true
        : Date.now() > expiresAtNum;

    if (isExpired) {
      localStorage.removeItem("guestStatusModeId");
      localStorage.removeItem("guestStatusModeName");
      localStorage.removeItem("guestStatusModeExpiresAt");
    }

    const storedIdRaw = localStorage.getItem("guestStatusModeId");
    const storedId = storedIdRaw ? Number(storedIdRaw) : null;
    const stored = storedId ? statusModes.find((m) => m.id === storedId) : null;

    if (stored && !isExpired) {
      setSelectedStatusId(stored.id);
      return;
    }

    // Misafirlerde varsayılan seçim görünmesin
    setSelectedStatusId(null);
  }, [isGuest, isOpen, statusModes]);

  useEffect(() => {
    if (!isOpen || isGuest) {
      setIsJoinEffectAuthorized(false);
      setIsFlashNickAuthorized(false);
    }
  }, [isGuest, isOpen]);

  useEffect(() => {
    if (!isOpen || typeof window === "undefined") return;
    const loadSettingsData = async () => {
      const saved = localStorage.getItem("chatBackground");
      setSelectedRoomDesign(saved ?? null);
      const savedFont = localStorage.getItem("chatFontSize");
      if (savedFont) {
        setSelectedFontSize(savedFont);
      }
      const savedColor = localStorage.getItem("chatFontColor");
      if (savedColor) {
        setSelectedFontColor(savedColor);
      }
      if (isGuest) {
        localStorage.removeItem("profileFrame");
        localStorage.removeItem("profileIcon");
        localStorage.removeItem("profileIconOwner");
        setSelectedFrame(null);
        setSelectedIcon(null);
      } else {
        const savedFrame = localStorage.getItem("profileFrame");
        if (savedFrame) {
          setSelectedFrame(savedFrame);
        }
        const savedIcon = resolveProfileIconSource(localStorage.getItem("profileIcon"));
        if (savedIcon) {
          setSelectedIcon(savedIcon);
        }
        try {
          const meRes = await apiClientRef.current.get("/auth/me", {
            params: { _ts: Date.now() },
          });
          const apiIcon = resolveProfileIconSource(meRes?.data?.icon ?? null);
          const apiFrame = resolveProfileFrameSource(meRes?.data?.frame ?? null);
          if (apiIcon) {
            setSelectedIcon(apiIcon);
            localStorage.setItem("profileIcon", apiIcon);
            if (meRes?.data?.username) {
              localStorage.setItem("profileIconOwner", meRes.data.username);
            }
          } else {
            setSelectedIcon(null);
            localStorage.removeItem("profileIcon");
            localStorage.removeItem("profileIconOwner");
          }

          if (apiFrame) {
            setSelectedFrame(apiFrame);
            localStorage.setItem("profileFrame", apiFrame);
          } else {
            setSelectedFrame(null);
            localStorage.removeItem("profileFrame");
          }
        } catch (error) {
          console.error("Profil görselleri /auth/me ile alınamadı", error);
        }
      }
      const savedJoinEffect = localStorage.getItem("profileJoinEffect");
      if (isJoinEffectId(savedJoinEffect)) {
        setSelectedJoinEffect(savedJoinEffect as JoinEffectId);
      }

      setChatPreferences(readChatPreferencesFromStorage());
    };

    loadSettingsData();
  }, [isGuest, isOpen]);

  useEffect(() => {
    if (!isOpen || typeof window === "undefined") return;

    const handleProfileIconChanged = (event: Event) => {
      const detail = (
        event as CustomEvent<{ path: string | null; key: string | null }>
      ).detail;
      setSelectedIcon(resolveProfileIconSource(detail?.path ?? null));
    };

    window.addEventListener(
      "profileIconChanged",
      handleProfileIconChanged as EventListener,
    );
    return () => {
      window.removeEventListener(
        "profileIconChanged",
        handleProfileIconChanged as EventListener,
      );
    };
  }, [isOpen]);

  useEffect(() => {
    if (!showProfileModal) return;
    setProfilePos({ x: 0, y: 0 });
    // Tab "ek" ise mevcut değerleri geçici state'e aktar
    if (activeProfileTab === "ek") {
      setTempFont(selectedFont);
      setTempGranite(selectedGranit);
      setTempNickColor(selectedNickColor);
      setTempUserGif(selectedUserGif);
      setShowNickColorPicker(false);
      setShowFontPicker(false);
      setShowGranitePicker(false);
    }
  }, [
    showProfileModal,
    activeProfileTab,
    selectedFont,
    selectedGranit,
    selectedNickColor,
    selectedUserGif,
  ]);

  useEffect(() => {
    if (!showFontPicker) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!fontPickerRef.current) return;
      if (!fontPickerRef.current.contains(event.target as Node)) {
        setShowFontPicker(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowFontPicker(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [showFontPicker]);

  useEffect(() => {
    if (!showGranitePicker) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!granitePickerRef.current) return;
      if (!granitePickerRef.current.contains(event.target as Node)) {
        setShowGranitePicker(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowGranitePicker(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [showGranitePicker]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const syncViewport = () => setIsNarrowProfileViewport(mediaQuery.matches);

    syncViewport();
    mediaQuery.addEventListener("change", syncViewport);

    return () => {
      mediaQuery.removeEventListener("change", syncViewport);
    };
  }, []);

  const handleSaveExtraFeatures = async () => {
    setIsSavingExtra(true);
    try {
      const fontName = tempFont || null;

      // API İstekleri
      await Promise.all([
        apiClientRef.current.patch("/user/font-name", {
          fontName,
        }),
        apiClientRef.current.patch("/user/granite", {
          granite: tempGranite || null,
        }),
        apiClientRef.current.patch("/user/nick-color", {
          nickColor: tempNickColor || null,
        }),
        apiClientRef.current.patch("/user/user-gif", {
          userGif: tempUserGif || null,
        }),
      ]);

      // Global state'leri güncelle
      setSelectedFont(tempFont);
      setSelectedGranit(tempGranite);
      setSelectedNickColor(tempNickColor);
      setSelectedUserGif(tempUserGif);

      // Chat sayfasına bildir (Socket emit için)
      window.dispatchEvent(
        new CustomEvent("userStyleUpdated", {
          detail: {
            fontName,
            granite: tempGranite || null,
            nickColor: tempNickColor || null,
            userGif: tempUserGif || null,
          },
        }),
      );

      // Socket'e anında gönder - diğer kullanıcıların görmesi için
      if (socket && socket.connected) {
        // useMemo'dan gelen username değerini kullan
        if (username) {
          // Hem userStyleUpdate hem de style:update gönderiyoruz (geriye dönük uyumluluk için)
          const stylePayload = {
            room: "global", // Global update için
            username,
            fontName,
            granite: tempGranite || null,
            nickColor: tempNickColor || null,
            userGif: tempUserGif || null,
            flashNick: selectedFlashNick,
          };

          socket.emit("userStyleUpdate", stylePayload);
          socket.emit("style:update", stylePayload);
        }
      }

      // Başarılı uyarısı ve kapatma
      setShowProfileModal(false);
    } catch (error) {
      console.error("Profil ek özellikleri kaydedilemedi:", error);
      alert("Ayarlar kaydedilirken bir hata oluştu.");
    } finally {
      setIsSavingExtra(false);
    }
  };

  useEffect(() => {
    if (!isDraggingProfile) return;

    const handleMove = (e: MouseEvent) => {
      setProfilePos((prev) => ({
        x: prev.x + e.movementX,
        y: prev.y + e.movementY,
      }));
    };
    const handleUp = () => setIsDraggingProfile(false);

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [isDraggingProfile]);

  useEffect(() => {
    if (!isDraggingSettings) return;

    const handleMove = (e: MouseEvent) => {
      const dx = e.clientX - settingsDragStartRef.current.x;
      const dy = e.clientY - settingsDragStartRef.current.y;
      settingsDragStartRef.current = { x: e.clientX, y: e.clientY };
      setSettingsPos((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
    };
    const handleUp = () => setIsDraggingSettings(false);

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [isDraggingSettings]);

  useEffect(() => {
    if (!isOpen) return;
    setSettingsPos({ x: 0, y: 0 });
    setIsDraggingSettings(false);
  }, [isOpen]);

  const handleStatusChange = async (statusModeId: number) => {
    const selected = statusModes.find((m) => m.id === statusModeId);
    if (
      !isGuest &&
      selected?.name === "Çatıda" &&
      !canUseRoof
    ) {
      localStorage.setItem("roofStatus", "false");
      toast.error("Çatıya geçmek için yetkiniz yok.");
      return;
    }
    setSelectedStatusId(statusModeId);
    if (selected?.name) {
      if (isGuest) {
        const expiresAt = Date.now() + 60 * 60 * 1000;
        localStorage.setItem("guestStatusModeId", String(statusModeId));
        localStorage.setItem("guestStatusModeName", selected.name);
        localStorage.setItem("guestStatusModeExpiresAt", String(expiresAt));
      } else {
        localStorage.setItem("statusModeId", String(statusModeId));
        localStorage.setItem("statusModeName", selected.name);
      }

      // "Çatıda" seçildiğinde roofStatus'ı da güncelle
      if (!isGuest && selected.name === "Çatıda") {
        localStorage.setItem("roofStatus", "true");
      } else if (!isGuest) {
        localStorage.setItem("roofStatus", "false");

        // Çatıdan inildiğinde veya normal mod seçildiğinde bu modu hatırla
        localStorage.setItem("priorStatusModeId", String(statusModeId));
        localStorage.setItem("priorStatusModeName", selected.name);
      }
    }
    // Sadece socket üzerinden gönderilecek (page.tsx'de dinleniyor)
    window.dispatchEvent(
      new CustomEvent("statusModeUpdated", {
        detail: {
          statusModeId,
          statusModeName: selected?.name ?? null,
        },
      }),
    );

    if (!isGuest) {
      try {
        await apiClientRef.current.patch("/user/status-mode", {
          statusModeId,
        });
      } catch (error) {
        console.error("Status mode API update failed:", error);
      }
    }
  };

  const handleChatPreferenceToggle = async (
    key: BooleanChatPreferenceKey,
    checked: boolean,
  ) => {
    const previousValue = chatPreferences[key];
    setChatPreferences((prev) => {
      const nextPreferences = {
        ...prev,
        [key]: checked,
      };
      writeChatPreferencesToStorage(nextPreferences);
      return nextPreferences;
    });

    if (isGuest) return;

    setSavingChatPreferences((prev) => ({ ...prev, [key]: true }));
    try {
      const response = await apiClientRef.current.patch(
        "/user/chat-preferences",
        {
          [key]: checked,
        },
      );
      const savedValue = response?.data?.chatPreferences?.[key];
      setChatPreferences((prev) => {
        const savedPreferences = mergeChatPreferences({
          ...prev,
          [key]: typeof savedValue === "boolean" ? savedValue : checked,
        });
        writeChatPreferencesToStorage(savedPreferences);
        return savedPreferences;
      });

      if (
        (key === "rejectIncomingCalls" || key === "rejectRoomInvites") &&
        socket &&
        socket.connected &&
        username
      ) {
        socket.emit("chatPreferences:update", {
          username,
          ...(key === "rejectIncomingCalls"
            ? { rejectIncomingCalls: checked }
            : {}),
          ...(key === "rejectRoomInvites"
            ? { rejectRoomInvites: checked }
            : {}),
        });
      }
    } catch (error) {
      console.error("Sohbet tercihleri kaydedilemedi", error);
      setChatPreferences((prev) => {
        const rollbackPreferences = {
          ...prev,
          [key]: previousValue,
        };
        writeChatPreferencesToStorage(rollbackPreferences);
        return rollbackPreferences;
      });
      toast.error("Ayar kaydedilemedi. Lütfen tekrar deneyin.");
    } finally {
      setSavingChatPreferences((prev) => ({ ...prev, [key]: false }));
    }
  };

  const framePathToKey = (path: string) => {
    const file = path.split("/").pop() || "";
    return file.replace(/\.[^/.]+$/, "");
  };

  const iconPathToKey = (path: string) => {
    const file = path.split("/").pop() || "";
    return file.replace(/\.[^/.]+$/, "");
  };

  const handleSelectIcon = (iconPath: string) => {
    if (isGuest) return;

    const liveIconPath = withImageVersion(iconPath);
    setSelectedIcon(liveIconPath);
    const iconKey = iconPathToKey(iconPath);
    if (typeof window !== "undefined") {
      localStorage.setItem("profileIcon", iconPath);
      if (username) {
        localStorage.setItem("profileIconOwner", username);
      }
      window.dispatchEvent(
        new CustomEvent("profileIconChanged", {
          detail: { path: liveIconPath, key: iconKey },
        }),
      );
    }

    apiClientRef.current
      .patch("/user/icon", { icon: iconKey })
      .catch((err) => console.error("İkon kaydedilemedi", err));
  };

  const handleUploadProfileIcon = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (isGuest) {
      event.target.value = "";
      return;
    }

    const file = event.target.files?.[0];
    if (!file) return;
    const isPngOrJpg =
      file.type === "image/png" ||
      file.type === "image/jpeg" ||
      file.type === "image/jpg";
    if (!isPngOrJpg) {
      alert("Sadece PNG veya JPG dosyaları yükleyebilirsiniz.");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      alert("Dosya boyutu 25MB'dan büyük olamaz.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : null;
      if (!dataUrl) return;
      const resolvedDataUrl = withImageVersion(resolveProfileIconSource(dataUrl));
      setSelectedIcon(resolvedDataUrl);
      if (typeof window !== "undefined") {
        if (resolvedDataUrl) {
          localStorage.setItem("profileIcon", resolvedDataUrl);
        }
        if (username) {
          localStorage.setItem("profileIconOwner", username);
        }
        window.dispatchEvent(
          new CustomEvent("profileIconChanged", {
            detail: { path: resolvedDataUrl, key: dataUrl },
          }),
        );
      }
      try {
        await apiClientRef.current.patch("/user/icon", { icon: dataUrl });
      } catch (err) {
        console.error("İkon yükleme başarısız", err);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFlashNickFileSelect = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (isGuest || !isFlashNickAuthorized) {
      toast.error("Flash nick yükleme yetkiniz yok.");
      event.target.value = "";
      return;
    }
    const file = event.target.files?.[0];
    if (!file) return;

    const isSupportedFlashNickType =
      file.type === "image/png" ||
      file.type === "image/jpeg" ||
      file.type === "image/jpg" ||
      file.type === "image/gif";

    if (!isSupportedFlashNickType) {
      toast.error("Flash nick için sadece PNG, JPG veya GIF dosyaları yükleyebilirsiniz.");
      event.target.value = "";
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      toast.error("Flash nick dosya boyutu 25MB'dan büyük olamaz.");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : null;
      if (!dataUrl) return;
      setPendingFlashNickPreview(dataUrl);
      setPendingFlashNickFile(file);
      setShowFlashNickModal(true);
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const handleConfirmUploadFlashNick = async () => {
    if (!pendingFlashNickPreview) return;
    const nextFlashNick = pendingFlashNickPreview;
    const previousFlashNick = selectedFlashNick;
    try {
      setIsUploadingFlashNick(true);
      setSelectedFlashNick(nextFlashNick);
      window.dispatchEvent(
        new CustomEvent("userStyleUpdated", {
          detail: {
            flashNick: nextFlashNick,
          },
        }),
      );

      await apiClientRef.current.patch("/user/flash-nick", {
        flashNick: nextFlashNick,
      });
      toast.success("Flash nick güncellendi.");

      setShowFlashNickModal(false);
      setPendingFlashNickPreview(null);
      setPendingFlashNickFile(null);
    } catch (error) {
      setSelectedFlashNick(previousFlashNick);
      window.dispatchEvent(
        new CustomEvent("userStyleUpdated", {
          detail: {
            flashNick: previousFlashNick,
          },
        }),
      );
      console.error("Flash nick yükleme başarısız", error);
      toast.error("Flash nick yüklenemedi. Lütfen tekrar deneyin.");
    } finally {
      setIsUploadingFlashNick(false);
    }
  };

  const handleUploadFlashNick = handleConfirmUploadFlashNick;

  const handleRemoveFlashNick = async () => {
    if (isGuest || !isFlashNickAuthorized) {
      toast.error("Flash nick yükleme yetkiniz yok.");
      return;
    }
    if (!selectedFlashNick) return;

    const previousFlashNick = selectedFlashNick;
    try {
      setIsDeletingFlashNick(true);
      setSelectedFlashNick(null);
      window.dispatchEvent(
        new CustomEvent("userStyleUpdated", {
          detail: {
            flashNick: null,
          },
        }),
      );

      await apiClientRef.current.patch("/user/flash-nick", {
        flashNick: null,
      });

      toast.success("Flash nick kaldırıldı.");

      setShowFlashNickModal(false);
    } catch (error) {
      setSelectedFlashNick(previousFlashNick);
      window.dispatchEvent(
        new CustomEvent("userStyleUpdated", {
          detail: {
            flashNick: previousFlashNick,
          },
        }),
      );
      console.error("Flash nick kaldırma başarısız", error);
      toast.error("Flash nick kaldırılamadı. Lütfen tekrar deneyin.");
    } finally {
      setIsDeletingFlashNick(false);
    }
  };

  const handleRemoveIcon = () => {
    if (isGuest) return;

    setSelectedIcon(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("profileIcon");
      localStorage.removeItem("profileIconOwner");
      window.dispatchEvent(
        new CustomEvent("profileIconChanged", {
          detail: { path: null, key: null },
        }),
      );
    }

    apiClientRef.current
      .patch("/user/icon", { icon: null })
      .catch((err) => console.error("İkon kaldırma başarısız", err));
  };

  const handleSelectFrame = async (framePath: string) => {
    if (isGuest) return;

    setSelectedFrame(framePath);
    const frameKey = framePathToKey(framePath);
    if (typeof window !== "undefined") {
      localStorage.setItem("profileFrame", framePath);
      window.dispatchEvent(
        new CustomEvent("profileFrameChanged", {
          detail: { path: framePath, key: frameKey },
        }),
      );
    }
    try {
      await apiClientRef.current.patch("/user/frame", { frame: frameKey });
    } catch (error) {
      console.error("Çerçeve kaydedilemedi", error);
    }
  };

  const handleRemoveFrame = async () => {
    if (isGuest) return;

    setSelectedFrame(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("profileFrame");
      window.dispatchEvent(
        new CustomEvent("profileFrameChanged", {
          detail: { path: null, key: null },
        }),
      );
    }
    try {
      await apiClientRef.current.patch("/user/frame", { frame: null });
    } catch (error) {
      console.error("Çerçeve kaldırma başarısız", error);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) return;
    setIsChangingPassword(true);
    setPasswordMessage(null);
    try {
      await apiClientRef.current.patch("/auth/change-password", {
        currentPassword,
        newPassword,
      });
      setPasswordMessage("Şifre güncellendi.");
      setCurrentPassword("");
      setNewPassword("");
    } catch (error) {
      console.error("Şifre değiştirilemedi", error);
      setPasswordMessage("Şifre değiştirilemedi. Bilgileri kontrol edin.");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleChangeUsername = async () => {
    if (!newUsername) return;
    setIsChangingUsername(true);
    setUsernameMessage(null);
    try {
      await apiClientRef.current.patch("/user/username", {
        username: newUsername,
      });
      setUsernameMessage("Rumuz güncellendi lütfen tekrar giriş yapınız.");
      setNewUsername("");
      if (typeof window !== "undefined") {
        localStorage.setItem("username", newUsername);
      }
    } catch (error: unknown) {
      console.error("Rumuz değiştirilemedi", error);
      type ApiError = {
        response?: { status?: number; data?: { message?: string } };
        message?: string;
      };
      const errObj: ApiError | null =
        typeof error === "object" && error !== null
          ? (error as ApiError)
          : null;
      const status = errObj?.response?.status;
      const apiMsg = errObj?.response?.data?.message || errObj?.message || null;
      const duplicateMsg =
        typeof apiMsg === "string" &&
        apiMsg.toLowerCase().includes("username already exists");
      if (status === 409 || duplicateMsg) {
        setUsernameMessage("Rumuz zaten kullanılıyor.");
      } else {
        setUsernameMessage(
          apiMsg || "Rumuz değiştirilemedi. Bilgileri kontrol edin.",
        );
      }
    } finally {
      setIsChangingUsername(false);
    }
  };

  const handleFreezeAccount = async () => {
    if (isGuest || isFreezingAccount) return;

    setIsFreezingAccount(true);
    setFreezeMessage(null);
    try {
      await apiClientRef.current.patch("/user/freeze");
      setFreezeMessage("Hesabınız donduruldu. Giriş sayfasına yönlendiriliyorsunuz.");
      toast.success("Hesap donduruldu.");
      if (socket) {
        socket.disconnect();
      }
      clearClientAuthState();
      window.location.href = "/";
    } catch (error: unknown) {
      console.error("Hesap dondurulamadı", error);
      const message =
        error instanceof Error
          ? error.message
          : "Hesap dondurulamadı. Lütfen tekrar deneyin.";
      setFreezeMessage(message);
      toast.error(message);
    } finally {
      setIsFreezingAccount(false);
    }
  };

  const openJoinEffectModal = () => {
    if (isGuest || !isJoinEffectAuthorized) {
      toast.error("Giriş efekti seçme yetkiniz yok.");
      return;
    }
    setJoinEffectDraft(selectedJoinEffect);
    setShowJoinEffectModal(true);
  };

  const closeJoinEffectModal = () => {
    if (isSavingJoinEffect) return;
    setJoinEffectDraft(selectedJoinEffect);
    setShowJoinEffectModal(false);
  };

  const handleSelectJoinEffect = (effect: JoinEffectId) => {
    if (isGuest || !isJoinEffectAuthorized || isSavingJoinEffect) return;
    setJoinEffectDraft(effect);
  };

  const handleClearJoinEffect = () => {
    if (isGuest || !isJoinEffectAuthorized || isSavingJoinEffect) return;
    setJoinEffectDraft(null);
  };

  const handleConfirmJoinEffect = async () => {
    if (isSavingJoinEffect) return;
    if (isGuest || !isJoinEffectAuthorized) {
      toast.error("Giriş efekti seçme yetkiniz yok.");
      closeJoinEffectModal();
      return;
    }

    if (joinEffectDraft === selectedJoinEffect) {
      closeJoinEffectModal();
      return;
    }

    setIsSavingJoinEffect(true);
    try {
      await apiClientRef.current.patch("/user/join-effect", {
        joinEffect: joinEffectDraft,
      });
      setSelectedJoinEffect(joinEffectDraft);
      if (joinEffectDraft) {
        localStorage.setItem("profileJoinEffect", joinEffectDraft);
      } else {
        localStorage.removeItem("profileJoinEffect");
      }
      setShowJoinEffectModal(false);
      if (socket && socket.connected && username) {
        const socketResponse = await new Promise<{
          status?: "ok" | "error";
          message?: string;
        }>((resolve) => {
          socket.emit(
            "joinEffect:update",
            {
              room: "global",
              username,
              joinEffect: joinEffectDraft,
            },
            (ack: { status?: "ok" | "error"; message?: string }) =>
              resolve(ack || {}),
          );
        });
        if (
          socketResponse.status === "error" &&
          socketResponse.message === "join_effect_permission_required"
        ) {
          throw new Error("Giriş efekti seçme yetkiniz yok.");
        }
      }
      toast.success(
        joinEffectDraft
          ? "Giriş efekti güncellendi."
          : "Giriş efekti kaldırıldı.",
      );
      setJoinEffectDraft(joinEffectDraft);
    } catch (error) {
      console.error("Giriş efekti kaydedilemedi", error);
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Giriş efekti kaydedilemedi.";
      toast.error(message);
    } finally {
      setIsSavingJoinEffect(false);
    }
  };

  const openProfileTab = (
    tab: "profilim" | "sifre" | "rumuz" | "ikonlar" | "ek" | "dondur",
  ) => {
    setActiveProfileTab(tab);
    setShowProfileModal(true);
  };

  const handleSiteThemeChange = (theme: SiteTheme) => {
    setSelectedSiteTheme(theme);
    if (typeof window === "undefined") return;
    localStorage.setItem("chatSiteTheme", theme);
    window.dispatchEvent(
      new CustomEvent("chatSiteThemeChanged", { detail: theme }),
    );
  };

  const renderRoomDesignSection = () => (
    <div className="space-y-4">
      <h3 className="text-center text-lg font-black text-zinc-900">
        KİŞİSEL ODA DİZAYNLARI
      </h3>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {roomDesignFiles.map((file) => {
          const path = `/images/${file}`;
          const isActive = selectedRoomDesign === path;
          const isPexelsImage = file.startsWith("pexels-");
          const isCustomPhoto =
            file === "456712280_17999227514656648_949295733479667370_n.jpg";
          const shouldUseInsetPreview = isPexelsImage || isCustomPhoto;
          const imagePosition = isCustomPhoto ? "center 42%" : "center";
          return (
            <button
              key={file}
              type="button"
              onClick={() => {
                setSelectedRoomDesign(path);
                if (typeof window !== "undefined") {
                  localStorage.setItem("chatBackground", path);
                  window.dispatchEvent(
                    new CustomEvent("chatBackgroundChanged", { detail: path }),
                  );
                }
              }}
              className={`relative h-24 overflow-hidden rounded-xl border transition ${
                isActive
                  ? "border-blue-500 ring-2 ring-blue-200"
                  : "border-zinc-200"
              }`}
              style={
                shouldUseInsetPreview
                  ? {
                      backgroundImage: `url('/images/${file}')`,
                      backgroundPosition: imagePosition,
                      backgroundSize: "cover",
                    }
                  : undefined
              }
            >
              {shouldUseInsetPreview ? (
                <span
                  className="absolute inset-0 scale-110 bg-cover bg-center bg-no-repeat opacity-70 blur-sm"
                  style={{
                    backgroundImage: `url('/images/${file}')`,
                    backgroundPosition: imagePosition,
                  }}
                />
              ) : null}
              <Image
                src={`/images/${file}`}
                alt={file}
                fill
                sizes="140px"
                className={shouldUseInsetPreview ? "object-contain" : "object-cover"}
                style={{
                  objectPosition: imagePosition,
                  objectFit: isCustomPhoto ? "scale-down" : undefined,
                }}
              />
              {isActive && (
                <span className="absolute bottom-1.5 right-1.5 rounded bg-blue-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                  Seçili
                </span>
              )}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="w-full rounded-xl bg-zinc-800 px-4 py-3 text-sm font-semibold text-white active:bg-zinc-700"
        onClick={() => {
          setSelectedRoomDesign(null);
          if (typeof window !== "undefined") {
            localStorage.removeItem("chatBackground");
            window.dispatchEvent(
              new CustomEvent("chatBackgroundChanged", { detail: null }),
            );
          }
        }}
      >
        Özel Dizaynı Kaldır
      </button>
    </div>
  );

  const renderWritingSection = () => (
    <div className="space-y-6">
      <div className="space-y-3">
        <h3 className="text-center text-lg font-black text-zinc-900">
          YAZI BOYUTU
        </h3>
        <select
          className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-900"
          value={selectedFontSize}
          onChange={(e) => {
            const val = e.target.value;
            setSelectedFontSize(val);
            if (typeof window !== "undefined") {
              localStorage.setItem("chatFontSize", val);
              window.dispatchEvent(
                new CustomEvent("chatFontSizeChanged", { detail: val }),
              );
            }
          }}
        >
          <option value="14px">14px</option>
          <option value="16px">16px (Varsayılan)</option>
          <option value="18px">18px</option>
          <option value="20px">20px</option>
        </select>
      </div>

      <div className="space-y-3">
        <h3 className="text-center text-lg font-black text-zinc-900">
          YAZI RENGİ
        </h3>
        <label className="text-sm font-medium text-zinc-600">
          Renk seçici
        </label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            className="h-12 w-20 cursor-pointer rounded-lg border border-zinc-300 bg-white p-1"
            value={selectedFontBaseColor || selectedFontColor || defaultFontColor}
            onChange={(e) => {
              const color = e.target.value;
              setSelectedFontBaseColor(color);
              setFontTonePercent(0);
              setSelectedFontColor(color);
              if (typeof window !== "undefined") {
                localStorage.setItem("chatFontColor", color);
                window.dispatchEvent(
                  new CustomEvent("chatFontColorChanged", { detail: color }),
                );
              }
            }}
            aria-label="Yazı rengi seçici"
          />
          <span
            className="h-10 w-10 rounded-full border border-zinc-200"
            style={{
              backgroundColor:
                fontToneShade || selectedFontColor || defaultFontColor,
            }}
          />
        </div>

        {selectedFontBaseColor && (
          <div className="space-y-2">
            <div className="flex justify-between text-[11px] font-bold uppercase text-zinc-500">
              <span>Ton Ayarı</span>
              <span>{fontTonePercent}%</span>
            </div>
            <input
              type="range"
              min="-40"
              max="40"
              step="5"
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-zinc-200 accent-blue-500"
              value={fontTonePercent}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                setFontTonePercent(val);
                const shade = adjustHexColor(selectedFontBaseColor, val);
                setSelectedFontColor(shade);
                if (typeof window !== "undefined") {
                  localStorage.setItem("chatFontColor", shade);
                  window.dispatchEvent(
                    new CustomEvent("chatFontColorChanged", { detail: shade }),
                  );
                }
              }}
            />
            <div className="flex justify-between gap-1.5">
              {fontColorShades.map((shade, i) => (
                <button
                  key={shade}
                  type="button"
                  className={`h-8 flex-1 rounded-md border transition ${
                    selectedFontColor === shade
                      ? "scale-105 border-blue-500"
                      : "border-transparent"
                  }`}
                  style={{ backgroundColor: shade }}
                  onClick={() => {
                    const steps = [-30, -15, 0, 15, 30];
                    setFontTonePercent(steps[i]);
                    setSelectedFontColor(shade);
                    if (typeof window !== "undefined") {
                      localStorage.setItem("chatFontColor", shade);
                      window.dispatchEvent(
                        new CustomEvent("chatFontColorChanged", {
                          detail: shade,
                        }),
                      );
                    }
                  }}
                  aria-label={`Yazı rengi tonu ${i + 1}`}
                />
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          className="w-full rounded-xl border border-red-100 py-2.5 text-sm font-semibold text-red-500 transition-colors active:bg-red-50"
          onClick={() => {
            setSelectedFontColor(null);
            setSelectedFontBaseColor(null);
            setFontTonePercent(0);
            if (typeof window !== "undefined") {
              localStorage.removeItem("chatFontColor");
              window.dispatchEvent(
                new CustomEvent("chatFontColorChanged", { detail: null }),
              );
            }
          }}
        >
          Yazı rengini kaldır
        </button>
      </div>
    </div>
  );

  const renderCheckboxSection = (
    title: string,
    items: Array<{ label: string; key: BooleanChatPreferenceKey }>,
  ) => (
    <div className="space-y-4">
      <h3 className="text-center text-lg font-black text-zinc-900">{title}</h3>
      <div className="space-y-3">
        {items.map((item) => (
          <label
            key={item.key}
            className="flex min-h-12 items-center justify-between gap-4 rounded-xl border border-zinc-100 bg-white px-3 py-2 shadow-sm"
          >
            <span className="text-base text-zinc-700">{item.label}</span>
            <input
              type="checkbox"
              checked={chatPreferences[item.key]}
              onChange={(e) =>
                handleChatPreferenceToggle(item.key, e.target.checked)
              }
              disabled={savingChatPreferences[item.key]}
              className="h-7 w-7 rounded border-zinc-300 accent-blue-500"
            />
          </label>
        ))}
      </div>
    </div>
  );

  const renderThemeSection = () => (
    <div className="space-y-3">
      <h3 className="text-center text-base font-bold text-zinc-900">
        SİTE TEMASI
      </h3>
      <div className="grid grid-cols-1 gap-2">
        {siteThemeOptions.map((option) => {
          const isActive = selectedSiteTheme === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => handleSiteThemeChange(option.id)}
              className={`flex items-center gap-3 rounded-xl border bg-white p-2 text-left shadow-sm transition ${
                isActive
                  ? "border-blue-500 ring-2 ring-blue-100"
                  : "border-zinc-200"
              }`}
            >
              <span
                className={`h-9 w-12 shrink-0 rounded-lg border border-white shadow-inner ${option.previewClassName}`}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-zinc-900">
                  {option.label}
                </span>
                <span className="block text-xs text-zinc-500">
                  {isActive ? "Seçili tema" : "Temayı uygula"}
                </span>
              </span>
              {isActive && <Check className="h-4 w-4 text-blue-600" />}
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderMobileSectionContent = () => {
    if (activeMobileSettingsSection === "roomDesign") {
      return renderRoomDesignSection();
    }
    if (activeMobileSettingsSection === "writing") {
      return renderWritingSection();
    }
    if (activeMobileSettingsSection === "general") {
      return renderCheckboxSection("GENEL AYARLAR", generalSettingsItems);
    }
    if (activeMobileSettingsSection === "notifications") {
      return renderCheckboxSection(
        "BİLDİRİMLER VE UYARILAR",
        notificationSettingsItems,
      );
    }
    if (activeMobileSettingsSection === "history") {
      return renderCheckboxSection("YAZIŞMA GEÇMİŞLERİ", historySettingsItems);
    }
    if (activeMobileSettingsSection === "theme") {
      return renderThemeSection();
    }
    return null;
  };

  const profileTabOptions = [
    { id: "profilim", label: "Profilim" },
    { id: "sifre", label: "Şifre Değiştir" },
    { id: "rumuz", label: "Rumuz Değiştir" },
    { id: "ikonlar", label: "İkonlar" },
    { id: "ek", label: "Profil Ek Özellikler" },
    { id: "dondur", label: "Hesap Dondurma" },
  ] as const;
  const activeProfileTabLabel =
    profileTabOptions.find((item) => item.id === activeProfileTab)?.label ??
    "Üye Profili";

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50" onClick={onClose}>
        <div
          className={
            isNarrowProfileViewport
              ? "chat-theme-settings-mobile absolute inset-0 flex flex-col overflow-hidden bg-[#f4f7fb] shadow-2xl"
              : "absolute right-0 top-0 h-full w-80 overflow-y-auto bg-white shadow-2xl"
          }
          onClick={(e) => e.stopPropagation()}
          style={
            isNarrowProfileViewport
              ? undefined
              : {
                  transform: `translate(${settingsPos.x}px, ${settingsPos.y}px)`,
                }
          }
        >
          {isNarrowProfileViewport ? (
            <>
              <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-4 py-3">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-600 active:bg-zinc-100"
                  aria-label={
                    activeMobileSettingsSection === "home"
                      ? "Ayarları kapat"
                      : "Ayarlar ana ekranına dön"
                  }
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-7 w-7"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.4}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>
                <h2 className="text-center text-xl font-black text-zinc-900">
                  Kullanıcı Ayarları
                </h2>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-600 active:bg-zinc-100"
                  aria-label="Ayarları kapat"
                >
                  <X className="h-7 w-7" />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+112px)]" style={{ WebkitOverflowScrolling: 'touch' }}>
                {activeMobileSettingsSection === "home" ? (
                  <>
                    {isGuest && (
                      <div className="mb-4 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
                        <p className="mb-3 text-sm font-medium text-zinc-600">
                          Üye olmak basit ve ücretsizdir!
                        </p>
                        <button
                          type="button"
                          onClick={() => setShowRegisterModal(true)}
                          className="w-full rounded-xl bg-blue-500 px-4 py-3 font-bold text-white active:bg-blue-600"
                        >
                          Kayıtlı üye ol!
                        </button>
                      </div>
                    )}

                    <div className="mb-5 rounded-[24px] border border-zinc-100 bg-white p-4 shadow-sm">
                      <div className="flex items-center gap-4">
                        <div
                          className={`flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full text-2xl font-black text-white shadow-md ${
                            resolvedProfileIcon?.startsWith("data:")
                              ? "bg-white"
                              : "bg-blue-500"
                          }`}
                        >
                          {resolvedProfileIcon ? (
                            <img
                              src={resolvedProfileIcon}
                              alt="avatar"
                              className="h-full w-full object-cover bg-white"
                            />
                          ) : (
                            username?.[0]?.toUpperCase() || "S"
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-2xl font-black text-zinc-900">
                            {username}
                          </p>
                          <p className="truncate text-sm font-medium text-zinc-500">
                            {isGuest ? "Misafir" : roleIcon || formatRoleLabel(roleName)}
                          </p>
                          <label className="mt-3 block text-sm font-medium text-zinc-500">
                            Durum
                          </label>
                          <select
                            className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900"
                            value={selectedStatusId ?? ""}
                            onChange={(e) =>
                              handleStatusChange(Number(e.target.value))
                            }
                          >
                            <option value="" disabled>
                              Durum seçin
                            </option>
                            {statusModes
                              .filter(
                                (mode) =>
                                  isGuest ||
                                  mode.name !== "Çatıda" ||
                                  canUseRoof,
                              )
                              .map((mode) => (
                                <option key={mode.id} value={mode.id}>
                                  {mode.name}
                                </option>
                              ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    <p className="mb-3 px-1 text-sm font-semibold text-zinc-500">
                      Kişisel Ayarlarım
                    </p>
                    <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                      {(isGuest
                        ? [
                            {
                              label: "Sohbet yazı rengi ve boyutu",
                              icon: Type,
                              onClick: () =>
                                setActiveMobileSettingsSection("writing"),
                            },
                            {
                              label: "Diğer tüm ayarlar",
                              icon: SlidersHorizontal,
                              onClick: () =>
                                setActiveMobileSettingsSection("general"),
                            },
                            {
                              label: "Bildirimler ve uyarılar",
                              icon: Bell,
                              onClick: () =>
                                setActiveMobileSettingsSection("notifications"),
                            },
                            {
                              label: "Yazışma geçmişleri",
                              icon: History,
                              onClick: () =>
                                setActiveMobileSettingsSection("history"),
                            },
                            {
                              label: "Site Teması",
                              icon: Palette,
                              onClick: () =>
                                setActiveMobileSettingsSection("theme"),
                            },
                          ]
                        : [
                            {
                              label: "Profilim",
                              icon: UserCircle,
                              onClick: () => openProfileTab("profilim"),
                            },
                            ...(canAccessAdminPanel && onOpenAdminPanel
                              ? [
                                  {
                                    label: "Yönetim Paneli",
                                    icon: Shield,
                                    onClick: () => {
                                      onClose();
                                      onOpenAdminPanel();
                                    },
                                  },
                                ]
                              : []),
                            {
                              label: "Şifre Değiştir",
                              icon: KeyRound,
                              onClick: () => openProfileTab("sifre"),
                            },
                            {
                              label: "Rumuz Değiştir",
                              icon: Pencil,
                              onClick: () => openProfileTab("rumuz"),
                            },
                            {
                              label: "İkonlar",
                              icon: Sparkles,
                              onClick: () => openProfileTab("ikonlar"),
                            },
                            {
                              label: "Profil Ek Özellikler",
                              icon: Brush,
                              onClick: () => openProfileTab("ek"),
                            },
                            {
                              label: "Sohbet yazı rengi ve boyutu",
                              icon: Type,
                              onClick: () =>
                                setActiveMobileSettingsSection("writing"),
                            },
                            {
                              label: "Diğer tüm ayarlar",
                              icon: SlidersHorizontal,
                              onClick: () =>
                                setActiveMobileSettingsSection("general"),
                            },
                            {
                              label: "Bildirimler ve uyarılar",
                              icon: Bell,
                              onClick: () =>
                                setActiveMobileSettingsSection("notifications"),
                            },
                            {
                              label: "Yazışma geçmişleri",
                              icon: History,
                              onClick: () =>
                                setActiveMobileSettingsSection("history"),
                            },
                            {
                              label: "Site Teması",
                              icon: Palette,
                              onClick: () =>
                                setActiveMobileSettingsSection("theme"),
                            },
                          ] as Array<{
                        label: string;
                        icon: typeof UserCircle;
                        onClick: () => void;
                      }>).map((item) => {
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.label}
                            type="button"
                            onClick={item.onClick}
                            className="chat-theme-settings-card flex min-h-[102px] flex-col items-start justify-between rounded-xl border border-zinc-200 bg-white p-3.5 text-left shadow-sm transition active:scale-[0.99] active:bg-zinc-50 sm:min-h-[116px] sm:p-4"
                          >
                            <Icon className="chat-theme-settings-icon h-7 w-7 text-blue-500 sm:h-8 sm:w-8" />
                            <span className="line-clamp-2 text-[15px] font-semibold leading-tight text-zinc-900 sm:text-[17px]">
                              {item.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {(onWhatsAppShare || onSafeExit) && (
                      <div className="mt-5 space-y-3">
                        {onWhatsAppShare && (
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onWhatsAppShare();
                            }}
                            className="flex h-[58px] w-full items-center rounded-xl bg-white px-4 text-left shadow-sm active:bg-zinc-50"
                          >
                            <Share2 className="mr-4 h-7 w-7 shrink-0 text-zinc-500" />
                            <span className="min-w-0 flex-1 text-[18px] font-medium text-zinc-900">
                              WhatsApp ile paylaş
                            </span>
                            <svg
                              className="h-6 w-6 shrink-0 text-zinc-300"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2.4}
                                d="M9 5l7 7-7 7"
                              />
                            </svg>
                          </button>
                        )}

                        {onSafeExit && (
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onSafeExit();
                            }}
                            className="flex h-[58px] w-full items-center rounded-xl bg-white px-4 text-left shadow-sm active:bg-zinc-50"
                          >
                            <LogOut className="mr-4 h-7 w-7 shrink-0 text-zinc-500" />
                            <span className="min-w-0 flex-1 text-[18px] font-medium text-red-500">
                              Güvenli çıkış
                            </span>
                            <svg
                              className="h-6 w-6 shrink-0 text-zinc-300"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2.4}
                                d="M9 5l7 7-7 7"
                              />
                            </svg>
                          </button>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="rounded-[24px] border border-zinc-100 bg-white p-4 shadow-sm">
                    {renderMobileSectionContent()}
                    <button
                      type="button"
                      className="mt-5 w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm font-semibold text-zinc-700 active:bg-zinc-50"
                      onClick={() => setActiveMobileSettingsSection("home")}
                    >
                      Ayarlara Dön
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
          {/* Header */}
          <div
            className="flex items-center justify-between border-b border-zinc-200 p-4 cursor-move select-none"
            onMouseDown={(e) => {
              const target = e.target as HTMLElement;
              if (target.closest("button")) return;
              e.preventDefault();
              settingsDragStartRef.current = { x: e.clientX, y: e.clientY };
              setIsDraggingSettings(true);
            }}
          >
            <button
              onClick={onClose}
              className="text-zinc-600 hover:text-zinc-900"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <h2 className="text-lg font-semibold text-zinc-900">
              Kullanıcı Ayarları
            </h2>
            <button
              onClick={onClose}
              className="text-zinc-600 hover:text-zinc-900"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* User Info */}
          <div className="border-b border-zinc-200 bg-zinc-50 p-6 text-center">
            {isGuest && (
              <>
                <p className="mb-2 text-sm text-zinc-600">
                  Üye olmak basit ve ücretsizdir!
                </p>
                <button
                  onClick={() => setShowRegisterModal(true)}
                  className="mb-4 w-full rounded-lg bg-blue-500 px-4 py-2.5 font-semibold text-white hover:bg-blue-600"
                >
                  Kayıtlı üye ol!
                </button>
              </>
            )}
            <div className="flex items-center justify-center gap-3">
              <div
                className={`flex h-12 w-12 items-center justify-center overflow-hidden rounded-full text-white font-semibold ${
                  resolvedProfileIcon?.startsWith("data:")
                    ? "bg-white"
                    : "bg-blue-500"
                }`}
              >
                {resolvedProfileIcon ? (
                  <img
                    src={resolvedProfileIcon}
                    alt="avatar"
                    className="h-full w-full object-cover bg-white"
                  />
                ) : (
                  username?.[0]?.toUpperCase() || "S"
                )}
              </div>
              <div className="text-left">
                <p className="font-medium text-zinc-900">{username}</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-zinc-500">
                    {isGuest ? "Misafir" : roleIcon || formatRoleLabel(roleName)}
                  </p>
                  {!isGuest && (
                    <button
                      className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-600 hover:bg-blue-200"
                      onClick={() => setShowProfileModal(true)}
                    >
                      <AlignJustify className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {isGuest ? (
                  <div className="mt-1">
                    <label className="text-xs text-zinc-500">Durum</label>
                    <select
                      className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1 text-xs text-zinc-900"
                      value={selectedStatusId ?? ""}
                      onChange={(e) =>
                        handleStatusChange(Number(e.target.value))
                      }
                    >
                      <option value="" disabled>
                        Durum seçin
                      </option>
                      {statusModes.map((mode) => (
                        <option key={mode.id} value={mode.id}>
                          {mode.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="mt-1">
                    <label className="text-xs text-zinc-500">Durum</label>
                    <select
                      className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1 text-xs text-zinc-900"
                      value={selectedStatusId ?? ""}
                      onChange={(e) =>
                        handleStatusChange(Number(e.target.value))
                      }
                    >
                      <option value="" disabled>
                        Durum seçin
                      </option>
                      {statusModes
                        .filter(
                          (mode) =>
                            mode.name !== "Çatıda" || canUseRoof,
                        )
                        .map((mode) => (
                        <option key={mode.id} value={mode.id}>
                          {mode.name}
                        </option>
                        ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Personal Room Images */}
          <div className="border-b border-zinc-200 p-4">
            <h3 className="mb-3 text-center font-semibold text-zinc-900">
              KİŞİSEL ODA DİZAYNLARI
            </h3>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {[
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
              ].map((file) => {
                const path = `/images/${file}`;
                const isActive = selectedRoomDesign === path;
                const isPexelsImage = file.startsWith("pexels-");
                const isCustomPhoto =
                  file ===
                  "456712280_17999227514656648_949295733479667370_n.jpg";
                const shouldUseInsetPreview = isPexelsImage || isCustomPhoto;
                const imagePosition = isCustomPhoto ? "center 42%" : "center";
                return (
                  <button
                    key={file}
                    onClick={() => {
                      setSelectedRoomDesign(path);
                      if (typeof window !== "undefined") {
                        localStorage.setItem("chatBackground", path);
                        window.dispatchEvent(
                          new CustomEvent("chatBackgroundChanged", {
                            detail: path,
                          }),
                        );
                      }
                    }}
                    className={`relative h-20 overflow-hidden rounded-lg border transition ${
                      isActive
                        ? "border-blue-500 ring-2 ring-blue-200"
                        : "border-zinc-200"
                    }`}
                    style={
                      shouldUseInsetPreview
                        ? {
                            backgroundImage: `url('/images/${file}')`,
                            backgroundPosition: imagePosition,
                            backgroundSize: "cover",
                          }
                        : undefined
                    }
                  >
                    {shouldUseInsetPreview ? (
                      <span
                        className="absolute inset-0 bg-cover bg-center bg-no-repeat blur-sm scale-110 opacity-70"
                        style={{
                          backgroundImage: `url('/images/${file}')`,
                          backgroundPosition: imagePosition,
                        }}
                      />
                    ) : null}
                    <Image
                      src={`/images/${file}`}
                      alt={file}
                      fill
                      sizes="120px"
                      className={
                        shouldUseInsetPreview
                          ? "object-contain"
                          : "object-cover"
                      }
                      style={{
                        objectPosition: imagePosition,
                        objectFit: isCustomPhoto ? "scale-down" : undefined,
                      }}
                      priority={false}
                    />
                    {isActive && (
                      <span className="absolute bottom-1 right-1 rounded bg-blue-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                        Seçili
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <button
              className="w-full rounded-lg bg-zinc-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800"
              onClick={() => {
                setSelectedRoomDesign(null);
                if (typeof window !== "undefined") {
                  localStorage.removeItem("chatBackground");
                  window.dispatchEvent(
                    new CustomEvent("chatBackgroundChanged", {
                      detail: null,
                    }),
                  );
                }
              }}
            >
              Özel Dizaynı Kaldır
            </button>
          </div>

          {/* General Settings */}
          <div className="border-b border-zinc-200 p-4">
            <h3 className="mb-3 text-center font-semibold text-zinc-900">
              GENEL AYARLAR
            </h3>
            <div className="space-y-3">
              {generalSettingsItems.map((item) => (
                <label
                  key={item.key}
                  className="flex items-center justify-between"
                >
                  <span className="text-sm text-zinc-700">{item.label}</span>
                  <input
                    type="checkbox"
                    checked={chatPreferences[item.key]}
                    onChange={(e) =>
                      handleChatPreferenceToggle(item.key, e.target.checked)
                    }
                    disabled={savingChatPreferences[item.key]}
                    className="h-5 w-5 rounded border-zinc-300"
                  />
                </label>
              ))}
            </div>
          </div>

          {/* Notifications */}
          <div className="border-b border-zinc-200 p-4">
            <h3 className="mb-3 text-center font-semibold text-zinc-900">
              BİLDİRİMLER VE UYARILAR
            </h3>
            <div className="space-y-3">
              {notificationSettingsItems.map((item) => (
                <label
                  key={item.key}
                  className="flex items-center justify-between"
                >
                  <span className="text-sm text-zinc-700">{item.label}</span>
                  <input
                    type="checkbox"
                    checked={chatPreferences[item.key]}
                    onChange={(e) =>
                      handleChatPreferenceToggle(item.key, e.target.checked)
                    }
                    disabled={savingChatPreferences[item.key]}
                    className="h-5 w-5 rounded border-zinc-300"
                  />
                </label>
              ))}
            </div>
          </div>

          {/* Writing History */}
          <div className="border-b border-zinc-200 p-4">
            <h3 className="mb-3 text-center font-semibold text-zinc-900">
              YAZIŞMA GEÇMİŞLERİ
            </h3>
            <div className="space-y-3">
              {historySettingsItems.map((item) => (
                <label
                  key={item.key}
                  className="flex items-center justify-between"
                >
                  <span className="text-sm text-zinc-700">{item.label}</span>
                  <input
                    type="checkbox"
                    checked={chatPreferences[item.key]}
                    onChange={(e) =>
                      handleChatPreferenceToggle(item.key, e.target.checked)
                    }
                    disabled={savingChatPreferences[item.key]}
                    className="h-5 w-5 rounded border-zinc-300"
                  />
                </label>
              ))}
            </div>
          </div>

          {/* Font Size */}
          <div className="border-b border-zinc-200 p-4">
            <h3 className="mb-3 text-center font-semibold text-zinc-900">
              YAZI BOYUTU
            </h3>
            <select
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
              value={selectedFontSize}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedFontSize(val);
                if (typeof window !== "undefined") {
                  localStorage.setItem("chatFontSize", val);
                  window.dispatchEvent(
                    new CustomEvent("chatFontSizeChanged", { detail: val }),
                  );
                }
              }}
            >
              <option value="14px">14px</option>
              <option value="16px">16px (Varsayılan)</option>
              <option value="18px">18px</option>
              <option value="20px">20px</option>
            </select>
          </div>

          {/* Site Theme */}
          <div className="border-b border-zinc-200 p-4">
            {renderThemeSection()}
          </div>

          {/* Font Color */}
          <div className="border-b border-zinc-200 p-4">
            <h3 className="mb-3 text-center font-semibold text-zinc-900">
              YAZI RENGİ
            </h3>
            <div className="space-y-3">
              <label className="text-xs font-medium text-zinc-600">
                Renk seçici
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  className="h-10 w-16 cursor-pointer rounded border border-zinc-300 bg-white p-1"
                  value={
                    selectedFontBaseColor ||
                    selectedFontColor ||
                    defaultFontColor
                  }
                  onChange={(e) => {
                    const color = e.target.value;
                    setSelectedFontBaseColor(color);
                    setFontTonePercent(0);
                    setSelectedFontColor(color);
                    if (typeof window !== "undefined") {
                      localStorage.setItem("chatFontColor", color);
                      window.dispatchEvent(
                        new CustomEvent("chatFontColorChanged", {
                          detail: color,
                        }),
                      );
                    }
                  }}
                  aria-label="Yazı rengi seçici"
                />
                <span
                  className="h-8 w-8 rounded-full border border-zinc-200"
                  style={{
                    backgroundColor:
                      fontToneShade || selectedFontColor || defaultFontColor,
                  }}
                />
              </div>

              {selectedFontBaseColor && (
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] text-zinc-500 uppercase font-bold">
                    <span>Ton Ayarı</span>
                    <span>{fontTonePercent}%</span>
                  </div>
                  <input
                    type="range"
                    min="-40"
                    max="40"
                    step="5"
                    className="w-full accent-blue-500 h-1.5 bg-zinc-200 rounded-lg appearance-none cursor-pointer"
                    value={fontTonePercent}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setFontTonePercent(val);
                      const shade = adjustHexColor(selectedFontBaseColor, val);
                      setSelectedFontColor(shade);
                      if (typeof window !== "undefined") {
                        localStorage.setItem("chatFontColor", shade);
                        window.dispatchEvent(
                          new CustomEvent("chatFontColorChanged", {
                            detail: shade,
                          }),
                        );
                      }
                    }}
                  />
                  <div className="flex gap-1.5 justify-between">
                    {fontColorShades.map((shade, i) => (
                      <button
                        key={i}
                        className={`h-6 flex-1 rounded-md border transition-all ${
                          selectedFontColor === shade
                            ? "border-blue-500 scale-105"
                            : "border-transparent"
                        }`}
                        style={{ backgroundColor: shade }}
                        onClick={() => {
                          const steps = [-30, -15, 0, 15, 30];
                          setFontTonePercent(steps[i]);
                          setSelectedFontColor(shade);
                          if (typeof window !== "undefined") {
                            localStorage.setItem("chatFontColor", shade);
                            window.dispatchEvent(
                              new CustomEvent("chatFontColorChanged", {
                                detail: shade,
                              }),
                            );
                          }
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              <button
                className="w-full py-2 text-xs text-red-500 hover:text-red-600 font-medium border border-red-100 rounded-lg hover:bg-red-50 transition-colors"
                onClick={() => {
                  setSelectedFontColor(null);
                  setSelectedFontBaseColor(null);
                  setFontTonePercent(0);
                  if (typeof window !== "undefined") {
                    localStorage.removeItem("chatFontColor");
                    window.dispatchEvent(
                      new CustomEvent("chatFontColorChanged", { detail: null }),
                    );
                  }
                }}
              >
                Yazı rengini kaldır
              </button>
            </div>
          </div>
          <div className="h-20" />
          </>
          )}
        </div>
      </div>

      {isNarrowProfileViewport && activeMobileSettingsSection !== "home" && (
        <div className="chat-theme-settings-mobile fixed inset-0 z-[70] flex flex-col overflow-hidden bg-[#f4f7fb]">
          <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-4 py-3">
            <button
              type="button"
              onClick={() => setActiveMobileSettingsSection("home")}
              className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-600 active:bg-zinc-100"
              aria-label="Ayarlar ana ekranına dön"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-7 w-7"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.4}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <h2 className="text-center text-xl font-black text-zinc-900">
              Ayar Detayı
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-600 active:bg-zinc-100"
              aria-label="Ayarları kapat"
            >
              <X className="h-7 w-7" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+112px)]" style={{ WebkitOverflowScrolling: 'touch' }}>
            <div className="chat-theme-settings-detail-modal rounded-[24px] border border-zinc-100 bg-white p-4 shadow-sm">
              {renderMobileSectionContent()}
            </div>
          </div>
        </div>
      )}

      <RegisterModal
        isOpen={showRegisterModal}
        onClose={() => setShowRegisterModal(false)}
        onSuccess={() => {
          // Refresh the page or update user info after successful registration
          window.location.reload();
        }}
      />

      {/* Flash Nick Modal */}
      {showFlashNickModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center px-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowFlashNickModal(false);
              setPendingFlashNickPreview(null);
              setPendingFlashNickFile(null);
            }
          }}
        >
          <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
            {/* Header */}
            <div className="flex items-center justify-between bg-gradient-to-r from-[#1a4267] to-[#2563eb] px-5 py-4">
              <div className="flex items-center gap-2.5">
                <Upload className="h-4 w-4 text-white/80" />
                <h3 className="text-sm font-bold text-white">Flash Nick</h3>
              </div>
              <button
                onClick={() => {
                  setShowFlashNickModal(false);
                  setPendingFlashNickPreview(null);
                  setPendingFlashNickFile(null);
                }}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/15 text-white hover:bg-white/25 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Preview Area */}
            <div className="p-5">
              {/* Yeni yüklenecek görsel */}
              {pendingFlashNickPreview ? (
                <div className="space-y-3">
                  <p className="text-center text-[11px] font-bold uppercase tracking-widest text-zinc-400">
                    Yeni Flash Nick Önizleme
                  </p>
                  <div className="flex flex-col items-center gap-3 rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-purple-50 py-5">
                    {/* Nick + flash image preview */}
                    <div className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 shadow-sm ring-1 ring-zinc-100">
                      <img
                        src={pendingFlashNickPreview}
                        alt="Flash Nick Önizleme"
                        className="h-7 w-auto max-w-[80px] object-contain"
                      />
                      <span className="text-sm font-bold text-zinc-800">{username}</span>
                    </div>
                    <p className="text-[11px] text-zinc-400">
                      {pendingFlashNickFile?.name} &middot;{" "}
                      {pendingFlashNickFile
                        ? `${(pendingFlashNickFile.size / 1024).toFixed(1)} KB`
                        : ""}
                    </p>
                  </div>
                </div>
              ) : selectedFlashNick ? (
                <div className="space-y-3">
                  <p className="text-center text-[11px] font-bold uppercase tracking-widest text-zinc-400">
                    Mevcut Flash Nick
                  </p>
                  <div className="flex flex-col items-center gap-3 rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-teal-50 py-5">
                    <div className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 shadow-sm ring-1 ring-zinc-100">
                      <img
                        src={selectedFlashNick}
                        alt="Mevcut Flash Nick"
                        className="h-7 w-auto max-w-[80px] object-contain"
                      />
                      <span className="text-sm font-bold text-zinc-800">{username}</span>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Aktif
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-200 bg-zinc-50 py-8">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100">
                    <Upload className="h-5 w-5 text-zinc-400" />
                  </div>
                  <p className="text-sm font-medium text-zinc-600">Flash nick yüklü değil</p>
                  <p className="text-xs text-zinc-400">PNG, JPG veya GIF · Maks 25MB</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 border-t border-zinc-100 px-5 pb-5">
              {/* Yeni görsel seç */}
              <button
                onClick={() => flashNickInputRef.current?.click()}
                disabled={isUploadingFlashNick || isDeletingFlashNick}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#1a4267] to-[#2563eb] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:from-[#14314d] hover:to-[#1d4ed8] disabled:opacity-50"
              >
                <Upload className="h-4 w-4" />
                {pendingFlashNickPreview ? "Farklı Görsel Seç" : "Görsel Seç"}
              </button>

              {/* Yükle butonu – sadece pending varsa */}
              {pendingFlashNickPreview && (
                <button
                  onClick={handleConfirmUploadFlashNick}
                  disabled={isUploadingFlashNick || isDeletingFlashNick}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2563eb] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#1d4ed8] disabled:opacity-50"
                >
                  {isUploadingFlashNick ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  {isUploadingFlashNick ? "Yükleniyor..." : "Yükle"}
                </button>
              )}

              {/* Sil butonu – aktif flash nick varsa */}
              {selectedFlashNick && (
                <button
                  onClick={handleRemoveFlashNick}
                  disabled={isUploadingFlashNick || isDeletingFlashNick}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 transition-all hover:bg-red-100 disabled:opacity-50"
                >
                  {isDeletingFlashNick ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-red-400 border-t-transparent" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  {isDeletingFlashNick ? "Siliniyor..." : "Flash Nick'i Sil"}
                </button>
              )}

              {/* Vazgeç */}
              <button
                onClick={() => {
                  setShowFlashNickModal(false);
                  setPendingFlashNickPreview(null);
                  setPendingFlashNickFile(null);
                }}
                disabled={isUploadingFlashNick || isDeletingFlashNick}
                className="w-full rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 transition-all hover:bg-zinc-50 disabled:opacity-50"
              >
                Vazgeç
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Üye Profil Modal */}
      {showProfileModal && (
        <div
          className={
            isNarrowProfileViewport
              ? "chat-theme-settings-mobile fixed inset-0 z-[90] flex bg-white"
              : "fixed inset-0 z-[90] flex items-start justify-center bg-black/35 px-4 py-6 sm:items-center sm:py-4"
          }
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowProfileModal(false);
            }
          }}
        >
          <div
            className={`chat-theme-settings-detail-modal relative flex w-full flex-col overflow-hidden bg-white shadow-2xl ${
              isNarrowProfileViewport
                ? "h-full max-w-none rounded-none"
                : "max-w-[512px] rounded-[28px]"
            }`}
            onClick={(e) => e.stopPropagation()}
            style={
              isNarrowProfileViewport
                ? undefined
                : {
                    transform: `translate(${profilePos.x}px, ${profilePos.y}px)`,
                  }
            }
          >
            <div
              className={`flex shrink-0 items-center justify-between border-b px-4 py-3 ${
                isNarrowProfileViewport
                  ? "border-zinc-200 bg-white text-zinc-900"
                  : "cursor-move border-sky-500 bg-sky-500 text-white"
              }`}
              onMouseDown={(e) => {
                if (isNarrowProfileViewport) return;
                e.preventDefault();
                dragStartRef.current = { x: e.clientX, y: e.clientY };
                setIsDraggingProfile(true);
              }}
            >
              <button
                type="button"
                onClick={() => setShowProfileModal(false)}
                className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                  isNarrowProfileViewport
                    ? "text-zinc-600 hover:bg-zinc-100"
                    : "text-white/90 hover:bg-white/10"
                }`}
                aria-label="Kullanıcı ayarlarına dön"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
              <span className="text-base font-semibold">
                {isNarrowProfileViewport ? activeProfileTabLabel : "Üye Profili"}
              </span>
              <button
                onClick={() => setShowProfileModal(false)}
                className={`rounded-xl px-4 py-1.5 text-xs font-semibold ${
                  isNarrowProfileViewport
                    ? "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                    : "bg-sky-400/90 text-white hover:bg-sky-300"
                }`}
              >
                Kapat
              </button>
            </div>

            <div
              className={`flex min-h-0 ${
                isNarrowProfileViewport ? "flex-1 flex-col" : "flex-row"
              }`}
            >
              {!isNarrowProfileViewport && (
                <div className="w-[170px] shrink-0 border-r border-zinc-200 bg-white py-3">
                  {profileTabOptions.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setActiveProfileTab(item.id)}
                      className={`mx-4 flex h-11 w-[calc(100%-2rem)] items-center rounded-xl px-4 py-2 text-left text-sm ${
                        activeProfileTab === item.id
                          ? "bg-zinc-200 font-semibold text-zinc-800"
                          : "text-zinc-700 hover:bg-zinc-50"
                      }`}
                    >
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              )}

              <div
                className={`overflow-y-auto overscroll-contain ${
                isNarrowProfileViewport
                  ? "min-h-0 flex-1 p-4 sm:p-5"
                  : "max-h-[680px] w-[342px] p-4"
                }`}
              >
                {activeProfileTab === "profilim" && (
                  <div
                    className={
                      isNarrowProfileViewport
                        ? "mx-auto flex w-full max-w-[460px] flex-col gap-5"
                        : "mx-auto flex w-full max-w-[342px] flex-col items-center text-center"
                    }
                  >
                    <div
                      className={
                        isNarrowProfileViewport
                          ? "flex flex-col items-center rounded-[24px] border border-sky-100 bg-linear-to-b from-sky-50 to-white px-4 py-6 text-center shadow-sm sm:px-6"
                          : "contents"
                      }
                    >
                      <div
                        className={
                          isNarrowProfileViewport
                            ? "relative h-32 w-32 overflow-visible rounded-full bg-white p-1 shadow-lg ring-1 ring-sky-100"
                            : "relative h-28 w-28 overflow-visible rounded-full border-4 border-zinc-200 shadow-md"
                        }
                      >
                        <div
                          className={`flex h-full w-full items-center justify-center rounded-full text-white ${
                            resolvedProfileIcon?.startsWith("data:")
                              ? "bg-white"
                              : isNarrowProfileViewport
                                ? "bg-linear-to-br from-sky-500 via-blue-500 to-violet-600"
                                : "bg-linear-to-br from-blue-500 to-purple-600"
                          } ${isNarrowProfileViewport ? "overflow-hidden text-4xl font-black" : "text-3xl font-bold"}`}
                        >
                          {resolvedProfileIcon ? (
                            <img
                              src={resolvedProfileIcon}
                              alt="avatar"
                              className="h-full w-full rounded-full bg-white object-cover"
                            />
                          ) : (
                            profileInitials
                          )}
                        </div>
                        {!isGuest && (
                          <>
                            <button
                              onClick={() => profileIconInputRef.current?.click()}
                              className={
                                isNarrowProfileViewport
                                  ? "absolute -bottom-1 -right-1 flex h-11 w-11 items-center justify-center rounded-full bg-sky-600 text-white shadow-lg ring-4 ring-white transition hover:bg-sky-700 active:scale-95"
                                  : "absolute -bottom-2 -right-2 flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg ring-2 ring-white hover:bg-blue-700"
                              }
                              title="Profil fotoğrafı yükle"
                            >
                              <Pencil
                                className={
                                  isNarrowProfileViewport ? "h-5 w-5" : "h-4 w-4"
                                }
                              />
                            </button>
                            {selectedIcon && (
                              <button
                                type="button"
                                onClick={handleRemoveIcon}
                                className={
                                  isNarrowProfileViewport
                                    ? "absolute -bottom-1 -left-1 flex h-11 w-11 items-center justify-center rounded-full bg-rose-600 text-white shadow-lg ring-4 ring-white transition hover:bg-rose-700 active:scale-95"
                                    : "absolute -bottom-2 -left-2 flex h-9 w-9 items-center justify-center rounded-full bg-rose-600 text-white shadow-lg ring-2 ring-white hover:bg-rose-700"
                                }
                                title="Profil fotoğrafını kaldır"
                              >
                                <Trash2
                                  className={
                                    isNarrowProfileViewport ? "h-5 w-5" : "h-4 w-4"
                                  }
                                />
                              </button>
                            )}
                            <input
                              ref={profileIconInputRef}
                              type="file"
                              accept="image/png,image/jpeg"
                              className="hidden"
                              onChange={handleUploadProfileIcon}
                            />
                          </>
                        )}
                      </div>
                      <p
                        className={
                          isNarrowProfileViewport
                            ? "mt-4 w-full truncate text-2xl font-black text-zinc-900"
                            : "mt-4 text-xl font-semibold text-zinc-900"
                        }
                      >
                        {username}
                      </p>
                      <p
                        className={
                          isNarrowProfileViewport
                            ? "mt-1 w-full truncate text-base font-semibold text-sky-700"
                            : "text-sm text-zinc-500"
                        }
                      >
                        {isGuest ? "Misafir" : formatRoleLabel(roleName)}
                      </p>
                    </div>

                    <div
                      className={
                        isNarrowProfileViewport
                          ? "grid w-full grid-cols-1 gap-3 min-[380px]:grid-cols-2"
                          : "mt-5 grid w-full max-w-[420px] grid-cols-2 gap-3"
                      }
                    >
                      {!isGuest && isNarrowProfileViewport && (
                        <button
                          className="flex min-h-16 items-center justify-center gap-2 rounded-2xl border border-sky-200 bg-white px-4 py-3 text-base font-bold text-sky-800 shadow-sm transition hover:bg-sky-50 active:scale-[0.99]"
                          onClick={() => profileIconInputRef.current?.click()}
                          title="Profil fotoğrafı yükle"
                        >
                          <Upload className="h-5 w-5" />
                          Resim Ekle
                        </button>
                      )}
                      {!isGuest && isNarrowProfileViewport && selectedIcon && (
                        <button
                          className="flex min-h-16 items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-white px-4 py-3 text-base font-bold text-rose-700 shadow-sm transition hover:bg-rose-50 active:scale-[0.99]"
                          onClick={handleRemoveIcon}
                          title="Profil fotoğrafını kaldır"
                        >
                          <Trash2 className="h-5 w-5" />
                          Resmi Kaldır
                        </button>
                      )}
                      {!isGuest && isFlashNickAuthorized && (
                        <button
                          className={
                            isNarrowProfileViewport
                              ? "flex min-h-16 items-center justify-center gap-2 rounded-2xl border border-sky-200 bg-white px-4 py-3 text-base font-bold text-sky-800 shadow-sm transition hover:bg-sky-50 active:scale-[0.99]"
                              : "flex items-center justify-center gap-2 rounded-2xl border border-zinc-200 px-4 py-3 text-base font-semibold text-zinc-700 transition-colors hover:bg-zinc-50"
                          }
                          onClick={() => setShowFlashNickModal(true)}
                          title="Flash nick yönet"
                        >
                          {isNarrowProfileViewport ? (
                            <Sparkles className="h-5 w-5" />
                          ) : (
                            <Upload className="h-4 w-4" />
                          )}
                          Flash Nick
                          {selectedFlashNick && (
                            <span className="ml-1 inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                          )}
                        </button>
                      )}
                      <input
                        ref={flashNickInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/gif"
                        className="hidden"
                        onChange={handleFlashNickFileSelect}
                      />
                      <button
                        className={
                          isNarrowProfileViewport
                            ? "flex min-h-16 items-center justify-center gap-2 rounded-2xl border border-sky-200 bg-white px-4 py-3 text-base font-bold text-sky-800 shadow-sm transition hover:bg-sky-50 active:scale-[0.99]"
                            : "rounded-2xl border border-zinc-200 px-4 py-3 text-base font-semibold text-zinc-700 hover:bg-zinc-50"
                        }
                        onClick={() => setShowFrameModal(true)}
                      >
                        {isNarrowProfileViewport && <Brush className="h-5 w-5" />}
                        Çerçeve Seç
                      </button>
                      {!isGuest && isJoinEffectAuthorized && (
                        <button
                          className={`flex min-h-16 items-center justify-center gap-2 rounded-2xl border border-sky-200 bg-white px-4 py-3 text-base font-bold text-sky-800 shadow-sm transition hover:bg-sky-50 active:scale-[0.99] ${
                            isNarrowProfileViewport ? "" : "col-span-2"
                          }`}
                          onClick={openJoinEffectModal}
                        >
                          <Sparkles className="h-5 w-5" />
                          Giriş Efekti Seç
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {activeProfileTab === "sifre" && (
                  <div className="flex flex-col gap-4">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-zinc-700">
                        Kullandığınız Şifre
                      </label>
                      <input
                        type="password"
                        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-500"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Kullandığınız şifre"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-zinc-700">
                        Yeni Şifreniz
                      </label>
                      <input
                        type="password"
                        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-500"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Yeni şifreniz"
                      />
                    </div>
                    {passwordMessage && (
                      <p className="text-sm text-zinc-600">{passwordMessage}</p>
                    )}
                    <button
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                      onClick={handleChangePassword}
                      disabled={
                        isChangingPassword || !currentPassword || !newPassword
                      }
                    >
                      Şifre Değiştir
                    </button>
                  </div>
                )}

                {activeProfileTab === "rumuz" && (
                  <div className="flex flex-col gap-4">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-zinc-700">
                        Yeni rumuz yazınız
                      </label>
                      <input
                        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-black placeholder:text-zinc-900"
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        placeholder="Yeni rumuz yazınız"
                      />
                    </div>
                    {usernameMessage && (
                      <p className="text-sm text-zinc-600">{usernameMessage}</p>
                    )}
                    <button
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                      onClick={handleChangeUsername}
                      disabled={isChangingUsername || !newUsername}
                    >
                      Rumuz Değiştir
                    </button>
                  </div>
                )}

                {activeProfileTab === "ikonlar" && (
                  <div className="space-y-4">
                    {isGuest ? (
                      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 text-center">
                        <p className="text-sm font-semibold text-zinc-700">
                          Bu bölümü kullanmak için üye olmalısınız.
                        </p>
                        <button
                          type="button"
                          onClick={() => setShowRegisterModal(true)}
                          className="mt-4 w-full rounded-xl bg-blue-500 px-4 py-3 text-sm font-bold text-white hover:bg-blue-600"
                        >
                          Kayıtlı üye ol!
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="grid max-h-[300px] grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4">
                          {Array.from(
                            { length: 100 },
                            (_, i) => `/avatarlar/${i + 1}.png`,
                          ).map((icon) => {
                            const isActive = selectedIcon === icon;
                            return (
                              <button
                                key={icon}
                                onClick={() =>
                                  isActive
                                    ? handleRemoveIcon()
                                    : handleSelectIcon(icon)
                                }
                                className={`relative h-16 w-full overflow-hidden rounded-xl border bg-white transition ${
                                  isActive
                                    ? "border-blue-500 ring-2 ring-blue-200"
                                    : "border-zinc-200 hover:border-zinc-300"
                                }`}
                              >
                                <div className="relative h-full w-full">
                                  <Image
                                    src={icon}
                                    alt={icon}
                                    fill
                                    sizes="120px"
                                    className="object-contain p-2"
                                  />
                                </div>
                                {isActive && (
                                  <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded bg-blue-500 px-2 py-0.5 text-[11px] font-semibold text-white">
                                    Seçili
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                        <button
                          className="w-full rounded-lg bg-zinc-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
                          onClick={handleRemoveIcon}
                          disabled={!selectedIcon}
                        >
                          İkonu Kaldır
                        </button>
                      </>
                    )}
                  </div>
                )}

                {activeProfileTab === "ek" && (
                  <div className="flex flex-col gap-3">
                    {/* Combined Preview */}
                    {(tempFont ||
                      tempGranite ||
                      tempNickColor ||
                      tempUserGif) && (
                      <div className="rounded-xl border border-blue-100 bg-linear-to-br from-blue-50/50 to-purple-50/50 p-4">
                        <p className="mb-2 text-center text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                          Görünüm Önizleme
                        </p>
                        <div className="flex items-center justify-center py-2">
                          <span
                            className={`text-xl font-bold ${tempGranite} ${getChatFontPreviewClass(tempFont) || ""}`}
                            style={{
                              ...(tempFont
                                ? {
                                    fontFamily:
                                      getChatFontFamily(tempFont) || undefined,
                                  }
                                : {}),
                              ...(tempNickColor
                                ? { color: tempNickColor }
                                : {}),
                            }}
                          >
                            {username}
                          </span>
                        </div>
                        {tempUserGif && (
                          <div className="mt-2 flex justify-center">
                            <img
                              src={tempUserGif}
                              alt="Seçili user gif"
                              className="h-8 w-8 rounded-full object-cover border border-zinc-200"
                            />
                          </div>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-1 relative">
                        <label className="text-[11px] font-bold text-zinc-500 uppercase ml-1">
                          Rumuz Renk
                        </label>
                        <button
                          type="button"
                          className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-left text-sm text-zinc-900 hover:bg-white transition-all flex items-center justify-between"
                          onClick={() =>
                            setShowNickColorPicker((prev) => !prev)
                          }
                        >
                          <span className="flex items-center gap-2">
                            <span
                              className="h-4 w-4 rounded-full border border-zinc-300"
                              style={{
                                backgroundColor: tempNickColor || "#18181b",
                              }}
                            />
                            {tempNickColor || "Varsayılan"}
                          </span>
                          <span className="text-xs text-zinc-500">
                            {showNickColorPicker ? "Kapat" : "Değiştir"}
                          </span>
                        </button>

                        {showNickColorPicker && (
                          <div className="absolute z-20 mt-2 w-full rounded-xl border border-zinc-200 bg-white p-3 shadow-lg space-y-2">
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                className="h-9 w-14 cursor-pointer rounded border border-zinc-300 bg-white p-1"
                                value={tempNickColor || "#18181b"}
                                onChange={(e) => {
                                  setTempNickColor(e.target.value);
                                }}
                                aria-label="Rumuz rengi seçici"
                              />
                              <span className="text-xs text-zinc-600">
                                {tempNickColor || "Varsayılan"}
                              </span>
                            </div>
                            <button
                              type="button"
                              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-xs text-zinc-600 hover:bg-zinc-100"
                              onClick={() => {
                                setTempNickColor(null);
                                setShowNickColorPicker(false);
                              }}
                            >
                              Rengi Temizle
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-zinc-500 uppercase ml-1">
                          User Gif
                        </label>
                        <div className="space-y-2">
                          <select
                            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 focus:bg-white focus:border-blue-500 transition-all outline-none"
                            value={tempUserGif || ""}
                            onChange={(e) =>
                              setTempUserGif(e.target.value || null)
                            }
                          >
                            <option value="">Seçiniz</option>
                            <option value="">Varsayılan GIF</option>
                            {userGifOptions.map((gif) => (
                              <option key={gif.value} value={gif.value}>
                                {gif.label}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-xs text-zinc-600 hover:bg-zinc-100"
                            onClick={() => setTempUserGif(null)}
                          >
                            GIF Temizle
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1 relative" ref={fontPickerRef}>
                      <label className="text-[11px] font-bold text-zinc-500 uppercase ml-1">
                        Yazı Tipi (Font)
                      </label>
                      <button
                        type="button"
                        className={`w-full rounded-xl border px-3 py-2 text-sm transition-all outline-none ${
                          showFontPicker
                            ? "border-blue-500 bg-white shadow-sm"
                            : "border-zinc-200 bg-zinc-50 hover:bg-white"
                        }`}
                        onClick={() => setShowFontPicker((prev) => !prev)}
                        aria-haspopup="listbox"
                        aria-expanded={showFontPicker}
                      >
                        <span className="flex items-center justify-between gap-3 text-left">
                          <span
                            className={`truncate ${getChatFontPreviewClass(tempFont) || ""} ${
                              tempFont ? "text-zinc-900" : "text-zinc-500"
                            }`}
                            style={{
                              fontFamily:
                                getChatFontFamily(tempFont) || undefined,
                            }}
                          >
                            {tempFont || "Varsayılan Font"}
                          </span>
                          <ChevronDown
                            className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${
                              showFontPicker ? "rotate-180" : ""
                            }`}
                          />
                        </span>
                      </button>

                      {showFontPicker && (
                        <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl shadow-blue-100/40">
                          <div
                            className="max-h-80 overflow-y-auto p-2"
                            role="listbox"
                            aria-label="Yazı tipi seçenekleri"
                          >
                            <button
                              type="button"
                              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                                !tempFont
                                  ? "bg-blue-50 text-blue-700"
                                  : "text-zinc-700 hover:bg-zinc-50"
                              }`}
                              onClick={() => {
                                setTempFont("");
                                setShowFontPicker(false);
                              }}
                            >
                              <span>Varsayılan Font</span>
                              {!tempFont && <Check className="h-4 w-4" />}
                            </button>

                            {CHAT_FONT_GROUPS.map((group) => (
                              <div key={group.category} className="mt-2 first:mt-0">
                                <p className="px-3 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-400">
                                  {group.label}
                                </p>
                                <div className="space-y-1">
                                  {group.options.map((font) => {
                                    const isSelected = tempFont === font.fontName;
                                    return (
                                      <button
                                        key={font.id}
                                        type="button"
                                        className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                                          isSelected
                                            ? "bg-blue-50 text-blue-700"
                                            : "text-zinc-800 hover:bg-zinc-50"
                                        }`}
                                        onClick={() => {
                                          setTempFont(font.fontName);
                                          setShowFontPicker(false);
                                        }}
                                        style={{
                                          fontFamily:
                                            getChatFontFamily(font.fontName) ||
                                            undefined,
                                        }}
                                      >
                                        <span className={font.previewClass}>
                                          {font.label}
                                        </span>
                                        {isSelected && (
                                          <Check className="h-4 w-4 shrink-0" />
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1 relative" ref={granitePickerRef}>
                      <label className="text-[11px] font-bold text-zinc-500 uppercase ml-1">
                        Rumuz Tipi (Granit)
                      </label>
                      <button
                        type="button"
                        className={`w-full rounded-xl border px-3 py-2 text-sm transition-all outline-none ${
                          showGranitePicker
                            ? "border-blue-500 bg-white shadow-sm"
                            : "border-zinc-200 bg-zinc-50 hover:bg-white"
                        }`}
                        onClick={() => setShowGranitePicker((prev) => !prev)}
                        aria-haspopup="listbox"
                        aria-expanded={showGranitePicker}
                      >
                        <span className="flex items-center justify-between gap-3 text-left">
                          <span className="flex-1 truncate">
                            {tempGranite ? (
                              <span className="inline-flex max-w-full items-center px-1 py-0.5">
                                <span
                                  className={`truncate ${getChatGraniteOption(tempGranite)?.previewClass || ""}`}
                                >
                                  {getChatGraniteOption(tempGranite)?.label}
                                </span>
                              </span>
                            ) : (
                              <span className="text-zinc-500">
                                Varsayılan Granit
                              </span>
                            )}
                          </span>
                          <ChevronDown
                            className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${
                              showGranitePicker ? "rotate-180" : ""
                            }`}
                          />
                        </span>
                      </button>

                      {showGranitePicker && (
                        <div className="mt-2 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-md shadow-zinc-200/50">
                          <div
                            className="max-h-52 overflow-y-auto p-1.5"
                            role="listbox"
                            aria-label="Granit seçenekleri"
                          >
                            <button
                              type="button"
                              className={`flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-xs transition-colors ${
                                !tempGranite
                                  ? "bg-blue-50 text-blue-700"
                                  : "text-zinc-700 hover:bg-zinc-50"
                              }`}
                              onClick={() => {
                                setTempGranite("");
                                setShowGranitePicker(false);
                              }}
                            >
                              <span>Varsayılan Granit</span>
                              {!tempGranite && <Check className="h-4 w-4" />}
                            </button>

                            {CHAT_GRANITE_GROUPS.map((group) => (
                              <div key={group.category} className="mt-2 first:mt-0">
                                <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-400">
                                  {group.label}
                                </p>
                                <div className="space-y-1">
                                  {group.options.map((granite) => {
                                    const isSelected =
                                      tempGranite === granite.className;
                                    return (
                                      <button
                                        key={granite.id}
                                        type="button"
                                        className={`flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-xs transition-colors ${
                                          isSelected
                                            ? "bg-blue-50 text-blue-700"
                                            : "text-zinc-800 hover:bg-zinc-50"
                                        }`}
                                        onClick={() => {
                                          setTempGranite(granite.className);
                                          setShowGranitePicker(false);
                                        }}
                                      >
                                        <span className="inline-flex min-h-8 items-center px-1 py-0.5">
                                          <span className={granite.previewClass}>
                                            {granite.label}
                                          </span>
                                        </span>
                                        {isSelected && (
                                          <Check className="h-4 w-4 shrink-0" />
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <button
                      className="mt-2 w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none"
                      onClick={handleSaveExtraFeatures}
                      disabled={isSavingExtra}
                    >
                      {isSavingExtra ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          <span>Kaydediliyor...</span>
                        </div>
                      ) : (
                        "Ayarları Kaydet"
                      )}
                    </button>
                  </div>
                )}

                {activeProfileTab === "dondur" && (
                  <div className="space-y-4 text-center text-sm text-zinc-700">
                    <p className="text-base font-medium">
                      Üyeliğinizi dondurmanız (kilitlemeniz) hâlinde, tekrar
                      aynı kullanıcı adı ile sisteme giriş yapamazsınız.
                    </p>
                    <p>
                      Ancak, bir yönetici vasıtası ile kilidinizi tekrar
                      açtırabilirsiniz.
                    </p>
                    {freezeMessage && (
                      <p className="rounded-lg bg-zinc-100 px-3 py-2 text-sm font-semibold text-zinc-700">
                        {freezeMessage}
                      </p>
                    )}
                    <button
                      className="mx-auto block rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={handleFreezeAccount}
                      disabled={isGuest || isFreezingAccount}
                    >
                      {isFreezingAccount ? "Donduruluyor..." : "Anladım, Dondur"}
                    </button>
                    {isGuest && (
                      <p className="text-xs font-medium text-amber-700">
                        Misafir hesaplar dondurulamaz.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showFrameModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4"
          onClick={() => setShowFrameModal(false)}
        >
          <div
            className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-zinc-900">
                  Çerçeveler ve rozetler
                </h3>
                <p className="text-sm text-zinc-500">
                  Profil resmin için çerçeve seç.
                </p>
              </div>
              <button
                className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-semibold text-zinc-700 hover:bg-zinc-200"
                onClick={() => setShowFrameModal(false)}
              >
                Kapat
              </button>
            </div>

            {isGuest ? (
              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 text-center">
                <p className="text-sm font-semibold text-zinc-700">
                  Bu bölümü kullanmak için üye olmalısınız.
                </p>
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(true)}
                  className="mt-4 w-full rounded-xl bg-blue-500 px-4 py-3 text-sm font-bold text-white hover:bg-blue-600"
                >
                  Kayıtlı üye ol!
                </button>
              </div>
            ) : (
              <div className="max-h-[60vh] overflow-y-auto pr-2">
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
                  {Array.from(
                    { length: 50 },
                    (_, i) => `/cerceveler/${i + 1}.gif`,
                  ).map((frame) => {
                    const isActive = selectedFrame === frame;
                    return (
                      <div
                        key={frame}
                        className={`rounded-lg border bg-white p-2 shadow-sm transition cursor-pointer ${
                          isActive
                            ? "border-red-500 shadow-red-100 ring-2 ring-red-200"
                            : "border-zinc-200 hover:border-zinc-300"
                        }`}
                        onClick={() =>
                          isActive
                            ? handleRemoveFrame()
                            : handleSelectFrame(frame)
                        }
                      >
                        <div className="relative mx-auto flex h-16 w-16 items-center justify-center">
                          <Image
                            src={frame}
                            alt={frame}
                            fill
                            sizes="64px"
                            className="object-contain"
                            unoptimized
                          />
                        </div>
                        <div
                          className={`mt-2 text-center text-xs font-medium ${
                            isActive ? "text-red-600" : "text-zinc-500"
                          }`}
                        >
                          {isActive ? "Kaldır" : "Seç"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <JoinEffectModal
        isOpen={showJoinEffectModal}
        onClose={closeJoinEffectModal}
        onConfirm={handleConfirmJoinEffect}
        currentEffect={joinEffectDraft}
        isAuthorized={!isGuest && isJoinEffectAuthorized}
        isSaving={isSavingJoinEffect}
        onSelect={handleSelectJoinEffect}
        onClear={handleClearJoinEffect}
      />
    </>
  );
};
