"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { resolveAvatarUrl } from "@/lib/avatarUrl";

interface GeneralSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SettingCardProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  bgColor: string;
}

const SettingCard = ({ icon, label, onClick, bgColor }: SettingCardProps) => (
  <button
    onClick={onClick}
    className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 transition-all duration-200 hover:scale-[1.02] active:scale-95"
  >
    <div
      className={`w-14 h-14 rounded-xl ${bgColor} flex items-center justify-center text-white`}
    >
      {icon}
    </div>
    <span className="text-sm font-semibold text-gray-700 text-center">
      {label}
    </span>
  </button>
);

export const GeneralSettingsModal = ({
  isOpen,
  onClose,
}: GeneralSettingsModalProps) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const profile = useMemo(() => {
    if (typeof window === "undefined" || !isOpen) {
      return { username: "Misafir", icon: null };
    }
    const guestMode = localStorage.getItem("isGuest") === "true";
    const username = guestMode
      ? localStorage.getItem("guestUsername") || "Misafir"
      : localStorage.getItem("username") || "Misafir";
    const icon = localStorage.getItem("profileIcon");
    return { username, icon };
  }, [isOpen]);
  const profileInitials = useMemo(
    () => (profile.username ? profile.username.substring(0, 2).toUpperCase() : "KM"),
    [profile.username],
  );
  const resolvedProfileIcon = useMemo(() => {
    return resolveAvatarUrl(profile.icon);
  }, [profile.icon]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const settingsItems = [
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
      onClick: () => undefined,
    },
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
      onClick: () => undefined,
    },
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
      onClick: () => undefined,
    },
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

  return (
    <div
      ref={modalRef}
      className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-3xl overflow-hidden rounded-xl bg-white shadow-2xl z-[110]"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 bg-gray-50">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-200 text-gray-600 transition-colors hover:bg-gray-300 hover:text-gray-800"
          >
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
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-gray-300 bg-gray-100 text-sm font-semibold text-gray-700">
            {resolvedProfileIcon ? (
              <img
                src={resolvedProfileIcon}
                alt="avatar"
                className="h-full w-full object-cover bg-white"
              />
            ) : (
              profileInitials
            )}
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-600">
            <svg
              className="h-5 w-5 text-white"
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
          </div>
          <h2 className="text-xl font-semibold text-gray-800">Genel Ayarlar</h2>
        </div>
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-200 text-gray-600 transition-colors hover:bg-gray-300 hover:text-gray-800"
        >
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
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="p-6 bg-white">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {settingsItems.map((item, index) => (
            <SettingCard key={index} {...item} />
          ))}
        </div>
      </div>
    </div>
  );
};
