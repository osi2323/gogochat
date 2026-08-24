"use client";

import {
  joinEffectDefinitions,
  type JoinEffectId,
} from "@/lib/joinEffects";

type JoinEffectModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  currentEffect: JoinEffectId | null;
  isAuthorized: boolean;
  isSaving?: boolean;
  onSelect: (effect: JoinEffectId) => void;
  onClear: () => void;
};

export const JoinEffectModal = ({
  isOpen,
  onClose,
  onConfirm,
  currentEffect,
  isAuthorized,
  isSaving = false,
  onSelect,
  onClear,
}: JoinEffectModalProps) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-transparent px-4"
      onClick={() => {
        if (!isSaving) onClose();
      }}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-4 py-3">
          <div>
            <h3 className="text-base font-semibold text-zinc-900">
              Giriş Efektleri
            </h3>
            <p className="text-xs text-zinc-500">
              Odaya girdiğinizde tüm kullanıcılarda görünen banner efekti.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-100"
          >
            Kapat
          </button>
        </div>

        <div className="max-h-[56vh] space-y-3 overflow-y-auto p-4">
          {!isAuthorized && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              Bu özelliği kullanmak için en az 1 yıldızlı yetki gerekir.
            </div>
          )}

          {joinEffectDefinitions.map((item) => {
            const selected = currentEffect === item.id;
            return (
              <div
                key={item.id}
                className={`rounded-xl border p-2.5 ${
                  selected
                    ? "border-sky-300 bg-sky-50/40"
                    : "border-zinc-200 bg-zinc-50/60"
                }`}
              >
                <div className={`join-effect-preview join-effect-${item.id}`}>
                  {item.previewType === "gif" && item.gifPath && (
                    <img
                      src={item.gifPath}
                      alt={item.title}
                      loading="lazy"
                      className="join-effect-preview__gif"
                    />
                  )}
                  <div className="join-effect-preview__avatar">KM</div>
                  <div className="join-effect-preview__content">
                    <p className="join-effect-preview__title">
                      Rumuz siteye giriş yaptı
                    </p>
                    <p className={`join-effect-preview__meta ${item.starColorClass}`}>
                      ★★★★★★★★
                    </p>
                  </div>
                  <div className="join-effect-preview__badge">✦</div>
                </div>

                <div className="mt-2.5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-zinc-800">
                      {item.title}
                    </p>
                    <p className="text-xs text-zinc-500">{item.subtitle}</p>
                  </div>
                  {selected ? (
                    <div className="flex items-center gap-2">
                        <span className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white">
                          Seçili
                        </span>
                        <button
                          onClick={onClear}
                          disabled={!isAuthorized || isSaving}
                          className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:bg-zinc-400"
                        >
                          Kaldır
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => onSelect(item.id)}
                        disabled={!isAuthorized || isSaving}
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-zinc-400"
                      >
                        Seç
                      </button>
                    )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-end border-t border-zinc-200 px-4 py-3">
          <button
            onClick={onConfirm}
            disabled={isSaving}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
          >
            Tamam
          </button>
        </div>
      </div>
    </div>
  );
};
