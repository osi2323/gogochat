"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { RolesView } from "./RolesView";
import { WebConsole } from "./WebConsole";
import { getClientApiClient } from "@/lib/api/clientApi";
import { apiClient } from "@/services/apiClient";
import { LoginHistoryModal } from "./LoginHistoryModal";
import { RoomsView } from "./RoomsView";
import { hasEffectivePermission, PERMISSION_LABELS } from "@/lib/permissions";
import { formatRoleLabel } from "@/lib/roleLabels";
import { BotsView } from "./BotsView";
import { toast } from "sonner";
import { CHAT_FONT_OPTIONS } from "@/lib/chatFonts";
import { CHAT_GRANITE_OPTIONS } from "@/lib/chatGranites";
import { env } from "@/config/env";

interface AdminPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialView?: AdminPanelView | null;
  initialRoomName?: string | null;
  socket?: any | null;
  currentUserStarCount?: number | null;
  currentUserPermissions?: string[];
  currentRolePermissions?: Record<string, unknown> | null;
  onForbiddenWordsChange?: (
    words: Array<{ forbiddenWord: string; replacementWord?: string | null }>,
  ) => void;
}

interface AdminCardProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  bgColor: string;
  disabled?: boolean;
  title?: string;
}

type AdminActionItem = {
  id: number;
  adminId: number | null;
  adminUsername: string | null;
  actionType: string;
  description: string | null;
  targetUserId: number | null;
  targetUsername: string | null;
  status: string | null;
  metadata?: Record<string, any> | null;
  createdAt: string | null;
};

type BannedListItem = {
  id: number;
  banType?: "user" | "ip";
  username: string;
  bannedByUsername: string;
  bannedByStarCount?: number;
  reason: string | null;
  expiresAt: string | null;
  createdAt: string | null;
  ipAddress?: string | null;
  source?: string | null;
};

type SystemSettings = {
  id?: number;
  everyoneCanEnter: boolean;
  desktopLoginEnabled: boolean;
  mobileLoginEnabled: boolean;
  guestLoginEnabled: boolean;
  newRegistrationEnabled: boolean;
  guestCanWrite: boolean;
  staffCanChangeNickname: boolean;
  friendsPrivateMessageMembersOnly: boolean;
  membersPrivateMessageEnabled: boolean;
  membersVoiceCallEnabled: boolean;
  guestPrivateMessageEnabled: boolean;
  guestVoiceCallEnabled: boolean;
  firstMessageDelayEnabled: boolean;
  firstMessageDelaySeconds: number;
  guestWaitSeconds: number;
  memberAndGuestMicDurationSeconds: number;
  siteLanguage: string;
  chatImageSendPermission: string;
  chatVoiceSendPermission: string;
  chatVoiceRecordSendPermission: string;
  chatYoutubeSendPermission: string;
  siteName: string;
  siteDescription: string;
  maxUserCount: number;
  maintenanceMode: boolean;
  showMicrophonesOnMobile: boolean;
};

type RadioSettings = {
  radioLink: string;
  radioRequestLink: string;
};

type SecuritySettings = {
  membersMicrophoneDisabled: boolean;
  fakeIpLoginEnabled: boolean;
  deviceAndLocationBanEnabled: boolean;
  guestSystemEnabled: boolean;
  guestEntriesEnabled: boolean;
  guestsWritingDisabled: boolean;
  guestsMicrophoneDisabled: boolean;
  countryBlockEnabled: boolean;
  blockedCountries: string[];
  vpnBlockEnabled: boolean;
};

const defaultRadioSettings: RadioSettings = {
  radioLink: "https://yayin.hizmetpanel.net/3232/stream",
  radioRequestLink: "Radyo İstek Paneli Linki",
};

const defaultSecuritySettings: SecuritySettings = {
  membersMicrophoneDisabled: false,
  fakeIpLoginEnabled: false,
  deviceAndLocationBanEnabled: false,
  guestSystemEnabled: false,
  guestEntriesEnabled: false,
  guestsWritingDisabled: false,
  guestsMicrophoneDisabled: false,
  countryBlockEnabled: false,
  blockedCountries: [],
  vpnBlockEnabled: false,
};

const ADMIN_ACTION_TYPE_LABELS: Record<string, string> = {
  ADMIN_USER_LIST: "Kullanıcılar listelendi",
  ADMIN_STAR_USER_LIST: "Yıldızlı kullanıcılar listelendi",
  ADMIN_USER_UPDATE: "Kullanıcı bilgileri güncellendi",
  ADMIN_USER_DELETE: "Kullanıcı silindi",
  ADMIN_USER_BAN: "Kullanıcı banlandı",
  ADMIN_DEVICE_BAN: "Cihaz banı uygulandı",
  ADMIN_USER_UNBAN: "Kullanıcının banı kaldırıldı",
  ADMIN_IP_UNBAN: "IP banı kaldırıldı",
  ADMIN_KICK_USER: "Kullanıcı odadan atıldı",
  ADMIN_MIC_BAN_TOGGLE: "Mikrofon yasağı güncellendi",
  ADMIN_CAMERA_BAN_TOGGLE: "Kamera yasağı güncellendi",
  ADMIN_ROOM_MUTE_TOGGLE: "Oda susturma durumu güncellendi",
  ADMIN_GLOBAL_MUTE_TOGGLE: "Genel susturma durumu güncellendi",
  SYSTEM_RESET: "Sistem resetleme başlatıldı",
  BANNED_WORD_CREATE: "Yasaklı kelime eklendi",
  BANNED_WORD_DELETE: "Yasaklı kelime silindi",
  BANNED_NICK_CREATE: "Yasaklı rumuz eklendi",
  BANNED_NICK_DELETE: "Yasaklı rumuz silindi",
  STATUS_MODE_CREATE: "Durum modu eklendi",
  STATUS_MODE_UPDATE: "Durum modu güncellendi",
  STATUS_MODE_DELETE: "Durum modu silindi",
  USER_STATUS_MODE_UPDATE: "Kullanıcı durum modu güncellendi",
  USER_FRAME_UPDATE: "Kullanıcı çerçevesi güncellendi",
  FLOOD_BAN_CLEAR_ALL: "Tüm flood ban kayıtları temizlendi",
};

const withImageVersion = <T extends { avatar?: string | null }>(item: T): T => {
  const avatar = item.avatar;
  if (!avatar || avatar.startsWith("data:")) return item;
  const separator = avatar.includes("?") ? "&" : "?";
  return {
    ...item,
    avatar: `${avatar}${separator}v=${Date.now()}`,
  };
};

const COUNTRY_OPTIONS = [
  "Afganistan",
  "Aland adaları",
  "Almanya",
  "Amerika Birleşik Devletleri",
  "Andorra",
  "Angola",
  "Anguilla",
  "Antarktika",
  "Antigua ve Barbuda",
  "Arjantin",
  "Arnavutluk",
  "Aruba",
  "Avustralya",
  "Avusturya",
  "Azerbaycan",
  "Bahamalar",
  "Bahreyn",
  "Bangladeş",
  "Barbados",
  "Belçika",
  "Belize",
  "Benin",
  "Bermuda",
  "Beyaz Rusya",
  "Bhutan",
  "Birleşik Arap Emirlikleri",
  "Bolivya",
  "Bosna Hersek",
  "Botswana",
  "Brezilya",
  "Brunei",
  "Bulgaristan",
  "Burkina Faso",
  "Burundi",
  "Cape Verde",
  "Cebelitarık",
  "Cezayir",
  "Christmas Adası",
  "Cibuti",
  "Cocos Adaları",
  "Cook Adaları",
  "Çad",
  "Çek Cumhuriyeti",
  "Çin",
  "Danimarka",
  "Dominik",
  "Dominik Cumhuriyeti",
  "Doğu Timor",
  "Ekvador",
  "Ekvator Ginesi",
  "El Salvador",
  "Endonezya",
  "Eritre",
  "Ermenistan",
  "Estonya",
  "Etiyopya",
  "Falkland Adaları",
  "Faroe Adaları",
  "Fas",
  "Fiji",
  "Fildişi Sahili",
  "Filipinler",
  "Filistin",
  "Finlandiya",
  "Fransa",
  "Fransız Guyanası",
  "Fransız Polinezyası",
  "Gabon",
  "Gambia",
  "Gana",
  "Gine",
  "Gine-Bissau",
  "Granada",
  "Grönland",
  "Guadalup",
  "Guam",
  "Guatemala",
  "Guernsey",
  "Guyana",
  "Güney Afrika",
  "Güney Georgia",
  "Güney Kore",
  "Gürcistan",
  "Haiti",
  "Heard Adası",
  "Hindistan",
  "Hollanda",
  "Hollanda Antilleri",
  "Honduras",
  "Hong Kong",
  "Hırvatistan",
  "Irak",
  "İngiltere",
  "İran",
  "İrlanda",
  "İspanya",
  "İsrail",
  "İsveç",
  "İsviçre",
  "İtalya",
  "İzlanda",
  "Jamaika",
  "Japonya",
  "Jersey",
  "Kamboçya",
  "Kamerun",
  "Kanada",
  "Karadağ",
  "Katar",
  "Kazakistan",
  "Kenya",
  "Kıbrıs",
  "Kırgızistan",
  "Kiribati",
  "Kolombiya",
  "Komorlar",
  "Kongo",
  "Kosta Rika",
  "Kuveyt",
  "Kuzey Kore",
  "Kuzey Mariana Adaları",
  "Küba",
  "Laos",
  "Lesotho",
  "Letonya",
  "Liberya",
  "Libya",
  "Liechtenstein",
  "Litvanya",
  "Lübnan",
  "Lüksemburg",
  "Macaristan",
  "Madagaskar",
  "Makao",
  "Makedonya",
  "Malavi",
  "Maldivler",
  "Malezya",
  "Mali",
  "Malta",
  "Man Adası",
  "Marshall Adaları",
  "Martinik",
  "Mauritius",
  "Mayotte",
  "Meksika",
  "Mikronezya",
  "Mısır",
  "Moğolistan",
  "Moldovya",
  "Monako",
  "Montserrat",
  "Moritanya",
  "Mozambik",
  "Myanmar",
  "Namibya",
  "Nauru",
  "Nepal",
  "Nijer",
  "Nijerya",
  "Nikaragua",
  "Niue",
  "Norfolk Adası",
  "Norveç",
  "Orta Afrika Cumhuriyeti",
  "Özbekistan",
  "Pakistan",
  "Palau",
  "Panama",
  "Papua Yeni Gine",
  "Paraguay",
  "Peru",
  "Pitcairn",
  "Polonya",
  "Portekiz",
  "Porto Riko",
  "Reunion",
  "Romanya",
  "Ruanda",
  "Rusya",
  "Saint Helena",
  "Saint Kitts ve Nevis",
  "Saint Lucia",
  "Saint Pierre",
  "Samoa",
  "San Marino",
  "Sao Tome",
  "Senegal",
  "Seyşeller",
  "Sırbistan",
  "Sierra Leone",
  "Singapur",
  "Slovakya",
  "Slovenya",
  "Solomon Adaları",
  "Somali",
  "Sri Lanka",
  "Sudan",
  "Surinam",
  "Suriye",
  "Suudi Arabistan",
  "Svalbard",
  "Swaziland",
  "Şili",
  "Tacikistan",
  "Tanzanya",
  "Tayland",
  "Tayvan",
  "Togo",
  "Tokelau",
  "Tonga",
  "Trinidad ve Tobago",
  "Tunus",
  "Turks ve Caicos",
  "Tuvalu",
  "Türkiye",
  "Türkmenistan",
  "Uganda",
  "Ukrayna",
  "Umman",
  "Uruguay",
  "Ürdün",
  "Vanuatu",
  "Vatikan",
  "Venezuela",
  "Vietnam",
  "Wallis ve Futuna",
  "Yemen",
  "Yeni Kaledonya",
  "Yeni Zelanda",
  "Yunanistan",
  "Zambiya",
  "Zimbabve",
];

const sanitizeRadioSettings = (
  data: Partial<RadioSettings> | null | undefined,
): RadioSettings => ({
  radioLink:
    typeof data?.radioLink === "string"
      ? data.radioLink
      : defaultRadioSettings.radioLink,
  radioRequestLink:
    typeof data?.radioRequestLink === "string"
      ? data.radioRequestLink
      : defaultRadioSettings.radioRequestLink,
});

const sanitizeSecuritySettings = (
  data: Partial<SecuritySettings> | null | undefined,
): SecuritySettings => ({
  membersMicrophoneDisabled: Boolean(data?.membersMicrophoneDisabled),
  fakeIpLoginEnabled: Boolean(data?.fakeIpLoginEnabled),
  deviceAndLocationBanEnabled: Boolean(data?.deviceAndLocationBanEnabled),
  guestSystemEnabled: Boolean(data?.guestSystemEnabled),
  guestEntriesEnabled: Boolean(data?.guestEntriesEnabled),
  guestsWritingDisabled: Boolean(data?.guestsWritingDisabled),
  guestsMicrophoneDisabled: Boolean(data?.guestsMicrophoneDisabled),
  countryBlockEnabled: Boolean(data?.countryBlockEnabled),
  blockedCountries: Array.isArray(data?.blockedCountries)
    ? data?.blockedCountries.filter(
        (country): country is string => typeof country === "string",
      )
    : [],
  vpnBlockEnabled: Boolean(data?.vpnBlockEnabled),
});

const getAdminTileSurfaceClass = (bgColor: string, disabled = false) => {
  if (disabled) {
    return "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500 opacity-60";
  }

  const baseSurface =
    "bg-slate-800 text-white border-slate-600/50 hover:bg-slate-700";

  switch (bgColor) {
    case "bg-gray-600":
      return `${baseSurface} hover:border-slate-400`;
    case "bg-green-600":
      return `${baseSurface} border-l-4 border-l-emerald-500 hover:border-emerald-400`;
    case "bg-purple-600":
      return `${baseSurface} border-l-4 border-l-violet-500 hover:border-violet-400`;
    case "bg-blue-600":
      return `${baseSurface} border-l-4 border-l-blue-500 hover:border-blue-400`;
    case "bg-orange-600":
      return `${baseSurface} border-l-4 border-l-orange-500 hover:border-orange-400`;
    case "bg-blue-500":
      return `${baseSurface} border-l-4 border-l-sky-500 hover:border-sky-400`;
    case "bg-red-600":
      return `${baseSurface} border-l-4 border-l-red-500 hover:border-red-400`;
    case "bg-yellow-600":
      return `${baseSurface} border-l-4 border-l-amber-500 hover:border-amber-400`;
    case "bg-pink-600":
      return `${baseSurface} border-l-4 border-l-pink-500 hover:border-pink-400`;
    case "bg-cyan-600":
      return `${baseSurface} border-l-4 border-l-cyan-500 hover:border-cyan-400`;
    case "bg-green-500":
      return `${baseSurface} border-l-4 border-l-lime-500 hover:border-lime-400`;
    case "bg-purple-500":
      return `${baseSurface} border-l-4 border-l-purple-500 hover:border-purple-400`;
    case "bg-slate-600":
      return `${baseSurface} border-l-4 border-l-slate-500 hover:border-slate-400`;
    default:
      return `${baseSurface} border-l-4 border-l-blue-500 hover:border-blue-400`;
  }
};

const AdminCard = ({
  icon,
  label,
  onClick,
  bgColor,
  disabled = false,
  title,
}: AdminCardProps) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`flex min-h-[92px] flex-col items-center justify-center gap-2 rounded-sm border px-2.5 py-3 shadow-sm transition-colors duration-200 sm:min-h-[112px] sm:px-3 sm:py-4 ${getAdminTileSurfaceClass(bgColor, disabled)}`}
  >
    <div
      className={`flex h-8 w-8 items-center justify-center rounded-sm ${bgColor} text-white shadow-sm ring-1 ring-white/20 sm:h-9 sm:w-9`}
    >
      {icon}
    </div>
    <span className="text-center text-[11px] font-semibold leading-snug text-white sm:text-xs">
      {label}
    </span>
  </button>
);

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
  | "webConsole"
  | "securityPreferences";

export const AdminPanelModal = ({
  isOpen,
  onClose,
  initialView,
  initialRoomName,
  socket,
  currentUserStarCount: currentUserStarCountProp = null,
  currentUserPermissions = [],
  currentRolePermissions = null,
  onForbiddenWordsChange,
}: AdminPanelModalProps & {
  initialView?: AdminPanelView | null;
  initialRoomName?: string | null;
  socket?: any | null;
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const [currentView, setCurrentView] = useState<AdminPanelView>("main");
  const [webConsoleView, setWebConsoleView] = useState<
    | "grid"
    | "seo"
    | "welcome"
    | "stats"
    | "root"
    | "systemMessage"
    | "floodBan"
    | "animations"
    | "restore"
    | "siteOwners"
    | "managerList"
  >("grid");
  const initialViewRef = useRef<AdminPanelView | null>(initialView ?? null);

  useEffect(() => {
    initialViewRef.current = initialView ?? null;
  }, [initialView]);

  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [staffUsers, setStaffUsers] = useState<Array<{
    id: number;
    username: string;
    gender: "male" | "female";
    role?: {
      id: number;
      name: string;
      starColor?: string | null;
      starCount?: number | null;
      icon?: string | null;
      permissions?: Record<string, boolean>;
    };
    permissions?: string[];
    flashNick?: string | null;
    accountFrozen?: boolean;
    accountFrozenAt?: string | null;
    accountFrozenByStarCount?: number;
    membershipExpiresAt?: string | null;
    protection?: boolean;
    protectedByStarCount?: number;
    createdAt?: string;
    lastLoginAt?: string | null;
  }> | null>(null);
  const apiClientRef = useRef(getClientApiClient());
  const [staffSearch, setStaffSearch] = useState("");
  const [currentStarCount, setCurrentStarCount] = useState<number | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [currentUserLoaded, setCurrentUserLoaded] = useState(false);
  const isRootAdmin =
    String(currentUsername ?? "")
      .trim()
      .toLocaleLowerCase("tr-TR") === "root";
  const hasShownAdminPanelDeniedRef = useRef(false);
  const canAccessAdminPanel = useMemo(
    () =>
      hasEffectivePermission({
        permissionLabel: PERMISSION_LABELS.ADMIN_PANEL,
        userPermissions: currentUserPermissions,
        rolePermissions: currentRolePermissions,
      }),
    [currentUserPermissions, currentRolePermissions],
  );
  const canViewLoginHistory = useMemo(
    () =>
      hasEffectivePermission({
        permissionLabel: PERMISSION_LABELS.LOGIN_HISTORY,
        userPermissions: currentUserPermissions,
        rolePermissions: currentRolePermissions,
      }),
    [currentUserPermissions, currentRolePermissions],
  );
  const canViewAdminActions = useMemo(
    () =>
      hasEffectivePermission({
        permissionLabel: PERMISSION_LABELS.ADMIN_ACTIONS,
        userPermissions: currentUserPermissions,
        rolePermissions: currentRolePermissions,
      }),
    [currentUserPermissions, currentRolePermissions],
  );
  const canManageRoles = useMemo(
    () =>
      hasEffectivePermission({
        permissionLabel: PERMISSION_LABELS.ROLE_MANAGEMENT,
        userPermissions: currentUserPermissions,
        rolePermissions: currentRolePermissions,
      }),
    [currentUserPermissions, currentRolePermissions],
  );
  const canManageRooms = useMemo(
    () =>
      hasEffectivePermission({
        permissionLabel: PERMISSION_LABELS.ROOM_MANAGEMENT,
        userPermissions: currentUserPermissions,
        rolePermissions: currentRolePermissions,
      }),
    [currentUserPermissions, currentRolePermissions],
  );
  const canEncryptRooms = useMemo(
    () =>
      hasEffectivePermission({
        permissionLabel: PERMISSION_LABELS.ROOM_ENCRYPTION,
        userPermissions: currentUserPermissions,
        rolePermissions: currentRolePermissions,
      }),
    [currentUserPermissions, currentRolePermissions],
  );
  const canDeleteRooms = useMemo(
    () =>
      hasEffectivePermission({
        permissionLabel: PERMISSION_LABELS.ROOM_DELETE,
        userPermissions: currentUserPermissions,
        rolePermissions: currentRolePermissions,
      }),
    [currentUserPermissions, currentRolePermissions],
  );
  const canManageRadio = useMemo(
    () =>
      hasEffectivePermission({
        permissionLabel: PERMISSION_LABELS.RADIO_MANAGEMENT,
        userPermissions: currentUserPermissions,
        rolePermissions: currentRolePermissions,
      }),
    [currentUserPermissions, currentRolePermissions],
  );
  const canManageBots = useMemo(
    () =>
      hasEffectivePermission({
        permissionLabel: PERMISSION_LABELS.BOT_MANAGEMENT,
        userPermissions: currentUserPermissions,
        rolePermissions: currentRolePermissions,
      }),
    [currentUserPermissions, currentRolePermissions],
  );
  const canManageForbiddenNicknames = useMemo(
    () =>
      hasEffectivePermission({
        permissionLabel: PERMISSION_LABELS.NICKNAME_BAN,
        userPermissions: currentUserPermissions,
        rolePermissions: currentRolePermissions,
      }),
    [currentUserPermissions, currentRolePermissions],
  );
  const canManageStaff = useMemo(
    () =>
      hasEffectivePermission({
        permissionLabel: PERMISSION_LABELS.STAFF_MANAGEMENT,
        userPermissions: currentUserPermissions,
        rolePermissions: currentRolePermissions,
      }),
    [currentUserPermissions, currentRolePermissions],
  );
  const canManageMembers = useMemo(
    () =>
      hasEffectivePermission({
        permissionLabel: PERMISSION_LABELS.MEMBER_MANAGEMENT,
        userPermissions: currentUserPermissions,
        rolePermissions: currentRolePermissions,
      }),
    [currentUserPermissions, currentRolePermissions],
  );
  const canDeleteMemberStaff = useMemo(
    () =>
      hasEffectivePermission({
        permissionLabel: PERMISSION_LABELS.MEMBER_STAFF_DELETE,
        userPermissions: currentUserPermissions,
        rolePermissions: currentRolePermissions,
      }),
    [currentUserPermissions, currentRolePermissions],
  );
  const canGrantPermissions = useMemo(
    () =>
      hasEffectivePermission({
        permissionLabel: PERMISSION_LABELS.PERMISSION_GRANT,
        userPermissions: currentUserPermissions,
        rolePermissions: currentRolePermissions,
      }),
    [currentUserPermissions, currentRolePermissions],
  );
  const canUploadFlashNick = useMemo(
    () =>
      hasEffectivePermission({
        permissionLabel: PERMISSION_LABELS.FLASH_NICK_UPLOAD,
        userPermissions: currentUserPermissions,
        rolePermissions: currentRolePermissions,
      }),
    [currentUserPermissions, currentRolePermissions],
  );
  const canViewIp = useMemo(
    () =>
      hasEffectivePermission({
        permissionLabel: PERMISSION_LABELS.IP_VIEW,
        userPermissions: currentUserPermissions,
        rolePermissions: currentRolePermissions,
      }),
    [currentUserPermissions, currentRolePermissions],
  );
  const canManageForbiddenWords = useMemo(
    () =>
      hasEffectivePermission({
        permissionLabel: PERMISSION_LABELS.WORD_BAN,
        userPermissions: currentUserPermissions,
        rolePermissions: currentRolePermissions,
      }),
    [currentUserPermissions, currentRolePermissions],
  );
  const canAccessSiteSettings = useMemo(
    () =>
      hasEffectivePermission({
        permissionLabel: PERMISSION_LABELS.SITE_SETTINGS,
        userPermissions: currentUserPermissions,
        rolePermissions: currentRolePermissions,
      }),
    [currentUserPermissions, currentRolePermissions],
  );
  const canManageBan = useMemo(
    () =>
      hasEffectivePermission({
        permissionLabel: PERMISSION_LABELS.BAN_MANAGEMENT,
        userPermissions: currentUserPermissions,
        rolePermissions: currentRolePermissions,
      }),
    [currentUserPermissions, currentRolePermissions],
  );

  useEffect(() => {
    if (!isOpen) return;
    if (currentView === "loginHistory" && !canViewLoginHistory) {
      toast.error("Giriş kayıtları görüntüleme yetkiniz yok.");
      setCurrentView("main");
      return;
    }
    if (currentView === "adminActions" && !canViewAdminActions) {
      toast.error("Admin hareketlerini görüntüleme yetkiniz yok.");
      setCurrentView("main");
    }
  }, [
    canViewAdminActions,
    canViewLoginHistory,
    currentView,
    isOpen,
    setCurrentView,
  ]);
  useEffect(() => {
    if (!isOpen) return;
    if (currentView === "generalSettings" && !canAccessSiteSettings) {
      toast.error("Genel ayarlar erişim yetkiniz yok.");
      setCurrentView("main");
      return;
    }
    if (currentView === "sistem" && !canAccessSiteSettings) {
      toast.error("Site ayarları yetkiniz yok.");
      setCurrentView("main");
      return;
    }
    if (currentView === "banned" && !canManageBan) {
      toast.error("Banlama yetkiniz yok.");
      setCurrentView("main");
      return;
    }
    if (currentView === "bots" && !canManageBots) {
      toast.error("Bot yönetimi yetkiniz yok.");
      setCurrentView("main");
      return;
    }
  }, [
    canAccessSiteSettings,
    canManageBan,
    canManageBots,
    currentView,
    isOpen,
  ]);
  const [selectedStaff, setSelectedStaff] = useState<{
    id: number;
    username: string;
    gender: "male" | "female";
    role?: {
      id: number;
      name: string;
      starCount?: number | null;
      permissions?: Record<string, boolean>;
    };
    permissions?: string[];
    flashNick?: string | null;
    accountFrozen?: boolean;
    accountFrozenAt?: string | null;
    accountFrozenByStarCount?: number;
    membershipExpiresAt?: string | null;
    protection?: boolean;
    protectedByStarCount?: number;
    createdAt?: string;
    lastLoginAt?: string | null;
  } | null>(null);
  const [membersUsers, setMembersUsers] = useState<Array<{
    id: number;
    username: string;
    gender: "male" | "female";
    isGuest?: boolean;
    role?: {
      id: number;
      name: string;
      starColor?: string | null;
      starCount?: number | null;
      icon?: string | null;
      permissions?: Record<string, boolean>;
    };
    protection?: boolean;
    protectedByStarCount?: number;
    permissions?: string[];
    flashNick?: string | null;
    accountFrozen?: boolean;
    accountFrozenAt?: string | null;
    accountFrozenByStarCount?: number;
    membershipExpiresAt?: string | null;
    createdAt?: string;
    lastLoginAt?: string | null;
  }> | null>(null);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [membersSearch, setMembersSearch] = useState("");
  const [selectedMember, setSelectedMember] = useState<{
    id: number;
    username: string;
    gender: "male" | "female";
    isGuest?: boolean;
    role?: {
      id: number;
      name: string;
      starCount?: number | null;
      permissions?: Record<string, boolean>;
    };
    permissions?: string[];
    flashNick?: string | null;
    accountFrozen?: boolean;
    accountFrozenAt?: string | null;
    accountFrozenByStarCount?: number;
    membershipExpiresAt?: string | null;
    protection?: boolean;
    protectedByStarCount?: number;
    createdAt?: string;
    lastLoginAt?: string | null;
  } | null>(null);
  const [bannedUsers, setBannedUsers] = useState<BannedListItem[] | null>(null);
  const [bannedLoading, setBannedLoading] = useState(false);
  const [bannedError, setBannedError] = useState<string | null>(null);
  const [bannedSearch, setBannedSearch] = useState("");
  const [unbanLoading, setUnbanLoading] = useState<number | null>(null);
  const [roles, setRoles] = useState<Array<
    import("./RolesView").RoleItem
  > | null>(null);
  const [rooms, setRooms] = useState<any[] | null>(null);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<{
    id: number;
    name: string;
    microphoneDuration: number;
    starColor: string | null;
    starCount: number | null;
    icon: string | null;
    permissions?: Record<string, boolean>;
  } | null>(null);
  const sortRoles = (
    items: Array<{
      id: number;
      name: string;
      microphoneDuration: number;
      starColor: string | null;
      starCount: number | null;
      icon: string | null;
    }> = [],
  ) => [...items].sort((a, b) => (a.starCount ?? 0) - (b.starCount ?? 0));
  const sortedRoles = useMemo(() => sortRoles(roles ?? []), [roles]);
  const [blockedWords, setBlockedWords] = useState<Array<{
    id: number;
    forbiddenWord?: string;
    word?: string;
    replacementWord?: string | null;
    replaceWith?: string | null;
    createdBy?: string | null;
  }> | null>(null);
  const [blockedLoading, setBlockedLoading] = useState(false);
  const [blockedError, setBlockedError] = useState<string | null>(null);
  const [blockedCreateOpen, setBlockedCreateOpen] = useState(false);
  const [newForbiddenWord, setNewForbiddenWord] = useState("");
  const [newReplacementWord, setNewReplacementWord] = useState("");
  const [blockedWordsDeleting, setBlockedWordsDeleting] = useState<
    Record<number, boolean>
  >({});
  const [blockedCreateLoading, setBlockedCreateLoading] = useState(false);
  const [blockedCreateError, setBlockedCreateError] = useState<string | null>(
    null,
  );
  const [bots, setBots] = useState<Array<{
    id: number;
    username: string;
    gender: "male" | "female";
    role?: string;
    avatar?: string;
    status?: string;
    room?: string;
    userGif?: string;
    statusMode?: string;
    loginType?: string;
    messagePermission?: string;
    welcomeMessage?: string;
    isAI?: boolean;
    extraInfo?: string;
    fontName?: string;
    granite?: string;
  }> | null>(null);
  const [botsLoading, setBotsLoading] = useState(false);
  const [botsError, setBotsError] = useState<string | null>(null);
  const [botsSearch, setBotsSearch] = useState("");
  const [forbiddenNicknames, setForbiddenNicknames] = useState<
    {
      id: number;
      nickname: string;
      createdBy?: string | null;
      createdById?: number | null;
      createdByUsername?: string | null;
      createdAt?: string | null;
    }[]
  >([]);
  const [forbiddenNicknamesLoading, setForbiddenNicknamesLoading] =
    useState(false);
  const [forbiddenNicknamesError, setForbiddenNicknamesError] = useState<
    string | null
  >(null);
  const [forbiddenNicknamesCreateOpen, setForbiddenNicknamesCreateOpen] =
    useState(false);
  const [newForbiddenNickname, setNewForbiddenNickname] = useState("");
  const [forbiddenNicknamesCreateLoading, setForbiddenNicknamesCreateLoading] =
    useState(false);
  const [forbiddenNicknamesCreateError, setForbiddenNicknamesCreateError] =
    useState<string | null>(null);
  const [forbiddenNicknamesDeleting, setForbiddenNicknamesDeleting] = useState<
    Record<number, boolean>
  >({});
  const [statusModes, setStatusModes] = useState<
    { id: number; name: string }[]
  >([]);
  const [statusModesLoading, setStatusModesLoading] = useState(false);
  const [statusModesError, setStatusModesError] = useState<string | null>(null);
  const [statusModesCreateValue, setStatusModesCreateValue] = useState("");
  const [statusModesCreateLoading, setStatusModesCreateLoading] =
    useState(false);
  const [statusModesCreateError, setStatusModesCreateError] = useState<
    string | null
  >(null);
  const [statusModesCreateVisible, setStatusModesCreateVisible] =
    useState(false);
  const [statusModesEditing, setStatusModesEditing] = useState<{
    id: number | null;
    name: string;
    loading: boolean;
  }>({ id: null, name: "", loading: false });
  const [statusModesDeleting, setStatusModesDeleting] = useState<
    Record<number, boolean>
  >({});
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(
    null,
  );
  const [systemSettingsLoading, setSystemSettingsLoading] = useState(false);
  const [systemSettingsError, setSystemSettingsError] = useState<string | null>(
    null,
  );
  const [systemSettingsSaving, setSystemSettingsSaving] = useState(false);
  const [systemSettingsSaveError, setSystemSettingsSaveError] = useState<
    string | null
  >(null);
  const [systemSettingsSaved, setSystemSettingsSaved] = useState(false);
  const [radioLink, setRadioLink] = useState(defaultRadioSettings.radioLink);
  const [radioRequestLink, setRadioRequestLink] = useState(
    defaultRadioSettings.radioRequestLink,
  );
  const [radioSettingsLoading, setRadioSettingsLoading] = useState(false);
  const [radioSettingsError, setRadioSettingsError] = useState<string | null>(
    null,
  );
  const [radioSettingsSaving, setRadioSettingsSaving] = useState(false);
  const [radioSettingsSaveError, setRadioSettingsSaveError] = useState<
    string | null
  >(null);
  const [radioSettingsFetched, setRadioSettingsFetched] = useState(false);
  const [radioSettingsSaved, setRadioSettingsSaved] = useState(false);
  const [adminActions, setAdminActions] = useState<AdminActionItem[]>([]);
  const [adminActionsLoading, setAdminActionsLoading] = useState(false);
  const [adminActionsError, setAdminActionsError] = useState<string | null>(
    null,
  );
  const [adminActionsSearch, setAdminActionsSearch] = useState("");
  const [adminActionsPage, setAdminActionsPage] = useState(1);
  const [adminActionsLimit, setAdminActionsLimit] = useState(10);
  const [adminActionsTotal, setAdminActionsTotal] = useState(0);
  const [selectedAdminAction, setSelectedAdminAction] =
    useState<AdminActionItem | null>(null);

  // Security Preferences State
  const [securitySettings, setSecuritySettings] = useState<SecuritySettings>(
    defaultSecuritySettings,
  );
  const [securitySettingsLoading, setSecuritySettingsLoading] = useState(false);
  const [securitySettingsError, setSecuritySettingsError] = useState<
    string | null
  >(null);
  const [securitySettingsSaving, setSecuritySettingsSaving] = useState(false);
  const [securitySettingsSaveError, setSecuritySettingsSaveError] = useState<
    string | null
  >(null);
  const [securitySettingsReloadKey, setSecuritySettingsReloadKey] = useState(0);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [countrySearch, setCountrySearch] = useState("");
  const [securitySettingsSaved, setSecuritySettingsSaved] = useState(false);
  const filteredCountryOptions = useMemo(() => {
    const normalizedQuery = countrySearch.trim().toLocaleLowerCase("tr-TR");
    if (!normalizedQuery) return COUNTRY_OPTIONS;
    return COUNTRY_OPTIONS.filter((country) =>
      country.toLocaleLowerCase("tr-TR").includes(normalizedQuery),
    );
  }, [countrySearch]);

  const formatDateTime = (value?: string | null) => {
    if (!value) return "-";
    return new Date(value).toLocaleString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  };

  const syncForbiddenWordsToChat = (
    words: Array<{
      forbiddenWord?: string;
      word?: string;
      replacementWord?: string | null;
      replaceWith?: string | null;
    }>,
  ) => {
    onForbiddenWordsChange?.(
      words
        .map((item) => ({
          forbiddenWord: (item.forbiddenWord || item.word || "").trim(),
          replacementWord: item.replacementWord ?? item.replaceWith ?? null,
        }))
        .filter((item) => item.forbiddenWord.length > 0),
    );
  };

  const getActionTypeStyle = (type: string) => {
    if (type.includes("CREATE") || type.includes("ADD"))
      return "bg-green-100 text-green-700";
    if (type.includes("DELETE") || type.includes("REMOVE"))
      return "bg-red-100 text-red-700";
    if (type.includes("UPDATE")) return "bg-blue-100 text-blue-700";
    return "bg-gray-100 text-gray-700";
  };

  const getActionTypeLabel = (type?: string | null) => {
    if (!type) return "-";
    if (ADMIN_ACTION_TYPE_LABELS[type]) {
      return ADMIN_ACTION_TYPE_LABELS[type];
    }
    return type
      .toLowerCase()
      .split("_")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  };

  const getStatusStyle = (status?: string | null) => {
    if (!status) return "bg-gray-100 text-gray-700";
    const upper = status.toUpperCase();
    if (upper === "COMPLETED" || upper === "SUCCESS")
      return "bg-green-100 text-green-700";
    if (upper === "FAILED" || upper === "ERROR")
      return "bg-red-100 text-red-700";
    if (upper === "PENDING") return "bg-yellow-100 text-yellow-700";
    return "bg-gray-100 text-gray-700";
  };

  const getStatusLabel = (status?: string | null) => {
    if (!status) return "Bilinmiyor";
    const upper = status.toUpperCase();
    if (upper === "COMPLETED" || upper === "SUCCESS") return "Tamamlandı";
    if (upper === "FAILED" || upper === "ERROR") return "Hata";
    if (upper === "PENDING") return "Bekliyor";
    return status
      .toLowerCase()
      .split("_")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  };

  const permissionOptions = [
    { value: "EVERYONE", label: "Herkes" },
    { value: "MEMBERS", label: "Üyeler" },
    { value: "NONE", label: "Kimse" },
  ];

  const defaultSystemSettings: SystemSettings = {
    id: undefined,
    everyoneCanEnter: false,
    desktopLoginEnabled: false,
    mobileLoginEnabled: false,
    guestLoginEnabled: false,
    newRegistrationEnabled: false,
    guestCanWrite: false,
    staffCanChangeNickname: false,
    friendsPrivateMessageMembersOnly: false,
    membersPrivateMessageEnabled: false,
    membersVoiceCallEnabled: false,
    guestPrivateMessageEnabled: false,
    guestVoiceCallEnabled: false,
    firstMessageDelayEnabled: false,
    firstMessageDelaySeconds: 0,
    guestWaitSeconds: 0,
    memberAndGuestMicDurationSeconds: 0,
    siteLanguage: "tr",
    chatImageSendPermission: "EVERYONE",
    chatVoiceSendPermission: "EVERYONE",
    chatVoiceRecordSendPermission: "EVERYONE",
    chatYoutubeSendPermission: "EVERYONE",
    siteName: "",
    siteDescription: "",
    maxUserCount: 0,
    maintenanceMode: false,
    showMicrophonesOnMobile: true,
  };

  const sanitizeSystemSettings = (
    data: Partial<SystemSettings> | null | undefined,
  ): SystemSettings => {
    const merged = { ...defaultSystemSettings, ...data };

    return {
      id: data?.id ?? defaultSystemSettings.id,
      everyoneCanEnter: Boolean(merged.everyoneCanEnter),
      desktopLoginEnabled: Boolean(merged.desktopLoginEnabled),
      mobileLoginEnabled: Boolean(merged.mobileLoginEnabled),
      guestLoginEnabled: Boolean(merged.guestLoginEnabled),
      newRegistrationEnabled: Boolean(merged.newRegistrationEnabled),
      guestCanWrite: Boolean(merged.guestCanWrite),
      staffCanChangeNickname: Boolean(merged.staffCanChangeNickname),
      friendsPrivateMessageMembersOnly: Boolean(
        merged.friendsPrivateMessageMembersOnly,
      ),
      membersPrivateMessageEnabled: Boolean(
        merged.membersPrivateMessageEnabled,
      ),
      membersVoiceCallEnabled: Boolean(merged.membersVoiceCallEnabled),
      guestPrivateMessageEnabled: Boolean(merged.guestPrivateMessageEnabled),
      guestVoiceCallEnabled: Boolean(merged.guestVoiceCallEnabled),
      firstMessageDelayEnabled: Boolean(merged.firstMessageDelayEnabled),
      firstMessageDelaySeconds:
        typeof merged.firstMessageDelaySeconds === "number"
          ? merged.firstMessageDelaySeconds
          : Number(merged.firstMessageDelaySeconds) || 0,
      guestWaitSeconds:
        typeof merged.guestWaitSeconds === "number"
          ? merged.guestWaitSeconds
          : Number(merged.guestWaitSeconds) || 0,
      memberAndGuestMicDurationSeconds:
        typeof merged.memberAndGuestMicDurationSeconds === "number"
          ? merged.memberAndGuestMicDurationSeconds
          : Number(merged.memberAndGuestMicDurationSeconds) || 0,
      siteLanguage: merged.siteLanguage ?? "tr",
      chatImageSendPermission:
        merged.chatImageSendPermission ??
        defaultSystemSettings.chatImageSendPermission,
      chatVoiceSendPermission:
        merged.chatVoiceSendPermission ??
        defaultSystemSettings.chatVoiceSendPermission,
      chatVoiceRecordSendPermission:
        merged.chatVoiceRecordSendPermission ??
        defaultSystemSettings.chatVoiceRecordSendPermission,
      chatYoutubeSendPermission:
        merged.chatYoutubeSendPermission ??
        defaultSystemSettings.chatYoutubeSendPermission,
      siteName: merged.siteName ?? "",
      siteDescription: merged.siteDescription ?? "",
      maxUserCount:
        typeof merged.maxUserCount === "number"
          ? merged.maxUserCount
          : Number(merged.maxUserCount) || 0,
      maintenanceMode: Boolean(merged.maintenanceMode),
      showMicrophonesOnMobile: Boolean(merged.showMicrophonesOnMobile),
    };
  };

  const updateSystemSetting = <K extends keyof SystemSettings>(
    key: K,
    value: SystemSettings[K],
  ) => {
    setSystemSettingsSaved(false);
    setSystemSettings((prev) => (prev ? { ...prev, [key]: value } : prev));

    if (key === "guestCanWrite" && value === true) {
      setSecuritySettings((prev) => ({
        ...prev,
        guestsWritingDisabled: false,
      }));
      setSecuritySettingsSaved(false);
    }
  };

  const updateAndSaveSystemSetting = async <K extends keyof SystemSettings>(
    key: K,
    value: SystemSettings[K],
  ) => {
    if (!systemSettings) return;

    const nextSystemSettings = sanitizeSystemSettings({
      ...systemSettings,
      [key]: value,
    });

    setSystemSettingsSaved(false);
    setSystemSettings(nextSystemSettings);
    setSystemSettingsSaving(true);
    setSystemSettingsSaveError(null);

    try {
      const response = await apiClientRef.current.put<SystemSettings>(
        "/system-settings",
        nextSystemSettings,
      );
      const sanitizedSystemSettings = sanitizeSystemSettings(
        response?.data ?? nextSystemSettings,
      );
      setSystemSettings(sanitizedSystemSettings);

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("chatPermissionsUpdated"));
        window.dispatchEvent(
          new CustomEvent("communicationPermissionsUpdated", {
            detail: {
              communicationPermissions: {
                guestCanWrite: sanitizedSystemSettings.guestCanWrite,
                memberAndGuestMicDurationSeconds:
                  sanitizedSystemSettings.memberAndGuestMicDurationSeconds,
                membersPrivateMessageEnabled:
                  sanitizedSystemSettings.membersPrivateMessageEnabled,
                membersVoiceCallEnabled:
                  sanitizedSystemSettings.membersVoiceCallEnabled,
                guestPrivateMessageEnabled:
                  sanitizedSystemSettings.guestPrivateMessageEnabled,
                guestVoiceCallEnabled:
                  sanitizedSystemSettings.guestVoiceCallEnabled,
                showMicrophonesOnMobile:
                  sanitizedSystemSettings.showMicrophonesOnMobile,
              },
              showMicrophonesOnMobile:
                sanitizedSystemSettings.showMicrophonesOnMobile,
            },
          }),
        );
      }

      setSystemSettingsSaved(true);
    } catch (error: unknown) {
      setSystemSettings(systemSettings);
      setSystemSettingsSaveError(
        (error as { message?: string })?.message ||
          "Sistem ayarları kaydedilemedi.",
      );
    } finally {
      setSystemSettingsSaving(false);
    }
  };

  const saveSystemSettings = async () => {
    if (!systemSettings) return;
    try {
      setSystemSettingsSaved(false);
      setSystemSettingsSaving(true);
      setSystemSettingsSaveError(null);
      const shouldUnlockGuestWriting =
        systemSettings.guestCanWrite && securitySettings.guestsWritingDisabled;
      const response = await apiClientRef.current.put<SystemSettings>(
        "/system-settings",
        systemSettings,
      );
      const sanitizedSystemSettings = sanitizeSystemSettings(
        response?.data ?? systemSettings,
      );
      setSystemSettings(sanitizedSystemSettings);

      if (shouldUnlockGuestWriting) {
        const securityResponse =
          await apiClientRef.current.put<SecuritySettings>(
            "/security-settings",
            {
              ...securitySettings,
              guestsWritingDisabled: false,
              blockedCountries: selectedCountries,
            },
          );
        const sanitizedSecuritySettings = sanitizeSecuritySettings(
          securityResponse?.data ?? {
            ...securitySettings,
            guestsWritingDisabled: false,
            blockedCountries: selectedCountries,
          },
        );
        setSecuritySettings(sanitizedSecuritySettings);
        setSelectedCountries(sanitizedSecuritySettings.blockedCountries ?? []);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("securitySettingsSaved"));
        }
      }

      // Trigger chat permissions update by fetching the latest settings
      try {
        await apiClient.systemSettings.getChatPermissions();

        // Dispatch custom event to notify all chat pages
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("chatPermissionsUpdated"));
          window.dispatchEvent(
            new CustomEvent("communicationPermissionsUpdated", {
              detail: {
                communicationPermissions: {
                  guestCanWrite: sanitizedSystemSettings.guestCanWrite,
                  memberAndGuestMicDurationSeconds:
                    sanitizedSystemSettings.memberAndGuestMicDurationSeconds,
                  membersPrivateMessageEnabled:
                    sanitizedSystemSettings.membersPrivateMessageEnabled,
                  membersVoiceCallEnabled:
                    sanitizedSystemSettings.membersVoiceCallEnabled,
                  guestPrivateMessageEnabled:
                    sanitizedSystemSettings.guestPrivateMessageEnabled,
                  guestVoiceCallEnabled:
                    sanitizedSystemSettings.guestVoiceCallEnabled,
                  showMicrophonesOnMobile:
                    sanitizedSystemSettings.showMicrophonesOnMobile,
                },
                showMicrophonesOnMobile:
                  sanitizedSystemSettings.showMicrophonesOnMobile,
              },
            }),
          );
        }
      } catch (permError) {
        console.error("⚠️ Failed to refresh chat permissions:", permError);
        // Don't fail the entire save if permissions refresh fails
      }
      setSystemSettingsSaved(true);
    } catch (error: unknown) {
      setSystemSettingsSaveError(
        (error as { message?: string })?.message || "Ayarlar kaydedilemedi.",
      );
    } finally {
      setSystemSettingsSaving(false);
    }
  };

  const saveRadioSettings = async () => {
    const payload = sanitizeRadioSettings({ radioLink, radioRequestLink });

    try {
      setRadioSettingsSaved(false);
      setRadioSettingsSaving(true);
      setRadioSettingsSaveError(null);
      setRadioSettingsError(null);
      const response = await apiClientRef.current.put<RadioSettings>(
        "/radio-settings",
        payload,
      );
      const sanitized = sanitizeRadioSettings(response?.data ?? payload);
      setRadioLink(sanitized.radioLink);
      setRadioRequestLink(sanitized.radioRequestLink);
      setRadioSettingsFetched(true);
      setRadioSettingsSaved(true);
      socket?.emit?.("radio-settings:updated");
    } catch (error: unknown) {
      setRadioSettingsSaveError(
        (error as { message?: string })?.message ||
          "Radyo ayarları kaydedilemedi.",
      );
    } finally {
      setRadioSettingsSaving(false);
    }
  };

  const toggleCountrySelection = (country: string) => {
    setSelectedCountries((prev) => {
      const next = prev.includes(country)
        ? prev.filter((c) => c !== country)
        : [...prev, country];
      setSecuritySettings((prevSettings) => ({
        ...prevSettings,
        blockedCountries: next,
      }));
      return next;
    });
  };

  const handleUnbanUser = async (user: BannedListItem) => {
    if (!canManageBan) {
      toast.error("Banlama yetkiniz yok.");
      return;
    }
    try {
      setUnbanLoading(user.id);
      const isIpBan = user.banType === "ip";
      await apiClientRef.current.delete(
        isIpBan
          ? `/moderation/unban-ip/${user.id}`
          : `/moderation/unban/${user.id}`,
      );
      // Ban kaldırıldıktan sonra listeyi yenile
      setBannedUsers(null);
      toast.success(
        isIpBan
          ? `${user.ipAddress || user.username} IP banı başarıyla kaldırıldı.`
          : `${user.username} kullanıcısının banı başarıyla kaldırıldı.`,
      );
    } catch (error: any) {
      console.error("Ban kaldırma hatası:", error);
      toast.error("Ban kaldırma işlemi başarısız oldu. Lütfen tekrar deneyin.");
    } finally {
      setUnbanLoading(null);
    }
  };

  const saveSecuritySettings = async () => {
    try {
      setSecuritySettingsSaved(false);
      setSecuritySettingsSaving(true);
      setSecuritySettingsSaveError(null);
      const shouldDisableGuestWriteInSystem =
        securitySettings.guestsWritingDisabled && systemSettings?.guestCanWrite;
      const payload: SecuritySettings = {
        ...securitySettings,
        blockedCountries: selectedCountries,
      };
      const response = await apiClientRef.current.put<SecuritySettings>(
        "/security-settings",
        payload,
      );
      const sanitized = sanitizeSecuritySettings(response?.data ?? payload);
      setSecuritySettings(sanitized);
      setSelectedCountries(sanitized.blockedCountries ?? []);

      if (shouldDisableGuestWriteInSystem && systemSettings) {
        const nextSystemSettings = {
          ...systemSettings,
          guestCanWrite: false,
        };
        const systemResponse = await apiClientRef.current.put<SystemSettings>(
          "/system-settings",
          nextSystemSettings,
        );
        setSystemSettings(
          sanitizeSystemSettings(systemResponse?.data ?? nextSystemSettings),
        );
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("securitySettingsSaved"));
        window.dispatchEvent(
          new CustomEvent("communicationPermissionsUpdated"),
        );
      }
      setSecuritySettingsSaved(true);
    } catch (error: unknown) {
      setSecuritySettingsSaveError(
        (error as { message?: string })?.message ||
          "Güvenlik tercihleri kaydedilemedi.",
      );
    } finally {
      setSecuritySettingsSaving(false);
    }
  };

  // Reset data when view changes to allow fresh fetches
  useEffect(() => {
    if (currentView !== "staff") {
      setStaffUsers(null);
      setStaffLoading(false);
      setStaffError(null);
    }
    if (currentView !== "members") {
      setMembersUsers(null);
      setMembersLoading(false);
      setMembersError(null);
    }
    if (currentView !== "banned") {
      setBannedUsers(null);
      setBannedLoading(false);
      setBannedError(null);
    }
  }, [currentView]);

  useEffect(() => {
    if (currentView !== "staff") return;

    let cancelled = false;
    const fetchStaff = async () => {
      try {
        setStaffLoading(true);
        setStaffError(null);
        const response = await apiClientRef.current.get("/user/star-users", {
          params: { _ts: Date.now() },
        });
        if (!cancelled) {
          setStaffUsers(response.data ?? []);
        }
      } catch (error: any) {
        if (!cancelled) {
          setStaffError(
            error?.message ||
              "Yetkililer alınırken bir hata oluştu, lütfen tekrar deneyin.",
          );
        }
      } finally {
        if (!cancelled) setStaffLoading(false);
      }
    };

    fetchStaff();

    return () => {
      cancelled = true;
    };
  }, [currentView]);

  useEffect(() => {
    if (currentView !== "members") return;

    let cancelled = false;
    const fetchMembers = async () => {
      try {
        setMembersLoading(true);
        setMembersError(null);
        const response = await apiClientRef.current.get("/user", {
          params: { _ts: Date.now() },
        });
        if (!cancelled) {
          setMembersUsers(response.data ?? []);
        }
      } catch (error: any) {
        if (!cancelled) {
          setMembersError(
            error?.message ||
              "Üyeler alınırken bir hata oluştu, lütfen tekrar deneyin.",
          );
        }
      } finally {
        if (!cancelled) setMembersLoading(false);
      }
    };

    fetchMembers();

    return () => {
      cancelled = true;
    };
  }, [currentView]);

  useEffect(() => {
    if (currentView !== "banned" || bannedUsers || !canManageBan) return;

    let cancelled = false;
    const fetchBanned = async () => {
      try {
        setBannedLoading(true);
        setBannedError(null);
        const response = await apiClientRef.current.get(
          "/moderation/banned-users",
        );
        if (!cancelled) {
          setBannedUsers(response.data?.bannedUsers ?? []);
        }
      } catch (error: any) {
        if (!cancelled) {
          setBannedError(
            error?.message ||
              "Banlı kullanıcılar alınırken bir hata oluştu, lütfen tekrar deneyin.",
          );
        }
      } finally {
        if (!cancelled) setBannedLoading(false);
      }
    };

    fetchBanned();

    return () => {
      cancelled = true;
    };
  }, [currentView, bannedUsers, canManageBan]);

  const filteredBannedUsers = useMemo(() => {
    if (!bannedUsers) return [];
    const query = bannedSearch.trim().toLowerCase();
    if (!query) return bannedUsers;

    return bannedUsers.filter((user) =>
      [
        user.username,
        user.ipAddress,
        user.reason,
        user.source,
        user.bannedByUsername,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [bannedSearch, bannedUsers]);

  const getBanTitle = (user: BannedListItem) =>
    user.banType === "ip" ? user.ipAddress || "IP Ban" : user.username;

  const getBanInitial = (user: BannedListItem) =>
    user.banType === "ip" ? "IP" : user.username?.charAt(0)?.toUpperCase() || "?";

  useEffect(() => {
    if (currentView !== "bots" || !canManageBots) return;
    
    // Fetch fresh roles, rooms, and status modes when bots view is active.
    const fetchData = async () => {
      try {
        const [rolesRes, roomsRes, statusRes] = await Promise.all([
          apiClientRef.current.get("/roles"),
          apiClient.rooms.getRooms(),
          apiClientRef.current.get("/status-modes"),
        ]);
        setRoles(rolesRes.data ?? []);
        setRooms(roomsRes ?? []);
        setStatusModes(statusRes.data ?? []);
      } catch (err) {
        console.error("Error fetching dependencies for bots view:", err);
      }
    };
    fetchData();
  }, [currentView, canManageBots]);

const userGifOptions = [
  { label: "Balon", value: "/usergifler/balon.gif" },
  { label: "Bayrak", value: "/usergifler/bayrak.gif.gif" },
  { label: "Gül", value: "/usergifler/gul.gif" },
  { label: "Kalpler", value: "/usergifler/kalpler.gif" },
  { label: "Kar", value: "/usergifler/kar.gif.gif" },
  { label: "Kelebek", value: "/usergifler/kelebek.gif" },
  { label: "Yangın", value: "/usergifler/yangın.gif" },
  { label: "Buz Çerçeve", value: "/usergifler/yılbasi.gif" },
];

  useEffect(() => {
    if (currentView !== "roles" || roles) return;

    let cancelled = false;
    const fetchRoles = async () => {
      try {
        setRolesLoading(true);
        setRolesError(null);
        const response = await apiClientRef.current.get("/roles");
        if (!cancelled) {
          setRoles(sortRoles(response.data ?? []));
        }
      } catch (error: any) {
        if (!cancelled) {
          setRolesError(
            error?.message ||
              "Rütbeler alınırken bir hata oluştu, lütfen tekrar deneyin.",
          );
        }
      } finally {
        if (!cancelled) setRolesLoading(false);
      }
    };

    fetchRoles();

    return () => {
      cancelled = true;
    };
  }, [currentView, roles]);

  useEffect(() => {
    if (currentView !== "blockedWords" || blockedWords) return;

    let cancelled = false;
    const fetchBlocked = async () => {
      try {
        setBlockedLoading(true);
        setBlockedError(null);
        const response = await apiClientRef.current.get("/forbidden-words");
        if (!cancelled) {
          setBlockedWords(response.data ?? []);
          syncForbiddenWordsToChat(response.data ?? []);
        }
      } catch (error: any) {
        if (!cancelled) {
          setBlockedError(
            error?.message ||
              "Yasaklı kelimeler alınırken bir hata oluştu, lütfen tekrar deneyin.",
          );
        }
      } finally {
        if (!cancelled) setBlockedLoading(false);
      }
    };

    fetchBlocked();

    return () => {
      cancelled = true;
    };
  }, [currentView, blockedWords]);

  useEffect(() => {
    if (currentView !== "bots" || bots || !canManageBots) return;

    let cancelled = false;
    const fetchBots = async () => {
      try {
        setBotsLoading(true);
        setBotsError(null);
        const response = await apiClientRef.current.get("/bot");
        if (!cancelled) {
          setBots(response.data ?? []);
        }
      } catch (error: any) {
        if (!cancelled) {
          setBotsError(
            error?.message ||
              "Botlar alınırken bir hata oluştu, lütfen tekrar deneyin.",
          );
        }
      } finally {
        if (!cancelled) setBotsLoading(false);
      }
    };

    fetchBots();

    return () => {
      cancelled = true;
    };
  }, [currentView, bots, canManageBots]);

  const handleAddBot = async (botData: any) => {
    try {
      const response = await apiClientRef.current.post("/bot", botData);
      const createdBot = response.data ? withImageVersion(response.data) : response.data;
      setBots((current) =>
        createdBot ? [...(current ?? []), createdBot] : current ?? [],
      );
      toast.success("Bot başarıyla eklendi.");
      socket?.emit?.("tenant:getActiveUserCount", {
        tenantId: env.tenantId ? `tenant_${env.tenantId}` : "tenant_master",
      });
    } catch (error: any) {
      toast.error(error?.message || "Bot eklenirken bir hata oluştu.");
      throw error;
    }
  };

  const handleUpdateBot = async (id: number, botData: any) => {
    try {
      const response = await apiClientRef.current.patch(`/bot/${id}`, botData);
      const updatedBot = response.data ? withImageVersion(response.data) : response.data;
      setBots((current) =>
        current?.map((bot) => (bot.id === id ? updatedBot ?? bot : bot)) ??
        (updatedBot ? [updatedBot] : []),
      );
      toast.success("Bot başarıyla güncellendi.");
      socket?.emit?.("tenant:getActiveUserCount", {
        tenantId: env.tenantId ? `tenant_${env.tenantId}` : "tenant_master",
      });
    } catch (error: any) {
      toast.error(error?.message || "Bot güncellenirken bir hata oluştu.");
      throw error;
    }
  };

  const handleDeleteBot = async (id: number) => {
    try {
      await apiClientRef.current.delete(`/bot/${id}`);
      setBots((current) => current?.filter((bot) => bot.id !== id) ?? []);
      toast.success("Bot başarıyla silindi.");
      socket?.emit?.("tenant:getActiveUserCount", {
        tenantId: env.tenantId ? `tenant_${env.tenantId}` : "tenant_master",
      });
    } catch (error: any) {
      toast.error(error?.message || "Bot silinirken bir hata oluştu.");
      throw error;
    }
  };

  useEffect(() => {
    if (currentView !== "forbiddenNicknames") return;

    let cancelled = false;
    const fetchForbiddenNicknames = async () => {
      try {
        setForbiddenNicknamesLoading(true);
        setForbiddenNicknamesError(null);
        const response = await apiClientRef.current.get<
          {
            id: number;
            nickname: string;
            createdBy?: string | null;
            createdById?: number | null;
            createdByUsername?: string | null;
            createdAt?: string | null;
          }[]
        >("/forbidden-nicknames");
        if (!cancelled) {
          setForbiddenNicknames(response?.data ?? []);
        }
      } catch (error: unknown) {
        if (!cancelled) {
          setForbiddenNicknamesError(
            (error as { message?: string })?.message ||
              "Yasak rumuzlar alınırken bir hata oluştu.",
          );
        }
      } finally {
        if (!cancelled) setForbiddenNicknamesLoading(false);
      }
    };

    fetchForbiddenNicknames();

    return () => {
      cancelled = true;
    };
  }, [currentView]);

  useEffect(() => {
    if (currentView !== "adminActions" || !canViewAdminActions) return;

    let cancelled = false;
    const fetchAdminActions = async () => {
      try {
        setAdminActionsLoading(true);
        setAdminActionsError(null);
        const response = await apiClientRef.current.get("/admin-actions", {
          params: {
            page: adminActionsPage,
            limit: adminActionsLimit,
          },
        });

        if (!cancelled) {
          setAdminActions(response?.data?.items ?? []);
          setAdminActionsTotal(response?.data?.total ?? 0);
        }
      } catch (error: any) {
        if (!cancelled) {
          setAdminActionsError(
            error?.message ||
              "Admin hareketleri alınırken bir hata oluştu, lütfen tekrar deneyin.",
          );
        }
      } finally {
        if (!cancelled) setAdminActionsLoading(false);
      }
    };

    fetchAdminActions();

    return () => {
      cancelled = true;
    };
  }, [currentView, adminActionsPage, adminActionsLimit, canViewAdminActions]);

  useEffect(() => {
    if (currentView !== "statusModes") return;

    let cancelled = false;
    const fetchStatusModes = async () => {
      try {
        setStatusModesLoading(true);
        setStatusModesError(null);
        const response =
          await apiClientRef.current.get<{ id: number; name: string }[]>(
            "/status-modes",
          );
        if (!cancelled) setStatusModes(response?.data ?? []);
      } catch (error: unknown) {
        if (!cancelled) {
          setStatusModesError(
            (error as { message?: string })?.message ||
              "Durum modları alınamadı.",
          );
        }
      } finally {
        if (!cancelled) setStatusModesLoading(false);
      }
    };

    fetchStatusModes();

    return () => {
      cancelled = true;
    };
  }, [currentView]);

  useEffect(() => {
    if (currentView !== "sistem" || systemSettings || !canAccessSiteSettings)
      return;

    let cancelled = false;
    const fetchSystemSettings = async () => {
      try {
        setSystemSettingsLoading(true);
        setSystemSettingsError(null);
        const response =
          await apiClientRef.current.get<SystemSettings>("/system-settings");
        if (!cancelled) {
          setSystemSettings(sanitizeSystemSettings(response?.data));
        }
      } catch (error: unknown) {
        if (!cancelled) {
          setSystemSettingsError(
            (error as { message?: string })?.message ||
              "Sistem ayarları alınamadı.",
          );
        }
      } finally {
        if (!cancelled) setSystemSettingsLoading(false);
      }
    };

    fetchSystemSettings();

    return () => {
      cancelled = true;
    };
  }, [currentView, systemSettings, canAccessSiteSettings]);

  useEffect(() => {
    if (currentView !== "radio" || radioSettingsFetched) return;

    let cancelled = false;
    const fetchRadioSettings = async () => {
      try {
        setRadioSettingsLoading(true);
        setRadioSettingsError(null);
        const response =
          await apiClientRef.current.get<RadioSettings>("/radio-settings");
        if (cancelled) return;
        const sanitized = sanitizeRadioSettings(response?.data);
        setRadioLink(sanitized.radioLink);
        setRadioRequestLink(sanitized.radioRequestLink);
        setRadioSettingsFetched(true);
      } catch (error: unknown) {
        if (!cancelled) {
          setRadioSettingsError(
            (error as { message?: string })?.message ||
              "Radyo ayarları alınamadı.",
          );
        }
      } finally {
        if (!cancelled) setRadioSettingsLoading(false);
      }
    };

    fetchRadioSettings();

    return () => {
      cancelled = true;
    };
  }, [currentView, radioSettingsFetched]);

  useEffect(() => {
    if (currentView !== "radio") {
      setRadioSettingsSaved(false);
    }
  }, [currentView]);

  useEffect(() => {
    if (currentView !== "securityPreferences") return;

    let cancelled = false;
    const fetchSecuritySettings = async () => {
      try {
        setSecuritySettingsLoading(true);
        setSecuritySettingsError(null);
        const response =
          await apiClientRef.current.get<SecuritySettings>(
            "/security-settings",
          );
        if (cancelled) return;
        const sanitized = sanitizeSecuritySettings(response?.data);
        setSecuritySettings(sanitized);
        setSelectedCountries(sanitized.blockedCountries ?? []);
      } catch (error: unknown) {
        if (!cancelled) {
          setSecuritySettingsError(
            (error as { message?: string })?.message ||
              "Güvenlik tercihleri alınamadı.",
          );
        }
      } finally {
        if (!cancelled) {
          setSecuritySettingsLoading(false);
        }
      }
    };

    fetchSecuritySettings();

    return () => {
      cancelled = true;
    };
  }, [currentView, securitySettingsReloadKey]);

  useEffect(() => {
    if (typeof currentUserStarCountProp === "number") {
      setCurrentStarCount(currentUserStarCountProp);
    }
  }, [currentUserStarCountProp]);

  useEffect(() => {
    const fetchMe = async () => {
      if (!isOpen) return;
      setCurrentUserLoaded(false);
      try {
        const me = await apiClient.auth.me();
        setCurrentUsername(me?.username ?? null);
        const star = me?.role?.starCount;
        if (
          typeof star === "number" &&
          typeof currentUserStarCountProp !== "number"
        ) {
          setCurrentStarCount(star);
        } else if (typeof currentUserStarCountProp !== "number") {
          setCurrentStarCount(0);
        }
      } catch (error) {
        setCurrentUsername(null);
        if (typeof currentUserStarCountProp !== "number") {
          setCurrentStarCount(0);
        }
      } finally {
        setCurrentUserLoaded(true);
      }
    };

    fetchMe();
  }, [isOpen, currentUserStarCountProp]);

  useEffect(() => {
    if (!isOpen) {
      setCurrentUserLoaded(false);
      setCurrentUsername(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      document.body.style.overflow = "unset";
      return;
    }

    document.body.style.overflow = "hidden";
    const rafId = window.requestAnimationFrame(() => {
      setPosition({ x: 0, y: 0 });
      if (initialView) {
        setCurrentView(initialView);
      } else {
        setCurrentView("main");
      }
      setWebConsoleView("grid");
    });

    return () => {
      window.cancelAnimationFrame(rafId);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, initialView]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (currentView === "sistem" || currentView === "securityPreferences") {
          setCurrentView("generalSettings");
        } else if (currentView === "webConsole" && webConsoleView !== "grid") {
          setWebConsoleView("grid");
        } else if (
          currentView === "generalSettings" ||
          currentView === "loginHistory" ||
          currentView === "rooms" ||
          currentView === "staff" ||
          currentView === "members" ||
          currentView === "banned" ||
          currentView === "roles" ||
          currentView === "blockedWords" ||
          currentView === "bots" ||
          currentView === "forbiddenNicknames" ||
          currentView === "adminActions" ||
          currentView === "radio" ||
          currentView === "webConsole"
        ) {
          setCurrentView("main");
        } else {
          onClose();
        }
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose, currentView, webConsoleView]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && modalRef.current) {
        const modal = modalRef.current;
        const modalRect = modal.getBoundingClientRect();

        // Calculate new position
        let newX = e.clientX - dragStart.x;
        let newY = e.clientY - dragStart.y;

        // Get viewport dimensions
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Calculate modal dimensions (accounting for the transform origin at center)
        const modalWidth = modalRect.width;
        const modalHeight = modalRect.height;

        // Calculate boundaries (keeping modal center within viewport)
        const maxX = (viewportWidth - modalWidth) / 2;
        const minX = -(viewportWidth - modalWidth) / 2;
        const maxY = (viewportHeight - modalHeight) / 2;
        const minY = -(viewportHeight - modalHeight) / 2;

        // Constrain position
        newX = Math.max(minX, Math.min(maxX, newX));
        newY = Math.max(minY, Math.min(maxY, newY));

        setPosition({
          x: newX,
          y: newY,
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);

      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, dragStart]);

  useEffect(() => {
    if (!isOpen) {
      hasShownAdminPanelDeniedRef.current = false;
      return;
    }
    if (canAccessAdminPanel) return;
    if (!hasShownAdminPanelDeniedRef.current) {
      toast.error("Admin paneli erişim yetkiniz yok.");
      hasShownAdminPanelDeniedRef.current = true;
    }
    onClose();
  }, [canAccessAdminPanel, isOpen, onClose]);

  if (!isOpen || !canAccessAdminPanel) return null;

  const adminItems = [
    ...(canAccessSiteSettings
      ? [
          {
            icon: (
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            ),
            label: "Genel Ayarlar",
            bgColor: "bg-gray-600",
            onClick: () => setCurrentView("generalSettings"),
          },
        ]
      : []),
    ...(canViewAdminActions
      ? [
          {
            icon: (
              <svg
                className="w-5 h-5"
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
            ),
            label: "Admin hareketleri",
            bgColor: "bg-green-600",
            onClick: () => setCurrentView("adminActions"),
          },
        ]
      : []),
    ...(canViewLoginHistory
      ? [
          {
            icon: (
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            ),
            label: "Giriş kayıtları",
            bgColor: "bg-purple-600",
            onClick: () => setCurrentView("loginHistory"),
          },
        ]
      : []),
    ...(canManageRooms || canEncryptRooms || canDeleteRooms || canManageRadio
      ? [
          {
            icon: (
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"
                />
              </svg>
            ),
            label: "Odalar",
            bgColor: "bg-blue-600",
            onClick: () => setCurrentView("rooms"),
          },
        ]
      : []),
    ...(canManageStaff
      ? [
          {
            icon: (
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            ),
            label: "Yetkililer",
            bgColor: "bg-orange-600",
            onClick: () => setCurrentView("staff"),
          },
        ]
      : []),
    ...(canManageMembers
      ? [
          {
            icon: (
              <svg
                className="w-5 h-5"
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
            ),
            label: "Üyeler",
            bgColor: "bg-blue-500",
            onClick: () => setCurrentView("members"),
          },
        ]
      : []),
    ...(canManageBan
      ? [
          {
            icon: (
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                />
              </svg>
            ),
            label: "Banlilar",
            bgColor: "bg-red-600",
            onClick: () => setCurrentView("banned"),
          },
        ]
      : []),
    ...(canManageRoles
      ? [
          {
            icon: (
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                />
              </svg>
            ),
            label: "Rütbeler",
            bgColor: "bg-yellow-600",
            onClick: () => setCurrentView("roles"),
          },
        ]
      : []),
    ...(canManageForbiddenWords
      ? [
          {
            icon: (
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
            ),
            label: "Yasak kelimeler",
            bgColor: "bg-pink-600",
            onClick: () => setCurrentView("blockedWords"),
          },
        ]
      : []),
    ...(canManageBots
      ? [
          {
            icon: (
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 12V4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            ),
            label: "Bot kontrol",
            bgColor: "bg-cyan-600",
            onClick: () => setCurrentView("bots"),
          },
        ]
      : []),
    ...(canManageRadio
      ? [
          {
            icon: (
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
            ),
            label: "Radyo ayarları",
            bgColor: "bg-green-500",
            onClick: () => setCurrentView("radio"),
          },
        ]
      : []),
    ...(canManageForbiddenNicknames
      ? [
          {
            icon: (
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                />
              </svg>
            ),
            label: "Yasak nickler",
            bgColor: "bg-purple-500",
            onClick: () => setCurrentView("forbiddenNicknames"),
          },
        ]
      : []),
    ...((currentStarCount !== null && currentStarCount >= 25) || isRootAdmin
      ? [
          {
            icon: (
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                />
              </svg>
            ),
            label: "Web Konsol",
            bgColor: "bg-slate-600",
            onClick: () => setCurrentView("webConsole"),
          },
        ]
      : []),
  ];

  const settingsItems: Array<{
    icon: React.ReactNode;
    label: string;
    bgColor: string;
    onClick: () => void;
    disabled?: boolean;
    title?: string;
  }> = [
    ...(canAccessSiteSettings
      ? [
          {
            icon: (
              <svg
                className="w-7 h-7"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            ),
            label: "Sistem",
            bgColor: "bg-gray-600",
            onClick: () => setCurrentView("sistem"),
          },
        ]
      : []),
    {
      icon: (
        <svg
          className="w-7 h-7"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
          />
        </svg>
      ),
      label: "Durum Modları",
      bgColor: "bg-green-600",
      onClick: () => setCurrentView("statusModes"),
    },
    ...(canAccessSiteSettings
      ? [
          {
            icon: (
              <svg
                className="w-7 h-7"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            ),
            label: "Güvenlik Tercihleri",
            bgColor: "bg-red-600",
            onClick: () => setCurrentView("securityPreferences"),
          },
        ]
      : []),
    {
      icon: (
        <svg
          className="w-7 h-7"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
      label: "Site Bilgileri",
      bgColor: "bg-purple-600",
      onClick: () => undefined,
    },
  ];

  const hasInlineDetailView = Boolean(
    selectedAdminAction || selectedStaff || selectedMember || selectedRole,
  );

  return (
    <div
      ref={modalRef}
      className={`fixed flex flex-col ${
        currentView === "loginHistory"
          ? "w-[90vw] max-w-4xl max-h-[80vh]"
          : hasInlineDetailView
            ? "w-[92vw] max-w-2xl h-[82vh] max-h-[82vh]"
          : currentView === "adminActions"
            ? "w-[90vw] max-w-3xl max-h-[75vh]"
            : currentView === "staff"
              ? "w-[92vw] max-w-2xl h-[74vh] max-h-[74vh] sm:h-[78vh] sm:max-h-[78vh]"
              : currentView === "webConsole"
                ? "w-[94vw] max-w-[590px] h-[58vh] min-h-[320px] sm:h-[500px]"
                : "w-[94vw] max-w-[590px] h-[60vh] sm:h-[500px]"
      } ${
        currentView === "loginHistory" ||
        currentView === "rooms" ||
        currentView === "members" ||
        currentView === "banned" ||
        currentView === "roles" ||
        currentView === "blockedWords" ||
        currentView === "bots" ||
        currentView === "forbiddenNicknames" ||
        currentView === "statusModes" ||
        currentView === "adminActions" ||
        currentView === "radio" ||
        currentView === "securityPreferences" ||
        currentView === "sistem"
          ? "overflow-visible"
          : "overflow-hidden"
      } rounded-none bg-slate-100 shadow-2xl z-[100]`}
      style={{
        top: "50%",
        left: "50%",
        transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))`,
        cursor: isDragging ? "grabbing" : "default",
      }}
    >
      {/* Header */}
      <div
        className="modal-header flex items-center justify-between border-b border-slate-300 bg-slate-100 px-3 py-2 cursor-grab active:cursor-grabbing sm:px-4 sm:py-2.5"
        onMouseDown={handleMouseDown}
      >
        <div className="flex min-w-0 items-center gap-2">
          {(currentView === "generalSettings" ||
            currentView === "sistem" ||
            currentView === "loginHistory" ||
            currentView === "rooms" ||
            currentView === "staff" ||
            currentView === "members" ||
            currentView === "banned" ||
            currentView === "roles" ||
            currentView === "blockedWords" ||
            currentView === "bots" ||
            currentView === "forbiddenNicknames" ||
            currentView === "statusModes" ||
            currentView === "adminActions" ||
            currentView === "radio" ||
            currentView === "webConsole" ||
            currentView === "securityPreferences") && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (
                  currentView === "sistem" ||
                  currentView === "securityPreferences"
                ) {
                  setCurrentView("generalSettings");
                } else if (currentView === "webConsole" && webConsoleView !== "grid") {
                  setWebConsoleView("grid");
                } else {
                  setCurrentView("main");
                }
              }}
              onMouseDown={(e) => e.stopPropagation()}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-200 text-gray-600 transition-colors hover:bg-gray-300 hover:text-gray-800 sm:h-8 sm:w-8"
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
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
          )}
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-600 sm:h-8 sm:w-8">
            <svg
              className="h-4 w-4 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
              />
            </svg>
          </div>
          <h2 className="truncate text-sm font-semibold text-gray-800 sm:text-base">
            {currentView === "main"
              ? "Admin Paneli"
              : currentView === "generalSettings"
                ? "Genel Ayarlar"
                : currentView === "loginHistory"
                  ? "Giriş Kayıtları"
                  : currentView === "rooms"
                    ? "Odalar"
                    : currentView === "staff"
                      ? `Yetkililer (${staffUsers?.length || 0})`
                      : currentView === "members"
                        ? `Üyeler (${membersUsers?.length || 0})`
                        : currentView === "banned"
                          ? `Ban Listesi (${bannedUsers?.length || 0})`
                          : currentView === "roles"
                            ? "Rütbe Listesi"
                            : currentView === "blockedWords"
                              ? "Yasaklı Kelimeler"
                              : currentView === "bots"
                                ? `Bot Listesi (${bots?.length || 0})`
                                : currentView === "forbiddenNicknames"
                                  ? "Yasak Rumuzlar"
                                  : currentView === "statusModes"
                                    ? "Durum Modları"
                                    : currentView === "adminActions"
                                      ? "Admin Hareketleri"
                                      : currentView === "radio"
                                        ? "Radyo Ayarları"
                                        : currentView === "webConsole"
                                          ? "Web Konsol"
                                          : currentView ===
                                              "securityPreferences"
                                            ? "Güvenlik Tercihleri"
                                            : "Sistem Ayarları"}
          </h2>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          onMouseDown={(e) => e.stopPropagation()}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-200 text-gray-600 transition-colors hover:bg-gray-300 hover:text-gray-800 sm:h-8 sm:w-8"
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

      {/* Content */}
      <div
        className={`relative min-h-0 flex-1 bg-[#e8eef5] ${
          currentView === "webConsole" ? "p-2 sm:p-3" : "p-2.5 sm:p-3"
        } ${
          currentView === "rooms" ? "overflow-hidden" : "overflow-y-auto"
        }`}
      >
        {currentView === "main" ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {adminItems.map((item, index) => (
              <AdminCard key={index} {...item} />
            ))}
          </div>
        ) : currentView === "generalSettings" ? (
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            {settingsItems.map((item, index) => (
              <button
                key={index}
                onClick={item.onClick}
                disabled={Boolean(item.disabled)}
                title={item.title}
                className={`flex min-h-[108px] flex-col items-center justify-center gap-2 rounded-sm border px-3 py-3 shadow-sm transition-colors duration-200 sm:min-h-[124px] sm:p-4 ${getAdminTileSurfaceClass(item.bgColor, Boolean(item.disabled))}`}
              >
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-sm ${item.bgColor} text-white shadow-sm ring-1 ring-white/20 sm:h-14 sm:w-14`}
                >
                  {item.icon}
                </div>
                <span className="text-center text-[11px] font-semibold leading-snug text-white sm:text-sm">
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        ) : currentView === "rooms" ? (
          <RoomsView
            initialRoomName={initialRoomName}
            socket={socket}
            canManageRooms={canManageRooms}
            canEncryptRooms={canEncryptRooms}
            canDeleteRooms={canDeleteRooms}
            canManageRadio={canManageRadio}
          />
        ) : currentView === "loginHistory" && canViewLoginHistory ? (
          <LoginHistoryModal
            onBack={() => setCurrentView("main")}
            currentUserStarCount={currentStarCount}
            canViewIp={canViewIp}
          />
        ) : currentView === "adminActions" && canViewAdminActions ? (
          (() => {
            const searchTerm = adminActionsSearch.trim().toLowerCase();
            const filteredAdminActions = adminActions.filter((action) => {
              if (!searchTerm) return true;
              const haystack = [
                action.adminUsername,
                action.targetUsername,
                action.description,
                action.actionType,
                action.status,
                JSON.stringify(action.metadata ?? {}),
              ]
                .join(" ")
                .toLowerCase();
              return haystack.includes(searchTerm);
            });

            const pageCount =
              Math.max(
                1,
                Math.ceil(
                  (adminActionsTotal || filteredAdminActions.length || 1) /
                    adminActionsLimit,
                ),
              ) || 1;

            return (
              <div className="space-y-4 overflow-y-auto pr-1">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="relative w-full md:w-96">
                    <input
                      value={adminActionsSearch}
                      onChange={(e) => setAdminActionsSearch(e.target.value)}
                      placeholder="Kullanıcı Adı, Hedef, İşlem Yada IP Adresi"
                      className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 pl-10 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="absolute left-3 top-2.5 h-4 w-4 text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span>Sayfa başı</span>
                    <select
                      value={adminActionsLimit}
                      onChange={(e) => {
                        setAdminActionsLimit(Number(e.target.value));
                        setAdminActionsPage(1);
                      }}
                      className="rounded-md border border-gray-200 bg-white px-3 py-1 text-sm text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {[10, 20, 50].map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {adminActionsLoading && (
                  <div className="flex items-center justify-center py-6 text-sm text-gray-600">
                    Yükleniyor...
                  </div>
                )}
                {adminActionsError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {adminActionsError}
                  </div>
                )}

                {!adminActionsLoading && !adminActionsError && (
                  <>
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <span className="text-xs font-medium text-gray-500">
                        Toplam{" "}
                        {adminActionsTotal || filteredAdminActions.length} kayıt
                      </span>
                      <span className="text-xs text-gray-500">
                        Sayfa {adminActionsPage}/{pageCount}
                      </span>
                    </div>

                    <div className="hidden grid-cols-[1.2fr_2fr_1.2fr_1.1fr_0.5fr] items-center rounded-lg bg-gray-100 px-4 py-2 text-xs font-semibold text-gray-600 md:grid">
                      <div>Admin</div>
                      <div>İşlem / Kime</div>
                      <div className="text-center">İşlem Detayı</div>
                      <div className="text-center">Tarih</div>
                      <div className="text-right"> </div>
                    </div>

                    {filteredAdminActions.length === 0 && (
                      <div className="flex items-center justify-center rounded-lg border border-gray-100 bg-gray-50 px-4 py-8 text-sm text-gray-500">
                        Kayıt bulunamadı.
                      </div>
                    )}

                    <div className="space-y-3 md:hidden">
                      {filteredAdminActions.map((action) => (
                        <div
                          key={action.id}
                          className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-gray-900">
                                {action.adminUsername || "Bilinmiyor"}
                              </p>
                              <p className="mt-1 text-xs text-gray-500">
                                ID: {action.adminId ?? "-"}
                              </p>
                            </div>
                            <button
                              onClick={() => setSelectedAdminAction(action)}
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm"
                              title="Detay"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-4 w-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                                />
                              </svg>
                            </button>
                          </div>

                          <div className="mt-3 space-y-2 text-xs text-gray-600">
                            <div>
                              <span className="font-semibold text-gray-700">İşlem:</span>{" "}
                              <span className="text-gray-800">
                                {action.description || "-"}
                              </span>
                            </div>
                            <div>
                              <span className="font-semibold text-gray-700">Hedef:</span>{" "}
                              <span className="text-gray-800">
                                {action.targetUsername || "Belirtilmemiş"}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span>Tarih</span>
                              <span className="text-right text-gray-800">
                                {formatDateTime(action.createdAt)}
                              </span>
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <span
                              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getActionTypeStyle(
                                action.actionType || "",
                              )}`}
                            >
                              {getActionTypeLabel(action.actionType)}
                            </span>
                            {action.status && (
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusStyle(
                                  action.status,
                                )}`}
                              >
                                {getStatusLabel(action.status)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {filteredAdminActions.map((action) => (
                      <div
                        key={action.id}
                        className="hidden grid-cols-[1.2fr_2fr_1.2fr_1.1fr_0.5fr] items-center border-b border-gray-100 px-4 py-3 last:border-b-0 md:grid"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-sm font-semibold text-gray-600">
                            {action.adminUsername?.charAt(0)?.toUpperCase() ||
                              "?"}
                          </div>
                          <div className="space-y-0.5">
                            <div className="text-sm font-semibold text-gray-900">
                              {action.adminUsername || "Bilinmiyor"}
                            </div>
                            <div className="text-[11px] text-gray-500">
                              ID: {action.adminId ?? "-"}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="text-sm text-gray-800">
                            {action.description || "-"}
                          </div>
                          <div className="text-xs text-gray-500">
                            Hedef: {action.targetUsername || "Belirtilmemiş"}
                          </div>
                        </div>

                        <div className="flex flex-col items-center gap-1 text-xs">
                          <span
                            className={`inline-flex items-center rounded-full px-3 py-1 font-semibold ${getActionTypeStyle(
                              action.actionType || "",
                            )}`}
                          >
                            {getActionTypeLabel(action.actionType)}
                          </span>
                          {action.status && (
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 font-semibold ${getStatusStyle(
                                action.status,
                              )}`}
                            >
                              {getStatusLabel(action.status)}
                            </span>
                          )}
                        </div>

                        <div className="text-center text-sm text-gray-800">
                          {formatDateTime(action.createdAt)}
                        </div>

                        <div className="flex justify-end">
                          <button
                            onClick={() => setSelectedAdminAction(action)}
                            className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm transition hover:border-blue-200 hover:text-blue-600 hover:shadow"
                            title="Detay"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-4 w-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}

                    {pageCount > 1 && (
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-sm text-gray-700">
                        <div className="text-xs text-gray-500">
                          {(adminActionsPage - 1) * adminActionsLimit + 1}-
                          {Math.min(
                            adminActionsPage * adminActionsLimit,
                            adminActionsTotal || filteredAdminActions.length,
                          )}{" "}
                          arası gösteriliyor
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              setAdminActionsPage((prev) =>
                                Math.max(1, prev - 1),
                              )
                            }
                            disabled={adminActionsPage <= 1}
                            className={`rounded-md px-3 py-1 text-sm font-semibold ${
                              adminActionsPage <= 1
                                ? "cursor-not-allowed bg-gray-100 text-gray-400"
                                : "bg-white text-gray-700 shadow-sm hover:bg-gray-50"
                            }`}
                          >
                            Önceki
                          </button>
                          <button
                            onClick={() =>
                              setAdminActionsPage((prev) =>
                                Math.min(pageCount, prev + 1),
                              )
                            }
                            disabled={adminActionsPage >= pageCount}
                            className={`rounded-md px-3 py-1 text-sm font-semibold ${
                              adminActionsPage >= pageCount
                                ? "cursor-not-allowed bg-gray-100 text-gray-400"
                                : "bg-white text-gray-700 shadow-sm hover:bg-gray-50"
                            }`}
                          >
                            Sonraki
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })()
        ) : currentView === "forbiddenNicknames" ? (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-800">
                  Yasak Rumuzlar
                </h3>
                <p className="text-xs text-gray-500">
                  Yeni rumuz ekleyin veya mevcutları yönetin.
                </p>
              </div>
              <button
                onClick={() => {
                  if (!canManageForbiddenNicknames) return;
                  setForbiddenNicknamesCreateError(null);
                  setNewForbiddenNickname("");
                  setForbiddenNicknamesCreateOpen(true);
                }}
                disabled={!canManageForbiddenNicknames}
                title={
                  canManageForbiddenNicknames
                    ? "Yasak Rumuz Ekle"
                    : "Rumuz yasaklama yetkiniz yok"
                }
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow ${
                  canManageForbiddenNicknames
                    ? "bg-green-600 hover:bg-green-700"
                    : "cursor-not-allowed bg-gray-300"
                }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 6v12m6-6H6"
                  />
                </svg>
                Yasak Rumuz Ekle
              </button>
            </div>

            {forbiddenNicknamesLoading && (
              <div className="flex items-center justify-center rounded-lg border border-gray-100 bg-gray-50 px-4 py-6 text-sm text-gray-600">
                Yükleniyor...
              </div>
            )}
            {forbiddenNicknamesError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {forbiddenNicknamesError}
              </div>
            )}

            {!forbiddenNicknamesLoading && !forbiddenNicknamesError && (
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="space-y-3 p-3 md:hidden">
                  {forbiddenNicknames.length === 0 ? (
                    <div className="flex items-center justify-center rounded-lg bg-gray-50 px-4 py-6 text-sm text-gray-500">
                      Kayıt bulunamadı.
                    </div>
                  ) : (
                    forbiddenNicknames.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-900">
                              {item.nickname}
                            </div>
                            <div className="mt-2 flex flex-col text-xs text-gray-600">
                              <span className="font-medium text-gray-800">
                                {item.createdByUsername || item.createdBy || "-"}
                              </span>
                              {item.createdAt && (
                                <span className="text-[11px] text-gray-500">
                                  {formatDateTime(item.createdAt)}
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            disabled={
                              !canManageForbiddenNicknames ||
                              !!forbiddenNicknamesDeleting[item.id]
                            }
                            title={
                              canManageForbiddenNicknames
                                ? "Sil"
                                : "Rumuz yasaklama yetkiniz yok"
                            }
                            onClick={async () => {
                              if (!canManageForbiddenNicknames) {
                                setForbiddenNicknamesError(
                                  "Rumuz yasaklama yetkiniz yok.",
                                );
                                return;
                              }
                              try {
                                setForbiddenNicknamesDeleting((prev) => ({
                                  ...prev,
                                  [item.id]: true,
                                }));
                                await apiClientRef.current.delete(
                                  `/forbidden-nicknames/${item.id}`,
                                );
                                setForbiddenNicknames((prev) =>
                                  prev.filter((n) => n.id !== item.id),
                                );
                              } catch (error: unknown) {
                                setForbiddenNicknamesError(
                                  (error as { message?: string })?.message ||
                                    "Silme sırasında hata oluştu.",
                                );
                              } finally {
                                setForbiddenNicknamesDeleting((prev) => {
                                  const clone = { ...prev };
                                  delete clone[item.id];
                                  return clone;
                                });
                              }
                            }}
                            className={`rounded-md px-3 py-2 text-xs font-semibold text-white transition ${
                              !canManageForbiddenNicknames
                                ? "cursor-not-allowed bg-gray-300"
                                : forbiddenNicknamesDeleting[item.id]
                                  ? "cursor-not-allowed bg-red-200"
                                  : "bg-red-500 hover:bg-red-600"
                            }`}
                          >
                            Sil
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="hidden grid-cols-[2fr_2fr_1fr] items-center bg-gray-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600 md:grid">
                  <div>Yasaklı Rumuz</div>
                  <div className="text-left">Ekleyen</div>
                  <div className="text-right">İşlem</div>
                </div>
                {forbiddenNicknames.length === 0 ? (
                  <div className="hidden items-center justify-center px-4 py-6 text-sm text-gray-500 md:flex">
                    Kayıt bulunamadı.
                  </div>
                ) : (
                  forbiddenNicknames.map((item) => (
                    <div
                      key={item.id}
                      className="hidden grid-cols-[2fr_2fr_1fr] items-center border-t border-gray-100 px-4 py-3 text-sm text-gray-800 md:grid"
                    >
                      <div className="font-semibold text-gray-900">
                        {item.nickname}
                      </div>
                      <div className="flex flex-col text-gray-600">
                        <span className="font-medium text-gray-800">
                          {item.createdByUsername || item.createdBy || "-"}
                        </span>
                        {item.createdAt && (
                          <span className="text-[11px] text-gray-500">
                            {formatDateTime(item.createdAt)}
                          </span>
                        )}
                      </div>
                      <div className="flex justify-end">
                        <button
                          disabled={
                            !canManageForbiddenNicknames ||
                            !!forbiddenNicknamesDeleting[item.id]
                          }
                          title={
                            canManageForbiddenNicknames
                              ? "Sil"
                              : "Rumuz yasaklama yetkiniz yok"
                          }
                          onClick={async () => {
                            if (!canManageForbiddenNicknames) {
                              setForbiddenNicknamesError(
                                "Rumuz yasaklama yetkiniz yok.",
                              );
                              return;
                            }
                            try {
                              setForbiddenNicknamesDeleting((prev) => ({
                                ...prev,
                                [item.id]: true,
                              }));
                              await apiClientRef.current.delete(
                                `/forbidden-nicknames/${item.id}`,
                              );
                              setForbiddenNicknames((prev) =>
                                prev.filter((n) => n.id !== item.id),
                              );
                            } catch (error: unknown) {
                              setForbiddenNicknamesError(
                                (error as { message?: string })?.message ||
                                  "Silme sırasında hata oluştu.",
                              );
                            } finally {
                              setForbiddenNicknamesDeleting((prev) => {
                                const clone = { ...prev };
                                delete clone[item.id];
                                return clone;
                              });
                            }
                          }}
                          className={`rounded-md px-3 py-1 text-xs font-semibold text-white transition ${
                            !canManageForbiddenNicknames
                              ? "cursor-not-allowed bg-gray-300"
                              : forbiddenNicknamesDeleting[item.id]
                              ? "cursor-not-allowed bg-red-200"
                              : "bg-red-500 hover:bg-red-600"
                          }`}
                        >
                          Sil
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ) : currentView === "staff" ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="relative flex-1">
                <input
                  value={staffSearch}
                  onChange={(e) => setStaffSearch(e.target.value)}
                  placeholder="Yetkili Ara (Rumuz)"
                  className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 pl-10 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="absolute left-3 top-2.5 h-4 w-4 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <div className="shrink-0 text-sm font-bold text-gray-500">
                Toplam: {staffUsers?.length || 0}
              </div>
            </div>

            {staffLoading && (
              <div className="flex items-center justify-center py-6 text-sm text-gray-600">
                Yükleniyor...
              </div>
            )}
            {staffError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {staffError}
              </div>
            )}

            {!staffLoading && !staffError && staffUsers && (
              <>
                <div className="space-y-3 md:hidden">
                  {staffUsers
                    .filter((user) =>
                      staffSearch.trim()
                        ? user.username
                            .toLowerCase()
                            .includes(staffSearch.trim().toLowerCase())
                        : true,
                    )
                    .map((user) => {
                      const targetStar = user.role?.starCount ?? 0;
                      const isProtected =
                        user.protection &&
                        user.protectedByStarCount !== undefined;
                      const canAct =
                        canManageStaff &&
                        currentStarCount !== null &&
                        currentStarCount > targetStar &&
                        (!isProtected ||
                          currentStarCount >= (user.protectedByStarCount || 0));

                      return (
                        <div
                          key={user.id}
                          className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-gray-600">
                                {user.username?.charAt(0)?.toUpperCase() || "?"}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="truncate text-sm font-semibold text-gray-900">
                                    {user.username}
                                  </span>
                                  {user.role?.starCount !== undefined && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-[11px] font-semibold text-yellow-700">
                                      {user.role.starCount}
                                      <span>⭐</span>
                                    </span>
                                  )}
                                </div>
                                <span className="text-xs text-gray-500">
                                  {user.role?.name || ""}
                                </span>
                              </div>
                            </div>
                            <button
                              disabled={!canAct}
                              onClick={() => {
                                if (canAct) setSelectedStaff(user);
                              }}
                              className={`shrink-0 rounded-md px-3 py-2 text-xs font-semibold transition ${
                                canAct
                                  ? "bg-blue-600 text-white hover:bg-blue-700"
                                  : "cursor-not-allowed bg-gray-200 text-gray-400"
                              }`}
                            >
                              İşlem
                            </button>
                          </div>
                          <div className="mt-3 text-xs text-gray-600">
                            Cinsiyet:{" "}
                            <span className="font-medium text-gray-800">
                              {user.gender === "male" ? "Erkek" : "Kadın"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  {staffUsers.filter((user) =>
                    staffSearch.trim()
                      ? user.username
                          .toLowerCase()
                          .includes(staffSearch.trim().toLowerCase())
                      : true,
                  ).length === 0 && (
                    <div className="flex items-center justify-center py-6 text-sm text-gray-500">
                      Sonuç bulunamadı.
                    </div>
                  )}
                </div>

                <div className="hidden overflow-hidden md:block">
                  <div className="w-full">
                    <div className="grid grid-cols-[minmax(0,2.5fr)_minmax(72px,1fr)_84px] items-center rounded-lg bg-gray-100 px-4 py-2 text-xs font-semibold text-gray-600">
                      <div>User</div>
                      <div className="text-center">Cinsiyet</div>
                      <div className="text-right">İşlem</div>
                    </div>
                    <div>
                      {staffUsers
                        .filter((user) =>
                          staffSearch.trim()
                            ? user.username
                                .toLowerCase()
                                .includes(staffSearch.trim().toLowerCase())
                            : true,
                        )
                        .map((user) => (
                          <div
                            key={user.id}
                            className="grid grid-cols-[minmax(0,2.5fr)_minmax(72px,1fr)_84px] items-center border-b border-gray-100 px-4 py-3 last:border-b-0"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-gray-600">
                                {user.username?.charAt(0)?.toUpperCase() || "?"}
                              </div>
                              <div className="flex min-w-0 flex-col">
                                <div className="flex min-w-0 items-center gap-2">
                                  <span className="truncate text-sm font-semibold text-gray-900">
                                    {user.username}
                                  </span>
                                  {user.role?.starCount !== undefined && (
                                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-[11px] font-semibold text-yellow-700">
                                      {user.role.starCount}
                                      <span>⭐</span>
                                    </span>
                                  )}
                                </div>
                                <span className="truncate text-xs text-gray-500">
                                  {user.role?.name || ""}
                                </span>
                              </div>
                            </div>
                            <div className="text-center text-sm text-gray-800">
                              {user.gender === "male" ? "Erkek" : "Kadın"}
                            </div>
                            <div className="flex justify-end">
                              {(() => {
                                const targetStar = user.role?.starCount ?? 0;
                                const isProtected =
                                  user.protection &&
                                  user.protectedByStarCount !== undefined;
                                const canAct =
                                  canManageStaff &&
                                  currentStarCount !== null &&
                                  currentStarCount > targetStar &&
                                  (!isProtected ||
                                    currentStarCount >=
                                      (user.protectedByStarCount || 0));
                                return (
                                  <button
                                    disabled={!canAct}
                                    onClick={() => {
                                      if (canAct) setSelectedStaff(user);
                                    }}
                                    className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                                      canAct
                                        ? "bg-blue-600 text-white hover:bg-blue-700"
                                        : "cursor-not-allowed bg-gray-200 text-gray-400"
                                    }`}
                                    title={
                                      canAct
                                        ? "İşlem yap"
                                        : !canManageStaff
                                          ? "Yetkili yönetimi yetkiniz yok."
                                        : isProtected &&
                                            currentStarCount !== null &&
                                            currentStarCount <
                                              (user.protectedByStarCount || 0)
                                          ? "Bu kullanıcı korunuyor"
                                          : "Daha yüksek yetki gerekiyor"
                                    }
                                  >
                                    İşlem
                                  </button>
                                );
                              })()}
                            </div>
                          </div>
                        ))}
                      {staffUsers.filter((user) =>
                        staffSearch.trim()
                          ? user.username
                              .toLowerCase()
                              .includes(staffSearch.trim().toLowerCase())
                          : true,
                      ).length === 0 && (
                        <div className="flex items-center justify-center py-6 text-sm text-gray-500">
                          Sonuç bulunamadı.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : currentView === "members" ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="relative flex-1">
                <input
                  value={membersSearch}
                  onChange={(e) => setMembersSearch(e.target.value)}
                  placeholder="Üye Ara (Rumuz)"
                  className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 pl-10 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="absolute left-3 top-2.5 h-4 w-4 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <div className="shrink-0 text-sm font-bold text-gray-500">
                Toplam: {membersUsers?.length || 0}
              </div>
            </div>

            {membersLoading && (
              <div className="flex items-center justify-center py-6 text-sm text-gray-600">
                Yükleniyor...
              </div>
            )}
            {membersError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {membersError}
              </div>
            )}

            {!membersLoading && !membersError && membersUsers && (
              <>
                <div className="space-y-3 md:hidden">
                  {membersUsers
                    .filter((user) =>
                      membersSearch.trim()
                        ? user.username
                            .toLowerCase()
                            .includes(membersSearch.trim().toLowerCase())
                        : true,
                    )
                    .map((user) => {
                      const targetStar = user.role?.starCount ?? 0;
                      const isProtected =
                        user.protection &&
                        user.protectedByStarCount !== undefined;
                      const canAct =
                        canManageMembers &&
                        currentStarCount !== null &&
                        currentStarCount > targetStar &&
                        (!isProtected ||
                          currentStarCount >= (user.protectedByStarCount || 0));

                      return (
                        <div
                          key={user.id}
                          className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-gray-600">
                                {user.username?.charAt(0)?.toUpperCase() || "?"}
                              </div>
                              <div className="min-w-0">
                                <span className="block truncate text-sm font-semibold text-gray-900">
                                  {user.username}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {user.isGuest
                                    ? "Misafir"
                                    : formatRoleLabel(user.role?.name)}
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={() => setSelectedMember(user)}
                              disabled={!canAct}
                              className={`shrink-0 rounded-md px-3 py-2 text-xs font-semibold text-white transition ${
                                canAct
                                  ? "bg-green-500 hover:bg-green-600"
                                  : "cursor-not-allowed bg-gray-200 text-gray-400"
                              }`}
                            >
                              Düzenle
                            </button>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600">
                            <div>
                              Cinsiyet:{" "}
                              <span className="font-medium text-gray-800">
                                {user.gender === "male" ? "Erkek" : "Bayan"}
                              </span>
                            </div>
                            <div>
                              Durum: <span className="font-medium text-gray-500">-</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  {membersUsers.filter((user) =>
                    membersSearch.trim()
                      ? user.username
                          .toLowerCase()
                          .includes(membersSearch.trim().toLowerCase())
                      : true,
                  ).length === 0 && (
                    <div className="flex items-center justify-center py-6 text-sm text-gray-500">
                      Sonuç bulunamadı.
                    </div>
                  )}
                </div>

                <div className="hidden grid-cols-[2fr_1fr_1fr_1fr] items-center rounded-lg bg-gray-100 px-4 py-2 text-xs font-semibold text-gray-600 md:grid">
                  <div>User</div>
                  <div className="text-center">Cinsiyet</div>
                  <div className="text-center">Durum</div>
                  <div className="text-right">İşlem</div>
                </div>
                <div className="hidden overflow-y-auto max-h-[calc(100vh-280px)] scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 md:block">
                  {membersUsers
                    .filter((user) =>
                      membersSearch.trim()
                        ? user.username
                            .toLowerCase()
                            .includes(membersSearch.trim().toLowerCase())
                        : true,
                    )
                    .map((user) => (
                      <div
                        key={user.id}
                        className="grid grid-cols-[2fr_1fr_1fr_1fr] items-center border-b border-gray-100 px-4 py-3 last:border-b-0"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-gray-600">
                            {user.username?.charAt(0)?.toUpperCase() || "?"}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-gray-900">
                              {user.username}
                            </span>
                            <span className="text-xs text-gray-500">
                              {user.isGuest
                                ? "Misafir"
                                : formatRoleLabel(user.role?.name)}
                            </span>
                          </div>
                        </div>
                        <div className="text-center text-sm text-gray-800">
                          {user.gender === "male" ? "Erkek" : "Bayan"}
                        </div>
                        <div className="text-center text-sm text-gray-500">
                          -
                        </div>
                        <div className="flex justify-end">
                          {(() => {
                            const targetStar = user.role?.starCount ?? 0;
                            const isProtected =
                              user.protection &&
                              user.protectedByStarCount !== undefined;
                            const canAct =
                              canManageMembers &&
                              currentStarCount !== null &&
                              currentStarCount > targetStar &&
                              (!isProtected ||
                                currentStarCount >=
                                  (user.protectedByStarCount || 0));

                            return (
                              <button
                                onClick={() => setSelectedMember(user)}
                                disabled={!canAct}
                                className={`rounded-md px-3 py-1 text-xs font-semibold text-white transition ${
                                  canAct
                                    ? "bg-green-500 hover:bg-green-600"
                                    : "cursor-not-allowed bg-gray-200 text-gray-400"
                                }`}
                                title={
                                  canAct
                                    ? "Düzenle"
                                    : !canManageMembers
                                      ? "Üye yönetimi yetkiniz yok."
                                    : isProtected &&
                                        currentStarCount !== null &&
                                        currentStarCount <
                                          (user.protectedByStarCount || 0)
                                      ? "Bu kullanıcı korunuyor"
                                      : "Daha yüksek yetki gerekiyor"
                                }
                              >
                                Düzenle
                              </button>
                            );
                          })()}
                        </div>
                      </div>
                    ))}
                  {membersUsers.filter((user) =>
                    membersSearch.trim()
                      ? user.username
                          .toLowerCase()
                          .includes(membersSearch.trim().toLowerCase())
                      : true,
                  ).length === 0 && (
                    <div className="flex items-center justify-center py-6 text-sm text-gray-500">
                      Sonuç bulunamadı.
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        ) : currentView === "banned" ? (
          <div className="space-y-4">
            <div className="relative">
              <input
                value={bannedSearch}
                onChange={(e) => setBannedSearch(e.target.value)}
                placeholder="Banlı kullanıcı ara"
                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 pl-10 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="absolute left-3 top-2.5 h-4 w-4 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>

            {bannedLoading && (
              <div className="flex items-center justify-center py-6 text-sm text-gray-600">
                Yükleniyor...
              </div>
            )}
            {bannedError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {bannedError}
              </div>
            )}

            {!bannedLoading &&
              !bannedError &&
              bannedUsers &&
              bannedUsers.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-6 py-10 text-center text-gray-500">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-200 text-gray-400">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-8 w-8"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M18 6L6 18M6 6l12 12"
                      />
                    </svg>
                  </div>
                  <div className="text-base font-semibold text-gray-700">
                    Ban listesi boş
                  </div>
                  <div className="text-sm text-gray-500">
                    Banlı kullanıcı bulunmuyor
                  </div>
                </div>
              )}

            {!bannedLoading &&
              !bannedError &&
              bannedUsers &&
              bannedUsers.length > 0 && (
                <>
                  <div className="space-y-3 md:hidden">
                    {filteredBannedUsers.map((user) => (
                        <div
                          key={user.id}
                          className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-gray-600">
                                {getBanInitial(user)}
                              </div>
                              <div className="min-w-0">
                                <span className="block truncate text-sm font-semibold text-gray-900">
                                  {getBanTitle(user)}
                                </span>
                                {user.banType === "ip" && user.username && (
                                  <span className="block truncate text-xs text-gray-500">
                                    Hedef: {user.username}
                                  </span>
                                )}
                                <span className="text-xs text-gray-500">
                                  {user.createdAt
                                    ? `Ban tarihi: ${new Date(
                                        user.createdAt,
                                      ).toLocaleDateString()}`
                                    : ""}
                                </span>
                                <span className="mt-1 block text-xs text-gray-500">
                                  Sebep: {user.reason}
                                </span>
                                {user.banType === "ip" && user.source && (
                                  <span className="mt-1 block text-xs text-gray-500">
                                    Kaynak: {user.source}
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => handleUnbanUser(user)}
                              disabled={
                                !canManageBan ||
                                unbanLoading === user.id ||
                                (user.bannedByStarCount ?? 0) >
                                  (currentStarCount ?? 0)
                              }
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title={
                                !canManageBan
                                  ? "Banlama yetkiniz yok."
                                  : (user.bannedByStarCount ?? 0) >
                                      (currentStarCount ?? 0)
                                    ? "Yetkiniz bu banı kaldırmaya yetmiyor"
                                    : "Ban kaldır"
                              }
                            >
                              {unbanLoading === user.id ? (
                                <svg
                                  className="h-4 w-4 animate-spin"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                >
                                  <circle
                                    className="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                  />
                                  <path
                                    className="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                  />
                                </svg>
                              ) : (
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-4 w-4"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                  />
                                </svg>
                              )}
                            </button>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600">
                            <div>
                              Banlayan:{" "}
                              <span className="font-medium text-gray-800">
                                {user.bannedByUsername}
                              </span>
                            </div>
                            <div>
                              Süre:{" "}
                              <span className="font-medium text-gray-800">
                                {user.expiresAt
                                  ? new Date(user.expiresAt).toLocaleDateString()
                                  : "Kalıcı"}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    {filteredBannedUsers.length === 0 && (
                      <div className="flex items-center justify-center py-6 text-sm text-gray-500">
                        Sonuç bulunamadı.
                      </div>
                    )}
                  </div>

                  <div className="hidden grid-cols-[2fr_1fr_1fr_60px] items-center rounded-lg bg-gray-100 px-4 py-2 text-xs font-semibold text-gray-600 md:grid">
                    <div>User</div>
                    <div className="text-center">Banlayan</div>
                    <div className="text-right">Süre</div>
                    <div className="text-center">İşlemler</div>
                  </div>
                  <div className="hidden overflow-y-auto max-h-[calc(100vh-280px)] scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 md:block">
                    {filteredBannedUsers.map((user) => (
                        <div
                          key={user.id}
                          className="grid grid-cols-[2fr_1fr_1fr_60px] items-center border-b border-gray-100 px-4 py-3 last:border-b-0"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-gray-600">
                              {getBanInitial(user)}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-semibold text-gray-900">
                                {getBanTitle(user)}
                              </span>
                              {user.banType === "ip" && user.username && (
                                <span className="text-xs text-gray-500">
                                  Hedef: {user.username}
                                </span>
                              )}
                              <span className="text-xs text-gray-500">
                                {user.createdAt
                                  ? `Ban tarihi: ${new Date(
                                      user.createdAt,
                                    ).toLocaleDateString()}`
                                  : ""}
                              </span>
                              <span className="text-xs text-gray-500">
                                Sebep: {user.reason}
                              </span>
                              {user.banType === "ip" && user.source && (
                                <span className="text-xs text-gray-500">
                                  Kaynak: {user.source}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-center text-sm text-gray-800">
                            {user.bannedByUsername}
                          </div>
                          <div className="text-right text-sm text-gray-800">
                            {user.expiresAt
                              ? new Date(user.expiresAt).toLocaleDateString()
                              : "Kalıcı"}
                          </div>
                          <div className="flex justify-center">
                            <button
                              onClick={() => handleUnbanUser(user)}
                              disabled={
                                !canManageBan ||
                                unbanLoading === user.id ||
                                (user.bannedByStarCount ?? 0) >
                                  (currentStarCount ?? 0)
                              }
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title={
                                !canManageBan
                                  ? "Banlama yetkiniz yok."
                                  : (user.bannedByStarCount ?? 0) >
                                      (currentStarCount ?? 0)
                                    ? "Yetkiniz bu banı kaldırmaya yetmiyor"
                                    : "Ban kaldır"
                              }
                            >
                              {unbanLoading === user.id ? (
                                <svg
                                  className="h-4 w-4 animate-spin"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                >
                                  <circle
                                    className="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                  />
                                  <path
                                    className="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                  />
                                </svg>
                              ) : (
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-4 w-4"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                  />
                                </svg>
                              )}
                            </button>
                          </div>
                        </div>
                      ))}
                    {filteredBannedUsers.length === 0 && (
                      <div className="flex items-center justify-center py-6 text-sm text-gray-500">
                        Sonuç bulunamadı.
                      </div>
                    )}
                  </div>
                </>
              )}
          </div>
        ) : currentView === "roles" ? (
          <div className="space-y-4 overflow-y-auto pr-1">
            {rolesLoading && (
              <div className="flex items-center justify-center py-6 text-sm text-gray-600">
                Yükleniyor...
              </div>
            )}
            {rolesError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {rolesError}
              </div>
            )}

            {!rolesLoading && !rolesError && (
              <RolesView
                roles={sortedRoles}
                loading={rolesLoading}
                error={rolesError}
                currentStarCount={currentStarCount}
                canManageRoles={canManageRoles}
                onSelect={(role) => setSelectedRole(role)}
              />
            )}
          </div>
        ) : currentView === "blockedWords" ? (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={() => {
                  if (!canManageForbiddenWords) {
                    toast.error("Kelime yasaklama yetkiniz yok.");
                    return;
                  }
                  setBlockedCreateError(null);
                  setBlockedCreateOpen(true);
                }}
                disabled={!canManageForbiddenWords}
                title={
                  canManageForbiddenWords
                    ? "Kelime Ekle"
                    : "Kelime yasaklama yetkiniz yok."
                }
                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition ${
                  canManageForbiddenWords
                    ? "bg-emerald-500 hover:bg-emerald-600"
                    : "cursor-not-allowed bg-gray-300"
                }`}
              >
                Kelime Ekle
              </button>
            </div>

            {blockedLoading && (
              <div className="flex items-center justify-center py-6 text-sm text-gray-600">
                Yükleniyor...
              </div>
            )}
            {blockedError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {blockedError}
              </div>
            )}
            {!blockedLoading &&
              !blockedError &&
              blockedWords &&
              blockedWords.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-6 py-10 text-center text-gray-500">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-200 text-gray-400">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-8 w-8"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M18 6L6 18M6 6l12 12"
                      />
                    </svg>
                  </div>
                  <div className="text-base font-semibold text-gray-700">
                    Yasaklı kelime yok
                  </div>
                  <div className="text-sm text-gray-500">
                    Liste şu an boş görünüyor.
                  </div>
                </div>
              )}

            {!blockedLoading &&
              !blockedError &&
              blockedWords &&
              blockedWords.length > 0 && (
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                  <div className="grid grid-cols-[2fr_2fr_1fr_1fr] items-center bg-gray-100 px-4 py-2 text-xs font-semibold text-gray-600">
                    <div>Yasaklı Kelime</div>
                    <div>Eklenen Kelime</div>
                    <div className="text-center">Ekleyen Admin</div>
                    <div className="text-right">İşlem</div>
                  </div>
                  {blockedWords.map((item) => (
                    <div
                      key={item.id}
                      className="grid grid-cols-[2fr_2fr_1fr_1fr] items-center border-t border-gray-100 px-4 py-3 text-sm"
                    >
                      <div className="text-gray-900">
                        {item.forbiddenWord || item.word || "-"}
                      </div>
                      <div className="text-gray-800">
                        {item.replacementWord || item.replaceWith || "-"}
                      </div>
                      <div className="text-center text-gray-700">
                        {typeof item.createdBy === "object"
                          ? ((item as any)?.createdBy?.username ??
                            (item as any)?.createdBy?.name ??
                            "-")
                          : item.createdBy || "-"}
                      </div>
                      <div className="flex justify-end uppercase">
                        <button
                          disabled={
                            !canManageForbiddenWords ||
                            !!blockedWordsDeleting[item.id]
                          }
                          title={
                            canManageForbiddenWords
                              ? "Sil"
                              : "Kelime yasaklama yetkiniz yok."
                          }
                          onClick={async () => {
                            if (!canManageForbiddenWords) {
                              setBlockedError("Kelime yasaklama yetkiniz yok.");
                              return;
                            }
                            if (
                              !confirm(
                                "Bu kelimeyi silmek istediğinizden emin misiniz?",
                              )
                            )
                              return;
                            try {
                              setBlockedWordsDeleting((prev) => ({
                                ...prev,
                                [item.id]: true,
                              }));
                              await apiClientRef.current.delete(
                                `/forbidden-words/${item.id}`,
                              );
                              socket?.emit("forbidden-words:updated", {
                                type: "deleted",
                                forbiddenWordId: item.id,
                              });
                              const next = blockedWords
                                ? blockedWords.filter((w) => w.id !== item.id)
                                : null;
                              setBlockedWords(next);
                              syncForbiddenWordsToChat(next ?? []);
                            } catch (error: any) {
                              setBlockedError(
                                error?.message ||
                                  "Kelime silinirken hata oluştu.",
                              );
                            } finally {
                              setBlockedWordsDeleting((prev) => {
                                const clone = { ...prev };
                                delete clone[item.id];
                                return clone;
                              });
                            }
                          }}
                          className="rounded-md bg-red-500 px-3 py-1 text-xs font-semibold text-white transition hover:bg-red-600 disabled:opacity-50"
                        >
                          {blockedWordsDeleting[item.id]
                            ? "Siliniyor..."
                            : "Sil"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

            {blockedCreateOpen && (
              <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/40">
                <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
                  <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
                    <h3 className="text-base font-semibold text-gray-900">
                      Yasaklı Kelime Ekle
                    </h3>
                    <button
                      onClick={() => setBlockedCreateOpen(false)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-200 text-gray-600 hover:bg-gray-300"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                  <div className="space-y-4 px-5 py-5">
                    {blockedCreateError && (
                      <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {blockedCreateError}
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-700">
                        Yasaklı Kelime
                      </label>
                      <input
                        value={newForbiddenWord}
                        onChange={(e) => setNewForbiddenWord(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-700">
                        Eklenen Kelime
                      </label>
                      <input
                        value={newReplacementWord}
                        onChange={(e) => setNewReplacementWord(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setBlockedCreateOpen(false)}
                        className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-300"
                        disabled={blockedCreateLoading}
                      >
                        Kapat
                      </button>
                      <button
                        onClick={async () => {
                          if (!canManageForbiddenWords) {
                            setBlockedCreateError(
                              "Kelime yasaklama yetkiniz yok.",
                            );
                            return;
                          }
                          if (!newForbiddenWord.trim()) {
                            setBlockedCreateError("Yasaklı kelime zorunlu.");
                            return;
                          }
                          try {
                            setBlockedCreateLoading(true);
                            setBlockedCreateError(null);
                            const payload = {
                              forbiddenWord: newForbiddenWord.trim(),
                              replacementWord:
                                newReplacementWord.trim() || undefined,
                            };
                            const res = await apiClientRef.current.post(
                              "/forbidden-words",
                              payload,
                            );
                            const created = res?.data ?? payload;
                            socket?.emit("forbidden-words:updated", {
                              type: "created",
                              forbiddenWordId: created?.id,
                            });
                            const normalizedCreatedBy =
                              typeof created?.createdBy === "object"
                                ? created.createdBy?.username ||
                                  created.createdBy?.name ||
                                  created.createdBy?.id
                                : created?.createdBy;

                            const nextBlockedWords = [
                              {
                                ...created,
                                createdBy: normalizedCreatedBy,
                              },
                              ...(blockedWords ?? []),
                            ];
                            setBlockedWords(nextBlockedWords);
                            syncForbiddenWordsToChat(nextBlockedWords);
                            setNewForbiddenWord("");
                            setNewReplacementWord("");
                            setBlockedCreateOpen(false);
                          } catch (error: any) {
                            setBlockedCreateError(
                              error?.message ||
                                "Kelime eklenirken bir hata oluştu.",
                            );
                          } finally {
                            setBlockedCreateLoading(false);
                          }
                        }}
                        className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-70"
                        disabled={blockedCreateLoading}
                      >
                        {blockedCreateLoading ? "Kaydediliyor..." : "Kaydet"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : currentView === "bots" ? (
          <BotsView
            bots={bots || []}
            isLoading={botsLoading}
            onAdd={handleAddBot}
            onUpdate={handleUpdateBot}
            onDelete={handleDeleteBot}
            onBack={() => setCurrentView("main")}
            availableRooms={
              rooms
                ?.map((room) => ({
                  label: room.name,
                  value: room.voiceId || room.name,
                }))
                .filter((room): room is { label: string; value: string } => Boolean(room.label && room.value)) || []
            }
            availableRoles={
              sortedRoles
                .filter((role) => (role.starCount ?? 0) <= 24)
                .map((role) => ({
                  id: role.id,
                  name: role.name,
                  starCount: role.starCount,
                  starColor: role.starColor,
                  icon: role.icon,
                }))
            }
            availableStatusModes={statusModes?.map(s => s.name) || []}
            availableUserGifs={userGifOptions}
            availableFonts={CHAT_FONT_OPTIONS.map(f => ({ label: f.label, value: f.fontName }))}
            availableGranites={CHAT_GRANITE_OPTIONS.map(g => ({ label: g.label, value: g.className }))}
          />
        ) : currentView === "webConsole" ? (
          currentUserLoaded ? (
            <WebConsole
              view={webConsoleView}
              onViewChange={setWebConsoleView}
              currentUsername={currentUsername}
            />
          ) : (
            <div className="flex items-center justify-center rounded-lg border border-gray-100 bg-gray-50 px-4 py-6 text-sm text-gray-600">
              Yükleniyor...
            </div>
          )
        ) : currentView === "securityPreferences" ? (
          <div className="space-y-4 overflow-y-auto pr-1">
            {securitySettingsLoading ? (
              <div className="flex items-center justify-center rounded-lg border border-gray-100 bg-gray-50 px-4 py-6 text-sm text-gray-600">
                Yükleniyor...
              </div>
            ) : (
              <>
                {securitySettingsError && (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <span>{securitySettingsError}</span>
                    <button
                      onClick={() =>
                        setSecuritySettingsReloadKey((key) => key + 1)
                      }
                      className="rounded-md bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700"
                    >
                      Tekrar Dene
                    </button>
                  </div>
                )}

                {/* Security Toggles */}
                <div className="space-y-2">
                  {/* Üyeler Mikrofon Alamasınlar */}
                  <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3">
                    <span className="text-sm font-medium text-gray-700">
                      Üyeler Mikrofon Alamasınlar
                    </span>
                    <button
                      onClick={() =>
                        setSecuritySettings((prev) => ({
                          ...prev,
                          membersMicrophoneDisabled:
                            !prev.membersMicrophoneDisabled,
                        }))
                      }
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        securitySettings.membersMicrophoneDisabled
                          ? "bg-blue-600"
                          : "bg-gray-300"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          securitySettings.membersMicrophoneDisabled
                            ? "translate-x-6"
                            : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Sahte IP girişi yapılsın */}
                  <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3">
                    <span className="text-sm font-medium text-gray-700">
                      Sahte IP girişi yapılsın
                    </span>
                    <button
                      onClick={() =>
                        setSecuritySettings((prev) => ({
                          ...prev,
                          fakeIpLoginEnabled: !prev.fakeIpLoginEnabled,
                        }))
                      }
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        securitySettings.fakeIpLoginEnabled
                          ? "bg-blue-600"
                          : "bg-gray-300"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          securitySettings.fakeIpLoginEnabled
                            ? "translate-x-6"
                            : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Cihaz & Konum banlama */}
                  <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3">
                    <span className="text-sm font-medium text-gray-700">
                      Cihaz & Konum banlama
                    </span>
                    <button
                      onClick={() =>
                        setSecuritySettings((prev) => ({
                          ...prev,
                          deviceAndLocationBanEnabled:
                            !prev.deviceAndLocationBanEnabled,
                        }))
                      }
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        securitySettings.deviceAndLocationBanEnabled
                          ? "bg-blue-600"
                          : "bg-gray-300"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          securitySettings.deviceAndLocationBanEnabled
                            ? "translate-x-6"
                            : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Guest Sistemi */}
                  <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3">
                    <span className="text-sm font-medium text-gray-700">
                      Guest Sistemi
                    </span>
                    <button
                      onClick={() =>
                        setSecuritySettings((prev) => ({
                          ...prev,
                          guestSystemEnabled: !prev.guestSystemEnabled,
                        }))
                      }
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        securitySettings.guestSystemEnabled
                          ? "bg-blue-600"
                          : "bg-gray-300"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          securitySettings.guestSystemEnabled
                            ? "translate-x-6"
                            : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Misafir Girişleri */}
                  <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3">
                    <span className="text-sm font-medium text-gray-700">
                      Misafir Girişleri
                    </span>
                    <button
                      onClick={() =>
                        setSecuritySettings((prev) => ({
                          ...prev,
                          guestEntriesEnabled: !prev.guestEntriesEnabled,
                        }))
                      }
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        securitySettings.guestEntriesEnabled
                          ? "bg-blue-600"
                          : "bg-gray-300"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          securitySettings.guestEntriesEnabled
                            ? "translate-x-6"
                            : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Misafirler Yazamasınlar */}
                  <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3">
                    <span className="text-sm font-medium text-gray-700">
                      Misafirler Yazamasınlar
                    </span>
                    <button
                      onClick={() =>
                        setSecuritySettings((prev) => {
                          const nextGuestsWritingDisabled =
                            !prev.guestsWritingDisabled;
                          if (nextGuestsWritingDisabled) {
                            setSystemSettings((prevSystemSettings) =>
                              prevSystemSettings
                                ? {
                                    ...prevSystemSettings,
                                    guestCanWrite: false,
                                  }
                                : prevSystemSettings,
                            );
                            setSystemSettingsSaved(false);
                          }

                          return {
                            ...prev,
                            guestsWritingDisabled: nextGuestsWritingDisabled,
                          };
                        })
                      }
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        securitySettings.guestsWritingDisabled
                          ? "bg-blue-600"
                          : "bg-gray-300"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          securitySettings.guestsWritingDisabled
                            ? "translate-x-6"
                            : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Misafirler Mikrofon Alamasınlar */}
                  <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3">
                    <span className="text-sm font-medium text-gray-700">
                      Misafirler Mikrofon Alamasınlar
                    </span>
                    <button
                      onClick={() =>
                        setSecuritySettings((prev) => ({
                          ...prev,
                          guestsMicrophoneDisabled:
                            !prev.guestsMicrophoneDisabled,
                        }))
                      }
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        securitySettings.guestsMicrophoneDisabled
                          ? "bg-blue-600"
                          : "bg-gray-300"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          securitySettings.guestsMicrophoneDisabled
                            ? "translate-x-6"
                            : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Ülke engel sistemi */}
                  <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3">
                    <span className="text-sm font-medium text-gray-700">
                      Ülke engel sistemi
                    </span>
                    <button
                      onClick={() =>
                        setSecuritySettings((prev) => ({
                          ...prev,
                          countryBlockEnabled: !prev.countryBlockEnabled,
                        }))
                      }
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        securitySettings.countryBlockEnabled
                          ? "bg-blue-600"
                          : "bg-gray-300"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          securitySettings.countryBlockEnabled
                            ? "translate-x-6"
                            : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>

                  {/* VPN/Proxy engel sistemi */}
                  <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-700">
                        VPN/Proxy engel sistemi
                      </span>
                      <span className="text-xs text-gray-400">
                        VPN veya proxy ile giriş yapılmasını engeller
                      </span>
                    </div>
                    <button
                      onClick={() =>
                        setSecuritySettings((prev) => ({
                          ...prev,
                          vpnBlockEnabled: !prev.vpnBlockEnabled,
                        }))
                      }
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        securitySettings.vpnBlockEnabled
                          ? "bg-blue-600"
                          : "bg-gray-300"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          securitySettings.vpnBlockEnabled
                            ? "translate-x-6"
                            : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Country Selection */}
                {securitySettings.countryBlockEnabled && (
                  <div className="rounded-2xl border border-gray-200 bg-white p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-800">
                          Engellenecek Ülkeler
                        </h3>
                        <p className="mt-1 text-xs text-gray-500">
                          {selectedCountries.length} ülke seçildi
                        </p>
                      </div>
                      <div className="w-full sm:max-w-xs">
                        <input
                          type="text"
                          value={countrySearch}
                          onChange={(e) => setCountrySearch(e.target.value)}
                          placeholder="Ülke ara..."
                          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-blue-400 focus:bg-white"
                        />
                      </div>
                    </div>

                    {selectedCountries.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {selectedCountries.slice(0, 6).map((country) => (
                          <button
                            key={`selected-${country}`}
                            onClick={() => toggleCountrySelection(country)}
                            className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-700 transition hover:bg-red-100"
                          >
                            {country} ×
                          </button>
                        ))}
                        {selectedCountries.length > 6 && (
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                            +{selectedCountries.length - 6} ülke daha
                          </span>
                        )}
                      </div>
                    )}

                    <div className="mt-4 max-h-[280px] overflow-y-auto overscroll-contain rounded-2xl border border-gray-100 bg-gray-50/70 p-2 sm:max-h-[320px]">
                      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                        {filteredCountryOptions.map((country) => (
                          <button
                            key={country}
                            onClick={() => toggleCountrySelection(country)}
                            className={`rounded-xl border px-3 py-2 text-xs transition-colors sm:text-sm ${
                              selectedCountries.includes(country)
                                ? "border-red-500 bg-red-50 text-red-700"
                                : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            {country}
                          </button>
                        ))}
                      </div>
                      {filteredCountryOptions.length === 0 && (
                        <div className="flex min-h-[120px] items-center justify-center text-center text-sm text-gray-500">
                          Aramanıza uygun ülke bulunamadı.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {securitySettingsSaveError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
                    {securitySettingsSaveError}
                  </div>
                )}
                {securitySettingsSaved && !securitySettingsSaveError && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
                    Ayarlar kaydedildi.
                  </div>
                )}

                {/* Save Button */}
                <div className="flex justify-end pt-2">
                  <button
                    onClick={saveSecuritySettings}
                    disabled={securitySettingsSaving}
                    className={`rounded-lg px-6 py-2.5 text-sm font-semibold text-white shadow ${
                      securitySettingsSaving
                        ? "cursor-not-allowed bg-blue-300"
                        : "bg-blue-600 hover:bg-blue-700"
                    }`}
                  >
                    {securitySettingsSaving
                      ? "Kaydediliyor..."
                      : "Ayarları Kaydet"}
                  </button>
                </div>
              </>
            )}
          </div>
        ) : currentView === "statusModes" ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 rounded-xl bg-white px-2 py-1">
              <h3 className="text-sm font-semibold text-gray-800">
                Durum Modları
              </h3>
              <button
                onClick={() => {
                  setStatusModesCreateVisible((prev) => !prev);
                  setStatusModesCreateError(null);
                  if (statusModesCreateVisible) {
                    setStatusModesCreateValue("");
                    setStatusModesCreateLoading(false);
                  }
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-600"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 6v12m6-6H6"
                  />
                </svg>
                Yeni Durum Ekle
              </button>
            </div>

            {statusModesCreateVisible && (
              <div className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3 md:flex-row md:items-center">
                <div className="flex-1">
                  <input
                    value={statusModesCreateValue}
                    onChange={(e) => setStatusModesCreateValue(e.target.value)}
                    placeholder="Yeni durum modu girin..."
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      if (!statusModesCreateValue.trim()) {
                        setStatusModesCreateError("Durum modu boş olamaz.");
                        return;
                      }
                      try {
                        setStatusModesCreateLoading(true);
                        setStatusModesCreateError(null);
                        const res = await apiClientRef.current.post(
                          "/status-modes",
                          { name: statusModesCreateValue.trim() },
                        );
                        const created: { id?: number; name?: string } =
                          res?.data ?? {};
                        setStatusModes((prev) => [
                          ...prev,
                          {
                            id: created.id ?? Date.now(),
                            name: created.name ?? statusModesCreateValue.trim(),
                          },
                        ]);
                        setStatusModesCreateValue("");
                        setStatusModesCreateVisible(false);
                      } catch (error: unknown) {
                        setStatusModesCreateError(
                          (error as { message?: string })?.message ||
                            "Durum modu eklenemedi.",
                        );
                      } finally {
                        setStatusModesCreateLoading(false);
                      }
                    }}
                    disabled={statusModesCreateLoading}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${
                      statusModesCreateLoading
                        ? "bg-emerald-300 cursor-not-allowed"
                        : "bg-emerald-500 hover:bg-emerald-600"
                    }`}
                  >
                    {statusModesCreateLoading ? "Ekleniyor..." : "Ekle"}
                  </button>
                  <button
                    onClick={() => {
                      setStatusModesCreateValue("");
                      setStatusModesCreateError(null);
                      setStatusModesCreateVisible(false);
                    }}
                    className="rounded-lg bg-gray-500 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-600"
                  >
                    İptal
                  </button>
                </div>
              </div>
            )}

            {statusModesCreateError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {statusModesCreateError}
              </div>
            )}

            {statusModesLoading && (
              <div className="flex items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-6 text-sm text-gray-600">
                Yükleniyor...
              </div>
            )}
            {statusModesError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {statusModesError}
              </div>
            )}

            {!statusModesLoading && !statusModesError && (
              <div className="space-y-2">
                {statusModes.length === 0 && (
                  <div className="flex items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-500">
                    Durum modu bulunamadı.
                  </div>
                )}
                {statusModes.map((item) => {
                  const isEditing = statusModesEditing.id === item.id;
                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm"
                    >
                      {isEditing ? (
                        <input
                          value={statusModesEditing.name}
                          onChange={(e) =>
                            setStatusModesEditing((prev) => ({
                              ...prev,
                              name: e.target.value,
                            }))
                          }
                          className="flex-1 rounded-lg border border-blue-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                        />
                      ) : (
                        <span className="flex-1 text-sm font-semibold text-gray-800">
                          {item.name}
                        </span>
                      )}

                      <div className="flex items-center gap-2">
                        {isEditing ? (
                          <>
                            <button
                              disabled={statusModesEditing.loading}
                              onClick={async () => {
                                if (!statusModesEditing.name.trim()) {
                                  setStatusModesError("Durum modu boş olamaz.");
                                  return;
                                }
                                try {
                                  setStatusModesEditing((prev) => ({
                                    ...prev,
                                    loading: true,
                                  }));
                                  await apiClientRef.current.put(
                                    `/status-modes/${item.id}`,
                                    { name: statusModesEditing.name.trim() },
                                  );
                                  setStatusModes((prev) =>
                                    prev.map((m) =>
                                      m.id === item.id
                                        ? {
                                            ...m,
                                            name: statusModesEditing.name.trim(),
                                          }
                                        : m,
                                    ),
                                  );
                                  setStatusModesEditing({
                                    id: null,
                                    name: "",
                                    loading: false,
                                  });
                                } catch (error: unknown) {
                                  setStatusModesError(
                                    (error as { message?: string })?.message ||
                                      "Güncelleme başarısız.",
                                  );
                                } finally {
                                  setStatusModesEditing((prev) => ({
                                    ...prev,
                                    loading: false,
                                  }));
                                }
                              }}
                              className={`rounded-lg px-3 py-2 text-xs font-semibold text-white ${
                                statusModesEditing.loading
                                  ? "bg-blue-300 cursor-not-allowed"
                                  : "bg-blue-600 hover:bg-blue-700"
                              }`}
                            >
                              Kaydet
                            </button>
                            <button
                              onClick={() =>
                                setStatusModesEditing({
                                  id: null,
                                  name: "",
                                  loading: false,
                                })
                              }
                              className="rounded-lg bg-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-300"
                            >
                              İptal
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() =>
                                setStatusModesEditing({
                                  id: item.id,
                                  name: item.name,
                                  loading: false,
                                })
                              }
                              className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-gray-700 shadow hover:bg-gray-50"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-4 w-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L7.5 21H3v-4.5L16.732 3.732z"
                                />
                              </svg>
                            </button>
                            <button
                              disabled={!!statusModesDeleting[item.id]}
                              onClick={async () => {
                                try {
                                  setStatusModesDeleting((prev) => ({
                                    ...prev,
                                    [item.id]: true,
                                  }));
                                  await apiClientRef.current.delete(
                                    `/status-modes/${item.id}`,
                                  );
                                  setStatusModes((prev) =>
                                    prev.filter((m) => m.id !== item.id),
                                  );
                                } catch (error: unknown) {
                                  setStatusModesError(
                                    (error as { message?: string })?.message ||
                                      "Silinirken hata oluştu.",
                                  );
                                } finally {
                                  setStatusModesDeleting((prev) => {
                                    const clone = { ...prev };
                                    delete clone[item.id];
                                    return clone;
                                  });
                                }
                              }}
                              className={`flex h-9 w-9 items-center justify-center rounded-lg text-white shadow ${
                                statusModesDeleting[item.id]
                                  ? "bg-red-200 cursor-not-allowed"
                                  : "bg-red-500 hover:bg-red-600"
                              }`}
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-4 w-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3m-4 0h14"
                                />
                              </svg>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : currentView === "radio" ? (
          <div className="space-y-5">
            {radioSettingsLoading && (
              <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                Radyo ayarları yükleniyor...
              </div>
            )}
            {(radioSettingsError || radioSettingsSaveError) && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {radioSettingsError || radioSettingsSaveError}
              </div>
            )}
            {radioSettingsSaved && !radioSettingsSaveError && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                Radyo ayarları kaydedildi.
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">
                Radio link
              </label>
              <input
                value={radioLink}
                disabled={radioSettingsLoading || radioSettingsSaving}
                onChange={(e) => setRadioLink(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">
                Radio istek link
              </label>
              <input
                value={radioRequestLink}
                disabled={radioSettingsLoading || radioSettingsSaving}
                onChange={(e) => setRadioRequestLink(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <button
              onClick={saveRadioSettings}
              disabled={radioSettingsSaving || radioSettingsLoading}
              className={`w-full rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 ${
                radioSettingsSaving || radioSettingsLoading
                  ? "opacity-70 cursor-not-allowed"
                  : ""
              }`}
            >
              {radioSettingsSaving ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {systemSettingsLoading && (
              <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-4 text-sm text-gray-600">
                Sistem ayarları yükleniyor...
              </div>
            )}
            {systemSettingsError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {systemSettingsError}
              </div>
            )}
            {!systemSettingsLoading &&
              !systemSettingsError &&
              !systemSettings && (
                <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-4 text-sm text-gray-600">
                  Sistem ayarları bulunamadı.
                </div>
              )}
            {systemSettings && (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  {[
                    { key: "everyoneCanEnter", label: "Herkes girebilir" },
                    {
                      key: "desktopLoginEnabled",
                      label: "Masaüstü tarayıcı girişleri",
                    },
                    {
                      key: "mobileLoginEnabled",
                      label: "Mobil tarayıcı girişleri",
                    },
                    { key: "guestLoginEnabled", label: "Misafir girişi" },
                    {
                      key: "newRegistrationEnabled",
                      label: "Siteye yeni kayıt",
                    },
                    { key: "guestCanWrite", label: "Misafir yazabilir" },
                    {
                      key: "staffCanChangeNickname",
                      label: "Yetkililer rumuz değiştirebilir",
                    },
                    {
                      key: "friendsPrivateMessageMembersOnly",
                      label: "Arkadaşlar özel mesaj (sadece üyeler)",
                    },
                    {
                      key: "membersPrivateMessageEnabled",
                      label: "Üyeler özel mesaj",
                    },
                    {
                      key: "membersVoiceCallEnabled",
                      label: "Üyeler sesli arama",
                    },
                    {
                      key: "guestPrivateMessageEnabled",
                      label: "Misafir özel mesaj",
                    },
                    {
                      key: "guestVoiceCallEnabled",
                      label: "Misafir sesli arama",
                    },
                    {
                      key: "firstMessageDelayEnabled",
                      label: "İlk mesaj süresi aktif",
                    },
                    { key: "maintenanceMode", label: "Bakım modu" },
                    {
                      key: "showMicrophonesOnMobile",
                      label: "Mikrofonlar Odada Görünsün (Sadece Mobil)",
                    },
                  ].map((item) => {
                    const key = item.key as keyof SystemSettings;
                    const active = Boolean(systemSettings[key]);
                    return (
                      <div
                        key={item.key}
                        className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3"
                      >
                        <span className="text-sm font-medium text-gray-700">
                          {item.label}
                        </span>
                        <button
                          onClick={() => {
                            const nextValue = !active as SystemSettings[typeof key];
                            if (
                              item.key === "showMicrophonesOnMobile" ||
                              item.key === "everyoneCanEnter" ||
                              item.key === "desktopLoginEnabled" ||
                              item.key === "mobileLoginEnabled" ||
                              item.key === "guestLoginEnabled"
                            ) {
                              void updateAndSaveSystemSetting(key, nextValue);
                              return;
                            }
                            updateSystemSetting(key, nextValue);
                          }}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            active ? "bg-green-600" : "bg-gray-300"
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              active ? "translate-x-5" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Misafir bekleme (sn)
                    </label>
                    <input
                      type="number"
                      value={systemSettings.guestWaitSeconds}
                      onChange={(e) =>
                        updateSystemSetting(
                          "guestWaitSeconds",
                          Number(e.target.value) || 0,
                        )
                      }
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      İlk mesaj gecikmesi (sn)
                    </label>
                    <input
                      type="number"
                      value={systemSettings.firstMessageDelaySeconds}
                      onChange={(e) =>
                        updateSystemSetting(
                          "firstMessageDelaySeconds",
                          Number(e.target.value) || 0,
                        )
                      }
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Üye/Misafir mikrofon süresi (dk)
                    </label>
                    <input
                      type="number"
                      value={systemSettings.memberAndGuestMicDurationSeconds}
                      onChange={(e) =>
                        updateSystemSetting(
                          "memberAndGuestMicDurationSeconds",
                          Number(e.target.value) || 0,
                        )
                      }
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Site dili
                    </label>
                    <select
                      value={systemSettings.siteLanguage}
                      onChange={(e) =>
                        updateSystemSetting("siteLanguage", e.target.value)
                      }
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    >
                      <option value="tr">Türkçe</option>
                      <option value="en">English</option>
                      <option value="ar">العربية</option>
                    </select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Sohbet Resim Gönderme
                    </label>
                    <select
                      value={systemSettings.chatImageSendPermission}
                      onChange={(e) =>
                        updateSystemSetting(
                          "chatImageSendPermission",
                          e.target.value,
                        )
                      }
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    >
                      {permissionOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Sohbet Ses Gönderme
                    </label>
                    <select
                      value={systemSettings.chatVoiceSendPermission}
                      onChange={(e) =>
                        updateSystemSetting(
                          "chatVoiceSendPermission",
                          e.target.value,
                        )
                      }
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    >
                      {permissionOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Ses Kaydı Gönderme
                    </label>
                    <select
                      value={systemSettings.chatVoiceRecordSendPermission}
                      onChange={(e) =>
                        updateSystemSetting(
                          "chatVoiceRecordSendPermission",
                          e.target.value,
                        )
                      }
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    >
                      {permissionOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Youtube Video Gönderme
                    </label>
                    <select
                      value={systemSettings.chatYoutubeSendPermission}
                      onChange={(e) =>
                        updateSystemSetting(
                          "chatYoutubeSendPermission",
                          e.target.value,
                        )
                      }
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    >
                      {permissionOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {systemSettingsSaveError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {systemSettingsSaveError}
                  </div>
                )}
                {systemSettingsSaved && !systemSettingsSaveError && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                    Ayarlar kaydedildi.
                  </div>
                )}

                <button
                  onClick={saveSystemSettings}
                  disabled={systemSettingsSaving}
                  className={`w-full py-3 px-4 font-semibold text-white rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 ${
                    systemSettingsSaving
                      ? "bg-blue-300 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  {systemSettingsSaving ? "Kaydediliyor..." : "Ayarları Kaydet"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {forbiddenNicknamesCreateOpen && (
        <CreateForbiddenNicknameModal
          onClose={() => setForbiddenNicknamesCreateOpen(false)}
          newNickname={newForbiddenNickname}
          setNewNickname={setNewForbiddenNickname}
          loading={forbiddenNicknamesCreateLoading}
          error={forbiddenNicknamesCreateError}
          onSave={async () => {
            if (!canManageForbiddenNicknames) {
              setForbiddenNicknamesCreateError(
                "Rumuz yasaklama yetkiniz yok.",
              );
              return;
            }
            if (!newForbiddenNickname.trim()) {
              setForbiddenNicknamesCreateError("Rumuz boş olamaz.");
              return;
            }
            try {
              setForbiddenNicknamesCreateLoading(true);
              setForbiddenNicknamesCreateError(null);
              await apiClientRef.current.post("/forbidden-nicknames", {
                nickname: newForbiddenNickname.trim(),
              });
              const response = await apiClientRef.current.get<
                {
                  id: number;
                  nickname: string;
                  createdBy?: string | null;
                  createdById?: number | null;
                  createdByUsername?: string | null;
                  createdAt?: string | null;
                }[]
              >("/forbidden-nicknames");
              setForbiddenNicknames(response?.data ?? []);
              setForbiddenNicknamesCreateOpen(false);
              setNewForbiddenNickname("");
            } catch (error: unknown) {
              setForbiddenNicknamesCreateError(
                (error as { message?: string })?.message ||
                  "Yeni rumuz eklenemedi.",
              );
            } finally {
              setForbiddenNicknamesCreateLoading(false);
            }
          }}
        />
      )}
      {selectedAdminAction && (
        <AdminActionDetailModal
          action={selectedAdminAction}
          onClose={() => setSelectedAdminAction(null)}
          formatDateTime={formatDateTime}
          getActionTypeStyle={getActionTypeStyle}
          getActionTypeLabel={getActionTypeLabel}
          getStatusStyle={getStatusStyle}
          getStatusLabel={getStatusLabel}
          inline={true}
        />
      )}
      {selectedStaff && (
        <StaffEditModal
          user={selectedStaff}
          currentStarCount={currentStarCount}
          canGrantPermissions={canGrantPermissions}
          canDeleteMemberStaff={canDeleteMemberStaff}
          canUploadFlashNick={canUploadFlashNick}
          inline={true}
          onClose={() => setSelectedStaff(null)}
          onUpdated={async () => {
            const response = await apiClientRef.current.get("/user/star-users", {
              params: { _ts: Date.now() },
            });
            setStaffUsers(response.data ?? []);
          }}
        />
      )}
      {selectedMember && (
        <StaffEditModal
          user={selectedMember}
          currentStarCount={currentStarCount}
          canGrantPermissions={canGrantPermissions}
          canDeleteMemberStaff={canDeleteMemberStaff}
          canUploadFlashNick={canUploadFlashNick}
          inline={true}
          onClose={() => setSelectedMember(null)}
          onUpdated={async () => {
            const response = await apiClientRef.current.get("/user", {
              params: { _ts: Date.now() },
            });
            setMembersUsers(response.data ?? []);
          }}
        />
      )}
      {selectedRole && (
        <RoleEditModal
          role={selectedRole}
          currentStarCount={currentStarCount}
          socket={socket}
          inline={true}
          apiClient={apiClientRef.current}
          onUpdated={(updated) => {
            setRoles((prev) =>
              prev
                ? sortRoles(
                    prev.map((r) => (r.id === updated.id ? updated : r)),
                  )
                : prev,
            );
          }}
          onClose={() => setSelectedRole(null)}
        />
      )}
    </div>
  );
};
const AdminActionDetailModal = ({
  action,
  onClose,
  formatDateTime,
  getActionTypeStyle,
  getActionTypeLabel,
  getStatusStyle,
  getStatusLabel,
  inline = false,
}: {
  action: AdminActionItem;
  onClose: () => void;
  formatDateTime: (value?: string | null) => string;
  getActionTypeStyle: (type: string) => string;
  getActionTypeLabel: (type?: string | null) => string;
  getStatusStyle: (status?: string | null) => string;
  getStatusLabel: (status?: string | null) => string;
  inline?: boolean;
}) => {
  return (
    <div className={inline ? "absolute inset-0 z-[120] flex flex-col bg-white" : "fixed inset-0 z-200 flex items-center justify-center bg-black/40 px-4 py-6"}>
      <div className={inline ? "flex h-full w-full flex-col overflow-hidden bg-white" : "max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl"}>
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 sm:px-5 sm:py-4">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 11c1.657 0 3-1.567 3-3.5S13.657 4 12 4 9 5.567 9 7.5 10.343 11 12 11z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5.5 21a6.5 6.5 0 0113 0"
                />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-gray-900">
                İşlem Detayı
              </div>
              <div className="truncate text-xs text-gray-500">
                ID: {action.id} · {formatDateTime(action.createdAt)}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition hover:bg-gray-200"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className={`${inline ? "flex-1" : "max-h-[calc(90vh-72px)]"} grid gap-3 overflow-y-auto overscroll-contain bg-gray-50 p-3 sm:p-4`}>
          <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm sm:p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </span>
              Admin Bilgileri
            </div>
            <div className="mt-3 space-y-1 text-sm text-gray-700">
              <div className="font-semibold text-gray-900">
                {action.adminUsername || "Bilinmiyor"}
              </div>
              <div className="text-xs text-gray-500">
                Admin ID: {action.adminId ?? "-"}
              </div>
              <div className="text-xs text-gray-500">
                İşlem Tarihi: {formatDateTime(action.createdAt)}
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 font-semibold ${getActionTypeStyle(
                    action.actionType || "",
                  )}`}
                >
                  {getActionTypeLabel(action.actionType)}
                </span>
                {action.status && (
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 font-semibold ${getStatusStyle(
                      action.status,
                    )}`}
                  >
                  {getStatusLabel(action.status)}
                  </span>
                )}
                <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 font-semibold text-gray-600">
                  İşlem ID: {action.id}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm sm:p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-50 text-green-600">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </span>
              İşlem Detayları
            </div>
            <div className="mt-3 space-y-2 text-sm text-gray-700">
              <div className="text-gray-900">{action.description || "-"}</div>
              <div className="pt-1 text-gray-900">
                Hedef Kullanıcı: {action.targetUsername || "Belirtilmemiş"}
              </div>
              <div className="text-xs text-gray-500">
                Özet:{" "}
                {action.targetUsername
                  ? `${action.targetUsername} için işlem uygulanmıştır.`
                  : "Belirli bir hedef kullanıcı bulunmamaktadır."}
              </div>

              {action.metadata && Object.keys(action.metadata).length > 0 && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 11c0 1.657-1.567 3-3.5 3S5 12.657 5 11 6.567 8 8.5 8 12 9.343 12 11z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3 21v-2a4 4 0 014-4h2"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 11a3 3 0 013-3h1.5A2.5 2.5 0 0119 10.5V21"
                        />
                      </svg>
                    </span>
                    Hedef Verileri
                  </div>
                  {Object.entries(action.metadata).map(([key, value]) => (
                    <div
                      key={key}
                      className="flex flex-col gap-1 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-700 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <span className="font-semibold text-gray-800">{key}</span>
                      <span className="text-gray-600 sm:max-w-[60%] sm:text-right">
                        {typeof value === "object"
                          ? JSON.stringify(value)
                          : String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const CreateForbiddenNicknameModal = ({
  onClose,
  newNickname,
  setNewNickname,
  loading,
  error,
  onSave,
}: {
  onClose: () => void;
  newNickname: string;
  setNewNickname: (val: string) => void;
  loading: boolean;
  error: string | null;
  onSave: () => Promise<void>;
}) => {
  return (
    <div className="fixed inset-0 z-220 flex items-center justify-center bg-black/40 px-4 py-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            Yasak Rumuz Ekle
          </h3>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition hover:bg-gray-200"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">
              Yasaklanacak Rumuz
            </label>
            <input
              value={newNickname}
              onChange={(e) => setNewNickname(e.target.value)}
              placeholder="örn: kötü_rumuz"
              className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            İptal
          </button>
          <button
            onClick={onSave}
            disabled={loading}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${
              loading
                ? "bg-blue-300 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {loading ? "Ekleniyor..." : "Ekle"}
          </button>
        </div>
      </div>
    </div>
  );
};

const ADMIN_PERMISSION_LABELS = [
  "Özel Mesaj Atma",
  "Siteden Atma Yetkisi",
  "İp Görme Yetkisi",
  "Toplantı Yetkisi",
  "Admin Paneli",
  "Üye Yönetimi",
  "Rütbe Yönetimi",
  "Admin Hareketleri",
  "Özel Arama",
  "Mikrofon Engelle Yetkisi",
  "Genel Atma",
  "Gizli Rumuz Giriş",
  "Oda Yönetimi",
  "Bot Yönetimi",
  "Yetki Verebilir",
  "Geçici Operatörlük Verme",
  "Engel Yetkisi",
  "Kamera Engelle Yetkisi",
  "Çatı Girişi",
  "User İşleme",
  "Oda Yazılarını Sil",
  "Hikaye Silme",
  "Flash Nick Yükleme",
  "Oda Silme",
  "Oda Şifreleme",
  "Yetkili Yönetimi",
  "Üye ve Yetkili Silme",
  "Rumuz Yasaklama",
  "Kelime Yasaklama",
  "Radyo Yönetimi",
  "Giriş Kayıtları",
  "Site Ayarları",
  "Mikrofon Daveti",
  "Giriş efekti seçebilir",
  "Banlama",
  "Sistem resetleme",
] as const;

const normalizePermissionLabel = (value: string): string => {
  const normalized = value.trim();
  if (normalized === "User İşlama") {
    return "User İşleme";
  }
  return normalized;
};

const normalizePermissionList = (permissions: string[]): string[] => {
  return Array.from(
    new Set(permissions.map((item) => normalizePermissionLabel(item))),
  );
};

const normalizePermissionMap = (
  permissions: Record<string, boolean> | undefined,
): Record<string, boolean> => {
  const map: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(permissions ?? {})) {
    map[normalizePermissionLabel(key)] = Boolean(value);
  }
  return map;
};

const StaffEditModal = ({
  user,
  currentStarCount,
  canGrantPermissions,
  canDeleteMemberStaff,
  canUploadFlashNick,
  inline = false,
  onClose,
  onUpdated,
}: {
  user: {
    id: number;
    username: string;
    gender: "male" | "female";
    role?: {
      id: number;
      name: string;
      starCount?: number | null;
      permissions?: Record<string, boolean>;
    };
    permissions?: string[];
    flashNick?: string | null;
    accountFrozen?: boolean;
    accountFrozenAt?: string | null;
    accountFrozenByStarCount?: number;
    membershipExpiresAt?: string | null;
    protection?: boolean;
    protectedByStarCount?: number;
    createdAt?: string;
    lastLoginAt?: string | null;
  };
  currentStarCount: number | null;
  canGrantPermissions: boolean;
  canDeleteMemberStaff: boolean;
  canUploadFlashNick: boolean;
  inline?: boolean;
  onClose: () => void;
  onUpdated?: () => Promise<void>;
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const flashNickInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const apiClientRef = useRef(getClientApiClient());
  const [resolvedUser, setResolvedUser] = useState(user);

  // Parse existing membershipExpiresAt if exists
  const existingDate = resolvedUser.membershipExpiresAt
    ? new Date(resolvedUser.membershipExpiresAt)
    : null;

  const [formData, setFormData] = useState({
    username: resolvedUser.username,
    password: "",
    gender: resolvedUser.gender,
    roleId: resolvedUser.role?.id || null,
    protection: resolvedUser.protection || false,
    permissions: normalizePermissionList(resolvedUser.permissions || []),
    flashNick: resolvedUser.flashNick ?? null,
    accountFrozen: resolvedUser.accountFrozen === true,
  });
  const [membershipDay, setMembershipDay] = useState(
    existingDate ? existingDate.getDate().toString() : "1",
  );
  const [membershipMonth, setMembershipMonth] = useState(
    existingDate ? (existingDate.getMonth() + 1).toString() : "1",
  );
  const [membershipYear, setMembershipYear] = useState(
    existingDate
      ? existingDate.getFullYear().toString()
      : new Date().getFullYear().toString(),
  );

  const isProtected =
    resolvedUser.protection && resolvedUser.protectedByStarCount !== undefined;
  const cannotTouch =
    isProtected &&
    currentStarCount !== null &&
    currentStarCount < (resolvedUser.protectedByStarCount || 0);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [availableRoles, setAvailableRoles] = useState<
    Array<{
      id: number;
      name: string;
      starCount: number;
      icon: string | null;
      permissions?: Record<string, boolean>;
    }>
  >([]);
  const [permissionsTouched, setPermissionsTouched] = useState(false);
  const [isLoadingRoles, setIsLoadingRoles] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [flashNickTouched, setFlashNickTouched] = useState(false);
  const [accountFrozenTouched, setAccountFrozenTouched] = useState(false);
  const [showUnlockAccountAction, setShowUnlockAccountAction] = useState(false);

  const getPermissionsFromRole = (roleId: number | null): string[] | null => {
    if (!roleId) {
      return [];
    }
    const selectedRole = availableRoles.find((item) => item.id === roleId);
    if (!selectedRole?.permissions) {
      return null;
    }
    return normalizePermissionList(
      Object.entries(selectedRole.permissions)
        .filter(([, enabled]) => enabled === true)
        .map(([key]) => key),
    );
  };

  const getInitialPermissions = (
    nextUser: typeof user,
    nextAvailableRoles: typeof availableRoles,
  ): string[] => {
    const explicitPermissions = normalizePermissionList(
      nextUser.permissions || [],
    );
    if (explicitPermissions.length > 0) {
      return explicitPermissions;
    }

    const rolePermissionsFromUser = normalizePermissionMap(
      nextUser.role?.permissions,
    );
    const rolePermissionsFromUserList = normalizePermissionList(
      Object.entries(rolePermissionsFromUser)
        .filter(([, enabled]) => enabled === true)
        .map(([key]) => key),
    );
    if (rolePermissionsFromUserList.length > 0) {
      return rolePermissionsFromUserList;
    }

    const selectedRole = nextAvailableRoles.find(
      (item) => item.id === nextUser.role?.id,
    );
    if (!selectedRole?.permissions) {
      return [];
    }

    return normalizePermissionList(
      Object.entries(selectedRole.permissions)
        .filter(([, enabled]) => enabled === true)
        .map(([key]) => key),
    );
  };

  useEffect(() => {
    setResolvedUser(user);
  }, [user]);

  const areSamePermissions = (a: string[], b: string[]): boolean => {
    const normalizedA = normalizePermissionList(a);
    const normalizedB = normalizePermissionList(b);
    if (normalizedA.length !== normalizedB.length) return false;
    const left = [...normalizedA].sort();
    const right = [...normalizedB].sort();
    return left.every((item, index) => item === right[index]);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setSaveError(null);

      const payload: any = {
        username: formData.username,
        gender: formData.gender,
      };

      if (formData.password) {
        payload.password = formData.password;
      }

      if (
        formData.roleId &&
        formData.roleId !== (resolvedUser.role?.id ?? null)
      ) {
        payload.roleId = formData.roleId;
      }

      payload.protection = formData.protection;

      // Combine date parts into ISO string
      if (membershipDay && membershipMonth && membershipYear) {
        const dateStr = `${membershipYear}-${membershipMonth.padStart(
          2,
          "0",
        )}-${membershipDay.padStart(2, "0")}T00:00:00.000Z`;
        payload.membershipExpiresAt = dateStr;
      }

      if (permissionsTouched && canGrantPermissions) {
        payload.permissions = normalizePermissionList(formData.permissions);
      }

      if (flashNickTouched && canUploadFlashNick) {
        payload.flashNick = formData.flashNick;
      }

      if (accountFrozenTouched) {
        payload.accountFrozen = formData.accountFrozen;
      }

      await apiClientRef.current.patch(`/user/${user.id}/manage`, payload);

      if (onUpdated) {
        await onUpdated();
      }

      onClose();
    } catch (error: any) {
      setSaveError(
        error?.message || "Kullanıcı güncellenirken bir hata oluştu.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!canDeleteMemberStaff) {
      setSaveError("Üye ve yetkili silme yetkiniz yok.");
      setShowDeleteConfirm(false);
      return;
    }
    try {
      setIsDeleting(true);
      await apiClientRef.current.delete(`/user/${user.id}`);

      if (onUpdated) {
        await onUpdated();
      }

      setShowDeleteConfirm(false);
      onClose();
    } catch (error: any) {
      setSaveError(error?.message || "Kullanıcı silinirken bir hata oluştu.");
      setShowDeleteConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!modalRef.current) return;
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  // Fetch available roles
  useEffect(() => {
    const refreshedDate = resolvedUser.membershipExpiresAt
      ? new Date(resolvedUser.membershipExpiresAt)
      : null;
    setFormData({
      username: resolvedUser.username,
      password: "",
      gender: resolvedUser.gender,
      roleId: resolvedUser.role?.id || null,
      protection: resolvedUser.protection || false,
      permissions: getInitialPermissions(resolvedUser, availableRoles),
      flashNick: resolvedUser.flashNick ?? null,
      accountFrozen: resolvedUser.accountFrozen === true,
    });
    setMembershipDay(refreshedDate ? refreshedDate.getDate().toString() : "1");
    setMembershipMonth(
      refreshedDate ? (refreshedDate.getMonth() + 1).toString() : "1",
    );
    setMembershipYear(
      refreshedDate
        ? refreshedDate.getFullYear().toString()
        : new Date().getFullYear().toString(),
    );
    setPermissionsTouched(false);
    setFlashNickTouched(false);
    setAccountFrozenTouched(false);
    setSaveError(null);
  }, [
    availableRoles,
    resolvedUser.id,
    resolvedUser.username,
    resolvedUser.gender,
    resolvedUser.role?.id,
    resolvedUser.permissions,
    resolvedUser.role?.permissions,
    resolvedUser.flashNick,
    resolvedUser.accountFrozen,
    resolvedUser.membershipExpiresAt,
    resolvedUser.protection,
  ]);

  useEffect(() => {
    let cancelled = false;

    const hydrateUser = async () => {
      try {
        const response = await apiClientRef.current.get(`/user/${user.id}`, {
          params: { _ts: Date.now() },
        });
        if (cancelled) return;
        setResolvedUser(response?.data ?? user);
      } catch (error) {
        console.error("Failed to hydrate user detail:", error);
        if (!cancelled) {
          setResolvedUser(user);
        }
      }
    };

    hydrateUser();

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        setIsLoadingRoles(true);
        const response = await apiClientRef.current.get("/roles/lower-than-me");
        setAvailableRoles(response.data || []);
      } catch (error) {
        console.error("Failed to fetch roles:", error);
        setAvailableRoles([]);
      } finally {
        setIsLoadingRoles(false);
      }
    };
    fetchRoles();
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !modalRef.current) return;
      const modalRect = modalRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let newX = e.clientX - dragStart.x;
      let newY = e.clientY - dragStart.y;

      const maxX = (viewportWidth - modalRect.width) / 2;
      const minX = -maxX;
      const maxY = (viewportHeight - modalRect.height) / 2;
      const minY = -maxY;

      newX = Math.max(minX, Math.min(maxX, newX));
      newY = Math.max(minY, Math.min(maxY, newY));

      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragStart]);

  const handleFlashNickFileSelect = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
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
      setFlashNickTouched(true);
      setFormData((prev) => ({
        ...prev,
        flashNick: dataUrl,
      }));
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const handleRemoveFlashNick = () => {
    setFlashNickTouched(true);
    setFormData((prev) => ({
      ...prev,
      flashNick: null,
    }));
  };

  const handleUnlockAccount = () => {
    setAccountFrozenTouched(true);
    setShowUnlockAccountAction(false);
    setFormData((prev) => ({
      ...prev,
      accountFrozen: false,
    }));
  };

  return (
    <div className={inline ? "absolute inset-0 z-[100] flex flex-col bg-white" : "pointer-events-none fixed inset-0 z-200 flex items-start justify-center px-4 py-6"}>
      <div
        ref={modalRef}
        className={inline ? "flex h-full w-full flex-col overflow-hidden bg-white" : "pointer-events-auto w-full max-w-xl overflow-hidden rounded-xl bg-white shadow-2xl"}
        style={inline ? {} : {
          top: "50%",
          left: "50%",
          transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))`,
          position: "fixed",
          cursor: isDragging ? "grabbing" : "default",
          maxHeight: "90vh",
        }}
      >
        <div
          className="flex items-center justify-between bg-slate-900 px-3 py-3 text-white cursor-grab active:cursor-grabbing sm:px-4"
          onMouseDown={handleMouseDown}
        >
          <div className="flex min-w-0 items-center gap-2">
            <button
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <h3 className="truncate text-base font-semibold sm:text-lg">
              {resolvedUser.username} Düzenleme
            </h3>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M6.28 5.22a.75.75 0 011.06 0L10 7.94l2.66-2.72a.75.75 0 111.06 1.06L11.06 9l2.66 2.72a.75.75 0 11-1.06 1.06L10 10.06l-2.66 2.72a.75.75 0 11-1.06-1.06L8.94 9 6.28 6.28a.75.75 0 010-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        <div
          className={`${inline ? "flex min-h-0 flex-1 overflow-y-auto overscroll-contain bg-slate-50 py-4" : "space-y-3 overflow-y-auto overscroll-contain bg-slate-50 py-3 sm:space-y-4 sm:py-4"} px-3 sm:px-4`}
          style={inline ? {} : { maxHeight: "80vh" }}
        >
          <div className="w-full space-y-3 sm:space-y-4">
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm sm:gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-200 text-xl font-semibold text-gray-600">
              {resolvedUser.username?.charAt(0)?.toUpperCase() || "?"}
            </div>
            <div className="space-y-0.5 text-sm text-gray-700">
              <p className="font-semibold text-gray-900">
                {resolvedUser.username}
              </p>
              <p>
                Rol:{" "}
                {availableRoles.find((r) => r.id === formData.roleId)?.name ||
                  resolvedUser.role?.name ||
                  "Belirtilmemiş"}
              </p>
              <p>
                Yıldız:{" "}
                {availableRoles.find((r) => r.id === formData.roleId)
                  ?.starCount ??
                  resolvedUser.role?.starCount ??
                  0}
              </p>
            </div>
            <div className="ml-auto w-full sm:w-auto">
              <button className="w-full rounded-lg bg-red-500 px-3 py-2 text-xs font-semibold text-white hover:bg-red-600 sm:w-auto">
                Resmi Sil
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-4 md:gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600">
                Rumuz
              </label>
              <input
                value={formData.username}
                onChange={(e) =>
                  setFormData({ ...formData, username: e.target.value })
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600">
                Şifre
              </label>
              <input
                type="password"
                placeholder="Şifresi (değiştirmek için doldur)"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600">
                Cinsiyet
              </label>
              <select
                value={formData.gender}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    gender: e.target.value as "male" | "female",
                  })
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                <option value="male">Erkek</option>
                <option value="female">Kadın</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600">
                Koruma
              </label>
              <select
                value={formData.protection ? "true" : "false"}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    protection: e.target.value === "true",
                  })
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                <option value="false">Hayır</option>
                <option value="true">Evet</option>
              </select>
            </div>
            </div>

            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3 md:gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600">
                Yetki
              </label>
              <select
                value={formData.roleId || ""}
                onChange={(e) => {
                  const nextRoleId = e.target.value ? Number(e.target.value) : null;
                  if (permissionsTouched) {
                    setFormData((prev) => ({ ...prev, roleId: nextRoleId }));
                    return;
                  }

                  setFormData((prev) => ({
                    ...prev,
                    roleId: nextRoleId,
                    permissions:
                      getPermissionsFromRole(nextRoleId) ?? prev.permissions,
                  }));
                }}
                disabled={isLoadingRoles || !canGrantPermissions}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-50"
              >
                <option value="">Rol Seçiniz</option>
                {availableRoles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name} ({role.starCount} ⭐)
                  </option>
                ))}
              </select>
              {!canGrantPermissions && (
                <p className="text-[11px] font-medium text-amber-700">
                  Yetki verebilir izniniz olmadığı için rol değişikliği
                  yapamazsınız.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600">
                Flash
              </label>
              <div className="relative">
                <input
                  ref={flashNickInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/gif"
                  className="hidden"
                  onChange={handleFlashNickFileSelect}
                />
                <button
                  type="button"
                  disabled={!canUploadFlashNick || cannotTouch}
                  onClick={() => flashNickInputRef.current?.click()}
                  className="flex h-[48px] w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-4 pr-24 text-left transition hover:border-blue-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <div className="min-w-0">
                    <span className="block truncate text-sm text-gray-900">
                      {formData.flashNick ? "Flash Yüklü" : "-Flash Yok-"}
                    </span>
                  </div>
                  <div className="ml-3 flex items-center gap-2">
                    {formData.flashNick && (
                      <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded border border-gray-200 bg-white">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={formData.flashNick}
                          alt="Flash nick önizleme"
                          className="h-full w-full object-contain"
                        />
                      </span>
                    )}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 shrink-0 text-gray-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </button>

                <button
                  type="button"
                  disabled={!canUploadFlashNick || !formData.flashNick || cannotTouch}
                  onClick={handleRemoveFlashNick}
                  className="absolute right-2 top-1/2 h-9 -translate-y-1/2 rounded-md bg-slate-200 px-3 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Kaldır
                </button>
              </div>
              {!canUploadFlashNick && (
                <p className="text-[11px] font-medium text-amber-700">
                  Flash nick yükleme yetkiniz olmadığı için bu alanı kullanamazsınız.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600">
                Hesap Kilidi
              </label>
              <div className="relative">
                <button
                  type="button"
                  disabled={!formData.accountFrozen}
                  onClick={() =>
                    setShowUnlockAccountAction((current) => !current)
                  }
                  className="flex h-[48px] w-full items-center justify-between gap-3 rounded-lg border border-gray-300 bg-white px-3 py-2 text-left transition hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:cursor-default disabled:hover:border-gray-300"
                >
                  <div className="min-w-0 flex-1 leading-tight">
                    <span className="block truncate text-sm font-semibold text-gray-900">
                      {formData.accountFrozen ? "Dondurulmuş" : "Açık"}
                    </span>
                    {resolvedUser.accountFrozenAt && formData.accountFrozen && (
                      <span className="block truncate text-xs font-medium text-gray-500">
                        {new Date(resolvedUser.accountFrozenAt).toLocaleString(
                          "tr-TR",
                          {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        )}
                      </span>
                    )}
                  </div>
                  {formData.accountFrozen && (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className={`h-5 w-5 shrink-0 text-gray-500 transition-transform ${
                        showUnlockAccountAction ? "rotate-180" : ""
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  )}
                </button>
                {formData.accountFrozen && showUnlockAccountAction && (
                  <button
                    type="button"
                    disabled={cannotTouch}
                    onClick={handleUnlockAccount}
                    className="absolute left-0 top-[calc(100%+6px)] z-20 h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 shadow-lg shadow-gray-100 transition hover:border-gray-400 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Kilidi Kaldır
                  </button>
                )}
              </div>
            </div>
            </div>
            </div>

          <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm sm:p-4">
            <h4 className="text-sm font-semibold text-gray-800 mb-3">
              Üyelik Bitiş Tarihi
            </h4>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <select
                value={membershipDay}
                onChange={(e) => setMembershipDay(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
              <select
                value={membershipMonth}
                onChange={(e) => setMembershipMonth(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                <option value="1">Ocak</option>
                <option value="2">Şubat</option>
                <option value="3">Mart</option>
                <option value="4">Nisan</option>
                <option value="5">Mayıs</option>
                <option value="6">Haziran</option>
                <option value="7">Temmuz</option>
                <option value="8">Ağustos</option>
                <option value="9">Eylül</option>
                <option value="10">Ekim</option>
                <option value="11">Kasım</option>
                <option value="12">Aralık</option>
              </select>
              <select
                value={membershipYear}
                onChange={(e) => setMembershipYear(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                {Array.from(
                  { length: 10 },
                  (_, i) => new Date().getFullYear() + i,
                ).map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            {/* Hesap Bilgileri */}
            <div className="rounded-xl bg-gray-50/50 p-2.5 border border-gray-100">
              <h4 className="text-sm font-semibold text-gray-800 mb-3">
                Hesap Bilgileri
              </h4>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">
                    Hesap Oluşturulma Tarihi
                  </label>
                  <div className="rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900">
                    {resolvedUser.createdAt
                      ? new Date(resolvedUser.createdAt).toLocaleString("tr-TR", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Bilgi yok"}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">
                    Son Giriş Tarihi
                  </label>
                  <div className="rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900">
                    {resolvedUser.lastLoginAt
                      ? new Date(resolvedUser.lastLoginAt).toLocaleString("tr-TR", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Hiç giriş yapmamış"}
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-3 mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm font-semibold text-gray-800">
                İzinler
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!canGrantPermissions) return;
                    setPermissionsTouched(true);
                    setFormData({
                      ...formData,
                      permissions: [...ADMIN_PERMISSION_LABELS],
                    });
                  }}
                  disabled={!canGrantPermissions}
                  className="rounded-lg bg-green-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-600 transition"
                >
                  Tümünü Seç
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!canGrantPermissions) return;
                    setPermissionsTouched(true);
                    setFormData({ ...formData, permissions: [] });
                  }}
                  disabled={!canGrantPermissions}
                  className="rounded-lg bg-gray-400 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-500 transition"
                >
                  Tümünü Temizle
                </button>
              </div>
            </div>
            {!canGrantPermissions && (
              <p className="mb-2 text-xs font-medium text-amber-700">
                Yetki verebilir izniniz olmadığı için bu alanda değişiklik
                yapamazsınız.
              </p>
            )}
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
              {ADMIN_PERMISSION_LABELS.map((text) => (
                <label
                  key={text}
                  className="flex items-center gap-2 text-xs text-gray-700"
                >
                  <input
                    type="checkbox"
                    checked={formData.permissions.includes(text)}
                    disabled={!canGrantPermissions}
                    onChange={(e) => {
                      if (!canGrantPermissions) return;
                      setPermissionsTouched(true);
                      if (e.target.checked) {
                        setFormData({
                          ...formData,
                          permissions: [...formData.permissions, text],
                        });
                      } else {
                        setFormData({
                          ...formData,
                          permissions: formData.permissions.filter(
                            (p) => p !== text,
                          ),
                        });
                      }
                    }}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600"
                  />
                  {text}
                </label>
              ))}
            </div>
          </div>

          {saveError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {saveError}
            </div>
          )}

          <div className="flex flex-col gap-2 border-t border-gray-100 bg-gray-50 px-4 py-3 sm:px-5">
            {cannotTouch && (
              <span className="text-xs font-medium text-red-500">
                Bu kullanıcı korunuyor. Yalnızca korumayı açan yetkiliyle aynı
                yıldız veya daha üst yetkililer işlem yapabilir.
              </span>
            )}
            <div className="grid grid-cols-1 gap-3 sm:flex sm:items-center sm:justify-end">
              <button
                onClick={onClose}
                className="rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
              >
                Kapat
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={
                  isSaving || isDeleting || cannotTouch || !canDeleteMemberStaff
                }
                title={
                  canDeleteMemberStaff
                    ? "Kullanıcıyı Sil"
                    : "Üye ve yetkili silme yetkiniz yok."
                }
                className="rounded-lg bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
              >
                Sil
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || isDeleting || cannotTouch}
                className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white shadow-md shadow-blue-100 transition-all hover:bg-blue-700 disabled:opacity-50"
              >
                {isSaving ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-[250] flex items-center justify-center  pointer-events-auto"
          onClick={(e) => {
            e.stopPropagation();
            setShowDeleteConfirm(false);
          }}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6 pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Kullanıcıyı Sil
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              <span className="font-semibold">{resolvedUser.username}</span>{" "}
              kullanıcısını silmek istediğinizden emin misiniz? Bu işlem geri
              alınamaz.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeleteConfirm(false);
                }}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 pointer-events-auto"
              >
                İptal
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete();
                }}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-50 pointer-events-auto"
              >
                {isDeleting ? "Siliniyor..." : "Evet, Sil"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

const RoleEditModal = ({
  role,
  currentStarCount,
  onClose,
  apiClient,
  onUpdated,
  socket,
  inline = false,
}: {
  role: {
    id: number;
    name: string;
    microphoneDuration: number;
    starColor: string | null;
    starCount: number | null;
    icon: string | null;
    permissions?: Record<string, boolean>;
  };
  currentStarCount: number | null;
  onClose: () => void;
  apiClient: any;
  onUpdated: (updated: any) => void;
  socket?: any;
  inline?: boolean;
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const [name, setName] = useState(role.name || "");
  const [micDuration, setMicDuration] = useState(
    role.microphoneDuration?.toString() || "0",
  );
  const [starColor, setStarColor] = useState(role.starColor || "#FFD700");
  const [starCount, setStarCount] = useState(role.starCount || 0);
  const [icon, setIcon] = useState(role.icon || "");
  const targetRoleStarCount = role.starCount ?? 0;
  const canEditTargetRole =
    currentStarCount !== null && currentStarCount >= targetRoleStarCount;
  const canEditPermissions = starCount > 0 && starCount !== 27;
  const isReadOnly = [25, 26, 27].includes(starCount);
  const isIconReadOnly = true;
  const [permissions, setPermissions] = useState<Record<string, boolean>>(
    () => {
      const normalizedRolePermissions = normalizePermissionMap(
        (role as any)?.permissions,
      );
      const base = Array.from(
        new Set([
          ...ADMIN_PERMISSION_LABELS,
          ...Object.keys(normalizedRolePermissions),
        ]),
      );
      const map: Record<string, boolean> = {};
      base.forEach((p) => {
        map[p] = normalizedRolePermissions[p] === true;
      });
      return map;
    },
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const buildPermissionsState = (
    rawPermissions: Record<string, boolean> | undefined,
  ): Record<string, boolean> => {
    const normalizedRolePermissions = normalizePermissionMap(rawPermissions);
    const base = Array.from(
      new Set([
        ...ADMIN_PERMISSION_LABELS,
        ...Object.keys(normalizedRolePermissions),
      ]),
    );
    const map: Record<string, boolean> = {};
    base.forEach((p) => {
      map[p] = normalizedRolePermissions[p] === true;
    });
    return map;
  };

  useEffect(() => {
    setName(role.name || "");
    setMicDuration(role.microphoneDuration?.toString() || "0");
    setStarColor(role.starColor || "#FFD700");
    setStarCount(role.starCount || 0);
    setIcon(role.icon || "");
    setPermissions(buildPermissionsState((role as any)?.permissions));
    setSaveError(null);
  }, [
    role.id,
    role.name,
    role.microphoneDuration,
    role.starColor,
    role.starCount,
    role.icon,
    role.permissions,
  ]);

  useEffect(() => {
    let cancelled = false;

    const hydrateRolePermissions = async () => {
      try {
        const response = await apiClient.get(`/roles/${role.id}`);
        if (cancelled) return;
        const latestRole = response?.data;
        if (latestRole) {
          setName(latestRole.name || "");
          setMicDuration(latestRole.microphoneDuration?.toString() || "0");
          setStarColor(latestRole.starColor || "#FFD700");
          setStarCount(latestRole.starCount || 0);
          setIcon(latestRole.icon || "");
          setPermissions(buildPermissionsState(latestRole.permissions));
        }
      } catch (error) {
        console.error("Failed to hydrate role permissions:", error);
      }
    };

    hydrateRolePermissions();

    return () => {
      cancelled = true;
    };
  }, [apiClient, role.id]);

  const readyColors = [
    "#F43F5E",
    "#F97316",
    "#FACC15",
    "#22C55E",
    "#3B82F6",
    "#8B5CF6",
    "#E879F9",
    "#34D399",
    "#0EA5E9",
    "#38BDF8",
    "#A855F7",
    "#F472B6",
    "#9CA3AF",
    "#111827",
    "#E5E7EB",
    "#F59E0B",
    "#84CC16",
    "#10B981",
    "#2563EB",
  ];

  const togglePermission = (key: string) => {
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const visiblePermissionKeys = Object.keys(permissions).filter((key) => {
    // "Sistem resetleme" permission'ı sadece 16 yıldız ve üstünde görünsün
    if (key === "Sistem resetleme" && starCount < 16) {
      return false;
    }
    return true;
  });

  const hasSelectedVisiblePermissions = visiblePermissionKeys.some(
    (key) => permissions[key],
  );
  const areAllVisiblePermissionsSelected =
    visiblePermissionKeys.length > 0 &&
    visiblePermissionKeys.every((key) => permissions[key]);

  const selectAllVisiblePermissions = () => {
    setPermissions((prev) => {
      const next = { ...prev };
      visiblePermissionKeys.forEach((key) => {
        next[key] = true;
      });
      return next;
    });
  };

  const clearAllVisiblePermissions = () => {
    setPermissions((prev) => {
      const next = { ...prev };
      visiblePermissionKeys.forEach((key) => {
        next[key] = false;
      });
      return next;
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!modalRef.current) return;
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !modalRef.current) return;
      const modalRect = modalRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let newX = e.clientX - dragStart.x;
      let newY = e.clientY - dragStart.y;

      const maxX = (viewportWidth - modalRect.width) / 2;
      const minX = -maxX;
      const maxY = (viewportHeight - modalRect.height) / 2;
      const minY = -maxY;

      newX = Math.max(minX, Math.min(maxX, newX));
      newY = Math.max(minY, Math.min(maxY, newY));

      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragStart]);

  const handleSave = async () => {
    if (!canEditTargetRole) {
      setSaveError(
        "Sadece yıldızı size eşit veya düşük olan rütbeleri düzenleyebilirsiniz.",
      );
      return;
    }

    try {
      setSaving(true);
      setSaveError(null);
      const payload: {
        name: string;
        microphoneDuration: number;
        starColor: string | null;
        starCount: number;
        icon: string | null;
        permissions?: Record<string, boolean>;
      } = {
        name: name?.trim(),
        microphoneDuration: Number(micDuration) || 0,
        starColor: starColor || null,
        starCount: Number.isFinite(Number(starCount)) ? starCount : 0,
        icon: icon?.trim() || null,
      };
      if (canEditPermissions) {
        payload.permissions = permissions;
      }
      const res = await apiClient.patch(`/roles/${role.id}`, payload);
      const updated = res?.data ?? { ...role, ...payload };

      // Keep instant client-side sync; backend remains the primary source.
      if (socket) {
        socket.emit("tenant:roleUpdate", {
          id: role.id,
          name: updated.name,
          previousName: role.name,
          starColor: updated.starColor,
          starCount: updated.starCount,
          icon: updated.icon,
        });
      }

      onUpdated(updated);
      onClose();
    } catch (error: any) {
      setSaveError(
        error?.message ||
          "Rütbe kaydedilirken bir hata oluştu. Lütfen tekrar deneyin.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={inline ? "absolute inset-0 z-[100] flex flex-col bg-white" : "pointer-events-none fixed inset-0 z-[220] flex items-start justify-center px-4 py-6"}>
      <div
        ref={modalRef}
        className={inline ? "flex h-full w-full flex-col overflow-hidden bg-white" : "pointer-events-auto w-full max-w-4xl overflow-hidden rounded-xl bg-white shadow-2xl"}
        style={inline ? {} : {
          top: "50%",
          left: "50%",
          transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))`,
          position: "fixed",
          cursor: isDragging ? "grabbing" : "default",
          maxHeight: "90vh",
        }}
      >
        <div
          className="flex items-center justify-between bg-slate-800 px-4 py-3 text-white cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
        >
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <h3 className="text-lg font-semibold">Admin Rütbe Düzenleme</h3>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M6.28 5.22a.75.75 0 011.06 0L10 7.94l2.66-2.72a.75.75 0 111.06 1.06L11.06 9l2.66 2.72a.75.75 0 11-1.06 1.06L10 10.06l-2.66 2.72a.75.75 0 11-1.06-1.06L8.94 9 6.28 6.28a.75.75 0 010-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        <div
          className={`${inline ? "flex min-h-0 flex-1 overflow-y-auto overscroll-contain bg-slate-50 py-5" : "space-y-5 overflow-y-auto overscroll-contain bg-slate-50 py-6"} px-5`}
          style={inline ? {} : { maxHeight: "82vh" }}
        >
          <div className="w-full space-y-5">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600">
                Rütbe Adı
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isReadOnly}
                className={`w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 ${
                  isReadOnly ? "cursor-not-allowed opacity-70 bg-gray-50" : ""
                }`}
              />
              {isReadOnly && (
                <p className="mt-1 text-[10px] text-amber-600 font-medium">
                  Bu rütbenin ismi sistem tarafından korunmaktadır.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600">
                Mikrofon Süresi (dk.)
              </label>
              <input
                type="number"
                value={micDuration}
                onChange={(e) => setMicDuration(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          <div className="rounded-xl border border-cyan-400 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-cyan-100 bg-cyan-500 px-4 py-3 text-sm font-semibold text-white">
              <span>Rütbe Yıldız Renk</span>
              <div className="h-5 w-5 rounded-full border-2 border-white/80" />
            </div>
            <div className="space-y-4 px-4 py-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600">
                  Renk Seç (Palet)
                </label>
                <div className="flex items-center gap-3">
                  <div className="relative h-10 w-16 overflow-hidden rounded-md border border-gray-200 shadow-sm">
                    <input
                      type="color"
                      value={starColor}
                      onChange={(e) => setStarColor(e.target.value)}
                      className="absolute -inset-1 h-[150%] w-[150%] cursor-pointer border-none bg-transparent"
                    />
                  </div>
                  <input
                    value={starColor}
                    onChange={(e) => setStarColor(e.target.value)}
                    placeholder="#RRGGBB"
                    className="w-32 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 uppercase"
                  />
                  <div
                    className="text-[10px] font-medium px-2 py-1 rounded bg-gray-100 text-gray-500"
                    style={{ color: starColor }}
                  >
                    Örnek Görünüm
                  </div>
                </div>
                <p className="text-[10px] text-zinc-400">
                  Kutucuğa tıklayarak renk paletini açabilir veya HEX kodunu
                  manuel girebilirsiniz.
                </p>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-semibold text-gray-600">
                  Yıldız Sayısı
                </span>
                <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                  <div
                    className={`flex flex-wrap items-center text-yellow-500 ${
                      starCount >= 14 && starCount <= 16 ? "gap-0.5" : "gap-1"
                    }`}
                  >
                    {starCount > 0 ? (
                      Array.from({ length: starCount }).map((_, idx) => (
                        <span
                          key={idx}
                          className={
                            starCount >= 14 && starCount <= 16
                              ? "text-[11px] leading-none"
                              : "text-lg leading-none"
                          }
                        >
                          ★
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-gray-500">Yıldız yok</span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 ml-2">
                    ({starCount})
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600">
                  İkon (isteğe bağlı)
                </label>
                <input
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  disabled={isIconReadOnly}
                  placeholder="🅖🅞🅛🅓"
                  className={`w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 ${
                    isIconReadOnly
                      ? "cursor-not-allowed opacity-70 bg-gray-50"
                      : ""
                  }`}
                />
                {isIconReadOnly && (
                  <p className="mt-1 text-[10px] text-amber-600 font-medium">
                    Bu rütbenin ikonu sistem tarafından korunmaktadır.
                  </p>
                )}
              </div>
            </div>
          </div>

          {saveError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {saveError}
            </div>
          )}

          {!canEditTargetRole && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              Bu rütbeyi düzenleme yetkiniz yok. Sadece yıldızı size eşit veya
              düşük rütbeler düzenlenebilir.
            </div>
          )}

          {canEditPermissions && (
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <h4 className="text-sm font-semibold text-gray-800">İzinler</h4>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={selectAllVisiblePermissions}
                    disabled={areAllVisiblePermissionsSelected}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      areAllVisiblePermissionsSelected
                        ? "cursor-not-allowed bg-gray-100 text-gray-400"
                        : "bg-blue-50 text-blue-700 hover:bg-blue-100"
                    }`}
                  >
                    Tümünü Seç
                  </button>
                  <button
                    type="button"
                    onClick={clearAllVisiblePermissions}
                    disabled={!hasSelectedVisiblePermissions}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      !hasSelectedVisiblePermissions
                        ? "cursor-not-allowed bg-gray-100 text-gray-400"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    Tümünü Temizle
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                {visiblePermissionKeys.map((key) => (
                  <label
                    key={key}
                    className="flex items-center gap-2 text-xs text-gray-700"
                  >
                    <input
                      type="checkbox"
                      checked={permissions[key]}
                      onChange={() => togglePermission(key)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    {key}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3 md:flex-row md:justify-end">
            <button
              onClick={onClose}
              className="w-full rounded-lg bg-gray-200 px-6 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-300 md:w-auto"
            >
              İptal
            </button>
            <button
              onClick={handleSave}
              disabled={!canEditTargetRole || saving}
              className={`w-full rounded-lg px-6 py-2 text-sm font-semibold text-white md:w-auto ${
                !canEditTargetRole || saving
                  ? "cursor-not-allowed bg-gray-300"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {saving ? "Kaydediliyor..." : "Rütbeyi Kaydet"}
            </button>
        </div>
      </div>
    </div>
  </div>
</div>
  );
};
