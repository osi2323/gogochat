"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { registerAction } from "@/app/actions/auth";

type RegisterModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
};

type StatusState =
  | { type: "idle" }
  | { type: "success"; message: string }
  | { type: "error"; message: string };

export const RegisterModal = ({
  isOpen,
  onClose,
  onSuccess,
}: RegisterModalProps) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [gender, setGender] = useState<"male" | "female">("male");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [status, setStatus] = useState<StatusState>({ type: "idle" });
  const [isPending, startTransition] = useTransition();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!acceptedTerms) {
      setStatus({
        type: "error",
        message: "Lütfen gizlilik şartlarını kabul ediniz.",
      });
      return;
    }

    if (password !== passwordConfirm) {
      setStatus({
        type: "error",
        message: "Şifreler eşleşmiyor.",
      });
      return;
    }

    startTransition(async () => {
      setStatus({ type: "idle" });

      const result = await registerAction(username, password, gender);

      if (result.success && result.data) {
        const wasGuest =
          typeof window !== "undefined" &&
          localStorage.getItem("isGuest") === "true";
        const previousGuestUsername =
          typeof window !== "undefined"
            ? localStorage.getItem("guestUsername")
            : null;

        if (wasGuest && typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("auth:identity-upgrading", {
              detail: {
                previousGuestUsername,
              },
            }),
          );
        }

        setStatus({
          type: "success",
          message: "Kayıt başarılı! Yönlendiriliyorsunuz...",
        });

        // Store auth token in localStorage (primary storage)
        if (result.data.accessToken) {
          localStorage.setItem("accessToken", result.data.accessToken);

          // Also set cookie as backup
          const maxAge = 60 * 60 * 24 * 7; // 7 days
          document.cookie = `auth_token=${result.data.accessToken}; path=/; max-age=${maxAge}; samesite=Lax`;
        }

        // Store user data
        if (result.data.username) {
          localStorage.setItem("username", result.data.username);
        }
        if (result.data.id) {
          localStorage.setItem("userId", result.data.id);
        }
        localStorage.setItem("isGuest", "false");
        localStorage.removeItem("guestUsername");
        localStorage.removeItem("guestGender");
        localStorage.removeItem("guestStatusModeId");
        localStorage.removeItem("guestStatusModeName");
        localStorage.removeItem("guestStatusModeExpiresAt");

        // Call success callback
        if (onSuccess) {
          onSuccess();
        }

        // Redirect to chat page with hard refresh to ensure cookies are loaded
        setTimeout(() => {
          window.location.href = "/chat/lobby";
        }, 1000);
      } else {
        setStatus({
          type: "error",
          message: result.error || "Kayıt başarısız oldu.",
        });
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-zinc-900">Üyelik Formu</h2>
          <button
            onClick={onClose}
            className="text-zinc-600 hover:text-zinc-900"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Info Banner */}
        <div className="mb-4 rounded-lg bg-blue-50 p-3 text-center">
          <p className="text-sm text-blue-700">
            Üye olmak basit ve ücretsizdir!
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username */}
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700">
              Kullanıcı Adınız...
            </label>
            <input
              type="text"
              placeholder="Rumuz yazınız"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-zinc-900 placeholder-zinc-400 transition-all focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2"
            />
          </div>

          {/* Password */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-700">
                Şifre...
              </label>
              <input
                type="password"
                placeholder="Şifre..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-zinc-900 placeholder-zinc-400 transition-all focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-700">
                Şifre tekrar...
              </label>
              <input
                type="password"
                placeholder="Şifre tekrar..."
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                required
                className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-zinc-900 placeholder-zinc-400 transition-all focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2"
              />
            </div>
          </div>

          {/* Gender */}
          <div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setGender("male")}
                className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all ${
                  gender === "male"
                    ? "border-blue-500 bg-blue-500 text-white shadow-sm"
                    : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                Erkek
              </button>
              <button
                type="button"
                onClick={() => setGender("female")}
                className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all ${
                  gender === "female"
                    ? "border-pink-500 bg-pink-500 text-white shadow-sm"
                    : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                Kadın
              </button>
            </div>
          </div>

          {/* Terms Checkbox */}
          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              id="terms"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-zinc-300"
            />
            <label htmlFor="terms" className="text-sm text-zinc-700">
              Üyelik/gizlilik şartlarını kabul ediyorum{" "}
              <a href="#" className="text-blue-500 hover:underline">
                sözleşme metni
              </a>
            </label>
          </div>

          {/* Status Messages */}
          {status.type === "error" && (
            <p className="text-sm text-red-500">{status.message}</p>
          )}

          {status.type === "success" && (
            <p className="text-sm text-emerald-500">{status.message}</p>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-zinc-300 px-4 py-2.5 font-semibold text-zinc-700 transition-all hover:bg-zinc-50"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 rounded-lg bg-blue-500 px-4 py-2.5 font-semibold text-white transition-all hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60 active:scale-95"
            >
              {isPending ? "Kaydediliyor..." : "Kayıt"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
