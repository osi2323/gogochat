"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { HomePageHtmlBlock } from "@/components/auth/HomePageHtmlBlock";
import LoginForm from "@/components/auth/LoginForm";
import { HomeAuthCheck } from "@/components/auth/HomeAuthCheck";
import {
  DEFAULT_HOME_PAGE_BACKGROUND,
  extractHomePageBodyBackground,
  hasHomePageRootBackgroundStyle,
} from "@/lib/sanitizeHomePageHtml";
import type {
  LoginDesignType,
  MaintenanceModeSettings,
} from "@/services/systemSettingsService";
import {
  Crown,
  ShieldCheck,
  Apple,
  ChevronDown,
  CircleAlert,
  Download,
  Heart,
  Headphones,
  Info,
  Lock,
  Mail,
  MessageCircle,
  Mic,
  Play,
  Settings,
  Smartphone,
  UserRound,
  Wrench,
} from "lucide-react";
import { env } from "@/config/env";
import { io } from "socket.io-client";
import { getClientApiClient } from "@/lib/api/clientApi";

const resolveSiteName = (siteName?: string | null) =>
  siteName?.trim() ? siteName.trim() : "ChatsON";

const resolvePremiumText = (
  value: string | null | undefined,
  fallback: string,
) => (value?.trim() ? value.trim() : fallback);

const resolvePremiumStoreUrl = (value: string | null | undefined) => {
  const trimmedValue = value?.trim();
  if (!trimmedValue) return undefined;

  try {
    const url = new URL(trimmedValue);
    if (url.hostname.replace(/^www\./, "") === "segital.com") {
      return undefined;
    }
  } catch {
    return trimmedValue;
  }

  return trimmedValue;
};

const PREMIUM_FOOTER_BRAND = "ChatsON";

const extractFirstElementBackground = (
  html: string | null | undefined,
): string | null => {
  if (!html?.trim()) return null;
  const firstTagMatch = html.match(/<[^>]+style=["']([^"']*)["'][^>]*>/i);
  if (!firstTagMatch) return null;
  const styleValue = firstTagMatch[1];
  const bgDeclarations: string[] = [];
  const bgPattern = /background(?:-color|-image|-repeat|-position|-size)?\s*:\s*([^;]+)/gi;
  let m;
  while ((m = bgPattern.exec(styleValue)) !== null) {
    bgDeclarations.push(m[1].trim());
  }
  return bgDeclarations.join(" ") || null;
};

const resolveWrapperBackground = (
  html: string | null | undefined,
  imageUrl?: string,
) => {
  const hasHtmlContent = Boolean(html?.trim());
  const extracted = extractHomePageBodyBackground(html);

  if (imageUrl) {
    return {
      background: `transparent url(${imageUrl}) no-repeat center / cover`,
    } as const;
  }

  if (extracted.background) {
    return {
      background: extracted.background,
    } as const;
  }

  if (
    extracted.backgroundColor ||
    extracted.backgroundImage ||
    extracted.backgroundRepeat ||
    extracted.backgroundPosition ||
    extracted.backgroundSize
  ) {
    const parts: string[] = [];
    if (extracted.backgroundColor) parts.push(extracted.backgroundColor);
    if (extracted.backgroundImage) parts.push(extracted.backgroundImage);
    if (extracted.backgroundRepeat) parts.push(extracted.backgroundRepeat);
    if (extracted.backgroundPosition && extracted.backgroundSize) {
      parts.push(`${extracted.backgroundPosition} / ${extracted.backgroundSize}`);
    } else if (extracted.backgroundPosition) {
      parts.push(extracted.backgroundPosition);
    } else if (extracted.backgroundSize) {
      parts.push(`center / ${extracted.backgroundSize}`);
    }
    return { background: parts.filter(Boolean).join(' ') } as const;
  }

  if (hasHtmlContent) {
    const inlineBg = extractFirstElementBackground(html);
    if (inlineBg) {
      return { background: inlineBg } as const;
    }
    return { background: "#ffffff" } as const;
  }

  return { background: DEFAULT_HOME_PAGE_BACKGROUND } as const;
};

const resolveUrl = (path?: string | null) => {
  if (!path) return undefined;
  if (path.startsWith("data:") || path.startsWith("http")) return path;
  const publicImageBaseUrl =
    process.env.NEXT_PUBLIC_IMAGE_ACCESS_URL ||
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, "") ||
    env.apiBaseUrl.replace(/\/api\/?$/, "");
  const baseUrl = publicImageBaseUrl.replace(/\/$/, "");
  const cleanPath = path.startsWith("/") ? path.substring(1) : path;
  return `${baseUrl}/${cleanPath}`;
};

const syncBodyBackground = (
  html: string | null | undefined,
  imageUrl?: string,
) => {
  if (typeof document === "undefined") {
    return () => undefined;
  }

  const body = document.body;
  const previous = {
    background: body.style.background,
    backgroundColor: body.style.backgroundColor,
    backgroundImage: body.style.backgroundImage,
    backgroundRepeat: body.style.backgroundRepeat,
    backgroundPosition: body.style.backgroundPosition,
    backgroundSize: body.style.backgroundSize,
  };

  const extracted = extractHomePageBodyBackground(html);

  if (imageUrl) {
    body.style.background = "";
    body.style.backgroundColor = "";
    body.style.backgroundImage = `url(${imageUrl})`;
    body.style.backgroundRepeat = "no-repeat";
    body.style.backgroundPosition = "center";
    body.style.backgroundSize = "cover";
  } else if (extracted.background) {
    body.style.background = extracted.background;
    body.style.backgroundColor = extracted.backgroundColor || "";
    body.style.backgroundImage = extracted.backgroundImage || "";
    body.style.backgroundRepeat = extracted.backgroundRepeat || "";
    body.style.backgroundPosition = extracted.backgroundPosition || "";
    body.style.backgroundSize = extracted.backgroundSize || "";
  } else if (
    extracted.backgroundColor ||
    extracted.backgroundImage ||
    extracted.backgroundRepeat ||
    extracted.backgroundPosition ||
    extracted.backgroundSize
  ) {
    body.style.background = "";
    body.style.backgroundColor = extracted.backgroundColor || "";
    body.style.backgroundImage = extracted.backgroundImage || "";
    body.style.backgroundRepeat = extracted.backgroundRepeat || "";
    body.style.backgroundPosition = extracted.backgroundPosition || "";
    body.style.backgroundSize = extracted.backgroundSize || "";
  } else {
    const inlineBg = extractFirstElementBackground(html);
    if (inlineBg) {
      body.style.background = inlineBg;
    } else if (html?.trim()) {
      body.style.background = "#ffffff";
      body.style.backgroundColor = "";
      body.style.backgroundImage = "";
      body.style.backgroundRepeat = "";
      body.style.backgroundPosition = "";
      body.style.backgroundSize = "";
    } else {
      body.style.background = DEFAULT_HOME_PAGE_BACKGROUND;
      body.style.backgroundColor = "";
      body.style.backgroundImage = "";
      body.style.backgroundRepeat = "";
      body.style.backgroundPosition = "";
      body.style.backgroundSize = "";
    }
  }

  return () => {
    body.style.background = previous.background;
    body.style.backgroundColor = previous.backgroundColor;
    body.style.backgroundImage = previous.backgroundImage;
    body.style.backgroundRepeat = previous.backgroundRepeat;
    body.style.backgroundPosition = previous.backgroundPosition;
    body.style.backgroundSize = previous.backgroundSize;
  };
};


type PublicRosterUser = {
  id: number;
  username: string;
  icon?: string | null;
  roleName?: string | null;
  starCount?: number | null;
  starColor?: string | null;
};

type PublicRosterState = {
  siteOwners: PublicRosterUser[];
  managers: PublicRosterUser[];
  onlineNames: Set<string>;
  onlineCount: number;
};

const normalizePublicName = (value?: string | null) =>
  String(value || "").trim().toLocaleLowerCase("tr-TR");

const usePublicRoster = (): PublicRosterState => {
  const [siteOwners, setSiteOwners] = useState<PublicRosterUser[]>([]);
  const [managers, setManagers] = useState<PublicRosterUser[]>([]);
  const [onlineNames, setOnlineNames] = useState<Set<string>>(new Set());
  const [onlineCount, setOnlineCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const loadRoster = async () => {
      try {
        const response = await getClientApiClient().get(
          "/system-settings/public-header-roster",
          { params: { _ts: Date.now() } },
        );
        if (cancelled) return;
        setSiteOwners(Array.isArray(response.data?.siteOwners) ? response.data.siteOwners : []);
        setManagers(Array.isArray(response.data?.managers) ? response.data.managers : []);
      } catch (error) {
        console.error("Login yönetim vitrini alınamadı:", error);
      }
    };

    void loadRoster();
    const rosterTimer = window.setInterval(() => void loadRoster(), 30000);

    const socketUrl =
      process.env.NEXT_PUBLIC_SOCKET_URL || "https://king.akdenizbirlik.com";
    const socket = io(socketUrl, {
      transports: ["websocket", "polling"],
      autoConnect: true,
      reconnection: true,
    });

    const tenantId = env.tenantId ? `tenant_${env.tenantId}` : "tenant_master";
    const normalizedTenantId = tenantId.replace(/^tenant_/, "");

    const handleCount = (data: {
      tenantId?: string;
      count?: number;
      users?: Array<{ username?: string | null }>;
    }) => {
      if (
        String(data?.tenantId || "").replace(/^tenant_/, "") !==
        normalizedTenantId
      ) {
        return;
      }
      const names = new Set(
        (Array.isArray(data.users) ? data.users : [])
          .filter((user: any) => user?.statusModeName !== "Çatıda")
          .map((user) => normalizePublicName(user?.username))
          .filter(Boolean),
      );
      setOnlineNames(names);
      // backend count botları da içeriyor; users listesi gelmezse count'u koru
      setOnlineCount(Math.max(0, Number(data.count ?? names.size) || 0));
    };

    const requestCount = () => {
      if (socket.connected) {
        socket.emit("tenant:getActiveUserCount", { tenantId });
      }
    };

    socket.on("tenant:activeUserCount", handleCount);
    socket.on("connect", requestCount);
    const countTimer = window.setInterval(requestCount, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(rosterTimer);
      window.clearInterval(countTimer);
      socket.off("tenant:activeUserCount", handleCount);
      socket.off("connect", requestCount);
      socket.disconnect();
    };
  }, []);

  return useMemo(
    () => ({ siteOwners, managers, onlineNames, onlineCount }),
    [siteOwners, managers, onlineNames, onlineCount],
  );
};

const LoginOnlineCounter = () => {
  const { onlineCount } = usePublicRoster();
  return (
    <div className="flex h-11 min-w-[70px] flex-col items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-3">
      <span className="text-lg font-black leading-none text-slate-900">{onlineCount}</span>
      <span className="mt-1 text-[8px] font-black uppercase tracking-[0.16em] text-emerald-600">Online</span>
    </div>
  );
};

const LoginRosterStrip = () => {
  const { siteOwners, managers, onlineNames } = usePublicRoster();

  const renderCard = (user: PublicRosterUser, type: "owner" | "manager") => {
    const isOwner = type === "owner";
    const isOnline = onlineNames.has(normalizePublicName(user.username));
    const avatar = resolveUrl(user.icon);

    return (
      <div
        key={`${type}-${user.id}-${user.username}`}
        className="flex min-w-[156px] shrink-0 items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-[0_4px_12px_rgba(15,23,42,0.04)] sm:min-w-[182px]"
      >
        <div
          className={`relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-slate-50 text-sm font-black ${
            isOwner ? "border-amber-200 text-amber-700" : "border-blue-200 text-blue-700"
          }`}
        >
          {avatar ? (
            <img src={avatar} alt="" className="h-full w-full object-cover" />
          ) : (
            user.username.slice(0, 1).toUpperCase()
          )}
          <span className={`absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${isOnline ? "bg-emerald-500" : "bg-slate-300"}`} />
        </div>
        <div className="min-w-0">
          <div className="truncate text-[12px] font-extrabold text-slate-800 sm:text-[13px]">
            {user.username}
          </div>
          <div className={`mt-0.5 text-[8px] font-black uppercase tracking-[0.12em] ${isOnline ? "text-emerald-600" : "text-slate-400"}`}>
            {isOnline ? "Çevrimiçi" : "Çevrimdışı"}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="mt-5 space-y-3 border-t border-slate-200 pt-4">
      <div>
        <div className="mb-2 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.14em] text-amber-600">
          <Crown className="h-3.5 w-3.5" />
          Site Sahipleri
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {siteOwners.length > 0 ? (
            siteOwners.map((user) => renderCard(user, "owner"))
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[11px] font-semibold text-slate-400">
              Henüz site sahibi eklenmedi.
            </div>
          )}
        </div>
      </div>
      <div>
        <div className="mb-2 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.14em] text-blue-600">
          <ShieldCheck className="h-3.5 w-3.5" />
          Yöneticiler
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {managers.length > 0 ? (
            managers.map((user) => renderCard(user, "manager"))
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[11px] font-semibold text-slate-400">
              Henüz yönetici eklenmedi.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const StandardLoginPage = ({
  siteName,
  homePageHtml,
  homePageImage,
  homePageLogo,
}: {
  siteName: string;
  homePageHtml?: string | null;
  homePageImage?: string | null;
  homePageLogo?: string | null;
}) => {
  const bgUrl = resolveUrl(homePageImage);
  const logoUrl = resolveUrl(homePageLogo);
  const hasHomePageContent = Boolean(homePageHtml?.trim());

  return (
    <main className="relative min-h-[100dvh] overflow-x-hidden bg-[#f4f7fb] text-slate-900">
      {bgUrl ? (
        <img
          src={bgUrl}
          alt=""
          className="pointer-events-none fixed inset-0 h-full w-full object-cover opacity-[0.055]"
        />
      ) : null}

      <div className="pointer-events-none fixed inset-x-0 top-0 h-52 bg-gradient-to-b from-blue-50 to-transparent" />

      <section className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-[1180px] items-start px-3 py-4 sm:items-center sm:px-6 sm:py-8 lg:px-8">
        <div className="grid w-full overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.10)] lg:grid-cols-[1.05fr_0.95fr]">
          <div className="hidden min-h-[650px] flex-col justify-between bg-[#071326] p-10 text-white lg:flex">
            <div>
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={siteName}
                  className="max-h-20 max-w-[280px] object-contain"
                />
              ) : (
                <div className="text-3xl font-black tracking-tight">ChatsON</div>
              )}
              <div className="mt-12 max-w-[470px]">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-300">Canlı sohbet</p>
                <h1 className="mt-3 text-5xl font-black leading-[1.02] tracking-[-0.045em]">
                  Sade, hızlı ve
                  <span className="block text-blue-400">doğrudan sohbet.</span>
                </h1>
                <p className="mt-5 max-w-md text-sm font-medium leading-6 text-slate-400">
                  Rumuzunu yaz, odanı seç ve sohbete katıl. Gereksiz adım yok.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 border-t border-white/10 pt-6">
              <div>
                <MessageCircle className="h-5 w-5 text-blue-400" />
                <div className="mt-2 text-xs font-extrabold">Mesajlaşma</div>
              </div>
              <div>
                <Mic className="h-5 w-5 text-blue-400" />
                <div className="mt-2 text-xs font-extrabold">Sesli Odalar</div>
              </div>
              <div>
                <ShieldCheck className="h-5 w-5 text-blue-400" />
                <div className="mt-2 text-xs font-extrabold">Güvenli Sistem</div>
              </div>
            </div>
          </div>

          <div className="flex min-h-[100dvh] flex-col justify-center p-4 sm:min-h-0 sm:p-8 lg:p-10">
            <div className="mx-auto w-full max-w-[430px]">
              <div className="mb-6 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt={siteName}
                      className="max-h-14 max-w-[220px] object-contain lg:hidden"
                    />
                  ) : (
                    <div className="text-2xl font-black tracking-tight text-slate-900 lg:hidden">ChatsON</div>
                  )}
                  <div className="mt-3 lg:mt-0">
                    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-blue-600">{siteName}</p>
                    <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900 sm:text-[28px]">Sohbete giriş</h2>
                    <p className="mt-1 text-xs font-medium text-slate-500">Rumuzunu yaz ve devam et.</p>
                  </div>
                </div>
                <LoginOnlineCounter />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)] sm:p-5">
                <LoginForm variant="standard" compact hideHeader />
              </div>

              <LoginRosterStrip />

              <div className="mt-5 flex items-center justify-center gap-2 text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">
                <Lock className="h-3.5 w-3.5" />
                Güvenli oturum
              </div>
            </div>
          </div>
        </div>
      </section>

      {hasHomePageContent ? (
        <section className="relative z-10 border-t border-slate-200 bg-white">
          <HomePageHtmlBlock
            html={homePageHtml}
            variant="standard"
            className="mx-auto max-w-[1180px]"
          />
        </section>
      ) : null}
    </main>
  );
};

const PremiumNavLink = ({
  href,
  icon,
  children,
}: {
  href: string;
  icon: ReactNode;
  children: ReactNode;
}) => (
  <a
    href={href}
    className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-extrabold uppercase text-white transition-colors hover:bg-[#fff6d1]/20 hover:text-[#fff6d1] sm:text-base"
  >
    {icon}
    {children}
  </a>
);

const PremiumFloatingCard = ({
  src,
  text,
  side,
  className,
}: {
  src: string;
  text: string;
  side: "left" | "right";
  className: string;
}) => (
  <div
    className={`absolute hidden items-center gap-3 xl:flex ${side === "right" ? "flex-row-reverse" : ""} ${className}`}
  >
    <div className="premium-lift h-[96px] w-[96px] overflow-hidden rounded-full border-[4px] border-[#ffe8a3] shadow-[0_18px_35px_rgba(0,0,0,0.46)]">
      <img src={src} alt="" className="h-full w-full object-cover" />
    </div>
    <div
      className="max-w-[210px] bg-black/50 px-4 py-3 text-[15px] font-semibold leading-snug text-white shadow-[0_12px_24px_rgba(0,0,0,0.28)] ring-1 ring-[#ffe8a3]/70 backdrop-blur-xl"
      style={{
        borderRadius:
          side === "right" ? "18px 6px 18px 18px" : "6px 18px 18px 18px",
      }}
    >
      {text}
    </div>
  </div>
);

const PremiumChatMotifs = () => (
  <div className="pointer-events-none absolute inset-x-0 top-24 mx-auto hidden h-[330px] max-w-[1120px] lg:block">
    <div className="premium-chat-bob absolute left-[28%] top-[74px] flex h-12 w-12 items-center justify-center rounded-full border border-[#ffe8a3]/70 bg-black/35 text-[#ffe8a3] shadow-[0_14px_30px_rgba(0,0,0,0.35)] ring-1 ring-[#ffe8a3]/35 backdrop-blur-xl">
      <MessageCircle className="h-6 w-6" />
    </div>
    <div className="premium-chat-bob premium-delay-1 absolute right-[30%] top-[56px] flex h-12 w-12 items-center justify-center rounded-full border border-[#ffe8a3]/70 bg-black/35 text-[#ffe8a3] shadow-[0_14px_30px_rgba(0,0,0,0.35)] ring-1 ring-[#ffe8a3]/35 backdrop-blur-xl">
      <Mic className="h-6 w-6" />
    </div>
    <div className="premium-chat-bob premium-delay-2 absolute bottom-[14px] left-[24%] flex h-11 w-11 items-center justify-center rounded-full border border-[#ffe8a3]/70 bg-black/35 text-[#ffe8a3] shadow-[0_14px_30px_rgba(0,0,0,0.34)] ring-1 ring-[#ffe8a3]/35 backdrop-blur-xl">
      <Headphones className="h-5 w-5" />
    </div>
    <div className="premium-chat-bob premium-delay-3 absolute bottom-[28px] right-[24%] flex h-11 w-11 items-center justify-center rounded-full border border-[#ffe8a3]/70 bg-black/35 text-[#ffe8a3] shadow-[0_14px_30px_rgba(0,0,0,0.34)] ring-1 ring-[#ffe8a3]/35 backdrop-blur-xl">
      <Smartphone className="h-5 w-5" />
    </div>
  </div>
);

const PremiumLoginPage = ({
  siteName,
  settings,
}: {
  siteName: string;
  settings: MaintenanceModeSettings;
}) => {
  const premiumTopTitle = resolvePremiumText(
    settings.premiumArticleTopTitle,
    "Her Cihazdan Kesintisiz Sohbet",
  );
  const premiumTopContent = resolvePremiumText(
    settings.premiumArticleTopContent,
    "Sesli sohbet deneyimini hızlı, sade ve güvenli tutan premium giriş ekranı ile bilgisayar, telefon ve tablet üzerinden kolayca bağlanın.",
  );
  const premiumMiddleTitle = resolvePremiumText(
    settings.premiumArticleMiddleTitle,
    "Sesli Sohbet Et",
  );
  const premiumMiddleContent = resolvePremiumText(
    settings.premiumArticleMiddleContent,
    "Sesli sohbet ile yeni insanlarla tanışın, arkadaşlarınızla hızlıca bağlantı kurun ve odalara tek dokunuşla katılın.",
  );
  const premiumBottomTitle = resolvePremiumText(
    settings.premiumArticleBottomTitle,
    "Sohbet ve Chat Odaları",
  );
  const premiumBottomContent = resolvePremiumText(
    settings.premiumArticleBottomContent,
    "Chat odalarında yazılı ve sesli sohbeti bir araya getirerek daha canlı, daha anlaşılır ve daha sıcak bir iletişim alanı sunuyoruz.",
  );
  const androidAppUrl = resolvePremiumStoreUrl(settings.premiumAndroidAppUrl);
  const iosAppUrl = resolvePremiumStoreUrl(settings.premiumIosAppUrl);
  const formCard = (
    <div
      className="premium-lift w-full max-w-[390px] overflow-hidden rounded-[24px] border border-[#ffe8a3]/80 bg-white/82 shadow-[0_32px_80px_rgba(0,0,0,0.5)] backdrop-blur-xl"
      style={{ colorScheme: "light" }}
    >
      <div className="border-b border-[#ffe8a3]/70 bg-white/78 px-6 pb-5 pt-6 text-center backdrop-blur-xl">
        <div className="text-[24px] font-black tracking-wide text-[#071b3d] sm:text-[28px]">
          {siteName}
        </div>
      </div>
      <div className="bg-[linear-gradient(145deg,rgba(255,250,232,0.98),rgba(255,232,163,0.9)_46%,rgba(248,214,109,0.78))] px-5 pb-5 pt-4 backdrop-blur-xl">
        <h1 className="mb-4 text-center text-[30px] font-black leading-none text-[#071b3d] sm:text-[34px]">
          Sohbet Girişi
        </h1>
        <LoginForm
          variant="premium"
          compact
          hideHeader
          hideFooter
          submitLabel="Sohbete Bağlan"
        />
      </div>
    </div>
  );

  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_50%_0%,rgba(255,232,163,0.18),transparent_24%),linear-gradient(180deg,#061a3a_0%,#020711_46%,#081f45_100%)] text-white">
      <section className="premium-hero-bg relative min-h-[640px] pb-20 text-white sm:min-h-[680px] lg:min-h-[650px]">
        <div className="premium-hero-wave" />
        <div className="premium-pulse-accent pointer-events-none absolute left-[16%] top-[38%] hidden h-6 w-6 rounded-md border-2 border-[#fff6d1] bg-[#ffe8a3] shadow-[0_0_22px_rgba(255,232,163,0.5)] md:block" />
        <div className="premium-pulse-accent pointer-events-none absolute right-[18%] top-[25%] hidden h-6 w-6 rounded-md border-2 border-[#fff6d1] bg-[#fff6d1] shadow-[0_0_22px_rgba(255,246,209,0.5)] md:block" />
        <div className="premium-pulse-accent pointer-events-none absolute bottom-[28%] left-[37%] hidden h-5 w-5 rounded-md border-2 border-[#fff6d1] bg-[#ffe8a3] shadow-[0_0_20px_rgba(255,232,163,0.5)] lg:block" />
        <PremiumChatMotifs />

        <div className="relative z-10 mx-auto flex w-full max-w-[1160px] items-center justify-between px-5 pt-8">
          <div className="flex flex-wrap gap-1 sm:gap-4">
            <PremiumNavLink href="#privacy" icon={<Lock className="h-4 w-4" />}>
              Gizlilik
            </PremiumNavLink>
            <PremiumNavLink
              href="#info"
              icon={<UserRound className="h-4 w-4" />}
            >
              Bilgilendirme
            </PremiumNavLink>
          </div>
          <div className="flex flex-wrap justify-end gap-1 sm:gap-4">
            <PremiumNavLink
              href="#rules"
              icon={<CircleAlert className="h-4 w-4" />}
            >
              Kurallar
            </PremiumNavLink>
            <PremiumNavLink href="#contact" icon={<Mail className="h-4 w-4" />}>
              İletişim
            </PremiumNavLink>
          </div>
        </div>

        <PremiumFloatingCard
          src="https://randomuser.me/api/portraits/women/44.jpg"
          text="Selam naber Aslı?"
          side="left"
          className="left-[8%] top-[34%]"
        />
        <PremiumFloatingCard
          src="https://randomuser.me/api/portraits/women/65.jpg"
          text="İyim teşekkür ederim. Sen nasılsın?"
          side="left"
          className="bottom-[22%] left-[6%]"
        />
        <PremiumFloatingCard
          src="https://randomuser.me/api/portraits/men/32.jpg"
          text="Selam millet!"
          side="right"
          className="right-[8%] top-[34%]"
        />
        <PremiumFloatingCard
          src="https://randomuser.me/api/portraits/women/12.jpg"
          text="Merhaba Can h.g"
          side="right"
          className="bottom-[22%] right-[6%]"
        />

        <div className="relative z-10 mx-auto flex max-w-[430px] justify-center px-5 pt-8 sm:pt-10">
          {formCard}
        </div>

        <div className="relative z-10 mx-auto mt-10 max-w-[460px] px-5 text-center">
          <h2 className="text-[26px] font-black uppercase leading-none text-white">
            Telefona İndirin
          </h2>
          <p className="mx-auto mt-3 max-w-[360px] text-[15px] font-semibold leading-6 text-white">
            Mobil sohbet uygulamamızı kesintisiz ve canlı bir şekilde aşağıdan
            indirerek kullanabilirsiniz.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <a
              href={androidAppUrl}
              aria-disabled={!androidAppUrl}
              className={`premium-store-button inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-black uppercase text-[#071b3d] ${androidAppUrl ? "" : "cursor-default opacity-70"}`}
            >
              <Play className="h-5 w-5 text-[#071b3d]" />
              Play Store
            </a>
            <a
              href={iosAppUrl}
              aria-disabled={!iosAppUrl}
              className={`premium-store-button inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-black uppercase text-[#071b3d] ${iosAppUrl ? "" : "cursor-default opacity-70"}`}
            >
              <Apple className="h-5 w-5 text-[#071b3d]" />
              App Store
            </a>
          </div>
        </div>

        <a
          href="#info"
          className="premium-animated-button absolute bottom-8 left-1/2 z-10 flex h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full bg-gradient-to-br from-[#fff6d1] to-[#f8d66d] text-black shadow-[0_12px_28px_rgba(0,0,0,0.42)]"
          aria-label="Aşağı kaydır"
        >
          <ChevronDown className="h-8 w-8" />
        </a>

      </section>

      <section
        id="info"
        className="relative mx-auto grid max-w-[1160px] gap-6 px-5 py-12 lg:grid-cols-2"
      >
        <div
          id="privacy"
          className="premium-lift rounded-[24px] border border-[#ffe8a3]/55 bg-[#061a3a]/78 p-7 text-center shadow-[0_18px_44px_rgba(0,0,0,0.42)] backdrop-blur-xl"
        >
          <h2 className="text-[28px] font-black leading-tight text-[#fff6d1]">
            {premiumTopTitle}
          </h2>
          <p className="mt-4 text-[16px] font-medium leading-7 text-white/90">
            {premiumTopContent}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <span className="premium-liquid-button inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-black uppercase text-white">
              <Heart className="h-5 w-5 text-[#fff6d1]" />
              Yeni Aşklar
            </span>
            <span className="premium-orange-button inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-black uppercase text-[#071b3d]">
              <Smartphone className="h-5 w-5" />
              Mobil Sohbet
            </span>
          </div>
        </div>

        <div
          id="rules"
          className="premium-lift rounded-[24px] border border-[#ffe8a3]/55 bg-[#061a3a]/78 p-6 shadow-[0_18px_44px_rgba(0,0,0,0.42)] backdrop-blur-xl"
        >
          <div className="rounded-2xl bg-gradient-to-r from-black via-[#061a3a] to-[#0b2a5b] px-5 py-3 text-center text-lg font-black uppercase text-[#fff6d1] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
            Genel Sohbet Kuralları
          </div>
          <div className="mt-5 space-y-3">
            {[
              "Sohbet sırasında her zaman saygılı olun.",
              "Diğer kullanıcılara karşı nazik ve seviyeli davranın.",
              "Küfürlü, saldırgan veya hakaret içeren ifadeler yasaktır.",
            ].map((rule) => (
              <div
                key={rule}
                className="flex items-center gap-3 rounded-2xl border border-[#ffe8a3]/55 bg-black/35 px-4 py-3 text-[15px] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-md transition-colors hover:border-[#fff6d1] hover:bg-[#ffe8a3]/15"
              >
                <Info className="h-5 w-5 flex-shrink-0 text-[#fff6d1]" />
                {rule}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        id="download"
        className="premium-lift mx-auto grid max-w-[1160px] overflow-hidden rounded-[24px] border border-[#ffe8a3]/55 bg-[#061a3a]/78 shadow-[0_20px_46px_rgba(0,0,0,0.44)] backdrop-blur-xl lg:grid-cols-[1fr_1.2fr_1fr]"
      >
        <div className="relative min-h-[250px] bg-gradient-to-br from-black via-[#061a3a] to-[#0b2a5b]">
          <img
            src="https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=720&q=80"
            alt=""
            className="absolute inset-x-0 bottom-0 mx-auto h-full max-h-[330px] w-full object-cover object-top lg:w-[82%]"
          />
        </div>
        <div className="flex flex-col justify-center px-8 py-9 text-center">
          <h2 className="text-[28px] font-black leading-tight text-[#fff6d1]">
            {premiumMiddleTitle}
          </h2>
          <p className="mt-4 text-[16px] font-medium leading-7 text-white/90">
            {premiumMiddleContent}
          </p>
        </div>
        <div className="flex flex-col justify-center bg-gradient-to-br from-black via-[#061a3a] to-[#0b2a5b] px-8 py-9 text-center text-white">
          <h2 className="text-[28px] font-black leading-tight">Google Play</h2>
          <p className="mt-3 text-[15px] font-semibold leading-6">
            Android uygulaması ile hızlı bir şekilde sohbete bağlanabilirsiniz.
          </p>
          <a
            href={androidAppUrl}
            aria-disabled={!androidAppUrl}
            className={`premium-orange-button mx-auto mt-6 inline-flex items-center gap-3 rounded-full px-5 py-3 text-sm font-black uppercase text-[#071b3d] ${androidAppUrl ? "" : "cursor-default opacity-70"}`}
          >
            <Download className="h-5 w-5" />
            Uygulama İndir
          </a>
        </div>
      </section>

      <section className="premium-lift mx-auto mt-12 max-w-[1160px] rounded-[24px] border border-[#ffe8a3]/55 bg-[#061a3a]/78 p-5 shadow-[0_20px_46px_rgba(0,0,0,0.42)] backdrop-blur-xl">
        <img
          src="https://images.unsplash.com/photo-1506869640319-fe1a24fd76dc?auto=format&fit=crop&w=1500&q=80"
          alt=""
          className="h-[280px] w-full rounded-[18px] object-cover sm:h-[360px]"
        />
        <div className="px-2 py-6">
          <h2 className="text-[28px] font-black leading-tight text-[#fff6d1]">
            {premiumBottomTitle}
          </h2>
          <p className="mt-3 text-[16px] font-medium leading-7 text-white/90">
            {premiumBottomContent}
          </p>
        </div>
      </section>

      <footer
        id="contact"
        className="relative mt-20 bg-gradient-to-br from-black via-[#061a3a] to-[#0b2a5b] px-5 pb-12 pt-20 text-center text-white"
      >
        <div className="absolute inset-x-0 top-[-1px] h-20 overflow-hidden">
          <svg
            className="h-full w-full rotate-180"
            viewBox="0 0 1440 120"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              d="M0,36 C260,84 487,98 720,96 C956,94 1166,78 1440,36 L1440,120 L0,120 Z"
              fill="#081f45"
            />
          </svg>
        </div>
        <a
          href="https://kingmobil.com/"
          className="premium-lift relative mx-auto inline-flex rounded-2xl bg-[#ffe8a3] px-5 py-3 text-[24px] font-black tracking-wide text-black transition-colors hover:bg-[#fff6d1]"
        >
          {PREMIUM_FOOTER_BRAND}
        </a>
        <div className="relative mt-8 flex items-center justify-center gap-2 text-sm font-semibold">
          <MessageCircle className="h-4 w-4" />
          {PREMIUM_FOOTER_BRAND} © 2026 - Tüm Hakları Saklıdır.
        </div>
      </footer>
    </main>
  );
};

export const HomePageClient = ({
  initialSettings,
}: {
  initialSettings: MaintenanceModeSettings;
}) => {
  const settings = initialSettings;

  const isMaintenanceMode = settings.maintenanceMode;
  const activeLoginDesign: LoginDesignType =
    settings.activeLoginDesign === "premium" ? "premium" : "standard";
  const siteName = resolveSiteName(settings.siteName);
  const homePageHtml = settings.homePageHtml ?? "";
  const homePageImage = settings.homePageImage ?? null;
  const homePageLogo = settings.homePageLogo ?? null;
  const homePageImageUrl = resolveUrl(homePageImage);

  useEffect(() => {
    if (isMaintenanceMode) {
      document.body.style.background = DEFAULT_HOME_PAGE_BACKGROUND;
      return;
    }

    if (activeLoginDesign === "premium") {
      const previous = document.body.style.background;
      document.body.style.background = "#061a3a";
      return () => {
        document.body.style.background = previous;
      };
    }

    return syncBodyBackground(
      homePageHtml,
      homePageHtml.trim() ? undefined : homePageImageUrl,
    );
  }, [homePageHtml, homePageImageUrl, isMaintenanceMode, activeLoginDesign]);

  if (isMaintenanceMode) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-orange-50 via-orange-100 to-orange-50 dark:from-orange-900 dark:via-orange-950 dark:to-black">
        <div className="w-full max-w-2xl px-6">
          <div className="rounded-2xl border border-orange-200 bg-white p-12 shadow-2xl dark:border-orange-800 dark:bg-zinc-900">
            <div className="mb-6 flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-orange-500/20 blur-2xl" />
                <div className="relative rounded-full bg-gradient-to-br from-orange-400 to-orange-600 p-6">
                  <Wrench className="h-16 w-16 text-white" />
                </div>
              </div>
            </div>

            <div className="mb-6 text-center">
              <h1 className="mb-3 text-4xl font-extrabold text-zinc-900 dark:text-white">
                Bakım Modu
              </h1>
              <div className="flex items-center justify-center gap-2 text-orange-600 dark:text-orange-400">
                <Settings className="h-5 w-5 animate-spin" />
                <span className="text-sm font-semibold">
                  Sistem şu anda bakımdadır
                </span>
              </div>
            </div>

            <div className="mb-8 text-center">
              <p className="mb-4 text-lg text-zinc-700 dark:text-zinc-300">
                Sistemimiz şu anda bakım çalışması yapıyor.
              </p>
              <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                Size daha iyi hizmet verebilmek için sistemimizi güncelliyoruz.
                Lütfen kısa bir süre sonra tekrar deneyin. Anlayışınız için
                teşekkür ederiz.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-800 dark:bg-orange-950/30">
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-orange-500" />
              </span>
              <span className="text-sm font-medium text-orange-700 dark:text-orange-300">
                Bakım çalışması devam ediyor
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <HomeAuthCheck>
      {activeLoginDesign === "premium" ? (
        <PremiumLoginPage siteName={siteName} settings={settings} />
      ) : (
        <StandardLoginPage
          siteName={siteName}
          homePageHtml={homePageHtml}
          homePageImage={homePageImage}
          homePageLogo={homePageLogo}
        />
      )}
    </HomeAuthCheck>
  );
};
