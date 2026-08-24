import { AxiosInstance } from "axios";

export type CallHistoryDirection = "incoming" | "outgoing";
export type CallHistoryStatus = "missed" | "completed" | "rejected" | "canceled";

export type CallHistoryRecord = {
  id: number;
  callId: string;
  peerName: string;
  direction: CallHistoryDirection;
  status: CallHistoryStatus;
  startedAt: string;
  endedAt?: string | null;
  durationSec?: number | null;
};

export type CreateCallHistoryPayload = {
  callId: string;
  peerName: string;
  direction: CallHistoryDirection;
  status: CallHistoryStatus;
  startedAt: string;
  endedAt?: string | null;
  durationSec?: number | null;
};

export const createCallHistoryService = (client: AxiosInstance) => {
  return {
    list: async (): Promise<CallHistoryRecord[]> => {
      const response = await client.get<CallHistoryRecord[]>("/call-history");
      return response.data;
    },
    create: async (
      payload: CreateCallHistoryPayload,
    ): Promise<CallHistoryRecord> => {
      const response = await client.post<CallHistoryRecord>(
        "/call-history",
        payload,
      );
      return response.data;
    },
    delete: async (id: number): Promise<void> => {
      await client.delete(`/call-history/${id}`);
    },
  };
};
