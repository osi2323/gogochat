export const formatRoleLabel = (role?: string | null): string => {
  const normalizedRole = role?.trim();
  if (!normalizedRole) return "-";

  const lowerRole = normalizedRole.toLocaleLowerCase("tr-TR");
  if (lowerRole === "guest") return "Misafir";
  if (lowerRole === "uye" || lowerRole === "üye" || lowerRole === "user") {
    return "Üye";
  }

  return normalizedRole;
};
