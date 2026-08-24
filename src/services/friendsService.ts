import { type AxiosInstance } from "axios";

export type FriendUser = {
  id: number;
  username: string;
  displayUsername?: string | null;
  agentNickname?: string | null;
  gender: "male" | "female";
  icon?: string | null;
  frame?: string | null;
  roleName?: string | null;
  roleIcon?: string | null;
  roleStarColor?: string | null;
  roleStarCount?: number | null;
  userGif?: string | null;
};

export type FriendRequestStatus =
  | "PENDING"
  | "ACCEPTED"
  | "REJECTED"
  | "CANCELED"
  | "BLOCKED";

export type FriendRequest = {
  id: number;
  requesterId: number;
  addresseeId: number;
  status: FriendRequestStatus;
  user: FriendUser;
  createdAt: string;
  updatedAt: string;
};

export type BlockedUser = FriendUser;

export type FriendRelationState = {
  targetUsername: string;
  isFriend: boolean;
  hasIncomingRequest: boolean;
  hasOutgoingRequest: boolean;
  isBlockedByMe: boolean;
  isBlockedByOther: boolean;
  isBlockedEitherWay: boolean;
};

export type IgnoredUser = string;

export const createFriendsService = (client: AxiosInstance) => ({
  getFriends: async (): Promise<FriendRequest[]> => {
    const res = await client.get("/friends");
    return res.data;
  },
  getIncomingRequests: async (): Promise<FriendRequest[]> => {
    const res = await client.get("/friends/requests/incoming");
    return res.data;
  },
  getOutgoingRequests: async (): Promise<FriendRequest[]> => {
    const res = await client.get("/friends/requests/outgoing");
    return res.data;
  },
  getBlockedUsers: async (): Promise<BlockedUser[]> => {
    const res = await client.get("/friends/blocks");
    return res.data;
  },
  getIgnoredUsers: async (): Promise<IgnoredUser[]> => {
    const res = await client.get("/friends/ignores");
    return res.data;
  },
  getRelation: async (
    targetUsername: string,
    targetAgentNickname?: string | null,
  ): Promise<FriendRelationState> => {
    const res = await client.get(`/friends/relation/${targetUsername}`, {
      params: targetAgentNickname ? { targetAgentNickname } : undefined,
    });
    return res.data;
  },
  sendRequest: async (
    targetUsername: string,
    targetAgentNickname?: string | null,
  ): Promise<FriendRequest> => {
    const res = await client.post("/friends/requests", {
      targetUsername,
      targetAgentNickname,
    });
    return res.data;
  },
  acceptRequest: async (id: number): Promise<FriendRequest> => {
    const res = await client.post(`/friends/requests/${id}/accept`);
    return res.data;
  },
  rejectRequest: async (id: number): Promise<{ status: "ok" }> => {
    const res = await client.post(`/friends/requests/${id}/reject`);
    return res.data;
  },
  cancelRequest: async (id: number): Promise<{ status: "ok" }> => {
    const res = await client.post(`/friends/requests/${id}/cancel`);
    return res.data;
  },
  removeFriend: async (id: number): Promise<{ status: "ok" }> => {
    const res = await client.post(`/friends/requests/${id}/remove`);
    return res.data;
  },
  blockUser: async (
    targetUsername: string,
    targetAgentNickname?: string | null,
  ): Promise<{ status: "ok" }> => {
    const res = await client.post("/friends/blocks", {
      targetUsername,
      targetAgentNickname,
    });
    return res.data;
  },
  unblockUser: async (targetUsername: string): Promise<{ status: "ok" }> => {
    const res = await client.delete(`/friends/blocks/${targetUsername}`);
    return res.data;
  },
  ignoreUser: async (targetUsername: string): Promise<{ status: "ok" }> => {
    const res = await client.post("/friends/ignores", { targetUsername });
    return res.data;
  },
  unignoreUser: async (targetUsername: string): Promise<{ status: "ok" }> => {
    const res = await client.delete(`/friends/ignores/${targetUsername}`);
    return res.data;
  },
});
