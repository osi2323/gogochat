const DIRECT_MESSAGE_SOUND_SRC = "/sounds/message.mp3";
const FRIEND_REQUEST_SOUND_SRC = "/sounds/call.mp3";

export const playNotificationSound = (src: string) => {
  if (typeof window === "undefined") return;

  const audio = new Audio(src);
  audio.preload = "auto";
  void audio.play().catch(() => {});
};

export const playDirectMessageSound = () => {
  playNotificationSound(DIRECT_MESSAGE_SOUND_SRC);
};

export const playFriendRequestSound = () => {
  playNotificationSound(FRIEND_REQUEST_SOUND_SRC);
};
