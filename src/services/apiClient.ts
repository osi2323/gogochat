import { getClientApiClient, getClientAuthService } from "@/lib/api/clientApi";
import { createLoginHistoryService } from "./loginHistoryService";
import { createRoomService } from "./roomService";
import { createSystemSettingsService } from "./systemSettingsService";
import { createMessagesService } from "./messagesService";
import { createFriendsService } from "./friendsService";
import { createSearchHistoryService } from "./searchHistoryService";
import { createWallPostsService } from "./wallPostsService";
import { createDirectMessagesService } from "./directMessagesService";
import { createProfileCommentsService } from "./profileCommentsService";
import { createCallHistoryService } from "./callHistoryService";

/**
 * API Client for browser usage
 * Includes auth service and can be extended with other services
 */
const client = getClientApiClient();

export const apiClient = {
  auth: getClientAuthService(),
  loginHistory: createLoginHistoryService(client),
  rooms: createRoomService(client),
  systemSettings: createSystemSettingsService(client),
  messages: createMessagesService(client),
  friends: createFriendsService(client),
  searchHistory: createSearchHistoryService(client),
  wallPosts: createWallPostsService(client),
  directMessages: createDirectMessagesService(client),
  profileComments: createProfileCommentsService(client),
  callHistory: createCallHistoryService(client),
  // Add other services here as needed
  // e.g., users: createUserService(client),
};

export default apiClient;
