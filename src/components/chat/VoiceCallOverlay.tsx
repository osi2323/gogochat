"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RemoteParticipant, LocalVideoTrack } from "livekit-client";
import { Track } from "livekit-client";
import { readChatPreferencesFromStorage } from "@/lib/chatPreferences";
import { resolveAvatarUrl } from "@/lib/avatarUrl";

type CallPeer = {
  username: string;
  icon?: string | null;
  gender?: string | null;
  roleName?: string | null;
  isGuest?: boolean;
};

type CallState =
  | { status: "idle" }
  | {
      status: "outgoing";
      callType: "voice" | "video";
      callId: string;
      target: CallPeer;
      startedAt: number;
      expiresAt: number;
    }
  | {
      status: "incoming";
      callType: "voice" | "video";
      callId: string;
      from: CallPeer;
      startedAt: number;
      expiresAt: number;
    }
  | {
      status: "active";
      callType: "voice" | "video";
      callId: string;
      peer: CallPeer;
      connectedAt: number;
      direction: "incoming" | "outgoing";
    };

type VoiceCallOverlayProps = {
  callState: CallState;
  remoteUsers: RemoteParticipant[];
  localVideoTrack: LocalVideoTrack | null;
  onAccept: (callId: string) => void;
  onReject: (callId: string) => void;
  onCancel: (callId: string) => void;
  onEnd: (callId: string) => void;
};

const formatSeconds = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const INCOMING_RINGTONE_SRC = "/sounds/call-outgoing.mp3?v=20260430";
const OUTGOING_RINGTONE_SRC = "/sounds/call-incoming.mp3?v=20260430";

export const VoiceCallOverlay = ({
  callState,
  remoteUsers,
  localVideoTrack,
  onAccept,
  onReject,
  onCancel,
  onEnd,
}: VoiceCallOverlayProps) => {
  const [now, setNow] = useState<number | null>(null);
  const incomingAudioRef = useRef<HTMLAudioElement | null>(null);
  const outgoingAudioRef = useRef<HTMLAudioElement | null>(null);
  const [ringtoneMuted, setRingtoneMuted] = useState(false);
  const remoteVideoContainerRef = useRef<HTMLDivElement | null>(null);
  const localVideoContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let timeoutId: number | undefined;
    const syncMuteState = () => {
      const prefs = readChatPreferencesFromStorage();
      const nextValue = Boolean(prefs.muteCallRingtone);
      setRingtoneMuted((prev) => (prev === nextValue ? prev : nextValue));
    };
    syncMuteState();
    const onPrefsChange = () => {
      // Defer to avoid setState during another component render.
      timeoutId = window.setTimeout(syncMuteState, 0);
    };
    window.addEventListener("chatPreferencesChanged", onPrefsChange);
    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      window.removeEventListener("chatPreferencesChanged", onPrefsChange);
    };
  }, []);

  useEffect(() => {
    const incoming = new Audio(INCOMING_RINGTONE_SRC);
    incoming.loop = true;
    incoming.preload = "auto";
    incoming.volume = 0.9;
    incomingAudioRef.current = incoming;

    const outgoing = new Audio(OUTGOING_RINGTONE_SRC);
    outgoing.loop = true;
    outgoing.preload = "auto";
    outgoing.volume = 0.9;
    outgoingAudioRef.current = outgoing;

    return () => {
      if (incomingAudioRef.current) {
        incomingAudioRef.current.pause();
        incomingAudioRef.current.currentTime = 0;
      }
      if (outgoingAudioRef.current) {
        outgoingAudioRef.current.pause();
        outgoingAudioRef.current.currentTime = 0;
      }
    };
  }, []);

  useEffect(() => {
    if (callState.status === "idle") return;
    const timeoutId = window.setTimeout(() => setNow(Date.now()), 0);
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(id);
    };
  }, [callState.status]);

  useEffect(() => {
    const incoming = incomingAudioRef.current;
    const outgoing = outgoingAudioRef.current;
    if (!incoming || !outgoing) return;

    const stopAll = () => {
      incoming.pause();
      incoming.currentTime = 0;
      outgoing.pause();
      outgoing.currentTime = 0;
    };

    if (ringtoneMuted) {
      stopAll();
      return;
    }

    if (callState.status === "incoming") {
      outgoing.pause();
      outgoing.currentTime = 0;
      void incoming.play().catch(() => {});
      return;
    }

    if (callState.status === "outgoing") {
      incoming.pause();
      incoming.currentTime = 0;
      void outgoing.play().catch(() => {});
      return;
    }

    stopAll();
  }, [callState.status, ringtoneMuted]);

  const peer = useMemo(() => {
    if (callState.status === "outgoing") return callState.target;
    if (callState.status === "incoming") return callState.from;
    if (callState.status === "active") return callState.peer;
    return null;
  }, [callState]);

  const countdown =
    callState.status === "incoming" || callState.status === "outgoing"
      ? Math.max(0, Math.ceil((callState.expiresAt - (now ?? callState.expiresAt)) / 1000))
      : null;

  const activeDuration =
    callState.status === "active"
      ? Math.max(0, Math.floor(((now ?? callState.connectedAt) - callState.connectedAt) / 1000))
      : null;

  const resolvedIcon = useMemo(() => {
    return resolveAvatarUrl(peer?.icon);
  }, [peer]);
  const showInitial = !resolvedIcon;
  const isVideoCall = callState.status !== "idle" && callState.callType === "video";
  const remoteVideoTrack = useMemo(() => {
    for (const participant of remoteUsers) {
      for (const pub of participant.videoTrackPublications.values()) {
        if (pub.source === Track.Source.Camera && pub.videoTrack) {
          return pub.videoTrack;
        }
      }
    }
    return null;
  }, [remoteUsers]);

  useEffect(() => {
    if (!isVideoCall || callState.status !== "active") return;
    if (!remoteVideoTrack || !remoteVideoContainerRef.current) return;
    const el = remoteVideoTrack.attach();
    el.style.width = "100%";
    el.style.height = "100%";
    el.style.objectFit = "cover";
    remoteVideoContainerRef.current.appendChild(el);
    return () => {
      remoteVideoTrack.detach(el);
      el.remove();
    };
  }, [isVideoCall, callState.status, remoteVideoTrack]);

  useEffect(() => {
    if (!isVideoCall || callState.status !== "active") return;
    if (!localVideoTrack || !localVideoContainerRef.current) return;
    const el = localVideoTrack.attach();
    el.style.width = "100%";
    el.style.height = "100%";
    el.style.objectFit = "cover";
    localVideoContainerRef.current.appendChild(el);
    return () => {
      localVideoTrack.detach(el);
      el.remove();
    };
  }, [isVideoCall, callState.status, localVideoTrack]);

  if (callState.status === "idle" || !peer) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[2400] flex items-center justify-center bg-black/35 px-4">
      <div className="pointer-events-auto w-[440px] max-w-[92%] rounded-xl bg-white px-8 py-8 text-center shadow-2xl">
        {isVideoCall && callState.status === "active" && (
          <div className="mb-4">
            <div className="relative overflow-hidden rounded-xl border border-zinc-200 bg-zinc-900">
              <div
                ref={remoteVideoContainerRef}
                className="h-[220px] w-full"
              />
              {!remoteVideoTrack && (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-white/80">
                  Karşı tarafın kamerası kapalı
                </div>
              )}
              <div className="absolute bottom-3 right-3 overflow-hidden rounded-lg border border-white/20 bg-zinc-950">
                <div ref={localVideoContainerRef} className="h-20 w-28" />
                {!localVideoTrack && (
                  <div className="absolute inset-0 flex items-center justify-center text-[11px] text-white/70">
                    Kamera kapalı
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        <div className="mb-4 flex justify-center">
          <div
            className={`h-20 w-20 overflow-hidden rounded-full border border-zinc-200 flex items-center justify-center text-2xl font-bold text-zinc-600 ${
              resolvedIcon?.startsWith("data:")
                ? "bg-white"
                : "bg-zinc-100"
            }`}
          >
            {resolvedIcon && !showInitial ? (
              <img
                src={resolvedIcon}
                alt="avatar"
                className="h-full w-full object-cover"
              />
            ) : (
              peer.username.charAt(0).toUpperCase()
            )}
          </div>
        </div>
        <div className="text-xs font-semibold tracking-[0.25em] text-zinc-500">
          {isVideoCall ? "GORUNTULU ARAMA" : "SESLI ARAMA"}
        </div>
        <div className="mt-2 text-2xl font-semibold text-zinc-800">
          {peer.username}
        </div>
        <div className="mt-1 text-xs text-zinc-400">
          {peer.isGuest ? "Misafir" : peer.roleName || "Uye"}
        </div>

        {callState.status === "outgoing" && (
          <div className="mt-4 text-sm text-zinc-500">
            Karşıda çalıyor... {countdown !== null ? formatSeconds(countdown) : ""}
          </div>
        )}
        {callState.status === "incoming" && (
          <div className="mt-4 text-sm text-zinc-500">
            Seni arıyor... {countdown !== null ? formatSeconds(countdown) : ""}
          </div>
        )}
        {callState.status === "active" && (
          <div className="mt-4 text-sm text-zinc-500">
            {isVideoCall ? "Goruntulu gorusme" : "Konusma"} •{" "}
            {activeDuration !== null ? formatSeconds(activeDuration) : ""}
          </div>
        )}

        <div className="mt-6 flex items-center justify-center gap-3">
          {callState.status === "incoming" && (
            <>
              <button
                onClick={() => onAccept(callState.callId)}
                className="rounded-full bg-green-500 px-5 py-2 text-sm font-semibold text-white hover:bg-green-600"
              >
                Kabul
              </button>
              <button
                onClick={() => onReject(callState.callId)}
                className="rounded-full bg-red-500 px-5 py-2 text-sm font-semibold text-white hover:bg-red-600"
              >
                Reddet
              </button>
            </>
          )}
          {callState.status === "outgoing" && (
            <button
              onClick={() => onCancel(callState.callId)}
              className="rounded-full bg-red-500 px-6 py-2 text-sm font-semibold text-white hover:bg-red-600"
            >
              Iptal
            </button>
          )}
          {callState.status === "active" && (
            <button
              onClick={() => onEnd(callState.callId)}
              className="rounded-full bg-red-500 px-6 py-2 text-sm font-semibold text-white hover:bg-red-600"
            >
              Kapat
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
