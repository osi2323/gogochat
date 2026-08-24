import { cookies } from "next/headers";
import { env } from "@/config/env";
import { getServerApiClient } from "@/lib/api/serverClient";
import { createAuthService } from "@/services/authService";
import type { MeResponse } from "@/services/auth.types";

export type AuthStatus =
  | { authenticated: true; user: MeResponse }
  | { authenticated: false };

/**
 * Server-side authentication check using /auth/me endpoint
 * This runs on the server and cannot be bypassed by client-side manipulation
 * Returns user data if authenticated, or false if not
 */
export async function getAuthStatus(): Promise<AuthStatus> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(env.authCookieName)?.value;

    // No token = not authenticated
    if (!token) {
      return { authenticated: false };
    }

    try {
      // Verify token by calling /auth/me
      const client = await getServerApiClient();
      const authService = createAuthService(client);

      const user = await authService.me();

      return {
        authenticated: true,
        user,
      };
    } catch {
      // If 401 or any error, token is invalid - clear it
      const cookieStore = await cookies();
      cookieStore.delete(env.authCookieName);

      return { authenticated: false };
    }
  } catch (error) {
    return { authenticated: false };
  }
}

/**
 * Check if username exists in the system
 * Server-side only to prevent client manipulation
 */
export async function checkUsernameExists(username: string): Promise<boolean> {
  try {
    const client = await getServerApiClient();
    const authService = createAuthService(client);

    const result = await authService.checkUsername({ username });

    // available: true means username does NOT exist
    // available: false means username DOES exist
    return !result.available;
  } catch (error) {
    return false;
  }
}
