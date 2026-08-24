"use client";

import React, { useEffect, useRef, useState } from "react";

interface ChatContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onClearScreen: () => void;
  onDeleteHistory: () => void;
  onSafeExit: () => void;
  starCount?: number;
  canAccessAdminPanel?: boolean;
  canAccessMeetingRoom?: boolean;
  canDeleteRoomMessages?: boolean;
  onOpenAdminPanel?: () => void;
  onGoMeetingRoom?: () => void;
  onManageRoom?: () => void;
  onDeleteRoomMessages?: () => void;
  onClearBannedUsers?: () => void;
  onClearBlockedUsers?: () => void;
  onClearRoomBlocks?: () => void;
  onClearGlobalMutes?: () => void;
}

export const ChatContextMenu = ({
  x,
  y,
  onClose,
  onClearScreen,
  onDeleteHistory,
  onSafeExit,
  starCount = 0,
  canAccessAdminPanel = false,
  canAccessMeetingRoom = false,
  canDeleteRoomMessages = false,
  onOpenAdminPanel,
  onGoMeetingRoom,
  onManageRoom,
  onDeleteRoomMessages,
  onClearBannedUsers,
  onClearRoomBlocks,
  onClearGlobalMutes,
}: ChatContextMenuProps) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [showBanSubmenu, setShowBanSubmenu] = useState(false);
  const submenuTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleBanSubmenuMouseEnter = () => {
    if (submenuTimeoutRef.current) {
      clearTimeout(submenuTimeoutRef.current);
      submenuTimeoutRef.current = null;
    }
    setShowBanSubmenu(true);
  };

  const handleBanSubmenuMouseLeave = () => {
    submenuTimeoutRef.current = setTimeout(() => {
      setShowBanSubmenu(false);
    }, 150);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        if (submenuTimeoutRef.current) {
          clearTimeout(submenuTimeoutRef.current);
        }
        setShowBanSubmenu(false);
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (submenuTimeoutRef.current) {
          clearTimeout(submenuTimeoutRef.current);
        }
        setShowBanSubmenu(false);
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
      if (submenuTimeoutRef.current) {
        clearTimeout(submenuTimeoutRef.current);
      }
    };
  }, [onClose]);

  // Ban submenu items
  const banSubmenuItems = [
    {
      label: "Banlıları Temizle",
      onClick: () => {
        onClearBannedUsers?.();
        setShowBanSubmenu(false);
        onClose();
      },
      color: "text-red-600",
      bgColor: "bg-red-50",
    },
    {
      label: "Engellileri Temizle",
      onClick: () => {
        onClearRoomBlocks?.();
        setShowBanSubmenu(false);
        onClose();
      },
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
    {
      label: "Oda Engellerini Temizle",
      onClick: () => {
        onClearGlobalMutes?.();
        setShowBanSubmenu(false);
        onClose();
      },
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
    },
  ];

  // Admin menu items
  const adminMenuItems =
    starCount >= 1 || canAccessAdminPanel || canDeleteRoomMessages
      ? [
          ...(canAccessAdminPanel
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
                  label: "Admin Paneli",
                  onClick: () => {
                    onOpenAdminPanel?.();
                    onClose();
                  },
                  color: "text-red-600",
                  bgColor: "bg-red-50",
                },
              ]
            : []),
          ...(canAccessMeetingRoom
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
                  label: "Toplantı Odası",
                  onClick: () => {
                    onGoMeetingRoom?.();
                    onClose();
                  },
                  color: "text-indigo-600",
                  bgColor: "bg-indigo-50",
                },
              ]
            : []),
          ...(starCount >= 1
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
            label: "Bu Odayı Yönet",
            onClick: () => {
              onManageRoom?.();
              onClose();
            },
            color: "text-purple-600",
            bgColor: "bg-purple-50",
          },
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
            label: "Ban Engel Temizle",
            onClick: () => {
              // Bu artık hover ile çalışacak
            },
            color: "text-pink-600",
            bgColor: "bg-pink-50",
            hasSubmenu: true,
          },
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
                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            ),
            label: "Ekran temizle",
            onClick: () => {
              onClearScreen();
              onClose();
            },
            color: "text-teal-600",
            bgColor: "bg-teal-50",
          },
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
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            ),
            label: "Geçmişi Temizle",
            onClick: () => {
              onDeleteHistory();
              onClose();
            },
            color: "text-green-600",
            bgColor: "bg-green-50",
          },
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
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            ),
            label: "Güvenli çıkış",
            onClick: () => {
              onSafeExit();
              onClose();
            },
            color: "text-amber-600",
            bgColor: "bg-amber-50",
          },
              ]
            : []),
          ...(canDeleteRoomMessages
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
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  ),
                  label: "Oda Yazılarını Sil",
                  onClick: () => {
                    onDeleteRoomMessages?.();
                    onClose();
                  },
                  color: "text-orange-600",
                  bgColor: "bg-orange-50",
                },
              ]
            : []),
        ]
      : [];

  const regularMenuItems = [
    ...(canAccessMeetingRoom
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
            label: "Toplantı Odası",
            onClick: () => {
              onGoMeetingRoom?.();
              onClose();
            },
            color: "text-indigo-600",
            bgColor: "bg-indigo-50",
          },
        ]
      : []),
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
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      ),
      label: "Ekran temizle",
      onClick: () => {
        onClearScreen();
        onClose();
      },
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
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
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
      label: "Geçmişi Temizle",
      onClick: () => {
        onDeleteHistory();
        onClose();
      },
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
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
            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
          />
        </svg>
      ),
      label: "Güvenli çıkış",
      onClick: () => {
        onSafeExit();
        onClose();
      },
      color: "text-gray-600",
      bgColor: "bg-gray-50",
    },
  ];

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Combine menu items based on star count
  const menuItems =
    adminMenuItems.length > 0 ? adminMenuItems : regularMenuItems;

  return (
    <>
      {isMobile && (
        <div
          className="fixed inset-0 z-[140] bg-transparent animate-in fade-in-0 duration-200"
          onClick={onClose}
        />
      )}
      <div
        ref={menuRef}
        className={`fixed z-[150] bg-white rounded-2xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.3)] border border-zinc-200/80 py-2.5 min-w-[240px] animate-in fade-in-0 zoom-in-95 duration-200 ${
          isMobile ? "slide-in-from-right-4" : "slide-in-from-top-2"
        }`}
      style={
        isMobile
          ? {
              right: "12px",
              top: "84px",
            }
          : {
              left: `${x}px`,
              top: `${y}px`,
            }
      }
    >
      {menuItems.map((item, index) => (
        <div
          key={index}
          className="relative"
          onMouseEnter={
            item.label === "Ban Engel Temizle"
              ? handleBanSubmenuMouseEnter
              : undefined
          }
          onMouseLeave={
            item.label === "Ban Engel Temizle"
              ? handleBanSubmenuMouseLeave
              : undefined
          }
        >
          <button
            onClick={item.onClick}
            className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-gradient-to-r hover:from-zinc-50 hover:to-zinc-100/50 transition-all duration-200 text-left group hover:scale-[1.02] active:scale-[0.98] ${
              item.label === "Ban Engel Temizle" ? "justify-between" : ""
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded transition-transform duration-200 group-hover:scale-110 ${item.bgColor} ${item.color}`}
              >
                {item.icon}
              </div>
              <span className="text-sm font-medium text-zinc-700 group-hover:text-zinc-900 transition-colors duration-200">
                {item.label}
              </span>
            </div>
            {item.label === "Ban Engel Temizle" && (
              <svg
                className="w-4 h-4 text-zinc-500 transition-transform duration-200 group-hover:rotate-180"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            )}
          </button>

          {/* Submenu */}
          {item.label === "Ban Engel Temizle" && showBanSubmenu && (
            <div
              className={`absolute top-0 bg-white rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.2)] border border-zinc-200/80 py-2 min-w-[180px] z-10 animate-in fade-in-0 zoom-in-95 duration-200 ${
                isMobile
                  ? "right-full mr-2 slide-in-from-right-2"
                  : "left-full ml-2 slide-in-from-left-2"
              }`}
              onMouseEnter={() => {
                if (submenuTimeoutRef.current) {
                  clearTimeout(submenuTimeoutRef.current);
                  submenuTimeoutRef.current = null;
                }
              }}
              onMouseLeave={() => {
                submenuTimeoutRef.current = setTimeout(() => {
                  setShowBanSubmenu(false);
                }, 150);
              }}
            >
              {banSubmenuItems.map((subItem, subIndex) => (
                <button
                  key={subIndex}
                  onClick={subItem.onClick}
                  className="w-full px-4 py-2 flex items-center hover:bg-gradient-to-r hover:from-zinc-50 hover:to-zinc-100/50 transition-all duration-200 text-left group hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span className="text-sm font-medium text-zinc-700 group-hover:text-zinc-900 transition-colors duration-200">
                    {subItem.label}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
    </>
  );
};
