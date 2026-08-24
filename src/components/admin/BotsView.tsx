"use client";

import React, { useState, useMemo, useRef } from "react";
import { 
  Search, 
  Plus, 
  Pencil, 
  ArrowLeft, 
  Camera, 
  Trash2, 
  Save, 
  User, 
  UserPlus,
  ChevronRight,
  Shield,
  MessageSquare,
  Music,
  Monitor,
  Smartphone,
  Sparkles,
  Mars,
  Venus
} from "lucide-react";

interface Bot {
  id: number;
  username: string;
  gender: "male" | "female";
  role?: string;
  avatar?: string;
  status?: string;
  room?: string;
  userGif?: string;
  statusMode?: string;
  loginType?: string;
  messagePermission?: string;
  welcomeMessage?: string;
  welcomeAutoSendEnabled?: boolean;
  welcomeManualPromptEnabled?: boolean;
  isAI?: boolean;
  extraInfo?: string;
  fontName?: string;
  granite?: string;
}

interface BotRoleOption {
  id: number;
  name: string;
  starCount: number | null;
  starColor: string | null;
  icon: string | null;
}

interface BotsViewProps {
  bots: Bot[];
  onAdd: (bot: Partial<Bot>) => Promise<void>;
  onUpdate: (id: number, bot: Partial<Bot>) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onBack: () => void;
  isLoading?: boolean;
  availableRooms?: { label: string; value: string }[];
  availableRoles?: BotRoleOption[];
  availableStatusModes?: string[];
  availableUserGifs?: { label: string; value: string }[];
  availableFonts?: { label: string; value: string }[];
  availableGranites?: { label: string; value: string }[];
}

export const BotsView: React.FC<BotsViewProps> = ({
  bots,
  onAdd,
  onUpdate,
  onDelete,
  onBack,
  isLoading = false,
  availableRooms = [],
  availableRoles = [],
  availableStatusModes = [],
  availableUserGifs = [],
  availableFonts = [],
  availableGranites = []
}) => {
  const [view, setView] = useState<"list" | "edit" | "add">("list");
  const [selectedBot, setSelectedBot] = useState<Bot | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Form states
  const [formData, setFormData] = useState<Partial<Bot>>({});

  const botRoleOptions = useMemo(
    () =>
      availableRoles
        .filter((role) => (role.starCount ?? 0) <= 24)
        .sort((a, b) => (a.starCount ?? 0) - (b.starCount ?? 0)),
    [availableRoles],
  );

  const roomLabelByValue = useMemo(() => {
    const next = new Map<string, string>();
    availableRooms.forEach((room) => {
      next.set(room.value, room.label);
      next.set(room.label, room.label);
      next.set(room.value.toLowerCase(), room.label);
      next.set(room.label.toLowerCase(), room.label);
    });
    return next;
  }, [availableRooms]);

  const getRoomLabel = (room?: string | null) => {
    const normalizedRoom = room?.trim();
    if (!normalizedRoom) return "Lobi";
    return (
      roomLabelByValue.get(normalizedRoom) ??
      roomLabelByValue.get(normalizedRoom.toLowerCase()) ??
      normalizedRoom
    );
  };

  const getBotRoomLabel = (bot: Bot) => (bot.isAI ? "Lobi" : getRoomLabel(bot.room));

  const filteredBots = useMemo(() => {
    return bots
      .filter((bot) =>
        bot.username.toLowerCase().includes(searchQuery.toLowerCase()),
      )
      .sort((a, b) => Number(Boolean(b.isAI)) - Number(Boolean(a.isAI)));
  }, [bots, searchQuery]);

  const existingAiBot = useMemo(
    () => bots.find((bot) => bot.isAI),
    [bots],
  );

  const canMarkCurrentBotAsAi =
    !existingAiBot || existingAiBot.id === selectedBot?.id;
  const canEditWelcomeMessage = view === "edit" && canMarkCurrentBotAsAi;

  const handleEditClick = (bot: Bot) => {
    setSelectedBot(bot);
    setFormData({
      ...bot,
      room: bot.room?.trim() || availableRooms[0]?.value || "lobby",
    });
    setView("edit");
  };

  const handleAddClick = () => {
    setSelectedBot(null);
    setFormData({
      username: "",
      gender: "female",
      role: botRoleOptions[0]?.name || "Üye",
      room: availableRooms[0]?.value || "lobby",
      userGif: availableUserGifs[0]?.value || "",
      statusMode: availableStatusModes[0] || "MuZiK~DinLiyor",
      fontName: "",
      granite: "",
      loginType: "Mobil giriş",
      messagePermission: "Mesaj Yazabilir",
      welcomeMessage: "",
      welcomeAutoSendEnabled: true,
      welcomeManualPromptEnabled: true,
      isAI: false
    });
    setView("add");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    const normalizedFormData: Partial<Bot> = {
      ...formData,
      room:
        view === "edit" &&
        canEditWelcomeMessage &&
        Boolean(formData.welcomeMessage?.trim())
          ? "lobby"
          : formData.room?.trim() || availableRooms[0]?.value || "lobby",
      isAI:
        view === "edit" &&
        canEditWelcomeMessage &&
        Boolean(formData.welcomeMessage?.trim()),
      welcomeMessage:
        view === "edit" && canEditWelcomeMessage
          ? formData.welcomeMessage
          : "",
      welcomeManualPromptEnabled:
        view === "edit" && canEditWelcomeMessage
          ? formData.welcomeManualPromptEnabled === true
          : true,
      welcomeAutoSendEnabled:
        view === "edit" && canEditWelcomeMessage
          ? formData.welcomeManualPromptEnabled !== true
          : true,
    };
    try {
      if (view === "add") {
        await onAdd(normalizedFormData);
      } else if (view === "edit" && selectedBot) {
        await onUpdate(selectedBot.id, normalizedFormData);
      }
      setView("list");
    } catch (error) {
      console.error("Error submitting bot form:", error);
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedBot) return;
    if (window.confirm("Bu botu silmek istediğinize emin misiniz?")) {
      setIsSubmitting(true);
      try {
        await onDelete(selectedBot.id);
        setView("list");
      } catch (error) {
        console.error("Error deleting bot:", error);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Lütfen bir resim dosyası seçin.");
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      alert("Resim boyutu 25MB'dan büyük olamaz.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setFormData({ ...formData, avatar: event.target?.result as string });
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    setFormData({ ...formData, avatar: "" });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const inputClassName =
    "w-full pl-10 pr-4 py-2.5 sm:py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 outline-none transition-all";
  const selectClassName =
    "w-full pl-10 pr-10 py-2.5 sm:py-3 bg-white border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none";
  const optionClassName = "bg-white text-gray-900";

  if (view === "list") {
    return (
      <div className="relative flex h-full min-h-0 flex-col bg-white">

        {/* Search */}
        <div className="shrink-0 px-3 pb-2 pt-1 sm:px-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text"
              placeholder="Bot Ara... (Rumuz)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-4 text-sm text-gray-900 shadow-sm outline-none transition-all placeholder:text-gray-400 focus:border-transparent focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* List */}
        <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain px-3 pb-24 sm:space-y-3 sm:px-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-gray-500 font-medium">Botlar yükleniyor...</p>
            </div>
          ) : filteredBots.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <User className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-lg font-medium">Bot bulunamadı</p>
            </div>
          ) : (
            filteredBots.map((bot) => (
              <div 
                key={bot.id}
                className="group relative flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3 transition-all duration-300 hover:border-blue-100 hover:shadow-md sm:gap-4"
              >
                {/* Gender Indicator */}
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${bot.gender === 'female' ? 'bg-pink-50 text-pink-500' : 'bg-blue-50 text-blue-500'}`}>
                  {bot.gender === 'female' ? (
                    <Venus className="w-5 h-5" />
                  ) : (
                    <Mars className="w-5 h-5" />
                  )}
                </div>
                
                {/* Avatar */}
                <div className="relative">
                  {bot.avatar ? (
                    <img
                      src={bot.avatar} 
                      alt={bot.username} 
                      className="h-12 w-12 rounded-xl border border-gray-100 object-cover"
                    />
                  ) : (
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl text-lg font-bold text-white ${bot.gender === 'female' ? 'bg-gradient-to-br from-pink-400 to-rose-500' : 'bg-gradient-to-br from-blue-400 to-indigo-500'}`}>
                      {bot.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex min-w-0 flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-2">
                    <h3 className="max-w-full truncate font-bold text-gray-800">{bot.username}</h3>
                    {bot.isAI && (
                      <span className="inline-flex max-w-full shrink-0 items-center gap-1.5 rounded-full border border-indigo-200 bg-gradient-to-r from-indigo-50 via-sky-50 to-cyan-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-indigo-700 shadow-sm ring-1 ring-white sm:max-w-[148px]">
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-white shadow-sm">
                          <Sparkles className="h-2.5 w-2.5" />
                        </span>
                        <span className="truncate">Yapay Zeka Bot</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {bot.role || "Üye"} <span className="mx-1 opacity-30">•</span> {getBotRoomLabel(bot)}
                  </p>
                  {bot.extraInfo && (
                    <p className="text-[10px] text-blue-500 mt-1 font-medium truncate">
                      {bot.extraInfo}
                    </p>
                  )}
                </div>

                {/* Edit Button */}
                <button
                  onClick={() => handleEditClick(bot)}
                  className="shrink-0 rounded-xl p-2.5 text-gray-400 transition-all hover:bg-blue-50 hover:text-blue-500 sm:p-3"
                >
                  <Pencil className="w-5 h-5" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* FAB */}
        <button
          onClick={handleAddClick}
          className="absolute bottom-4 right-4 z-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-200 transition-all duration-300 hover:scale-110 active:scale-95 sm:bottom-6 sm:right-6"
        >
          <Plus className="w-8 h-8" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      {/* Minimal Sub Header */}
      <div className="shrink-0 border-b border-gray-50 px-3 py-2 sm:px-4">
        <button
          onClick={() => setView("list")}
          className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700 transition-colors text-xs font-bold uppercase tracking-tight"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Bot Listesine Dön
        </button>
      </div>

      <form onSubmit={handleSubmit} className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-3 sm:space-y-6 sm:p-6">
        {/* Avatar Upload Area */}
        <div className="flex flex-col items-center">
          <input 
            type="file"
            ref={fileInputRef}
            onChange={handleAvatarChange}
            accept="image/*"
            className="hidden"
          />
          <div className="relative group">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl border-4 border-white bg-gray-100 shadow-xl sm:h-24 sm:w-24">
              {formData.avatar ? (
                <img src={formData.avatar} alt="Bot Avatar" className="w-full h-full object-cover" />
              ) : (
                <User className="w-12 h-12 text-gray-300" />
              )}
            </div>
            <button 
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute -bottom-2 -right-2 p-2 bg-blue-600 text-white rounded-xl shadow-lg hover:bg-blue-700 transition-colors"
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-3 flex gap-2 sm:mt-4">
            <button 
              type="button" 
              onClick={() => fileInputRef.current?.click()}
              className="px-6 py-2 bg-blue-50 text-blue-600 font-bold rounded-xl text-sm hover:bg-blue-100 transition-colors"
            >
              Resim Seç
            </button>
            {formData.avatar && (
              <button 
                type="button" 
                onClick={handleRemoveAvatar}
                className="px-6 py-2 bg-red-50 text-red-600 font-bold rounded-xl text-sm hover:bg-red-100 transition-colors"
              >
                Sil
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
          {/* Rumuz */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700 ml-1">Rumuz</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text"
                value={formData.username || ""}
                onChange={(e) => setFormData({...formData, username: e.target.value})}
                className={inputClassName}
                placeholder="Örn: BeYZa"
                required
              />
            </div>
          </div>

          {!selectedBot?.isAI && (
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 ml-1">Bot Oda</label>
              <div className="relative">
                <Monitor className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select 
                  value={formData.room || ""}
                  onChange={(e) => setFormData({...formData, room: e.target.value})}
                  className={selectClassName}
                >
                  {availableRooms.map((room) => (
                    <option className={optionClassName} key={room.value} value={room.value}>{room.label}</option>
                  ))}
                </select>
                <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 rotate-90" />
              </div>
            </div>
          )}

          {/* Cinsiyet */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700 ml-1">Cinsiyet</label>
            <div className="flex gap-3">
              <button 
                type="button"
                onClick={() => setFormData({...formData, gender: 'female'})}
                className={`flex-1 py-3 px-4 rounded-xl border flex items-center justify-center gap-2 font-bold transition-all ${formData.gender === 'female' ? 'bg-pink-50 border-pink-200 text-pink-600 shadow-sm' : 'bg-white border-gray-200 text-gray-500'}`}
              >
                <div className={`w-2 h-2 rounded-full ${formData.gender === 'female' ? 'bg-pink-500' : 'bg-gray-300'}`} />
                Kadın
              </button>
              <button 
                type="button"
                onClick={() => setFormData({...formData, gender: 'male'})}
                className={`flex-1 py-3 px-4 rounded-xl border flex items-center justify-center gap-2 font-bold transition-all ${formData.gender === 'male' ? 'bg-blue-50 border-blue-200 text-blue-600 shadow-sm' : 'bg-white border-gray-200 text-gray-500'}`}
              >
                <div className={`w-2 h-2 rounded-full ${formData.gender === 'male' ? 'bg-blue-500' : 'bg-gray-300'}`} />
                Erkek
              </button>
            </div>
          </div>

          {/* Yetki */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700 ml-1">Yetki</label>
            <div className="relative">
              <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select 
                value={formData.role || ""}
                onChange={(e) => setFormData({...formData, role: e.target.value})}
                className={selectClassName}
              >
                {botRoleOptions.map((role) => (
                  <option className={optionClassName} key={role.id} value={role.name}>
                    {role.name}{role.starCount ? ` (${role.starCount} ⭐)` : ""}
                  </option>
                ))}
              </select>
              <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 rotate-90" />
            </div>
          </div>

          {/* User Gif */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700 ml-1">User Gif</label>
            <div className="relative">
              <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select 
                value={formData.userGif || ""}
                onChange={(e) => setFormData({...formData, userGif: e.target.value})}
                className={selectClassName}
              >
                <option className={optionClassName} value="">Yok</option>
                {availableUserGifs.map((gif) => (
                  <option className={optionClassName} key={gif.value} value={gif.value}>{gif.label}</option>
                ))}
              </select>
              <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 rotate-90" />
            </div>
          </div>

          {/* Durum Modu */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700 ml-1">Durum Modu</label>
            <div className="relative">
              <Music className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select 
                value={formData.statusMode || ""}
                onChange={(e) => setFormData({...formData, statusMode: e.target.value})}
                className={selectClassName}
              >
                {availableStatusModes.map((modeName) => (
                  <option className={optionClassName} key={modeName} value={modeName}>{modeName}</option>
                ))}
              </select>
              <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 rotate-90" />
            </div>
          </div>

          {/* Giriş Tip */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700 ml-1">Giriş Tip</label>
            <div className="relative">
              <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select 
                value={formData.loginType || ""}
                onChange={(e) => setFormData({...formData, loginType: e.target.value})}
                className={selectClassName}
              >
                <option className={optionClassName} value="Mobil giriş">Mobil giriş</option>
                <option className={optionClassName} value="Desktop">Desktop</option>
              </select>
              <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 rotate-90" />
            </div>
          </div>

          {/* Mesaj */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700 ml-1">Mesaj</label>
            <div className="relative">
              <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select 
                value={formData.messagePermission || ""}
                onChange={(e) => setFormData({...formData, messagePermission: e.target.value})}
                className={selectClassName}
              >
                <option className={optionClassName} value="Mesaj Yazabilir">Mesaj Yazabilir</option>
                <option className={optionClassName} value="Mesaj Yazamaz">Mesaj Yazamaz</option>
              </select>
              <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 rotate-90" />
            </div>
          </div>

          {/* Font */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700 ml-1">Yazı Tipi (Font)</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select 
                value={formData.fontName || ""}
                onChange={(e) => setFormData({...formData, fontName: e.target.value})}
                className={selectClassName}
              >
                <option className={optionClassName} value="">Varsayılan Font</option>
                {availableFonts.map((font) => (
                  <option className={optionClassName} key={font.value} value={font.value}>{font.label}</option>
                ))}
              </select>
              <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 rotate-90" />
            </div>
          </div>

          {/* Granit */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700 ml-1">Yazı Efekti (Granit)</label>
            <div className="relative">
              <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select 
                value={formData.granite || ""}
                onChange={(e) => setFormData({...formData, granite: e.target.value})}
                className={selectClassName}
              >
                <option className={optionClassName} value="">Efekt Yok</option>
                {availableGranites.map((granite) => (
                  <option className={optionClassName} key={granite.value} value={granite.value}>{granite.label}</option>
                ))}
              </select>
              <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 rotate-90" />
            </div>
          </div>
        </div>

        {canEditWelcomeMessage && (
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700 ml-1">Bot Karşılama Mesajı</label>
            <textarea
              value={formData.welcomeMessage || ""}
              onChange={(e) => setFormData({...formData, welcomeMessage: e.target.value})}
              className="w-full p-4 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all min-h-[100px]"
              placeholder="Örn: HOŞGELDİNİZ [username] 🍫☕"
            />
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 text-sm text-gray-700 transition hover:bg-indigo-50">
              <input
                type="radio"
                name="welcomeMode"
                checked={formData.welcomeManualPromptEnabled !== true}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    welcomeAutoSendEnabled: e.target.checked,
                    welcomeManualPromptEnabled: !e.target.checked,
                  })
                }
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="min-w-0">
                <span className="block font-bold text-gray-800">
                  Otomatik yapay zeka botu göndersin
                </span>
                <span className="mt-0.5 block text-xs font-medium text-gray-500">
                  Girişte bot kendi karşılama mesajını otomatik yollar.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-700 transition hover:bg-gray-50">
              <input
                type="radio"
                name="welcomeMode"
                checked={formData.welcomeManualPromptEnabled === true}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    welcomeAutoSendEnabled: !e.target.checked,
                    welcomeManualPromptEnabled: e.target.checked,
                  })
                }
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="min-w-0">
                <span className="block font-bold text-gray-800">
                  Manuel karşılama kutusu göster
                </span>
                <span className="mt-0.5 block text-xs font-medium text-gray-500">
                  Otomatik bot mesajı gitmez; tıklanınca Web Console mesajı gönderilir.
                </span>
              </span>
            </label>
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-1 gap-3 pt-2 sm:flex sm:gap-4 sm:pt-4">
          {view === "edit" && selectedBot?.isAI && (
            <div className="flex-1 py-4 bg-gray-50 border-2 border-gray-100 text-gray-400 font-bold rounded-2xl flex items-center justify-center gap-2">
              <Shield className="w-5 h-5" />
              Silinemez
            </div>
          )}
          {view === "edit" && !selectedBot?.isAI && (
            <button 
              type="button"
              onClick={handleDelete}
              disabled={isSubmitting}
              className="flex-1 py-4 bg-white border-2 border-red-100 text-red-500 font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-red-50 transition-all disabled:opacity-50"
            >
              <Trash2 className="w-5 h-5" />
              Botu Sil
            </button>
          )}
          <button 
            type="submit"
            disabled={isSubmitting}
            className="flex-[2] py-4 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-blue-100 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {isSubmitting ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            Kaydet
          </button>
        </div>
      </form>
    </div>
  );
};
