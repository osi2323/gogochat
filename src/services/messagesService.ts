import { AxiosInstance } from "axios";

export type SendRoomMessagePayload = {
  content: string;
  type: "normal" | "reply";
  roomName: string;
  replyToMessageId?: number;
  fontColor?: string | null;
  targetGroup?: string;
};

export const createMessagesService = (client: AxiosInstance) => {
  return {
    sendMessage: async (payload: SendRoomMessagePayload) => {
      const response = await client.post("/messages", payload);
      return response.data;
    },
    /**
     * Clear chat history for a room
     * @param roomName Name of the room
     */
    clearHistory: async (roomName: string): Promise<void> => {
      await client.post("/messages/clear-history", { roomName });
    },
    /**
     * Clear chat history for a room for everyone
     * @param roomName Name of the room
     */
    clearRoomHistory: async (
      roomName: string,
    ): Promise<{ deletedMessagesCount: number }> => {
      const response = await client.post("/messages/clear-room-history", {
        roomName,
      });
      return response.data;
    },
  };
};
