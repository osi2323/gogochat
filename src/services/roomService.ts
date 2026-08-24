import { AxiosInstance } from "axios";

const ROOM_MEDIA_REQUEST_TIMEOUT_MS = 120_000;

export interface RoomOwnerRole {
  id: number;
  name: string;
  microphoneDuration: number;
  starColor: string;
  starCount: number;
  icon: string;
  permissions: Record<string, unknown>;
}

export interface RoomOwner {
  id: number;
  username: string;
  gender: "male" | "female";
  icon?: string | null;
  role?: RoomOwnerRole | null;
}

export interface Room {
  id: number;
  name: string;
  voiceId: number | string | null;
  ownerId: number;
  owner: RoomOwner;
  description: string;
  maxUsers: number;
  visibleUserCount: number;
  isPrivate: boolean;
  isEditable?: boolean;
  radioPanelLink: string;
  radioRequestLink: string;
  listOrder: number;
  minStar: number;
  backgroundColor: string;
  roomImage: string;
  logo: string;
  createdAt: string;
  updatedAt: string;
}

export interface RoomAccessCheckPayload {
  roomId?: number | string;
  room?: string;
  roomName?: string;
}

export interface RoomAccessCheckResponse {
  allowed: boolean;
  reason?: "minimum_star_required" | "meeting_permission_required";
  requiredMinStar: number;
  userStarCount: number;
  roomId: number | null;
  roomName: string | null;
  redirectRoomSlug?: string;
}

export const createRoomService = (client: AxiosInstance) => {
  return {
    /**
     * Fetch all rooms
     */
    getRooms: async (): Promise<Room[]> => {
      const response = await client.get<Room[]>("/rooms");
      return response.data;
    },
    /**
     * Check if room exists by name
     */
    checkRoomExists: async (
      name: string
    ): Promise<{ exists: boolean; voiceId?: string | null }> => {
      const response = await client.get<{
        exists: boolean;
        voiceId?: string | null;
      }>("/rooms/exists", {
        params: { name },
      });
      return response.data;
    },
    checkRoomAccess: async (
      payload: RoomAccessCheckPayload
    ): Promise<RoomAccessCheckResponse> => {
      const response = await client.post<RoomAccessCheckResponse>(
        "/rooms/access-check",
        payload,
      );
      return response.data;
    },
    /**
     * Create room (supports multipart or JSON)
     */
    createRoom: async (data: FormData | Partial<Room>) => {
      const isMultipart = typeof FormData !== "undefined" && data instanceof FormData;
      const response = await client.post<Room>("/rooms", data, {
        headers: isMultipart ? { "Content-Type": "multipart/form-data" } : undefined,
        timeout: isMultipart ? ROOM_MEDIA_REQUEST_TIMEOUT_MS : undefined,
      });
      return response.data;
    },
    /**
     * Update room
     */
    updateRoom: async (roomId: number, data: FormData | Partial<Room>) => {
      const isMultipart = typeof FormData !== "undefined" && data instanceof FormData;
      const response = await client.patch<Room>(`/rooms/${roomId}`, data, {
        headers: isMultipart ? { "Content-Type": "multipart/form-data" } : undefined,
        timeout: isMultipart ? ROOM_MEDIA_REQUEST_TIMEOUT_MS : undefined,
      });
      return response.data;
    },
    /**
     * Get room detail by id
     */
    getRoom: async (roomId: number | string): Promise<Room> => {
      const response = await client.get<Room>(`/rooms/${roomId}`);
      return response.data;
    },
    /**
     * Delete room by id
     */
    deleteRoom: async (roomId: number): Promise<void> => {
      await client.delete(`/rooms/${roomId}`);
    },
  };
};
