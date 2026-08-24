import { AxiosInstance } from "axios";

export type SearchScope =
  | "room"
  | "all"
  | "rooms"
  | "calls"
  | "friends"
  | "wall";

export type CreateSearchHistoryPayload = {
  query: string;
  scope: SearchScope;
  resultsCount?: number;
};

export const createSearchHistoryService = (client: AxiosInstance) => {
  return {
    createSearchHistory: async (payload: CreateSearchHistoryPayload) => {
      const response = await client.post("/search-history", payload);
      return response.data;
    },
  };
};
