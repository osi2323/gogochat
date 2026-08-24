"use client";

import React from "react";
import { AlertCircle, X } from "lucide-react";

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
}

export const ConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Temizle",
  cancelText = "Vazgeç",
  variant = "danger",
}: ConfirmationModalProps) => {
  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      icon: <AlertCircle className="h-6 w-6 text-red-600" />,
      bg: "bg-red-50",
      button: "bg-red-600 hover:bg-red-700 text-white shadow-red-200",
    },
    warning: {
      icon: <AlertCircle className="h-6 w-6 text-amber-600" />,
      bg: "bg-amber-50",
      button: "bg-amber-600 hover:bg-amber-700 text-white shadow-amber-200",
    },
    info: {
      icon: <AlertCircle className="h-6 w-6 text-blue-600" />,
      bg: "bg-blue-50",
      button: "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200",
    },
  };

  const style = variantStyles[variant];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden animate-in zoom-in-95 fade-in duration-200">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-xl ${style.bg} shrink-0`}>
              {style.icon}
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-zinc-900 leading-tight">
                {title}
              </h3>
              <p className="mt-2 text-sm text-zinc-600 leading-relaxed">
                {message}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 p-4 bg-zinc-50 border-t border-zinc-100">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm font-semibold text-zinc-700 bg-white border border-zinc-200 rounded-xl hover:bg-zinc-100 transition-colors active:scale-[0.98]"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`flex-1 px-4 py-2.5 text-sm font-semibold rounded-xl shadow-lg transition-all active:scale-[0.98] ${style.button}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
