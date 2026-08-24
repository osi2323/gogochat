"use client";

import { useEffect, useMemo, useState } from "react";
import { getClientApiClient } from "@/lib/api/clientApi";
import { subscribeToAnimationCatalogUpdates } from "@/lib/animationCatalogSync";
import type {
  WebConsoleAnimationItem,
  WebConsoleAnimationsResponse,
} from "@/services/systemSettingsService";

type AnimationPickerProps = {
  onAnimationSelect: (animationUrl: string) => void;
};

export const AnimationPicker = ({
  onAnimationSelect,
}: AnimationPickerProps) => {
  const apiClient = useMemo(() => getClientApiClient(), []);
  const [animations, setAnimations] = useState<WebConsoleAnimationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchAnimations = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get<WebConsoleAnimationsResponse>(
          "/system-settings/public-animations",
        );
        if (!cancelled) {
          setAnimations(response.data.items);
        }
      } catch {
        if (!cancelled) {
          setAnimations([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void fetchAnimations();
    const unsubscribe = subscribeToAnimationCatalogUpdates(() => {
      void fetchAnimations();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [apiClient]);

  const getAnimationAssetUrl = (item: WebConsoleAnimationItem) =>
    `${item.url}?v=${encodeURIComponent(item.updatedAt)}`;

  return (
    <div className="flex max-h-[min(54dvh,250px)] w-[min(calc(100vw-16px),248px)] flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl md:max-h-[min(60vh,320px)] md:w-[min(92vw,320px)]">
      <div className="border-b border-zinc-200 bg-zinc-50 px-2.5 py-1.5 md:px-4 md:py-3">
        <h3 className="text-xs font-semibold text-zinc-700 md:text-sm">Animasyon Seç</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-1.5 md:p-3">
        {loading ? (
          <div className="grid grid-cols-5 gap-1 md:gap-2 sm:grid-cols-6">
            {Array.from({ length: 12 }).map((_, index) => (
              <div
                key={index}
                className="aspect-square animate-pulse rounded-md border border-zinc-200 bg-zinc-100 md:rounded-lg"
              />
            ))}
          </div>
        ) : animations.length === 0 ? (
          <div className="py-6 text-center text-xs text-zinc-500">
            Gösterilecek animasyon bulunamadı.
          </div>
        ) : (
          <div className="grid grid-cols-5 gap-1 md:gap-2 sm:grid-cols-6">
            {animations.map((animation) => (
              <button
                key={animation.fileName}
                onClick={() => onAnimationSelect(animation.url)}
                className="relative aspect-square overflow-hidden rounded-md border border-zinc-200 transition-all hover:scale-110 hover:border-blue-400 hover:shadow-md active:scale-95 md:rounded-lg"
              >
                <img
                  src={getAnimationAssetUrl(animation)}
                  alt={`Animation ${animation.fileName}`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
