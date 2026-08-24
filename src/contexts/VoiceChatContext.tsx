"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";
import { Socket } from "socket.io-client";
import {
  Room,
  RoomEvent,
  RemoteParticipant,
  RemoteAudioTrack,
  Track,
  type Participant,
} from "livekit-client";
import { getClientApiClient } from "@/lib/api/clientApi";

type VoiceChatContextType = {
  isInVoiceChat: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  joinVoiceChat: (options?: {
    startMuted?: boolean;
    skipPermissionPreflight?: boolean;
  }) => Promise<boolean>;
  leaveVoiceChat: () => void;
  toggleMute: () => void;
  toggleDeafen: () => void;
  remoteUsers: RemoteParticipant[];
  syncWithRoomUsers: (
    users: Array<{ username: string; isInVoiceChat?: boolean }>,
  ) => Promise<void>;
  speakingUsers: Set<string>;
  micBanned: boolean;
  globalMuted: boolean;
};

const VoiceChatContext = createContext<VoiceChatContextType | null>(null);

const LIVEKIT_URL =
  process.env.NEXT_PUBLIC_LIVEKIT_URL || "ws://localhost:7880";

const ROOM_SOCKET_JOINED_EVENT = "kingmobile:room-socket-joined";

type RoomSocketJoinedEventDetail = {
  room?: string | null;
};

const isPermissionDismissedError = (error: unknown) =>
  error instanceof Error &&
  (error.name === "NotAllowedError" ||
    error.message.toLowerCase().includes("permission dismissed"));

const requestMicrophoneAccess = async () => {
  if (typeof navigator === "undefined" || !navigator.mediaDevices) return;

  // If the browser already has a persistent "granted" record for the microphone,
  // skip the getUserMedia call. On mobile (especially iOS), calling getUserMedia
  // outside a fresh user-gesture context can throw NotAllowedError even when
  // the OS-level permission is granted, producing a false "permission denied".
  if (typeof navigator.permissions !== "undefined") {
    try {
      const status = await navigator.permissions.query({
        name: "microphone" as PermissionName,
      });
      if (status.state === "granted") return;
    } catch {
      // Some platforms don't support querying microphone permission — fall through
    }
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  stream.getTracks().forEach((track) => track.stop());
};

const fetchLivekitToken = async (
  room: string,
  canPublish = true,
): Promise<string> => {
  const api = getClientApiClient();
  const params = new URLSearchParams({ room, canPublish: String(canPublish) });
  const res = await api.get<{ token: string }>(
    `/rooms/livekit-token?${params}`,
  );
  return res.data.token;
};

export const useVoiceChat = () => {
  const context = useContext(VoiceChatContext);
  if (!context) {
    throw new Error("useVoiceChat must be used within a VoiceChatProvider");
  }
  return context;
};

type VoiceChatProviderProps = {
  children: React.ReactNode;
  socket: Socket | null;
  roomName: string | null;
  currentUsername: string | null;
  initialMicBanned?: boolean;
  initialGlobalMuted?: boolean;
};

export const VoiceChatProvider = ({
  children,
  socket,
  roomName,
  currentUsername,
  initialMicBanned = false,
  initialGlobalMuted = false,
}: VoiceChatProviderProps) => {
  const [isInVoiceChat, setIsInVoiceChat] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isDeafened, setIsDeafened] = useState(false);
  const [micBanned, setMicBanned] = useState(initialMicBanned);
  const [globalMuted, setGlobalMuted] = useState(initialGlobalMuted);
  const [remoteUsers, setRemoteUsers] = useState<RemoteParticipant[]>([]);
  const [speakingUsers, setSpeakingUsers] = useState<Set<string>>(new Set());

  const roomRef = useRef<Room | null>(null);
  const isLeavingRef = useRef(false);
  const joinPromiseRef = useRef<Promise<boolean> | null>(null);
  const remoteSpeakingUsersRef = useRef<Set<string>>(new Set());
  const lastSpeakingStateRef = useRef<boolean>(false);
  const isDeafenedRef = useRef(false);

  useEffect(() => {
    setMicBanned(initialMicBanned);
  }, [initialMicBanned]);

  useEffect(() => {
    setGlobalMuted(initialGlobalMuted);
  }, [initialGlobalMuted]);

  useEffect(() => {
    isDeafenedRef.current = isDeafened;
  }, [isDeafened]);

  const refreshRemoteUsers = useCallback((room: Room) => {
    setRemoteUsers([...room.remoteParticipants.values()]);
  }, []);

  const applyDeafenToAllRemoteTracks = useCallback(
    (room: Room, deafened: boolean) => {
      for (const participant of room.remoteParticipants.values()) {
        for (const pub of participant.audioTrackPublications.values()) {
          if (pub.track) {
            (pub.track as RemoteAudioTrack).setVolume(deafened ? 0 : 1);
          }
        }
      }
    },
    [],
  );

  const leaveVoiceChat = useCallback(async () => {
    if (!socket || !currentUsername || !roomName) return;
    isLeavingRef.current = true;

    const room = roomRef.current;
    try {
      if (room && room.state !== "disconnected") {
        await room.disconnect();
      }
      roomRef.current = null;

      socket.emit("voice:toggleState", {
        room: roomName,
        username: currentUsername,
        isInVoiceChat: false,
      });

      setIsInVoiceChat(false);
      setIsMuted(true);
      setRemoteUsers([]);
      setSpeakingUsers(new Set());
      remoteSpeakingUsersRef.current = new Set();
      lastSpeakingStateRef.current = false;

      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      console.error("LiveKit: Sesli sohbet ayrılma hatası:", error);
    } finally {
      isLeavingRef.current = false;
    }
  }, [socket, roomName, currentUsername]);

  const joinVoiceChat = useCallback(
    async (options?: {
      startMuted?: boolean;
      skipPermissionPreflight?: boolean;
    }) => {
      if (joinPromiseRef.current) {
        return joinPromiseRef.current;
      }

      const startMuted = options?.startMuted ?? true;
      const skipPermissionPreflight =
        options?.skipPermissionPreflight ?? false;

      const joinPromise = (async () => {
        if (isLeavingRef.current) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        if (!socket) {
          alert("Socket bağlantısı bulunamadı. Lütfen sayfayı yenileyin.");
          return false;
        }
        if (!roomName) {
          alert("Oda bilgisi bulunamadı. Lütfen tekrar deneyin.");
          return false;
        }
        if (!currentUsername) return false;

        const existingRoom = roomRef.current;
        if (existingRoom && existingRoom.state === "connected") {
          return isInVoiceChat;
        }

        try {
          if (!skipPermissionPreflight) {
            await requestMicrophoneAccess();
          }

          const token = await fetchLivekitToken(roomName, true);

          const room = new Room();
          roomRef.current = room;

          room.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
            const now = new Set(speakers.map((s) => s.identity));

            if (currentUsername) {
              const isSpeakingNow = now.has(currentUsername);
              if (isSpeakingNow !== lastSpeakingStateRef.current) {
                lastSpeakingStateRef.current = isSpeakingNow;
                if (socket && roomName) {
                  socket.emit("voice:speaking", {
                    room: roomName,
                    username: currentUsername,
                    isSpeaking: isSpeakingNow,
                  });
                }
              }
            }

            const combined = new Set([
              ...now,
              ...remoteSpeakingUsersRef.current,
            ]);
            setSpeakingUsers(combined);
          });

          room.on(RoomEvent.ParticipantConnected, () => {
            refreshRemoteUsers(room);
          });

          room.on(RoomEvent.ParticipantDisconnected, (participant) => {
            refreshRemoteUsers(room);
            const key = participant.identity;
            remoteSpeakingUsersRef.current.delete(key);
            setSpeakingUsers((prev) => {
              const next = new Set(prev);
              next.delete(key);
              return next;
            });
          });

          room.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
            refreshRemoteUsers(room);
            if (track.kind === Track.Kind.Audio) {
              const audioEl = track.attach() as HTMLAudioElement;
              audioEl.style.display = "none";
              document.body.appendChild(audioEl);
              if (isDeafenedRef.current) {
                (track as RemoteAudioTrack).setVolume(0);
              }
            }
          });

          room.on(RoomEvent.TrackUnsubscribed, (track) => {
            if (track.kind === Track.Kind.Audio) {
              track.detach();
            }
            refreshRemoteUsers(room);
          });

          await room.connect(LIVEKIT_URL, token);

          // startAudio can fail on iOS when the AudioContext cannot be resumed
          // outside a user-gesture window. This is non-fatal for a muted join
          // and must not be misreported as a microphone permission error.
          try {
            await room.startAudio();
          } catch (audioErr) {
            if (
              !(audioErr instanceof Error && audioErr.name === "NotAllowedError")
            ) {
              throw audioErr;
            }
            console.warn("LiveKit: startAudio NotAllowedError (iOS AudioContext) — devam ediliyor");
          }

          await room.localParticipant.setMicrophoneEnabled(!startMuted);

          socket.emit("voice:toggleState", {
            room: roomName,
            username: currentUsername,
            isInVoiceChat: true,
            isMuted: startMuted,
          });

          setIsInVoiceChat(true);
          setIsMuted(startMuted);
          return true;
        } catch (error) {
          if (!isPermissionDismissedError(error)) {
            console.error("LiveKit: Sesli sohbete katılma hatası:", error);
          }

          if (roomRef.current) {
            try {
              await roomRef.current.disconnect();
            } catch {}
            roomRef.current = null;
          }

          if (error instanceof Error) {
            if (isPermissionDismissedError(error)) {
              alert(
                "Mikrofon erişimi reddedildi. Lütfen tarayıcı izinlerini kontrol edin.",
              );
            } else {
              alert("Sesli sohbete katılma hatası: " + error.message);
            }
          } else {
            alert("Sesli sohbete katılırken bir hata oluştu.");
          }
          return false;
        }
      })();

      joinPromiseRef.current = joinPromise;
      try {
        return await joinPromise;
      } finally {
        if (joinPromiseRef.current === joinPromise) {
          joinPromiseRef.current = null;
        }
      }
    },
    [socket, roomName, currentUsername, isInVoiceChat, refreshRemoteUsers],
  );

  // Socket: uzak kullanıcı konuşma durumu
  useEffect(() => {
    if (!socket) return;

    const handleRemoteSpeaking = (data: {
      username: string;
      isSpeaking: boolean;
    }) => {
      if (data.username === currentUsername) return;

      if (data.isSpeaking) {
        remoteSpeakingUsersRef.current.add(data.username);
      } else {
        remoteSpeakingUsersRef.current.delete(data.username);
      }

      setSpeakingUsers((prev) => {
        const next = new Set(prev);
        if (data.isSpeaking) {
          next.add(data.username);
        } else {
          next.delete(data.username);
        }
        return next;
      });
    };

    socket.on("voice:userSpeaking", handleRemoteSpeaking);
    return () => {
      socket.off("voice:userSpeaking", handleRemoteSpeaking);
    };
  }, [socket, currentUsername]);

  // Socket reconnect: voice state yeniden gönder
  useEffect(() => {
    if (!socket || !currentUsername || !isInVoiceChat) return;

    const handleRoomSocketJoined = (event: Event) => {
      if (!socket.connected) return;
      const detail = (event as CustomEvent<RoomSocketJoinedEventDetail>).detail;
      const voiceRoomKey =
        typeof detail?.room === "string" && detail.room.trim()
          ? detail.room.trim()
          : roomName;
      if (!voiceRoomKey) return;

      socket.emit("voice:toggleState", {
        room: voiceRoomKey,
        username: currentUsername,
        isInVoiceChat: true,
        isMuted,
      });
    };

    window.addEventListener(ROOM_SOCKET_JOINED_EVENT, handleRoomSocketJoined);
    return () => {
      window.removeEventListener(
        ROOM_SOCKET_JOINED_EVENT,
        handleRoomSocketJoined,
      );
    };
  }, [socket, roomName, currentUsername, isInVoiceChat, isMuted]);

  const toggleMute = useCallback(async () => {
    if (!socket || !currentUsername || !roomName) return;

    const room = roomRef.current;
    if (!room) return;

    const newMutedState = !isMuted;

    if (!newMutedState && (micBanned || globalMuted)) {
      alert("Bu odada susturulduğunuz için mikrofonu açamazsınız.");
      return;
    }

    await room.localParticipant.setMicrophoneEnabled(!newMutedState);

    socket.emit("voice:toggleMute", {
      room: roomName,
      username: currentUsername,
      isMuted: newMutedState,
    });

    setIsMuted(newMutedState);
  }, [socket, roomName, currentUsername, isMuted, micBanned, globalMuted]);

  const toggleDeafen = useCallback(() => {
    setIsDeafened((current) => {
      const next = !current;
      isDeafenedRef.current = next;
      const room = roomRef.current;
      if (room) {
        applyDeafenToAllRemoteTracks(room, next);
      }
      return next;
    });
  }, [applyDeafenToAllRemoteTracks]);

  // Unmount cleanup
  useEffect(() => {
    return () => {
      if (isInVoiceChat) {
        void leaveVoiceChat();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInVoiceChat]);

  // Moderasyon: mic ban
  useEffect(() => {
    if (!socket || !currentUsername) return;

    const handleMicBanToggled = (data: {
      username: string;
      micBanned: boolean;
    }) => {
      if (
        String(data.username).toLowerCase() !==
        String(currentUsername).toLowerCase()
      )
        return;

      setMicBanned(data.micBanned);
      if (data.micBanned && isInVoiceChat) {
        const room = roomRef.current;
        if (room) {
          void room.localParticipant.setMicrophoneEnabled(false);
        }
        setIsMuted(true);
        socket.emit("voice:toggleMute", {
          room: roomName,
          username: currentUsername,
          isMuted: true,
        });
        alert(
          "Mikrofonunuz bir yetkili tarafından yasaklandı. Diğerlerini dinlemeye devam edebilirsiniz.",
        );
      }
    };

    const handleForceMute = (data: {
      room?: string;
      username?: string;
      reason?: string;
    }) => {
      if (!data?.username || !data?.room) return;

      const sameUser =
        String(data.username).toLowerCase() ===
        String(currentUsername).toLowerCase();
      const sameRoom =
        String(data.room).trim().toLowerCase() ===
        String(roomName || "").trim().toLowerCase();

      if (!sameUser || !sameRoom) return;

      const room = roomRef.current;
      if (room) {
        void room.localParticipant.setMicrophoneEnabled(false);
      }
      setIsMuted(true);
      if (socket && roomName && currentUsername) {
        socket.emit("voice:toggleMute", {
          room: roomName,
          username: currentUsername,
          isMuted: true,
        });
      }
      window.dispatchEvent(
        new CustomEvent("kingmobile:voice-seat-force-released", {
          detail: { room: data.room, username: data.username },
        }),
      );
    };

    const handleMuteStateChanged = (data: {
      username: string;
      scope: "room" | "global";
      room?: string;
      roomName?: string;
      roomMuted?: boolean;
      globalMuted?: boolean;
    }) => {
      if (
        String(data.username).toLowerCase() !==
        String(currentUsername).toLowerCase()
      )
        return;

      const currentRoom = String(roomName || "").trim().toLowerCase();
      const payloadRoom = String(data.room || "").trim().toLowerCase();
      const roomMutedChanged =
        data.scope === "room" &&
        currentRoom &&
        payloadRoom &&
        currentRoom === payloadRoom &&
        data.roomMuted === true;
      const globalMutedChanged =
        data.scope === "global" && data.globalMuted === true;

      if (data.scope === "global") {
        setGlobalMuted(data.globalMuted === true);
      }

      if (roomMutedChanged || globalMutedChanged) {
        const room = roomRef.current;
        if (room) {
          void room.localParticipant.setMicrophoneEnabled(false);
        }
        setIsMuted(true);
        if (socket && roomName && currentUsername) {
          socket.emit("voice:toggleMute", {
            room: roomName,
            username: currentUsername,
            isMuted: true,
          });
        }
      }
    };

    socket.on("moderation:micBanToggled", handleMicBanToggled);
    socket.on("moderation:muteStateChanged", handleMuteStateChanged);
    socket.on("moderation:forceMute", handleForceMute);
    return () => {
      socket.off("moderation:micBanToggled", handleMicBanToggled);
      socket.off("moderation:muteStateChanged", handleMuteStateChanged);
      socket.off("moderation:forceMute", handleForceMute);
    };
  }, [socket, currentUsername, isInVoiceChat, leaveVoiceChat, roomName]);

  const syncWithRoomUsers = useCallback(
    async (_users: Array<{ username: string; isInVoiceChat?: boolean }>) => {
      // LiveKit otomatik senkronize eder
    },
    [],
  );

  const value: VoiceChatContextType = {
    isInVoiceChat,
    isMuted,
    isDeafened,
    joinVoiceChat,
    leaveVoiceChat,
    toggleMute,
    toggleDeafen,
    remoteUsers,
    syncWithRoomUsers,
    speakingUsers,
    micBanned,
    globalMuted,
  };

  return (
    <VoiceChatContext.Provider value={value}>
      {children}
    </VoiceChatContext.Provider>
  );
};
