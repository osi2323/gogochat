"use client";

import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { Camera, Image as ImageIcon, X } from "lucide-react";
import type { WallPostVisibility } from "@/services/wallPostsService";

type WallPostModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    content?: string;
    image?: string;
    backgroundColor?: string;
    visibility: WallPostVisibility;
  }) => Promise<void>;
  currentUserStarCount: number;
};

export const WallPostModal = ({
  isOpen,
  onClose,
  onSubmit,
  currentUserStarCount,
}: WallPostModalProps) => {
  const [content, setContent] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [backgroundColor, setBackgroundColor] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<WallPostVisibility>("members");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const canSelectStaff = currentUserStarCount >= 1;
  const selectedBackgroundColor = backgroundColor || "#ffffff";

  const resetForm = () => {
    setContent("");
    setImage(null);
    setBackgroundColor(null);
    setVisibility("members");
    setError(null);
    setIsSubmitting(false);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    resetForm();
    onClose();
  };

  const compressImage = (
    file: File,
    maxWidth = 800,
    quality = 0.7,
    targetSizeKB = 400,
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = document.createElement("img");
        img.onload = () => {
          let { width, height } = img;
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Canvas context not available"));
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          let currentQuality = quality;
          let dataUrl = canvas.toDataURL("image/jpeg", currentQuality);
          while (
            dataUrl.length > targetSizeKB * 1024 &&
            currentQuality > 0.1
          ) {
            currentQuality -= 0.1;
            dataUrl = canvas.toDataURL("image/jpeg", currentQuality);
          }
          resolve(dataUrl);
        };
        img.onerror = () => reject(new Error("Image load failed"));
        img.src = String(event.target?.result ?? "");
      };
      reader.onerror = () => reject(new Error("File read failed"));
      reader.readAsDataURL(file);
    });
  };

  const handleImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Lütfen sadece resim dosyası seçin.");
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setError("Resim boyutu 25MB'dan küçük olmalıdır.");
      return;
    }

    setError(null);
    try {
      const dataUrl = await compressImage(file);
      setImage(dataUrl);
    } catch (err) {
      console.error(err);
      setError("Resim yüklenemedi.");
    } finally {
      event.target.value = "";
    }
  };

  const handleSubmit = async () => {
    const trimmed = content.trim();
    if (!trimmed && !image) {
      setError("İçerik veya görsel eklemelisiniz.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        content: trimmed || undefined,
        image: image || undefined,
        backgroundColor: backgroundColor || undefined,
        visibility: canSelectStaff ? visibility : "members",
      });
      resetForm();
      onClose();
    } catch (err) {
      console.error(err);
      setError("Duvar yazısı paylaşılamadı.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const remaining = useMemo(() => 500 - content.length, [content.length]);
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3">
      <div className="flex max-h-[min(82vh,540px)] w-[min(calc(100vw-28px),420px)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-zinc-100">
          <h3 className="text-[17px] font-bold text-zinc-900">
            Ne düşünüyorsunuz?
          </h3>
          <button
            onClick={handleClose}
            className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-zinc-100"
            disabled={isSubmitting}
          >
            <X className="h-4 w-4 text-zinc-500" />
          </button>
        </div>

        <div className="min-h-0 space-y-2.5 overflow-y-auto p-3.5">
          <div className="space-y-1">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={500}
              placeholder="Ne düşünüyorsun?"
              className="w-full min-h-[72px] resize-none rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span>{remaining} karakter kaldı</span>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-zinc-600">Görsel</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex h-9 items-center justify-center gap-2 rounded-lg border border-zinc-200 px-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                disabled={isSubmitting}
              >
                <ImageIcon className="h-4 w-4 text-zinc-500" />
                Görsel ekle
              </button>
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="flex h-9 items-center justify-center gap-2 rounded-lg border border-zinc-200 px-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                disabled={isSubmitting}
              >
                <Camera className="h-4 w-4 text-zinc-500" />
                Kamera
              </button>
            </div>
            <div className="flex items-center">
              {image && (
                <button
                  onClick={() => setImage(null)}
                  className="text-xs text-red-500 hover:text-red-600"
                  disabled={isSubmitting}
                >
                  Kaldır
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleImageChange}
                className="hidden"
              />
            </div>
            {image && (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-2">
                <div className="flex h-24 w-full items-center justify-center overflow-hidden rounded-lg bg-white sm:h-32">
                  <img
                    src={image}
                    alt="Duvar görseli"
                    className="block h-auto max-h-full w-auto max-w-full object-contain"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-zinc-600">Kimler görebilir</p>
            <select
              value={canSelectStaff ? visibility : "members"}
              onChange={(e) =>
                setVisibility(e.target.value as WallPostVisibility)
              }
              disabled={!canSelectStaff}
              className="h-9 w-full rounded-lg border border-zinc-200 px-3 text-sm text-zinc-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-zinc-100 disabled:text-zinc-500"
            >
              <option value="members">Üyeler ve Yetkililer</option>
              <option value="staff">Sadece Yetkililer</option>
            </select>
            {!canSelectStaff && (
              <p className="text-xs text-zinc-500">
                Sadece 1 yıldız ve üzeri kullanıcılar yetkililer için paylaşım
                yapabilir.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="wall-post-background-color"
              className="text-xs font-semibold text-zinc-600"
            >
              Arkaplan rengi
            </label>
            <div className="flex items-center gap-3">
              <div className="relative h-10 w-16 overflow-hidden rounded-lg border border-zinc-200 shadow-sm">
                <input
                  id="wall-post-background-color"
                  type="color"
                  value={selectedBackgroundColor}
                  onChange={(e) =>
                    setBackgroundColor(
                      e.target.value.toLowerCase() === "#ffffff"
                        ? null
                        : e.target.value,
                    )
                  }
                  className="absolute -inset-1 h-[150%] w-[150%] cursor-pointer border-none bg-transparent disabled:cursor-not-allowed"
                  disabled={isSubmitting}
                  aria-label="Arkaplan rengi seç"
                />
              </div>
              <span className="text-xs font-semibold uppercase text-zinc-500">
                {selectedBackgroundColor}
              </span>
              {backgroundColor && (
                <button
                  type="button"
                  onClick={() => setBackgroundColor(null)}
                  className="ml-auto text-xs font-semibold text-zinc-500 hover:text-zinc-700"
                  disabled={isSubmitting}
                >
                  Temizle
                </button>
              )}
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="shrink-0 flex items-center justify-end gap-2 border-t border-zinc-100 bg-zinc-50 px-4 py-2.5">
          <button
            onClick={handleClose}
            className="rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-100"
            disabled={isSubmitting}
          >
            Vazgeç
          </button>
          <button
            onClick={handleSubmit}
            className="rounded-lg bg-green-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Paylaşılıyor..." : "Paylaş"}
          </button>
        </div>
      </div>
    </div>
  );
};
