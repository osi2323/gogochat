import React from "react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isSubmitting?: boolean;
}

export const SystemResetModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onConfirm,
  isSubmitting = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 text-red-600">
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
                  d="M12 8v4l3 3M21 12a9 9 0 11-9-9"
                />
              </svg>
            </div>
            <span className="text-base font-semibold text-gray-900">
              Sistem Resetleme
            </span>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
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

        <div className="space-y-4 px-6 py-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-500">
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
                d="M12 8v4l3 3M21 12a9 9 0 11-9-9"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900">
            Sistemi resetlediğinize emin misiniz?
          </h3>
          <p className="text-sm text-gray-700 leading-relaxed">
            Evet derseniz tüm kullanıcılarda 10 saniyelik sayaç başlayacak ve
            sayaç bitince kullanıcılar siteden çıkarılacak.
          </p>
        </div>

        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={onConfirm}
            disabled={isSubmitting}
            className="flex-1 rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-emerald-300"
          >
            {isSubmitting ? "Başlatılıyor..." : "Evet"}
          </button>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 rounded-lg bg-red-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-red-300"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
