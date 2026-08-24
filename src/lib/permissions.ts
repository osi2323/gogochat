export const PERMISSION_LABELS = {
  PRIVATE_MESSAGE: "Özel Mesaj Atma",
  GENERAL_BROADCAST: "Genel Atma",
  MEETING_ROOM: "Toplantı Yetkisi",
  BLOCK_USER: "Engel Yetkisi",
  ROLE_MANAGEMENT: "Rütbe Yönetimi",
  STAFF_MANAGEMENT: "Yetkili Yönetimi",
  ROOM_MANAGEMENT: "Oda Yönetimi",
  ROOM_DELETE: "Oda Silme",
  ROOM_MESSAGES_DELETE: "Oda Yazılarını Sil",
  MICROPHONE_MODERATION: "Mikrofon Engelle Yetkisi",
  CAMERA_MODERATION: "Kamera Engelle Yetkisi",
  TEMP_OPERATOR_GRANT: "Geçici Operatörlük Verme",
  ROOF_ACCESS: "Çatı Girişi",
  STORY_DELETE: "Hikaye Silme",
  FLASH_NICK_UPLOAD: "Flash Nick Yükleme",
  ROOM_ENCRYPTION: "Oda Şifreleme",
  RADIO_MANAGEMENT: "Radyo Yönetimi",
  WORD_BAN: "Kelime Yasaklama",
  NICKNAME_BAN: "Rumuz Yasaklama",
  LOGIN_HISTORY: "Giriş Kayıtları",
  IP_VIEW: "İp Görme Yetkisi",
  SITE_SETTINGS: "Site Ayarları",
  JOIN_EFFECT_SELECT: "Giriş efekti seçebilir",
  BAN_MANAGEMENT: "Banlama",
  SITE_KICK: "Siteden Atma Yetkisi",
  ADMIN_PANEL: "Admin Paneli",
  BOT_MANAGEMENT: "Bot Yönetimi",
  ADMIN_ACTIONS: "Admin Hareketleri",
  MEMBER_MANAGEMENT: "Üye Yönetimi",
  MEMBER_STAFF_DELETE: "Üye ve Yetkili Silme",
  SECRET_NICKNAME_LOGIN: "Gizli Rumuz Giriş",
  PERMISSION_GRANT: "Yetki Verebilir",
  MICROPHONE_INVITE: "Mikrofon Daveti",
  PRIVATE_CALL: "Özel Arama",
} as const;

const normalizePermissionLabel = (value?: string | null): string =>
  String(value ?? "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/\s+/g, " ");

export const hasEffectivePermission = (params: {
  permissionLabel: string;
  userPermissions?: string[] | null;
  rolePermissions?: Record<string, unknown> | null;
}): boolean => {
  const normalizedTarget = normalizePermissionLabel(params.permissionLabel);
  if (!normalizedTarget) return false;

  const hasUserPermission = (params.userPermissions ?? []).some(
    (permission) => normalizePermissionLabel(permission) === normalizedTarget,
  );
  if (hasUserPermission) return true;

  for (const [key, value] of Object.entries(params.rolePermissions ?? {})) {
    if (value !== true) continue;
    if (normalizePermissionLabel(key) === normalizedTarget) {
      return true;
    }
  }

  return false;
};
