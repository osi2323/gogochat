import Image from "next/image";
import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  MoreVertical,
  User,
  Trash2,
  Copy,
  Reply,
  HandHeart,
  AlertTriangle,
  ChevronRight,
  X,
} from "lucide-react";

interface ReplyToMessage {
  id: number;
  content: string;
  username: string;
  createdAt: string;
}

interface ChatMessageProps {
  content: string;
  time: string;
  sender: string;
  profileUsername?: string;
  isMe?: boolean;
  avatar?: string | null;
  isSystemMessage?: boolean;
  systemStyle?: "default" | "announcement";
  isClickableSystemMessage?: boolean;
  isRoomDescriptionMessage?: boolean;
  onSystemMessageClick?: () => void;
  image?: string;
  audio?: string;
  audioFileName?: string;
  videoUrl?: string;
  videoTitle?: string;
  videoThumbnail?: string;
  videoId?: string;
  messageFontSize?: string;
  messageColor?: string;
  messageId?: number;
  replyToMessage?: ReplyToMessage | null;
  onReply?: (sender: string, content: string, messageId?: number) => void;
  onDeleteForMe?: (messageId: number) => void;
  onReport?: (messageId: number) => void;
  onShowProfile?: (username: string) => void;
  fontColor?: string;
  flashNick?: string | null;
  fontName?: string | null;
  granite?: string | null;
  nickColor?: string | null;
  targetGroup?: "everyone" | "members" | "staff" | null;
  inspectLoginHistoryId?: number | null;
  canInspectLoginHistory?: boolean;
  inspectLoading?: "location" | "identities" | null;
  onShowLoginLocation?: (loginHistoryId: number) => void;
  onShowLoginIdentities?: (loginHistoryId: number) => void;
  botSpeakerName?: string | null;
  isWelcomeMessage?: boolean;
  isAiWelcomeMessage?: boolean;
  isWelcomePrompt?: boolean;
}

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

export const ChatMessage = ({
  content,
  time,
  sender,
  profileUsername,
  isMe = false,
  avatar,
  isSystemMessage = false,
  systemStyle = "default",
  isClickableSystemMessage = false,
  isRoomDescriptionMessage = false,
  onSystemMessageClick,
  image,
  audio,
  audioFileName,
  videoUrl,
  videoTitle,
  videoId,
  messageFontSize = "16px",
  messageColor,
  messageId,
  replyToMessage,
  onReply,
  onDeleteForMe,
  onReport,
  onShowProfile,
  fontColor,
  inspectLoginHistoryId,
  canInspectLoginHistory = false,
  inspectLoading = null,
  onShowLoginLocation,
  onShowLoginIdentities,
  botSpeakerName,
  isWelcomeMessage = false,
  isAiWelcomeMessage = false,
  isWelcomePrompt = false,
}: ChatMessageProps) => {
  const [showMenu, setShowMenu] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<"top" | "bottom">("bottom");
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setShowMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const messageTextStyle: React.CSSProperties = {
    fontSize: messageFontSize,
    color: fontColor || messageColor,
    textShadow: fontColor
      ? "0 0 0 currentColor, 0 0 1px rgba(255,255,255,0.6)"
      : undefined,
  };

  const handleReply = () => {
    let replyContent = content || "";

    if (image) {
      replyContent = replyContent.trim() ? `📷 ${replyContent}` : "📷 Görsel";
    } else if (audio) {
      replyContent = replyContent.trim()
        ? `🎤 ${replyContent}`
        : "🎤 Sesli Mesaj";
    } else if (videoId) {
      replyContent = replyContent.trim() ? `🎥 ${replyContent}` : "🎥 Video";
    } else if (!replyContent.trim()) {
      // Sadece boş metin varsa (ne medya ne yazı)
      replyContent = "...";
    }

    onReply?.(sender, replyContent, messageId);
    setShowMenu(false);
  };

  const handleDeleteForMe = () => {
    if (messageId !== undefined) {
      onDeleteForMe?.(messageId);
    }
    setShowMenu(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setShowMenu(false);
  };

  const handleShowProfile = () => {
    onShowProfile?.(profileUsername || sender);
    setShowMenu(false);
  };

  const handleReport = () => {
    if (messageId !== undefined) {
      onReport?.(messageId);
    }
    setShowMenu(false);
  };

  // Sistem mesajı varyantını metne göre belirle
  const lowerContent = content.toLocaleLowerCase("tr-TR");
  const isPositiveVoiceActionMessage =
    lowerContent.includes("mikrofonu aldınız") ||
    lowerContent.includes("mikrofonu aldı") ||
    lowerContent.includes("el kaldırdınız") ||
    lowerContent.includes("el kaldirdiniz") ||
    lowerContent.includes("mikrofon sırasına girdi") ||
    lowerContent.includes("mikrofon sirasina girdi");
  const isNegativeVoiceActionMessage =
    lowerContent.includes("mikrofonu bıraktınız") ||
    lowerContent.includes("mikrofonu biraktiniz") ||
    lowerContent.includes("mikrofonu kapattı") ||
    lowerContent.includes("mikrofonu kapatti") ||
    lowerContent.includes("el indirdiniz") ||
    lowerContent.includes("mikrofon sırasından çıktı") ||
    lowerContent.includes("mikrofon sirasindan cikti");
  const isVoiceActionSystemMessage =
    !isClickableSystemMessage &&
    (isPositiveVoiceActionMessage || isNegativeVoiceActionMessage);
  const readableSystemTextShadow =
    "0 1px 2px rgba(0,0,0,0.95), 0 -1px 2px rgba(0,0,0,0.9), 1px 0 2px rgba(0,0,0,0.9), -1px 0 2px rgba(0,0,0,0.9), 0 0 6px rgba(0,0,0,0.85)";
  const systemVariant = isRoomDescriptionMessage
    ? "room"
    : systemStyle === "announcement"
      ? "announcement"
    : isClickableSystemMessage
      ? "roof"
    : lowerContent.includes("çatıdasınız")
      ? "roof"
      : lowerContent.includes("siteye giriş yaptı")
        ? "join"
      : lowerContent.includes("ayrıldı") ||
          lowerContent.includes("sırasından çıktı") ||
          lowerContent.includes("geçiş yaptı") ||
          lowerContent.includes("➔") ||
          lowerContent.includes("odasına gitti") ||
          isNegativeVoiceActionMessage
        ? "left"
        : lowerContent.includes("mikrofonu aldı") ||
            isPositiveVoiceActionMessage
          ? "success"
          : lowerContent.includes("katıldı") ||
              lowerContent.includes("çatıdan indiniz") ||
              lowerContent.includes("görünür mod")
            ? "join"
            : "default";

  const systemClasses: Record<
    "left" | "join" | "default" | "room" | "roof" | "success" | "announcement",
    string
  > = {
    left: "bg-red-500 text-white",
    join: "bg-green-600 text-black",
    success: "bg-green-600 text-white",
    default: "bg-red-500 text-white",
    announcement: "bg-red-600 text-white border border-red-700 shadow-sm",
    room: "bg-white text-black border border-zinc-300",
    roof: "bg-white text-black border border-zinc-300",
  };

  // Sistem mesajı ise özel görünüm
  if (isSystemMessage) {
    if (isRoomDescriptionMessage) {
      return (
        <div className="flex justify-center my-4">
          <div className="bg-white/50 backdrop-blur-sm text-black border-2 border-white px-4 py-2 rounded-md shadow-lg">
            <p className="text-sm font-bold text-zinc-900">{content}</p>
          </div>
        </div>
      );
    }

    if (isWelcomePrompt) {
      return (
        <div className="my-3 flex justify-center px-4">
          <div
            className="group relative inline-flex max-w-[min(92vw,950px)] cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-red-500 bg-white px-20 py-3 text-center text-red-600 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:bg-red-50 hover:shadow-xl active:scale-95 active:translate-y-0"
            onClick={onSystemMessageClick}
          >
            <div className="absolute left-8 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 transition-transform duration-500 group-hover:scale-110">
              <HandHeart className="h-5 w-5 text-red-600" />
            </div>

            <div className="flex min-w-0 flex-col items-center leading-tight">
              <span className="text-center text-[10px] font-bold uppercase tracking-widest text-red-500/70">
                Karşılama Mesajı
              </span>
              <p className="text-center text-sm font-extrabold tracking-tight text-zinc-900">
                {content}
              </p>
            </div>

            <div className="absolute right-7 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 opacity-0 transition-all duration-300 group-hover:translate-x-1 group-hover:opacity-100">
              <ChevronRight className="h-3 w-3 text-red-600" />
            </div>
          </div>
        </div>
      );
    }

    if (systemStyle === "announcement") {
      return (
        <div className="my-2 flex justify-center px-2">
          <div
            className={`inline-flex max-w-[min(92vw,1100px)] rounded-lg border border-red-300/80 bg-linear-to-r from-red-700 via-red-600 to-red-500 px-5 py-2.5 text-white shadow-[0_10px_22px_rgba(185,28,28,0.28)] ring-1 ring-white/10 ${
              isClickableSystemMessage
                ? "cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(185,28,28,0.36)]"
                : ""
            }`}
            onClick={isClickableSystemMessage ? onSystemMessageClick : undefined}
          >
            <div className="flex min-w-0 items-center gap-2 text-sm leading-tight">
              <span className="shrink-0 text-xs font-bold uppercase tracking-[0.12em] text-white/90">
                Sistem Mesajı
              </span>
              <span className="text-white/55">:</span>
              <p className="min-w-0 truncate text-sm font-semibold text-white">
                {content}
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (isVoiceActionSystemMessage) {
      return (
        <div className="flex justify-center">
          <span
            className={`text-center text-sm font-extrabold leading-tight ${
              isPositiveVoiceActionMessage ? "text-green-500" : "text-red-500"
            }`}
            style={{ textShadow: readableSystemTextShadow }}
          >
            {content}
          </span>
        </div>
      );
    }

    return (
      <div className="flex justify-center">
        <div
          className={`${
            systemClasses[systemVariant]
          } ${
            isClickableSystemMessage
              ? "rounded-lg px-4 py-1.5 text-sm font-semibold cursor-pointer hover:shadow-md transition-all active:scale-95"
              : "rounded-lg px-4 py-2 text-sm font-medium"
          }`}
          onClick={isClickableSystemMessage ? onSystemMessageClick : undefined}
        >
          {content}
          {canInspectLoginHistory && inspectLoginHistoryId ? (
            <div className="mt-1 flex items-center justify-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-black/80">
              <button
                type="button"
                className="transition hover:text-black disabled:opacity-60"
                disabled={inspectLoading !== null}
                onClick={(event) => {
                  event.stopPropagation();
                  onShowLoginLocation?.(inspectLoginHistoryId);
                }}
              >
                {inspectLoading === "location" ? "Yükleniyor..." : "Ülke"}
              </button>
              <span className="text-black/40">-</span>
              <button
                type="button"
                className="transition hover:text-black disabled:opacity-60"
                disabled={inspectLoading !== null}
                onClick={(event) => {
                  event.stopPropagation();
                  onShowLoginIdentities?.(inspectLoginHistoryId);
                }}
              >
                {inspectLoading === "identities" ? "Yükleniyor..." : "Kim"}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  const formatMessageContent = (text: string) => {
    if (!text) return null;

    const prefixes = [
      { key: "HERKESE:", label: "HERKESE:" },
      { key: "ÜYELERE:", label: "ÜYELERE:" },
      { key: "ADMİN:", label: "ADMİN:" },
    ];

    let prefixElement = null;
    let remainingText = text;

    for (const p of prefixes) {
      if (text.startsWith(p.key)) {
        prefixElement = (
          <span
            key="prefix"
            className="text-red-600 font-black mr-1.5 shrink-0 whitespace-nowrap"
          >
            {text.slice(0, p.key.length)}
          </span>
        );
        remainingText = text.slice(p.key.length).trimStart();
        break;
      }
    }

    // Regex for [e1]...[e72] pattern
    const parts = remainingText.split(/(\[e\d+\])/g);

    const formattedParts = parts.map((part, index) => {
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

    return prefixElement ? (
      <React.Fragment>
        {prefixElement}
        {formattedParts}
      </React.Fragment>
    ) : (
      formattedParts
    );
  };

  const bubbleBase =
    "chat-message-bubble relative rounded-[18px] px-3 py-2 shadow-none bg-[var(--chat-mobile-bubble-bg)] text-[var(--chat-mobile-bubble-text)] md:bg-[var(--chat-message-desktop-bg)] md:text-[var(--chat-message-desktop-text)] md:border md:border-[var(--chat-message-desktop-border)] md:shadow-sm md:px-3.5 md:py-2 md:rounded-lg";
  const welcomeMessageTextStyle = isWelcomeMessage && !isAiWelcomeMessage
    ? {
        fontSize: "18px",
        fontWeight: 800,
        lineHeight: 1.3,
      }
    : {};
  const showSender = !isMe;
  const senderTextClass = isWelcomeMessage && !isAiWelcomeMessage
    ? "text-base font-extrabold text-blue-600"
    : "text-base font-semibold text-blue-600";
  const speakerSuffix =
    botSpeakerName ? ` (${botSpeakerName})` : "";
  const speakerSuffixClass =
    "ml-1 text-[10px] font-semibold not-italic normal-case text-red-600";
  const welcomeTimeClass = isWelcomeMessage && !isAiWelcomeMessage
    ? "text-xs text-zinc-500 font-semibold"
    : "text-[10px] text-zinc-400";
  const mediaCard =
    "rounded-xl border border-zinc-200 bg-zinc-50 p-3 flex items-center gap-3";
  const hasMedia = Boolean(image || audio || videoId);
  const onlyMedia = hasMedia && !content;

  const renderMedia = () => {
    if (image) {
      const isGifImage = isGifImageSource(image);
      const animationImageSrc = resolveAnimationImageSrc(image, messageId ?? time);

      // Animasyon GIF kontrolü
      if (image.includes("/animasyonlar/")) {
        return (
          <div className="mt-1">
            <img
              src={animationImageSrc}
              alt="animation"
              className="w-[100px] h-[71px] object-contain"
            />
          </div>
        );
      }

      // Emoji GIF kontrolü
      if (image.includes("/emom/")) {
        return (
          <div className="mt-1">
            <img src={image} alt="emoji" className="w-16 h-16 object-contain" />
          </div>
        );
      }

      return (
        <div className="mt-1">
          <div className="w-[240px] h-[180px] relative overflow-hidden rounded-lg">
            {isGifImage ? (
              <img
                src={image}
                alt="Shared GIF"
                className="h-full w-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => setIsModalOpen(true)}
              />
            ) : (
              <Image
                src={image}
                alt="Shared image"
                fill
                className="object-cover cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => setIsModalOpen(true)}
              />
            )}
            {isGifImage && (
              <span className="absolute right-2 top-2 rounded bg-black/75 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white">
                GIF
              </span>
            )}
          </div>
          {content && (
            <div
              className="leading-relaxed mt-2 flex flex-wrap items-baseline"
              style={messageTextStyle}
            >
              {formatMessageContent(content)}
            </div>
          )}
        </div>
      );
    }

    if (audio) {
      return (
        <div className="mt-1 space-y-2">
          <div className={mediaCard}>
            <div className="shrink-0 w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white text-base">
              ♪
            </div>
            <div className="flex-1 min-w-0">
              {audioFileName && (
                <p className="text-xs font-medium text-zinc-700 truncate mb-1">
                  {audioFileName}
                </p>
              )}
              <audio controls className="w-full max-w-xs">
                <source src={audio} />
              </audio>
            </div>
          </div>
          {content && (
            <div
              className="leading-relaxed flex flex-wrap items-baseline"
              style={messageTextStyle}
            >
              {formatMessageContent(content)}
            </div>
          )}
        </div>
      );
    }

    if (videoId) {
      return (
        <div className="mt-1">
          <div className="rounded-lg overflow-hidden bg-black w-[240px]">
            <div className="relative" style={{ paddingBottom: "56.25%" }}>
              <iframe
                src={`https://www.youtube.com/embed/${videoId}`}
                title={videoTitle}
                className="absolute top-0 left-0 w-full h-full"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            <div className="bg-zinc-900 p-2">
              <h4 className="text-[11px] font-medium text-white line-clamp-1">
                {videoTitle}
              </h4>
              <a
                href={videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-red-400 hover:text-red-300 mt-0.5 inline-block"
              >
                YouTube&apos;da Aç →
              </a>
            </div>
          </div>
          {content && (
            <div
              className="leading-relaxed mt-2 flex flex-wrap items-baseline"
              style={messageTextStyle}
            >
              {formatMessageContent(content)}
            </div>
          )}
        </div>
      );
    }

    return (
      <div
        className="leading-relaxed flex flex-wrap items-baseline"
        style={messageTextStyle}
      >
        {formatMessageContent(content)}
      </div>
    );
  };

  const handleScrollToReply = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (replyToMessage?.id) {
      const element = document.getElementById(`message-${replyToMessage.id}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        // Geçici highlight efekti
        element.classList.add(
          "ring-2",
          "ring-blue-400",
          "ring-offset-2",
          "transition-all",
          "duration-500",
        );
        setTimeout(() => {
          element.classList.remove("ring-2", "ring-blue-400", "ring-offset-2");
        }, 2000);
      } else {
        console.warn(
          `Message element with ID message-${replyToMessage.id} not found in DOM`,
        );
      }
    }
  };

  const toggleMenu = () => {
    if (!showMenu && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      // Eğer aşağıda 320px'den az yer varsa yukarı aç
      if (spaceBelow < 320) {
        setMenuPosition("top");
      } else {
        setMenuPosition("bottom");
      }
    }
    setShowMenu(!showMenu);
  };

  const renderMessageMenu = () => (
    <div className="relative self-center">
      <button
        ref={buttonRef}
        onClick={toggleMenu}
        className="p-1 rounded-full hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors md:opacity-0 md:group-hover:opacity-100"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-[48] bg-transparent md:hidden"
            onClick={() => setShowMenu(false)}
          />
          <div
            ref={menuRef}
            className={`fixed left-1/2 top-1/2 z-50 w-max max-w-[calc(100vw-48px)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-zinc-200 bg-white py-1 shadow-2xl md:absolute md:left-auto md:top-auto md:w-max md:translate-x-0 md:translate-y-0 md:shadow-xl ${
              menuPosition === "top" ? "md:bottom-full md:mb-1" : "md:top-full md:mt-1"
            } ${isMe ? "md:right-0" : "md:left-0"} flex flex-col`}
          >
            {/* Profili Göster */}
            {!isMe && (
              <button
                onClick={handleShowProfile}
                className="flex w-full items-center gap-2 whitespace-nowrap px-3 py-2 text-left text-xs text-zinc-700 transition-colors hover:bg-zinc-50"
              >
                <User className="h-3.5 w-3.5 text-zinc-500" />
                Profili Göster
              </button>
            )}

            {/* Benden Sil */}
            <button
              onClick={handleDeleteForMe}
              className="group/delete flex w-full items-center gap-2 whitespace-nowrap px-3 py-2 text-left text-xs transition-colors hover:bg-zinc-50"
            >
              <Trash2 className="h-3.5 w-3.5 text-red-600 group-hover/delete:text-red-700" />
              <span className="text-blue-500 font-medium group-hover/delete:text-blue-600">
                Benden sil
              </span>
            </button>

            {/* Kopyala */}
            <button
              onClick={handleCopy}
              className="flex w-full items-center gap-2 whitespace-nowrap px-3 py-2 text-left text-xs text-zinc-700 transition-colors hover:bg-zinc-50"
            >
              <Copy className="h-3.5 w-3.5 text-zinc-500" />
              Kopyala
            </button>

            {/* Alıntı ile cevapla */}
            <button
              onClick={handleReply}
              className="flex w-full items-center gap-2 whitespace-nowrap px-3 py-2 text-left text-xs text-zinc-700 transition-colors hover:bg-zinc-50"
            >
              <Reply className="h-3.5 w-3.5 text-zinc-500" />
              Alıntı ile cevapla
            </button>

            {/* Şikayet Et - Sadece başkasının mesajıysa */}
            {!isMe && (
              <button
                onClick={handleReport}
                className="flex w-full items-center gap-2 whitespace-nowrap px-3 py-2 text-left text-xs text-red-600 transition-colors hover:bg-red-50"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                Şikayet Et
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );

  return (
    <div
      id={messageId ? `message-${messageId}` : undefined}
      className={`group flex w-full items-start gap-2 ${
        isMe ? "justify-end" : "justify-start"
      }`}
    >
      {!isMe && (
        <div
          className="shrink-0 pt-4 md:pt-0 cursor-pointer"
          onClick={() => onShowProfile?.(profileUsername || sender)}
        >
          <div className="chat-message-avatar-frame relative h-9 w-9 p-[1px] md:h-8 md:w-8 md:p-0">
            {/* Golden Premium Frame (Mobile) */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-amber-600 via-yellow-400 to-amber-600 shadow-[0_0_6px_rgba(251,191,36,0.35)] md:hidden" />
            <div className="absolute inset-[2px] rounded-full bg-zinc-900 md:hidden" />

            <div className="relative flex h-full w-full items-center justify-center rounded-full bg-zinc-800 p-[1.5px] md:bg-zinc-200">
              {avatar ? (
                <img
                  src={avatar}
                  alt={sender}
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-full bg-zinc-700 text-xs font-bold text-white md:bg-transparent md:text-zinc-600 md:text-xs md:font-medium">
                  {sender[0].toUpperCase()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Menu for right side (my messages) - Moved to left of message */}
      {isMe && !isSystemMessage && renderMessageMenu()}

      <div className="flex flex-col max-w-[82%] md:max-w-[68%]">
        {onlyMedia ? (
          image?.includes("/emom/") ? (
            <div className="flex flex-col relative">
              {showSender && (
                <span className={`ml-1 mb-1 ${senderTextClass}`}>
                  {sender}
                  {speakerSuffix && (
                    <span className={speakerSuffixClass}>{speakerSuffix}</span>
                  )}
                  :
                </span>
              )}
              <div className="flex items-end gap-2">
                {renderMedia()}
                <span className="text-[10px] text-zinc-400 mb-2">{time}</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col">
              {showSender && (
                <div className="md:hidden self-start ml-0.5">
                  <div className="chat-message-sender-tag relative inline-flex rounded-t-[10px] bg-[var(--chat-mobile-bubble-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--chat-mobile-bubble-text)] shadow-none">
                    {sender}
                    {speakerSuffix && (
                      <span className={speakerSuffixClass}>{speakerSuffix}</span>
                    )}
                  </div>
                </div>
              )}
              <div className={`${bubbleBase} ${isMe ? 'rounded-tr-[6px]' : 'rounded-tl-[6px]'}`}>
                <div className="flex flex-col md:flex-row md:flex-wrap md:items-baseline md:gap-x-2 md:gap-y-0.5">
                  {showSender && (
                    <>
                      {/* Desktop Nickname Style */}
                      <span className={`hidden md:inline ${senderTextClass}`}>
                        {sender}
                        {speakerSuffix && (
                          <span className={speakerSuffixClass}>{speakerSuffix}</span>
                        )}
                        :
                      </span>
                    </>
                  )}
                  <div className="flex items-center justify-between gap-4 md:contents">
                    {renderMedia()}
                    <span className={`shrink-0 self-end md:ml-auto ${welcomeTimeClass}`}>
                      {time}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )
        ) : (
          <>
            {/* Reply Preview - yanıtlanan mesaj varsa göster */}
            {replyToMessage && (
              <div
                onClick={handleScrollToReply}
                className={`mb-1 rounded-lg border-l-4 ${
                  isMe
                    ? "border-blue-400 bg-blue-50/50"
                    : "border-zinc-400 bg-zinc-50"
                } px-3 py-2 cursor-pointer hover:opacity-80 transition-opacity`}
              >
                <div className="flex items-center gap-1 text-xs font-medium text-zinc-500">
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
                  <span>{replyToMessage.username}</span>
                </div>
                <p className="text-xs text-zinc-600 truncate mt-0.5 line-clamp-1">
                  {formatMessageContent(replyToMessage.content)}
                </p>
              </div>
            )}
            {hasMedia ? (
              <div className="flex flex-col">
                {showSender && (
                  <div className="md:hidden self-start ml-0.5">
                    <div className="inline-flex rounded-t-[10px] bg-[var(--chat-mobile-bubble-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--chat-mobile-bubble-text)] shadow-none">
                      {sender}
                      {speakerSuffix && (
                        <span className={speakerSuffixClass}>{speakerSuffix}</span>
                      )}
                    </div>
                  </div>
                )}
                <div className={`${bubbleBase} ${isMe ? 'rounded-tr-[6px]' : 'rounded-tl-[6px]'}`}>
                  <div className="flex flex-col md:flex-row md:flex-wrap md:items-baseline md:gap-x-2 md:gap-y-0.5">
                    {showSender && (
                      <span className={`hidden md:inline ${senderTextClass}`}>
                        {sender}
                        {speakerSuffix && (
                          <span className={speakerSuffixClass}>{speakerSuffix}</span>
                        )}
                        :
                      </span>
                    )}
                    <div className="flex items-center justify-between gap-4 md:contents">
                      {renderMedia()}
                      <span className={`shrink-0 self-end md:ml-auto ${welcomeTimeClass}`}>
                        {time}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col">
                {showSender && (
                  <div className="md:hidden self-start ml-0.5">
                    <div className="inline-flex rounded-t-[10px] bg-[var(--chat-mobile-bubble-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--chat-mobile-bubble-text)] shadow-none">
                      {sender}
                      {speakerSuffix && (
                        <span className={speakerSuffixClass}>{speakerSuffix}</span>
                      )}
                    </div>
                  </div>
                )}
                <div
                  className={`${bubbleBase} ${isMe ? 'rounded-tr-[6px]' : 'rounded-tl-[6px]'}`}
                  style={messageTextStyle}
                >
                  <div className="flex flex-col md:flex-row md:flex-wrap md:items-baseline md:gap-x-2 md:gap-y-0.5">
                    {showSender && (
                      <span className={`hidden md:inline ${senderTextClass}`}>
                        {sender}
                        {speakerSuffix && (
                          <span className={speakerSuffixClass}>{speakerSuffix}</span>
                        )}
                        :
                      </span>
                    )}
                    <div className="flex items-center justify-between gap-4 md:contents">
                      <div
                        className="flex flex-wrap items-baseline min-w-0"
                        style={{
                          ...messageTextStyle,
                          ...welcomeMessageTextStyle,
                        }}
                      >
                        <span className="break-words">
                          {formatMessageContent(content)}
                        </span>
                      </div>
                      <span className={`shrink-0 self-end md:ml-auto ${welcomeTimeClass}`}>
                        {time}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Menu for left side (other users' messages) - Moved to right of message */}
      {!isMe && !isSystemMessage && renderMessageMenu()}

      {isMe && (
        <div className="shrink-0 pt-3 md:pt-0">
          <div className="chat-message-avatar-frame relative h-9 w-9 p-[1px] md:h-8 md:w-8 md:p-0">
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-amber-600 via-yellow-400 to-amber-600 shadow-[0_0_6px_rgba(251,191,36,0.35)] md:hidden" />
            <div className="absolute inset-[2px] rounded-full bg-zinc-900 md:hidden" />

            <div className="relative flex h-full w-full items-center justify-center rounded-full bg-zinc-800 p-[1.5px] text-xs font-bold text-white md:bg-green-500 md:p-0">
              {avatar ? (
                <img
                  src={avatar}
                  alt={sender}
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                sender[0].toUpperCase()
              )}
            </div>
          </div>
        </div>
      )}
      {/* Image Modal / Lightbox */}
      {typeof document !== "undefined" && isModalOpen && image
        ? createPortal(
            <div
              className="fixed inset-0 z-[2147483640] flex items-center justify-center bg-black/92 p-4 backdrop-blur-sm animate-in fade-in duration-200"
              onClick={() => setIsModalOpen(false)}
            >
              <button
                type="button"
                className="fixed right-4 top-[max(1rem,env(safe-area-inset-top))] z-[2147483647] flex h-12 w-12 items-center justify-center rounded-full bg-white text-zinc-950 shadow-2xl ring-2 ring-black/20 transition-colors hover:bg-zinc-100 active:scale-95 md:right-6 md:top-6"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsModalOpen(false);
                }}
                aria-label="Gorsel onizlemesini kapat"
              >
                <X className="h-8 w-8" />
              </button>
              <div
                className="relative z-[2147483641] flex h-full max-h-[90vh] w-full max-w-5xl items-center justify-center"
                onClick={(e) => e.stopPropagation()}
              >
                <img
                  src={image}
                  alt="Full size"
                  className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-300"
                />
              </div>
            </div>,
          document.body,
        )
        : null}
    </div>
  );
};
