import { AxiosInstance } from "axios";

export type LoginDesignType = "standard" | "premium";

export interface WebConsoleStatsListItem {
  label: string;
  count: number;
  percent: number;
}

export interface WebConsoleStatsSummary {
  registeredUsers: number;
  registeredLast24Hours: number;
  staffUsers: number;
  staffFemaleCount: number;
  staffMaleCount: number;
  maleUsers: number;
  maleActivePercent: number;
  femaleUsers: number;
  femaleActivePercent: number;
  loginsLast30Days: number;
  loginsLast7Days: number;
  adminActionsLast30Days: number;
  adminActionsLast24Hours: number;
}

export interface WebConsoleStatsResponse {
  summary: WebConsoleStatsSummary;
  topVisitors: WebConsoleStatsListItem[];
  deviceUsage: {
    devices: WebConsoleStatsListItem[];
    browsers: WebConsoleStatsListItem[];
  };
}

export interface WebConsoleAnimationItem {
  fileName: string;
  url: string;
  extension: string;
  sizeBytes: number;
  updatedAt: string;
  width: number;
  height: number;
}

export interface WebConsoleAnimationsResponse {
  totalCount: number;
  maxCount: number;
  remainingSlots: number;
  requiredWidth: number | null;
  requiredHeight: number | null;
  items: WebConsoleAnimationItem[];
}

export interface SystemResetPayload {
  message: string;
  countdownSeconds: number;
  remainingDurationMs: number;
  timestamp: string;
}

export interface SystemResetStartResponse
  extends Omit<SystemResetPayload, "message"> {
  message: string;
  deletedMessagesCount: number;
}

export type SystemResetStatusResponse =
  | ({ active: false } & Partial<SystemResetPayload>)
  | ({ active: true } & SystemResetPayload);

export interface FirstMessageDelaySettings {
  firstMessageDelayEnabled: boolean;
  firstMessageDelaySeconds: number;
  firstMessageDelayUpdatedAt?: string | null;
}

export interface MaintenanceModeSettings {
  maintenanceMode: boolean;
  siteName?: string | null;
  siteTitle?: string | null;
  homePageHtml?: string | null;
  homePageImage?: string | null;
  homePageLogo?: string | null;
  chatHeaderLogo?: string | null;
  siteOwnerUsernames?: string[];
  managerUsernames?: string[];
  welcomeMessageTemplate?: string | null;
  activeLoginDesign: LoginDesignType;
  premiumArticleTopTitle?: string | null;
  premiumArticleTopContent?: string | null;
  premiumArticleMiddleTitle?: string | null;
  premiumArticleMiddleContent?: string | null;
  premiumArticleBottomTitle?: string | null;
  premiumArticleBottomContent?: string | null;
  premiumAndroidAppUrl?: string | null;
  premiumIosAppUrl?: string | null;
}

export interface GuestWaitSettings {
  guestWaitSeconds: number;
  guestWaitUpdatedAt?: string | null;
}

export type ChatPermission = "EVERYONE" | "MEMBERS" | "NONE";

export interface ChatPermissionsSettings {
  chatImageSendPermission: ChatPermission;
  chatVoiceSendPermission: ChatPermission;
  chatVoiceRecordSendPermission: ChatPermission;
  chatYoutubeSendPermission: ChatPermission;
}

export interface CommunicationPermissionsSettings {
  guestCanWrite: boolean;
  memberAndGuestMicDurationSeconds: number;
  membersPrivateMessageEnabled: boolean;
  membersVoiceCallEnabled: boolean;
  guestPrivateMessageEnabled: boolean;
  guestVoiceCallEnabled: boolean;
  showMicrophonesOnMobile: boolean;
}

export const createSystemSettingsService = (client: AxiosInstance) => {
  return {
    /**
     * Get first message delay settings
     */
    getFirstMessageDelay: async (): Promise<FirstMessageDelaySettings> => {
      const response = await client.get<FirstMessageDelaySettings>(
        "/system-settings/first-message-delay",
      );
      return response.data;
    },
    /**
     * Get maintenance mode settings
     */
    getMaintenanceMode: async (): Promise<MaintenanceModeSettings> => {
      const response = await client.get<MaintenanceModeSettings>(
        "/system-settings/maintenance-mode",
      );
      return response.data;
    },
    /**
     * Get guest wait settings
     */
    getGuestWait: async (): Promise<GuestWaitSettings> => {
      const response = await client.get<GuestWaitSettings>(
        "/system-settings/guest-wait",
      );
      return response.data;
    },
    /**
     * Get chat permissions settings
     */
    getChatPermissions: async (): Promise<ChatPermissionsSettings> => {
      const response = await client.get<ChatPermissionsSettings>(
        "/system-settings/chat-permissions",
      );
      return response.data;
    },
    /**
     * Get communication permissions settings
     */
    getCommunicationPermissions:
      async (): Promise<CommunicationPermissionsSettings> => {
        const response = await client.get<CommunicationPermissionsSettings>(
          "/system-settings/communication-permissions",
        );
        return response.data;
      },
    getWebConsoleStats: async (): Promise<WebConsoleStatsResponse> => {
      const response = await client.get<WebConsoleStatsResponse>(
        "/system-settings/web-console-stats",
      );
      return response.data;
    },
    getWebConsoleAnimations:
      async (): Promise<WebConsoleAnimationsResponse> => {
        const response = await client.get<WebConsoleAnimationsResponse>(
          "/system-settings/animations",
        );
        return response.data;
      },
    getSystemResetStatus: async (): Promise<SystemResetStatusResponse> => {
      const response = await client.get<SystemResetStatusResponse>(
        "/system-settings/system-reset/status",
      );
      return response.data;
    },
    startSystemReset: async (): Promise<SystemResetStartResponse> => {
      const response = await client.post<SystemResetStartResponse>(
        "/system-settings/system-reset",
      );
      return response.data;
    },
  };
};
