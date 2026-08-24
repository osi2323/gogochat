export type ChatPreferences = {
  rejectDirectMessages: boolean;
  rejectIncomingCalls: boolean;
  blockDmWhenTargetOffline: boolean;
  rejectRoomInvites: boolean;
  blockProfileComments: boolean;
  rejectFriendRequests: boolean;
  muteVibrationSounds: boolean;
  hideDirectMessageAlerts: boolean;
  muteFriendRequestSound: boolean;
  showJoinLeaveEvents: boolean;
  disableJoinEffects: boolean;
  hideGeneralMessages: boolean;
  showTypingIndicators: boolean;
  muteCallRingtone: boolean;
  keepRoomChatHistory: boolean;
  keepDirectChatHistory: boolean;
  ignoredUsernames: string[];
};

export const chatPreferencesStorageKey = "chatPreferences";

export const defaultChatPreferences: ChatPreferences = {
  rejectDirectMessages: false,
  rejectIncomingCalls: false,
  blockDmWhenTargetOffline: false,
  rejectRoomInvites: false,
  blockProfileComments: false,
  rejectFriendRequests: false,
  muteVibrationSounds: false,
  hideDirectMessageAlerts: false,
  muteFriendRequestSound: false,
  showJoinLeaveEvents: false,
  disableJoinEffects: false,
  hideGeneralMessages: false,
  showTypingIndicators: true,
  muteCallRingtone: false,
  keepRoomChatHistory: true,
  keepDirectChatHistory: true,
  ignoredUsernames: [],
};

export const mergeChatPreferences = (
  value?: Partial<ChatPreferences> | null,
): ChatPreferences => ({
  ...defaultChatPreferences,
  ...(value ?? {}),
});

export const readChatPreferencesFromStorage = (): ChatPreferences => {
  if (typeof window === "undefined") {
    return defaultChatPreferences;
  }

  try {
    const raw = localStorage.getItem(chatPreferencesStorageKey);
    if (!raw) return defaultChatPreferences;
    const parsed = JSON.parse(raw) as Partial<ChatPreferences>;
    return mergeChatPreferences(parsed);
  } catch {
    return defaultChatPreferences;
  }
};

export const writeChatPreferencesToStorage = (
  value: Partial<ChatPreferences>,
): ChatPreferences => {
  const merged = mergeChatPreferences(value);

  if (typeof window !== "undefined") {
    localStorage.setItem(chatPreferencesStorageKey, JSON.stringify(merged));
    // Dispatch asynchronously to avoid setState during another component render.
    window.setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent("chatPreferencesChanged", { detail: merged }),
      );
    }, 0);
  }

  return merged;
};
