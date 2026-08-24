"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  clearClientAuthState,
  getClientAuthService,
  hasClientAuthToken,
} from "@/lib/api/clientApi";

export const HomeAuthCheck = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();

  useEffect(() => {
    const checkAndRedirect = async () => {
      if (!hasClientAuthToken()) {
        return;
      }

      try {
        const authService = getClientAuthService();

        // Try to get current user
        const userData = await authService.me();

        // If user is authenticated, redirect to chat
        if (userData) {
          router.replace("/chat/lobby");
        }
      } catch (error) {
        // Not authenticated, stay on login page
        clearClientAuthState();
      }
    };

    checkAndRedirect();
  }, [router]);

  return <>{children}</>;
};
