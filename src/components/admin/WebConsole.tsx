"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getClientApiClient } from "@/lib/api/clientApi";
import { notifyAnimationCatalogUpdated } from "@/lib/animationCatalogSync";
import { env } from "@/config/env";
import type {
  WebConsoleAnimationItem,
  WebConsoleAnimationsResponse,
  LoginDesignType,
  SystemResetStartResponse,
  WebConsoleStatsListItem,
  WebConsoleStatsResponse,
} from "@/services/systemSettingsService";
import {
  Users,
  ShieldCheck,
  User,
  LogIn,
  Activity,
  Smartphone,
  Globe,
  TrendingUp,
  Clock,
  ChevronRight,
  Pencil,
  RefreshCw,
  Trash2,
  Upload,
  Crown,
  ArrowUp,
  ArrowDown,
  UserCog,
  ImagePlus,
} from "lucide-react";
import { toast } from "sonner";
import { SystemResetModal } from "./web-console/SystemResetModal";

type WebConsoleView =
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
  | "managerList";

type SeoFormState = {
  siteName: string;
  title: string;
  description: string;
  keywords: string;
  googleMetaTag: string;
  homePageText: string;
  homePageImage: string;
  homePageLogo: string;
  premiumArticleTopTitle: string;
  premiumArticleTopContent: string;
  premiumArticleMiddleTitle: string;
  premiumArticleMiddleContent: string;
  premiumArticleBottomTitle: string;
  premiumArticleBottomContent: string;
  premiumAndroidAppUrl: string;
  premiumIosAppUrl: string;
};

type SeoSettingsResponse = {
  activeLoginDesign?: LoginDesignType;
  siteName?: string | null;
  siteTitle?: string | null;
  homePageHtml?: string | null;
  homePageImage?: string | null;
  homePageLogo?: string | null;
  premiumArticleTopTitle?: string | null;
  premiumArticleTopContent?: string | null;
  premiumArticleMiddleTitle?: string | null;
  premiumArticleMiddleContent?: string | null;
  premiumArticleBottomTitle?: string | null;
  premiumArticleBottomContent?: string | null;
  premiumAndroidAppUrl?: string | null;
  premiumIosAppUrl?: string | null;
};

type WelcomeFormState = {
  template: string;
};

type WelcomeBot = {
  id: number;
  username: string;
  isAI?: boolean;
  welcomeMessage?: string | null;
  welcomeAutoSendEnabled?: boolean;
  welcomeManualPromptEnabled?: boolean;
};

type RootPasswordFormState = {
  password: string;
  passwordRepeat: string;
};

type SystemMessageFormState = {
  content: string;
};

type FloodBanListItem = {
  id: number;
  ipAddress: string;
  reason: string;
  source: string;
  expiresAt: string | null;
  createdAt: string | null;
};

type BackupFileInfo = {
  id: string;
  filename: string;
  timestamp: string;
  path: string;
  size: number;
};

type BackupRestoreResponse = {
  success: boolean;
  message: string;
  restoredCounts: {
    roles: number;
    users: number;
    bots: number;
    settings: boolean;
  };
};

const formatBytes = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

const formatBackupDate = (item: BackupFileInfo) => {
  const normalizedId = item.id.replace(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})(.*)$/,
    "$1-$2-$3T$4:$5:$6$7",
  );
  const date = new Date(normalizedId);
  if (!Number.isNaN(date.getTime())) {
    return new Intl.DateTimeFormat("tr-TR", {
      dateStyle: "medium",
      timeStyle: "medium",
    }).format(date);
  }
  return item.timestamp || item.id;
};

const webConsoleInfoPanelClass =
  "rounded-xl border border-[#cfe0f2] bg-gradient-to-br from-[#14314d] via-[#1a4267] to-[#21527d] p-4 text-white shadow-[0_14px_32px_rgba(20,49,77,0.18)]";

const webConsoleInfoActionClass =
  "mx-auto mt-4 flex w-fit items-center justify-center rounded-xl border border-[#8eb6dc] bg-gradient-to-r from-[#3b82f6] to-[#2563eb] px-4 py-2.5 text-center text-sm font-semibold text-white shadow-[0_10px_24px_rgba(37,99,235,0.28)] transition-all hover:-translate-y-0.5 hover:from-[#4c8df7] hover:to-[#1f5ad7]";

const webConsoleInfoActionDisabledClass =
  "cursor-not-allowed border border-blue-200 bg-blue-300 text-white shadow-none";

const webConsoleExampleClass =
  "mt-4 rounded-xl border border-[#8eb6dc] bg-white/12 px-4 py-3 text-center text-xs font-bold text-white shadow-inner shadow-white/5 backdrop-blur-sm sm:text-sm";

const getWebConsoleTileSurfaceClass = (color: string) => {
  const baseSurface =
    "bg-slate-800 text-white border-slate-600/50 hover:bg-slate-700";

  switch (color) {
    case "bg-emerald-500":
      return `${baseSurface} border-l-4 border-l-emerald-500 hover:border-emerald-400`;
    case "bg-red-500":
      return `${baseSurface} border-l-4 border-l-red-500 hover:border-red-400`;
    case "bg-blue-500":
      return `${baseSurface} border-l-4 border-l-blue-500 hover:border-blue-400`;
    case "bg-purple-500":
      return `${baseSurface} border-l-4 border-l-purple-500 hover:border-purple-400`;
    case "bg-orange-500":
      return `${baseSurface} border-l-4 border-l-orange-500 hover:border-orange-400`;
    case "bg-cyan-500":
      return `${baseSurface} border-l-4 border-l-cyan-500 hover:border-cyan-400`;
    case "bg-amber-500":
      return `${baseSurface} border-l-4 border-l-amber-500 hover:border-amber-400`;
    case "bg-pink-500":
      return `${baseSurface} border-l-4 border-l-pink-500 hover:border-pink-400`;
    case "bg-violet-500":
      return `${baseSurface} border-l-4 border-l-violet-500 hover:border-violet-400`;
    case "bg-teal-500":
      return `${baseSurface} border-l-4 border-l-teal-500 hover:border-teal-400`;
    default:
      return `${baseSurface} border-l-4 border-l-blue-500 hover:border-blue-400`;
  }
};

const defaultSeoForm: SeoFormState = {
  siteName: "KingMobile",
  title: "KingMobile Sohbet, Sesli Sohbet, Mobil Chat",
  description: "Kaliteli ve ücretsiz sohbet deneyimini hemen başlatın.",
  keywords: "kingmobile, sesli sohbet, mobil chat, görüntülü sohbet",
  googleMetaTag: "Google Meta Etiketi",
  homePageText:
    "<center><strong>KingMobile'e hoş geldiniz.</strong></center>\n<p>Mobil uyumlu sohbet deneyimi ile hemen aramıza katılın.</p>",
  homePageImage: "anasayfa-gorsel.jpg",
  homePageLogo: "",
  premiumArticleTopTitle: "Her Cihazdan Kesintisiz Sohbet",
  premiumArticleTopContent:
    "Günümüzde teknoloji, insanların dünya çapında birbirleriyle sesli iletişim kurmasını kolaylaştırıyor. Sesli chat platformları, bu iletişim biçimlerinden biri. Ancak, her cihazdan mobil kesintisiz bir konuşmalı sohbet deneyimi yaşamak için bazı önemli noktaları göz önünde bulundurmak gerekiyor herkese hos Sohbetler.",
  premiumArticleMiddleTitle: "Sesli Sohbet Et",
  premiumArticleMiddleContent:
    "İletişimin Yeni Boyutu Sesli Chat; Sesli sohbet, teknolojinin sunduğu en etkili iletişim biçimlerinden biridir. İster iş toplantıları, ister aile ve arkadaşlarla yapılan sohbetler olsun, sesli sohbet platformları.",
  premiumArticleBottomTitle: "Sohbet ve Chat Odaları",
  premiumArticleBottomContent:
    "Sesli sohbetin birçok avantajı vardır. İlk olarak, kullanıcıların birbirlerini görmelerine gerek kalmadan iletişim kurmalarını sağlar. Bu, özellikle internet bağlantısının zayıf olduğu durumlarda kullanışlıdır. İkincisi, sesli sohbet, kullanıcıların duygularını ve tonlamalarını daha iyi ifade etmelerini sağlar, bu da yazılı mesajların bazen başaramadığı bir şeydir.",
  premiumAndroidAppUrl: "",
  premiumIosAppUrl: "",
};

const defaultWelcomeForm: WelcomeFormState = {
  template: "Merhaba [username] Hoşgeldiniz",
};

const defaultRootPasswordForm: RootPasswordFormState = {
  password: "",
  passwordRepeat: "",
};

const defaultSystemMessageForm: SystemMessageFormState = {
  content: "",
};

const SYSTEM_MESSAGE_COOLDOWN_MS = 5 * 60 * 1000;
const SYSTEM_MESSAGE_COOLDOWN_KEY = "webConsoleSystemMessageLastSentAt";

const StatsSkeleton = () => (
  <div className="animate-pulse space-y-6">
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="h-32 rounded-2xl border border-gray-100 bg-gray-50"
        />
      ))}
    </div>
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <div className="h-80 rounded-2xl border border-gray-100 bg-gray-50" />
      <div className="space-y-6">
        <div className="h-48 rounded-2xl border border-gray-100 bg-gray-50" />
        <div className="h-48 rounded-2xl border border-gray-100 bg-gray-50" />
      </div>
    </div>
  </div>
);

const AnimationsSkeleton = () => (
  <div className="animate-pulse rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
    <div className="h-20 rounded-lg bg-gray-100" />
    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          key={index}
          className="h-40 rounded-lg border border-gray-200 bg-gray-100"
        />
      ))}
    </div>
  </div>
);

const cards = [
  {
    title: "Seo Ayarları",
    color: "bg-emerald-500",
    icon: (
      <svg
        className="h-5 w-5"
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
  },
  {
    title: "Sistem Resetleme",
    color: "bg-red-500",
    icon: (
      <svg
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4l3 3M21 12a9 9 0 11-9-9"
        />
      </svg>
    ),
  },
  {
    title: "Karşılama Mesajı",
    color: "bg-blue-500",
    icon: (
      <svg
        className="h-5 w-5"
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
  },
  {
    title: "Sistem Geri Yükleme",
    color: "bg-purple-500",
    icon: (
      <svg
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 14l-3-3m0 0l3-3m-3 3h12"
        />
      </svg>
    ),
  },
  {
    title: "İstatistikler",
    color: "bg-orange-500",
    icon: (
      <svg
        className="h-5 w-5"
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
  },
  {
    title: "Root İşlemleri",
    color: "bg-cyan-500",
    icon: (
      <svg
        className="h-5 w-5"
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
  },
  {
    title: "Sistem Mesajı",
    color: "bg-amber-500",
    icon: (
      <svg
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12.75L11.25 15 15 9.75M12 5a7 7 0 100 14 7 7 0 000-14z"
        />
      </svg>
    ),
  },
  {
    title: "Flood Ban İşlemleri",
    color: "bg-pink-500",
    icon: (
      <svg
        className="h-5 w-5"
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
  },
  {
    title: "Sistem Güncellemeleri",
    color: "bg-violet-500",
    icon: (
      <svg
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
        />
      </svg>
    ),
  },
  {
    title: "Site Sahipleri",
    color: "bg-amber-500",
    icon: <Crown className="h-5 w-5" />,
  },
  {
    title: "Yönetici Listesi",
    color: "bg-cyan-500",
    icon: <UserCog className="h-5 w-5" />,
  },
  {
    title: "Animasyonlar",
    color: "bg-teal-500",
    icon: (
      <svg
        className="h-5 w-5"
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
  },
];

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <label className="block text-sm font-medium text-gray-700">{children}</label>
);

const TextInput = ({
  value,
  onChange,
  placeholder,
  readOnly = false,
  type = "text",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  type?: React.HTMLInputTypeAttribute;
}) => (
  <input
    type={type}
    value={value}
    onChange={(event) => onChange(event.target.value)}
    placeholder={placeholder}
    readOnly={readOnly}
    className={`w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 ${
      readOnly
        ? "cursor-default bg-gray-50 focus:outline-none"
        : "bg-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
    }`}
  />
);

const TextArea = ({
  value,
  onChange,
  rows = 4,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
}) => (
  <textarea
    value={value}
    onChange={(event) => onChange(event.target.value)}
    rows={rows}
    placeholder={placeholder}
    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
  />
);

const resolvePreviewAssetUrl = (path?: string | null) => {
  if (!path) return undefined;
  if (path.startsWith("data:") || path.startsWith("http")) return path;
  const baseUrl = env.apiBaseUrl.replace(/\/api\/?$/, "");
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  return `${baseUrl}/${cleanPath}`;
};

const SeoSettingsView = () => {
  const apiClient = useMemo(() => getClientApiClient(), []);
  const [editingDesign, setEditingDesign] =
    useState<LoginDesignType>("standard");
  const [activeLoginDesign, setActiveLoginDesign] =
    useState<LoginDesignType>("standard");
  const [form, setForm] = useState<SeoFormState>(defaultSeoForm);
  const homeImageInputRef = useRef<HTMLInputElement>(null);
  const homeLogoInputRef = useRef<HTMLInputElement>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);

  const applySettingsResponse = useCallback((settings: SeoSettingsResponse) => {
    const nextDesign =
      settings.activeLoginDesign === "premium" ? "premium" : "standard";
    setActiveLoginDesign(nextDesign);
    setEditingDesign(nextDesign);
    setForm((prev) => ({
      ...prev,
      siteName:
        typeof settings.siteName === "string" && settings.siteName.trim()
          ? settings.siteName
          : prev.siteName,
      title:
        typeof settings.siteTitle === "string" && settings.siteTitle.trim()
          ? settings.siteTitle
          : prev.title,
      homePageText:
        typeof settings.homePageHtml === "string"
          ? settings.homePageHtml
          : prev.homePageText,
      homePageImage:
        typeof settings.homePageImage === "string"
          ? settings.homePageImage
          : prev.homePageImage,
      homePageLogo:
        typeof settings.homePageLogo === "string"
          ? settings.homePageLogo
          : prev.homePageLogo,
      premiumArticleTopTitle:
        typeof settings.premiumArticleTopTitle === "string"
          ? settings.premiumArticleTopTitle
          : prev.premiumArticleTopTitle,
      premiumArticleTopContent:
        typeof settings.premiumArticleTopContent === "string"
          ? settings.premiumArticleTopContent
          : prev.premiumArticleTopContent,
      premiumArticleMiddleTitle:
        typeof settings.premiumArticleMiddleTitle === "string"
          ? settings.premiumArticleMiddleTitle
          : prev.premiumArticleMiddleTitle,
      premiumArticleMiddleContent:
        typeof settings.premiumArticleMiddleContent === "string"
          ? settings.premiumArticleMiddleContent
          : prev.premiumArticleMiddleContent,
      premiumArticleBottomTitle:
        typeof settings.premiumArticleBottomTitle === "string"
          ? settings.premiumArticleBottomTitle
          : prev.premiumArticleBottomTitle,
      premiumArticleBottomContent:
        typeof settings.premiumArticleBottomContent === "string"
          ? settings.premiumArticleBottomContent
          : prev.premiumArticleBottomContent,
      premiumAndroidAppUrl:
        typeof settings.premiumAndroidAppUrl === "string"
          ? settings.premiumAndroidAppUrl
          : prev.premiumAndroidAppUrl,
      premiumIosAppUrl:
        typeof settings.premiumIosAppUrl === "string"
          ? settings.premiumIosAppUrl
          : prev.premiumIosAppUrl,
    }));
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchSettings = async () => {
      try {
        setSettingsLoading(true);
        const response = await apiClient.get<SeoSettingsResponse>(
          "/system-settings",
        );
        if (cancelled) return;
        applySettingsResponse(response.data);
      } catch (error) {
        if (!cancelled) {
          toast.error("Aktif login tasarımı alınamadı.");
        }
      } finally {
        if (!cancelled) {
          setSettingsLoading(false);
        }
      }
    };

    fetchSettings();

    return () => {
      cancelled = true;
    };
  }, [apiClient, applySettingsResponse]);

  const updateField = <K extends keyof SeoFormState>(
    key: K,
    value: SeoFormState[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    const saveSettings = async () => {
      try {
        setSettingsSaving(true);
        const response = await apiClient.put<SeoSettingsResponse>(
          "/system-settings",
          {
            activeLoginDesign,
            siteName: form.siteName.trim(),
            siteTitle: form.title.trim(),
            homePageHtml: form.homePageText,
            homePageImage: form.homePageImage,
            homePageLogo: form.homePageLogo,
            premiumArticleTopTitle: form.premiumArticleTopTitle.trim(),
            premiumArticleTopContent: form.premiumArticleTopContent,
            premiumArticleMiddleTitle: form.premiumArticleMiddleTitle.trim(),
            premiumArticleMiddleContent: form.premiumArticleMiddleContent,
            premiumArticleBottomTitle: form.premiumArticleBottomTitle.trim(),
            premiumArticleBottomContent: form.premiumArticleBottomContent,
            premiumAndroidAppUrl: form.premiumAndroidAppUrl.trim(),
            premiumIosAppUrl: form.premiumIosAppUrl.trim(),
          },
        );
        applySettingsResponse(response.data);
        toast.success("Login ayarları kaydedildi.");
      } catch (error) {
        toast.error("Login ayarları kaydedilemedi.");
      } finally {
        setSettingsSaving(false);
      }
    };

    void saveSettings();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="inline-flex rounded-xl bg-gray-100 p-1">
          {(
            [
              { value: "standard", label: "Standart Login" },
              { value: "premium", label: "Premium Login" },
            ] as const
          ).map((option) => {
            const isActive = editingDesign === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setEditingDesign(option.value);
                }}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                  isActive
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-gray-700 hover:bg-white hover:text-gray-900"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <div className="mt-5 space-y-2">
          <FieldLabel>Login Dizayn Seçin</FieldLabel>
          <select
            value={activeLoginDesign}
            onChange={(e) => {
              const value = e.target.value as LoginDesignType;
              setActiveLoginDesign(value);
            }}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            <option value="standard">Standart Login</option>
            <option value="premium">Premium Login</option>
          </select>
        </div>

        <div className="mt-5 space-y-5">
          {settingsLoading && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
              Aktif login tasarımı yükleniyor...
            </div>
          )}

          {editingDesign === "standard" ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <FieldLabel>Site Adı (Giriş Ekranı)</FieldLabel>
                  <TextInput
                    value={form.siteName}
                    onChange={(value) => updateField("siteName", value)}
                  />
                </div>

                <div className="space-y-2">
                  <FieldLabel>Sayfa Başlığı (Title)</FieldLabel>
                  <TextInput
                    value={form.title}
                    onChange={(value) => updateField("title", value)}
                  />
                </div>

                <div className="space-y-2">
                  <FieldLabel>Açıklama (Description)</FieldLabel>
                  <TextInput
                    value={form.description}
                    onChange={(value) => updateField("description", value)}
                  />
                </div>

                <div className="space-y-2">
                  <FieldLabel>Anahtar Kelimeler (Keyword)</FieldLabel>
                  <TextInput
                    value={form.keywords}
                    onChange={(value) => updateField("keywords", value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <FieldLabel>Google Meta Etiketi</FieldLabel>
                <TextArea
                  rows={3}
                  value={form.googleMetaTag}
                  onChange={(value) => updateField("googleMetaTag", value)}
                />
              </div>

              <div className="space-y-2">
                <FieldLabel>Ana Sayfa Yazı</FieldLabel>
                <TextArea
                  rows={4}
                  value={form.homePageText}
                  onChange={(value) => updateField("homePageText", value)}
                />
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <FieldLabel>Ana Sayfa Resmi</FieldLabel>
                  <TextInput
                    value={form.homePageImage}
                    onChange={(value) => updateField("homePageImage", value)}
                    readOnly
                  />
                </div>

                <div className="space-y-2">
                  <FieldLabel>Ana Sayfa Üst Logo (Boyut 320 x 64)</FieldLabel>
                  <TextInput
                    value={form.homePageLogo}
                    onChange={(value) => updateField("homePageLogo", value)}
                    readOnly
                  />
                </div>
              </div>

              <input
                ref={homeLogoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (e) => {
                    const result = e.target?.result;
                    if (typeof result === "string") {
                      updateField("homePageLogo", result);
                    }
                  };
                  reader.readAsDataURL(file);
                }}
              />
              <input
                ref={homeImageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (e) => {
                    const result = e.target?.result;
                    if (typeof result === "string") {
                      updateField("homePageImage", result);
                    }
                  };
                  reader.readAsDataURL(file);
                }}
              />

              <div className="flex flex-col gap-4 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => homeLogoInputRef.current?.click()}
                      className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                    >
                      AnaSayfa Logo Yükle
                    </button>
                    {form.homePageLogo && (
                      <button
                        type="button"
                        onClick={() => updateField("homePageLogo", "")}
                        className="w-full rounded-lg bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-500/20"
                      >
                        Logoyu Kaldır
                      </button>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => homeImageInputRef.current?.click()}
                      className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                    >
                      AnaSayfa Resmi Yükle
                    </button>
                    {form.homePageImage && (
                      <button
                        type="button"
                        onClick={() => updateField("homePageImage", "")}
                        className="w-full rounded-lg bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-500/20"
                      >
                        Resmi Kaldır
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6 border-t border-gray-200 pt-5">
              <div className="space-y-2">
                <FieldLabel>Makale Üst Başlık</FieldLabel>
                <TextInput
                  value={form.premiumArticleTopTitle}
                  onChange={(value) =>
                    updateField("premiumArticleTopTitle", value)
                  }
                />
              </div>

              <div className="space-y-2">
                <FieldLabel>Makale Üst Konu</FieldLabel>
                <TextArea
                  rows={8}
                  value={form.premiumArticleTopContent}
                  onChange={(value) =>
                    updateField("premiumArticleTopContent", value)
                  }
                />
              </div>

              <div className="border-t border-gray-200 pt-5" />

              <div className="space-y-2">
                <FieldLabel>Makale Orta Başlık</FieldLabel>
                <TextInput
                  value={form.premiumArticleMiddleTitle}
                  onChange={(value) =>
                    updateField("premiumArticleMiddleTitle", value)
                  }
                />
              </div>

              <div className="space-y-2">
                <FieldLabel>Makale Orta Konu</FieldLabel>
                <TextArea
                  rows={8}
                  value={form.premiumArticleMiddleContent}
                  onChange={(value) =>
                    updateField("premiumArticleMiddleContent", value)
                  }
                />
              </div>

              <div className="border-t border-gray-200 pt-5" />

              <div className="space-y-2">
                <FieldLabel>Makale Alt Başlık</FieldLabel>
                <TextInput
                  value={form.premiumArticleBottomTitle}
                  onChange={(value) =>
                    updateField("premiumArticleBottomTitle", value)
                  }
                />
              </div>

              <div className="space-y-2">
                <FieldLabel>Makale Alt Konu</FieldLabel>
                <TextArea
                  rows={8}
                  value={form.premiumArticleBottomContent}
                  onChange={(value) =>
                    updateField("premiumArticleBottomContent", value)
                  }
                />
              </div>

              <div className="border-t border-gray-200 pt-5" />

              <div className="space-y-2">
                <FieldLabel>Adroid Uygulama Linki</FieldLabel>
                <TextInput
                  value={form.premiumAndroidAppUrl}
                  onChange={(value) =>
                    updateField("premiumAndroidAppUrl", value)
                  }
                />
              </div>

              <div className="space-y-2">
                <FieldLabel>IOS Uygulama Linki</FieldLabel>
                <TextInput
                  value={form.premiumIosAppUrl}
                  onChange={(value) => updateField("premiumIosAppUrl", value)}
                  placeholder="IOS Uygulama Linki"
                />
              </div>
            </div>
          )}

          <div className="mt-6 flex justify-center border-t border-gray-100 pt-6">
            <button
              type="button"
              onClick={handleSave}
              disabled={settingsLoading || settingsSaving}
              className={`w-full rounded-lg px-6 py-3 text-sm font-semibold text-white transition-colors sm:min-w-40 sm:w-auto ${
                settingsLoading || settingsSaving
                  ? "cursor-not-allowed bg-blue-400"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {settingsSaving ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const WelcomeMessageView = () => {
  const apiClient = useMemo(() => getClientApiClient(), []);
  const [form, setForm] = useState<WelcomeFormState>(defaultWelcomeForm);
  const [welcomeBot, setWelcomeBot] = useState<WelcomeBot | null>(null);
  const [botMessage, setBotMessage] = useState("");
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [botLoading, setBotLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [botSaving, setBotSaving] = useState(false);

  const hydrateWelcomeBot = useCallback(
    (bots: WelcomeBot[]) => {
      const aiBot = bots.find((bot) => bot.isAI === true) ?? null;
      setWelcomeBot(aiBot);
      setBotMessage(aiBot?.welcomeMessage ?? "");
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;

    const fetchSettings = async () => {
      try {
        setSettingsLoading(true);
        const response = await apiClient.get<{
          welcomeMessageTemplate?: string | null;
        }>("/system-settings");
        if (cancelled) return;
        setForm({
          template:
            typeof response.data?.welcomeMessageTemplate === "string"
              ? response.data.welcomeMessageTemplate
              : defaultWelcomeForm.template,
        });
      } catch (error) {
        if (!cancelled) {
          toast.error("Karşılama mesajı ayarı alınamadı.");
        }
      } finally {
        if (!cancelled) {
          setSettingsLoading(false);
        }
      }
    };

    fetchSettings();

    return () => {
      cancelled = true;
    };
  }, [apiClient]);

  useEffect(() => {
    let cancelled = false;

    const fetchWelcomeBot = async () => {
      try {
        setBotLoading(true);
        const response = await apiClient.get<WelcomeBot[]>("/bot");
        if (cancelled) return;
        hydrateWelcomeBot(Array.isArray(response.data) ? response.data : []);
      } catch (error) {
        if (!cancelled) {
          setWelcomeBot(null);
          toast.error("Karşılama botu bilgisi alınamadı.");
        }
      } finally {
        if (!cancelled) {
          setBotLoading(false);
        }
      }
    };

    fetchWelcomeBot();

    return () => {
      cancelled = true;
    };
  }, [apiClient, hydrateWelcomeBot]);

  const handleSave = () => {
    const saveSettings = async () => {
      try {
        setSettingsSaving(true);
        await apiClient.put("/system-settings", {
          welcomeMessageTemplate: form.template,
        });
        window.dispatchEvent(
          new CustomEvent("welcomeMessageTemplateUpdated", {
            detail: { template: form.template },
          }),
        );
        toast.success("Karşılama mesajı kaydedildi.");
      } catch (error) {
        toast.error("Karşılama mesajı kaydedilemedi.");
      } finally {
        setSettingsSaving(false);
      }
    };

    void saveSettings();
  };

  const saveWelcomeBot = (manualEnabled: boolean) => {
    if (!welcomeBot) {
      toast.error("Yapay zeka karşılama botu bulunamadı.");
      return;
    }

    const run = async () => {
      try {
        setBotSaving(true);
        const response = await apiClient.patch<WelcomeBot>(
          `/bot/${welcomeBot.id}`,
          {
            isAI: true,
            welcomeMessage: botMessage.trim() || null,
            welcomeManualPromptEnabled: manualEnabled,
            welcomeAutoSendEnabled: !manualEnabled,
          },
        );
        const updatedBot = response.data;
        setWelcomeBot(updatedBot);
        setBotMessage(updatedBot?.welcomeMessage ?? "");
        toast.success(
          manualEnabled
            ? "Karşılama botu manuel moda alındı."
            : "Karşılama botu otomatik moda alındı.",
        );
      } catch (error: any) {
        toast.error(
          error?.response?.data?.message ||
            "Karşılama botu ayarları kaydedilemedi.",
        );
      } finally {
        setBotSaving(false);
      }
    };

    void run();
  };

  const currentBotMode = welcomeBot?.welcomeManualPromptEnabled
    ? "Manuel"
    : "Otomatik";

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className={webConsoleInfoPanelClass}>
          <p className="text-xs font-semibold sm:text-sm">
            &quot;Karşılama Mesajı&quot; özelliğini devre dışı bırakmak
            isterseniz mesaj alanını boş bırakın
          </p>
          <p className="mt-4 text-xs font-semibold leading-6 sm:text-sm sm:leading-7">
            Mesaj içerisinde kullanıcı rumuzunun görünmesini istediğiniz yere{" "}
            <span className="font-extrabold text-white">[username]</span>{" "}
            şeklinde ekleyin
          </p>
          <div className={webConsoleExampleClass}>
            Örnek : Merhabalar HoşGeldiniz [username] 🌹
          </div>
        </div>

        {settingsLoading ? (
          <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
            Karşılama mesajı ayarı yükleniyor...
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            <TextArea
              rows={3}
              value={form.template}
              onChange={(value) => setForm({ template: value })}
              placeholder="Merhaba [username] Hoşgeldiniz"
            />

            <div className="h-px bg-gray-200" />

            <div className="flex justify-center pt-1">
              <button
                type="button"
                onClick={handleSave}
                disabled={settingsSaving}
                className={`w-full rounded-lg px-6 py-3 text-sm font-semibold text-white transition-colors sm:min-w-40 sm:w-auto ${
                  settingsSaving
                    ? "cursor-not-allowed bg-blue-400"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {settingsSaving ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-gray-900">
              Manuel / Otomatik Karşılama Botu
            </h3>
            <p className="mt-1 text-xs font-medium leading-5 text-gray-500">
              AI karşılama botunun mesajını ve çalışma modunu buradan düzeltin.
            </p>
          </div>
          {welcomeBot && (
            <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
              {welcomeBot.username} • {currentBotMode}
            </span>
          )}
        </div>

        {botLoading ? (
          <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
            Karşılama botu yükleniyor...
          </div>
        ) : !welcomeBot ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            Yapay zeka karşılama botu bulunamadı. Bot kontrol bölümünde bir
            botu yapay zeka botu olarak ayarlayın.
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <TextArea
              rows={3}
              value={botMessage}
              onChange={setBotMessage}
              placeholder="Örn: HOŞGELDİNİZ [username] 🍫☕"
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => saveWelcomeBot(false)}
                disabled={botSaving}
                className={`rounded-xl border px-4 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  !welcomeBot.welcomeManualPromptEnabled
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                <span className="block text-sm font-extrabold">
                  Otomatik Bot Göndersin
                </span>
                <span className="mt-1 block text-xs font-medium">
                  Kullanıcı girişinde bot mesajı kendisi yollar.
                </span>
              </button>
              <button
                type="button"
                onClick={() => saveWelcomeBot(true)}
                disabled={botSaving}
                className={`rounded-xl border px-4 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  welcomeBot.welcomeManualPromptEnabled
                    ? "border-indigo-200 bg-indigo-50 text-indigo-800"
                    : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                <span className="block text-sm font-extrabold">
                  Manuel Karşılama Kutusu
                </span>
                <span className="mt-1 block text-xs font-medium">
                  Otomatik mesaj gitmez; tıklanınca Web Console mesajı gider.
                </span>
              </button>
            </div>

            {botSaving && (
              <p className="text-center text-xs font-semibold text-gray-500">
                Karşılama botu kaydediliyor...
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const RootOperationsView = () => {
  const apiClient = useMemo(() => getClientApiClient(), []);
  const [form, setForm] = useState<RootPasswordFormState>(
    defaultRootPasswordForm,
  );
  const [repairing, setRepairing] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const updateField = <K extends keyof RootPasswordFormState>(
    key: K,
    value: RootPasswordFormState[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleRepair = () => {
    const run = async () => {
      try {
        setRepairing(true);
        const response = await apiClient.post<{ message?: string }>(
          "/system-settings/root/repair",
        );
        toast.success(response.data?.message || "Root hesabı onarıldı.");
      } catch (error: any) {
        toast.error(
          error?.response?.data?.message || "Root hesabı onarılamadı.",
        );
      } finally {
        setRepairing(false);
      }
    };

    void run();
  };

  const handleChangePassword = () => {
    const trimmedPassword = form.password.trim();
    const trimmedRepeat = form.passwordRepeat.trim();

    if (!trimmedPassword || !trimmedRepeat) {
      toast.error("Yeni şifre ve tekrar alanı zorunludur.");
      return;
    }

    if (trimmedPassword !== trimmedRepeat) {
      toast.error("Şifreler eşleşmiyor.");
      return;
    }

    const run = async () => {
      try {
        setChangingPassword(true);
        const response = await apiClient.post<{ message?: string }>(
          "/system-settings/root/change-password",
          {
            password: trimmedPassword,
          },
        );
        setForm(defaultRootPasswordForm);
        toast.success(response.data?.message || "Root şifresi değiştirildi.");
      } catch (error: any) {
        toast.error(
          error?.response?.data?.message || "Root şifresi değiştirilemedi.",
        );
      } finally {
        setChangingPassword(false);
      }
    };

    void run();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className={webConsoleInfoPanelClass}>
          <p className="text-sm font-semibold leading-6 sm:text-[0.95rem] sm:leading-7">
            Root&apos;un tüm yetkilerini doldurur, kilitliyse açar, üyelik
            zamanını 2030 yılına kadar uzatır, rütbesini sistemde en yüksek olan
            rütbe yapar, korumaya alır ve sitedeyse düşürür.
          </p>
          <button
            type="button"
            onClick={handleRepair}
            disabled={repairing || changingPassword}
            className={`${webConsoleInfoActionClass} ${
              repairing || changingPassword
                ? webConsoleInfoActionDisabledClass
                : ""
            }`}
          >
            {repairing ? "Onarılıyor..." : "Root'u Onar"}
          </button>
        </div>

        <div className="mt-4 border-t border-gray-200 pt-4">
          <p className="text-sm text-gray-700 sm:text-[0.95rem]">
            Root&apos;un şifresini değiştirin (root sitedeyse düşer).
          </p>

          <div className="mt-4 space-y-4">
            <div className="border-t border-gray-200 pt-3">
              <TextInput
                value={form.password}
                onChange={(value) => updateField("password", value)}
                placeholder="Yeni şifre"
                type="password"
              />
            </div>

            <div className="border-t border-gray-200 pt-3">
              <TextInput
                value={form.passwordRepeat}
                onChange={(value) => updateField("passwordRepeat", value)}
                placeholder="Şifre Tekrar"
                type="password"
              />
            </div>

            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={handleChangePassword}
                disabled={repairing || changingPassword}
                className={`w-full rounded-lg px-6 py-3 text-sm font-semibold text-white transition-colors sm:min-w-40 sm:w-auto ${
                  repairing || changingPassword
                    ? "cursor-not-allowed bg-blue-400"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {changingPassword ? "Değiştiriliyor..." : "Şifre Değiştir"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const SystemMessageView = () => {
  const apiClient = useMemo(() => getClientApiClient(), []);
  const [form, setForm] = useState<SystemMessageFormState>(
    defaultSystemMessageForm,
  );
  const [sending, setSending] = useState(false);
  const [cooldownRemainingMs, setCooldownRemainingMs] = useState(0);

  useEffect(() => {
    const readRemainingMs = () => {
      if (typeof window === "undefined") return 0;
      const rawValue = window.localStorage.getItem(SYSTEM_MESSAGE_COOLDOWN_KEY);
      const lastSentAt = rawValue ? Number(rawValue) : NaN;
      if (!Number.isFinite(lastSentAt)) return 0;
      return Math.max(
        0,
        SYSTEM_MESSAGE_COOLDOWN_MS - (Date.now() - lastSentAt),
      );
    };

    setCooldownRemainingMs(readRemainingMs());

    const intervalId = window.setInterval(() => {
      setCooldownRemainingMs(readRemainingMs());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  const handleSend = () => {
    const trimmedContent = form.content.trim();
    if (!trimmedContent) {
      toast.error("Sistem mesajı boş bırakılamaz.");
      return;
    }
    if (cooldownRemainingMs > 0) {
      const remainingMinutes = Math.ceil(cooldownRemainingMs / 60000);
      toast.error(
        `Yeni sistem mesajı göndermek için ${remainingMinutes} dakika bekleyin.`,
      );
      return;
    }

    const run = async () => {
      try {
        setSending(true);
        const response = await apiClient.post<{ message?: string }>(
          "/system-settings/system-message",
          {
            content: trimmedContent,
          },
        );
        if (typeof window !== "undefined") {
          window.localStorage.setItem(
            SYSTEM_MESSAGE_COOLDOWN_KEY,
            String(Date.now()),
          );
        }
        setCooldownRemainingMs(SYSTEM_MESSAGE_COOLDOWN_MS);
        setForm(defaultSystemMessageForm);
        toast.success(response.data?.message || "Sistem mesajı gönderildi.");
      } catch (error: any) {
        toast.error(
          error?.response?.data?.message || "Sistem mesajı gönderilemedi.",
        );
      } finally {
        setSending(false);
      }
    };

    void run();
  };

  const cooldownLabel =
    cooldownRemainingMs > 0
      ? `${Math.ceil(cooldownRemainingMs / 60000)} dk sonra tekrar gönderilebilir`
      : "Sistem mesajı tüm odalardaki aktif kullanıcılara gönderilir";

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="border-b border-gray-200 pb-4">
          <h4 className="text-sm font-medium text-gray-700 sm:text-[1.05rem]">
            Sistem Mesajı
          </h4>
        </div>

        <div className={webConsoleInfoPanelClass}>
          <p className="text-sm font-semibold leading-7 sm:text-[1.05rem] sm:leading-8">
            Buradan göndereceğiniz mesajlar sitenizdeki tüm odalardaki aktif
            kullanıcılara Sistem Mesajı olarak iletilecektir
          </p>
          <p className="mt-2 text-xs font-medium text-blue-100 sm:text-sm">
            {cooldownLabel}
          </p>
        </div>

        <div className="mt-4">
          <FieldLabel>Mesajınız</FieldLabel>
          <div className="mt-4 border-t border-gray-200 pt-3">
            <TextArea
              rows={8}
              value={form.content}
              onChange={(value) => setForm({ content: value })}
              placeholder="Mesaj..."
            />
          </div>
        </div>

        <div className="flex justify-center pt-7">
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || cooldownRemainingMs > 0}
            className={`w-full rounded-lg px-6 py-3 text-sm font-semibold text-white transition-colors sm:min-w-40 sm:w-auto ${
              sending || cooldownRemainingMs > 0
                ? "cursor-not-allowed bg-blue-400"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {sending
              ? "Gönderiliyor..."
              : cooldownRemainingMs > 0
                ? "Beklemede..."
                : "Gönder"}
          </button>
        </div>
      </div>
    </div>
  );
};

const FloodBanView = () => {
  const apiClient = useMemo(() => getClientApiClient(), []);
  const [items, setItems] = useState<FloodBanListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get<{
          items?: FloodBanListItem[];
        }>("/security-settings/flood-bans");
        if (cancelled) return;
        setItems(
          Array.isArray(response.data?.items) ? response.data.items : [],
        );
      } catch (error) {
        if (!cancelled) {
          toast.error("Flood ban listesi alınamadı.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [apiClient]);

  const handleClearAll = () => {
    const run = async () => {
      try {
        setClearing(true);
        const response = await apiClient.post<{
          message?: string;
        }>("/security-settings/flood-bans/clear-all");
        setItems([]);
        toast.success(response.data?.message || "Tüm sunucu banları açıldı.");
      } catch (error: any) {
        toast.error(
          error?.response?.data?.message || "Sunucu banları açılamadı.",
        );
      } finally {
        setClearing(false);
      }
    };

    void run();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className={webConsoleInfoPanelClass}>
          <p className="text-sm font-semibold leading-6 sm:text-[0.95rem] sm:leading-7">
            Bu Listede Sunucu Tarafından Saldırı Olarak Algılanıp, Sunucu
            Tarafından Banlanmış Ip Adreslerinin Listesi Bulunmaktadır.
          </p>
          <button
            type="button"
            onClick={handleClearAll}
            disabled={loading || clearing}
            className={`${webConsoleInfoActionClass} ${
              loading || clearing ? webConsoleInfoActionDisabledClass : ""
            }`}
          >
            {clearing ? "Açılıyor..." : "Tüm Sunucu Banlarını Aç"}
          </button>
        </div>

        <div className="mt-4 border-t border-gray-200 pt-4">
          {loading ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
              Flood ban listesi yükleniyor...
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-500">
              Aktif flood ban kaydı bulunmuyor.
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3"
                >
                  <div className="flex flex-col gap-1 text-sm text-gray-800 sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-semibold">{item.ipAddress}</span>
                    <span className="text-xs text-gray-500">
                      {item.expiresAt
                        ? `Bitiş: ${new Date(item.expiresAt).toLocaleString(
                            "tr-TR",
                          )}`
                        : "Süresiz"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-600">
                    {item.reason} · {item.source}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const SummaryCard = ({
  title,
  value,
  icon: Icon,
  gradient,
  subline,
}: {
  title: string;
  value: number;
  icon: any;
  gradient: string;
  subline: React.ReactNode;
}) => (
  <div className="group relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] transition-all hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] hover:-translate-y-1">
    <div
      className={`absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br ${gradient} opacity-5 group-hover:opacity-10 transition-opacity`}
    />
    <div className="relative flex items-center justify-between">
      <div className="space-y-1">
        <p className="text-[13px] font-semibold text-gray-500 uppercase tracking-tight">
          {title}
        </p>
        <p className="text-3xl font-extrabold text-gray-900">
          {value.toLocaleString("tr-TR")}
        </p>
      </div>
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${gradient} shadow-lg shadow-blue-500/10`}
      >
        <Icon className="h-6 w-6 text-white" />
      </div>
    </div>
    <div className="relative mt-5 flex items-center gap-2 border-t border-gray-50 pt-4">
      <div className="flex w-full items-center justify-between font-medium text-gray-600">
        <div className="flex items-center gap-1.5 text-xs sm:text-sm">
          {subline}
        </div>
        <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-gray-400 group-hover:translate-x-0.5 transition-all" />
      </div>
    </div>
  </div>
);

const ProgressList = ({
  items,
  type = "visitors",
}: {
  items: WebConsoleStatsListItem[];
  type?: "visitors" | "devices" | "browsers";
}) => {
  const getGradient = (index: number) => {
    const gradients = [
      "from-blue-500 to-indigo-600",
      "from-emerald-500 to-teal-600",
      "from-amber-500 to-orange-600",
      "from-rose-500 to-pink-600",
      "from-violet-500 to-purple-600",
    ];
    return gradients[index % gradients.length];
  };

  return (
    <div className="space-y-4">
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-gray-400">
          <Activity className="h-8 w-8 opacity-20" />
          <p className="mt-2 text-sm">Veri bulunamadı.</p>
        </div>
      ) : (
        items.map((item, index) => (
          <div key={item.label} className="group flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-gray-700 group-hover:text-blue-600 transition-colors">
                {item.label}
              </span>
              <span className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-400">
                  %{item.percent}
                </span>
                <span className="font-bold text-gray-900">{item.count}</span>
              </span>
            </div>
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className={`h-full rounded-full bg-gradient-to-r transition-all duration-1000 ease-out ${getGradient(index)}`}
                style={{
                  width: `${Math.max(item.percent, item.count > 0 ? 2 : 0)}%`,
                }}
              />
            </div>
          </div>
        ))
      )}
    </div>
  );
};

const StatsPanel = ({
  title,
  subtitle,
  icon: Icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: any;
  children: React.ReactNode;
}) => (
  <div className="flex flex-col rounded-2xl border border-gray-100 bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.03)] selection:bg-blue-50">
    <div className="mb-6 flex items-center justify-between border-b border-gray-50 pb-5">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div className="flex flex-col">
          <h4 className="text-base font-bold text-gray-900">{title}</h4>
          {subtitle && (
            <span className="text-xs font-medium text-gray-500">
              {subtitle}
            </span>
          )}
        </div>
      </div>
      <button className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-600">
        <TrendingUp className="h-4 w-4" />
      </button>
    </div>
    <div className="flex-1">{children}</div>
  </div>
);

const StatsView = () => {
  const apiClient = useMemo(() => getClientApiClient(), []);
  const [stats, setStats] = useState<WebConsoleStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchStats = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get<WebConsoleStatsResponse>(
          "/system-settings/web-console-stats",
        );
        if (!cancelled) {
          setStats(response.data);
        }
      } catch (error) {
        if (!cancelled) {
          toast.error("İstatistikler alınamadı.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchStats();

    return () => {
      cancelled = true;
    };
  }, [apiClient]);

  if (loading) {
    return (
      <div className="space-y-4">
        <StatsSkeleton />
      </div>
    );
  }

  const summary = stats?.summary ?? {
    registeredUsers: 0,
    registeredLast24Hours: 0,
    staffUsers: 0,
    staffFemaleCount: 0,
    staffMaleCount: 0,
    maleUsers: 0,
    maleActivePercent: 0,
    femaleUsers: 0,
    femaleActivePercent: 0,
    loginsLast30Days: 0,
    loginsLast7Days: 0,
    adminActionsLast30Days: 0,
    adminActionsLast24Hours: 0,
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryCard
          title="Kayıtlı Kişi"
          value={summary.registeredUsers}
          icon={Users}
          gradient="from-blue-600 to-indigo-600"
          subline={
            <>
              <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
              <span className="font-bold text-emerald-500">
                {summary.registeredLast24Hours}
              </span>
              <span className="text-gray-400">son 24 saat</span>
            </>
          }
        />
        <SummaryCard
          title="Toplam Görevli"
          value={summary.staffUsers}
          icon={ShieldCheck}
          gradient="from-violet-600 to-purple-600"
          subline={
            <div className="flex gap-3">
              <span className="flex items-center gap-1 font-bold text-pink-500">
                <span className="h-1.5 w-1.5 rounded-full bg-pink-500" />
                {summary.staffFemaleCount}
              </span>
              <span className="text-gray-200">|</span>
              <span className="flex items-center gap-1 font-bold text-blue-500">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                {summary.staffMaleCount}
              </span>
            </div>
          }
        />
        <SummaryCard
          title="Toplam Erkek"
          value={summary.maleUsers}
          icon={User}
          gradient="from-blue-500 to-cyan-500"
          subline={
            <>
              <div className="flex w-full items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full bg-blue-500"
                    style={{ width: `${summary.maleActivePercent}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-blue-500">
                  %{summary.maleActivePercent} aktif
                </span>
              </div>
            </>
          }
        />
        <SummaryCard
          title="Toplam Kadın"
          value={summary.femaleUsers}
          icon={User}
          gradient="from-pink-500 to-rose-500"
          subline={
            <>
              <div className="flex w-full items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full bg-pink-500"
                    style={{ width: `${summary.femaleActivePercent}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-pink-500">
                  %{summary.femaleActivePercent} aktif
                </span>
              </div>
            </>
          }
        />
        <SummaryCard
          title="Girişler"
          value={summary.loginsLast30Days}
          icon={LogIn}
          gradient="from-emerald-500 to-teal-500"
          subline={
            <>
              <Clock className="h-3.5 w-3.5 text-emerald-500" />
              <span className="font-bold text-emerald-500">
                {summary.loginsLast7Days}
              </span>
              <span className="text-gray-400">son 1 hafta</span>
            </>
          }
        />
        <SummaryCard
          title="Panel Hareketleri"
          value={summary.adminActionsLast30Days}
          icon={Activity}
          gradient="from-amber-500 to-orange-500"
          subline={
            <>
              <Activity className="h-3.5 w-3.5 text-amber-500" />
              <span className="font-bold text-amber-500">
                {summary.adminActionsLast24Hours}
              </span>
              <span className="text-gray-400">son 24 saat</span>
            </>
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <StatsPanel
          title="En Çok Uğrayanlar"
          subtitle="Son 30 günlük aktiflik"
          icon={TrendingUp}
        >
          <ProgressList items={stats?.topVisitors ?? []} />
        </StatsPanel>

        <div className="flex flex-col gap-6">
          <StatsPanel
            title="Cihaz Kullanımları"
            subtitle="Cihaz dağılımları"
            icon={Smartphone}
          >
            <ProgressList
              items={stats?.deviceUsage.devices ?? []}
              type="devices"
            />
          </StatsPanel>

          <StatsPanel
            title="Tarayıcı Verileri"
            subtitle="En çok kullanılan tarayıcılar"
            icon={Globe}
          >
            <ProgressList
              items={stats?.deviceUsage.browsers ?? []}
              type="browsers"
            />
          </StatsPanel>
        </div>
      </div>
    </div>
  );
};

const AnimationsView = () => {
  const apiClient = useMemo(() => getClientApiClient(), []);
  const [data, setData] = useState<WebConsoleAnimationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingFileName, setDeletingFileName] = useState<string | null>(null);
  const [replacingFileName, setReplacingFileName] = useState<string | null>(
    null,
  );
  const addInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  const getImageDimensions = (file: File) =>
    new Promise<{ width: number; height: number }>((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const image = new Image();

      image.onload = () => {
        resolve({
          width: image.naturalWidth,
          height: image.naturalHeight,
        });
        URL.revokeObjectURL(objectUrl);
      };

      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error(`${file.name} dosyasının boyutu okunamadı.`));
      };

      image.src = objectUrl;
    });

  useEffect(() => {
    let cancelled = false;

    const fetchAnimations = async (showErrorToast = true) => {
      try {
        setLoading(true);
        const response = await apiClient.get<WebConsoleAnimationsResponse>(
          "/system-settings/animations",
        );
        if (!cancelled) {
          setData(response.data);
        }
      } catch (error) {
        if (!cancelled && showErrorToast) {
          toast.error("Animasyon listesi alınamadı.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void fetchAnimations(false);

    return () => {
      cancelled = true;
    };
  }, [apiClient]);

  const fetchAnimations = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<WebConsoleAnimationsResponse>(
        "/system-settings/animations",
      );
      setData(response.data);
    } catch (error) {
      toast.error("Animasyon listesi alınamadı.");
    } finally {
      setLoading(false);
    }
  };

  const getAnimationAssetUrl = (item: WebConsoleAnimationItem) =>
    `${item.url}?v=${encodeURIComponent(item.updatedAt)}`;

  const validateFiles = async (
    files: File[],
    options?: { replacing?: boolean },
  ) => {
    if (files.length === 0) {
      throw new Error("Lütfen en az bir animasyon seçin.");
    }

    const allowedExtensions = new Set(["gif", "png", "jpg", "jpeg", "webp"]);
    const currentCount = data?.totalCount ?? 0;
    const maxCount = data?.maxCount ?? 500;
    if (!options?.replacing && currentCount + files.length > maxCount) {
      throw new Error(`En fazla ${maxCount} animasyon yüklenebilir.`);
    }

    const fileDimensions = await Promise.all(
      files.map(async (file) => {
        const extension = file.name
          .split(".")
          .pop()
          ?.toLocaleLowerCase("tr-TR");
        if (!extension || !allowedExtensions.has(extension)) {
          throw new Error(
            `${file.name} desteklenmiyor. Yalnızca GIF, PNG, JPG, JPEG ve WEBP yükleyebilirsiniz.`,
          );
        }

        const dimensions = await getImageDimensions(file);
        return {
          file,
          ...dimensions,
        };
      }),
    );

    const targetWidth = fileDimensions[0]?.width ?? null;
    const targetHeight = fileDimensions[0]?.height ?? null;

    const invalidFile = fileDimensions.find(
      (item) => item.width !== targetWidth || item.height !== targetHeight,
    );

    if (invalidFile && targetWidth && targetHeight) {
      throw new Error(
        `Aynı yüklemede seçtiğiniz tüm animasyonlar ${targetWidth}x${targetHeight} boyutunda olmalı. ${invalidFile.file.name} buna uymuyor.`,
      );
    }
  };

  const handleAddFiles = async (fileList: FileList | null) => {
    const files = Array.from(fileList ?? []);
    if (files.length === 0) return;

    try {
      await validateFiles(files);
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));

      setUploading(true);
      await apiClient.post("/system-settings/animations", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      toast.success(
        files.length === 1
          ? "Animasyon eklendi."
          : `${files.length} animasyon eklendi.`,
      );
      notifyAnimationCatalogUpdated();
      await fetchAnimations();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Animasyonlar eklenemedi.";
      toast.error(message);
    } finally {
      setUploading(false);
      if (addInputRef.current) {
        addInputRef.current.value = "";
      }
    }
  };

  const handleDelete = async (item: WebConsoleAnimationItem) => {
    const confirmed = window.confirm(
      `${item.fileName} animasyonunu silmek istediğinize emin misiniz?`,
    );
    if (!confirmed) return;

    try {
      setDeletingFileName(item.fileName);
      await apiClient.delete(
        `/system-settings/animations/${encodeURIComponent(item.fileName)}`,
      );
      toast.success("Animasyon silindi.");
      notifyAnimationCatalogUpdated();
      await fetchAnimations();
    } catch (error) {
      toast.error("Animasyon silinemedi.");
    } finally {
      setDeletingFileName(null);
    }
  };

  const handleReplaceFile = async (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file || !replacingFileName) return;

    const targetItem = data?.items.find(
      (item) => item.fileName === replacingFileName,
    );

    try {
      await validateFiles([file], { replacing: true });

      if (targetItem) {
        const extension = file.name
          .split(".")
          .pop()
          ?.toLocaleLowerCase("tr-TR");
        if (extension !== targetItem.extension.toLocaleLowerCase("tr-TR")) {
          throw new Error(
            "Değiştirilen dosya mevcut animasyonla aynı uzantıda olmalı.",
          );
        }
      }

      const formData = new FormData();
      formData.append("file", file);

      const encodedFileName = encodeURIComponent(replacingFileName);
      await apiClient.put(
        `/system-settings/animations/${encodedFileName}`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        },
      );
      toast.success("Animasyon güncellendi.");
      notifyAnimationCatalogUpdated();
      await fetchAnimations();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Animasyon güncellenemedi.";
      toast.error(message);
    } finally {
      setReplacingFileName(null);
      if (replaceInputRef.current) {
        replaceInputRef.current.value = "";
      }
    }
  };

  const allItems = data?.items ?? [];
  const gifCount = allItems.filter((item) => item.extension === "gif").length;
  return (
    <div className="space-y-4">
      {loading && allItems.length === 0 ? (
        <AnimationsSkeleton />
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-[#d7e3ea] bg-white p-4 shadow-sm">
            <div className={webConsoleInfoPanelClass}>
              <p className="text-xs font-semibold leading-6 sm:text-sm sm:leading-7">
                Bu alanda siteye eklenmiş animasyon dosyalarının güncel listesi
                gösterilir. Chat animasyon seçim alanında görünen içerikler
                buradan önizlenebilir.
              </p>
              <div className="mt-4 flex flex-wrap gap-3 text-xs font-semibold text-white/90">
                <span className="rounded-full bg-white/10 px-3 py-1.5">
                  Toplam: {allItems.length}/{data?.maxCount ?? 500}
                </span>
                <span className="rounded-full bg-white/10 px-3 py-1.5">
                  GIF: {gifCount}
                </span>
                <span className="rounded-full bg-white/10 px-3 py-1.5">
                  Diğer: {allItems.length - gifCount}
                </span>
                <span className="rounded-full bg-white/10 px-3 py-1.5">
                  Kalan:{" "}
                  {data?.remainingSlots ?? Math.max(500 - allItems.length, 0)}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-4 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-800 md:text-base">
                    Yeni animasyon ekle veya mevcut olanı değiştir
                  </p>
                  <p className="mt-1 text-xs text-gray-500 md:text-sm">
                    En fazla {data?.maxCount ?? 500} animasyon tutulur.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 md:justify-end">
                  <button
                    type="button"
                    onClick={() => addInputRef.current?.click()}
                    disabled={
                      uploading ||
                      loading ||
                      (data?.remainingSlots ??
                        Math.max(500 - allItems.length, 0)) <= 0
                    }
                    className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-white shadow-sm transition-all ${
                      uploading ||
                      loading ||
                      (data?.remainingSlots ??
                        Math.max(500 - allItems.length, 0)) <= 0
                        ? "cursor-not-allowed bg-blue-300"
                        : "bg-blue-600 hover:-translate-y-0.5 hover:bg-blue-700"
                    }`}
                  >
                    <Upload className="h-4 w-4" />
                    {uploading ? "Yükleniyor..." : "Animasyon Ekle"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void fetchAnimations()}
                    disabled={loading}
                    className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold transition-all ${
                      loading
                        ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400"
                        : "border-gray-300 bg-white text-gray-700 hover:-translate-y-0.5 hover:border-blue-400 hover:text-blue-600"
                    }`}
                  >
                    <RefreshCw className="h-4 w-4" />
                    Yenile
                  </button>
                </div>
              </div>
              <input
                ref={addInputRef}
                type="file"
                accept=".gif,.png,.jpg,.jpeg,.webp,image/gif,image/png,image/jpeg,image/webp"
                multiple
                className="hidden"
                onChange={(event) => void handleAddFiles(event.target.files)}
              />
              <input
                ref={replaceInputRef}
                type="file"
                accept=".gif,.png,.jpg,.jpeg,.webp,image/gif,image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(event) => void handleReplaceFile(event.target.files)}
              />
            </div>

            {allItems.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
                Henüz listelenecek animasyon bulunmuyor.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {allItems.map((item: WebConsoleAnimationItem) => (
                  <div
                    key={item.fileName}
                    className="group overflow-hidden rounded-xl border border-gray-200 bg-gray-50 transition-all hover:border-blue-400 hover:shadow-md"
                  >
                    <div className="flex aspect-square items-center justify-center bg-white p-2">
                      <img
                        src={getAnimationAssetUrl(item)}
                        alt={item.fileName}
                        loading="lazy"
                        className="max-h-full max-w-full rounded-md object-contain transition-transform group-hover:scale-110"
                      />
                    </div>
                    <div className="space-y-1 border-t border-gray-200 px-3 py-2">
                      <p
                        className="truncate text-[11px] font-semibold text-gray-800"
                        title={item.fileName}
                      >
                        {item.fileName}
                      </p>
                      <div className="flex items-center justify-between gap-2 text-[10px] text-gray-500">
                        <span className="rounded-full bg-blue-50 px-1.5 py-0.5 font-bold uppercase text-blue-600">
                          {item.extension}
                        </span>
                        {item.sizeBytes > 0 && (
                          <span>{formatBytes(item.sizeBytes)}</span>
                        )}
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setReplacingFileName(item.fileName);
                            replaceInputRef.current?.click();
                          }}
                          className="inline-flex min-h-10 w-full items-center justify-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] font-semibold text-blue-700 transition-colors hover:border-blue-300 hover:bg-blue-100"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Değiştir
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(item)}
                          disabled={deletingFileName === item.fileName}
                          className={`inline-flex min-h-10 w-full items-center justify-center gap-1 rounded-lg px-3 py-2 text-[11px] font-semibold text-white transition-colors ${
                            deletingFileName === item.fileName
                              ? "cursor-not-allowed bg-red-300"
                              : "bg-red-500 hover:bg-red-600"
                          }`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {deletingFileName === item.fileName
                            ? "Siliniyor..."
                            : "Sil"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const RestoreView = () => {
  const apiClient = useMemo(() => getClientApiClient(), []);
  const [backups, setBackups] = useState<BackupFileInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<BackupFileInfo | null>(
    null,
  );
  const [restoreConfirmStep, setRestoreConfirmStep] = useState<1 | 2>(1);
  const [restoringBackupId, setRestoringBackupId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;

    const fetchBackups = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get<BackupFileInfo[]>("/backup/list");
        if (!cancelled) {
          setBackups(response.data ?? []);
        }
      } catch (error) {
        console.error("Backup listesi alınamadı:", error);
        if (!cancelled) {
          toast.error("Backup listesi alınamadı.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void fetchBackups();

    return () => {
      cancelled = true;
    };
  }, [apiClient]);

  const fetchBackups = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<BackupFileInfo[]>("/backup/list");
      setBackups(response.data ?? []);
    } catch (error) {
      console.error("Backup listesi yenilenemedi:", error);
      toast.error("Backup listesi yenilenemedi.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    if (creatingBackup || restoringBackupId) return;

    try {
      setCreatingBackup(true);
      await apiClient.post("/backup/create");
      toast.success("Manuel backup oluşturuldu.");
      await fetchBackups();
    } catch (error) {
      console.error("Manuel backup oluşturulamadı:", error);
      toast.error("Manuel backup oluşturulamadı.");
    } finally {
      setCreatingBackup(false);
    }
  };

  const openRestoreConfirm = (backup: BackupFileInfo) => {
    if (creatingBackup || restoringBackupId) return;
    setRestoreTarget(backup);
    setRestoreConfirmStep(1);
  };

  const closeRestoreConfirm = () => {
    if (restoringBackupId) return;
    setRestoreTarget(null);
    setRestoreConfirmStep(1);
  };

  const handleRestore = async () => {
    if (!restoreTarget || restoringBackupId) return;

    try {
      setRestoringBackupId(restoreTarget.id);
      const response = await apiClient.post<BackupRestoreResponse>(
        `/backup/restore/${encodeURIComponent(restoreTarget.id)}`,
      );
      const restoredCounts = response.data?.restoredCounts;
      toast.success(
        response.data?.message ||
          `Sistem geri yüklendi. Kullanıcı: ${restoredCounts?.users ?? 0}`,
      );
      setRestoreTarget(null);
      setRestoreConfirmStep(1);
      await fetchBackups();
    } catch (error) {
      console.error("Sistem geri yükleme başarısız:", error);
      toast.error("Sistem geri yükleme başarısız.");
    } finally {
      setRestoringBackupId(null);
    }
  };

  const busy = creatingBackup || Boolean(restoringBackupId);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#d7e3ea] bg-white p-4 shadow-sm">
        <div className={webConsoleInfoPanelClass}>
          <p className="text-xs font-semibold leading-6 sm:text-sm sm:leading-7">
            Bu bölümde otomatik ve manuel alınmış sistem backup dosyaları
            listelenir. Seçilen backup geri yüklendiğinde kullanıcılara sayaç
            gösterilir ve oturumlar güvenli şekilde kapatılır.
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-xs font-semibold text-white/90">
            <span className="rounded-full bg-white/10 px-3 py-1.5">
              Toplam backup: {backups.length}
            </span>
            <span className="rounded-full bg-white/10 px-3 py-1.5">
              Şifreler korunur
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-800 md:text-base">
              Sistem backup listesi
            </p>
            <p className="mt-1 text-xs text-gray-500 md:text-sm">
              Geri yükleme öncesinde isterseniz güncel durum için manuel backup
              oluşturabilirsiniz.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 md:justify-end">
            <button
              type="button"
              onClick={() => void handleCreateBackup()}
              disabled={busy}
              className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-white shadow-sm transition-all ${
                busy
                  ? "cursor-not-allowed bg-emerald-300"
                  : "bg-emerald-600 hover:-translate-y-0.5 hover:bg-emerald-700"
              }`}
            >
              <RefreshCw className="h-4 w-4" />
              {creatingBackup ? "Oluşturuluyor..." : "Manuel Backup Oluştur"}
            </button>
            <button
              type="button"
              onClick={() => void fetchBackups()}
              disabled={loading || busy}
              className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold transition-all ${
                loading || busy
                  ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400"
                  : "border-gray-300 bg-white text-gray-700 hover:-translate-y-0.5 hover:border-blue-400 hover:text-blue-600"
              }`}
            >
              <RefreshCw className="h-4 w-4" />
              Yenile
            </button>
          </div>
        </div>

        {loading && backups.length === 0 ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="h-20 animate-pulse rounded-lg border border-gray-200 bg-gray-100"
              />
            ))}
          </div>
        ) : backups.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
            Henüz listelenecek backup bulunmuyor.
          </div>
        ) : (
          <div className="space-y-3">
            {backups.map((backup) => (
              <div
                key={backup.id}
                className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-800">
                    {backup.filename}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
                    <span>{formatBackupDate(backup)}</span>
                    <span>{formatBytes(backup.size)}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openRestoreConfirm(backup)}
                  disabled={busy}
                  className={`inline-flex h-10 shrink-0 items-center justify-center rounded-lg px-4 text-sm font-semibold text-white transition-all ${
                    restoringBackupId === backup.id
                      ? "cursor-not-allowed bg-purple-300"
                      : busy
                        ? "cursor-not-allowed bg-gray-300"
                        : "bg-purple-600 hover:-translate-y-0.5 hover:bg-purple-700"
                  }`}
                >
                  {restoringBackupId === backup.id
                    ? "Geri yükleniyor..."
                    : "Geri Yükle"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {restoreTarget && (
        <div className="fixed inset-0 z-[310] flex items-center justify-center bg-black/45 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-gray-200 px-5 py-4">
              <p className="text-base font-semibold text-gray-900">
                {restoreConfirmStep === 1 ? "Geri yükleme onayı" : "Son onay"}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {restoreTarget.filename}
              </p>
            </div>
            <div className="space-y-3 px-5 py-5 text-sm leading-6 text-gray-700">
              {restoreConfirmStep === 1 ? (
                <>
                  <p>
                    Bu backup geri yüklendiğinde roller, kullanıcılar, botlar,
                    durum modları ve sistem ayarları seçilen backup durumuna
                    döner.
                  </p>
                  <p>
                    Mevcut kullanıcıların şifre hashleri korunur; backup içinde
                    şifre yoksa ve mevcut kullanıcı bulunamazsa o kullanıcı
                    restore edilmez.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-red-600">
                    Bu işlem canlı sistemi etkiler.
                  </p>
                  <p>
                    Kullanıcılara geri yükleme sayacı gösterilecek ve sayaç
                    sonunda oturumlar ana sayfaya yönlendirilecek.
                  </p>
                </>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 px-5 pb-5">
              <button
                type="button"
                onClick={closeRestoreConfirm}
                disabled={Boolean(restoringBackupId)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-400"
              >
                Vazgeç
              </button>
              {restoreConfirmStep === 1 ? (
                <button
                  type="button"
                  onClick={() => setRestoreConfirmStep(2)}
                  className="rounded-lg bg-purple-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-purple-700"
                >
                  Devam Et
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleRestore()}
                  disabled={Boolean(restoringBackupId)}
                  className="rounded-lg bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
                >
                  {restoringBackupId ? "Geri yükleniyor..." : "Geri Yükle"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


type HeaderRosterCandidate = {
  id: number;
  username: string;
  icon?: string | null;
  gender?: string | null;
  roleName?: string | null;
  starCount?: number | null;
  starColor?: string | null;
};

type HeaderRosterSettingsPayload = {
  chatHeaderLogo?: string | null;
  siteOwnerUsernames?: string[] | null;
  managerUsernames?: string[] | null;
};

const resolveConsoleMediaUrl = (path?: string | null) => {
  const value = String(path || "").trim();
  if (!value) return null;
  if (/^(data:|blob:|https?:\/\/)/i.test(value)) return value;
  const base = env.apiBaseUrl.replace(/\/api\/?$/, "").replace(/\/$/, "");
  return `${base}/${value.replace(/^\//, "")}`;
};

const HeaderRosterSettingsView = ({
  mode,
}: {
  mode: "owners" | "managers";
}) => {
  const client = useMemo(() => getClientApiClient(), []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [candidates, setCandidates] = useState<HeaderRosterCandidate[]>([]);
  const [selectedNames, setSelectedNames] = useState<string[]>([]);
  const [candidateName, setCandidateName] = useState("");
  const [chatHeaderLogo, setChatHeaderLogo] = useState<string>("");

  const isOwners = mode === "owners";

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const [settingsResponse, candidatesResponse] = await Promise.all([
          client.get<HeaderRosterSettingsPayload>("/system-settings"),
          client.get<HeaderRosterCandidate[]>("/system-settings/header-roster-candidates"),
        ]);
        if (cancelled) return;
        const settings = settingsResponse.data ?? {};
        setSelectedNames(
          (isOwners ? settings.siteOwnerUsernames : settings.managerUsernames) ?? [],
        );
        setChatHeaderLogo(String(settings.chatHeaderLogo ?? ""));
        setCandidates(Array.isArray(candidatesResponse.data) ? candidatesResponse.data : []);
      } catch (error) {
        console.error("Üst alan listesi alınamadı:", error);
        toast.error("Yetkili listesi alınamadı.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [client, isOwners]);

  const selectedCandidates = selectedNames.map((username) => {
    const found = candidates.find(
      (item) => item.username.toLocaleLowerCase("tr-TR") === username.toLocaleLowerCase("tr-TR"),
    );
    return found ?? { id: -1, username };
  });

  const availableCandidates = candidates.filter(
    (candidate) =>
      !selectedNames.some(
        (name) => name.toLocaleLowerCase("tr-TR") === candidate.username.toLocaleLowerCase("tr-TR"),
      ),
  );

  const addSelected = () => {
    const name = candidateName.trim();
    if (!name) return;
    setSelectedNames((current) => [...current, name]);
    setCandidateName("");
  };

  const move = (index: number, direction: -1 | 1) => {
    setSelectedNames((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const handleLogoFile = (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Lütfen bir görsel dosyası seçin.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setChatHeaderLogo(String(reader.result || ""));
    reader.readAsDataURL(file);
  };

  const save = async () => {
    try {
      setSaving(true);
      const payload: HeaderRosterSettingsPayload = isOwners
        ? { siteOwnerUsernames: selectedNames, chatHeaderLogo }
        : { managerUsernames: selectedNames };
      await client.put("/system-settings", payload);
      toast.success(isOwners ? "Site sahipleri ve üst logo kaydedildi." : "Yönetici listesi kaydedildi.");
      window.dispatchEvent(new CustomEvent("kingmobile:header-roster-updated"));
    } catch (error) {
      console.error("Üst alan ayarı kaydedilemedi:", error);
      toast.error("Ayarlar kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex min-h-[260px] items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm font-semibold text-slate-500">Yükleniyor...</div>;
  }

  return (
    <div className="space-y-5">
      <div className={`overflow-hidden rounded-2xl border ${isOwners ? "border-amber-200 bg-gradient-to-br from-amber-50 to-white" : "border-cyan-200 bg-gradient-to-br from-cyan-50 to-white"} shadow-sm`}>
        <div className="flex items-center justify-between border-b border-black/5 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${isOwners ? "bg-amber-500 text-white" : "bg-cyan-600 text-white"} shadow-lg`}>
              {isOwners ? <Crown className="h-5 w-5" /> : <UserCog className="h-5 w-5" />}
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">{isOwners ? "Site Sahipleri" : "Yönetici Listesi"}</h3>
              <p className="text-xs font-medium text-slate-500">Üst vitrinde gösterilecek yetkilileri seç ve sıralamasını belirle.</p>
            </div>
          </div>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-black text-slate-600">{selectedNames.length} kişi</span>
        </div>

        <div className="p-5">
          {isOwners ? (
            <div className="mb-5 rounded-2xl border border-amber-200/70 bg-white p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-800">
                <ImagePlus className="h-4 w-4 text-amber-600" /> Sohbet Üst Logo
              </div>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex h-20 w-32 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-[#08111d] p-2">
                  {chatHeaderLogo ? (
                    <img src={resolveConsoleMediaUrl(chatHeaderLogo) || ""} alt="Üst logo" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <span className="text-xs font-bold text-slate-500">Logo yok</span>
                  )}
                </div>
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={(event) => handleLogoFile(event.target.files?.[0])}
                    className="block w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs font-semibold text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-amber-500 file:px-3 file:py-2 file:font-bold file:text-white"
                  />
                  <button type="button" onClick={() => setChatHeaderLogo("")} className="mt-2 text-xs font-bold text-rose-500 hover:text-rose-600">Logoyu kaldır</button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row">
            <select value={candidateName} onChange={(event) => setCandidateName(event.target.value)} className="min-h-11 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-400">
              <option value="">Yetkili seç...</option>
              {availableCandidates.map((candidate) => (
                <option key={candidate.id} value={candidate.username}>{candidate.username} · ★ {candidate.starCount ?? 0} · {candidate.roleName || "Yetkili"}</option>
              ))}
            </select>
            <button type="button" onClick={addSelected} disabled={!candidateName} className={`rounded-xl px-5 py-2.5 text-sm font-black text-white disabled:opacity-40 ${isOwners ? "bg-amber-500 hover:bg-amber-600" : "bg-cyan-600 hover:bg-cyan-700"}`}>Listeye Ekle</button>
          </div>

          <div className="mt-4 space-y-2">
            {selectedCandidates.length ? selectedCandidates.map((user, index) => {
              const avatar = resolveConsoleMediaUrl(user.icon);
              return (
                <div key={`${user.username}-${index}`} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border ${isOwners ? "border-amber-300 bg-amber-50" : "border-cyan-300 bg-cyan-50"} text-sm font-black text-slate-700`}>
                    {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : user.username.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-black text-slate-900">{user.username}</div>
                    <div className="mt-0.5 text-[11px] font-semibold text-slate-500">{user.roleName || "Yetkili"} · ★ {user.starCount ?? 0}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => move(index, -1)} disabled={index === 0} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-25"><ArrowUp className="h-4 w-4" /></button>
                    <button type="button" onClick={() => move(index, 1)} disabled={index === selectedNames.length - 1} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-25"><ArrowDown className="h-4 w-4" /></button>
                    <button type="button" onClick={() => setSelectedNames((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="flex h-9 w-9 items-center justify-center rounded-xl border border-rose-100 bg-rose-50 text-rose-500 hover:bg-rose-100"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              );
            }) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-4 py-8 text-center text-sm font-semibold text-slate-400">Henüz kimse eklenmedi.</div>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button type="button" onClick={() => void save()} disabled={saving} className={`rounded-xl px-6 py-3 text-sm font-black text-white shadow-lg disabled:opacity-50 ${isOwners ? "bg-gradient-to-r from-amber-500 to-orange-500" : "bg-gradient-to-r from-cyan-600 to-blue-600"}`}>
          {saving ? "Kaydediliyor..." : "Değişiklikleri Kaydet"}
        </button>
      </div>
    </div>
  );
};

interface WebConsoleProps {
  view?: WebConsoleView;
  onViewChange?: (view: WebConsoleView) => void;
  currentUsername?: string | null;
}

export const WebConsole: React.FC<WebConsoleProps> = ({
  view: controlledView,
  onViewChange,
  currentUsername,
}) => {
  const [resetOpen, setResetOpen] = useState(false);
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [internalView, setInternalView] = useState<WebConsoleView>("grid");
  const view = controlledView ?? internalView;
  const isRootUser =
    String(currentUsername ?? "")
      .trim()
      .toLocaleLowerCase("tr-TR") === "root";
  const visibleCards = useMemo(
    () =>
      isRootUser
        ? cards.filter((card) =>
            ["Sistem Resetleme", "Karşılama Mesajı"].includes(card.title),
          )
        : cards,
    [isRootUser],
  );
  const effectiveView =
    isRootUser && !["grid", "welcome"].includes(view) ? "grid" : view;

  const setView = (nextView: WebConsoleView) => {
    if (controlledView === undefined) {
      setInternalView(nextView);
    }
    onViewChange?.(nextView);
  };

  const handleSystemResetConfirm = async () => {
    if (resetSubmitting) return;

    setResetSubmitting(true);
    try {
      const response = await getClientApiClient().post<SystemResetStartResponse>(
        "/system-settings/system-reset",
      );
      toast.success(response.data?.message || "Sistem resetleme başlatıldı.");
      window.dispatchEvent(
        new CustomEvent("kingmobile:system-reset-started", {
          detail: {
            ...response.data,
            message: "Sistem resetleniyor",
          },
        }),
      );
      setResetOpen(false);
    } catch (error) {
      console.error("Sistem resetleme başlatılamadı:", error);
      toast.error("Sistem resetleme başlatılamadı.");
    } finally {
      setResetSubmitting(false);
    }
  };

  return (
    <>
      {effectiveView === "grid" ? (
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-4">
          {visibleCards.map((card) => (
            <button
              key={card.title}
              type="button"
              onClick={() => {
                if (card.title === "Seo Ayarları") {
                  setView("seo");
                  return;
                }
                if (card.title === "Karşılama Mesajı") {
                  setView("welcome");
                  return;
                }
                if (card.title === "İstatistikler") {
                  setView("stats");
                  return;
                }
                if (card.title === "Root İşlemleri") {
                  setView("root");
                  return;
                }
                if (card.title === "Sistem Mesajı") {
                  setView("systemMessage");
                  return;
                }
                if (card.title === "Flood Ban İşlemleri") {
                  setView("floodBan");
                  return;
                }
                if (card.title === "Site Sahipleri") {
                  setView("siteOwners");
                  return;
                }
                if (card.title === "Yönetici Listesi") {
                  setView("managerList");
                  return;
                }
                if (card.title === "Animasyonlar") {
                  setView("animations");
                  return;
                }
                if (card.title === "Sistem Geri Yükleme") {
                  setView("restore");
                  return;
                }
                if (card.title === "Sistem Resetleme") {
                  setResetOpen(true);
                  return;
                }
                toast.info(`${card.title} bölümü henüz hazır değil.`);
              }}
              className={`flex min-h-[92px] flex-col items-center justify-center gap-2 rounded-sm border px-2.5 py-3 shadow-sm transition-colors duration-200 sm:min-h-[112px] sm:px-3 sm:py-4 ${getWebConsoleTileSurfaceClass(card.color)}`}
            >
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-sm ${card.color} text-base text-white shadow-sm ring-1 ring-white/20 sm:h-9 sm:w-9 sm:text-lg`}
              >
                <span aria-hidden>{card.icon}</span>
              </div>
              <span className="text-center text-[11px] font-semibold leading-snug text-white sm:text-xs">
                {card.title}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <>
          {effectiveView === "seo" ? (
            <SeoSettingsView />
          ) : effectiveView === "stats" ? (
            <StatsView />
          ) : effectiveView === "root" ? (
            <RootOperationsView />
          ) : effectiveView === "systemMessage" ? (
            <SystemMessageView />
          ) : effectiveView === "floodBan" ? (
            <FloodBanView />
          ) : effectiveView === "animations" ? (
            <AnimationsView />
          ) : effectiveView === "restore" ? (
            <RestoreView />
          ) : effectiveView === "siteOwners" ? (
            <HeaderRosterSettingsView mode="owners" />
          ) : effectiveView === "managerList" ? (
            <HeaderRosterSettingsView mode="managers" />
          ) : (
            <WelcomeMessageView />
          )}
        </>
      )}

      <SystemResetModal
        isOpen={resetOpen}
        onClose={() => {
          if (!resetSubmitting) setResetOpen(false);
        }}
        onConfirm={handleSystemResetConfirm}
        isSubmitting={resetSubmitting}
      />
    </>
  );
};
