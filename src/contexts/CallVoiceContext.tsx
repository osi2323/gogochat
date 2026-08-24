"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Room,
  RoomEvent,
  RemoteParticipant,
  LocalVideoTrack,
  Track,
} from "livekit-client";
import { getClientApiClient } from "@/lib/api/clientApi";

type CallType = "voice" | "video";

type CallVoiceContextType = {
  isInCall: boolean;
  isMuted: boolean;
  remoteUsers: RemoteParticipant[];
  localVideoTrack: LocalVideoTrack | null;
  joinCall: (
    callId: string,
    currentUsername: string,
    callType?: CallType,
  ) => Promise<void>;
  leaveCall: () => Promise<void>;
  toggleMute: () => Promise<void>;
};

const CallVoiceContext = createContext<CallVoiceContextType | null>(null);

export const useCallVoice = () => {
  const context = useContext(CallVoiceContext);
  if (!context) {
    throw new Error("useCallVoice must be used within a CallVoiceProvider");
  }
  return context;
};

type CallVoiceProviderProps = {
  children: React.ReactNode;
};

const LIVEKIT_URL =
  process.env.NEXT_PUBLIC_LIVEKIT_URL || "ws://localhost:7880";

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

export const CallVoiceProvider = ({ children }: CallVoiceProviderProps) => {
  const [isInCall, setIsInCall] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [remoteUsers, setRemoteUsers] = useState<RemoteParticipant[]>([]);
  const [localVideoTrack, setLocalVideoTrack] =
    useState<LocalVideoTrack | null>(null);

  const roomRef = useRef<Room | null>(null);
  const isLeavingRef = useRef(false);

  const refreshRemoteUsers = useCallback((room: Room) => {
    setRemoteUsers([...room.remoteParticipants.values()]);
  }, []);

  const refreshLocalVideoTrack = useCallback((room: Room) => {
    const pub = [...room.localParticipant.videoTrackPublications.values()].find(
      (p) => p.source === Track.Source.Camera,
    );
    setLocalVideoTrack((pub?.track as LocalVideoTrack) ?? null);
  }, []);

  const leaveCall = useCallback(async () => {
    if (isLeavingRef.current) return;
    isLeavingRef.current = true;
    try {
      const room = roomRef.current;
      if (room && room.state !== "disconnected") {
        await room.disconnect();
      }
      roomRef.current = null;
      setRemoteUsers([]);
      setLocalVideoTrack(null);
      setIsInCall(false);
      setIsMuted(false);
    } finally {
      isLeavingRef.current = false;
    }
  }, []);

  const joinCall = useCallback(
    async (
      callId: string,
      currentUsername: string,
      callType: CallType = "voice",
    ) => {
      if (isLeavingRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      if (!callId) throw new Error("callId is required");
      if (!currentUsername) throw new Error("currentUsername is required");

      const existingRoom = roomRef.current;
      if (existingRoom && existingRoom.state === "connected") return;

      const channelName = `call_${callId}`;
      const token = await fetchLivekitToken(channelName, true);

      const room = new Room();
      roomRef.current = room;

      room.on(RoomEvent.ParticipantConnected, () => refreshRemoteUsers(room));
      room.on(RoomEvent.ParticipantDisconnected, () =>
        refreshRemoteUsers(room),
      );
      room.on(RoomEvent.TrackSubscribed, (track) => {
        refreshRemoteUsers(room);
        if (track.kind === Track.Kind.Audio) {
          const audioEl = track.attach() as HTMLAudioElement;
          audioEl.style.display = "none";
          document.body.appendChild(audioEl);
        }
      });
      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        if (track.kind === Track.Kind.Audio) {
          track.detach();
        }
        refreshRemoteUsers(room);
      });
      room.on(RoomEvent.LocalTrackPublished, () =>
        refreshLocalVideoTrack(room),
      );
      room.on(RoomEvent.LocalTrackUnpublished, () =>
        refreshLocalVideoTrack(room),
      );

      try {
        await room.connect(LIVEKIT_URL, token);
        await room.startAudio();
        await room.localParticipant.setMicrophoneEnabled(true);
        if (callType === "video") {
          await room.localParticipant.setCameraEnabled(true);
          refreshLocalVideoTrack(room);
        }
      } catch (error) {
        if (roomRef.current) {
          try {
            await roomRef.current.disconnect();
          } catch {}
          roomRef.current = null;
        }
        throw error;
      }

      setIsInCall(true);
      setIsMuted(false);
    },
    [refreshRemoteUsers, refreshLocalVideoTrack],
  );

  const toggleMute = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !isMuted;
    await room.localParticipant.setMicrophoneEnabled(!next);
    setIsMuted(next);
  }, [isMuted]);

  useEffect(() => {
    return () => {
      void leaveCall();
    };
  }, [leaveCall]);

  return (
    <CallVoiceContext.Provider
      value={{
        isInCall,
        isMuted,
        remoteUsers,
        localVideoTrack,
        joinCall,
        leaveCall,
        toggleMute,
      }}
    >
      {children}
    </CallVoiceContext.Provider>
  );
};
