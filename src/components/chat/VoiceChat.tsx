"use client";

import { useVoiceChat } from "@/contexts/VoiceChatContext";
import { Mic, MicOff, Phone, PhoneOff } from "lucide-react";

export const VoiceChat = () => {
  const { isInVoiceChat, isMuted, joinVoiceChat, leaveVoiceChat, toggleMute } =
    useVoiceChat();

  const handleJoinClick = async () => {
    try {
      await joinVoiceChat();
    } catch (error) {
      console.error("❌ Error joining voice chat:", error);
    }
  };

  const handleLeaveClick = () => {
    leaveVoiceChat();
  };

  return (
    <div className="border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`h-10 w-10 rounded-full flex items-center justify-center ${
              isInVoiceChat
                ? "bg-green-500 text-white animate-pulse"
                : "bg-zinc-200 text-zinc-500"
            }`}
          >
            {isInVoiceChat ? (
              <Phone className="h-5 w-5" />
            ) : (
              <PhoneOff className="h-5 w-5" />
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Sesli Sohbet
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {isInVoiceChat
                ? isMuted
                  ? "Mikrofonunuz kapalı"
                  : "Bağlantı aktif"
                : "Bağlı değilsiniz"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isInVoiceChat && (
            <button
              onClick={toggleMute}
              className={`p-3 rounded-full transition-colors ${
                isMuted
                  ? "bg-red-500 text-white hover:bg-red-600"
                  : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
              }`}
              title={isMuted ? "Mikrofonu Aç" : "Mikrofonu Kapat"}
            >
              {isMuted ? (
                <MicOff className="h-5 w-5" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </button>
          )}

          <button
            onClick={isInVoiceChat ? handleLeaveClick : handleJoinClick}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              isInVoiceChat
                ? "bg-red-500 text-white hover:bg-red-600"
                : "bg-green-500 text-white hover:bg-green-600"
            }`}
          >
            {isInVoiceChat ? "Ayrıl" : "Katıl"}
          </button>
        </div>
      </div>

      {isInVoiceChat && (
        <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span>Sesli sohbettesiniz</span>
        </div>
      )}
    </div>
  );
};
