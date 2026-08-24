"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  clearClientAuthState,
  getClientAuthService,
  hasClientAuthToken,
} from "@/lib/api/clientApi";
import { ApiError } from "@/lib/api/errors";

export const ChatAuthGuard = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      if (!hasClientAuthToken()) {
        clearClientAuthState();
        router.replace("/");
        if (isMounted) {
          setIsChecking(false);
        }
        return;
      }

      try {
        const authService = getClientAuthService();
        const userData = await authService.me();

        if (!isMounted) return;

        localStorage.setItem("userId", userData.id.toString());
        if (userData.isGuest) {
          localStorage.setItem("isGuest", "true");
          localStorage.setItem("guestUsername", userData.username);
          localStorage.setItem("guestGender", userData.gender);
          localStorage.removeItem("username");
        } else {
          localStorage.setItem("isGuest", "false");
          localStorage.setItem("username", userData.username);
          localStorage.removeItem("guestUsername");
          localStorage.removeItem("guestGender");
          localStorage.removeItem("guestStatusModeId");
          localStorage.removeItem("guestStatusModeName");
          localStorage.removeItem("guestStatusModeExpiresAt");
        }

        setIsAuthorized(true);
      } catch (error) {
        if (!(error instanceof ApiError && error.status === 401)) {
          console.error("Auth check error:", error);
        }
        clearClientAuthState();
        router.replace("/");
      } finally {
        if (isMounted) {
          setIsChecking(false);
        }
      }
    };

    checkAuth();

    return () => {
      isMounted = false;
    };
  }, [router]);

  // Show loading state while checking
  if (isChecking) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-zinc-600">Yükleniyor...</div>
      </div>
    );
  }

  // Only render children if authorized
  if (!isAuthorized) {
    return null;
  }

  return <>{children}</>;
};
