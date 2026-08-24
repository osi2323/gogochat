"use client";

import { useState } from "react";
import type { Socket } from "socket.io-client";
import { SettingsModal } from "./SettingsModal";

type SidebarNavProps = {
  onTabChange?: (
    tab: "room" | "all" | "rooms" | "calls" | "friends" | "wall",
  ) => void;
  onOpenMessages?: () => void;
  totalUserCount?: number;
  friendCounts?: { incoming: number };
  socket?: Socket | null;
  currentUserStarCount?: number;
  canUseRoof?: boolean;
  dmUnreadCount?: number;
  hideRoomsButton?: boolean;
};

export const SidebarNav = ({
  onTabChange,
  onOpenMessages,
  totalUserCount = 0,
  friendCounts,
  socket,
  currentUserStarCount = 0,
  canUseRoof = false,
  dmUnreadCount = 0,
  hideRoomsButton = false,
}: SidebarNavProps) => {
  const [showSettings, setShowSettings] = useState(false);
  const incomingCount = friendCounts?.incoming ?? 0;

  return (
    <>
      <div className="flex items-center justify-between w-full md:fixed md:right-5 md:top-5 md:z-[70] md:w-auto md:justify-end md:gap-7 md:rounded-2xl md:border md:border-slate-800/90 md:bg-[#07111c]/94 md:px-5 md:py-3 md:shadow-[0_12px_35px_rgba(0,0,0,0.35)] md:backdrop-blur-xl">
        {/* Rooms button is hidden on desktop because the room strip is already at the top. */}
        {!hideRoomsButton ? (
          <button
            onClick={() => onTabChange?.("rooms")}
            className="cursor-pointer text-red-500 transition-all duration-200 hover:scale-110 hover:text-red-600 active:scale-95"
            title="Odalar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
            </svg>
          </button>
        ) : null}
        {/* Chat with badge */}
        <button
          onClick={() => onTabChange?.("room")}
          className="relative cursor-pointer text-blue-500 transition-all duration-200 hover:scale-110 hover:text-blue-600 active:scale-95"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-7 w-7"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
          </svg>
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-blue-500 px-1 text-[9px] font-bold text-white">
            {totalUserCount}
          </span>
        </button>
        {/* Phone */}
        <button
          onClick={() => onTabChange?.("calls")}
          className="cursor-pointer text-rose-500 transition-all duration-200 hover:scale-110 hover:text-rose-600 active:scale-95"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-7 w-7"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
          </svg>
        </button>
        {/* Group with badge */}
        <button
          onClick={() => onTabChange?.("friends")}
          className="relative cursor-pointer text-amber-500 transition-all duration-200 hover:scale-110 hover:text-amber-600 active:scale-95"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-7 w-7"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6v1H2v-1a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
          </svg>
          {incomingCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-blue-500 px-1 text-[9px] font-bold text-white">
              {incomingCount}
            </span>
          )}
        </button>
        {/* Edit/Pencil */}
        <button
          onClick={() => onTabChange?.("wall")}
          className="cursor-pointer text-purple-500 transition-all duration-200 hover:scale-110 hover:text-purple-600 active:scale-95"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-7 w-7"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
          </svg>
        </button>
        {/* Mail */}
        <button
          onClick={() => onOpenMessages?.()}
          className="relative cursor-pointer text-cyan-500 transition-all duration-200 hover:scale-110 hover:text-cyan-600 active:scale-95"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-7 w-7"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
            <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
          </svg>
          {dmUnreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
              {dmUnreadCount}
            </span>
          )}
        </button>
        {/* Settings */}
        <button
          onClick={() => setShowSettings(true)}
          className="cursor-pointer text-slate-500 transition-all duration-200 hover:scale-110 hover:text-slate-600 active:scale-95 md:text-slate-400 md:hover:text-slate-200"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-7 w-7"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        socket={socket}
        currentUserStarCount={currentUserStarCount}
        canUseRoof={canUseRoof}
      />
    </>
  );
};
