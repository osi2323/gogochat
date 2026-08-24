import { AxiosInstance } from "axios";

export type DirectMessagePayload = {
  content?: string;
  image?: string;
  audio?: string;
  audioFileName?: string;
  replyToMessageId?: number;
};

export const createDirectMessagesService = (client: AxiosInstance) => {
  return {
    listConversations: async () => {
      const response = await client.get("/direct-messages/conversations");
      return response.data;
    },
    getMessages: async (
      conversationId: number,
      params?: { limit?: number; beforeId?: number },
      config?: { timeout?: number },
    ) => {
      const response = await client.get(
        `/direct-messages/conversations/${conversationId}/messages`,
        { params, ...config },
      );
      return response.data;
    },
    createConversation: async (targetUsername: string, targetAgentNickname?: string | null) => {
      const response = await client.post("/direct-messages/conversations", {
        targetUsername,
        ...(targetAgentNickname?.trim() ? { targetAgentNickname: targetAgentNickname.trim() } : {}),
      });
      return response.data;
    },
    sendMessage: async (conversationId: number, payload: DirectMessagePayload) => {
      const response = await client.post(
        `/direct-messages/conversations/${conversationId}/messages`,
        payload,
      );
      return response.data;
    },
    markRead: async (conversationId: number) => {
      const response = await client.post(
        `/direct-messages/conversations/${conversationId}/read`,
      );
      return response.data;
    },
    buzzConversation: async (conversationId: number) => {
      const response = await client.post(
        `/direct-messages/conversations/${conversationId}/buzz`,
      );
      return response.data;
    },
    clearConversation: async (conversationId: number) => {
      const response = await client.post(
        `/direct-messages/conversations/${conversationId}/clear`,
      );
      return response.data;
    },
    deleteConversation: async (conversationId: number) => {
      const response = await client.delete(
        `/direct-messages/conversations/${conversationId}`,
      );
      return response.data;
    },
    getUnreadCount: async () => {
      const response = await client.get("/direct-messages/unread-count");
      return response.data;
    },
    clearHistory: async () => {
      const response = await client.post("/direct-messages/clear-history");
      return response.data;
    },
  };
};
