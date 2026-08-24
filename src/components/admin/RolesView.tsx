import React from "react";

export interface RoleItem {
  id: number;
  name: string;
  microphoneDuration: number;
  starColor: string | null;
  starCount: number | null;
  icon: string | null;
  permissions?: Record<string, boolean>;
}

interface RolesViewProps {
  roles: RoleItem[];
  loading: boolean;
  error: string | null;
  currentStarCount: number | null;
  canManageRoles: boolean;
  onSelect: (role: RoleItem) => void;
}

export const RolesView: React.FC<RolesViewProps> = ({
  roles,
  loading,
  error,
  currentStarCount,
  canManageRoles,
  onSelect,
}) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-6 text-sm text-gray-600">
        Yükleniyor...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!roles.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-6 py-10 text-center text-gray-500">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-200 text-gray-400">
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
              d="M18 6L6 18M6 6l12 12"
            />
          </svg>
        </div>
        <div className="text-base font-semibold text-gray-700">
          Rütbe bulunamadı
        </div>
        <div className="text-sm text-gray-500">Liste şu an boş görünüyor.</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {roles.map((role) => {
        const targetStar = role.starCount ?? 0;
        const canEdit =
          canManageRoles &&
          currentStarCount !== null &&
          currentStarCount >= targetStar;

        return (
          <div
            key={role.id}
            className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm"
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-gray-900">
                  {role.name?.toUpperCase()}
                </span>
                <span className="mt-1 block text-xs text-gray-500">
                  {role.starCount === 0 || role.starCount === null
                    ? "Yıldız yok"
                    : `${role.starCount} Yıldız`}
                </span>
              </div>

              <div className="flex min-w-0 flex-1 items-center overflow-hidden md:justify-center">
                {role.icon ? (
                  <span className="text-base text-gray-700">{role.icon}</span>
                ) : (
                  role.starCount !== null &&
                  role.starCount > 0 && (
                    <div
                      className={`flex min-w-0 flex-nowrap items-center gap-x-px whitespace-nowrap ${
                        role.starCount >= 15
                          ? "text-[9px]"
                          : role.starCount >= 12
                            ? "text-[10px]"
                            : role.starCount >= 10
                              ? "text-[11px]"
                              : "text-base"
                      }`}
                    >
                      {Array.from({ length: role.starCount }).map((_, idx) => (
                        <span
                          key={idx}
                          className="leading-none"
                          style={{ color: role.starColor || "#FFD700" }}
                        >
                          ★
                        </span>
                      ))}
                    </div>
                  )
                )}
              </div>

              <button
                onClick={() => {
                  if (canEdit) onSelect(role);
                }}
                disabled={!canEdit}
                title={
                  canEdit
                    ? "Düzenle"
                    : !canManageRoles
                      ? "Rütbe yönetimi yetkiniz yok"
                      : "Sadece yıldızı size eşit veya düşük rütbeler düzenlenebilir"
                }
                className={`w-full rounded-md px-4 py-2.5 text-sm font-semibold text-white transition md:ml-4 md:w-auto md:text-xs ${
                  canEdit
                    ? "bg-blue-600 hover:bg-blue-700"
                    : "cursor-not-allowed bg-gray-300 text-gray-100"
                }`}
              >
                Düzenle
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
