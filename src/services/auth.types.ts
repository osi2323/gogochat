import type { ChatPreferences } from "@/lib/chatPreferences";
export type Gender = "male" | "female";

export type LoginPayload = {
  username: string;
  password: string;
  agentNickname?: string;
};

export type AuthResponse = {
  id?: string;
  accessToken?: string;
  username?: string;
  gender?: Gender;
  createdAt?: Date;
  loginHistoryId?: number;
};

export type CheckUsernamePayload = {
  username: string;
};

export type CheckUsernameResponse = {
  available: boolean;
  message: string;
  existingUsername?: string;
};

export type RegisterPayload = {
  username: string;
  password: string;
  gender: Gender;
};

export type GuestLoginPayload = {
  username: string;
  gender: Gender;
};

export type GuestLoginResponse = {
  id: number;
  accessToken: string;
  username: string;
  gender?: Gender;
  isGuest: boolean;
  loginHistoryId?: number;
};

export type Role = {
  id: number;
  name: string;
  microphoneDuration: number;
  starColor: string;
  starCount: number;
  icon: string;
  permissions: Record<string, unknown>;
};

export type MeResponse = {
  id: number;
  username: string;
  isGuest: boolean;
  gender: Gender;
  role: Role | null;
  permissions: string[];
  statusMode?: {
    id: number;
    name: string;
  } | null;
  frame?: string | null;
  icon?: string | null;
  fontName?: string | null;
  granite?: string | null;
  nickColor?: string | null;
  userGif?: string | null;
  flashNick?: string | null;
  accountFrozen?: boolean;
  joinEffect?:
    | "ocean-ribbon"
    | "ruby-crown"
    | "silver-comet"
    | "aurora-prism"
    | "royal-onyx"
    | "gif-effect-1"
    | "gif-effect-2"
    | "gif-effect-3"
    | "gif-effect-4"
    | "gif-effect-dplpd"
    | null;
  micBanned?: boolean;
  cameraBanned?: boolean;
  globalMuted?: boolean;
  chatPreferences?: ChatPreferences;
  createdAt: string;
};
