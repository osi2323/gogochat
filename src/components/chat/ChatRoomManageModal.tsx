"use client";

import { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/services/apiClient";
import { getClientApiClient } from "@/lib/api/clientApi";

type RoomForm = {
  id: number | null;
  name: string;
  ownerName: string;
  description: string;
  maxUsers: number;
  visibleUserCount: number;
  isPrivate: boolean;
  password: string;
  radioPanelLink: string;
  radioRequestLink: string;
  listOrder: number;
  minStar: number;
  backgroundColor: string;
};

type RoomOwnerOption = {
  id: number;
  username: string;
  isGuest?: boolean;
};

type ChatRoomManageModalProps = {
  isOpen: boolean;
  onClose: () => void;
  roomName: string;
  canManageRadio: boolean;
  socket?: {
    emit: (event: string, payload: { roomId: number; roomName: string }) => void;
  } | null;
};

type OriginalRoom = {
  id: number;
  name: string;
  ownerName: string;
  description: string;
  maxUsers: number;
  visibleUserCount: number;
  isPrivate: boolean;
  radioPanelLink: string;
  radioRequestLink: string;
  listOrder: number;
  minStar: number;
  backgroundColor: string;
};

export const ChatRoomManageModal = ({
  isOpen,
  onClose,
  roomName,
  canManageRadio,
  socket,
}: ChatRoomManageModalProps) => {
  const [form, setForm] = useState<RoomForm | null>(null);
  const [originalRoom, setOriginalRoom] = useState<OriginalRoom | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [ownerOptions, setOwnerOptions] = useState<RoomOwnerOption[]>([]);
  const [ownersLoading, setOwnersLoading] = useState(false);

  const normalizedName = useMemo(
    () => (roomName || "").toLowerCase().trim(),
    [roomName]
  );

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    const loadOwnerOptions = async () => {
      try {
        setOwnersLoading(true);
        const client = getClientApiClient();
        const response = await client.get("/user/star-users", {
          params: { _ts: Date.now() },
        });

        const rawUsers = Array.isArray(response?.data) ? response.data : [];
        const unique = new Map<string, RoomOwnerOption>();

        rawUsers.forEach((item: any) => {
          const username = String(item?.username ?? "").trim();
          if (!username || item?.isGuest === true) return;

          const key = username.toLocaleLowerCase("tr-TR");
          if (!unique.has(key)) {
            unique.set(key, {
              id: Number(item?.id),
              username,
              isGuest: false,
            });
          }
        });

        if (!cancelled) {
          setOwnerOptions(
            [...unique.values()].sort((a, b) =>
              a.username.localeCompare(b.username, "tr"),
            ),
          );
        }
      } catch (err) {
        console.error("Oda sahibi yetkili listesi alınamadı", err);
        if (!cancelled) setOwnerOptions([]);
      } finally {
        if (!cancelled) setOwnersLoading(false);
      }
    };

    void loadOwnerOptions();

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const rooms = await apiClient.rooms.getRooms();
        const target = rooms.find(
          (r) => (r.name || "").toLowerCase().trim() === normalizedName
        );
        if (!target) {
          setError("Oda bulunamadı");
          setForm(null);
          return;
        }
        const detail = await apiClient.rooms.getRoom(target.id);
        const roomData = {
          id: detail.id ?? target.id ?? null,
          name: detail.name ?? target.name ?? "",
          ownerName: detail.owner?.username ?? "",
          description: detail.description ?? "",
          maxUsers: detail.maxUsers ?? 0,
          visibleUserCount: detail.visibleUserCount ?? 0,
          isPrivate: detail.isPrivate ?? false,
          radioPanelLink: detail.radioPanelLink ?? "",
          radioRequestLink: detail.radioRequestLink ?? "",
          listOrder: detail.listOrder ?? 0,
          minStar: detail.minStar ?? 0,
          backgroundColor: detail.backgroundColor || "#e5e7eb",
        };
        setOriginalRoom(roomData as OriginalRoom);
        setForm({
          ...roomData,
          password: "",
        });
      } catch (err) {
        console.error("Oda bilgisi alınamadı", err);
        setError("Oda bilgisi alınamadı");
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [isOpen, normalizedName]);

  const handleChange = (
    field: keyof RoomForm,
    value: string | number | boolean
  ) => {
    setForm((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const handleSave = async () => {
    if (!form || !form.id || !originalRoom) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const payload = new FormData();
      const appendIfChanged = (
        key: string,
        value: string | number | boolean | null,
        original: unknown
      ) => {
        if (value === null || value === undefined) return;
        const normalizedOriginal =
          typeof original === "boolean" || typeof original === "number"
            ? original
            : original ?? "";
        if (value === normalizedOriginal) return;
        if (
          typeof value === "string" &&
          value.trim() === "" &&
          normalizedOriginal === ""
        )
          return;
        payload.append(key, String(value));
      };

      appendIfChanged("name", form.name, originalRoom.name);
      appendIfChanged("ownerName", form.ownerName, originalRoom.ownerName);
      appendIfChanged(
        "description",
        form.description,
        originalRoom.description
      );
      appendIfChanged("maxUsers", form.maxUsers, originalRoom.maxUsers);
      appendIfChanged(
        "visibleUserCount",
        form.visibleUserCount,
        originalRoom.visibleUserCount
      );
      appendIfChanged("isPrivate", form.isPrivate, originalRoom.isPrivate);
      if (form.password.trim()) {
        payload.append("password", form.password.trim());
      }
      if (!canManageRadio) {
        if (
          form.radioPanelLink !== originalRoom.radioPanelLink ||
          form.radioRequestLink !== originalRoom.radioRequestLink
        ) {
          setSaveError("Radyo yönetimi yetkiniz yok.");
          setIsSaving(false);
          return;
        }
      } else {
        appendIfChanged(
          "radioPanelLink",
          form.radioPanelLink,
          originalRoom.radioPanelLink
        );
        appendIfChanged(
          "radioRequestLink",
          form.radioRequestLink,
          originalRoom.radioRequestLink
        );
      }
      appendIfChanged("listOrder", form.listOrder, originalRoom.listOrder);
      appendIfChanged("minStar", form.minStar, originalRoom.minStar);
      appendIfChanged(
        "backgroundColor",
        form.backgroundColor,
        originalRoom.backgroundColor
      );

      // Değişiklik yoksa sadece kapat
      if ([...payload.keys()].length === 0) {
        onClose();
        return;
      }

      const updatedRoom = await apiClient.rooms.updateRoom(form.id, payload);
      socket?.emit("room:updated", {
        roomId: updatedRoom.id,
        roomName: updatedRoom.name,
      });
      onClose();
    } catch (err) {
      console.error("Oda güncellenemedi", err);
      setSaveError("Oda güncellenemedi, lütfen tekrar deneyin");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-2 backdrop-blur-sm sm:p-4">
      <div className="flex max-h-[78svh] w-full max-w-[360px] flex-col overflow-hidden rounded-[18px] bg-white shadow-2xl sm:max-h-[85vh] sm:max-w-lg md:max-w-2xl md:rounded-2xl">
        <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/50 px-4 py-2 md:px-5 md:py-3">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 md:text-[10px]">
              {roomName}
            </p>
            <h3 className="text-base font-bold text-zinc-900 md:text-lg">
              Oda Düzenleme
            </h3>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-400 shadow-sm transition-all hover:border-zinc-300 hover:text-zinc-900 md:h-9 md:w-9"
          >
            <svg
              className="h-4 w-4"
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

        <div className="flex-1 overflow-y-auto p-3 md:p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-gray-600">
                  Oda bilgisi yükleniyor...
                </p>
              </div>
            </div>
          ) : error ? (
            <div className="p-6 text-center text-sm text-red-600">{error}</div>
          ) : form ? (
            <div className="space-y-3 md:space-y-5">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
                <div className="space-y-1 md:space-y-1.5">
                  <label className="ml-1 text-[11px] font-bold text-zinc-700 md:text-xs">
                    ODA ADI
                  </label>
                  <input
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-900 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 md:rounded-xl md:py-2"
                    value={form.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                  />
                </div>

                <div className="space-y-1 md:space-y-1.5">
                  <label className="ml-1 text-[11px] font-bold text-zinc-700 md:text-xs">
                    ODA SAHİBİ ADI
                  </label>
                  <select
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-900 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 md:rounded-xl md:py-2"
                    value={form.ownerName}
                    onChange={(e) => handleChange("ownerName", e.target.value)}
                    disabled={ownersLoading}
                  >
                    <option value="">
                      {ownersLoading ? "Yetkililer yükleniyor..." : "Oda sahibi yok"}
                    </option>

                    {form.ownerName &&
                    !ownerOptions.some(
                      (user) =>
                        user.username.toLocaleLowerCase("tr-TR") ===
                        form.ownerName.toLocaleLowerCase("tr-TR"),
                    ) ? (
                      <option value={form.ownerName}>{form.ownerName}</option>
                    ) : null}

                    {ownerOptions.map((user) => (
                      <option key={user.id} value={user.username}>
                        {user.username}
                      </option>
                    ))}
                  </select>
                  <p className="ml-1 text-[10px] font-medium text-zinc-500">
                    Yalnızca rütbeli / yetkili kullanıcılar oda sahibi seçilebilir.
                  </p>
                </div>
              </div>

              <div className="space-y-1 md:space-y-1.5">
                <label className="ml-1 text-[11px] font-bold text-zinc-700 md:text-xs">
                  AÇIKLAMA
                </label>
                <textarea
                  className="w-full resize-none rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-900 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 md:rounded-xl md:py-2"
                  rows={2}
                  value={form.description}
                  onChange={(e) => handleChange("description", e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3 md:gap-4">
                <div className="space-y-1 md:space-y-1.5">
                  <label className="ml-1 text-[11px] font-bold leading-tight text-zinc-700 md:text-xs">
                    MAKS. KULLANICI
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-900 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 md:rounded-xl md:py-2"
                    value={form.maxUsers}
                    onChange={(e) => {
                      const value = Math.min(100, Math.max(1, Number(e.target.value)));
                      handleChange("maxUsers", value);
                      handleChange("visibleUserCount", value);
                    }}
                  />
                </div>
                <div className="space-y-1 md:space-y-1.5">
                  <label className="ml-1 text-[11px] font-bold leading-tight text-zinc-700 md:text-xs">
                    GÖRÜNEN SAYI
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-900 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 md:rounded-xl md:py-2"
                    value={form.visibleUserCount}
                    disabled
                    title="Görünen kullanıcı sayısı otomatik olarak maksimum kullanıcı sayısına eşittir"
                  />
                </div>
              </div>

              <div className="flex items-start gap-2 px-1 md:items-center">
                <input
                  type="checkbox"
                  id="isPrivate"
                  className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 md:mt-0"
                  checked={!!form.isPrivate}
                  onChange={(e) => handleChange("isPrivate", e.target.checked)}
                />
                <label
                  htmlFor="isPrivate"
                  className="text-[11px] font-bold leading-snug text-zinc-700 md:text-xs"
                >
                  ÖZEL ODA (ŞİFRELİ / YALNIZCA YETKİLİ GİRİŞ)
                </label>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
                <div className="space-y-1 md:space-y-1.5">
                  <label className="ml-1 text-[11px] font-bold text-zinc-700 md:text-xs">
                    RADYO PANEL LİNKİ
                  </label>
                  <input
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-900 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 md:rounded-xl md:py-2"
                    value={form.radioPanelLink}
                    onChange={(e) =>
                      handleChange("radioPanelLink", e.target.value)
                    }
                    disabled={!canManageRadio}
                    title={
                      canManageRadio ? undefined : "Radyo yönetimi yetkiniz yok"
                    }
                  />
                </div>
                <div className="space-y-1 md:space-y-1.5">
                  <label className="ml-1 text-[11px] font-bold text-zinc-700 md:text-xs">
                    RADYO İSTEK PANELİ
                  </label>
                  <input
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-900 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 md:rounded-xl md:py-2"
                    value={form.radioRequestLink}
                    onChange={(e) =>
                      handleChange("radioRequestLink", e.target.value)
                    }
                    disabled={!canManageRadio}
                    title={
                      canManageRadio ? undefined : "Radyo yönetimi yetkiniz yok"
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 md:gap-4">
                <div className="space-y-1 md:space-y-1.5">
                  <label className="ml-1 text-[11px] font-bold leading-tight text-zinc-700 md:text-xs">
                    LİSTE SIRASI
                  </label>
                  <input
                    type="number"
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-900 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 md:rounded-xl md:py-2"
                    value={form.listOrder}
                    onChange={(e) =>
                      handleChange("listOrder", Number(e.target.value))
                    }
                  />
                </div>
                <div className="space-y-1 md:space-y-1.5">
                  <label className="ml-1 text-[11px] font-bold leading-tight text-zinc-700 md:text-xs">
                    MİNİMUM YILDIZ
                  </label>
                  <input
                    type="number"
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-900 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 md:rounded-xl md:py-2"
                    value={form.minStar}
                    onChange={(e) =>
                      handleChange("minStar", Number(e.target.value))
                    }
                  />
                </div>
              </div>

              <div className="space-y-1 text-center md:space-y-1.5">
                <label className="ml-1 text-[11px] font-bold text-zinc-700 md:text-xs">
                  ARKA PLAN RENGİ
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    className="h-9 w-11 cursor-pointer overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 md:h-10 md:w-12 md:rounded-xl"
                    value={form.backgroundColor}
                    onChange={(e) =>
                      handleChange("backgroundColor", e.target.value)
                    }
                  />
                  <input
                    className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-900 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 md:rounded-xl md:py-2"
                    value={form.backgroundColor}
                    onChange={(e) =>
                      handleChange("backgroundColor", e.target.value)
                    }
                  />
                </div>
              </div>

              {saveError && (
                <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-xs font-medium text-red-600">
                  {saveError}
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-zinc-100 bg-zinc-50 px-4 py-2.5 md:gap-3 md:px-5 md:py-3">
          <button
            onClick={onClose}
            className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-bold text-zinc-600 transition-all hover:bg-zinc-50 hover:text-zinc-900"
          >
            İptal
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-blue-500/20 transition-all hover:bg-blue-700 disabled:opacity-60 md:px-6"
          >
            {isSaving ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </div>
      </div>
    </div>
  );
};
