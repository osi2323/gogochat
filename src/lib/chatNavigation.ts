const ROOM_NAVIGATION_INTENT_KEY = "roomNavigationIntent";
const LEGACY_NAVIGATION_KEY = "isNavigating";
const ROOM_NAVIGATION_INTENT_TTL_MS = 15_000;

export type RoomNavigationSource = "sidebar" | "teleport" | "invite" | "meeting";

type RoomNavigationIntent = {
  kind: "room-change";
  source: RoomNavigationSource;
  ts: number;
  id: string;
};

type RoomNavigationState = {
  isRoomChange: boolean;
  source?: RoomNavigationSource | "legacy";
};

const isBrowser = () => typeof window !== "undefined";

export const setRoomNavigationIntent = (source: RoomNavigationSource): void => {
  if (!isBrowser()) return;

  const payload: RoomNavigationIntent = {
    kind: "room-change",
    source,
    ts: Date.now(),
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  };

  sessionStorage.setItem(ROOM_NAVIGATION_INTENT_KEY, JSON.stringify(payload));
  // Legacy key for backward compatibility during rollout.
  sessionStorage.setItem(LEGACY_NAVIGATION_KEY, "true");
};

export const getRoomNavigationIntent = (
  options: { consume?: boolean } = {},
): RoomNavigationState => {
  if (!isBrowser()) return { isRoomChange: false };
  const shouldConsume = options.consume !== false;

  const intentRaw = sessionStorage.getItem(ROOM_NAVIGATION_INTENT_KEY);
  if (intentRaw) {
    try {
      const parsed = JSON.parse(intentRaw) as Partial<RoomNavigationIntent>;
      const parsedTs = parsed.ts;
      const parsedSource = parsed.source;
      const isValidKind = parsed.kind === "room-change";
      const hasValidTs =
        typeof parsedTs === "number" && Number.isFinite(parsedTs);
      const hasValidSource =
        parsedSource === "sidebar" ||
        parsedSource === "teleport" ||
        parsedSource === "invite" ||
        parsedSource === "meeting";

      if (isValidKind && hasValidTs && hasValidSource) {
        const isExpired = Date.now() - parsedTs > ROOM_NAVIGATION_INTENT_TTL_MS;
        if (!isExpired) {
          if (shouldConsume) {
            sessionStorage.removeItem(ROOM_NAVIGATION_INTENT_KEY);
            sessionStorage.removeItem(LEGACY_NAVIGATION_KEY);
          }
          return { isRoomChange: true, source: parsedSource };
        }
      }
    } catch {
      // Ignore parse errors and treat as stale intent.
    }

    sessionStorage.removeItem(ROOM_NAVIGATION_INTENT_KEY);
    sessionStorage.removeItem(LEGACY_NAVIGATION_KEY);
    return { isRoomChange: false };
  }

  if (sessionStorage.getItem(LEGACY_NAVIGATION_KEY) === "true") {
    if (shouldConsume) {
      sessionStorage.removeItem(LEGACY_NAVIGATION_KEY);
    }
    return { isRoomChange: true, source: "legacy" };
  }

  return { isRoomChange: false };
};

export const clearRoomNavigationIntent = (): void => {
  if (!isBrowser()) return;
  sessionStorage.removeItem(ROOM_NAVIGATION_INTENT_KEY);
  sessionStorage.removeItem(LEGACY_NAVIGATION_KEY);
};
