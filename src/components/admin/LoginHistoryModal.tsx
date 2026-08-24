"use client";

import React, { useEffect, useRef, useState } from "react";
import { AxiosError } from "axios";
import { getClientApiClient } from "@/lib/api/clientApi";
import { formatRoleLabel } from "@/lib/roleLabels";
import { apiClient } from "@/services/apiClient";
import {
  LoginLocationInfo,
  LoginHistoryRecord,
  LoginHistoryResponse,
} from "@/services/loginHistoryService";
import { toast } from "sonner";
import { UserDetailsModal } from "./UserDetailsModal";

interface LoginHistoryModalProps {
  onBack: () => void;
  currentUserStarCount?: number | null;
  canViewIp: boolean;
}

export const LoginHistoryModal = ({
  onBack: _onBack,
  currentUserStarCount,
  canViewIp,
}: LoginHistoryModalProps) => {
  const [loginHistory, setLoginHistory] = useState<LoginHistoryRecord[]>([]);
  const [pagination, setPagination] = useState<{
    total: number;
    page: number;
    limit: number;
    pageCount: number;
  }>({ total: 0, page: 1, limit: 5, pageCount: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);
  const [selectedRecord, setSelectedRecord] =
    useState<LoginHistoryRecord | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] =
    useState<LoginLocationInfo | null>(null);
  const [isLocationLoading, setIsLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionLoading, setActionLoading] = useState<{
    recordId: number;
    action: "ban" | "mute";
  } | null>(null);
  const locationRequestSeq = useRef(0);
  const moderationClient = getClientApiClient();

  const fetchLoginHistory = async (page = 1) => {
    try {
      setIsLoading(true);
      setError(null);
      const data: LoginHistoryResponse =
        await apiClient.loginHistory.getLoginHistory(page, pagination.limit);
      setLoginHistory(data.items);
      setPagination({
        total: data.total,
        page: data.page,
        limit: data.limit,
        pageCount: data.pageCount,
      });
    } catch (err) {
      console.error("Error fetching login history:", err);
      setError("Giriş kayıtları yüklenirken bir hata oluştu");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLoginHistory(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setOpenDropdownId(null);
    if (openDropdownId !== null) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [openDropdownId]);

  const handleDropdownToggle = (e: React.MouseEvent, recordId: number) => {
    if (actionLoading) return;
    e.stopPropagation();
    setOpenDropdownId(openDropdownId === recordId ? null : recordId);
  };

  const getDisplayName = (record: LoginHistoryRecord) =>
    record.agentNickname?.trim() || record.username;

  const openDetailsModal = async (record: LoginHistoryRecord) => {
    const requestSeq = locationRequestSeq.current + 1;
    locationRequestSeq.current = requestSeq;

    setOpenDropdownId(null);
    setSelectedRecord(record);
    setSelectedLocation(null);
    setLocationError(false);
    setIsDetailsModalOpen(true);

    if (!canViewIp) {
      setIsLocationLoading(false);
      return;
    }

    try {
      setIsLocationLoading(true);
      const location =
        await apiClient.loginHistory.getLocationByLoginHistoryId(record.id);

      if (locationRequestSeq.current !== requestSeq) {
        return;
      }

      setSelectedLocation(location);
    } catch (error) {
      console.error("Login location fetch failed:", error);
      if (locationRequestSeq.current === requestSeq) {
        setLocationError(true);
      }
    } finally {
      if (locationRequestSeq.current === requestSeq) {
        setIsLocationLoading(false);
      }
    }
  };

  const closeDetailsModal = () => {
    locationRequestSeq.current += 1;
    setIsDetailsModalOpen(false);
    setSelectedRecord(null);
    setSelectedLocation(null);
    setIsLocationLoading(false);
    setLocationError(false);
  };

  const getErrorMessage = (
    error: unknown,
    fallbackMessage: string,
  ): string => {
    const apiError = error as AxiosError<{ message?: string | string[] }>;
    const rawMessage = apiError.response?.data?.message;

    if (Array.isArray(rawMessage)) {
      return rawMessage.join(", ");
    }

    if (typeof rawMessage === "string" && rawMessage.trim()) {
      return rawMessage;
    }

    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }

    return fallbackMessage;
  };

  const handleBan = async (record: LoginHistoryRecord) => {
    const displayName = getDisplayName(record);
    const confirmed = window.confirm(
      `${displayName} kullanıcısını banlamak istediğinizden emin misiniz?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setActionLoading({ recordId: record.id, action: "ban" });
      setOpenDropdownId(null);
      await moderationClient.post("/moderation/ban", {
        username: record.username,
        reason: "Giriş kayıtları ekranından banlandı",
      });
      toast.success(`${displayName} başarıyla banlandı.`);
    } catch (error) {
      console.error("Ban action failed:", error);
      toast.error(
        getErrorMessage(
          error,
          "Ban işlemi başarısız oldu. Lütfen tekrar deneyin.",
        ),
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleGlobalMute = async (record: LoginHistoryRecord) => {
    const displayName = getDisplayName(record);
    const confirmed = window.confirm(
      `${displayName} kullanıcısının tüm odalardaki susturma durumunu değiştirmek istiyor musunuz?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setActionLoading({ recordId: record.id, action: "mute" });
      setOpenDropdownId(null);
      const response = await moderationClient.post("/moderation/toggle-global-mute", {
        username: record.username,
      });
      const globalMuted = response?.data?.globalMuted === true;
      alert(
        `${displayName} için tüm odalarda susturma durumu: ${
          globalMuted ? "Aktif" : "Kaldırıldı"
        }`,
      );
    } catch (error) {
      console.error("Global mute toggle failed:", error);
      alert(
        `Hata: ${getErrorMessage(
          error,
          "Tüm odalarda susturma işlemi başarısız oldu. Lütfen tekrar deneyin.",
        )}`,
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleAction = (action: string, record: LoginHistoryRecord) => {
    if (actionLoading) {
      return;
    }

    if (action === "details") {
      void openDetailsModal(record);
      return;
    }

    if (action === "ban") {
      void handleBan(record);
      return;
    }

    if (action === "mute") {
      void handleToggleGlobalMute(record);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const handlePageChange = (nextPage: number) => {
    if (nextPage < 1 || nextPage > pagination.pageCount) return;
    fetchLoginHistory(nextPage);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-600">Giriş kayıtları yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <svg
            className="w-12 h-12 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
          >
            Tekrar Dene
          </button>
        </div>
      </div>
    );
  }

  const filteredHistory = loginHistory.filter((record) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    const username = (record.agentNickname || record.username || "").toLowerCase();
    const ip = canViewIp ? record.ipAddress?.toLowerCase() || "" : "";
    return username.includes(term) || ip.includes(term);
  });

  return (
    <div className="space-y-4 overflow-visible">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={_onBack}
            className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 flex-shrink-0"
          >
            Geri
          </button>
          <p className="text-xs sm:text-sm text-gray-700">
            Toplam kayıt: {pagination.total}{" "}
            <span className="hidden xs:inline">
              (Sayfa {pagination.page} / {pagination.pageCount})
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap sm:justify-end w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial">
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Ara..."
              className="w-full sm:w-48 lg:w-64 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="absolute right-2.5 top-2.5 h-4 w-4 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page <= 1 || isLoading}
              className="px-2 py-1.5 rounded-lg border border-gray-300 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              Önceki
            </button>
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.pageCount || isLoading}
              className="px-2 py-1.5 rounded-lg border border-gray-300 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              Sonraki
            </button>
          </div>
        </div>
      </div>
      <div className="space-y-3 md:hidden">
        {filteredHistory.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
            Henüz giriş kaydı bulunmamaktadır
          </div>
        ) : (
          filteredHistory.map((record) => {
            const isActionable = (record as any).canViewDetails;
            const isRowLoading = actionLoading?.recordId === record.id;
            const activeAction = isRowLoading ? actionLoading?.action : null;

            return (
              <div
                key={record.id}
                className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {getDisplayName(record)}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {formatRoleLabel(record.role)}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      void openDetailsModal(record);
                    }}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700"
                  >
                    Detay
                  </button>
                </div>

                <div className="mt-3 space-y-2 text-xs text-gray-600">
                  <div className="flex items-center justify-between gap-3">
                    <span>Giriş</span>
                    <span className="text-right text-gray-800">
                      {formatDate(record.loginDate)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Cinsiyet</span>
                    <span className="text-right text-gray-800">
                      {(() => {
                        const gender = record.gender ?? record.user?.gender;
                        if (gender === "male") return "Erkek";
                        if (gender === "female") return "Kadın";
                        return "Bilinmiyor";
                      })()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Cihaz</span>
                    <span className="text-right text-gray-800">{record.device}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Tarayıcı</span>
                    <span className="max-w-[58%] text-right text-gray-800">
                      {record.browser}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>IP</span>
                    <span className="text-right text-gray-800">
                      {canViewIp ? record.ipAddress || "-" : "Gizli"}
                    </span>
                  </div>
                </div>

                {isActionable ? (
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <button
                      onClick={() => handleAction("details", record)}
                      className="rounded-lg border border-gray-200 bg-white px-2 py-2 text-xs font-semibold text-gray-700"
                    >
                      Detaylar
                    </button>
                    <button
                      onClick={() => handleAction("ban", record)}
                      disabled={isRowLoading}
                      className="rounded-lg border border-red-200 bg-red-50 px-2 py-2 text-xs font-semibold text-red-600 disabled:opacity-50"
                    >
                      {activeAction === "ban" ? "Bekleyin..." : "Banla"}
                    </button>
                    <button
                      onClick={() => handleAction("mute", record)}
                      disabled={isRowLoading}
                      className="rounded-lg border border-orange-200 bg-orange-50 px-2 py-2 text-xs font-semibold text-orange-600 disabled:opacity-50"
                    >
                      {activeAction === "mute" ? "Bekleyin..." : "Sustur"}
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      <div className="hidden overflow-visible rounded-lg border border-gray-200 md:block">
        <table className="w-full border-collapse overflow-visible">
          <thead>
            <tr className="bg-gray-100 border-b-2 border-gray-300">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Kullanıcı Adı
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Yetkisi
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Giriş Tarihi
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Cinsiyet
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Cihaz
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Tarayıcı
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                İp Adresi
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider w-20">
                İşlemler
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredHistory.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                  Henüz giriş kaydı bulunmamaktadır
                </td>
              </tr>
            ) : (
              filteredHistory.map((record, index) => (
                <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {getDisplayName(record)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {formatRoleLabel(record.role)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {formatDate(record.loginDate)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 capitalize">
                    {(() => {
                      const gender = record.gender ?? record.user?.gender;
                      if (gender === "male") return "Erkek";
                      if (gender === "female") return "Kadın";
                      return "Bilinmiyor";
                    })()}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {record.device}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 max-w-xs truncate">
                    {record.browser}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {canViewIp ? record.ipAddress || "-" : "Gizli"}
                  </td>
                  <td className="px-4 py-3 text-center relative">
                    {(() => {
                      const isActionable = (record as any).canViewDetails;
                      const isRowLoading = actionLoading?.recordId === record.id;
                      const activeAction = isRowLoading ? actionLoading?.action : null;

                      if (isActionable) {
                        return (
                          <>
                            <button
                              onClick={(e) =>
                                handleDropdownToggle(e, record.id)
                              }
                              disabled={isRowLoading}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-200 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {isRowLoading ? (
                                <div className="h-4 w-4 rounded-full border-2 border-gray-400 border-t-transparent animate-spin" />
                              ) : (
                                <svg
                                  className="w-5 h-5 text-gray-600"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <circle cx="10" cy="5" r="1.5" />
                                  <circle cx="10" cy="10" r="1.5" />
                                  <circle cx="10" cy="15" r="1.5" />
                                </svg>
                              )}
                            </button>

                            {openDropdownId === record.id && (
                              <div className={`absolute right-0 ${
                                index >= filteredHistory.length - 2 && filteredHistory.length > 2
                                  ? "bottom-full mb-1" 
                                  : "top-full mt-1"
                              } w-40 bg-white rounded-lg shadow-xl border border-gray-200 z-[1000] py-1`}>
                                <button
                                  onClick={() =>
                                    handleAction("details", record)
                                  }
                                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
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
                                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                    />
                                  </svg>
                                  Detaylar
                                </button>
                                <button
                                  onClick={() => handleAction("ban", record)}
                                  disabled={isRowLoading}
                                  className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 text-red-600 hover:bg-red-50 disabled:text-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
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
                                      d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                                    />
                                  </svg>
                                  {activeAction === "ban" ? "Banlanıyor..." : "Banla"}
                                </button>
                                <button
                                  onClick={() => handleAction("mute", record)}
                                  disabled={isRowLoading}
                                  className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 text-orange-600 hover:bg-orange-50 disabled:text-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
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
                                      d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                                    />
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
                                    />
                                  </svg>
                                  {activeAction === "mute"
                                    ? "İşleniyor..."
                                    : "Sustur"}
                                </button>
                              </div>
                            )}
                          </>
                        );
                      }
                      return "-";
                    })()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* User Details Modal */}
      <UserDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={closeDetailsModal}
        record={selectedRecord}
        canViewIp={canViewIp}
        location={selectedLocation}
        isLocationLoading={isLocationLoading}
        locationError={locationError}
      />
    </div>
  );
};
