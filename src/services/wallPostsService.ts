import { AxiosInstance } from "axios";

export type WallPostVisibility = "members" | "staff";

export type WallPostUser = {
  id: number;
  username: string;
  displayUsername?: string | null;
  agentNickname?: string | null;
  gender: "male" | "female";
  icon: string | null;
  starCount: number;
  starColor: string | null;
};

export type WallPost = {
  id: number;
  content: string | null;
  image: string | null;
  backgroundColor: string | null;
  visibility: WallPostVisibility;
  likeCount: number;
  commentCount: number;
  isLiked: boolean;
  isViewed: boolean;
  user: WallPostUser;
  createdAt: string;
  updatedAt: string;
};

export type WallPostComment = {
  id: number;
  content: string;
  user: WallPostUser;
  createdAt: string;
};

export type WallPostView = {
  id: number;
  user: Pick<
    WallPostUser,
    "id" | "username" | "displayUsername" | "agentNickname" | "icon" | "starCount"
  >;
  createdAt: string;
};

export const createWallPostsService = (client: AxiosInstance) => {
  return {
    list: async (params?: { limit?: number; offset?: number }) => {
      const response = await client.get<WallPost[]>("/wall-posts", {
        params,
      });
      return response.data;
    },
    create: async (payload: {
      content?: string;
      image?: string;
      backgroundColor?: string;
      visibility: WallPostVisibility;
    }) => {
      const response = await client.post<WallPost>("/wall-posts", payload);
      return response.data;
    },
    toggleLike: async (id: number) => {
      const response = await client.post<{ liked: boolean; likeCount: number }>(
        `/wall-posts/${id}/like`,
      );
      return response.data;
    },
    listComments: async (id: number) => {
      const response = await client.get<WallPostComment[]>(
        `/wall-posts/${id}/comments`,
      );
      return response.data;
    },
    addComment: async (id: number, content: string) => {
      const response = await client.post<WallPostComment>(
        `/wall-posts/${id}/comments`,
        { content },
      );
      return response.data;
    },
    markViewed: async (id: number) => {
      const response = await client.post<{ viewCount: number }>(
        `/wall-posts/${id}/views`,
      );
      return response.data;
    },
    listViews: async (id: number) => {
      const response = await client.get<WallPostView[]>(
        `/wall-posts/${id}/views`,
      );
      return response.data;
    },
    deletePost: async (id: number) => {
      await client.delete(`/wall-posts/${id}`);
    },
    deleteComment: async (postId: number, commentId: number) => {
      await client.delete(`/wall-posts/${postId}/comments/${commentId}`);
    },
  };
};
