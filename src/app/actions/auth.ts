"use server";

import { ApiError } from "@/lib/api/errors";
import { getServerApiClient } from "@/lib/api/serverClient";
import { createAuthService } from "@/services/authService";

export async function loginAction(
  username: string,
  password: string,
  agentNickname?: string,
) {
  if (!username || !password) {
    return {
      success: false,
      error: "Rumuz ve şifre alanları zorunludur.",
    };
  }

  try {
    const client = await getServerApiClient();
    const authService = createAuthService(client);

    const response = await authService.login({
      username,
      password,
      agentNickname: agentNickname?.trim() || undefined,
    });

    // Cookie is set client-side to allow JavaScript access for Authorization header
    return {
      success: true,
      data: {
        id: response.id,
        username: response.username,
        gender: response.gender,
        accessToken: response.accessToken,
        loginHistoryId: response.loginHistoryId,
      },
    };
  } catch (error) {
    const message =
      error instanceof ApiError
        ? error.message
        : "Giriş işlemi sırasında beklenmeyen bir hata oluştu.";

    return {
      success: false,
      error: message,
    };
  }
}

export async function checkUsernameAction(username: string) {
  if (!username) {
    return {
      success: false,
      error: "Rumuz alanı zorunludur.",
    };
  }

  try {
    const client = await getServerApiClient();
    const authService = createAuthService(client);

    const response = await authService.checkUsername({ username });

    return {
      success: true,
      available: response.available,
      existingUsername: response.existingUsername,
    };
  } catch (error) {
    const message =
      error instanceof ApiError
        ? error.message
        : "Kullanıcı kontrolü sırasında bir hata oluştu.";

    return {
      success: false,
      error: message,
    };
  }
}

export async function guestLoginAction(
  username: string,
  gender: "male" | "female"
) {
  if (!username) {
    return {
      success: false,
      error: "Rumuz alanı zorunludur.",
    };
  }

  try {
    const client = await getServerApiClient();
    const authService = createAuthService(client);

    const response = await authService.guestLogin({ username, gender });

    return {
      success: true,
      id: response.id,
      accessToken: response.accessToken,
      username: response.username,
      gender: response.gender,
      isGuest: response.isGuest,
      loginHistoryId: response.loginHistoryId,
    };
  } catch (error) {
    const message =
      error instanceof ApiError
        ? error.message
        : "Misafir girişi sırasında bir hata oluştu.";

    return {
      success: false,
      error: message,
    };
  }
}

export async function registerAction(
  username: string,
  password: string,
  gender: "male" | "female"
) {
  if (!username || !password) {
    return {
      success: false,
      error: "Rumuz ve şifre alanları zorunludur.",
    };
  }

  try {
    const client = await getServerApiClient();
    const authService = createAuthService(client);

    const response = await authService.register({
      username,
      password,
      gender,
    });

    // Cookie is set client-side to allow JavaScript access for Authorization header
    return {
      success: true,
      data: {
        id: response.id,
        username: response.username,
        gender: response.gender,
        accessToken: response.accessToken,
        loginHistoryId: response.loginHistoryId,
      },
    };
  } catch (error) {
    const message =
      error instanceof ApiError
        ? error.message
        : "Kayıt işlemi sırasında bir hata oluştu.";

    return {
      success: false,
      error: message,
    };
  }
}
