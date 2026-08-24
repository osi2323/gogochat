"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Film, Mic, Send, Smile, X } from "lucide-react";
import { toast } from "sonner";
import { MsnEmojiPicker } from "./MsnEmojiPicker";
import { AnimationPicker } from "./AnimationPicker";

export type DirectMessageMenuAction =
  | "clear"
  | "delete"
  | "block"
  | "buzz"
  | "image"
  | "audio"
  | "voice-record";

type DirectMessageInputProps = {
  onSend: (payload: {
    content?: string;
    image?: string;
    audio?: string;
    audioFileName?: string;
    replyToMessageId?: number;
  }) => Promise<void> | void;
  disabled?: boolean;
  onOpenMenu?: () => void;
  onCloseMenu?: () => void;
  showMenu?: boolean;
  onVoiceCall?: () => void;
  onVideoCall?: () => void;
  canVoiceCall?: boolean;
  canVideoCall?: boolean;
  canSendAudio?: boolean;
  canRecordVoice?: boolean;
  audioDisabledReason?: string;
  blockMenuLabel?: string;
  onMenuAction?: (action: DirectMessageMenuAction) => void;
  isBlockedByMe?: boolean;
  replyTo?: {
    id: number;
    senderName: string;
    content: string;
  } | null;
  onCancelReply?: () => void;
};

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const compressImageToDataUrl = (
  file: File,
  boxSize = 1280,
  quality = 0.82,
  targetSizeKB = 4096,
): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = document.createElement("img");
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const sourceSize = Math.min(img.width, img.height);
        const sourceX = Math.max(0, Math.floor((img.width - sourceSize) / 2));
        const sourceY = Math.max(0, Math.floor((img.height - sourceSize) / 2));

        canvas.width = boxSize;
        canvas.height = boxSize;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas context not available"));
          return;
        }

        ctx.drawImage(
          img,
          sourceX,
          sourceY,
          sourceSize,
          sourceSize,
          0,
          0,
          boxSize,
          boxSize,
        );

        let currentQuality = quality;
        let compressed = canvas.toDataURL("image/jpeg", currentQuality);

        while (
          compressed.length > targetSizeKB * 1024 &&
          currentQuality > 0.42
        ) {
          currentQuality -= 0.08;
          compressed = canvas.toDataURL("image/jpeg", currentQuality);
        }

        if (compressed.length > targetSizeKB * 1024) {
          const scale = Math.sqrt((targetSizeKB * 1024) / compressed.length);
          const nextSize = Math.max(640, Math.floor(boxSize * scale));
          const previousCanvas = document.createElement("canvas");
          previousCanvas.width = canvas.width;
          previousCanvas.height = canvas.height;
          previousCanvas.getContext("2d")?.drawImage(canvas, 0, 0);
          const previousImage = document.createElement("img");
          previousImage.onload = () => {
            canvas.width = nextSize;
            canvas.height = nextSize;
            ctx.drawImage(previousImage, 0, 0, nextSize, nextSize);
            compressed = canvas.toDataURL(
              "image/jpeg",
              Math.max(currentQuality, 0.5),
            );
            resolve(compressed);
          };
          previousImage.onerror = () => reject(new Error("Failed to resize image"));
          previousImage.src = previousCanvas.toDataURL("image/jpeg", currentQuality);
          return;
        }

        resolve(compressed);
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = String(event.target?.result ?? "");
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const getSupportedRecordingMimeType = () => {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
    return "";
  }

  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];

  return (
    candidates.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) || ""
  );
};

const getAudioExtension = (mimeType: string) => {
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mpeg")) return "mp3";
  if (mimeType.includes("wav")) return "wav";
  return "webm";
};

export const DirectMessageInput = ({
  onSend,
  disabled,
  onOpenMenu,
  onCloseMenu,
  showMenu,
  onVoiceCall,
  onVideoCall,
  canVoiceCall = false,
  canVideoCall = false,
  canSendAudio = true,
  canRecordVoice = true,
  audioDisabledReason,
  blockMenuLabel = "Engelle / Engel aç",
  onMenuAction,
  isBlockedByMe = false,
  replyTo = null,
  onCancelReply,
}: DirectMessageInputProps) => {
  const [message, setMessage] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [selectedAudio, setSelectedAudio] = useState<string | null>(null);
  const [selectedAudioFileName, setSelectedAudioFileName] = useState("");
  const [sending, setSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAnimationPicker, setShowAnimationPicker] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [showMobileMediaMenu, setShowMobileMediaMenu] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recorderStatus, setRecorderStatus] = useState<
    "idle" | "recording" | "recorded"
  >("idle");
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [recordedAudioBase64, setRecordedAudioBase64] = useState<string | null>(
    null,
  );
  const [recordedAudioFileName, setRecordedAudioFileName] = useState("");
  const [audioCaption, setAudioCaption] = useState("");
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const emojiPickerRef = useRef<HTMLDivElement | null>(null);
  const emojiButtonRef = useRef<HTMLButtonElement | null>(null);
  const animationPickerRef = useRef<HTMLDivElement | null>(null);
  const animationButtonRef = useRef<HTMLButtonElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearRecordingTimer = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const stopRecordingStream = () => {
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    recordingStreamRef.current = null;
    mediaRecorderRef.current = null;
  };

  const resetRecordingState = () => {
    if (recordedAudioUrl) {
      URL.revokeObjectURL(recordedAudioUrl);
    }
    setRecordedAudioUrl(null);
    setRecordedAudioBase64(null);
    setRecordedAudioFileName("");
    setAudioCaption("");
    setRecordingTime(0);
    setRecorderStatus("idle");
    setIsRecording(false);
    recordingChunksRef.current = [];
    clearRecordingTimer();
    stopRecordingStream();
  };

  const resetMedia = () => {
    setImage(null);
    setSelectedAudio(null);
    setSelectedAudioFileName("");
    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
    if (cameraInputRef.current) {
      cameraInputRef.current.value = "";
    }
    if (audioInputRef.current) {
      audioInputRef.current.value = "";
    }
  };

  const clearImage = () => {
    setImage(null);
    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
    if (cameraInputRef.current) {
      cameraInputRef.current.value = "";
    }
  };

  const clearAudio = () => {
    setSelectedAudio(null);
    setSelectedAudioFileName("");
    if (audioInputRef.current) {
      audioInputRef.current.value = "";
    }
  };

  const handleSend = async () => {
    if (disabled || sending) return;
    const trimmed = message.trim();
    if (!trimmed && !image && !selectedAudio) return;

    setSending(true);
    try {
      await onSend({
        content: trimmed || undefined,
        image: image || undefined,
        audio: selectedAudio || undefined,
        audioFileName: selectedAudioFileName || undefined,
        replyToMessageId: replyTo?.id,
      });
      setMessage("");
      resetMedia();
    } finally {
      setSending(false);
    }
  };

  const handleImagePick = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Lütfen sadece resim dosyası seçin.");
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      toast.error("Resim boyutu 15MB'dan küçük olmalıdır.");
      return;
    }

    const fileName = file.name?.toLowerCase() ?? "";
    const isGifFile = file.type === "image/gif" || fileName.endsWith(".gif");

    try {
      const dataUrl = isGifFile
        ? await fileToDataUrl(file)
        : await compressImageToDataUrl(file);

      if (dataUrl.length > 6 * 1024 * 1024) {
        toast.error("Resim çok büyük. Lütfen daha küçük bir resim seçin.");
        return;
      }

      clearAudio();
      setImage(dataUrl);
    } catch (error) {
      console.error("DM image processing failed", error);
      toast.error("Resim işlenemedi. Lütfen farklı bir resim deneyin.");
    }
  };

  const handleAudioPick = async (file: File | null) => {
    if (!file) return;
    if (!canSendAudio) {
      toast.error(audioDisabledReason || "Sesli mesaj gonderimi kapali.");
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    clearImage();
    setSelectedAudio(dataUrl);
    setSelectedAudioFileName(file.name || `audio-${Date.now()}.webm`);
  };

  const startVoiceRecording = async () => {
    if (!canRecordVoice) {
      toast.error(audioDisabledReason || "Sesli mesaj gonderimi kapali.");
      return;
    }
    if (isRecording || sending) return;
    if (typeof window === "undefined" || !("MediaRecorder" in window)) {
      toast.error("Tarayiciniz ses kaydini desteklemiyor.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;
      const mimeType = getSupportedRecordingMimeType();
      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      recordingChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const resolvedMimeType =
          mediaRecorder.mimeType ||
          recordingChunksRef.current[0]?.type ||
          "audio/webm";
        const blob = new Blob(recordingChunksRef.current, {
          type: resolvedMimeType,
        });
        const objectUrl = URL.createObjectURL(blob);
        setRecordedAudioUrl(objectUrl);

        const reader = new FileReader();
        reader.onloadend = () => {
          setRecordedAudioBase64(reader.result as string);
          setRecordedAudioFileName(
            `voice-message.${getAudioExtension(resolvedMimeType)}`,
          );
          setRecorderStatus("recorded");
        };
        reader.readAsDataURL(blob);

        setIsRecording(false);
        clearRecordingTimer();
        stopRecordingStream();
        recordingChunksRef.current = [];
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecorderStatus("recording");
      setRecordingTime(0);
      clearRecordingTimer();
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("DM voice recording could not start", error);
      toast.error("Mikrofon izni gerekli. Lutfen izin verin.");
      resetRecordingState();
    }
  };

  const stopVoiceRecording = () => {
    if (!isRecording) return;

    clearRecordingTimer();
    try {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    } catch (error) {
      console.error("DM voice recording could not stop", error);
      resetRecordingState();
    }
  };

  const handleSendRecordedVoice = async () => {
    if (!recordedAudioBase64 || disabled || sending) return;

    setSending(true);
    try {
      await onSend({
        content: audioCaption.trim() || undefined,
        audio: recordedAudioBase64,
        audioFileName:
          recordedAudioFileName || `voice-message-${Date.now()}.webm`,
        replyToMessageId: replyTo?.id,
      });
      setShowVoiceRecorder(false);
      resetRecordingState();
      setMessage("");
      resetMedia();
    } finally {
      setSending(false);
    }
  };

  const handleCloseRecorder = () => {
    setShowVoiceRecorder(false);
    resetRecordingState();
  };

  const handleAnimationSelect = async (animationUrl: string) => {
    if (disabled || sending) return;

    setShowAnimationPicker(false);
    setShowEmojiPicker(false);

    if (animationUrl.includes("/emom/")) {
      const match = animationUrl.match(/\/emom\/(e\d+)\.gif/);
      if (match) {
        const emojiCode = match[1];
        setMessage((prev) => prev + (prev ? " " : "") + `[${emojiCode}]`);
      }
      return;
    }

    setSending(true);
    try {
      await onSend({ image: animationUrl, replyToMessageId: replyTo?.id });
      setMessage("");
      resetMedia();
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target as Node) &&
        emojiButtonRef.current &&
        !emojiButtonRef.current.contains(event.target as Node)
      ) {
        setShowEmojiPicker(false);
      }
      if (
        animationPickerRef.current &&
        !animationPickerRef.current.contains(event.target as Node) &&
        animationButtonRef.current &&
        !animationButtonRef.current.contains(event.target as Node)
      ) {
        setShowAnimationPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      clearRecordingTimer();
      stopRecordingStream();
      if (recordedAudioUrl) {
        URL.revokeObjectURL(recordedAudioUrl);
      }
    };
  }, [recordedAudioUrl]);

  const menuItems: Array<{
    label: string;
    key: DirectMessageMenuAction;
    hidden?: boolean;
    disabled?: boolean;
  }> = [
    { label: "Ekran Temizle", key: "clear" },
    { label: "Sohbeti Sil", key: "delete" },
    { label: blockMenuLabel, key: "block" },
    { label: "Titret", key: "buzz" },
    { label: "Resim", key: "image" },
    {
      label: "Ses",
      key: "audio",
      disabled: !canSendAudio,
    },
    {
      label: "Sesli mesaj",
      key: "voice-record",
      disabled: !canRecordVoice,
    },
  ];

  return (
    <div className="relative z-30 shrink-0 border-t border-zinc-200 bg-white px-3 py-2 pb-[calc(env(safe-area-inset-bottom)+8px)] shadow-[0_-1px_0_rgba(0,0,0,0.04)] md:px-3 md:py-2 md:pb-2">
      {replyTo && (
        <div className="mb-1.5 flex min-w-0 items-center gap-2 rounded-md border-l-4 border-blue-400 bg-blue-50 px-2 py-1.5">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[11px] font-semibold leading-tight text-blue-700">
              {replyTo.senderName}
            </div>
            <div className="truncate text-[11px] leading-tight text-zinc-600">
              {replyTo.content}
            </div>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-white hover:text-zinc-800"
            aria-label="Alıntıyı kaldır"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {image && (
        <div className="absolute inset-x-3 bottom-[calc(100%+8px)] z-20 flex max-w-full items-center gap-2 overflow-hidden rounded-xl border border-zinc-200 bg-white/95 p-2 shadow-lg backdrop-blur md:static md:mb-2 md:gap-2 md:bg-zinc-50 md:p-2 md:shadow-none md:backdrop-blur-none">
          <img
            src={image}
            alt="preview"
            className="h-10 w-10 shrink-0 rounded-lg object-cover md:h-10 md:w-10"
          />
          <span className="min-w-0 flex-1 truncate text-xs font-medium text-zinc-600 md:text-sm">
            Görsel hazır
          </span>
          <button
            type="button"
            onClick={clearImage}
            className="shrink-0 rounded-full px-2 py-1 text-xs font-semibold text-red-500 hover:bg-red-50 hover:text-red-600 md:px-3"
          >
            Kaldir
          </button>
        </div>
      )}

      {selectedAudio && (
        <div className="absolute inset-x-3 bottom-[calc(100%+8px)] z-20 overflow-hidden rounded-xl border border-zinc-200 bg-white/95 p-2 shadow-lg backdrop-blur md:static md:mb-2 md:bg-zinc-50 md:p-2 md:shadow-none md:backdrop-blur-none">
          <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
            <span className="truncate text-xs font-semibold text-zinc-700">
              {selectedAudioFileName || "Ses dosyasi"}
            </span>
            <button
              type="button"
              onClick={clearAudio}
              className="shrink-0 rounded-full px-2 py-1 text-xs font-semibold text-red-500 hover:bg-red-50 hover:text-red-600 md:px-3"
            >
              Kaldir
            </button>
          </div>
          <audio controls className="h-8 w-full max-w-full">
            <source src={selectedAudio} />
          </audio>
        </div>
      )}

      <div className="relative">
        {showVoiceRecorder && (
          <div className="absolute bottom-full left-0 right-0 z-30 mb-3 sm:right-auto sm:w-[350px]">
            <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-zinc-900">
                    Sesli Mesaj
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      recorderStatus === "recording"
                        ? "bg-red-100 text-red-700"
                        : recorderStatus === "recorded"
                          ? "bg-green-100 text-green-700"
                          : "bg-zinc-100 text-zinc-600"
                    }`}
                  >
                    {recorderStatus === "recording"
                      ? "Kayitta"
                      : recorderStatus === "recorded"
                        ? "Hazir"
                        : "Hazirda"}
                  </span>
                </div>
                <button
                  onClick={handleCloseRecorder}
                  className="text-zinc-500 transition-colors hover:text-zinc-700"
                  aria-label="Kapat"
                >
                  ✕
                </button>
              </div>

              <div className="flex items-center gap-2 text-sm text-zinc-600">
                <span
                  className={`h-2 w-2 rounded-full ${
                    recorderStatus === "recording"
                      ? "bg-red-500 animate-pulse"
                      : recorderStatus === "recorded"
                        ? "bg-green-500"
                        : "bg-zinc-300"
                  }`}
                />
                <span>
                  {recorderStatus === "recording"
                    ? `Kayit ${recordingTime}s`
                    : recorderStatus === "recorded"
                      ? "Kayit hazir, dinleyip gonderebilirsin."
                      : "Hazirda bekliyor"}
                </span>
              </div>

              {recordedAudioUrl && (
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                  <audio controls className="w-full">
                    <source src={recordedAudioUrl} />
                  </audio>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <button
                  onClick={() => {
                    resetRecordingState();
                    void startVoiceRecording();
                  }}
                  disabled={isRecording || sending}
                  className="w-full rounded-lg bg-blue-500 py-2 text-sm text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Baslat
                </button>
                <button
                  onClick={stopVoiceRecording}
                  disabled={!isRecording}
                  className="w-full rounded-lg bg-red-500 py-2 text-sm text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Durdur
                </button>
                <button
                  onClick={resetRecordingState}
                  className="w-full rounded-lg bg-zinc-100 py-2 text-sm text-zinc-700 hover:bg-zinc-200"
                >
                  Sifirla
                </button>
                <button
                  onClick={() => {
                    resetRecordingState();
                    void startVoiceRecording();
                  }}
                  className="w-full rounded-lg bg-zinc-100 py-2 text-sm text-zinc-700 hover:bg-zinc-200"
                >
                  Tekrar kaydet
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-zinc-500">
                  Aciklama (opsiyonel)
                </label>
                <input
                  type="text"
                  value={audioCaption}
                  onChange={(e) => setAudioCaption(e.target.value)}
                  className="w-full rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Not ekle..."
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={handleCloseRecorder}
                  className="rounded-lg px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
                >
                  Iptal
                </button>
                <button
                  onClick={() => void handleSendRecordedVoice()}
                  disabled={isRecording || !recordedAudioBase64 || sending}
                  className="rounded-lg bg-blue-500 px-5 py-2 text-sm text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Gonder
                </button>
              </div>
            </div>
          </div>
        )}

        {showAnimationPicker && (
          <div
            ref={animationPickerRef}
            className="absolute bottom-full left-0 mb-3 z-30"
          >
            <AnimationPicker onAnimationSelect={handleAnimationSelect} />
          </div>
        )}
        {showEmojiPicker && (
          <div
            ref={emojiPickerRef}
            className="absolute bottom-full left-0 mb-3 z-20"
          >
            <MsnEmojiPicker
              onEmojiSelect={(emojiUrl) => {
                const match = emojiUrl.match(/\/emom\/(e\d+)\.gif/);
                if (match) {
                  const emojiCode = match[1];
                  setMessage((prev) => prev + (prev ? " " : "") + `[${emojiCode}]`);
                }
                setShowEmojiPicker(false);
              }}
            />
          </div>
        )}
        {showMenu && (
          <div className="absolute bottom-full right-2 z-20 mb-3 w-44 rounded-lg border border-zinc-200 bg-white shadow-xl">
            {menuItems
              .filter((item) => !item.hidden)
              .map((item, idx) => {
                const isDisabled =
                  item.disabled || (isBlockedByMe && item.key !== "block");

                return (
                  <button
                    key={item.key}
                    disabled={isDisabled}
                    title={isDisabled && item.disabled ? audioDisabledReason : undefined}
                    onClick={() => {
                      if (item.key === "image") {
                        imageInputRef.current?.click();
                        onMenuAction?.(item.key);
                      } else if (item.key === "audio") {
                        audioInputRef.current?.click();
                      } else if (item.key === "voice-record") {
                        setShowVoiceRecorder(true);
                        resetRecordingState();
                      } else {
                        onMenuAction?.(item.key);
                      }

                      onCloseMenu?.();
                    }}
                    className={`w-full px-3 py-1.5 text-left text-xs ${
                      isDisabled
                        ? "cursor-not-allowed bg-zinc-50 text-zinc-400"
                        : "text-zinc-700 hover:bg-zinc-50"
                    } ${
                      idx >= 4 ? "border-t border-zinc-200" : ""
                    }`}
                  >
                    {item.label}
                  </button>
                );
            })}
          </div>
        )}
        {showMobileMediaMenu && (
          <div className="absolute bottom-full right-0 z-30 mb-3 w-40 overflow-hidden rounded-[14px] bg-white/95 text-[15px] text-[#0a84ff] shadow-lg ring-1 ring-zinc-200 md:hidden">
            <button
              type="button"
              onClick={() => {
                setShowMobileMediaMenu(false);
                imageInputRef.current?.click();
              }}
              className="flex h-11 w-full items-center justify-center border-b border-zinc-200/80"
            >
              Galeri
            </button>
            <button
              type="button"
              onClick={() => {
                setShowMobileMediaMenu(false);
                cameraInputRef.current?.click();
              }}
              className="flex h-11 w-full items-center justify-center border-b border-zinc-200/80"
            >
              Kamera
            </button>
            <button
              type="button"
              onClick={() => {
                setShowMobileMediaMenu(false);
                imageInputRef.current?.click();
              }}
              className="flex h-11 w-full items-center justify-center"
            >
              Dosya
            </button>
          </div>
        )}

        <div className="flex min-w-0 items-center gap-1.5 md:gap-2">
          <button
            ref={animationButtonRef}
            disabled={disabled}
            type="button"
            onClick={() => {
              setShowAnimationPicker((prev) => !prev);
              setShowEmojiPicker(false);
              setShowMobileMediaMenu(false);
            }}
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#0a84ff] hover:bg-zinc-50 md:border md:border-zinc-200 md:bg-white md:text-zinc-500 ${
              showAnimationPicker ? "ring-2 ring-blue-300" : ""
            }`}
            title="Animasyon"
            aria-label="Animasyon gönder"
          >
            <Film className="h-6 w-6 md:h-4 md:w-4" />
          </button>

          <button
            ref={emojiButtonRef}
            disabled={disabled}
            onClick={() => {
              setShowEmojiPicker((prev) => !prev);
              setShowAnimationPicker(false);
            }}
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#0a84ff] hover:bg-zinc-50 md:h-8 md:w-8 md:border md:border-zinc-200 md:bg-white md:text-zinc-500 ${
              showEmojiPicker ? "ring-2 ring-blue-300" : ""
            }`}
            title="Emoji"
          >
            <span className="md:hidden">
              <Smile className="h-6 w-6" />
            </span>
            <span className="hidden md:inline">🙂</span>
          </button>

          <div className="min-w-0 flex-1 rounded-full border border-zinc-300 bg-white px-3 py-2 shadow-inner md:border-zinc-200 md:px-4 md:py-1.5 md:shadow-none">
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Mesaj..."
              className="w-full bg-transparent text-[16px] text-zinc-900 placeholder-zinc-400 focus:outline-none md:text-[14px]"
              disabled={disabled}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
            />
          </div>

          <button
            onClick={onVoiceCall}
            disabled={disabled || !canVoiceCall}
            className="hidden h-8 w-8 shrink-0 rounded-full border border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50 sm:block"
            title="Sesli arama"
          >
            <svg
              viewBox="0 0 24 24"
              className="mx-auto h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.86 19.86 0 0 1 2.08 4.18 2 2 0 0 1 4.06 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8 9a16 16 0 0 0 6 6l.36-.31a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
          </button>

          <button
            onClick={onVideoCall}
            disabled={disabled || !canVideoCall}
            className="hidden h-8 w-8 shrink-0 rounded-full border border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50 sm:block"
            title="Goruntulu arama"
          >
            <svg
              viewBox="0 0 24 24"
              className="mx-auto h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="3" y="6" width="12" height="12" rx="2" ry="2" />
              <path d="m22 8-5 4 5 4V8z" />
            </svg>
          </button>

          <button
            onClick={onOpenMenu}
            className="hidden h-8 w-8 shrink-0 rounded-full border border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50 md:block"
            title="Menu"
          >
            ...
          </button>

          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setShowVoiceRecorder(true);
              resetRecordingState();
            }}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#0a84ff] md:hidden"
            aria-label="Sesli mesaj"
          >
            <Mic className="h-6 w-6" />
          </button>

          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setShowMobileMediaMenu((prev) => !prev);
              setShowEmojiPicker(false);
              setShowAnimationPicker(false);
            }}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#0a84ff] md:hidden"
            aria-label="Görsel gönder"
          >
            <Camera className="h-6 w-6" />
          </button>

          <button
            onClick={() => void handleSend()}
            disabled={disabled || sending}
            className={`shrink-0 rounded-full bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 md:px-3 md:py-1.5 ${
              message.trim() || image || selectedAudio ? "flex" : "hidden md:flex"
            }`}
          >
            <span className="md:hidden">
              <Send className="h-4 w-4" />
            </span>
            <span className="hidden md:inline">{sending ? "..." : "Gonder"}</span>
          </button>
        </div>
      </div>

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => void handleImagePick(e.target.files?.[0] || null)}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => void handleImagePick(e.target.files?.[0] || null)}
        className="hidden"
      />
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        onChange={(e) => void handleAudioPick(e.target.files?.[0] || null)}
        className="hidden"
      />
    </div>
  );
};
