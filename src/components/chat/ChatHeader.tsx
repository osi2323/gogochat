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
  onMobileBack,
}: ChatHeaderProps) => {
  const displayOwnerLabel = "Oda Sahibi";
  const displayOwnerUsername = ownerName || "-";
  const displayDescription = description || "Çevrimiçi";

  return (
    <>
      <header
        className="chat-theme-mobile-header relative overflow-hidden bg-transparent px-2.5 pt-2.5 text-white md:hidden"
      >
        <div className="flex items-center justify-between gap-2 rounded-[18px] border border-white/10 bg-black/18 p-1.5 shadow-[0_10px_28px_rgba(0,0,0,0.22)] backdrop-blur-md">
          <div className="flex min-w-0 items-center gap-1.5">
            <button
              type="button"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/8 shadow-[0_4px_14px_rgba(0,0,0,0.22)] transition-all active:scale-95 active:opacity-80"
              aria-label="Geri"
              onClick={() => {
                if (onMobileBack) {
                  onMobileBack();
                  return;
                }
                if (typeof window !== "undefined") window.history.back();
              }}
            >
              <span className="flex h-full w-full items-center justify-center rounded-xl bg-black/35 backdrop-blur-md">
                <ChevronLeft className="h-5 w-5 text-white stroke-[2.4]" />
              </span>
            </button>
            <div className="flex h-8 min-w-0 rounded-xl border border-white/10 bg-white/8 shadow-[0_4px_14px_rgba(0,0,0,0.18)]">
              <div className="flex h-full min-w-0 items-center gap-2 rounded-xl bg-black/28 py-1 pl-1 pr-3 backdrop-blur-md">
                {ownerAvatar ? (
                  <img
                    src={ownerAvatar}
                    alt={displayOwnerLabel}
                    className="h-6 w-6 shrink-0 rounded-lg object-cover ring-1 ring-white/15"
                  />
                ) : (
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600/70 to-blue-600/70 text-[7px] font-black ring-1 ring-white/15">
                    ROOT
                  </div>
                )}
                <div className="min-w-0 leading-tight">
                  <h1 className="truncate text-[11px] font-black tracking-tight text-white drop-shadow-sm">
                    {decodeURIComponent(name)}
                  </h1>
                  <span className="line-clamp-1 text-[8px] font-semibold text-white/65">
                    Sahibi : {decodeURIComponent(displayOwnerUsername)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {mobileActions ? (
            <div className="flex shrink-0 items-center gap-1.5">
              {mobileActions}
            </div>
          ) : null}
        </div>

        {mobileVoiceSlots ? (
          <div className="mt-2.5 grid grid-cols-5 gap-1.5 rounded-[18px] border border-white/8 bg-black/10 p-1.5 backdrop-blur-sm">
            {mobileVoiceSlots}
          </div>
        ) : null}
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
