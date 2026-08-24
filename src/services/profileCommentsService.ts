import { AxiosInstance } from "axios";

export type ProfileCommentUser = {
  id: number;
  username: string;
  displayUsername?: string | null;
  agentNickname?: string | null;
  gender: "male" | "female";
  icon: string | null;
  starCount: number;
  starColor: string | null;
};

export type ProfileComment = {
  id: number;
  content: string;
  user: ProfileCommentUser;
  createdAt: string;
  status: "pending" | "approved";
  approvedAt: string | null;
};

export const createProfileCommentsService = (client: AxiosInstance) => {
  return {
    list: async (username: string, agentNickname?: string | null) => {
      const response = await client.get<ProfileComment[]>(
        `/profile-comments/${encodeURIComponent(username)}`,
        { params: agentNickname ? { agentNickname } : undefined },
      );
      return response.data;
    },
    create: async (username: string, content: string, agentNickname?: string | null) => {
      const response = await client.post<ProfileComment>(
        `/profile-comments/${encodeURIComponent(username)}`,
        { content },
        { params: agentNickname ? { agentNickname } : undefined },
      );
      return response.data;
    },
    listPending: async (username: string, agentNickname?: string | null) => {
      const response = await client.get<ProfileComment[]>(
        `/profile-comments/${encodeURIComponent(username)}/pending`,
        { params: agentNickname ? { agentNickname } : undefined },
      );
      return response.data;
    },
    listMinePending: async (username: string, agentNickname?: string | null) => {
      const response = await client.get<ProfileComment[]>(
        `/profile-comments/${encodeURIComponent(username)}/pending/mine`,
        { params: agentNickname ? { agentNickname } : undefined },
      );
      return response.data;
    },
    approve: async (
      username: string,
      commentId: number,
      agentNickname?: string | null,
    ) => {
      const response = await client.post<ProfileComment>(
        `/profile-comments/${encodeURIComponent(username)}/${commentId}/approve`,
        undefined,
        { params: agentNickname ? { agentNickname } : undefined },
      );
      return response.data;
    },
    delete: async (
      username: string,
      commentId: number,
      agentNickname?: string | null,
    ) => {
      await client.delete(
        `/profile-comments/${encodeURIComponent(username)}/${commentId}`,
        { params: agentNickname ? { agentNickname } : undefined },
      );
    },
  };
};
