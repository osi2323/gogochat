"use client";
import React from "react";
import { formatRoleLabel } from "@/lib/roleLabels";
import {
  LoginHistoryRecord,
  LoginLocationInfo,
} from "@/services/loginHistoryService";

interface UserDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: LoginHistoryRecord | null;
  canViewIp: boolean;
  location: LoginLocationInfo | null;
  isLocationLoading: boolean;
  locationError: boolean;
}

export const UserDetailsModal = ({
  isOpen,
  onClose,
  record,
  canViewIp,
  location,
  isLocationLoading,
  locationError,
}: UserDetailsModalProps) => {
  if (!isOpen || !record) return null;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const username = (record as any).realUsername || record.username;
  const role = formatRoleLabel((record as any).realRole || record.role);
  const isKnownLocationValue = (value?: string | null) => {
    const normalized = value?.trim();
    return Boolean(normalized && normalized.toLocaleLowerCase("tr-TR") !== "bilinmiyor");
  };
  const formatLoginLocation = () => {
    if (!canViewIp) return "Gizli";
    if (isLocationLoading) return "Konum alınıyor...";
    if (locationError || !location) return "Bilinmiyor";

    const parts = [location.district, location.city, location.country].filter(
      isKnownLocationValue,
    );

    return parts.length > 0 ? parts.join(" / ") : "Bilinmiyor";
  };
  const isp = isKnownLocationValue(location?.isp) ? location?.isp.trim() : null;

  const details = [
    { label: "Kullanıcı", value: username, icon: "👤" },
    { label: "Yetki", value: role, icon: "🛡️" },
    { label: "Cinsiyet", value: record.gender === "male" ? "Erkek" : record.gender === "female" ? "Kadın" : "Belirtilmemiş", icon: "🚻" },
    { label: "Giriş Zamanı", value: formatDate(record.loginDate), icon: "📅" },
    { label: "Giriş Yeri", value: formatLoginLocation(), icon: "📍" },
    ...(canViewIp && !isLocationLoading && !locationError && isp
      ? [{ label: "Servis Sağlayıcı", value: isp, icon: "🌐" }]
      : []),
    { label: "Cihaz", value: record.device, icon: "🖥️" },
    { label: "Tarayıcı", value: record.browser || "Bilinmiyor", icon: "🌐" },
  ];

  return (
    <>
      <div className="fixed inset-0 z-[200]" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[201] w-[340px] bg-white rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.15)] overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-slate-900 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-sm">
              i
            </div>
            <span className="text-white font-bold text-base tracking-tight">Kayıt Detayı</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* IP Section */}
        <div className="px-5 pt-4">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex items-center justify-between">
             <div className="flex flex-col">
               <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">IP ADRESİ</span>
               <span className="text-slate-800 font-mono text-sm font-bold">{canViewIp ? record.ipAddress || "-" : "Gizli"}</span>
             </div>
             <button disabled={!canViewIp} className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all">
               Kopyala
             </button>
          </div>
        </div>

        {/* Details Grid */}
        <div className="p-5 grid grid-cols-1 gap-2">
          {details.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
               <div className="flex items-center gap-3">
                 <span className="text-lg grayscale">{item.icon}</span>
                 <span className="text-xs font-semibold text-slate-500">{item.label}</span>
               </div>
               <span className="max-w-[180px] break-words text-xs font-bold text-slate-800 text-right">{item.value}</span>
            </div>
          ))}
        </div>

        {/* Footer Actions */}
        <div className="p-5 pt-0 grid grid-cols-2 gap-2">
           <button disabled={!canViewIp} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-2xl text-xs font-bold transition-all">
              İP Takip
           </button>
           <button onClick={onClose} className="bg-slate-200 hover:bg-slate-300 text-slate-700 py-2.5 rounded-2xl text-xs font-bold transition-all">
              Kapat
           </button>
        </div>
      </div>
    </>
  );
};
