import React from "react";
import { ChevronLeft } from "lucide-react";

type ChatHeaderProps = {
  name: string;
  ownerName?: string | null;
  ownerRole?: string | null;
  description?: string | null;
  ownerAvatar?: string | null;
  mobileActions?: React.ReactNode;
  mobileVoiceSlots?: React.ReactNode;
  mobileVoiceSlotCount?: number;
  mobileVoiceActiveCount?: number;
  mobileBackgroundImage?: string | null;
  onMobileBack?: () => void;
};

export const ChatHeader = ({
  name,
  ownerName,
  description,
  ownerAvatar,
  mobileActions,
  mobileVoiceSlots,
  mobileVoiceSlotCount = 0,
  mobileVoiceActiveCount = 0,
  onMobileBack,
}: ChatHeaderProps) => {
  const displayOwnerLabel = "Oda Sahibi";
  const displayOwnerUsername = ownerName || "-";
  const displayDescription = description || "Çevrimiçi";

  return (
    <>
      <header className="chat-theme-mobile-header relative px-2.5 pt-2.5 md:hidden">
        <div className="overflow-hidden rounded-[22px] border-2 border-[var(--chat-border)] bg-[var(--chat-header-bg)] shadow-[0_10px_24px_rgba(0,0,0,0.14)]">
          <div className="flex min-h-[52px] items-center justify-between gap-2 border-b border-[var(--chat-border)] px-2.5 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--chat-border)] bg-[var(--chat-card-bg)] text-[var(--chat-text)] shadow-sm active:scale-95"
                aria-label="Odalar"
                onClick={() => {
                  if (onMobileBack) return onMobileBack();
                  if (typeof window !== "undefined") window.history.back();
                }}
              >
                <ChevronLeft className="h-5 w-5 stroke-[2.3]" />
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.45)]" />
                  <h1 className="truncate text-[13px] font-black tracking-tight text-[var(--chat-text)]">
                    {decodeURIComponent(name)}
                  </h1>
                </div>
                <span className="mt-0.5 block truncate text-[9px] font-bold text-[var(--chat-muted)]">
                  Oda sahibi · {decodeURIComponent(displayOwnerUsername)}
                </span>
              </div>
            </div>
            {mobileActions ? <div className="flex shrink-0 items-center gap-1.5">{mobileActions}</div> : null}
          </div>

          {mobileVoiceSlotCount > 0 && mobileVoiceSlots ? (
            <div className="px-2.5 pb-2.5 pt-2">
              <div className="mb-1.5 flex items-center justify-between px-1">
                <span className="text-[9px] font-black uppercase tracking-[0.14em] text-[var(--chat-muted)]">Ses Sahnesi</span>
                <span className="rounded-full border border-[var(--chat-border)] bg-[var(--chat-card-bg)] px-2 py-0.5 text-[9px] font-black text-[var(--chat-text)]">
                  {mobileVoiceActiveCount}/{mobileVoiceSlotCount}
                </span>
              </div>
              <div
                className="grid gap-2 rounded-[16px] border border-[var(--chat-border)] bg-[var(--chat-card-soft-bg)] p-2 shadow-inner"
                style={{ gridTemplateColumns: `repeat(${mobileVoiceSlotCount}, minmax(0, 1fr))` }}
              >
                {mobileVoiceSlots}
              </div>
            </div>
          ) : null}
        </div>
      </header>

      <header className="chat-theme-header hidden min-h-14 items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-200 px-3 py-2 md:flex sm:h-16 sm:px-6 sm:py-0">
        <div className="flex min-w-0 items-center gap-2">
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold text-zinc-900 sm:text-lg">
              {decodeURIComponent(name)}
            </h1>
            <span className="line-clamp-1 text-xs text-zinc-500">
              {decodeURIComponent(displayDescription)}
            </span>
          </div>
        </div>

        <div className="hidden shrink-0 items-center gap-3 sm:flex">
          {ownerAvatar && (
            <img
              src={ownerAvatar}
              alt={displayOwnerLabel}
              className="h-10 w-10 rounded-full object-cover"
            />
          )}
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold text-zinc-900">
              {displayOwnerLabel}
            </span>
            <span className="text-xs text-zinc-500">
              {decodeURIComponent(displayOwnerUsername)}
            </span>
          </div>
        </div>
      </header>
    </>
  );
};
