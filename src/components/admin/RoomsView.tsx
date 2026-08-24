"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiClient } from "@/services/apiClient";
import { getClientApiClient } from "@/lib/api/clientApi";
import { Room } from "@/services/roomService";

type RoomsViewProps = {
  initialRoomName?: string | null;
  socket?: any | null;
  canManageRooms: boolean;
  canEncryptRooms: boolean;
  canDeleteRooms: boolean;
  canManageRadio: boolean;
};

type RoomOwnerOption = {
  id: number;
  username: string;
  isGuest?: boolean;
};

type RoomForm = {
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
  roomImage: string;
  logo: string;
  roomImageFile: File | null;
  logoFile: File | null;
};

const RENAME_LOCKED_ROOM_NAMES = new Set([
  "toplantı odası",
  "sorunlar",
  "başvuru odası",
]);

const isRenameLockedRoom = (name?: string | null): boolean =>
  RENAME_LOCKED_ROOM_NAMES.has((name || "").toLowerCase());

export const RoomsView = ({
  initialRoomName,
  socket,
  canManageRooms,
  canEncryptRooms,
  canDeleteRooms,
  canManageRadio,
}: RoomsViewProps) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [ownerOptions, setOwnerOptions] = useState<RoomOwnerOption[]>([]);
  const [ownersLoading, setOwnersLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const createEmptyForm = useMemo<() => RoomForm>(
    () => () => ({
      name: "",
      ownerName: "",
      description: "",
      maxUsers: 200,
      visibleUserCount: 15,
      isPrivate: false,
      // isEditable backend default true, gönderilmiyor
      password: "",
      radioPanelLink: "",
      radioRequestLink: "",
      listOrder: 0,
      minStar: 0,
      backgroundColor: "#e5e7eb",
      roomImage: "",
      logo: "",
      roomImageFile: null,
      logoFile: null,
    }),
    [],
  );

  // Sort rooms to ensure specific rooms are always at the bottom, and Lobby is at the top
  const sortedRooms = useMemo(() => {
    const bottomRoomNames = ["Toplantı Odası", "Sorunlar", "Başvuru Odası"];

    const lobbyRooms: Room[] = [];
    const bottomRooms: Room[] = [];
    const otherRooms: Room[] = [];

    rooms.forEach((room) => {
      const lowerName = (room.name || "").toLowerCase();
      if (lowerName === "lobby") {
        lobbyRooms.push(room);
      } else if (bottomRoomNames.includes(room.name)) {
        bottomRooms.push(room);
      } else {
        otherRooms.push(room);
      }
    });

    // Sort bottom rooms by their position in the bottomRoomNames array
    bottomRooms.sort((a, b) => {
      return bottomRoomNames.indexOf(a.name) - bottomRoomNames.indexOf(b.name);
    });

    return [...lobbyRooms, ...otherRooms, ...bottomRooms];
  }, [rooms]);

  const [form, setForm] = useState<RoomForm>(createEmptyForm());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const autoOpenedRef = useRef(false);

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await apiClient.rooms.getRooms();
        setRooms(data);
      } catch (err) {
        console.error("Odalar yüklenemedi", err);
        setError("Odalar yüklenemedi");
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadOwnerOptions = async () => {
      try {
        setOwnersLoading(true);
        const client = getClientApiClient();
        // Oda sahibi listesinde normal üyeleri değil,
        // yalnızca rütbesi/yıldızı olan yetkilileri getir.
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
        console.error("Oda sahibi seçilebilecek üyeler yüklenemedi", err);
        if (!cancelled) setOwnerOptions([]);
      } finally {
        if (!cancelled) setOwnersLoading(false);
      }
    };

    void loadOwnerOptions();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!initialRoomName || autoOpenedRef.current || rooms.length === 0) return;
    const target = rooms.find(
      (r) => (r.name || "").toLowerCase() === initialRoomName.toLowerCase(),
    );
    if (target) {
      autoOpenedRef.current = true;
      openEdit(target);
    }
  }, [initialRoomName, rooms]);

  const openEdit = (room: Room) => {
    if (!canManageRooms) {
      setSaveError("Oda yönetimi yetkiniz yok.");
      return;
    }
    setIsCreateMode(false);
    setSelectedRoom(room);
    setForm({
      name: room.name ?? "",
      ownerName: room.owner?.username ?? "",
      description: room.description ?? "",
      maxUsers: room.maxUsers ?? 0,
      visibleUserCount: room.visibleUserCount ?? 0,
      isPrivate: room.isPrivate ?? false,
      // isEditable backend default true, gönderilmiyor
      password: "",
      radioPanelLink: room.radioPanelLink ?? "",
      radioRequestLink: room.radioRequestLink ?? "",
      listOrder: room.listOrder ?? 0,
      minStar: room.minStar ?? 0,
      backgroundColor: room.backgroundColor || "#e5e7eb",
      roomImage: room.roomImage ?? "",
      logo: room.logo ?? "",
      roomImageFile: null,
      logoFile: null,
    });
    setSaveError(null);
    setIsModalOpen(true);
  };

  const openCreate = () => {
    if (!canManageRooms) {
      setSaveError("Oda yönetimi yetkiniz yok.");
      return;
    }
    setIsCreateMode(true);
    setSelectedRoom(null);
    setForm(createEmptyForm());
    setSaveError(null);
    setIsModalOpen(true);
  };

  const closeRoomModal = () => {
    setIsModalOpen(false);
    setSelectedRoom(null);
  };

  const handleChange = (
    field: keyof RoomForm,
    value: string | number | boolean | File | null,
  ) => {
    setForm((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const handleDelete = async () => {
    if (!canManageRooms) {
      setSaveError("Oda yönetimi yetkiniz yok.");
      return;
    }
    if (!canDeleteRooms) {
      setSaveError("Oda silme yetkiniz yok.");
      return;
    }
    if (!selectedRoom) return;

    if (
      !confirm(
        `"${selectedRoom.name}" odasını silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`,
      )
    ) {
      return;
    }

    try {
      setIsSaving(true);
      setSaveError(null);
      await apiClient.rooms.deleteRoom(selectedRoom.id);
      const refreshed = await apiClient.rooms.getRooms();
      setRooms(refreshed);
      setIsModalOpen(false);
      setSelectedRoom(null);
      setForm(createEmptyForm());
    } catch (err) {
      console.error("Oda silinemedi", err);
      setSaveError("Oda silinemedi, lütfen tekrar deneyin");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!canManageRooms) {
      setSaveError("Oda yönetimi yetkiniz yok.");
      return;
    }
    if (!form) return;
    const payload = new FormData();

    const appendIfPresent = (
      key: string,
      value: string | number | boolean | null,
    ) => {
      if (value === null || value === undefined) return;
      if (typeof value === "string" && value.trim() === "") return;
      payload.append(key, String(value));
    };

    const appendIfChanged = (
      key: string,
      value: string | number | boolean | null,
      original: unknown,
    ) => {
      if (value === null || value === undefined) return;
      const normalizedOriginal =
        typeof original === "boolean" || typeof original === "number"
          ? original
          : (original ?? "");
      if (value === normalizedOriginal) return;
      if (
        typeof value === "string" &&
        value.trim() === "" &&
        normalizedOriginal === ""
      )
        return;
      payload.append(key, String(value));
    };

    // Create mode
    if (isCreateMode) {
      if (!form.name.trim()) {
        setSaveError("Oda adı zorunlu");
        return;
      }
      if (form.listOrder === null || form.listOrder === undefined) {
        setSaveError("Liste sırası zorunlu");
        return;
      }

      appendIfPresent("name", form.name.trim());
      appendIfPresent("listOrder", form.listOrder);
      appendIfPresent("ownerName", form.ownerName);
      appendIfPresent("description", form.description);
      appendIfPresent("maxUsers", form.maxUsers);
      appendIfPresent("visibleUserCount", form.visibleUserCount);
      if (canEncryptRooms) {
        appendIfPresent("isPrivate", form.isPrivate);
        appendIfPresent("password", form.password);
      } else if (form.isPrivate || form.password.trim().length > 0) {
        setSaveError("Oda şifreleme yetkiniz yok.");
        return;
      }
      if (!canManageRadio) {
        if (
          form.radioPanelLink.trim().length > 0 ||
          form.radioRequestLink.trim().length > 0
        ) {
          setSaveError("Radyo yönetimi yetkiniz yok.");
          return;
        }
      } else {
        appendIfPresent("radioPanelLink", form.radioPanelLink);
        appendIfPresent("radioRequestLink", form.radioRequestLink);
      }
      appendIfPresent("minStar", form.minStar);
      appendIfPresent("backgroundColor", form.backgroundColor);
      appendIfPresent("roomImage", form.roomImage);
      appendIfPresent("logo", form.logo);
      if (form.roomImageFile)
        payload.append("roomImageFile", form.roomImageFile);
      if (form.logoFile) payload.append("logoFile", form.logoFile);

      try {
        setIsSaving(true);
        setSaveError(null);
        await apiClient.rooms.createRoom(payload);
        const refreshed = await apiClient.rooms.getRooms();
        setRooms(refreshed);
        setIsModalOpen(false);
        setSelectedRoom(null);
        setForm(createEmptyForm());
      } catch (err) {
        console.error("Oda oluşturulamadı", err);
        setSaveError("Oda oluşturulamadı, lütfen tekrar deneyin");
      } finally {
        setIsSaving(false);
      }
      return;
    }

    if (!selectedRoom) return;

    const renameLocked = isRenameLockedRoom(selectedRoom.name);
    const nextName = form.name.trim();
    const currentName = (selectedRoom.name || "").trim();

    if (renameLocked && nextName !== currentName) {
      setSaveError(
        `"${selectedRoom.name}" odasının adı değiştirilemez.`,
      );
      return;
    }

    if (!renameLocked) {
      appendIfChanged("name", form.name, selectedRoom.name);
    }
    appendIfChanged("ownerName", form.ownerName, selectedRoom.owner?.username);
    appendIfChanged("description", form.description, selectedRoom.description);
    appendIfChanged("maxUsers", form.maxUsers, selectedRoom.maxUsers);
    appendIfChanged(
      "visibleUserCount",
      form.visibleUserCount,
      selectedRoom.visibleUserCount,
    );
    if (canEncryptRooms) {
      appendIfChanged("isPrivate", form.isPrivate, selectedRoom.isPrivate);
      if (form.password.trim().length > 0) {
        payload.append("password", form.password.trim());
      }
    } else if (
      form.isPrivate !== (selectedRoom.isPrivate ?? false) ||
      form.password.trim().length > 0
    ) {
      setSaveError("Oda şifreleme yetkiniz yok.");
      return;
    }
    if (!canManageRadio) {
      if (
        form.radioPanelLink !== (selectedRoom.radioPanelLink ?? "") ||
        form.radioRequestLink !== (selectedRoom.radioRequestLink ?? "")
      ) {
        setSaveError("Radyo yönetimi yetkiniz yok.");
        return;
      }
    } else {
      appendIfChanged(
        "radioPanelLink",
        form.radioPanelLink,
        selectedRoom.radioPanelLink,
      );
      appendIfChanged(
        "radioRequestLink",
        form.radioRequestLink,
        selectedRoom.radioRequestLink,
      );
    }
    appendIfChanged("listOrder", form.listOrder, selectedRoom.listOrder);
    appendIfChanged("minStar", form.minStar, selectedRoom.minStar);
    appendIfChanged(
      "backgroundColor",
      form.backgroundColor,
      selectedRoom.backgroundColor,
    );
    appendIfChanged("roomImage", form.roomImage, selectedRoom.roomImage);
    appendIfChanged("logo", form.logo, selectedRoom.logo);

    if (form.roomImageFile) {
      payload.append("roomImageFile", form.roomImageFile);
    }
    if (form.logoFile) {
      payload.append("logoFile", form.logoFile);
    }

    if ([...payload.keys()].length === 0) {
      setIsModalOpen(false);
      setSelectedRoom(null);
      return;
    }

    try {
      setIsSaving(true);
      setSaveError(null);
      await apiClient.rooms.updateRoom(selectedRoom.id, payload);
      const refreshed = await apiClient.rooms.getRooms();
      setRooms(refreshed);

      // Notify all connected users about room update via socket
      if (socket) {
        socket.emit("room:updated", {
          roomId: selectedRoom.id,
          roomName: selectedRoom.name,
        });
      }

      setIsModalOpen(false);
      setSelectedRoom(null);
    } catch (err) {
      console.error("Oda güncellenemedi", err);
      setSaveError("Oda güncellenemedi, lütfen tekrar deneyin");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-600">Odalar yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
          >
            Yenile
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
      <div className="flex shrink-0 items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-800">Odalar</p>
          <p className="text-xs text-gray-500">
            Toplam {rooms.length} oda listeleniyor
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openCreate}
            disabled={!canManageRooms}
            title={canManageRooms ? "Yeni Oda" : "Oda yönetimi yetkiniz yok"}
            className={`inline-flex items-center gap-2 px-3 py-2 text-sm text-white rounded-lg transition-colors ${
              canManageRooms
                ? "bg-green-600 hover:bg-green-700"
                : "bg-gray-300 cursor-not-allowed"
            }`}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Yeni Oda
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-auto pr-1 md:hidden">
        {sortedRooms.map((room) => (
          <div
            key={room.id}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-400">
                    #{room.id}
                  </span>
                  <p className="truncate text-sm font-semibold text-gray-900">
                    {room.name}
                  </p>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Sahip: {room.owner?.username ? room.owner.username : "ROOT"}
                </p>
                <p className="mt-2 text-xs text-gray-600">
                  Şifre: {room.isPrivate ? "Var" : "-"}
                </p>
              </div>

              <button
                onClick={() => room.isEditable !== false && openEdit(room)}
                disabled={!canManageRooms || room.isEditable === false}
                title={
                  canManageRooms
                    ? room.isEditable === false
                      ? "Bu oda düzenlenemez"
                      : "Düzenle"
                    : "Oda yönetimi yetkiniz yok"
                }
                className={`shrink-0 rounded-lg px-3 py-2 text-sm font-semibold text-white transition-colors ${
                  !canManageRooms || room.isEditable === false
                    ? "cursor-not-allowed bg-gray-300"
                    : "bg-green-600 hover:bg-green-700"
                }`}
              >
                Düzenle
              </button>
            </div>
          </div>
        ))}

        {rooms.length === 0 && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
            Oda bulunamadı
          </div>
        )}
      </div>

      <div className="hidden min-h-0 flex-1 overflow-auto md:block">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-200 text-left text-xs font-semibold text-gray-600 uppercase"></tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {sortedRooms.map((room) => (
              <tr key={room.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-800">{room.id}</td>
                <td className="px-4 py-3 text-sm text-gray-900">{room.name}</td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {room.owner?.username
                    ? `( ${room.owner.username} )`
                    : "( ROOT )"}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {room.isPrivate ? "Var" : "-"}
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => room.isEditable !== false && openEdit(room)}
                    disabled={!canManageRooms || room.isEditable === false}
                    title={
                      canManageRooms
                        ? room.isEditable === false
                          ? "Bu oda düzenlenemez"
                          : "Düzenle"
                        : "Oda yönetimi yetkiniz yok"
                    }
                    className={`px-3 py-1.5 rounded-lg text-white text-sm transition-colors ${
                      !canManageRooms || room.isEditable === false
                        ? "bg-gray-300 cursor-not-allowed"
                        : "bg-green-600 hover:bg-green-700"
                    }`}
                  >
                    Düzenle
                  </button>
                </td>
              </tr>
            ))}
            {rooms.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-6 text-center text-sm text-gray-500"
                >
                  Oda bulunamadı
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && form && (
        <div className="absolute inset-0 z-[120] flex min-h-0 bg-white">
          <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-white shadow-2xl">
            {/* Scrollable Content */}
            <div className="min-h-0 flex-1 scroll-pt-4 overflow-y-auto overscroll-contain px-3 pb-3 pt-5 sm:p-4">
              <div className="space-y-3 sm:space-y-4">
                {/* Section: Temel Bilgiler */}
                <div className="space-y-2 sm:space-y-2.5">
                  <div className="flex items-center gap-2 pb-0.5 border-b border-zinc-100">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    <h4 className="text-sm font-bold text-zinc-900 uppercase tracking-tight">
                      Temel Bilgiler
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-zinc-700 ml-1">
                        ODA ADI
                      </label>
                      <input
                        className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
                        value={form.name ?? ""}
                        onChange={(e) => handleChange("name", e.target.value)}
                        placeholder="Oda adını girin"
                        disabled={
                          !isCreateMode && isRenameLockedRoom(selectedRoom?.name)
                        }
                        title={
                          !isCreateMode && isRenameLockedRoom(selectedRoom?.name)
                            ? "Bu odanın adı değiştirilemez"
                            : undefined
                        }
                      />
                      {!isCreateMode && isRenameLockedRoom(selectedRoom?.name) && (
                        <p className="text-[10px] text-amber-600 font-medium ml-1">
                          Bu odanın adı değiştirilemez.
                        </p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-zinc-700 ml-1">
                        ODA SAHİBİ (OPSİYONEL)
                      </label>
                      <select
                        className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
                        value={form.ownerName ?? ""}
                        onChange={(e) =>
                          handleChange("ownerName", e.target.value)
                        }
                        disabled={ownersLoading}
                      >
                        <option value="">
                          {ownersLoading ? "Üyeler yükleniyor..." : "Oda sahibi yok"}
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
                      <p className="text-[10px] text-zinc-500 font-medium ml-1">
                        Oda sahibi yalnızca rütbeli / yetkili kullanıcılar arasından seçilir.
                      </p>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-700 ml-1">
                      AÇIKLAMA
                    </label>
                    <textarea
                      className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none resize-none"
                      rows={2}
                      value={form.description ?? ""}
                      onChange={(e) =>
                        handleChange("description", e.target.value)
                      }
                      placeholder="Oda açıklamasını buraya yazın..."
                    />
                  </div>
                </div>

                {/* Section: Kapasite ve Sıralama */}
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2 pb-0.5 border-b border-zinc-100">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    <h4 className="text-sm font-bold text-zinc-900 uppercase tracking-tight">
                      Kapasite ve Sıralama
                    </h4>
                  </div>
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-zinc-700 ml-1">
                        MAKS. KULLANICI
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
                        value={form.maxUsers ?? 0}
                        onChange={(e) =>
                          handleChange(
                            "maxUsers",
                            Math.min(100, Math.max(0, Number(e.target.value))),
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-zinc-700 ml-1">
                        GÖRÜNEN SAYI
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
                        value={form.visibleUserCount ?? 0}
                        onChange={(e) =>
                          handleChange(
                            "visibleUserCount",
                            Math.min(100, Math.max(0, Number(e.target.value))),
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-zinc-700 ml-1">
                        LİSTE SIRASI
                      </label>
                      <input
                        type="number"
                        className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
                        value={form.listOrder ?? 0}
                        onChange={(e) =>
                          handleChange("listOrder", Number(e.target.value))
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* Section: Güvenlik ve Giriş */}
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2 pb-0.5 border-b border-zinc-100">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    <h4 className="text-sm font-bold text-zinc-900 uppercase tracking-tight">
                      Güvenlik ve Giriş
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
                    <div className="space-y-3 sm:space-y-4">
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-zinc-700 ml-1 uppercase tracking-wider">
                          MİNİMUM YILDIZ GEREKSİNİMİ
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={27}
                          className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
                          value={form.minStar ?? 0}
                          onChange={(e) =>
                            handleChange(
                              "minStar",
                              Math.min(27, Math.max(0, Number(e.target.value))),
                            )
                          }
                        />
                        <p className="hidden text-[10px] font-medium text-zinc-400 sm:block">
                          Odaya giriş için gereken minimum yıldız seviyesi
                          (Maks. 27)
                        </p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-50 border border-zinc-100">
                        <input
                          type="checkbox"
                          id="isPrivate"
                          className="w-5 h-5 rounded-md border-zinc-300 text-blue-600 focus:ring-blue-500"
                          checked={!!form.isPrivate}
                          disabled={!canEncryptRooms}
                          onChange={(e) =>
                            handleChange("isPrivate", e.target.checked)
                          }
                        />
                        <label
                          htmlFor="isPrivate"
                          className="text-sm font-bold text-zinc-800 cursor-pointer"
                        >
                          ÖZEL ODA (ŞİFRELİ)
                        </label>
                      </div>
                      {form.isPrivate && (
                        <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                          <label className="text-xs font-bold text-zinc-700 ml-1">
                            ODA ŞİFRESİ
                          </label>
                          <input
                            type="password"
                            autoComplete="new-password"
                            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
                            value={form.password ?? ""}
                            disabled={!canEncryptRooms}
                            onChange={(e) =>
                              handleChange("password", e.target.value)
                            }
                            placeholder="Giriş şifresini belirleyin"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Section: Paneller ve Linkler */}
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2 pb-0.5 border-b border-zinc-100">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                    <h4 className="text-sm font-bold text-zinc-900 uppercase tracking-tight">
                      Paneller ve Linkler
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-zinc-700 ml-1">
                        RADYO PANEL LİNKİ
                      </label>
                      <input
                        className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
                        value={form.radioPanelLink ?? ""}
                        onChange={(e) =>
                          handleChange("radioPanelLink", e.target.value)
                        }
                        placeholder="https://..."
                        disabled={!canManageRadio}
                        title={
                          canManageRadio ? undefined : "Radyo yönetimi yetkiniz yok"
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-zinc-700 ml-1">
                        RADYO İSTEK PANELİ
                      </label>
                      <input
                        className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
                        value={form.radioRequestLink ?? ""}
                        onChange={(e) =>
                          handleChange("radioRequestLink", e.target.value)
                        }
                        placeholder="https://..."
                        disabled={!canManageRadio}
                        title={
                          canManageRadio ? undefined : "Radyo yönetimi yetkiniz yok"
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* Section: Görünüm ve Görseller */}
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2 pb-0.5 border-b border-zinc-100">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <h4 className="text-sm font-bold text-zinc-900 uppercase tracking-tight">
                      Görünüm ve Görseller
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
                    <div className="space-y-2.5 sm:space-y-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-700 ml-1">
                          ARKA PLAN RENGİ
                        </label>
                        <div className="flex items-center gap-3">
                          <input
                            type="color"
                            className="h-10 w-16 rounded-xl border-none p-0 cursor-pointer overflow-hidden shadow-sm"
                            value={form.backgroundColor ?? "#e5e7eb"}
                            onChange={(e) =>
                              handleChange("backgroundColor", e.target.value)
                            }
                          />
                          <input
                            className="flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 focus:bg-white focus:border-blue-500 transition-all outline-none"
                            value={form.backgroundColor ?? "#e5e7eb"}
                            onChange={(e) =>
                              handleChange("backgroundColor", e.target.value)
                            }
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-700 ml-1">
                          LOGO LİNKİ (OPSİYONEL)
                        </label>
                        <input
                          className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 focus:bg-white focus:border-blue-500 transition-all outline-none"
                          value={form.logo ?? ""}
                          onChange={(e) => handleChange("logo", e.target.value)}
                          placeholder="https://example.com/logo.png"
                        />
                      </div>
                    </div>
                    <div className="space-y-2.5 sm:space-y-3">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between ml-1">
                          <label className="text-xs font-bold text-zinc-700">
                            ODA ARKA PLAN RESMİ YÜKLE
                          </label>
                          {form.roomImage && (
                            <button
                              type="button"
                              onClick={() => {
                                handleChange("roomImage", "");
                                handleChange("roomImageFile", null);
                              }}
                              className="text-xs text-red-500 hover:text-red-700 font-semibold transition-colors"
                            >
                              Kaldır
                            </button>
                          )}
                        </div>
                        {form.roomImage && (
                          <div className="relative w-full h-20 rounded-xl overflow-hidden border border-zinc-200">
                            <img
                              src={
                                form.roomImage.startsWith("http")
                                  ? form.roomImage
                                  : `${(process.env.NEXT_PUBLIC_IMAGE_ACCESS_URL ?? "").replace(/\/$/, "")}/${form.roomImage.replace(/^\/+/, "")}`
                              }
                              alt="Oda arkaplanı"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <div className="relative group">
                          <input
                            type="file"
                            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-600 hover:file:bg-blue-100 cursor-pointer"
                            onChange={(e) =>
                              handleChange(
                                "roomImageFile",
                                e.target.files?.[0] ?? null,
                              )
                            }
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between ml-1">
                          <label className="text-xs font-bold text-zinc-700">
                            LOGO YÜKLE
                          </label>
                          {form.logo && (
                            <button
                              type="button"
                              onClick={() => {
                                handleChange("logo", "");
                                handleChange("logoFile", null);
                              }}
                              className="text-xs text-red-500 hover:text-red-700 font-semibold transition-colors"
                            >
                              Kaldır
                            </button>
                          )}
                        </div>
                        {form.logo && (
                          <div className="relative w-full h-20 rounded-xl overflow-hidden border border-zinc-200 bg-zinc-100 flex items-center justify-center">
                            <img
                              src={
                                form.logo.startsWith("http")
                                  ? form.logo
                                  : `${(process.env.NEXT_PUBLIC_IMAGE_ACCESS_URL ?? "").replace(/\/$/, "")}/${form.logo.replace(/^\/+/, "")}`
                              }
                              alt="Oda logosu"
                              className="max-h-full max-w-full object-contain"
                            />
                          </div>
                        )}
                        <div className="relative group">
                          <input
                            type="file"
                            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-600 hover:file:bg-blue-100 cursor-pointer"
                            onChange={(e) =>
                              handleChange(
                                "logoFile",
                                e.target.files?.[0] ?? null,
                              )
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-zinc-100 bg-zinc-50 px-3 py-2.5 sm:px-5 sm:py-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              {!isCreateMode ? (
                <button
                  onClick={handleDelete}
                  disabled={
                    isSaving ||
                    !canDeleteRooms ||
                    [
                      "lobby",
                      "toplantı odası",
                      "sorunlar",
                      "başvuru odası",
                    ].includes((selectedRoom?.name || "").toLowerCase())
                  }
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-50 px-4 py-2 text-sm font-bold text-red-600 transition-all hover:bg-red-100 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:justify-start sm:text-xs"
                  title={
                    !canDeleteRooms
                      ? "Oda silme yetkiniz yok."
                      : [
                      "lobby",
                      "toplantı odası",
                      "sorunlar",
                      "başvuru odası",
                    ].includes((selectedRoom?.name || "").toLowerCase())
                        ? "Bu oda silinemez"
                        : "Odayı Sil"
                  }
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                  Odayı Sil
                </button>
              ) : (
                <div />
              )}

              <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-3">
                <button
                  type="button"
                  onClick={closeRoomModal}
                  className="w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-bold text-zinc-600 transition-all hover:bg-zinc-100 sm:w-auto sm:px-6 sm:py-2.5"
                >
                  İptal
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 sm:w-auto sm:px-8 sm:py-2.5"
                >
                  {isSaving ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      Kaydediliyor...
                    </div>
                  ) : (
                    "Değişiklikleri Kaydet"
                  )}
                </button>
              </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
